import { supabase } from '../lib/supabase';
import {
  decideParentRequest,
  type ParentRequestDecision,
} from './parentRequestDecisionService';

export type TeacherNotificationItem = {
  id: string;
  school_id: string | null;
  bus_id: string | null;
  driver_id: string | null;
  teacher_id: string | null;
  student_id: string | null;
  parent_id: string | null;
  route_id: string | null;
  type: string | null;
  title: string | null;
  body: string | null;
  message: string | null;
  data: Record<string, any> | null;
  status: string | null;
  is_read: boolean | null;
  date_key: string | null;
  created_at: string | null;
};

type AnyRow = Record<string, any>;

export function normalizeTeacherNotificationType(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function isTeacherNotificationUnread(item: TeacherNotificationItem) {
  return item.is_read !== true &&
    !['read', 'seen', 'opened'].includes(normalizeTeacherNotificationType(item.status));
}

function parsed(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  const text = String(value ?? '').trim();
  if (!text.startsWith('{')) return {};
  try {
    const result = JSON.parse(text);
    return result && typeof result === 'object' && !Array.isArray(result) ? result : {};
  } catch {
    return {};
  }
}

function safe(value: unknown) {
  return String(value ?? '')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[{}[\]"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function studentName(row: AnyRow) {
  return row.full_name ?? row.full_name_ar ?? row.full_name_en ?? row.name ?? 'Student';
}

function requestTitle(type: unknown) {
  const value = normalizeTeacherNotificationType(type);
  const map: Record<string, string> = {
    absence: 'عذر غياب | Absence Request',
    no_bus: 'عدم استخدام الباص | Not Riding',
    pickup_change: 'تغيير الاستلام | Pickup Change',
    dropoff_change: 'تغيير التوصيل | Drop-off Change',
    transport: 'طلب نقل | Transport Request',
    delay: 'تأخير / ملاحظة | Delay / Note',
    bus_issue: 'مشكلة بالباص | Bus Issue',
    school_request: 'طلب للمدرسة | School Request',
    complaint: 'شكوى | Complaint',
    other: 'طلب من ولي الأمر | Parent Request',
  };
  return map[value] ?? 'طلب من ولي الأمر | Parent Request';
}

export function teacherNotificationTitle(item: TeacherNotificationItem, isRTL: boolean) {
  const type = normalizeTeacherNotificationType(item.type);
  const data = parsed(item.data);

  if (type === 'parent_request' || type === 'parent_request_updated') {
    const bilingual = requestTitle(data.request_type);
    const [ar, en] = bilingual.split('|').map((x) => x.trim());
    return isRTL ? ar : en;
  }

  const map: Record<string, [string, string]> = {
    trip_started: ['بدأت الرحلة', 'Trip Started'],
    trip_ended: ['انتهت الرحلة', 'Trip Ended'],
    boarded: ['صعد الطالب للحافلة', 'Student Boarded'],
    arrived: ['وصل الباص', 'Bus Arrived'],
    delivered: ['تم توصيل الطالب', 'Student Delivered'],
    absent: ['غياب طالب', 'Student Absent'],
    parent_instruction: ['تعليمات من ولي الأمر', 'Parent Instruction'],
    incident: ['بلاغ رحلة', 'Trip Incident'],
    school_announcement: ['إعلان المدرسة', 'School Announcement'],
    broadcast: ['رسالة المدرسة', 'School Message'],
  };

  if (map[type]) return isRTL ? map[type][0] : map[type][1];
  return safe(item.title) || (isRTL ? 'إشعار الرحلة' : 'Trip Notification');
}

export function teacherNotificationBody(item: TeacherNotificationItem, isRTL: boolean) {
  const payload = { ...parsed(item.data), ...parsed(item.body), ...parsed(item.message) };
  const parts: string[] = [];
  const student = payload.studentName ?? payload.student_name;
  const bus = payload.busNumber ?? payload.bus_number;
  const route = payload.routeName ?? payload.route_name;

  if (student) parts.push(isRTL ? `الطالب: ${safe(student)}` : `Student: ${safe(student)}`);
  if (bus) parts.push(isRTL ? `الباص: ${safe(bus)}` : `Bus: ${safe(bus)}`);
  if (route) parts.push(isRTL ? `المسار: ${safe(route)}` : `Route: ${safe(route)}`);

  const direct = safe(item.body ?? item.message);
  if (direct && !direct.startsWith('studentId')) parts.push(direct);

  return Array.from(new Set(parts.filter(Boolean))).join(' • ') ||
    (isRTL ? 'لا توجد تفاصيل إضافية.' : 'No additional details.');
}

async function teacherScope(teacherId: string, schoolId?: string | null) {
  let routeQuery = supabase.from('routes').select('*').eq('teacher_id', teacherId);
  if (schoolId) routeQuery = routeQuery.eq('school_id', schoolId);

  const { data: routes, error: routeError } = await routeQuery
    .order('created_at', { ascending: false })
    .limit(1);

  if (routeError) throw routeError;

  const route = routes?.[0] ?? null;
  if (!route?.id) return { route: null, studentIds: [] as string[] };

  const { data, error } = await supabase
    .from('route_students')
    .select('student_id')
    .eq('route_id', route.id);

  if (error) throw error;

  return {
    route,
    studentIds: Array.from(new Set((data ?? []).map((r: AnyRow) => String(r.student_id ?? '')).filter(Boolean))),
  };
}

async function parentRows(args: {
  teacherId: string;
  schoolId?: string | null;
  route: AnyRow | null;
  studentIds: string[];
}) {
  if (!args.route?.id || !args.studentIds.length) return [];

  const { data: students } = await supabase.from('students').select('*').in('id', args.studentIds);
  const names = new Map<string, string>();
  (students ?? []).forEach((row: AnyRow) => names.set(String(row.id), studentName(row)));

  const { data, error } = await supabase
    .from('parent_requests')
    .select('*')
    .in('student_id', args.studentIds)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.log('[teacher notifications] parent_requests:', error.message);
    return [] as TeacherNotificationItem[];
  }

  return (data ?? []).map((row: AnyRow) => ({
    id: `parent_request:${row.id}`,
    school_id: row.school_id ?? args.schoolId ?? null,
    bus_id: row.bus_id ?? args.route?.bus_id ?? null,
    driver_id: null,
    teacher_id: args.teacherId,
    student_id: row.student_id ?? null,
    parent_id: row.parent_id ?? null,
    route_id: row.route_id ?? args.route?.id ?? null,
    type: 'parent_request',
    title: requestTitle(row.request_type),
    body: row.notes ?? null,
    message: row.notes ?? null,
    data: {
      source: 'parent_requests',
      source_id: row.id,
      request_id: row.id,
      request_status: row.status ?? 'pending',
      request_type: row.request_type ?? null,
      date_from: row.date_from ?? row.request_date ?? null,
      date_to: row.date_to ?? row.date_from ?? row.request_date ?? null,
      trip_period: row.trip_period ?? 'both',
      instruction_status: row.request_type ?? null,
      trip_mode: row.trip_period ?? 'both',
      student_name: names.get(String(row.student_id ?? '')) ?? 'Student',
      route_name: args.route?.name ?? args.route?.route_name ?? args.route?.title ?? null,
    },
    status: 'created',
    is_read: false,
    date_key: String(row.date_from ?? row.request_date ?? localDateKey()).slice(0, 10),
    created_at: row.created_at ?? row.updated_at ?? row.request_date ?? null,
  })) as TeacherNotificationItem[];
}

function requestId(item: TeacherNotificationItem) {
  const data = parsed(item.data);
  const raw = data.request_id ?? data.source_id;
  return raw ? String(raw) : null;
}

function isParentRequestItem(item: TeacherNotificationItem) {
  const type = normalizeTeacherNotificationType(item.type);
  const source = normalizeTeacherNotificationType(parsed(item.data).source);
  return type === 'parent_request' || type === 'parent_request_updated' || source === 'parent_requests' || source === 'parent_request';
}

export async function getTeacherNotifications(args: {
  teacherId: string;
  schoolId?: string | null;
  limit?: number;
}) {
  const limit = args.limit ?? 200;
  if (!args.teacherId) return [];

  const scope = await teacherScope(args.teacherId, args.schoolId);

  let directQuery = supabase
    .from('bus_notifications')
    .select('*')
    .eq('teacher_id', args.teacherId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.schoolId) directQuery = directQuery.eq('school_id', args.schoolId);

  const [direct, studentResult, syntheticRequests] = await Promise.all([
    directQuery,
    scope.studentIds.length
      ? supabase
          .from('bus_notifications')
          .select('*')
          .in('student_id', scope.studentIds)
          .order('created_at', { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [], error: null } as any),
    parentRows({
      teacherId: args.teacherId,
      schoolId: args.schoolId,
      route: scope.route,
      studentIds: scope.studentIds,
    }),
  ]);

  if (direct.error) throw direct.error;
  if (studentResult.error) console.log('[teacher notifications] route notifications:', studentResult.error.message);

  // Route-wide notifications are useful for trip/student events, but parent requests
  // must only come from the teacher recipient copy (or the synthetic current request).
  const routeRows = ((studentResult.data ?? []) as TeacherNotificationItem[]).filter(
    (item) => !isParentRequestItem(item)
  );

  const syntheticByRequest = new Map<string, TeacherNotificationItem>();
  syntheticRequests.forEach((item) => {
    const id = requestId(item);
    if (id) syntheticByRequest.set(id, item);
  });

  const directRows = ((direct.data ?? []) as TeacherNotificationItem[]).map((item) => {
    if (!isParentRequestItem(item)) return item;
    const id = requestId(item);
    const current = id ? syntheticByRequest.get(id) : undefined;
    if (!current) return item;

    return {
      ...item,
      data: {
        ...(item.data ?? {}),
        ...(current.data ?? {}),
      },
      title: current.title ?? item.title,
      body: current.body ?? item.body,
      message: current.message ?? item.message,
      date_key: current.date_key ?? item.date_key,
    };
  });

  const directRequestIds = new Set(
    directRows.filter(isParentRequestItem).map(requestId).filter(Boolean) as string[]
  );

  const merged = [
    ...directRows,
    ...routeRows,
    ...syntheticRequests.filter((item) => {
      const id = requestId(item);
      return !id || !directRequestIds.has(id);
    }),
  ];

  const unique = new Map<string, TeacherNotificationItem>();
  const seenRequests = new Set<string>();

  merged
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .forEach((item) => {
      if (!item?.id) return;
      if (args.schoolId && item.school_id && String(item.school_id) !== String(args.schoolId)) return;

      if (isParentRequestItem(item)) {
        const id = requestId(item);
        if (id) {
          if (seenRequests.has(id)) return;
          seenRequests.add(id);
        }
      }

      if (!unique.has(String(item.id))) unique.set(String(item.id), item);
    });

  return Array.from(unique.values()).slice(0, limit);
}

export async function decideTeacherParentRequest(args: {
  requestId: string;
  schoolId: string;
  teacherId: string;
  decision: ParentRequestDecision;
}) {
  return decideParentRequest({
    requestId: args.requestId,
    schoolId: args.schoolId,
    decision: args.decision,
    actor: 'teacher',
    actorId: args.teacherId,
  });
}

export async function markTeacherNotificationRead(notificationId: string) {
  if (notificationId.startsWith('parent_request:')) return;

  const { error } = await supabase
    .from('bus_notifications')
    .update({ status: 'read', is_read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllTeacherNotificationsRead(teacherId: string) {
  if (!teacherId) return;

  const { error } = await supabase
    .from('bus_notifications')
    .update({ status: 'read', is_read: true })
    .eq('teacher_id', teacherId)
    .or('is_read.eq.false,is_read.is.null');

  if (error) throw error;
}

export function subscribeTeacherNotifications(teacherId: string, onChange: () => void) {
  const channels = [
    supabase
      .channel(`teacher-notifications-${teacherId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bus_notifications' }, onChange)
      .subscribe(),
    supabase
      .channel(`teacher-parent-requests-${teacherId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parent_requests' }, onChange)
      .subscribe(),
  ];

  return () => {
    channels.forEach((channel) => void supabase.removeChannel(channel));
  };
}