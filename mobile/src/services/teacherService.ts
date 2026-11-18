import { supabase } from '../lib/supabase';

export type AnyRow = Record<string, any>;
export type TripPeriod = 'morning' | 'afternoon';

export type TeacherStudentRow = {
  routeStudent: AnyRow;
  student: AnyRow;
  attendance: AnyRow | null;
  attendanceMorning: AnyRow | null;
  attendanceAfternoon: AnyRow | null;
};

export type AttendanceCounts = {
  total: number;
  boarded: number;
  arrived: number;
  delivered: number;
  absent: number;
  unmarked: number;
};

export type TeacherContextData = {
  teacher: AnyRow | null;
  school: AnyRow | null;
  academicYear: AnyRow | null;
  route: AnyRow | null;
  bus: AnyRow | null;
  mainDriver: AnyRow | null;
  backupDriver: AnyRow | null;
  students: TeacherStudentRow[];
  liveLocation: AnyRow | null;
  unreadNotifications: number;
  currentPeriod: TripPeriod;
  attendanceCounts: AttendanceCounts;
  morningCounts: AttendanceCounts;
  afternoonCounts: AttendanceCounts;
};

export function normalizeAttendanceStatus(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function currentTripPeriod(date = new Date()): TripPeriod {
  return date.getHours() < 12 ? 'morning' : 'afternoon';
}

export function attendancePeriod(row: AnyRow): TripPeriod {
  const value = normalizeAttendanceStatus(
    row.trip_period ?? row.trip_mode ?? row.period ?? row.shift
  );

  if (['morning', 'am', 'to_school'].includes(value)) return 'morning';
  if (['afternoon', 'evening', 'pm', 'to_home'].includes(value)) return 'afternoon';

  return currentTripPeriod(row.created_at ? new Date(row.created_at) : new Date());
}

export function rowName(row?: AnyRow | null) {
  if (!row) return '';

  return (
    row.full_name ??
    row.full_name_ar ??
    row.full_name_en ??
    row.name ??
    [row.first_name, row.middle_name, row.last_name]
      .filter(Boolean)
      .join(' ')
      .trim()
  );
}

export function routeName(row?: AnyRow | null) {
  return row?.name ?? row?.route_name ?? row?.title ?? '';
}

export function busNumber(row?: AnyRow | null) {
  return row?.bus_number ?? row?.number ?? row?.plate_number ?? '';
}

export function attendanceLabel(value: unknown, isRTL: boolean) {
  const status = normalizeAttendanceStatus(value);

  const map: Record<string, [string, string]> = {
    boarded: ['صعد للحافلة', 'Boarded'],
    arrived: ['وصل المدرسة', 'Arrived'],
    delivered: ['تم التوصيل', 'Delivered'],
    absent: ['غائب / معذور', 'Absent / Excused'],
  };

  return map[status]
    ? isRTL
      ? map[status][0]
      : map[status][1]
    : isRTL
    ? 'لم يسجل'
    : 'Not Marked';
}

export function periodLabel(period: TripPeriod, isRTL: boolean) {
  return period === 'morning'
    ? isRTL
      ? 'الفترة الصباحية'
      : 'Morning Period'
    : isRTL
    ? 'الفترة المسائية'
    : 'Afternoon Period';
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function rowDateKey(row: AnyRow) {
  const value =
    row.for_date ??
    row.date_key ??
    row.trip_date ??
    row.instruction_date ??
    row.request_date ??
    row.created_at;

  if (!value) return null;

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 10);

  return localDateKey(date);
}

function rowMeansAbsent(row: AnyRow) {
  const text = [
    row.status,
    row.type,
    row.instruction_type,
    row.request_type,
    row.title,
    row.instruction,
    row.message,
    row.details,
    row.reason,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    text.includes('absent') ||
    text.includes('absence') ||
    text.includes('excused') ||
    text.includes('leave') ||
    text.includes('sick') ||
    text.includes('medical') ||
    text.includes('no_bus') ||
    text.includes('not_riding') ||
    text.includes('غياب') ||
    text.includes('إجاز') ||
    text.includes('اجاز') ||
    text.includes('معذور') ||
    text.includes('مرض')
  );
}

function instructionPeriods(row: AnyRow): TripPeriod[] {
  const value = normalizeAttendanceStatus(
    row.trip_mode ?? row.trip_period ?? row.period ?? row.shift
  );

  if (['morning', 'am', 'to_school'].includes(value)) return ['morning'];
  if (['afternoon', 'evening', 'pm', 'to_home'].includes(value)) return ['afternoon'];

  return ['morning', 'afternoon'];
}

function emptyCounts(total = 0): AttendanceCounts {
  return {
    total,
    boarded: 0,
    arrived: 0,
    delivered: 0,
    absent: 0,
    unmarked: total,
  };
}

function calculateCounts(students: TeacherStudentRow[], period: TripPeriod) {
  const counts = emptyCounts(students.length);
  counts.unmarked = 0;

  students.forEach((item) => {
    const attendance =
      period === 'morning'
        ? item.attendanceMorning
        : item.attendanceAfternoon;

    const status = normalizeAttendanceStatus(attendance?.status);

    if (status === 'boarded') counts.boarded++;
    else if (status === 'arrived') counts.arrived++;
    else if (status === 'delivered') counts.delivered++;
    else if (status === 'absent') counts.absent++;
    else counts.unmarked++;
  });

  return counts;
}

async function firstRow(query: any): Promise<AnyRow | null> {
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function resolveTeacherProfile(args: {
  teacherId: string;
  username?: string | null;
  schoolId?: string | null;
}) {
  let teacher: AnyRow | null = null;

  if (args.teacherId) {
    try {
      teacher = await firstRow(
        supabase.from('teachers').select('*').eq('id', args.teacherId)
      );
    } catch {
      teacher = null;
    }
  }

  if (!teacher && args.username) {
    teacher = await firstRow(
      supabase.from('teachers').select('*').eq('username', args.username)
    );
  }

  if (
    teacher &&
    args.schoolId &&
    String(teacher.school_id) !== String(args.schoolId)
  ) {
    return null;
  }

  return teacher;
}

export async function resolveTeacherRoute(teacher: AnyRow | null) {
  if (!teacher?.id) return null;

  if (teacher.route_id) {
    const route = await firstRow(
      supabase.from('routes').select('*').eq('id', teacher.route_id)
    );
    if (route) return route;
  }

  return firstRow(
    supabase
      .from('routes')
      .select('*')
      .eq('teacher_id', teacher.id)
      .eq('school_id', teacher.school_id)
      .order('created_at', { ascending: false })
  );
}

async function getParentAbsences(studentIds: string[]) {
  const map = new Map<string, Set<TripPeriod>>();
  studentIds.forEach((id) => map.set(id, new Set()));

  if (!studentIds.length) return map;

  const today = localDateKey();

  const inspect = async (
    table: 'parent_daily_instructions' | 'parent_requests'
  ) => {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.log(`[teacher] ${table}:`, error.message);
      return;
    }

    (data ?? []).forEach((row: AnyRow) => {
      const id = String(row.student_id ?? '');

      if (!id || rowDateKey(row) !== today || !rowMeansAbsent(row)) return;

      instructionPeriods(row).forEach((period) => {
        map.get(id)?.add(period);
      });
    });
  };

  await Promise.all([
    inspect('parent_daily_instructions'),
    inspect('parent_requests'),
  ]);

  return map;
}

function absentRow(studentId: string, period: TripPeriod): AnyRow {
  return {
    id: `parent-absence:${studentId}:${localDateKey()}:${period}`,
    student_id: studentId,
    status: 'absent',
    trip_period: period,
    source: 'parent_instruction',
    is_virtual: true,
    created_at: new Date().toISOString(),
  };
}

export async function getTeacherContext(args: {
  teacherId: string;
  username?: string | null;
  schoolId?: string | null;
  period?: TripPeriod;
}): Promise<TeacherContextData> {
  const period = args.period ?? currentTripPeriod();
  const teacher = await resolveTeacherProfile(args);

  if (!teacher) {
    const blank = emptyCounts();

    return {
      teacher: null,
      school: null,
      academicYear: null,
      route: null,
      bus: null,
      mainDriver: null,
      backupDriver: null,
      students: [],
      liveLocation: null,
      unreadNotifications: 0,
      currentPeriod: period,
      attendanceCounts: blank,
      morningCounts: blank,
      afternoonCounts: blank,
    };
  }

  const route = await resolveTeacherRoute(teacher);

  const [school, bus, routeLinks, unread] = await Promise.all([
    teacher.school_id
      ? firstRow(supabase.from('schools').select('*').eq('id', teacher.school_id))
      : Promise.resolve(null),

    route?.bus_id
      ? firstRow(supabase.from('buses').select('*').eq('id', route.bus_id))
      : Promise.resolve(null),

    route?.id
      ? supabase.from('route_students').select('*').eq('route_id', route.id)
      : Promise.resolve({ data: [], error: null } as any),

    supabase
      .from('bus_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacher.id)
      .or('is_read.eq.false,is_read.is.null'),
  ]);

  if (routeLinks.error) throw routeLinks.error;

  const links = (routeLinks.data ?? []) as AnyRow[];
  const studentIds = Array.from(
    new Set(
      links.map((row) => String(row.student_id ?? '')).filter(Boolean)
    )
  );

  const [studentResult, attendanceResult, absences] = await Promise.all([
    studentIds.length
      ? supabase.from('students').select('*').in('id', studentIds)
      : Promise.resolve({ data: [], error: null } as any),

    studentIds.length
      ? supabase
          .from('bus_attendance')
          .select('*')
          .in('student_id', studentIds)
          .gte('created_at', `${localDateKey()}T00:00:00`)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null } as any),

    getParentAbsences(studentIds),
  ]);

  if (studentResult.error) throw studentResult.error;
  if (attendanceResult.error) throw attendanceResult.error;

  const studentMap = new Map<string, AnyRow>(
    (studentResult.data ?? []).map((row: AnyRow) => [String(row.id), row])
  );

  const morning = new Map<string, AnyRow>();
  const afternoon = new Map<string, AnyRow>();

  (attendanceResult.data ?? []).forEach((row: AnyRow) => {
    const id = String(row.student_id);
    const target =
      attendancePeriod(row) === 'morning' ? morning : afternoon;

    if (!target.has(id)) target.set(id, row);
  });

  studentIds.forEach((id) => {
    const periods = absences.get(id);

    if (periods?.has('morning')) {
      morning.set(id, absentRow(id, 'morning'));
    }

    if (periods?.has('afternoon')) {
      afternoon.set(id, absentRow(id, 'afternoon'));
    }
  });

  const students = links
    .map((routeStudent) => {
      const student = studentMap.get(String(routeStudent.student_id));
      if (!student) return null;

      const id = String(student.id);
      const am = morning.get(id) ?? null;
      const pm = afternoon.get(id) ?? null;

      return {
        routeStudent,
        student,
        attendance: period === 'morning' ? am : pm,
        attendanceMorning: am,
        attendanceAfternoon: pm,
      };
    })
    .filter(Boolean) as TeacherStudentRow[];

  const morningCounts = calculateCounts(students, 'morning');
  const afternoonCounts = calculateCounts(students, 'afternoon');

  let liveLocation: AnyRow | null = null;
  let mainDriver: AnyRow | null = null;
  let backupDriver: AnyRow | null = null;

  if (bus?.id) {
    liveLocation = await firstRow(
      supabase
        .from('bus_live_locations')
        .select('*')
        .eq('bus_id', bus.id)
        .order('updated_at', { ascending: false })
    );
  }

  if (bus?.main_driver_id) {
    mainDriver = await firstRow(
      supabase.from('drivers').select('*').eq('id', bus.main_driver_id)
    );
  }

  if (bus?.backup_driver_id) {
    backupDriver = await firstRow(
      supabase.from('drivers').select('*').eq('id', bus.backup_driver_id)
    );
  }

  return {
    teacher,
    school,
    academicYear: null,
    route,
    bus,
    mainDriver,
    backupDriver,
    students,
    liveLocation,
    unreadNotifications: unread.count ?? 0,
    currentPeriod: period,
    attendanceCounts:
      period === 'morning' ? morningCounts : afternoonCounts,
    morningCounts,
    afternoonCounts,
  };
}

