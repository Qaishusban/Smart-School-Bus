import { supabase } from '../lib/supabase';

export type AnyRow =
  Record<string, any>;

export type DriverDashboardData = {
  driver: AnyRow | null;
  school: AnyRow | null;
  bus: AnyRow | null;
  route: AnyRow | null;

  teacher: AnyRow | null;

  routeStudents: AnyRow[];
  students: AnyRow[];

  latestLocation:
    AnyRow | null;

  latestTrackingPoint:
    AnyRow | null;

  /*
   * IMPORTANT:
   * This now contains the newest attendance row
   * for every student + trip period.
   *
   * trip_mode:
   *   to_school = morning
   *   to_home   = evening
   */
  latestAttendance:
    AnyRow[];

  activeTrip:
    AnyRow | null;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function getOne(
  table: string,
  column: string,
  value: unknown
): Promise<AnyRow | null> {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(table)
        .select('*')
        .eq(
          column,
          value
        )
        .limit(1)
        .maybeSingle();

    if (error) {
      console.log(
        `[driver] ${table}.${column}:`,
        error.message
      );

      return null;
    }

    return data ?? null;
  } catch (error) {
    console.log(
      `[driver] ${table}.${column} exception:`,
      error
    );

    return null;
  }
}

function uniqueRows(
  rows: AnyRow[]
) {
  const map =
    new Map<
      string,
      AnyRow
    >();

  for (
    const row of rows
  ) {
    const key =
      String(
        row?.id ?? ''
      );

    if (key) {
      map.set(
        key,
        row
      );
    }
  }

  return Array.from(
    map.values()
  );
}

/* -------------------------------------------------------------------------- */
/* Driver                                                                     */
/* -------------------------------------------------------------------------- */

export async function getDriverProfile(
  driverId: string
): Promise<AnyRow | null> {
  if (!driverId) {
    return null;
  }

  return await getOne(
    'drivers',
    'id',
    driverId
  );
}

/* -------------------------------------------------------------------------- */
/* Bus                                                                        */
/* -------------------------------------------------------------------------- */

