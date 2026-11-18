import { supabase } from '../lib/supabase';

export type AdminRow = Record<string, any>;

export type AdminDashboardData = {
  school: AdminRow | null;
  currentYear: AdminRow | null;
  counts: {
    students: number;
    parents: number;
    teachers: number;
    drivers: number;
    buses: number;
    routes: number;
    activeBuses: number;
    activeDrivers: number;
    incidentsToday: number;
    unreadNotifications: number;
    currentYearStudents: number;
  };
  recentTrips: AdminRow[];
  recentIncidents: AdminRow[];
  liveLocations: AdminRow[];
  yearEnrollment: Array<{ id: string; name: string; count: number; is_current: boolean }>;
};

function startOfTodayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

export async function getAdminDashboardPremium(
  schoolId: string,
  userId?: string | null
): Promise<AdminDashboardData> {
  if (!schoolId) {
    return {
      school: null,
      currentYear: null,
      counts: {
        students: 0,
        parents: 0,
        teachers: 0,
        drivers: 0,
        buses: 0,
        routes: 0,
        activeBuses: 0,
        activeDrivers: 0,
        incidentsToday: 0,
        unreadNotifications: 0,
        currentYearStudents: 0,
      },
      recentTrips: [],
      recentIncidents: [],
      liveLocations: [],
      yearEnrollment: [],
    };
  }

  const [
    schoolResult,
    studentsResult,
    parentsResult,
    teachersResult,
    driversResult,
    busesResult,
    routesResult,
    activeBusesResult,
    activeDriversResult,
    incidentsTodayResult,
    tripsResult,
    incidentsResult,
    notificationsResult,
  ] = await Promise.all([
    supabase.from('schools').select('*').eq('id', schoolId).maybeSingle(),

    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),

    supabase
      .from('parents')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),

    supabase
      .from('teachers')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),

    supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),

    supabase
      .from('buses')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),

    supabase
      .from('routes')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),

    supabase
      .from('buses')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true),

    supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true),

    supabase
      .from('driver_incidents')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .gte('happened_at', startOfTodayIso()),

    supabase
      .from('bus_trip_events')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('driver_incidents')
      .select('*')
      .eq('school_id', schoolId)
      .order('happened_at', { ascending: false })
      .limit(4),

    userId
      ? supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .or('is_read.eq.false,is_read.is.null')
      : Promise.resolve({ count: 0, data: null, error: null } as any),
  ]);

  if (schoolResult.error) throw schoolResult.error;

  const school = (schoolResult.data ?? null) as AdminRow | null;

  let currentYear: AdminRow | null = null;

  if (school?.current_academic_year_id) {
    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .eq('id', school.current_academic_year_id)
      .maybeSingle();

    if (!error) currentYear = (data ?? null) as AdminRow | null;
  }

  let currentYearStudents = 0;

  if (currentYear?.id) {
    const { data: registeredRows, error: registeredError } = await supabase
      .from('parent_students')
      .select('student_id')
      .eq('school_id', schoolId)
      .eq('academic_year_id', currentYear.id);

    if (!registeredError) {
      currentYearStudents = new Set(
        (registeredRows ?? [])
          .map((row: any) => String(row.student_id ?? ''))
          .filter(Boolean)
      ).size;
    }
  } else {
    currentYearStudents = studentsResult.count ?? 0;
  }

  let yearEnrollment: Array<{ id: string; name: string; count: number; is_current: boolean }> = [];

  const [yearsResult, linksResult] = await Promise.all([
    supabase
      .from('academic_years')
      .select('id,name,is_current')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false }),
    supabase
      .from('parent_students')
      .select('academic_year_id,student_id')
      .eq('school_id', schoolId),
  ]);

  if (!yearsResult.error && !linksResult.error) {
    const links = linksResult.data ?? [];
    yearEnrollment = (yearsResult.data ?? []).map((year: any) => ({
      id: String(year.id),
      name: String(year.name ?? ''),
      is_current: year.is_current === true,
      count: new Set(
        links
          .filter((row: any) => String(row.academic_year_id ?? '') === String(year.id))
          .map((row: any) => String(row.student_id ?? ''))
          .filter(Boolean)
      ).size,
    }));
  }

  const { data: schoolBuses, error: schoolBusesError } = await supabase
    .from('buses')
    .select('id')
    .eq('school_id', schoolId);

  if (schoolBusesError) throw schoolBusesError;

  const busIds = (schoolBuses ?? []).map((row: any) => row.id).filter(Boolean);

  let liveLocations: AdminRow[] = [];

  if (busIds.length) {
    const { data, error } = await supabase
      .from('bus_live_locations')
      .select('*')
      .in('bus_id', busIds);

    if (!error) liveLocations = (data ?? []) as unknown as AdminRow[];
  }

  return {
    school,
    currentYear,
    counts: {
      students: studentsResult.count ?? 0,
      parents: parentsResult.count ?? 0,
      teachers: teachersResult.count ?? 0,
      drivers: driversResult.count ?? 0,
      buses: busesResult.count ?? 0,
      routes: routesResult.count ?? 0,
      activeBuses: activeBusesResult.count ?? 0,
      activeDrivers: activeDriversResult.count ?? 0,
      incidentsToday: incidentsTodayResult.count ?? 0,
      unreadNotifications: notificationsResult.count ?? 0,
      currentYearStudents,
    },
    recentTrips: (tripsResult.data ?? []) as unknown as AdminRow[],
    recentIncidents: (incidentsResult.data ?? []) as unknown as AdminRow[],
    liveLocations,
    yearEnrollment,
  };
}

