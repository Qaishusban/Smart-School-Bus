import {
  supabase,
} from '../lib/supabase';

export type AdminNotificationItem = {
  id: string;

  user_id:
    | string
    | null;

  school_id:
    | string
    | null;

  title:
    | string
    | null;

  body:
    | string
    | null;

  message:
    | string
    | null;

  type:
    | string
    | null;

  event_code:
    | string
    | null;

  is_read:
    | boolean
    | null;

  distance_km:
    | number
    | null;

  eta_minutes:
    | number
    | null;

  student_name:
    | string
    | null;

  bus_number:
    | string
    | null;

  created_at:
    | string
    | null;
};

export async function getAdminNotifications(
  args: {
    userId:
      string;

    limit?:
      number;
  }
): Promise<
  AdminNotificationItem[]
> {
  if (
    !args.userId
  ) {
    return [];
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'notifications'
      )
      .select(
        [
          'id',
          'user_id',
          'school_id',
          'title',
          'body',
          'message',
          'type',
          'event_code',
          'is_read',
          'distance_km',
          'eta_minutes',
          'student_name',
          'bus_number',
          'created_at',
        ].join(',')
      )
      .eq(
        'user_id',
        args.userId
      )
      .order(
        'created_at',
        {
          ascending:
            false,
        }
      )
      .limit(
        args.limit ??
          150
      );

  if (error) {
    console.log(
      '[admin notifications] load:',
      error
    );

    throw error;
  }

  return (
    data ??
    []
  ) as unknown as AdminNotificationItem[];
}

export async function markAdminNotificationRead(
  notificationId:
    string
) {
  const {
    error,
  } =
    await supabase
      .from(
        'notifications'
      )
      .update({
        is_read:
          true,
      })
      .eq(
        'id',
        notificationId
      );

  if (error) {
    throw error;
  }
}

export async function markAllAdminNotificationsRead(
  userId:
    string
) {
  const {
    error,
  } =
    await supabase
      .from(
        'notifications'
      )
      .update({
        is_read:
          true,
      })
      .eq(
        'user_id',
        userId
      )
      .or(
        'is_read.eq.false,is_read.is.null'
      );

  if (error) {
    throw error;
  }
}

export function subscribeAdminNotifications(
  userId:
    string,
  onChange:
    () => void
) {
  if (
    !userId
  ) {
    return () => {};
  }

  const channel =
    supabase
      .channel(
        `admin-notifications-${userId}`
      )
      .on(
        'postgres_changes',
        {
          event:
            '*',

          schema:
            'public',

          table:
            'notifications',

          filter:
            `user_id=eq.${userId}`,
        },
        () => {
          onChange();
        }
      )
      .subscribe();

  return () => {
    void supabase
      .removeChannel(
        channel
      );
  };
}