import { supabase } from '../lib/supabase';

export type AnyRow = Record<string, any>;

export type ParentTrackingChild = {
  link: AnyRow;
  parent: AnyRow | null;
  student: AnyRow;
  route: AnyRow | null;
  bus: AnyRow | null;
  driver: AnyRow | null;
  teacher: AnyRow | null;
  school: AnyRow | null;
  attendance: AnyRow | null;

  liveLocation: AnyRow | null;
  lastTrackingPoint: AnyRow | null;
  lastSpeedLocation: AnyRow | null;
};

function isUuid(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

async function getOne(
  table: string,
  column: string,
  value: any
): Promise<AnyRow | null> {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(column, value)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log(
        `[tracking] ${table}.${column} error:`,
        error.message
      );

      return null;
    }

    return data ?? null;
  } catch (error) {
    console.log(
      `[tracking] ${table}.${column} exception:`,
      error
    );

    return null;
  }
}

export async function getParentProfile(
  parentId: string
): Promise<AnyRow | null> {
  if (!parentId) {
    return null;
  }

  return await getOne(
    'parents',
    'id',
    parentId
  );
}

async function getStudentRoute(
  student: AnyRow
): Promise<AnyRow | null> {
  /*
   * أولاً: route_id الموجود على الطالب.
   */
  if (student?.route_id) {
    const directRoute = await getOne(
      'routes',
      'id',
      student.route_id
    );

    if (directRoute) {
      return directRoute;
    }
  }

  /*
   * ثانياً: جدول route_students.
   */
  if (!student?.id) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('route_students')
      .select('*')
      .eq('student_id', student.id)
      .order('created_at', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log(
        '[tracking] route_students error:',
        error.message
      );

      return null;
    }

    if (!data?.route_id) {
      return null;
    }

    return await getOne(
      'routes',
      'id',
      data.route_id
    );
  } catch (error) {
    console.log(
      '[tracking] route_students exception:',
      error
    );

    return null;
  }
}

async function getStudentBus(
  student: AnyRow,
  route: AnyRow | null
): Promise<AnyRow | null> {
  /*
   * المصدر الأساسي الصحيح:
   * routes.bus_id
   */
  if (route?.bus_id) {
    const bus = await getOne(
      'buses',
      'id',
      route.bus_id
    );

    if (bus) {
      return bus;
    }
  }

  /*
   * الداتا القديمة:
   * students.bus_id نوعه text.
   */
  const rawBusId =
    student?.bus_id;

  if (rawBusId) {
    if (isUuid(rawBusId)) {
      const busById = await getOne(
        'buses',
        'id',
        rawBusId
      );

      if (busById) {
        return busById;
      }
    }

    /*
     * يمكن أن يحتوي students.bus_id
     * رقم الباص بدل UUID.
     */
    const busByNumber = await getOne(
      'buses',
      'bus_number',
      String(rawBusId)
    );

    if (busByNumber) {
      return busByNumber;
    }
  }

  if (student?.bus_number) {
    const bus = await getOne(
      'buses',
      'bus_number',
      String(student.bus_number)
    );

    if (bus) {
      return bus;
    }
  }

  return null;
}

async function getBusDriver(
  bus: AnyRow | null
): Promise<AnyRow | null> {
  if (!bus) {
    return null;
  }

  /*
   * الربط الحديث.
   */
  if (bus.main_driver_id) {
    const driver = await getOne(
      'drivers',
      'id',
      bus.main_driver_id
    );

    if (driver) {
      return driver;
    }
  }

  /*
   * الربط القديم:
   * drivers.bus_id من نوع text.
   */
  if (bus.id) {
    const driverByBusId = await getOne(
      'drivers',
      'bus_id',
      String(bus.id)
    );

    if (driverByBusId) {
      return driverByBusId;
    }
  }

  /*
   * fallback حسب رقم الباص.
   */
  if (bus.bus_number) {
    const driverByNumber = await getOne(
      'drivers',
      'bus_number',
      String(bus.bus_number)
    );

    if (driverByNumber) {
      return driverByNumber;
    }
  }

  return null;
}

async function getRouteTeacher(
  student: AnyRow,
  route: AnyRow | null
): Promise<AnyRow | null> {
  const teacherId =
    route?.teacher_id ??
    route?.routes_teacher_fk ??
    student?.teacher_id ??
    null;

  if (!teacherId) {
    return null;
  }

  return await getOne(
    'teachers',
    'id',
    teacherId
  );
}

async function getSchool(
  student: AnyRow,
  route: AnyRow | null,
  bus: AnyRow | null
): Promise<AnyRow | null> {
  const schoolId =
    student?.school_id ??
    route?.school_id ??
    bus?.school_id ??
    null;

  if (!schoolId) {
    return null;
  }

  return await getOne(
    'schools',
    'id',
    schoolId
  );
}

async function getAttendance(
  studentId: string
): Promise<AnyRow | null> {
  try {
    /*
     * الـ view عندك يحتوي:
     * student_id, status, created_at
     */
    const { data, error } = await supabase
      .from(
        'latest_bus_attendance_per_student'
      )
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();

    if (!error && data) {
      return data;
    }

    /*
     * fallback على الجدول نفسه.
     */
    const fallback =
      await supabase
        .from('bus_attendance')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (fallback.error) {
      console.log(
        '[tracking] attendance error:',
        fallback.error.message
      );

      return null;
    }

    return fallback.data ?? null;
  } catch (error) {
    console.log(
      '[tracking] attendance exception:',
      error
    );

    return null;
  }
}

async function getLiveLocation(
  busId: string
): Promise<AnyRow | null> {
  try {
    const { data, error } = await supabase
      .from('bus_live_locations')
      .select('*')
      .eq('bus_id', busId)
      .order('updated_at', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log(
        '[tracking] live location error:',
        error.message
      );

      return null;
    }

    return data ?? null;
  } catch (error) {
    console.log(
      '[tracking] live location exception:',
      error
    );

    return null;
  }
}

