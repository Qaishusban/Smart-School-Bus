import { Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  AnyRow,
  TeacherContextData,
  TeacherStudentRow,
  TripPeriod,
  getTeacherContext,
  normalizeAttendanceStatus,
  rowName,
} from './teacherService';

export type ParentContact = {
  id: string;
  name: string;
  relation: string;
  phone: string;
};

export type StudentOperationalState = {
  studentId: string;
  instruction: string | null;
  request: string | null;
  excused: boolean;
  morningExcused: boolean;
  afternoonExcused: boolean;
};

export type RoadRoute = {
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  distanceMeters: number;
  durationSeconds: number;
};

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function todayKey() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function rowDateKey(row: AnyRow) {
  const raw =
    row.for_date ??
    row.date_key ??
    row.trip_date ??
    row.instruction_date ??
    row.request_date ??
    row.created_at;

  if (!raw) return null;

  const text = String(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 10);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function periods(row: AnyRow): TripPeriod[] {
  const value = normalize(
    row.trip_mode ?? row.trip_period ?? row.period ?? row.shift
  );

  if (['morning', 'am', 'to_school'].includes(value)) return ['morning'];
  if (['afternoon', 'evening', 'pm', 'to_home'].includes(value)) {
    return ['afternoon'];
  }

  return ['morning', 'afternoon'];
}

function meansExcused(row: AnyRow) {
  const text = [
    row.status,
    row.type,
    row.instruction_type,
    row.request_type,
    row.title,
    row.instruction,
    row.message,
    row.reason,
    row.details,
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

export function isValidCoord(lat: unknown, lng: unknown) {
  const a = Number(lat);
  const b = Number(lng);

  return (
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    a >= -90 &&
    a <= 90 &&
    b >= -180 &&
    b <= 180
  );
}

export function getAttendanceStatus(item: TeacherStudentRow) {
  return normalizeAttendanceStatus(item.attendance?.status);
}

export function isStudentDoneForPeriod(
  item: TeacherStudentRow,
  period: TripPeriod,
  operational?: StudentOperationalState | null
) {
  const excused =
    period === 'morning'
      ? operational?.morningExcused
      : operational?.afternoonExcused;

  if (excused) return true;

  const attendance =
    period === 'morning'
      ? item.attendanceMorning
      : item.attendanceAfternoon;

  const status = normalizeAttendanceStatus(attendance?.status);

  if (status === 'absent') return true;

  return period === 'morning'
    ? status === 'boarded' || status === 'arrived'
    : status === 'delivered';
}

export function statusLabel(
  item: TeacherStudentRow,
  period: TripPeriod,
  isRTL: boolean,
  operational?: StudentOperationalState | null
) {
  const excused =
    period === 'morning'
      ? operational?.morningExcused
      : operational?.afternoonExcused;

  if (excused) return isRTL ? 'غائب / معذور' : 'Absent / Excused';

  const attendance =
    period === 'morning'
      ? item.attendanceMorning
      : item.attendanceAfternoon;

  const status = normalizeAttendanceStatus(attendance?.status);

  if (status === 'absent') return isRTL ? 'غائب / معذور' : 'Absent / Excused';
  if (status === 'boarded') return isRTL ? 'تم الاستلام' : 'Picked Up';
  if (status === 'arrived') return isRTL ? 'وصل المدرسة' : 'Arrived at School';
  if (status === 'delivered') return isRTL ? 'تم التوصيل' : 'Delivered';

  return period === 'morning'
    ? isRTL
      ? 'بانتظار الاستلام'
      : 'Waiting for Pickup'
    : isRTL
    ? 'بانتظار التوصيل'
    : 'Waiting for Delivery';
}

export async function getStudentOperationalStates(
  studentIds: string[]
): Promise<Record<string, StudentOperationalState>> {
  const result: Record<string, StudentOperationalState> = {};

  studentIds.forEach((id) => {
    result[id] = {
      studentId: id,
      instruction: null,
      request: null,
      excused: false,
      morningExcused: false,
      afternoonExcused: false,
    };
  });

  if (!studentIds.length) return result;

  const inspect = async (
    table: 'parent_daily_instructions' | 'parent_requests',
    target: 'instruction' | 'request'
  ) => {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.log(`[teacher supervisor] ${table}:`, error.message);
      return;
    }

    (data ?? []).forEach((row: AnyRow) => {
      const id = String(row.student_id ?? '');

      if (!result[id] || rowDateKey(row) !== todayKey()) return;

      const text =
        row.note ??
        row.instruction ??
        row.message ??
        row.details ??
        row.reason ??
        row.title ??
        null;

      if (!result[id][target] && text) {
        result[id][target] = String(text);
      }

      if (!meansExcused(row)) return;

      periods(row).forEach((period) => {
        if (period === 'morning') result[id].morningExcused = true;
        else result[id].afternoonExcused = true;
      });

      result[id].excused =
        result[id].morningExcused && result[id].afternoonExcused;
    });
  };

  await Promise.all([
    inspect('parent_daily_instructions', 'instruction'),
    inspect('parent_requests', 'request'),
  ]);

  return result;
}


function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const R = 6371000;
  const phi1 = (a.latitude * Math.PI) / 180;
  const phi2 = (b.latitude * Math.PI) / 180;
  const dPhi = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLambda = ((b.longitude - a.longitude) * Math.PI) / 180;

  const s =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function pickNearestPendingStudent(args: {
  context: TeacherContextData;
  period: TripPeriod;
  operational: Record<string, StudentOperationalState>;
  origin?: { latitude: number; longitude: number } | null;
}) {
  const pending = args.context.students.filter((item) => {
    if (!isValidCoord(item.student.home_lat, item.student.home_lng)) {
      return false;
    }

    return !isStudentDoneForPeriod(
      item,
      args.period,
      args.operational[String(item.student.id)] ?? null
    );
  });

  if (!pending.length) return null;

  if (!args.origin) {
    return [...pending].sort(
      (a, b) =>
        Number(a.routeStudent.order_index ?? 9999) -
        Number(b.routeStudent.order_index ?? 9999)
    )[0];
  }

  return [...pending].sort((a, b) => {
    const da = haversineMeters(args.origin!, {
      latitude: Number(a.student.home_lat),
      longitude: Number(a.student.home_lng),
    });

    const db = haversineMeters(args.origin!, {
      latitude: Number(b.student.home_lat),
      longitude: Number(b.student.home_lng),
    });

    return da - db;
  })[0];
}

export async function getRoadRoute(args: {
  from: { latitude: number; longitude: number };
  to: { latitude: number; longitude: number };
}): Promise<RoadRoute | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const url =
      'https://router.project-osrm.org/route/v1/driving/' +
      `${args.from.longitude},${args.from.latitude};` +
      `${args.to.longitude},${args.to.latitude}` +
      '?overview=full&geometries=geojson&steps=false';

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return null;

    const json = await response.json();
    const route = json?.routes?.[0];

    if (!route?.geometry?.coordinates?.length) return null;

    return {
      geometry: {
        type: 'LineString',
        coordinates: route.geometry.coordinates as [number, number][],
      },
      distanceMeters: Number(route.distance ?? 0),
      durationSeconds: Number(route.duration ?? 0),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getParentContacts(
  studentId: string
): Promise<ParentContact[]> {
  const map = await getParentContactsMap([studentId]);
  return map[studentId] ?? [];
}

export async function getParentContactsMap(studentIds: string[]) {
  const result: Record<string, ParentContact[]> = {};
  studentIds.forEach((id) => (result[id] = []));

  if (!studentIds.length) return result;

  const links = await supabase
    .from('parent_students')
    .select('*')
    .in('student_id', studentIds);

  if (links.error) {
    console.log('[teacher supervisor] parent_students:', links.error.message);
    return result;
  }

  const parentIds = Array.from(
    new Set(
      (links.data ?? [])
        .map((row: AnyRow) => String(row.parent_id ?? ''))
        .filter(Boolean)
    )
  );

  if (!parentIds.length) return result;

  const parents = await supabase
    .from('parents')
    .select('*')
    .in('id', parentIds);

  if (parents.error) throw parents.error;

  const parentMap = new Map<string, AnyRow>();
  (parents.data ?? []).forEach((row: AnyRow) => {
    parentMap.set(String(row.id), row);
  });

  (links.data ?? []).forEach((link: AnyRow) => {
    const sid = String(link.student_id);
    const parent = parentMap.get(String(link.parent_id));
    if (!parent) return;

    const phone =
      parent.phone ??
      parent.phone_number ??
      parent.mobile ??
      parent.mobile_number ??
      '';

    if (!phone) return;

    result[sid]?.push({
      id: String(parent.id),
      name: rowName(parent) || 'Parent',
      relation: String(parent.relation ?? ''),
      phone: String(phone),
    });
  });

  return result;
}

export async function callPhone(phone: string) {
  const normalized = phone.replace(/[^\d+]/g, '');
  if (!normalized) return;

  const url = `tel:${normalized}`;
  if (await Linking.canOpenURL(url)) {
    await Linking.openURL(url);
  }
}

export async function sendArrivalNotice(args: {
  teacherId: string;
  studentId: string;
}) {
  const { data, error } = await supabase.rpc(
    'teacher_send_parent_arrival_v3',
    {
      p_teacher_id: args.teacherId,
      p_student_id: args.studentId,
    }
  );

  if (error) throw error;
  if ((data as any)?.ok === false) {
    throw new Error((data as any)?.error ?? 'send_failed');
  }

  return data;
}

export async function reportTeacherIncident(args: {
  teacherId: string;
  title: string;
  body: string;
  severity: 'low' | 'medium' | 'high';
}) {
  const { data, error } = await supabase.rpc('teacher_report_incident_v3', {
    p_teacher_id: args.teacherId,
    p_title: args.title,
    p_body: args.body,
    p_severity: args.severity,
  });

  if (error) throw error;
  if ((data as any)?.ok === false) {
    throw new Error((data as any)?.error ?? 'incident_failed');
  }

  return data;
}

export function subscribeTeacherAttendance(
  studentIds: string[],
  onChange: () => void
) {
  if (!studentIds.length) return () => {};

  const tables = [
    'bus_attendance',
    'parent_daily_instructions',
    'parent_requests',
  ];

  const channels = tables.map((table) =>
    supabase
      .channel(`teacher-${table}-${Date.now()}-${Math.random()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          const row = (payload.new ?? payload.old) as AnyRow;

          if (studentIds.includes(String(row?.student_id ?? ''))) {
            onChange();
          }
        }
      )
      .subscribe()
  );

  return () => {
    channels.forEach((channel) => supabase.removeChannel(channel));
  };
}

export async function loadSupervisorContext(args: {
  teacherId: string;
  username?: string | null;
  schoolId?: string | null;
  period: TripPeriod;
}) {
  const context: TeacherContextData = await getTeacherContext(args);

  const states = await getStudentOperationalStates(
    context.students.map((item) => String(item.student.id))
  );

  return { context, states };
}