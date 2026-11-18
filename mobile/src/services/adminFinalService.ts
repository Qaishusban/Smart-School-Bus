import { supabase } from '../lib/supabase';

export type AnyAdminRow = Record<string, any>;

export async function adminList(
  table: string,
  schoolId?: string | null,
  options?: {
    schoolColumn?: string;
    orderBy?: string;
    ascending?: boolean;
    limit?: number;
  }
) {
  let query = supabase.from(table).select('*');

  if (schoolId) {
    if (table === 'route_students') {
      const { data: routeRows, error: routeError } = await supabase
        .from('routes')
        .select('id')
        .eq('school_id', schoolId);

      if (routeError) throw routeError;

      const routeIds = (routeRows ?? [])
        .map((row: any) => row.id)
        .filter(Boolean);

      if (!routeIds.length) return [];

      query = query.in('route_id', routeIds);
    } else if (table === 'bus_attendance') {
      const { data: studentRows, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId);

      if (studentError) throw studentError;

      const studentIds = (studentRows ?? [])
        .map((row: any) => row.id)
        .filter(Boolean);

      if (!studentIds.length) return [];

      query = query.in('student_id', studentIds);
    } else if (options?.schoolColumn !== '') {
      query = query.eq(options?.schoolColumn ?? 'school_id', schoolId);
    }
  }

  if (options?.orderBy) {
    query = query.order(options.orderBy, {
      ascending: options.ascending ?? false,
    });
  }

  const { data, error } = await query.limit(options?.limit ?? 500);
  if (error) throw error;
  return (data ?? []) as unknown as AnyAdminRow[];
}

export async function adminInsert(
  table: string,
  payload: Record<string, any>
) {
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data as AnyAdminRow;
}

export async function adminUpdate(
  table: string,
  id: string,
  payload: Record<string, any>
) {
  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as AnyAdminRow;
}

export async function adminDelete(
  table: string,
  id: string
) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function nullIfEmpty(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

export function asNumberOrNull(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export async function setStudentRouteAssignment(args: {
  schoolId: string;
  studentId: string;
  routeId: string | null;
  teacherId?: string | null;
  academicYearId?: string | null;
  orderIndex?: number;
  pickupTime?: string | null;
  dropoffTime?: string | null;
  notes?: string | null;
}) {
  const { error: studentError } = await supabase
    .from('students')
    .update({
      route_id: args.routeId,
      teacher_id: args.teacherId ?? null,
    })
    .eq('id', args.studentId)
    .eq('school_id', args.schoolId);

  if (studentError) throw studentError;

  const { data: existing, error: existingError } = await supabase
    .from('route_students')
    .select('*')
    .eq('student_id', args.studentId)
    .eq('academic_year_id', args.academicYearId ?? null)
    .maybeSingle();

  if (existingError) {
    const msg = String(existingError.message ?? '');
    if (!msg.toLowerCase().includes('multiple')) throw existingError;
  }

  if (!args.routeId) {
    if (existing?.id) {
      const { error } = await supabase
        .from('route_students')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
    }
    return;
  }

  const payload = {
    route_id: args.routeId,
    student_id: args.studentId,
    order_index: args.orderIndex ?? 0,
    pickup_time: nullIfEmpty(args.pickupTime),
    dropoff_time: nullIfEmpty(args.dropoffTime),
    notes: nullIfEmpty(args.notes),
    academic_year_id: args.academicYearId ?? null,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from('route_students')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('route_students')
      .insert(payload);
    if (error) throw error;
  }
}

export async function setParentStudentLink(args: {
  schoolId: string;
  parentId: string;
  studentId: string;
  relation?: string | null;
  isPrimary?: boolean;
  academicYearId?: string | null;
}) {
  const { data: existing, error: readError } = await supabase
    .from('parent_students')
    .select('*')
    .eq('parent_id', args.parentId)
    .eq('student_id', args.studentId)
    .maybeSingle();

  if (readError) throw readError;

  const payload = {
    parent_id: args.parentId,
    student_id: args.studentId,
    relation: nullIfEmpty(args.relation),
    is_primary: args.isPrimary ?? false,
    school_id: args.schoolId,
    academic_year_id: args.academicYearId ?? null,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from('parent_students')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('parent_students')
      .insert(payload);
    if (error) throw error;
  }

  const { error: parentError } = await supabase
    .from('parents')
    .update({ student_id: args.studentId })
    .eq('id', args.parentId);

  if (parentError) {
    console.log('[admin] parent compatibility link:', parentError.message);
  }
}