async function getLastTrackingPoint(
  busId: string
): Promise<AnyRow | null> {
  try {
    const { data, error } = await supabase
      .from('bus_tracking_points')
      .select('*')
      .eq('bus_id', busId)
      .order('recorded_at', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log(
        '[tracking] tracking point error:',
        error.message
      );

      return null;
    }

    return data ?? null;
  } catch (error) {
    console.log(
      '[tracking] tracking point exception:',
      error
    );

    return null;
  }
}

async function getLastSpeedLocation(
  busId: string
): Promise<AnyRow | null> {
  try {
    /*
     * bus_locations هو الذي يحتوي speed.
     */
    const { data, error } = await supabase
      .from('bus_locations')
      .select('*')
      .eq('bus_id', busId)
      .order('recorded_at', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log(
        '[tracking] speed location error:',
        error.message
      );

      return null;
    }

    return data ?? null;
  } catch (error) {
    console.log(
      '[tracking] speed location exception:',
      error
    );

    return null;
  }
}

/*
 * =========================================================
 * الدالة الرئيسية
 * =========================================================
 *
 * مهم:
 * لا تعتمد على route.params.
 *
 * parentId = user.id الخاص بولي الأمر بعد PIN login.
 */
export async function getParentTrackingChildren(
  parentId: string
): Promise<ParentTrackingChild[]> {
  if (!parentId) {
    return [];
  }

  console.log(
    '[tracking] loading children for parent:',
    parentId
  );

  /*
   * ملف ولي الأمر نفسه لاستخدام الاسم والهاتف والبريد
   * وبيانات المدرسة داخل واجهة ولي الأمر.
   */
  const parent =
    await getParentProfile(
      parentId
    );

  /*
   * الخطوة 1:
   * نقرأ روابط ولي الأمر فقط.
   *
   * لا نستخدم nested students هنا حتى نتجنب
   * أي مشكلة FK / PostgREST relationship.
   */
  const {
    data: links,
    error: linksError,
  } = await supabase
    .from('parent_students')
    .select('*')
    .eq('parent_id', parentId)
    .order('is_primary', {
      ascending: false,
    })
    .order('created_at', {
      ascending: true,
    });

  if (linksError) {
    console.log(
      '[tracking] parent_students ERROR:',
      linksError
    );

    throw new Error(
      `parent_students: ${linksError.message}`
    );
  }

  console.log(
    '[tracking] parent links:',
    links?.length ?? 0
  );

  if (!links?.length) {
    return [];
  }

  const studentIds =
    Array.from(
      new Set(
        links
          .map(
            (link) =>
              link.student_id
          )
          .filter(Boolean)
      )
    );

  if (!studentIds.length) {
    return [];
  }

  /*
   * الخطوة 2:
   * الطلاب كاستعلام منفصل وواضح.
   */
  const {
    data: students,
    error: studentsError,
  } = await supabase
    .from('students')
    .select('*')
    .in('id', studentIds);

  if (studentsError) {
    console.log(
      '[tracking] students ERROR:',
      studentsError
    );

    throw new Error(
      `students: ${studentsError.message}`
    );
  }

  console.log(
    '[tracking] students loaded:',
    students?.length ?? 0
  );

  const studentsById =
    new Map<string, AnyRow>();

  for (
    const student of students ?? []
  ) {
    studentsById.set(
      student.id,
      student
    );
  }

  const result:
    ParentTrackingChild[] = [];

  /*
   * الخطوة 3:
   * نجمع تفاصيل كل طالب.
   */
  for (const link of links) {
    const student =
      studentsById.get(
        link.student_id
      );

    if (!student) {
      console.log(
        '[tracking] student not found:',
        link.student_id
      );

      continue;
    }

    const [
      route,
      attendance,
    ] = await Promise.all([
      getStudentRoute(
        student
      ),

      getAttendance(
        student.id
      ),
    ]);

    const bus =
      await getStudentBus(
        student,
        route
      );

    const [
      driver,
      teacher,
      school,
    ] = await Promise.all([
      getBusDriver(bus),

      getRouteTeacher(
        student,
        route
      ),

      getSchool(
        student,
        route,
        bus
      ),
    ]);

    let liveLocation:
      AnyRow | null = null;

    let lastTrackingPoint:
      AnyRow | null = null;

    let lastSpeedLocation:
      AnyRow | null = null;

    if (bus?.id) {
      [
        liveLocation,
        lastTrackingPoint,
        lastSpeedLocation,
      ] = await Promise.all([
        getLiveLocation(
          bus.id
        ),

        getLastTrackingPoint(
          bus.id
        ),

        getLastSpeedLocation(
          bus.id
        ),
      ]);
    }

    result.push({
      link,
      parent,
      student,
      route,
      bus,
      driver,
      teacher,
      school,
      attendance,
      liveLocation,
      lastTrackingPoint,
      lastSpeedLocation,
    });

    console.log(
      '[tracking] child loaded:',
      {
        student:
          student.full_name ??
          student.name,

        route:
          route?.name ??
          null,

        bus:
          bus?.bus_number ??
          null,

        driver:
          driver?.full_name ??
          null,

        school:
          school?.name_ar ??
          school?.name_en ??
          school?.name ??
          null,

        teacher:
          teacher?.full_name ??
          null,

        parent:
          parent?.full_name_ar ??
          parent?.full_name_en ??
          parent?.full_name ??
          null,

        live:
          Boolean(
            liveLocation
          ),
      }
    );
  }

  console.log(
    '[tracking] completed children:',
    result.length
  );

  return result;
}