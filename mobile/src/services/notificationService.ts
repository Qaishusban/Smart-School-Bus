import { supabase } from '../lib/supabase';

export type DriverNotificationItem = {
  id: string;

  school_id?: string | null;
  bus_id?: string | null;
  driver_id?: string | null;
  route_id?: string | null;
  student_id?: string | null;
  parent_id?: string | null;

  type?: string | null;

  title?: string | null;
  body?: string | null;
  message?: string | null;

  status?: string | null;
  is_read?: boolean | null;

  data?: Record<string, any> | null;

  created_at?: string | null;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalize(
  value: unknown
) {
  return String(
    value ?? ''
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      '_'
    );
}

function todayKey(
  date: Date = new Date()
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}-${day}`;
}

function instructionTitle(
  status: string
) {
  const value =
    normalize(status);

  if (
    [
      'sick',
      'sick_leave',
      'medical',
      'medical_leave',
    ].includes(value)
  ) {
    return 'إجازة مرضية | Sick Leave';
  }

  if (
    [
      'leave',
      'leave_holiday',
      'holiday',
      'vacation',
    ].includes(value)
  ) {
    return 'إجازة طالب | Student Leave';
  }

  if (
    [
      'absent',
      'absence',
    ].includes(value)
  ) {
    return 'عذر غياب | Absence Excuse';
  }

  if (
    [
      'no_bus',
      'not_riding',
    ].includes(value)
  ) {
    return 'لن يستخدم الباص | Not Riding';
  }

  if (
    [
      'with_parent',
      'with_family',
      'picked_by_parent',
      'parent_pickup',
    ].includes(value)
  ) {
    return 'استلام من ولي الأمر | Parent Pickup';
  }

  return 'تعليمات من ولي الأمر | Parent Instruction';
}

/* -------------------------------------------------------------------------- */
/* Public helpers                                                             */
/* -------------------------------------------------------------------------- */

export function normalizeDriverNotificationType(
  value: unknown
) {
  return normalize(
    value
  );
}

export function isDriverNotificationUnread(
  row: DriverNotificationItem
) {
  if (
    row.is_read === true
  ) {
    return false;
  }

  const status =
    normalize(
      row.status
    );

  return ![
    'read',
    'seen',
    'opened',
  ].includes(
    status
  );
}

/* -------------------------------------------------------------------------- */
/* Parent instructions                                                       */
/* -------------------------------------------------------------------------- */

async function getParentInstructionNotifications(
  args: {
    driverId: string;
    schoolId?: string | null;
    busId?: string | null;
    routeId?: string | null;
  }
): Promise<
  DriverNotificationItem[]
> {
  const {
    driverId,
    schoolId,
    busId,
    routeId,
  } = args;

  /*
   * لازم نعرف Route السائق حتى لا نظهر
   * طلبات طلاب من مسارات أخرى.
   */
  if (!routeId) {
    return [];
  }

  /* ------------------------------------------------------------------------ */
  /* Students assigned to route                                               */
  /* ------------------------------------------------------------------------ */

  const {
    data: routeLinks,
    error: linksError,
  } =
    await supabase
      .from(
        'route_students'
      )
      .select(
        'student_id'
      )
      .eq(
        'route_id',
        routeId
      );

  if (linksError) {
    console.log(
      '[notifications] route students:',
      linksError
    );

    return [];
  }

  const studentIds =
    Array.from(
      new Set(
        (
          routeLinks ??
          []
        )
          .map(
            (
              row: any
            ) =>
              row?.student_id
          )
          .filter(
            Boolean
          )
      )
    );

  if (
    !studentIds.length
  ) {
    return [];
  }

  /* ------------------------------------------------------------------------ */
  /* Today's parent instructions                                              */
  /* ------------------------------------------------------------------------ */

  const today =
    todayKey();

  const {
    data: instructions,
    error:
      instructionsError,
  } =
    await supabase
      .from(
        'parent_daily_instructions'
      )
      .select('*')
      .in(
        'student_id',
        studentIds
      )
      .or(
        `for_date.eq.${today},instruction_date.eq.${today}`
      )
      .order(
        'created_at',
        {
          ascending:
            false,
        }
      );

  if (
    instructionsError
  ) {
    console.log(
      '[notifications] parent instructions:',
      instructionsError
    );

    return [];
  }

  if (
    !instructions?.length
  ) {
    return [];
  }

  /* ------------------------------------------------------------------------ */
  /* Student names                                                            */
  /* ------------------------------------------------------------------------ */

  const {
    data: studentRows,
    error:
      studentsError,
  } =
    await supabase
      .from(
        'students'
      )
      .select('*')
      .in(
        'id',
        studentIds
      );

  if (
    studentsError
  ) {
    console.log(
      '[notifications] students:',
      studentsError
    );
  }

  const studentMap =
    new Map<
      string,
      any
    >();

  for (
    const row of
      studentRows ??
      []
  ) {
    studentMap.set(
      String(
        row.id
      ),
      row
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Convert instructions to notifications                                    */
  /* ------------------------------------------------------------------------ */

  return (
    instructions ??
    []
  ).map(
    (
      row: any
    ) => {
      const student =
        studentMap.get(
          String(
            row.student_id
          )
        );

      const studentName =
        student
          ?.full_name ??
        student
          ?.full_name_ar ??
        student
          ?.full_name_en ??
        student
          ?.name ??
        'الطالب';

      const rawStatus =
        normalize(
          row?.status ??
          row
            ?.instruction_type ??
          row?.type
        );

      /*
       * بعض نسخ الجدول قد تحتوي trip_mode،
       * وبعضها period أو shift.
       */
      const period =
        normalize(
          row
            ?.trip_mode ??
          row
            ?.period ??
          row
            ?.shift
        );

      const periodText =
        period ===
          'to_home' ||
        period ===
          'evening' ||
        period ===
          'pm'
          ? 'المسائية | Evening'
          : period ===
              'to_school' ||
            period ===
              'morning' ||
            period ===
              'am'
          ? 'الصباحية | Morning'
          : 'اليوم | Today';

      const note =
        String(
          row?.note ??
          row?.details ??
          row?.reason ??
          row?.message ??
          ''
        ).trim();

      const body =
        `${studentName} • ${periodText}` +
        (
          note
            ? `\n${note}`
            : ''
        );

      return {
        /*
         * Prefix prevents collision with
         * bus_notifications UUIDs.
         */
        id:
          `instruction:${row.id}`,

        school_id:
          schoolId ??
          row
            ?.school_id ??
          null,

        bus_id:
          busId ??
          row
            ?.bus_id ??
          null,

        driver_id:
          driverId,

        route_id:
          routeId,

        student_id:
          row
            ?.student_id ??
          null,

        parent_id:
          row
            ?.parent_id ??
          null,

        type:
          'parent_instruction',

        title:
          instructionTitle(
            rawStatus
          ),

        body,

        message:
          note ||
          null,

        /*
         * parent_daily_instructions لا نضمن
         * وجود is_read/status فيها.
         *
         * لذلك لا نحاول تعديل جدول ولي الأمر.
         */
        status:
          'created',

        is_read:
          false,

        data: {
          source:
            'parent_daily_instructions',

          source_id:
            row?.id ??
            null,

          instruction_status:
            rawStatus ||
            null,

          trip_mode:
            row
              ?.trip_mode ??
            row
              ?.period ??
            null,

          note:
            note ||
            null,
        },

        created_at:
          row
            ?.created_at ??
          row
            ?.updated_at ??
          row
            ?.instruction_date ??
          row
            ?.for_date ??
          null,
      } as DriverNotificationItem;
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Driver notifications                                                       */
/* -------------------------------------------------------------------------- */

export async function getDriverNotifications(
  args: {
    driverId: string;
    schoolId?: string | null;
    busId?: string | null;
    routeId?: string | null;
    limit?: number;
  }
): Promise<
  DriverNotificationItem[]
> {
  const {
    driverId,
    schoolId,
    busId,
    routeId,
    limit = 100,
  } = args;

  if (!driverId) {
    return [];
  }

  /* ------------------------------------------------------------------------ */
  /* Normal bus notifications                                                 */
  /* ------------------------------------------------------------------------ */

  let query =
    supabase
      .from(
        'bus_notifications'
      )
      .select('*')
      .eq(
        'driver_id',
        driverId
      );

  if (schoolId) {
    query =
      query.eq(
        'school_id',
        schoolId
      );
  }

  if (busId) {
    query =
      query.eq(
        'bus_id',
        busId
      );
  }

  /*
   * لا نفرض route_id على bus_notifications
   * لأن بعض التنبيهات العامة للسائق قد تكون
   * route_id = null.
   *
   * لكن نستخدم routeId لتحديد تعليمات أولياء
   * الأمور الخاصة بمسار هذا السائق.
   */

  const [
    busResult,
    instructionRows,
  ] =
    await Promise.all([
      query
        .order(
          'created_at',
          {
            ascending:
              false,
          }
        )
        .limit(
          limit
        ),

      getParentInstructionNotifications(
        {
          driverId,
          schoolId,
          busId,
          routeId,
        }
      ),
    ]);

  if (
    busResult.error
  ) {
    console.log(
      '[notifications] driver list:',
      busResult.error
    );

    throw busResult.error;
  }

  /* ------------------------------------------------------------------------ */
  /* Merge                                                                    */
  /* ------------------------------------------------------------------------ */

  const merged: DriverNotificationItem[] =
    [
      ...(
        (
          busResult.data ??
          []
        ) as DriverNotificationItem[]
      ),

      ...instructionRows,
    ];

  /*
   * Defensive de-duplication.
   */
  const unique =
    new Map<
      string,
      DriverNotificationItem
    >();

  for (
    const row of merged
  ) {
    unique.set(
      String(
        row.id
      ),
      row
    );
  }

  return Array.from(
    unique.values()
  )
    .sort(
      (
        a,
        b
      ) => {
        const aTime =
          new Date(
            a.created_at ??
            0
          ).getTime();

        const bTime =
          new Date(
            b.created_at ??
            0
          ).getTime();

        return (
          bTime -
          aTime
        );
      }
    )
    .slice(
      0,
      limit
    );
}

/* -------------------------------------------------------------------------- */
/* Mark one read                                                              */
/* -------------------------------------------------------------------------- */

export async function markDriverNotificationRead(
  notificationId: string
) {
  if (
    !notificationId
  ) {
    return;
  }

  /*
   * هذه Notification افتراضية تم إنشاؤها
   * من parent_daily_instructions.
   *
   * لا نعدل سجل ولي الأمر لأننا لا نفترض
   * وجود status/is_read في ذلك الجدول.
   */
  if (
    notificationId.startsWith(
      'instruction:'
    )
  ) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from(
        'bus_notifications'
      )
      .update({
        status:
          'read',

        is_read:
          true,
      })
      .eq(
        'id',
        notificationId
      );

  if (error) {
    console.log(
      '[notifications] mark read:',
      error
    );

    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Mark all read                                                              */
/* -------------------------------------------------------------------------- */

export async function markAllDriverNotificationsRead(
  driverId: string
) {
  if (!driverId) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from(
        'bus_notifications'
      )
      .update({
        status:
          'read',

        is_read:
          true,
      })
      .eq(
        'driver_id',
        driverId
      )
      .eq(
        'is_read',
        false
      );

  if (error) {
    console.log(
      '[notifications] mark all read:',
      error
    );

    throw error;
  }
}