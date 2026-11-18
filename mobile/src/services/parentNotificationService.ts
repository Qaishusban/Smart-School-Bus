import { supabase } from '../lib/supabase';

export type ParentNotificationItem = {
  id: string;
  source: 'bus' | 'broadcast';

  title: string;
  body: string;

  type: string;
  category?: string | null;

  created_at: string;

  is_read: boolean;

  parent_id?: string | null;
  student_id?: string | null;
  school_id?: string | null;
  bus_id?: string | null;
  route_id?: string | null;

  data?: Record<string, any> | null;

  raw: Record<string, any>;
};

function normalizeBusNotification(
  row: Record<string, any>
): ParentNotificationItem {
  return {
    id: row.id,

    source: 'bus',

    title:
      row.title ??
      row.type ??
      'Notification',

    body:
      row.body ??
      row.message ??
      '',

    type:
      row.type ??
      'general',

    category:
      row.type ??
      null,

    created_at:
      row.created_at,

    is_read:
      Boolean(
        row.is_read
      ),

    parent_id:
      row.parent_id ??
      null,

    student_id:
      row.student_id ??
      null,

    school_id:
      row.school_id ??
      null,

    bus_id:
      row.bus_id ??
      null,

    route_id:
      row.route_id ??
      null,

    data:
      row.data ??
      null,

    raw: row,
  };
}

function normalizeBroadcast(
  row: Record<string, any>
): ParentNotificationItem {
  return {
    id:
      `broadcast-${row.id}`,

    source:
      'broadcast',

    title:
      row.title ??
      'School Announcement',

    body:
      row.body ??
      '',

    type:
      row.category ??
      'broadcast',

    category:
      row.category ??
      null,

    created_at:
      row.created_at,

    /*
     * school_broadcasts ما فيه is_read
     * لذلك بنعتبره مقروء للواجهة حالياً.
     */
    is_read: true,

    parent_id:
      row.target_parent_id ??
      null,

    student_id:
      row.target_student_id ??
      null,

    school_id:
      row.school_id ??
      null,

    bus_id:
      row.target_bus_id ??
      null,

    route_id:
      null,

    data: null,

    raw: row,
  };
}

export async function getParentBusNotifications(
  parentId: string,
  studentIds: string[] = []
) {
  if (!parentId) {
    return [];
  }

  /*
   * ناخذ إشعارات ولي الأمر مباشرة.
   */
  const {
    data: parentRows,
    error: parentError,
  } = await supabase
    .from('bus_notifications')
    .select('*')
    .eq(
      'parent_id',
      parentId
    )
    .order(
      'created_at',
      {
        ascending: false,
      }
    )
    .limit(100);

  if (parentError) {
    console.log(
      '[notifications] parent notifications error:',
      parentError.message
    );
  }

  let studentRows:
    Record<string, any>[] = [];

  /*
   * بعض إشعارات الباص تكون مربوطة بالطالب
   * بدون parent_id.
   */
  if (
    studentIds.length > 0
  ) {
    const {
      data,
      error,
    } = await supabase
      .from(
        'bus_notifications'
      )
      .select('*')
      .in(
        'student_id',
        studentIds
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      )
      .limit(100);

    if (error) {
      console.log(
        '[notifications] student notifications error:',
        error.message
      );
    } else {
      studentRows =
        data ?? [];
    }
  }

  /*
   * دمج بدون تكرار.
   */
  const unique =
    new Map<
      string,
      Record<string, any>
    >();

  for (
    const row of [
      ...(parentRows ?? []),
      ...studentRows,
    ]
  ) {
    if (row?.id) {
      unique.set(
        row.id,
        row
      );
    }
  }

  return Array.from(
    unique.values()
  )
    .map(
      normalizeBusNotification
    )
    .sort(
      (
        a,
        b
      ) =>
        new Date(
          b.created_at
        ).getTime() -
        new Date(
          a.created_at
        ).getTime()
    );
}

