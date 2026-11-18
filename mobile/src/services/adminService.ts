import { supabase } from '../lib/supabase';

export type AdminRow = Record<string, any>;

export type AdminDashboardData = {
  students: number;
  parents: number;
  teachers: number;
  drivers: number;
  buses: number;
  routes: number;
  incidents: number;
  unreadNotifications: number;
};

export function adminRowName(row?: AdminRow | null) {
  if (!row) return '';

  const combined = [
    row.first_name,
    row.middle_name,
    row.last_name,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return String(
    row.full_name ??
      row.name ??
      row.title ??
      row.student_name ??
      row.parent_name ??
      row.teacher_name ??
      row.driver_name ??
      row.username ??
      combined ??
      ''
  ).trim();
}

export function adminRowSubtitle(row?: AdminRow | null) {
  if (!row) return '';

  return String(
    row.phone_number ??
      row.phone ??
      row.bus_number ??
      row.route_name ??
      row.code ??
      row.status ??
      row.email ??
      row.type ??
      ''
  ).trim();
}

async function countRows(
  table: string,
  schoolId?: string | null,
  schoolScoped = true
) {
  try {
    let query = supabase
      .from(table)
      .select('*', {
        count: 'exact',
        head: true,
      });

    if (schoolScoped && schoolId) {
      query = query.eq('school_id', schoolId);
    }

    const { count, error } = await query;

    if (error) {
      console.log(`[admin] count ${table}:`, error.message);
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    console.log(`[admin] count ${table}:`, error);
    return 0;
  }
}

export async function getAdminDashboard(
  schoolId?: string | null,
  userId?: string | null
): Promise<AdminDashboardData> {
  const [
    students,
    parents,
    teachers,
    drivers,
    buses,
    routes,
    incidents,
  ] = await Promise.all([
    countRows('students', schoolId),
    countRows('parents', schoolId),
    countRows('teachers', schoolId),
    countRows('drivers', schoolId),
    countRows('buses', schoolId),
    countRows('routes', schoolId),
    countRows('driver_incidents', schoolId),
  ]);

  let unreadNotifications = 0;

  if (userId) {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('user_id', userId)
        .or('is_read.eq.false,is_read.is.null');

      if (!error) {
        unreadNotifications = count ?? 0;
      }
    } catch {
      unreadNotifications = 0;
    }
  }

  return {
    students,
    parents,
    teachers,
    drivers,
    buses,
    routes,
    incidents,
    unreadNotifications,
  };
}

export async function getAdminRows(args: {
  table: string;
  schoolId?: string | null;
  schoolScoped?: boolean;
  limit?: number;
  orderBy?: string;
  ascending?: boolean;
}) {
  let query = supabase
    .from(args.table)
    .select('*');

  if (
    args.schoolScoped !== false &&
    args.schoolId
  ) {
    query = query.eq(
      'school_id',
      args.schoolId
    );
  }

  if (args.orderBy) {
    query = query.order(
      args.orderBy,
      {
        ascending:
          args.ascending ??
          false,
      }
    );
  }

  const { data, error } =
    await query.limit(
      args.limit ?? 250
    );

  if (error) {
    console.log(
      `[admin] ${args.table}:`,
      error.message
    );

    throw error;
  }

  return (
    data ??
    []
  ) as unknown as AdminRow[];
}

export async function getAdminNotifications(
  userId: string,
  limit = 200
) {
  const { data, error } =
    await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', {
        ascending: false,
      })
      .limit(limit);

  if (error) {
    throw error;
  }

  return (
    data ??
    []
  ) as unknown as AdminRow[];
}

export async function markAdminNotificationRead(
  id: string
) {
  const { error } =
    await supabase
      .from('notifications')
      .update({
        is_read: true,
      })
      .eq('id', id);

  if (error) {
    throw error;
  }
}

export async function markAllAdminNotificationsRead(
  userId: string
) {
  const { error } =
    await supabase
      .from('notifications')
      .update({
        is_read: true,
      })
      .eq('user_id', userId)
      .or(
        'is_read.eq.false,is_read.is.null'
      );

  if (error) {
    throw error;
  }
}

export async function getSchoolRecord(
  schoolId?: string | null
) {
  if (!schoolId) {
    return null;
  }

  const { data, error } =
    await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .maybeSingle();

  if (error) {
    console.log(
      '[admin] school:',
      error.message
    );
    return null;
  }

  return data as AdminRow | null;
}
