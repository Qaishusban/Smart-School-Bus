import { supabase } from '../lib/supabase';

import {
  createDriverIncident as createSecureDriverIncident,
} from './driverIncidentService';

export type DriverTripMode =
  | 'to_school'
  | 'to_home';

export type DriverTripPosition = {
  latitude: number;
  longitude: number;
  heading?: number | null;
  accuracy?: number | null;
  speed?: number | null;
};

export type DriverTripContext = {
  schoolId?: string | null;
  driverId: string;
  busId: string;
  routeId?: string | null;
  tripMode?: DriverTripMode | null;
};

export type DriverStudentStatus =
  | 'arrived'
  | 'boarded'
  | 'absent'
  | 'delivered';

export type DriverRouteStudent = {
  route_student_id: string;
  route_id: string;
  student_id: string;
  order_index: number;

  pickup_time?: string | null;
  dropoff_time?: string | null;
  academic_year_id?: string | null;

  student: Record<string, any>;

  parent_id: string | null;
  parent_name: string | null;
  parent_phone: string | null;

  latest_status: string | null;
  latest_status_at: string | null;

  instruction_status: string | null;
  instruction_note: string | null;

  is_excluded: boolean;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function todayKey(
  date: Date = new Date()
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}-${day}`;
}

function normalize(
  value: unknown
) {
  return String(
    value ?? ''
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      '_'
    );
}

function looksLikeUuid(
  value: unknown
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(
      value ?? ''
    ).trim()
  );
}

/* -------------------------------------------------------------------------- */
/* Trip event copy                                                            */
/* -------------------------------------------------------------------------- */

function tripBody(
  type: string,
  mode?: DriverTripMode | null
) {
  const modeText =
    mode === 'to_home'
      ? 'to_home'
      : 'to_school';

  if (
    type ===
    'trip_started'
  ) {
    return (
      'Driver started the school bus trip. ' +
      `trip_mode=${modeText}`
    );
  }

  if (
    type ===
    'trip_ended'
  ) {
    return (
      'Driver ended the school bus trip. ' +
      `trip_mode=${modeText}`
    );
  }

  return (
    `trip_mode=${modeText}`
  );
}

export function tripModeFromEvent(
  event: any
): DriverTripMode | null {
  const body =
    String(
      event?.body ??
      ''
    );

  if (
    body.includes(
      'trip_mode=to_home'
    )
  ) {
    return 'to_home';
  }

  if (
    body.includes(
      'trip_mode=to_school'
    )
  ) {
    return 'to_school';
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Trip events                                                                */
/* -------------------------------------------------------------------------- */

export async function createTripEvent(
  context: DriverTripContext,
  type: string,
  position?:
    DriverTripPosition |
    null
) {
  const payload = {
    school_id:
      context.schoolId ??
      null,

    bus_id:
      context.busId,

    driver_id:
      context.driverId,

    route_id:
      context.routeId ??
      null,

    type,

    title:
      type ===
      'trip_started'
        ? 'Trip Started'
        : type ===
          'trip_ended'
        ? 'Trip Ended'
        : type,

    body:
      tripBody(
        type,
        context.tripMode
      ),

    lat:
      position
        ?.latitude ??
      null,

    lng:
      position
        ?.longitude ??
      null,
  };

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'bus_trip_events'
      )
      .insert(
        payload
      )
      .select('*')
      .single();

  if (error) {
    console.log(
      '[driverTrip] create event:',
      error
    );

    throw error;
  }

  return data;
}

/* -------------------------------------------------------------------------- */
/* Latest trip event                                                          */
/* -------------------------------------------------------------------------- */

export async function getLatestTripEvent(
  driverId: string,
  busId?: string | null
) {
  let query =
    supabase
      .from(
        'bus_trip_events'
      )
      .select('*')
      .eq(
        'driver_id',
        driverId
      );

  if (busId) {
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
      .order(
        'created_at',
        {
          ascending:
            false,
        }
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    console.log(
      '[driverTrip] latest trip event:',
      error
    );

    throw error;
  }

  return (
    data ??
    null
  );
}

/* -------------------------------------------------------------------------- */
/* Active trip                                                                */
/* -------------------------------------------------------------------------- */

export async function getActiveTripInfo(
  driverId: string,
  busId?: string | null
) {
  const latest =
    await getLatestTripEvent(
      driverId,
      busId
    );

  if (!latest) {
    return {
      active: false,
      event: null,
      mode:
        null as
          DriverTripMode |
          null,
      startedAt:
        null as
          string |
          null,
    };
  }

  const type =
    normalize(
      latest.type
    );

  const active =
    [
      'trip_started',
      'trip_start',
      'started',
      'start',
    ].includes(
      type
    );

  return {
    active,

    event:
      latest,

    mode:
      active
        ? tripModeFromEvent(
            latest
          )
        : null,

    startedAt:
      active
        ? latest
            .created_at ??
          null
        : null,
  };
}

export async function isDriverTripActive(
  driverId: string,
  busId?: string | null
) {
  const info =
    await getActiveTripInfo(
      driverId,
      busId
    );

  return info.active;
}

/* -------------------------------------------------------------------------- */
/* Start trip                                                                 */
/* -------------------------------------------------------------------------- */

export async function startDriverTrip(
  context: DriverTripContext,
  position?:
    DriverTripPosition |
    null
) {
  const info =
    await getActiveTripInfo(
      context.driverId,
      context.busId
    );

  /*
   * Prevent duplicate start events.
   */
  if (info.active) {
    return info.event;
  }

  return createTripEvent(
    context,
    'trip_started',
    position
  );
}

/* -------------------------------------------------------------------------- */
/* End trip                                                                   */
/* -------------------------------------------------------------------------- */

export async function endDriverTrip(
  context: DriverTripContext,
  position?:
    DriverTripPosition |
    null
) {
  /*
   * Read the latest event again before ending.
   *
   * This prevents duplicate trip_ended rows when:
   * - auto end fires
   * - GPS fires again
   * - user presses End Trip at the same time
   */
  const info =
    await getActiveTripInfo(
      context.driverId,
      context.busId
    );

  if (!info.active) {
    return info.event;
  }

  return createTripEvent(
    context,
    'trip_ended',
    position
  );
}

/* -------------------------------------------------------------------------- */
/* Live location                                                              */
/* -------------------------------------------------------------------------- */

export async function updateBusLiveLocation(
  busId: string,
  position:
    DriverTripPosition
) {
  const {
    data: existing,
    error:
      existingError,
  } =
    await supabase
      .from(
        'bus_live_locations'
      )
      .select(
        'id'
      )
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

  if (
    existingError
  ) {
    console.log(
      '[driverTrip] live location lookup:',
      existingError
    );
  }

  const payload = {
    bus_id:
      busId,

    lat:
      position.latitude,

    lng:
      position.longitude,

    heading:
      position.heading ??
      null,

    updated_at:
      new Date()
        .toISOString(),
  };

  if (
    existing?.id
  ) {
    const {
      error,
    } =
      await supabase
        .from(
          'bus_live_locations'
        )
        .update(
          payload
        )
        .eq(
          'id',
          existing.id
        );

    if (error) {
      throw error;
    }

    return;
  }

  const {
    error,
  } =
    await supabase
      .from(
        'bus_live_locations'
      )
      .insert(
        payload
      );

  if (error) {
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Tracking point                                                             */
/* -------------------------------------------------------------------------- */

export async function insertTrackingPoint(
  context: DriverTripContext,
  position:
    DriverTripPosition
) {
  const {
    error,
  } =
    await supabase
      .from(
        'bus_tracking_points'
      )
      .insert({
        school_id:
          context.schoolId ??
          null,

        driver_id:
          context.driverId,

        bus_id:
          context.busId,

        lat:
          position.latitude,

        lng:
          position.longitude,

        latitude:
          position.latitude,

        longitude:
          position.longitude,

        lon:
          position.longitude,

        recorded_at:
          new Date()
            .toISOString(),
      });

  if (error) {
    throw error;
  }
}

export async function writeDriverLocation(
  context:
    DriverTripContext,
  position:
    DriverTripPosition
) {
  await Promise.all([
    updateBusLiveLocation(
      context.busId,
      position
    ),

    insertTrackingPoint(
      context,
      position
    ),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Parent instruction / exclusion                                             */
/* -------------------------------------------------------------------------- */

function excludedForMode(
  status: unknown,
  tripMode:
    DriverTripMode
) {
  const value =
    normalize(
      status
    );

  /*
   * Excluded from both trips.
   */
  if (
    [
      'leave',
      'leave_holiday',
      'holiday',
      'vacation',

      'sick',
      'sick_leave',
      'medical',
      'medical_leave',

      'absent',
      'absence',

      'no_bus',
      'not_riding',
    ].includes(
      value
    )
  ) {
    return true;
  }

  /*
   * Evening-only exclusions.
   *
   * Student leaves school with parent/family,
   * so the driver must not wait for them.
   */
  if (
    tripMode ===
      'to_home' &&
    [
      'with_parent',
      'with_family',
      'picked_by_parent',
      'parent_pickup',
    ].includes(
      value
    )
  ) {
    return true;
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* Route students                                                             */
/* -------------------------------------------------------------------------- */

export async function getDriverRouteStudents(
  routeId: string,
  options?: {
    tripMode?:
      DriverTripMode;

    attendanceSince?:
      string | null;

    busId?:
      string | null;
  }
): Promise<
  DriverRouteStudent[]
> {
  if (!routeId) {
    return [];
  }

  const tripMode =
    options
      ?.tripMode ??
    'to_school';

  /* ------------------------------------------------------------------------ */
  /* Route links                                                              */
  /* ------------------------------------------------------------------------ */

  const {
    data: links,
    error:
      linksError,
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
        'order_index',
        {
          ascending:
            true,
        }
      );

  if (linksError) {
    throw linksError;
  }

  if (
    !links?.length
  ) {
    return [];
  }

  const studentIds =
    Array.from(
      new Set(
        links
          .map(
            (
              row: any
            ) =>
              row.student_id
          )
          .filter(
            Boolean
          )
      )
    );

  /* ------------------------------------------------------------------------ */
  /* Students                                                                 */
  /* ------------------------------------------------------------------------ */

  const studentsResult =
    await supabase
      .from(
        'students'
      )
      .select('*')
      .in(
        'id',
        studentIds
      );

  if (
    studentsResult.error
  ) {
    throw (
      studentsResult.error
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Attendance                                                               */
  /* ------------------------------------------------------------------------ */

  let attendanceQuery =
    supabase
      .from(
        'bus_attendance'
      )
      .select('*')
      .in(
        'student_id',
        studentIds
      );

  if (
    options?.busId
  ) {
    attendanceQuery =
      attendanceQuery.eq(
        'bus_id',
        options.busId
      );
  }

  /*
   * If trip start time exists, only read statuses
   * generated during the current trip.
   *
   * This is important because morning "boarded"
   * must never become evening status.
   */
  if (
    options
      ?.attendanceSince
  ) {
    attendanceQuery =
      attendanceQuery.gte(
        'created_at',
        options
          .attendanceSince
      );
  } else {
    const start =
      new Date();

    start.setHours(
      0,
      0,
      0,
      0
    );

    attendanceQuery =
      attendanceQuery.gte(
        'created_at',
        start.toISOString()
      );
  }

  const attendanceResult =
    await attendanceQuery
      .order(
        'created_at',
        {
          ascending:
            false,
        }
      );

  if (
    attendanceResult.error
  ) {
    throw (
      attendanceResult.error
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Parent instructions                                                      */
  /* ------------------------------------------------------------------------ */

  const today =
    todayKey();

  const instructionsResult =
    await supabase
      .from(
        'parent_daily_instructions'
      )
      .select('*')
      .in(
        'student_id',
        studentIds
      )
      .or(
        `for_date.eq.${today},instruction_date.eq.${today}`
      );

  if (
    instructionsResult.error
  ) {
    console.log(
      '[driverTrip] instructions read:',
      instructionsResult.error
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Parent links                                                             */
  /* ------------------------------------------------------------------------ */

  const parentLinksResult =
    await supabase
      .from(
        'parent_students'
      )
      .select('*')
      .in(
        'student_id',
        studentIds
      )
      .order(
        'is_primary',
        {
          ascending:
            false,
        }
      );

  if (
    parentLinksResult.error
  ) {
    console.log(
      '[driverTrip] parent links:',
      parentLinksResult.error
    );
  }

  const parentIds =
    Array.from(
      new Set(
        (
          parentLinksResult
            .data ??
          []
        )
          .map(
            (
              row: any
            ) =>
              row.parent_id
          )
          .filter(
            Boolean
          )
      )
    );

  const parentsResult =
    parentIds.length
      ? await supabase
          .from(
            'parents'
          )
          .select(
            'id,full_name,phone,can_receive_notifications,is_active'
          )
          .in(
            'id',
            parentIds
          )
      : {
          data: [],
          error: null,
        };

  /* ------------------------------------------------------------------------ */
  /* Maps                                                                     */
  /* ------------------------------------------------------------------------ */

  const studentMap =
    new Map<
      string,
      any
    >();

  for (
    const row of
      studentsResult
        .data ??
      []
  ) {
    studentMap.set(
      String(
        row.id
      ),
      row
    );
  }

  /*
   * Latest attendance during THIS trip.
   */
  const attendanceMap =
    new Map<
      string,
      any
    >();

  for (
    const row of
      attendanceResult
        .data ??
      []
  ) {
    const id =
      String(
        row.student_id
      );

    if (
      !attendanceMap.has(
        id
      )
    ) {
      attendanceMap.set(
        id,
        row
      );
    }
  }

  /*
   * Newest parent instruction wins.
   */
  const instructionRows =
    [
      ...(
        instructionsResult
          .data ??
        []
      ),
    ].sort(
      (
        a: any,
        b: any
      ) => {
        const aTime =
          new Date(
            a?.created_at ??
            a?.updated_at ??
            a?.instruction_date ??
            a?.for_date ??
            0
          ).getTime();

        const bTime =
          new Date(
            b?.created_at ??
            b?.updated_at ??
            b?.instruction_date ??
            b?.for_date ??
            0
          ).getTime();

        return (
          bTime -
          aTime
        );
      }
    );

  const instructionMap =
    new Map<
      string,
      any
    >();

  for (
    const row of
      instructionRows
  ) {
    const id =
      String(
        row.student_id
      );

    if (
      !instructionMap.has(
        id
      )
    ) {
      instructionMap.set(
        id,
        row
      );
    }
  }

  const parentLinkMap =
    new Map<
      string,
      any
    >();

  for (
    const row of
      parentLinksResult
        .data ??
      []
  ) {
    const id =
      String(
        row.student_id
      );

    if (
      !parentLinkMap.has(
        id
      )
    ) {
      parentLinkMap.set(
        id,
        row
      );
    }
  }

  const parentMap =
    new Map<
      string,
      any
    >();

  for (
    const row of
      parentsResult.data ??
      []
  ) {
    parentMap.set(
      String(
        row.id
      ),
      row
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Final result                                                             */
  /* ------------------------------------------------------------------------ */

  return links
    .map(
      (
        link: any
      ) => {
        const student =
          studentMap.get(
            String(
              link.student_id
            )
          );

        if (!student) {
          return null;
        }

        const attendance =
          attendanceMap.get(
            String(
              link.student_id
            )
          );

        const instruction =
          instructionMap.get(
            String(
              link.student_id
            )
          );

        const parentLink =
          parentLinkMap.get(
            String(
              link.student_id
            )
          );

        const parent =
          parentLink
            ?.parent_id
            ? parentMap.get(
                String(
                  parentLink
                    .parent_id
                )
              )
            : null;

        const instructionStatus =
          instruction
            ?.status
            ? normalize(
                instruction
                  .status
              )
            : instruction
                ?.instruction_type
            ? normalize(
                instruction
                  .instruction_type
              )
            : instruction
                ?.type
            ? normalize(
                instruction
                  .type
              )
            : null;

        return {
          route_student_id:
            String(
              link.id
            ),

          route_id:
            String(
              link.route_id
            ),

          student_id:
            String(
              link.student_id
            ),

          order_index:
            Number(
              link
                .order_index ??
              0
            ),

          pickup_time:
            link
              .pickup_time ??
            null,

          dropoff_time:
            link
              .dropoff_time ??
            null,

          academic_year_id:
            link
              .academic_year_id ??
            null,

          student,

          parent_id:
            parent?.id
              ? String(
                  parent.id
                )
              : null,

          parent_name:
            parent
              ?.full_name ??
            null,

          parent_phone:
            parent
              ?.phone ??
            student
              ?.parent_phone ??
            null,

          latest_status:
            attendance
              ?.status
              ? normalize(
                  attendance
                    .status
                )
              : null,

          latest_status_at:
            attendance
              ?.created_at ??
            null,

          instruction_status:
            instructionStatus,

          instruction_note:
            instruction
              ?.note ??
            instruction
              ?.details ??
            instruction
              ?.reason ??
            null,

          is_excluded:
            excludedForMode(
              instructionStatus,
              tripMode
            ),
        } as DriverRouteStudent;
      }
    )
    .filter(
      Boolean
    ) as DriverRouteStudent[];
}

/* -------------------------------------------------------------------------- */
/* Notification copy                                                          */
/* -------------------------------------------------------------------------- */

function notificationCopy(
  type: string,
  studentName?:
    string | null,
  etaMinutes?:
    number | null
) {
  const name =
    String(
      studentName ??
      ''
    ).trim();

  if (
    type ===
    'trip_started'
  ) {
    return {
      title:
        'بدأت رحلة الباص | Bus Trip Started',

      body:
        'بدأت رحلة الباص ويمكنكم متابعة موقعه مباشرة من التطبيق. | The school bus trip has started and can be tracked live.',
    };
  }

  if (
    type ===
    'trip_ended'
  ) {
    return {
      title:
        'انتهت رحلة الباص | Bus Trip Ended',

      body:
        'انتهت رحلة الباص الحالية. | The current school bus trip has ended.',
    };
  }

  if (
    type ===
    'eta_10'
  ) {
    return {
      title:
        'الباص يقترب | Bus Approaching',

      body:
        `الباص في طريقه إلى ${
          name ||
          'الطالب'
        }، الوقت المتوقع حوالي ${
          etaMinutes ??
          10
        } دقائق. | Bus ETA is about ${
          etaMinutes ??
          10
        } minutes.`,
    };
  }

  if (
    type ===
    'eta_5'
  ) {
    return {
      title:
        'الباص قريب جدًا | Bus Is Very Close',

      body:
        `الباص قريب من ${
          name ||
          'الطالب'
        }، يرجى الاستعداد. الوقت المتوقع ${
          etaMinutes ??
          5
        } دقائق. | The bus is very close. Please be ready.`,
    };
  }

  if (
    type ===
    'arrived'
  ) {
    return {
      title:
        'وصل الباص | Bus Arrived',

      body:
        `وصل الباص إلى موقع ${
          name ||
          'الطالب'
        }. | The bus arrived at the student stop.`,
    };
  }

  if (
    type ===
    'picked_up'
  ) {
    return {
      title:
        'تم صعود الطالب | Student Boarded',

      body:
        `تم صعود ${
          name ||
          'الطالب'
        } إلى الباص بأمان. | Student boarded safely.`,
    };
  }

  if (
    type ===
    'delivered'
  ) {
    return {
      title:
        'تم توصيل الطالب | Student Delivered',

      body:
        `تم توصيل ${
          name ||
          'الطالب'
        } بأمان. | Student was delivered safely.`,
    };
  }

  if (
    type ===
    'absent'
  ) {
    return {
      title:
        'تحديث حالة الطالب | Student Status Update',

      body:
        `تم تسجيل ${
          name ||
          'الطالب'
        } غائبًا عن رحلة الباص. | Student was marked absent for this bus trip.`,
    };
  }

  return {
    title:
      'تحديث رحلة الباص | Bus Trip Update',

    body:
      `${
        name ||
        'الطالب'
      } - ${type}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Targeted parent notification                                               */
/* -------------------------------------------------------------------------- */

export async function sendTargetedStudentNotification(
  context:
    DriverTripContext,
  args: {
    studentId:
      string;

    parentId?:
      string | null;

    type:
      string;

    studentName?:
      string | null;

    etaMinutes?:
      number | null;

    dedupe?:
      boolean;
  }
) {
  const {
    studentId,
    parentId,
    type,
    studentName,
    etaMinutes,
    dedupe = true,
  } = args;

  const dateKey =
    todayKey();

  if (dedupe) {
    let query =
      supabase
        .from(
          'bus_notifications'
        )
        .select(
          'id'
        )
        .eq(
          'student_id',
          studentId
        )
        .eq(
          'type',
          type
        )
        .eq(
          'date_key',
          dateKey
        )
        .limit(1);

    if (
      context.routeId
    ) {
      query =
        query.eq(
          'route_id',
          context.routeId
        );
    }

    /*
     * Same notification type may happen once in
     * morning and once in evening.
     */
    if (
      context.tripMode
    ) {
      query =
        query.contains(
          'data',
          {
            trip_mode:
              context.tripMode,
          }
        );
    }

    const {
      data,
      error,
    } =
      await query;

    if (error) {
      console.log(
        '[driverTrip] notification dedupe:',
        error
      );
    }

    if (
      data?.length
    ) {
      return data[0];
    }
  }

  const copy =
    notificationCopy(
      type,
      studentName,
      etaMinutes
    );

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'bus_notifications'
      )
      .insert({
        school_id:
          context.schoolId ??
          null,

        bus_id:
          context.busId,

        driver_id:
          context.driverId,

        student_id:
          studentId,

        parent_id:
          parentId ??
          null,

        route_id:
          context.routeId ??
          null,

        type,

        title:
          copy.title,

        body:
          copy.body,

        message:
          copy.body,

        data: {
          type,

          student_id:
            studentId,

          route_id:
            context.routeId ??
            null,

          bus_id:
            context.busId,

          driver_id:
            context.driverId,

          trip_mode:
            context.tripMode ??
            null,

          eta_minutes:
            etaMinutes ??
            null,
        },

        status:
          'created',

        date_key:
          dateKey,

        created_by:
          context.driverId,
      })
      .select('*')
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/* -------------------------------------------------------------------------- */
/* Trip started notifications                                                 */
/* -------------------------------------------------------------------------- */

export async function notifyTripStartedParents(
  context:
    DriverTripContext,
  students:
    DriverRouteStudent[]
) {
  await Promise.all(
    students
      .filter(
        (
          item
        ) =>
          !item.is_excluded
      )
      .map(
        (
          item
        ) =>
          sendTargetedStudentNotification(
            context,
            {
              studentId:
                item.student_id,

              parentId:
                item.parent_id,

              type:
                'trip_started',

              studentName:
                item.student
                  ?.full_name ??
                item.student
                  ?.name ??
                null,

              dedupe:
                true,
            }
          ).catch(
            (
              error
            ) => {
              console.log(
                '[driverTrip] trip-start notification:',
                error
              );

              return null;
            }
          )
      )
  );
}

/* -------------------------------------------------------------------------- */
/* Trip ended notifications                                                   */
/* -------------------------------------------------------------------------- */

export async function notifyTripEndedParents(
  context:
    DriverTripContext,
  students:
    DriverRouteStudent[]
) {
  await Promise.all(
    students.map(
      (
        item
      ) =>
        sendTargetedStudentNotification(
          context,
          {
            studentId:
              item.student_id,

            parentId:
              item.parent_id,

            type:
              'trip_ended',

            studentName:
              item.student
                ?.full_name ??
              item.student
                ?.name ??
              null,

            dedupe:
              true,
          }
        ).catch(
          (
            error
          ) => {
            console.log(
              '[driverTrip] trip-end notification:',
              error
            );

            return null;
          }
        )
    )
  );
}

/* -------------------------------------------------------------------------- */
/* ETA notification                                                           */
/* -------------------------------------------------------------------------- */

export async function notifyStudentEta(
  context:
    DriverTripContext,
  item:
    DriverRouteStudent,
  etaMinutes:
    number
) {
  if (
    item.is_excluded
  ) {
    return null;
  }

  const minutes =
    Math.max(
      1,
      Math.round(
        etaMinutes
      )
    );

  const type =
    minutes <= 5
      ? 'eta_5'
      : minutes <= 10
      ? 'eta_10'
      : null;

  if (!type) {
    return null;
  }

  return sendTargetedStudentNotification(
    context,
    {
      studentId:
        item.student_id,

      parentId:
        item.parent_id,

      type,

      studentName:
        item.student
          ?.full_name ??
        item.student
          ?.name ??
        null,

      etaMinutes:
        minutes,

      dedupe:
        true,
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Student status                                                             */
/* -------------------------------------------------------------------------- */

export async function setDriverStudentStatus(
  context:
    DriverTripContext,
  args: {
    studentId:
      string;

    status:
      DriverStudentStatus;

    busNumber?:
      string | null;

    studentName?:
      string | null;

    parentId?:
      string | null;
  }
) {
  const {
    studentId,
    status,
    busNumber,
    studentName,
    parentId,
  } = args;

  /*
   * Canonical states:
   *
   * arrived
   * boarded
   * absent
   * delivered
   */

  const {
    data:
      attendance,
    error,
  } =
    await supabase
      .from(
        'bus_attendance'
      )
      .insert({
        student_id:
          studentId,

        driver_id:
          context.driverId,

        bus_id:
          context.busId,

        bus_number:
          busNumber ??
          null,

        status,
      })
      .select('*')
      .single();

  if (error) {
    console.log(
      '[driverTrip] attendance status error:',
      {
        code:
          error.code,

        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint,

        requestedStatus:
          status,
      }
    );

    throw error;
  }

  const notificationType =
    status ===
      'boarded'
      ? 'picked_up'
      : status;

  try {
    await sendTargetedStudentNotification(
      context,
      {
        studentId,

        parentId,

        type:
          notificationType,

        studentName,

        dedupe:
          false,
      }
    );
  } catch (
    notificationError
  ) {
    /*
     * Attendance must remain saved even if
     * push/in-app notification fails.
     */
    console.log(
      '[driverTrip] attendance saved; notification failed:',
      notificationError
    );
  }

  return attendance;
}

/* -------------------------------------------------------------------------- */
/* Trip completion helpers                                                    */
/* -------------------------------------------------------------------------- */

export function isMorningStudentComplete(
  item:
    DriverRouteStudent
) {
  if (
    item.is_excluded
  ) {
    return true;
  }

  const status =
    normalize(
      item.latest_status
    );

  return [
    'boarded',
    'delivered',
    'absent',
  ].includes(
    status
  );
}

export function isEveningStudentComplete(
  item:
    DriverRouteStudent
) {
  if (
    item.is_excluded
  ) {
    return true;
  }

  const status =
    normalize(
      item.latest_status
    );

  return [
    'delivered',
    'absent',
  ].includes(
    status
  );
}

export function areTripStudentsComplete(
  students:
    DriverRouteStudent[],
  tripMode:
    DriverTripMode
) {
  if (
    !students.length
  ) {
    return false;
  }

  if (
    tripMode ===
    'to_home'
  ) {
    return students.every(
      isEveningStudentComplete
    );
  }

  return students.every(
    isMorningStudentComplete
  );
}

/* -------------------------------------------------------------------------- */
/* Incident                                                                   */
/* -------------------------------------------------------------------------- */

export async function createDriverIncident(
  context: DriverTripContext,
  args: {
    title: string;
    details?: string | null;
    severity?:
      | 'low'
      | 'medium'
      | 'high'
      | 'critical';
  }
) {
  const schoolId =
    String(
      context.schoolId ?? ''
    ).trim();

  const driverId =
    String(
      context.driverId ?? ''
    ).trim();

  const busId =
    String(
      context.busId ?? ''
    ).trim();

  const title =
    String(
      args.title ?? ''
    ).trim();

  if (!schoolId) {
    throw new Error(
      'Missing school id for incident.'
    );
  }

  if (!driverId) {
    throw new Error(
      'Missing driver id for incident.'
    );
  }

  if (!busId) {
    throw new Error(
      'Missing bus id for incident.'
    );
  }

  if (!title) {
    throw new Error(
      'Missing incident title.'
    );
  }

  return createSecureDriverIncident({
    schoolId,
    busId,
    driverId,
    title,

    details:
      args.details?.trim() ||
      null,

    severity:
      args.severity ??
      'medium',

    happenedAt:
      new Date().toISOString(),
  });
}
