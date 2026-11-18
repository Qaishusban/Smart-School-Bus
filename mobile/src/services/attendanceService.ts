import { supabase } from '../lib/supabase';
import { getActiveParentAbsences } from './parentRequestService';

export type DriverStudentsTripMode = 'to_school' | 'to_home';

export type DriverStudentCategory =
  | 'on_route'
  | 'picked_up'
  | 'delivered'
  | 'excused';

export type DriverStudentSnapshot = {
  route_student_id: string;
  route_id: string;
  student_id: string;
  order_index: number;
  pickup_time: string | null;
  dropoff_time: string | null;
  student: Record<string, any>;
  latest_attendance: Record<string, any> | null;
  normalized_status: 'arrived' | 'boarded' | 'absent' | 'delivered' | null;
  instruction: Record<string, any> | null;
  instruction_status: string | null;
  instruction_note: string | null;
  is_excused: boolean;
  parent: Record<string, any> | null;
  parent_id: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  category: DriverStudentCategory;
};

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

function localDateKey(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timestampOf(row: Record<string, any>) {
  const raw =
    row.created_at ??
    row.updated_at ??
    row.instruction_date ??
    row.for_date ??
    row.date ??
    null;

  if (!raw) return 0;
  const value = new Date(raw).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function normalizeDriverAttendanceStatus(
  value: unknown
): 'arrived' | 'boarded' | 'absent' | 'delivered' | null {
  const status = normalize(value);

  if (['arrived', 'arrival'].includes(status)) return 'arrived';
  if (['boarded', 'picked_up', 'picked', 'pickup', 'on_bus'].includes(status)) return 'boarded';
  if (['absent', 'no_show', 'not_boarded', 'did_not_ride'].includes(status)) return 'absent';
  if (['delivered', 'dropped_off', 'dropoff', 'arrived_home'].includes(status)) return 'delivered';

  return null;
}

export function getAutomaticDriverTripMode(date: Date = new Date()): DriverStudentsTripMode {
  return date.getHours() < 12 ? 'to_school' : 'to_home';
}

export function getCurrentDriverPeriodRange(date: Date = new Date()) {
  const start = new Date(date);
  const end = new Date(date);

  if (date.getHours() < 12) {
    start.setHours(0, 0, 0, 0);
    end.setHours(11, 59, 59, 999);
  } else {
    start.setHours(12, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

function isTodayInstruction(row: Record<string, any>, todayKey: string) {
  const candidates = [row.for_date, row.instruction_date, row.date, row.date_key]
    .filter(Boolean)
    .map((value) => String(value).slice(0, 10));

  if (!candidates.length) return true;
  return candidates.includes(todayKey);
}

function instructionIsExcused(status: unknown, mode: DriverStudentsTripMode) {
  const value = normalize(status);

  if (
    ['leave', 'leave_holiday', 'holiday', 'vacation', 'sick', 'sick_leave', 'absent', 'no_bus', 'not_riding']
      .includes(value)
  ) return true;

  if (
    mode === 'to_home' &&
    ['with_parent', 'with_family', 'picked_by_parent', 'parent_pickup'].includes(value)
  ) return true;

  return false;
}

function requestMatchesTripPeriod(
  request: Record<string, any> | null | undefined,
  mode: DriverStudentsTripMode
) {
  if (!request) return false;

  const period = normalize(request.trip_period ?? request.period ?? 'both');

  if (period === 'both' || period === 'all' || !period) return true;
  if (mode === 'to_school') return ['morning', 'am', 'to_school'].includes(period);
  return ['afternoon', 'evening', 'pm', 'to_home'].includes(period);
}

function resolveCategory(
  status: ReturnType<typeof normalizeDriverAttendanceStatus>,
  isExcused: boolean
): DriverStudentCategory {
  if (isExcused || status === 'absent') return 'excused';
  if (status === 'delivered') return 'delivered';
  if (status === 'boarded') return 'picked_up';
  return 'on_route';
}

export async function getLatestAttendance(studentId: string) {
  if (!studentId) return null;

  const { data, error } = await supabase
    .from('bus_attendance')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.log('getLatestAttendance error:', error);
    throw error;
  }

  return data ?? null;
}

export async function getDriverRouteStudentsSnapshot(args: {
  routeId: string;
  busId?: string | null;
  mode?: DriverStudentsTripMode;
  now?: Date;
}): Promise<DriverStudentSnapshot[]> {
  const { routeId, busId } = args;
  if (!routeId) return [];

  const mode = args.mode ?? getAutomaticDriverTripMode(args.now);
  const now = args.now ?? new Date();
  const range = getCurrentDriverPeriodRange(now);
  const todayKey = localDateKey(now);

  const { data: routeLinks, error: routeError } = await supabase
    .from('route_students')
    .select('*')
    .eq('route_id', routeId)
    .order('order_index', { ascending: true });

  if (routeError) {
    console.log('[attendance] route_students:', routeError);
    throw routeError;
  }

  if (!routeLinks?.length) return [];

  const studentIds = Array.from(
    new Set(routeLinks.map((row: any) => row.student_id).filter(Boolean))
  ) as string[];

  if (!studentIds.length) return [];

  const [
    studentsResult,
    attendanceResult,
    instructionsResult,
    parentLinksResult,
    approvedAbsences,
    approvedRequestNotifications,
  ] = await Promise.all([
    supabase.from('students').select('*').in('id', studentIds),

    (() => {
      let query = supabase
        .from('bus_attendance')
        .select('*')
        .in('student_id', studentIds)
        .gte('created_at', range.start)
        .lte('created_at', range.end);

      if (busId) query = query.eq('bus_id', busId);
      return query.order('created_at', { ascending: false });
    })(),

    supabase
      .from('parent_daily_instructions')
      .select('*')
      .in('student_id', studentIds),

    supabase
      .from('parent_students')
      .select('*')
      .in('student_id', studentIds),

    getActiveParentAbsences({
      studentIds,
      date: todayKey,
      period: mode === 'to_school' ? 'morning' : 'afternoon',
    }).catch((error) => {
      // A driver may not have RLS SELECT permission on parent_requests.
      // Keep the snapshot alive and use the driver's approved notification copy below.
      console.log('[attendance] approved parent absences:', error);
      return [] as Record<string, any>[];
    }),

    (() => {
      let query = supabase
        .from('bus_notifications')
        .select('*')
        .in('student_id', studentIds)
        .in('type', ['parent_request', 'parent_request_updated', 'parent_request_decision'])
        .order('created_at', { ascending: false });

      if (busId) query = query.eq('bus_id', busId);
      return query.limit(300);
    })(),
  ]);

  if (studentsResult.error) {
    console.log('[attendance] students:', studentsResult.error);
    throw studentsResult.error;
  }
  if (attendanceResult.error) {
    console.log('[attendance] bus_attendance:', attendanceResult.error);
    throw attendanceResult.error;
  }
  if (instructionsResult.error) console.log('[attendance] parent_daily_instructions:', instructionsResult.error);
  if (parentLinksResult.error) console.log('[attendance] parent_students:', parentLinksResult.error);

  const parentIds = Array.from(
    new Set((parentLinksResult.data ?? []).map((row: any) => row.parent_id).filter(Boolean))
  );

  const parentsResult = parentIds.length
    ? await supabase.from('parents').select('*').in('id', parentIds)
    : { data: [] as any[], error: null };

  if (parentsResult.error) console.log('[attendance] parents:', parentsResult.error);

  const studentMap = new Map<string, any>();
  for (const student of studentsResult.data ?? []) {
    studentMap.set(String(student.id), student);
  }

  const attendanceMap = new Map<string, any>();
  for (const row of attendanceResult.data ?? []) {
    const key = String(row.student_id);
    if (!attendanceMap.has(key)) attendanceMap.set(key, row);
  }

  const instructionRows = [...(instructionsResult.data ?? [])].sort(
    (a: any, b: any) => timestampOf(b) - timestampOf(a)
  );

  const instructionMap = new Map<string, any>();
  for (const row of instructionRows) {
    if (!isTodayInstruction(row, todayKey)) continue;
    const key = String(row.student_id);
    if (!instructionMap.has(key)) instructionMap.set(key, row);
  }

  const approvedAbsenceMap = new Map<string, Record<string, any>>();
  for (const request of approvedAbsences ?? []) {
    if (!requestMatchesTripPeriod(request, mode)) continue;
    const key = String(request.student_id ?? '');
    if (key && !approvedAbsenceMap.has(key)) approvedAbsenceMap.set(key, request);
  }

  // Driver-safe fallback:
  // parentRequestDecisionService updates the existing driver bus_notification
  // payload with status=approved. This lets the operational screens honor an
  // approved absence even when RLS prevents the driver from selecting parent_requests.
  if (approvedRequestNotifications.error) {
    console.log('[attendance] parent request notifications:', approvedRequestNotifications.error);
  } else {
    for (const notification of approvedRequestNotifications.data ?? []) {
      const payload =
        notification?.data && typeof notification.data === 'object'
          ? notification.data
          : {};

      const status = normalize(payload.status ?? payload.decision ?? '');
      const requestType = normalize(payload.request_type ?? '');
      const studentId = String(notification.student_id ?? payload.student_id ?? '');

      if (!studentId || approvedAbsenceMap.has(studentId)) continue;
      if (status !== 'approved') continue;
      if (!['absence', 'no_bus'].includes(requestType)) continue;

      const dateFrom = String(payload.date_from ?? notification.date_key ?? '').slice(0, 10);
      const dateTo = String(payload.date_to ?? payload.date_from ?? notification.date_key ?? '').slice(0, 10);

      if (dateFrom && todayKey < dateFrom) continue;
      if (dateTo && todayKey > dateTo) continue;

      const syntheticRequest = {
        id: payload.request_id ?? notification.id,
        student_id: studentId,
        request_type: requestType,
        status: 'approved',
        date_from: dateFrom || todayKey,
        date_to: dateTo || dateFrom || todayKey,
        trip_period: payload.trip_period ?? 'both',
        notes: notification.message ?? notification.body ?? null,
        source: 'bus_notifications',
      };

      if (!requestMatchesTripPeriod(syntheticRequest, mode)) continue;
      approvedAbsenceMap.set(studentId, syntheticRequest);
    }
  }

  const parentLinkMap = new Map<string, any>();
  for (const row of parentLinksResult.data ?? []) {
    const key = String(row.student_id);
    const current = parentLinkMap.get(key);

    if (!current || (Boolean(row.is_primary) && !Boolean(current.is_primary))) {
      parentLinkMap.set(key, row);
    }
  }

  const parentMap = new Map<string, any>();
  for (const parent of parentsResult.data ?? []) {
    parentMap.set(String(parent.id), parent);
  }

  return routeLinks
    .map((link: any) => {
      const student = studentMap.get(String(link.student_id));
      if (!student) return null;

      const attendance = attendanceMap.get(String(link.student_id)) ?? null;
      const status = normalizeDriverAttendanceStatus(attendance?.status);

      const dailyInstruction = instructionMap.get(String(link.student_id)) ?? null;
      const approvedAbsence = approvedAbsenceMap.get(String(link.student_id)) ?? null;

      const dailyInstructionStatus = dailyInstruction?.status
        ? normalize(dailyInstruction.status)
        : null;

      const requestType = approvedAbsence?.request_type
        ? normalize(approvedAbsence.request_type)
        : null;

      const excusedByDailyInstruction = instructionIsExcused(dailyInstructionStatus, mode);
      const excusedByApprovedRequest =
        !!approvedAbsence &&
        ['absence', 'no_bus'].includes(requestType ?? '') &&
        requestMatchesTripPeriod(approvedAbsence, mode);

      const excused = excusedByDailyInstruction || excusedByApprovedRequest;

      // Prefer the approved request as the operational instruction so every driver
      // screen receives the same status/note through the existing snapshot contract.
      const instruction = approvedAbsence ?? dailyInstruction;

      const instructionStatus = excusedByApprovedRequest
        ? requestType
        : dailyInstructionStatus;

      const instructionNote = approvedAbsence
        ? approvedAbsence.notes ?? null
        : dailyInstruction?.note ??
          dailyInstruction?.details ??
          dailyInstruction?.message ??
          null;

      const parentLink = parentLinkMap.get(String(link.student_id));
      const parent = parentLink?.parent_id
        ? parentMap.get(String(parentLink.parent_id)) ?? null
        : null;

      const parentPhone =
        parent?.phone ??
        parent?.mobile ??
        parent?.phone_number ??
        student?.parent_phone ??
        null;

      const parentName = parent?.full_name ?? parent?.name ?? null;

      return {
        route_student_id: String(link.id),
        route_id: String(link.route_id),
        student_id: String(link.student_id),
        order_index: Number(link.order_index ?? 0),
        pickup_time: link.pickup_time ?? null,
        dropoff_time: link.dropoff_time ?? null,
        student,
        latest_attendance: attendance,
        normalized_status: status,
        instruction,
        instruction_status: instructionStatus,
        instruction_note: instructionNote,
        is_excused: excused,
        parent,
        parent_id: parent?.id ? String(parent.id) : null,
        parent_name: parentName ? String(parentName) : null,
        parent_phone: parentPhone ? String(parentPhone) : null,
        category: resolveCategory(status, excused),
      } as DriverStudentSnapshot;
    })
    .filter(Boolean) as DriverStudentSnapshot[];
}
