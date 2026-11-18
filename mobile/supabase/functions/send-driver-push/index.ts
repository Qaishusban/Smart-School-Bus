type AnyRow = Record<string, any>;

type WebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: AnyRow;
  old_record?: AnyRow | null;
};

type RecipientRole =
  | 'driver'
  | 'parent'
  | 'teacher';

const EXPO_PUSH_URL =
  'https://exp.host/--/api/v2/push/send';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function jsonResponse(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json',
      },
    }
  );
}

function cleanText(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}

function isExpoToken(
  token: string
) {
  return (
    token.startsWith(
      'ExponentPushToken['
    ) ||
    token.startsWith(
      'ExpoPushToken['
    )
  );
}

function recipientFromRow(
  row: AnyRow
): {
  role: RecipientRole;
  linkedId: string;
} | null {
  /*
   * IMPORTANT:
   *
   * بعض إشعارات الأهل يتم إنشاؤها بواسطة السائق،
   * لذلك قد يحتوي السجل على:
   *
   * driver_id + parent_id
   *
   * المستلم الحقيقي هنا هو ولي الأمر.
   */

  if (row.parent_id) {
    return {
      role: 'parent',
      linkedId: String(
        row.parent_id
      ),
    };
  }

  if (row.teacher_id) {
    return {
      role: 'teacher',
      linkedId: String(
        row.teacher_id
      ),
    };
  }

  if (row.driver_id) {
    return {
      role: 'driver',
      linkedId: String(
        row.driver_id
      ),
    };
  }

  return null;
}

function notificationScreen(
  role: RecipientRole
) {
  if (role === 'parent') {
    return 'ParentNotifications';
  }

  if (role === 'teacher') {
    return 'TeacherNotifications';
  }

  return 'DriverNotifications';
}

/* -------------------------------------------------------------------------- */
/* Preferences                                                                */
/* -------------------------------------------------------------------------- */

