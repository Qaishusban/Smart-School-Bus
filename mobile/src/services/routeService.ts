import { supabase } from '../lib/supabase';

type AnyRow = Record<string, any>;

export async function getRoute(
  routeId: string
): Promise<AnyRow | null> {
  if (!routeId) {
    return null;
  }

  const { data: route, error: routeError } =
    await supabase
      .from('routes')
      .select('*')
      .eq('id', routeId)
      .maybeSingle();

  if (routeError) {
    console.log(
      'getRoute route error:',
      routeError
    );
    throw routeError;
  }

  if (!route) {
    return null;
  }

  let bus: AnyRow | null = null;
  let teacher: AnyRow | null = null;

  if (route.bus_id) {
    const {
      data: busData,
      error: busError,
    } = await supabase
      .from('buses')
      .select('*')
      .eq('id', route.bus_id)
      .maybeSingle();

    if (busError) {
      console.log(
        'getRoute bus error:',
        busError
      );
    } else {
      bus = busData;
    }
  }

  /*
   * عند قاعدة البيانات الحالية توجد أكثر من علاقة
   * بين routes و teachers.
   *
   * نعتمد teacher_id أولاً لأنه الحقل المباشر
   * الخاص بالمسار، ونتجنب PostgREST ambiguous embed.
   */
  const teacherId =
    route.teacher_id || null;

  if (teacherId) {
    const {
      data: teacherData,
      error: teacherError,
    } = await supabase
      .from('teachers')
      .select(
        'id, full_name, username, phone, school_id, is_active'
      )
      .eq('id', teacherId)
      .maybeSingle();

    if (teacherError) {
      console.log(
        'getRoute teacher error:',
        teacherError
      );
    } else {
      teacher = teacherData;
    }
  }

  return {
    ...route,

    bus,
    buses: bus,

    teacher,
    teachers: teacher,
  };
}

export async function getRoutesBySchool(
  schoolId: string
): Promise<AnyRow[]> {
  if (!schoolId) {
    return [];
  }

  const { data, error } =
    await supabase
      .from('routes')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  return data ?? [];
}