async function getDriverBus(
  driver: AnyRow | null,
  loginBusId?: string | null,
  loginBusNumber?: string | null
): Promise<AnyRow | null> {
  if (loginBusId) {
    const byId =
      await getOne(
        'buses',
        'id',
        loginBusId
      );

    if (byId) {
      return byId;
    }
  }

  if (driver?.bus_id) {
    const byId =
      await getOne(
        'buses',
        'id',
        driver.bus_id
      );

    if (byId) {
      return byId;
    }

    const byNumber =
      await getOne(
        'buses',
        'bus_number',
        String(
          driver.bus_id
        )
      );

    if (byNumber) {
      return byNumber;
    }
  }

  if (loginBusNumber) {
    const byNumber =
      await getOne(
        'buses',
        'bus_number',
        loginBusNumber
      );

    if (byNumber) {
      return byNumber;
    }
  }

  if (driver?.bus_number) {
    const byNumber =
      await getOne(
        'buses',
        'bus_number',
        String(
          driver.bus_number
        )
      );

    if (byNumber) {
      return byNumber;
    }
  }

  if (driver?.id) {
    const mainBus =
      await getOne(
        'buses',
        'main_driver_id',
        driver.id
      );

    if (mainBus) {
      return mainBus;
    }

    const backupBus =
      await getOne(
        'buses',
        'backup_driver_id',
        driver.id
      );

    if (backupBus) {
      return backupBus;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Route                                                                      */
/* -------------------------------------------------------------------------- */

async function getDriverRoute(
  driver: AnyRow | null,
  bus: AnyRow | null
): Promise<AnyRow | null> {
  if (bus?.id) {
    try {
      const {
        data,
        error,
      } =
        await supabase
          .from('routes')
          .select('*')
          .eq(
            'bus_id',
            bus.id
          )
          .order(
            'created_at',
            {
              ascending:
                false,
            }
          )
          .limit(1)
          .maybeSingle();

      if (
        !error &&
        data
      ) {
        return data;
      }

      if (error) {
        console.log(
          '[driver] routes by bus:',
          error.message
        );
      }
    } catch (error) {
      console.log(
        '[driver] routes by bus exception:',
        error
      );
    }
  }

  if (driver?.route_id) {
    return await getOne(
      'routes',
      'id',
      driver.route_id
    );
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* School                                                                     */
/* -------------------------------------------------------------------------- */

async function getDriverSchool(
  driver: AnyRow | null,
  bus: AnyRow | null,
  route: AnyRow | null,
  loginSchoolId?:
    string | null
): Promise<AnyRow | null> {
  const schoolId =
    loginSchoolId ??
    driver?.school_id ??
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

/* -------------------------------------------------------------------------- */
/* Teacher                                                                    */
/* -------------------------------------------------------------------------- */

async function getRouteTeacher(
  route: AnyRow | null
): Promise<AnyRow | null> {
  const teacherId =
    route?.teacher_id ??
    route?.routes_teacher_fk ??
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

/* -------------------------------------------------------------------------- */
/* Students                                                                   */
/* -------------------------------------------------------------------------- */

async function getRouteStudents(
  routeId: string
): Promise<AnyRow[]> {
  if (!routeId) {
    return [];
  }

  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'route_students'
        )
        .select('*')
        .eq(
          'route_id',
          routeId
        )
        .order(
          'created_at',
          {
            ascending:
              true,
          }
        );

    if (error) {
      console.log(
        '[driver] route_students:',
        error.message
      );

      return [];
    }

    return data ?? [];
  } catch (error) {
    console.log(
      '[driver] route_students exception:',
      error
    );

    return [];
  }
}

async function getStudents(
  routeStudents:
    AnyRow[]
): Promise<AnyRow[]> {
  const ids =
    Array.from(
      new Set(
        routeStudents
          .map(
            (row) =>
              row?.student_id
          )
          .filter(Boolean)
      )
    );

  if (!ids.length) {
    return [];
  }

  try {
    const {
      data,
      error,
    } =
      await supabase
        .from('students')
        .select('*')
        .in(
          'id',
          ids
        );

    if (error) {
      console.log(
        '[driver] students:',
        error.message
      );

      return [];
    }

    return uniqueRows(
      data ?? []
    );
  } catch (error) {
    console.log(
      '[driver] students exception:',
      error
    );

    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Attendance                                                                 */
/* -------------------------------------------------------------------------- */

async function getLatestAttendanceForStudents(
  students: AnyRow[]
): Promise<AnyRow[]> {
  const ids =
    students
      .map(
        (row) =>
          row?.id
      )
      .filter(Boolean);

  if (!ids.length) {
    return [];
  }

  /*
   * لا نستخدم آخر حركة واحدة للطالب.
   *
   * الصباحية والمسائية فترتان مستقلتان:
   *
   * 00:00 - 11:59 = to_school
   * 12:00 - 23:59 = to_home
   *
   * ونحتفظ بأحدث حركة لكل:
   * student + period
   */

  const start =
    new Date();

  start.setHours(
    0,
    0,
    0,
    0
  );

  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'bus_attendance'
        )
        .select('*')
        .in(
          'student_id',
          ids
        )
        .gte(
          'created_at',
          start.toISOString()
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          }
        )
        .limit(
          Math.max(
            100,
            ids.length * 12
          )
        );

    if (error) {
      console.log(
        '[driver] attendance:',
        error.message
      );

      return [];
    }

    const byStudentAndPeriod =
      new Map<
        string,
        AnyRow
      >();

    for (
      const row of
        data ?? []
    ) {
      const studentId =
        String(
          row?.student_id ??
          ''
        );

      if (!studentId) {
        continue;
      }

      /*
       * إذا قاعدة البيانات تحتوي trip_mode
       * أو period نستخدمه مباشرة.
       *
       * وإلا نستنتج الفترة من وقت الحركة.
       */
      const explicitMode =
        String(
          row?.trip_mode ??
          row?.period ??
          row?.data
            ?.trip_mode ??
          ''
        )
          .trim()
          .toLowerCase();

      let tripMode:
        | 'to_school'
        | 'to_home';

      if (
        explicitMode ===
          'to_home' ||
        explicitMode ===
          'evening' ||
        explicitMode ===
          'pm'
      ) {
        tripMode =
          'to_home';
      } else if (
        explicitMode ===
          'to_school' ||
        explicitMode ===
          'morning' ||
        explicitMode ===
          'am'
      ) {
        tripMode =
          'to_school';
      } else {
        const created =
          new Date(
            row?.created_at ??
            row?.updated_at ??
            Date.now()
          );

        tripMode =
          created.getHours() <
          12
            ? 'to_school'
            : 'to_home';
      }

      const key =
        `${studentId}:${tripMode}`;

      /*
       * البيانات مرتبة من الأحدث للأقدم،
       * لذلك أول سجل هو أحدث حالة للفترة.
       */
      if (
        !byStudentAndPeriod.has(
          key
        )
      ) {
        byStudentAndPeriod.set(
          key,
          {
            ...row,

            /*
             * نضيف trip_mode حتى لو الجدول
             * نفسه لا يحتوي هذا العمود.
             *
             * هذا للواجهة فقط ولا يتم حفظه.
             */
            trip_mode:
              tripMode,
          }
        );
      }
    }

    return Array.from(
      byStudentAndPeriod.values()
    );
  } catch (error) {
    console.log(
      '[driver] attendance exception:',
      error
    );

    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Location                                                                   */
/* -------------------------------------------------------------------------- */

async function getLatestLocation(
  busId: string
): Promise<AnyRow | null> {
  if (!busId) {
    return null;
  }

  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'bus_live_locations'
        )
        .select('*')
        .eq(
          'bus_id',
          busId
        )
        .order(
          'updated_at',
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle();

    if (error) {
      console.log(
        '[driver] live location:',
        error.message
      );

      return null;
    }

    return data ?? null;
  } catch (error) {
    console.log(
      '[driver] live location exception:',
      error
    );

    return null;
  }
}

async function getLatestTrackingPoint(
  busId: string
): Promise<AnyRow | null> {
  if (!busId) {
    return null;
  }

  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'bus_tracking_points'
        )
        .select('*')
        .eq(
          'bus_id',
          busId
        )
        .order(
          'recorded_at',
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle();

    if (error) {
      console.log(
        '[driver] latest tracking:',
        error.message
      );

      return null;
    }

    return data ?? null;
  } catch (error) {
    console.log(
      '[driver] latest tracking exception:',
      error
    );

    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Trip                                                                       */
/* -------------------------------------------------------------------------- */

async function getActiveTrip(
  driverId: string,
  busId?: string | null
): Promise<AnyRow | null> {
  try {
    let query =
      supabase
        .from(
          'bus_trip_events'
        )
        .select('*')
        .order(
          'created_at',
          {
            ascending:
              false,
          }
        )
        .limit(1);

    if (driverId) {
      query =
        query.eq(
          'driver_id',
          driverId
        );
    } else if (busId) {
      query =
        query.eq(
          'bus_id',
          busId
        );
    }

    const {
      data,
      error,
    } =
      await query
        .maybeSingle();

    if (error) {
      console.log(
        '[driver] bus_trip_events:',
        error.message
      );

      return null;
    }

    return data ?? null;
  } catch (error) {
    console.log(
      '[driver] bus_trip_events exception:',
      error
    );

    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export async function getDriverDashboard(
  params: {
    driverId: string;

    schoolId?:
      string | null;

    busId?:
      string | null;

    busNumber?:
      string | null;
  }
): Promise<DriverDashboardData> {
  const {
    driverId,
    schoolId,
    busId,
    busNumber,
  } = params;

  if (!driverId) {
    throw new Error(
      'Driver ID is required.'
    );
  }

  console.log(
    '[driver] dashboard load:',
    driverId
  );

  const driver =
    await getDriverProfile(
      driverId
    );

  const bus =
    await getDriverBus(
      driver,
      busId,
      busNumber
    );

  const route =
    await getDriverRoute(
      driver,
      bus
    );

  const [
    school,
    teacher,
  ] =
    await Promise.all([
      getDriverSchool(
        driver,
        bus,
        route,
        schoolId
      ),

      getRouteTeacher(
        route
      ),
    ]);

  const routeStudents =
    route?.id
      ? await getRouteStudents(
          route.id
        )
      : [];

  const students =
    await getStudents(
      routeStudents
    );

  const [
    latestLocation,
    latestTrackingPoint,
    latestAttendance,
    activeTrip,
  ] =
    await Promise.all([
      bus?.id
        ? getLatestLocation(
            bus.id
          )
        : Promise.resolve(
            null
          ),

      bus?.id
        ? getLatestTrackingPoint(
            bus.id
          )
        : Promise.resolve(
            null
          ),

      getLatestAttendanceForStudents(
        students
      ),

      getActiveTrip(
        driverId,
        bus?.id
      ),
    ]);

  console.log(
    '[driver] dashboard ready:',
    {
      driver:
        driver?.full_name ??
        driver?.name ??
        null,

      bus:
        bus?.bus_number ??
        null,

      route:
        route?.name ??
        route?.route_name ??
        null,

      students:
        students.length,

      attendance:
        latestAttendance.length,

      live:
        Boolean(
          latestLocation
        ),
    }
  );

  return {
    driver,
    school,
    bus,
    route,
    teacher,

    routeStudents,
    students,

    latestLocation,
    latestTrackingPoint,

    latestAttendance,
    activeTrip,
  };
}