function preferenceKey(
  typeValue: unknown
): string | null {
  const type =
    cleanText(
      typeValue
    ).toLowerCase();

  switch (type) {
    case 'trip_started':
    case 'trip_start':
    case 'started':
      return 'trip_started';

    case 'trip_ended':
    case 'trip_end':
    case 'ended':
      return 'trip_ended';

    case 'eta_10':
    case '10_min':
    case 'ten_minutes':
      return 'eta_10';

    case 'eta_5':
    case '5_min':
    case 'five_minutes':
      return 'eta_5';

    case 'arrived':
    case 'arrival':
    case 'bus_arrived':
      return 'arrived';

    case 'incident':
    case 'bus_incident':
    case 'delay':
      return 'bus_incidents';

    case 'picked_up':
    case 'pickup':
    case 'boarded':
    case 'delivered':
    case 'dropoff':
    case 'absent':
    case 'attendance':
    case 'attendance_change':
      return 'attendance_changes';

    case 'announcement':
    case 'school_announcement':
      return 'school_announcements';

    case 'general_broadcast':
    case 'broadcast':
    case 'admin':
      return 'general_broadcasts';

    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Supabase REST                                                              */
/* -------------------------------------------------------------------------- */

async function fetchJson(
  url: string,
  headers: HeadersInit
) {
  const response =
    await fetch(
      url,
      {
        headers,
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${text}`
    );
  }

  if (!text) {
    return null;
  }

  return JSON.parse(
    text
  );
}

function supabaseHeaders(
  serviceKey: string
) {
  return {
    apikey:
      serviceKey,

    Authorization:
      `Bearer ${serviceKey}`,

    'Content-Type':
      'application/json',
  };
}

/* -------------------------------------------------------------------------- */
/* Unified Push Tokens                                                        */
/* -------------------------------------------------------------------------- */

async function getUnifiedTokens(
  supabaseUrl: string,
  serviceKey: string,
  role: RecipientRole,
  linkedId: string
): Promise<string[]> {
  const params =
    new URLSearchParams({
      select:
        'expo_push_token,is_active',

      user_role:
        `eq.${role}`,

      linked_id:
        `eq.${linkedId}`,

      is_active:
        'eq.true',
    });

  const url =
    `${supabaseUrl}` +
    `/rest/v1/user_push_tokens?` +
    params.toString();

  const rows =
    await fetchJson(
      url,
      supabaseHeaders(
        serviceKey
      )
    );

  if (
    !Array.isArray(rows)
  ) {
    return [];
  }

  return Array.from(
    new Set(
      rows
        .map(
          (item: AnyRow) =>
            cleanText(
              item
                ?.expo_push_token
            )
        )
        .filter(
          (
            token: string
          ) =>
            isExpoToken(
              token
            )
        )
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Driver Fallback                                                            */
/* -------------------------------------------------------------------------- */

async function getDriverFallbackToken(
  supabaseUrl: string,
  serviceKey: string,
  driverId: string
): Promise<string[]> {
  const params =
    new URLSearchParams({
      select:
        'id,expo_push_token,push_enabled',

      id:
        `eq.${driverId}`,

      limit:
        '1',
    });

  const url =
    `${supabaseUrl}` +
    `/rest/v1/drivers?` +
    params.toString();

  const rows =
    await fetchJson(
      url,
      supabaseHeaders(
        serviceKey
      )
    );

  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return [];
  }

  const driver =
    rows[0];

  if (
    driver
      ?.push_enabled === false
  ) {
    console.log(
      '[bus-push] driver push disabled:',
      driverId
    );

    return [];
  }

  const token =
    cleanText(
      driver
        ?.expo_push_token
    );

  if (
    !isExpoToken(token)
  ) {
    return [];
  }

  console.log(
    '[bus-push] using drivers fallback token:',
    driverId
  );

  return [token];
}

/* -------------------------------------------------------------------------- */
/* Parent Fallback                                                            */
/* -------------------------------------------------------------------------- */

async function getParentFallbackToken(
  supabaseUrl: string,
  serviceKey: string,
  parentId: string
): Promise<string[]> {
  const params =
    new URLSearchParams({
      select:
        'id,expo_push_token',

      id:
        `eq.${parentId}`,

      limit:
        '1',
    });

  const url =
    `${supabaseUrl}` +
    `/rest/v1/parents?` +
    params.toString();

  const rows =
    await fetchJson(
      url,
      supabaseHeaders(
        serviceKey
      )
    );

  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return [];
  }

  const token =
    cleanText(
      rows[0]
        ?.expo_push_token
    );

  if (
    !isExpoToken(token)
  ) {
    return [];
  }

  console.log(
    '[bus-push] using parents fallback token:',
    parentId
  );

  return [token];
}

/* -------------------------------------------------------------------------- */
/* Get Tokens                                                                 */
/* -------------------------------------------------------------------------- */

async function getPushTokens(
  supabaseUrl: string,
  serviceKey: string,
  role: RecipientRole,
  linkedId: string
): Promise<string[]> {
  /*
   * 1) المحرك الموحد أولًا.
   */

  const unifiedTokens =
    await getUnifiedTokens(
      supabaseUrl,
      serviceKey,
      role,
      linkedId
    );

  if (
    unifiedTokens.length >
    0
  ) {
    console.log(
      '[bus-push] unified token found:',
      {
        role,
        linkedId,
        count:
          unifiedTokens.length,
      }
    );

    return unifiedTokens;
  }

  /*
   * 2) Compatibility fallback للسائق.
   *
   * النظام القديم يحفظ Expo token
   * داخل drivers.expo_push_token.
   */

  if (
    role === 'driver'
  ) {
    return getDriverFallbackToken(
      supabaseUrl,
      serviceKey,
      linkedId
    );
  }

  /*
   * 3) Compatibility fallback لولي الأمر.
   */

  if (
    role === 'parent'
  ) {
    return getParentFallbackToken(
      supabaseUrl,
      serviceKey,
      linkedId
    );
  }

  return [];
}

/* -------------------------------------------------------------------------- */
/* Notification Preferences                                                   */
/* -------------------------------------------------------------------------- */

async function getPreferences(
  supabaseUrl: string,
  serviceKey: string,
  role: RecipientRole,
  linkedId: string
): Promise<AnyRow | null> {
  const params =
    new URLSearchParams({
      select:
        '*',

      user_role:
        `eq.${role}`,

      linked_id:
        `eq.${linkedId}`,

      limit:
        '1',
    });

  const url =
    `${supabaseUrl}` +
    `/rest/v1/notification_preferences?` +
    params.toString();

  const rows =
    await fetchJson(
      url,
      supabaseHeaders(
        serviceKey
      )
    );

  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return null;
  }

  return rows[0];
}

function preferenceAllows(
  prefs: AnyRow | null,
  row: AnyRow
) {
  /*
   * عدم وجود preferences =
   * الإشعارات مسموحة افتراضيًا.
   */

  if (!prefs) {
    return true;
  }

  if (
    prefs.mute_all ===
    true
  ) {
    return false;
  }

  if (
    prefs.push_enabled ===
    false
  ) {
    return false;
  }

  const key =
    preferenceKey(
      row.type
    );

  if (
    key &&
    prefs[key] === false
  ) {
    return false;
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* Expo Push                                                                  */
/* -------------------------------------------------------------------------- */

async function sendExpoPush(
  token: string,
  row: AnyRow,
  role: RecipientRole
) {
  const title =
    cleanText(
      row.title
    ) ||
    'Smart School Bus';

  const body =
    cleanText(
      row.body
    ) ||
    cleanText(
      row.message
    ) ||
    'لديك إشعار جديد';

  const currentData =
    row.data &&
    typeof row.data ===
      'object' &&
    !Array.isArray(
      row.data
    )
      ? row.data
      : {};

  const message = {
    to:
      token,

    sound:
      'default',

    title,

    body,

    priority:
      'high',

    /*
     * Android must target the same notification channel
     * created by the mobile app.
     */
    channelId:
      'smart-school-bus-default',

    badge:
      1,

    data: {
      ...currentData,

      notification_id:
        row.id ??
        null,

      screen:
        notificationScreen(
          role
        ),

      recipient_role:
        role,

      notification_type:
        row.type ??
        null,

      type:
        row.type ??
        null,

      school_id:
        row.school_id ??
        null,

      driver_id:
        row.driver_id ??
        null,

      parent_id:
        row.parent_id ??
        null,

      teacher_id:
        row.teacher_id ??
        null,

      student_id:
        row.student_id ??
        null,

      bus_id:
        row.bus_id ??
        null,

      route_id:
        row.route_id ??
        null,

      date_key:
        row.date_key ??
        null,
    },
  };

  const response =
    await fetch(
      EXPO_PUSH_URL,
      {
        method:
          'POST',

        headers: {
          Accept:
            'application/json',

          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify(
            message
          ),
      }
    );

  const text =
    await response.text();

  if (
    !response.ok
  ) {
    throw new Error(
      `Expo ${response.status}: ${text}`
    );
  }

  let result: any =
    null;

  try {
    result =
      JSON.parse(
        text
      );
  } catch {
    result =
      text;
  }

  /*
   * Expo أحيانًا يرجع HTTP 200 لكن
   * ticket نفسه يحتوي status:error.
   */

  const ticket =
    result?.data;

  if (
    ticket &&
    !Array.isArray(
      ticket
    ) &&
    ticket.status ===
      'error'
  ) {
    throw new Error(
      `Expo ticket error: ${
        ticket.message ??
        JSON.stringify(
          ticket.details ??
            ticket
        )
      }`
    );
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Edge Function                                                              */
/* -------------------------------------------------------------------------- */

Deno.serve(
  async (
    req: Request
  ) => {
    if (
      req.method !==
      'POST'
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            'method_not_allowed',
        },
        405
      );
    }

    try {
      const payload =
        (await req.json()) as
          WebhookPayload;

      const row =
        payload
          ?.record;

      if (
        !row ||
        !row.id
      ) {
        return jsonResponse({
          ok:
            false,

          skipped:
            true,

          reason:
            'missing_record',
        });
      }

      const recipient =
        recipientFromRow(
          row
        );

      if (
        !recipient
      ) {
        console.log(
          '[bus-push] no recipient:',
          row.id
        );

        return jsonResponse({
          ok:
            true,

          skipped:
            true,

          reason:
            'no_recipient',

          notification_id:
            row.id,
        });
      }

      const supabaseUrl =
        Deno.env.get(
          'SUPABASE_URL'
        );

      const serviceKey =
        Deno.env.get(
          'SUPABASE_SERVICE_ROLE_KEY'
        );

      if (
        !supabaseUrl ||
        !serviceKey
      ) {
        return jsonResponse(
          {
            ok:
              false,

            error:
              'missing_supabase_environment',
          },
          500
        );
      }

      /*
       * Notification preferences
       */

      const preferences =
        await getPreferences(
          supabaseUrl,
          serviceKey,
          recipient.role,
          recipient.linkedId
        );

      if (
        !preferenceAllows(
          preferences,
          row
        )
      ) {
        console.log(
          '[bus-push] disabled by preferences:',
          {
            role:
              recipient.role,

            linkedId:
              recipient.linkedId,

            notificationId:
              row.id,
          }
        );

        return jsonResponse({
          ok:
            true,

          skipped:
            true,

          reason:
            'disabled_by_preferences',

          role:
            recipient.role,

          linked_id:
            recipient.linkedId,

          notification_id:
            row.id,
        });
      }

      /*
       * Push tokens
       */

      const tokens =
        await getPushTokens(
          supabaseUrl,
          serviceKey,
          recipient.role,
          recipient.linkedId
        );

      if (
        tokens.length ===
        0
      ) {
        console.log(
          '[bus-push] no active push token:',
          {
            role:
              recipient.role,

            linkedId:
              recipient.linkedId,

            notificationId:
              row.id,
          }
        );

        return jsonResponse({
          ok:
            true,

          skipped:
            true,

          reason:
            'no_active_push_token',

          role:
            recipient.role,

          linked_id:
            recipient.linkedId,

          notification_id:
            row.id,
        });
      }

      /*
       * Send to all active devices
       */

      const results =
        await Promise.allSettled(
          tokens.map(
            (
              token
            ) =>
              sendExpoPush(
                token,
                row,
                recipient.role
              )
          )
        );

      const sent =
        results.filter(
          (
            item
          ) =>
            item.status ===
            'fulfilled'
        ).length;

      const failed =
        results.length -
        sent;

      const errors =
        results
          .filter(
            (
              item
            ): item is PromiseRejectedResult =>
              item.status ===
              'rejected'
          )
          .map(
            (
              item
            ) =>
              String(
                item.reason
                  ?.message ??
                  item.reason
              )
          );

      console.log(
        '[bus-push] completed:',
        {
          notificationId:
            row.id,

          role:
            recipient.role,

          linkedId:
            recipient.linkedId,

          tokenCount:
            tokens.length,

          sent,

          failed,

          errors,
        }
      );

      return jsonResponse({
        ok:
          sent > 0,

        notification_id:
          row.id,

        role:
          recipient.role,

        linked_id:
          recipient.linkedId,

        token_count:
          tokens.length,

        sent,

        failed,

        errors,
      });
    } catch (
      error
    ) {
      console.error(
        '[bus-push] fatal error:',
        error
      );

      return jsonResponse(
        {
          ok:
            false,

          error:
            error instanceof
            Error
              ? error.message
              : String(
                  error
                ),
        },
        500
      );
    }
  }
);