export async function listAdminRows(
  table: string,
  schoolId: string | null,
  options?: {
    orderBy?: string;
    ascending?: boolean;
    limit?: number;
    schoolScoped?: boolean;
  }
): Promise<AdminRow[]> {
  let query = supabase.from(table).select('*');

  if (schoolId && options?.schoolScoped !== false) {
    if (table === 'bus_attendance') {
      const { data: students, error } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId);

      if (error) throw error;

      const ids = (students ?? []).map((row: any) => row.id).filter(Boolean);
      if (!ids.length) return [];
      query = query.in('student_id', ids);
    } else if (table === 'route_students') {
      const { data: routes, error } = await supabase
        .from('routes')
        .select('id')
        .eq('school_id', schoolId);

      if (error) throw error;

      const ids = (routes ?? []).map((row: any) => row.id).filter(Boolean);
      if (!ids.length) return [];
      query = query.in('route_id', ids);
    } else if (table === 'profiles') {
      query = query.eq('school_id', schoolId);
    } else {
      query = query.eq('school_id', schoolId);
    }
  }

  if (options?.orderBy) {
    query = query.order(options.orderBy, {
      ascending: options.ascending ?? false,
    });
  }

  const { data, error } = await query.limit(options?.limit ?? 500);

  if (error) throw error;
  return (data ?? []) as unknown as AdminRow[];
}

export async function insertAdminRow(
  table: string,
  payload: Record<string, any>
): Promise<AdminRow> {
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select('*')
    .limit(1);

  if (error) throw error;

  const first = (data ?? [])[0] as AdminRow | undefined;

  if (first) return first;

  return {
    ...payload,
  } as AdminRow;
}

export async function updateAdminRow(
  table: string,
  id: string,
  payload: Record<string, any>
): Promise<AdminRow> {
  const { error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', id);

  if (error) throw error;

  const result = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .limit(1);

  if (result.error) {
    return {
      id,
      ...payload,
    } as AdminRow;
  }

  const first = (result.data ?? [])[0] as AdminRow | undefined;

  return (
    first ?? {
      id,
      ...payload,
    }
  ) as AdminRow;
}

export async function deleteAdminRow(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function setCurrentAcademicYear(
  schoolId: string,
  academicYearId: string | null
) {
  const { error: clearError } = await supabase
    .from('academic_years')
    .update({ is_current: false })
    .eq('school_id', schoolId);

  if (clearError) throw clearError;

  if (academicYearId) {
    const { error: yearError } = await supabase
      .from('academic_years')
      .update({ is_current: true })
      .eq('school_id', schoolId)
      .eq('id', academicYearId);

    if (yearError) throw yearError;
  }

  const { error: schoolError } = await supabase
    .from('schools')
    .update({ current_academic_year_id: academicYearId })
    .eq('id', schoolId);

  if (schoolError) throw schoolError;
}

export async function getAdminMapData(schoolId: string) {
  const [schoolResult, routesResult, studentsResult, busesResult, teachersResult] =
    await Promise.all([
      supabase.from('schools').select('*').eq('id', schoolId).maybeSingle(),
      supabase.from('routes').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('students').select('*').eq('school_id', schoolId).eq('is_active', true),
      supabase.from('buses').select('*').eq('school_id', schoolId).eq('is_active', true),
      supabase.from('teachers').select('*').eq('school_id', schoolId).eq('is_active', true),
    ]);

  if (schoolResult.error) throw schoolResult.error;
  if (routesResult.error) throw routesResult.error;
  if (studentsResult.error) throw studentsResult.error;
  if (busesResult.error) throw busesResult.error;
  if (teachersResult.error) throw teachersResult.error;

  const buses = (busesResult.data ?? []) as unknown as AdminRow[];
  const busIds = buses.map((row) => row.id).filter(Boolean);

  let liveLocations: AdminRow[] = [];

  if (busIds.length) {
    const { data, error } = await supabase
      .from('bus_live_locations')
      .select('*')
      .in('bus_id', busIds);

    if (error) throw error;
    liveLocations = (data ?? []) as unknown as AdminRow[];
  }

  return {
    school: (schoolResult.data ?? null) as AdminRow | null,
    routes: (routesResult.data ?? []) as unknown as AdminRow[],
    students: (studentsResult.data ?? []) as unknown as AdminRow[],
    buses,
    teachers: (teachersResult.data ?? []) as unknown as AdminRow[],
    liveLocations,
  };
}

export function subscribeToAdminBusLocations(
  schoolBusIds: string[],
  callback: (row: AdminRow) => void
) {
  const allowed = new Set(schoolBusIds.map(String));

  const channel = supabase
    .channel(`admin-live-buses-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bus_live_locations',
      },
      (payload) => {
        const row = payload.new as AdminRow;
        if (!row?.bus_id || !allowed.has(String(row.bus_id))) return;
        callback(row);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function cleanNullable(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

export function numberNullable(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}