export async function getTeacherStudents(args: {
  teacherId: string;
  username?: string | null;
  schoolId?: string | null;
  period?: TripPeriod;
}) {
  return (await getTeacherContext(args)).students;
}

export function subscribeTeacherBusLocation(
  busId: string,
  onLocation: (row: AnyRow) => void
) {
  const channel = supabase
    .channel(`teacher-live-bus-${busId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bus_live_locations',
        filter: `bus_id=eq.${busId}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as AnyRow;
        if (row) onLocation(row);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function updateTeacherProfileWithPin(args: {
  teacherId: string;
  currentPin: string;
  fullName?: string | null;
  phone?: string | null;
  username?: string | null;
  newPin?: string | null;
  homeLat?: number | null;
  homeLng?: number | null;
  homeAddress?: string | null;
}) {
  const { data, error } = await supabase.rpc('teacher_update_profile_with_pin', {
    p_teacher_id: args.teacherId,
    p_current_pin: args.currentPin,
    p_full_name: args.fullName ?? null,
    p_phone: args.phone ?? null,
    p_username: args.username ?? null,
    p_new_pin: args.newPin ?? null,
    p_home_lat: args.homeLat ?? null,
    p_home_lng: args.homeLng ?? null,
    p_home_address: args.homeAddress ?? null,
  });

  if (error) throw error;

  if ((data as any)?.ok === false) {
    throw new Error((data as any)?.error ?? 'update_failed');
  }

  return data;
}

export async function getTeacherNotificationPreferences(args: {
  teacherId: string;
  schoolId?: string | null;
}) {
  const { data, error } = await supabase.rpc(
    'teacher_get_notification_preferences',
    { p_teacher_id: args.teacherId }
  );

  if (error) throw error;
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}

export async function saveTeacherNotificationPreferences(args: {
  teacherId: string;
  schoolId?: string | null;
  values: Record<string, boolean>;
}) {
  const { data, error } = await supabase.rpc(
    'teacher_save_notification_preferences',
    {
      p_teacher_id: args.teacherId,
      p_push_enabled: args.values.push_enabled ?? true,
      p_mute_all: args.values.mute_all ?? false,
      p_driver_updates: args.values.driver_updates ?? true,
      p_bus_incidents: args.values.bus_incidents ?? true,
      p_attendance_changes: args.values.attendance_changes ?? true,
      p_school_announcements: args.values.school_announcements ?? true,
    }
  );

  if (error) throw error;

  if ((data as any)?.ok === false) {
    throw new Error((data as any)?.error ?? 'notification_preferences_failed');
  }

  return data;
}