export async function getParentSchoolBroadcasts(
  options: {
    parentId: string;
    schoolIds: string[];
    studentIds: string[];
  }
) {
  const {
    parentId,
    schoolIds,
    studentIds,
  } = options;

  if (
    schoolIds.length === 0
  ) {
    return [];
  }

  /*
   * نقرأ إعلانات مدارس أبناء ولي الأمر فقط.
   */
  const {
    data,
    error,
  } = await supabase
    .from(
      'school_broadcasts'
    )
    .select('*')
    .in(
      'school_id',
      schoolIds
    )
    .order(
      'created_at',
      {
        ascending: false,
      }
    )
    .limit(100);

  if (error) {
    console.log(
      '[notifications] broadcasts error:',
      error.message
    );

    return [];
  }

  const visible =
    (data ?? []).filter(
      (row) => {
        const targetRole =
          String(
            row.target_role ??
            'all'
          )
            .toLowerCase()
            .trim();

        /*
         * عام للكل.
         */
        if (
          targetRole ===
            'all' &&
          !row.target_parent_id &&
          !row.target_student_id
        ) {
          return true;
        }

        /*
         * لجميع الأهالي في المدرسة.
         */
        if (
          targetRole ===
            'parent' &&
          !row.target_parent_id &&
          !row.target_student_id
        ) {
          return true;
        }

        /*
         * موجه لولي الأمر نفسه.
         */
        if (
          row.target_parent_id ===
          parentId
        ) {
          return true;
        }

        /*
         * موجه لأحد أبناء ولي الأمر.
         */
        if (
          row.target_student_id &&
          studentIds.includes(
            row.target_student_id
          )
        ) {
          return true;
        }

        return false;
      }
    );

  return visible.map(
    normalizeBroadcast
  );
}

export async function getParentNotificationsFeed(
  options: {
    parentId: string;
    studentIds: string[];
    schoolIds: string[];
  }
) {
  const [
    bus,
    broadcasts,
  ] = await Promise.all([
    getParentBusNotifications(
      options.parentId,
      options.studentIds
    ),

    getParentSchoolBroadcasts(
      options
    ),
  ]);

  return [
    ...bus,
    ...broadcasts,
  ].sort(
    (
      a,
      b
    ) =>
      new Date(
        b.created_at
      ).getTime() -
      new Date(
        a.created_at
      ).getTime()
  );
}

export async function markParentNotificationRead(
  notification:
    ParentNotificationItem
) {
  /*
   * فقط bus_notifications فيها is_read.
   */
  if (
    notification.source !==
    'bus'
  ) {
    return;
  }

  const {
    error,
  } = await supabase
    .from(
      'bus_notifications'
    )
    .update({
      is_read: true,
    })
    .eq(
      'id',
      notification.id
    );

  if (error) {
    throw error;
  }
}

export async function markAllParentNotificationsRead(
  notifications:
    ParentNotificationItem[]
) {
  const ids =
    notifications
      .filter(
        (item) =>
          item.source ===
            'bus' &&
          !item.is_read
      )
      .map(
        (item) =>
          item.id
      );

  if (!ids.length) {
    return;
  }

  const {
    error,
  } = await supabase
    .from(
      'bus_notifications'
    )
    .update({
      is_read: true,
    })
    .in(
      'id',
      ids
    );

  if (error) {
    throw error;
  }
}

export function subscribeParentNotifications(
  parentId: string,
  studentIds: string[],
  onChange: () => void
) {
  const channels:
    ReturnType<
      typeof supabase.channel
    >[] = [];

  /*
   * إشعارات الباص.
   */
  const busChannel =
    supabase
      .channel(
        `parent-bus-notifications-${parentId}`
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table:
            'bus_notifications',
        },
        (payload) => {
          const row =
            (payload.new ??
              payload.old ??
              {}) as Record<
              string,
              any
            >;

          if (
            row.parent_id ===
              parentId ||
            (
              row.student_id &&
              studentIds.includes(
                row.student_id
              )
            )
          ) {
            onChange();
          }
        }
      )
      .subscribe();

  channels.push(
    busChannel
  );

  /*
   * Broadcasts.
   */
  const broadcastChannel =
    supabase
      .channel(
        `parent-school-broadcasts-${parentId}`
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table:
            'school_broadcasts',
        },
        () => {
          /*
           * نعيد التحميل ونطبق الفلترة
           * في service.
           */
          onChange();
        }
      )
      .subscribe();

  channels.push(
    broadcastChannel
  );

  return () => {
    for (
      const channel of channels
    ) {
      supabase.removeChannel(
        channel
      );
    }
  };
}