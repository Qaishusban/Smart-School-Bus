import { supabase } from '../lib/supabase';

export type AnyRow = Record<string, any>;

export type ParentRequestType =
  | 'absence'
  | 'no_bus'
  | 'pickup_change'
  | 'dropoff_change'
  | 'transport'
  | 'delay'
  | 'bus_issue'
  | 'school_request'
  | 'complaint'
  | 'other';

export type ParentRequestPeriod =
  | 'both'
  | 'morning'
  | 'afternoon';

export type ParentRequestPayload = {
  schoolId: string;
  parentId: string;
  studentId: string;

  requestType: ParentRequestType;

  dateFrom: string;
  dateTo: string;

  tripPeriod: ParentRequestPeriod;

  notes?: string | null;

  routeId?: string | null;
  busId?: string | null;
  teacherId?: string | null;
  driverId?: string | null;
};

export type ParentRequestUpdatePayload = {
  requestId: string;
  parentId: string;

  requestType: ParentRequestType;

  dateFrom: string;
  dateTo: string;

  tripPeriod: ParentRequestPeriod;

  notes?: string | null;
};

export type DailyInstructionPayload = {
  parentId: string;
  studentId: string;
  busId?: string | null;
  date: string;
  status: string;
  note?: string | null;
  notifyDriver?: boolean;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function canEditParentRequest(
  request?: AnyRow | null
) {
  if (!request?.id || !request?.created_at) {
    return false;
  }

  const status = String(
    request.status ?? 'pending'
  )
    .trim()
    .toLowerCase();

  if (
    request.approved_at ||
    ['approved', 'completed', 'rejected'].includes(status)
  ) {
    return false;
  }

  const createdAt = new Date(request.created_at).getTime();

  if (Number.isNaN(createdAt)) {
    return false;
  }

  return Date.now() < createdAt + 24 * 60 * 60 * 1000;
}

export function parentRequestEditRemainingMs(
  request?: AnyRow | null
) {
  if (!canEditParentRequest(request)) {
    return 0;
  }

  const createdAt = new Date(
    request!.created_at
  ).getTime();

  return Math.max(
    0,
    createdAt +
      24 * 60 * 60 * 1000 -
      Date.now()
  );
}

export function isAbsenceRequest(
  request?: AnyRow | null
) {
  const type = String(
    request?.request_type ??
      request?.type ??
      ''
  )
    .trim()
    .toLowerCase();

  return [
    'absence',
    'absent',
    'excused',
    'no_bus',
    'not_riding',
  ].includes(type);
}

/* -------------------------------------------------------------------------- */
/* Load                                                                       */
/* -------------------------------------------------------------------------- */

export async function getParentRequests(
  parentId: string
): Promise<AnyRow[]> {
  if (!parentId) {
    return [];
  }

  const { data, error } = await supabase
    .from('parent_requests')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    console.log(
      '[parent_requests] load error:',
      error
    );

    throw error;
  }

  return data ?? [];
}

/* -------------------------------------------------------------------------- */
/* Resolve route/bus/teacher/driver                                           */
/* -------------------------------------------------------------------------- */

async function resolveRequestTransportContext(
  studentId: string
) {
  let routeId: string | null = null;
  let busId: string | null = null;
  let teacherId: string | null = null;
  let driverId: string | null = null;

  const { data: links, error: linkError } =
    await supabase
      .from('route_students')
      .select('*')
      .eq('student_id', studentId)
      .limit(10);

  if (linkError) {
    console.log(
      '[parent_requests] route student:',
      linkError.message
    );
  }

  const link =
    (links ?? []).find(
      (row: AnyRow) =>
        row.is_active !== false
    ) ??
    links?.[0] ??
    null;

  if (!link?.route_id) {
    return {
      routeId,
      busId,
      teacherId,
      driverId,
    };
  }

  routeId = String(link.route_id);

  const { data: routeRows, error: routeError } =
    await supabase
      .from('routes')
      .select('*')
      .eq('id', routeId)
      .limit(1);

  if (routeError) {
    console.log(
      '[parent_requests] route:',
      routeError.message
    );
  }

  const route = routeRows?.[0] ?? null;

  if (!route) {
    return {
      routeId,
      busId,
      teacherId,
      driverId,
    };
  }

  busId =
    route.bus_id
      ? String(route.bus_id)
      : null;

  teacherId =
    route.teacher_id ??
    route.routes_teacher_fk ??
    null;

  if (teacherId) {
    teacherId = String(teacherId);
  }

  if (busId) {
    const { data: busRows, error: busError } =
      await supabase
        .from('buses')
        .select('*')
        .eq('id', busId)
        .limit(1);

    if (busError) {
      console.log(
        '[parent_requests] bus:',
        busError.message
      );
    }

    const bus = busRows?.[0] ?? null;

    driverId =
      bus?.driver_profile_id ??
      bus?.main_driver_id ??
      null;

    if (driverId) {
      driverId = String(driverId);
    }
  }

  return {
    routeId,
    busId,
    teacherId,
    driverId,
  };
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

async function createRequestNotifications(args: {
  request: AnyRow;
  schoolId: string;
  parentId: string;
  studentId: string;

  routeId?: string | null;
  busId?: string | null;
  teacherId?: string | null;
  driverId?: string | null;

  isUpdate?: boolean;
}) {
  const request = args.request;

  const dateFrom =
    request.date_from ??
    request.request_date;

  const dateTo =
    request.date_to ??
    request.request_date;

  const data = {
    source: 'parent_request',
    request_id: request.id,
    request_type: request.request_type,
    date_from: dateFrom,
    date_to: dateTo,
    trip_period:
      request.trip_period ?? 'both',
    status: request.status ?? 'pending',
    is_update: args.isUpdate === true,
  };

  const title =
    args.isUpdate
      ? 'تم تعديل طلب ولي أمر'
      : 'طلب جديد من ولي أمر';

  const body =
    dateFrom === dateTo
      ? `طلب للطالب بتاريخ ${dateFrom}`
      : `طلب للطالب من ${dateFrom} إلى ${dateTo}`;

  const common = {
    school_id: args.schoolId,
    bus_id: args.busId ?? null,
    student_id: args.studentId,
    parent_id: args.parentId,
    route_id: args.routeId ?? null,

    type: args.isUpdate
      ? 'parent_request_updated'
      : 'parent_request',

    title,
    body,
    message: request.notes ?? body,

    data,

    status: 'pending',
    date_key: dateFrom,

    created_by: args.parentId,
    is_read: false,
  };

  const notifications: AnyRow[] = [];

  /*
   * إشعار المدرسة.
   * بدون teacher_id / driver_id حتى يكون إشعار مدرسة عام.
   */
  notifications.push({
    ...common,
    teacher_id: null,
    driver_id: null,
  });

  if (args.teacherId) {
    notifications.push({
      ...common,
      teacher_id: args.teacherId,
      driver_id: null,
    });
  }

  if (args.driverId) {
    notifications.push({
      ...common,
      teacher_id: null,
      driver_id: args.driverId,
    });
  }

  const { error } = await supabase
    .from('bus_notifications')
    .insert(notifications);

  if (error) {
    /*
     * لا نفشل إنشاء طلب ولي الأمر بسبب مشكلة إشعار.
     * الطلب أهم، والإشعار نستطيع معالجته منفصلاً.
     */
    console.log(
      '[parent_requests] notification insert:',
      error.message
    );
  }

  await supabase
    .from('parent_requests')
    .update({
      last_notified_at:
        new Date().toISOString(),
    })
    .eq('id', request.id);
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createParentRequest(
  payload: ParentRequestPayload
) {
  if (!payload.dateFrom || !payload.dateTo) {
    throw new Error('date_required');
  }

  if (payload.dateTo < payload.dateFrom) {
    throw new Error('invalid_date_range');
  }

  const context =
    await resolveRequestTransportContext(
      payload.studentId
    );

  const routeId =
    payload.routeId ??
    context.routeId ??
    null;

  const busId =
    payload.busId ??
    context.busId ??
    null;

  const teacherId =
    payload.teacherId ??
    context.teacherId ??
    null;

  const driverId =
    payload.driverId ??
    context.driverId ??
    null;

  const notes =
    payload.notes?.trim() || null;

  const { data, error } = await supabase
    .from('parent_requests')
    .insert({
      school_id: payload.schoolId,
      parent_id: payload.parentId,
      student_id: payload.studentId,

      /*
       * request_date يبقى موجودًا للتوافق
       * مع الخدمات القديمة.
       */
      request_date: payload.dateFrom,

      request_type: payload.requestType,

      date_from: payload.dateFrom,
      date_to: payload.dateTo,

      trip_period:
        payload.tripPeriod,

      route_id: routeId,
      bus_id: busId,
      teacher_id: teacherId,
      driver_id: driverId,

      status: 'pending',
      notes,
    })
    .select('*')
    .single();

  if (error) {
    console.log(
      '[parent_requests] insert error:',
      error
    );

    throw error;
  }

  await createRequestNotifications({
    request: data,

    schoolId:
      payload.schoolId,

    parentId:
      payload.parentId,

    studentId:
      payload.studentId,

    routeId,
    busId,
    teacherId,
    driverId,

    isUpdate: false,
  });

  return data;
}

/* -------------------------------------------------------------------------- */
/* Update within 24 hours                                                     */
/* -------------------------------------------------------------------------- */

export async function updateParentRequest(
  payload: ParentRequestUpdatePayload
) {
  if (!payload.dateFrom || !payload.dateTo) {
    throw new Error('date_required');
  }

  if (payload.dateTo < payload.dateFrom) {
    throw new Error('invalid_date_range');
  }

  const { data, error } =
    await supabase.rpc(
      'parent_update_request_24h',
      {
        p_request_id:
          payload.requestId,

        p_parent_id:
          payload.parentId,

        p_request_type:
          payload.requestType,

        p_date_from:
          payload.dateFrom,

        p_date_to:
          payload.dateTo,

        p_trip_period:
          payload.tripPeriod,

        p_notes:
          payload.notes?.trim() ??
          '',
      }
    );

  if (error) {
    console.log(
      '[parent_requests] update RPC:',
      error
    );

    throw error;
  }

  const request =
    Array.isArray(data)
      ? data[0]
      : data;

  if (!request) {
    throw new Error(
      'request_update_failed'
    );
  }

  await createRequestNotifications({
    request,

    schoolId:
      String(request.school_id),

    parentId:
      payload.parentId,

    studentId:
      String(request.student_id),

    routeId:
      request.route_id ?? null,

    busId:
      request.bus_id ?? null,

    teacherId:
      request.teacher_id ?? null,

    driverId:
      request.driver_id ?? null,

    isUpdate: true,
  });

  return request;
}

/* -------------------------------------------------------------------------- */
/* Active absence / bus exemption                                             */
/* -------------------------------------------------------------------------- */

export async function getActiveParentAbsences(args: {
  studentIds: string[];
  date: string;
  period?: ParentRequestPeriod;
}) {
  if (!args.studentIds.length) {
    return [];
  }

  let query = supabase
    .from('parent_requests')
    .select('*')
    .in('student_id', args.studentIds)
    .in('request_type', [
      'absence',
      'no_bus',
    ])
    .lte('date_from', args.date)
    .gte('date_to', args.date)
    .eq('status', 'approved');

  if (
    args.period &&
    args.period !== 'both'
  ) {
    query = query.in(
      'trip_period',
      ['both', args.period]
    );
  }

  const { data, error } =
    await query.order(
      'created_at',
      {
        ascending: false,
      }
    );

  if (error) {
    console.log(
      '[parent_requests] active absence:',
      error
    );

    throw error;
  }

  return data ?? [];
}

/* -------------------------------------------------------------------------- */
/* Daily Instructions - existing compatibility                                */
/* -------------------------------------------------------------------------- */

export async function getParentDailyInstructions(
  parentId: string
): Promise<AnyRow[]> {
  if (!parentId) {
    return [];
  }

  const { data, error } = await supabase
    .from('parent_daily_instructions')
    .select('*')
    .eq('parent_id', parentId)
    .order('instruction_date', {
      ascending: false,
    })
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    console.log(
      '[daily_instructions] load error:',
      error
    );

    throw error;
  }

  return data ?? [];
}

export async function saveDailyInstruction(
  payload: DailyInstructionPayload
) {
  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from('parent_daily_instructions')
    .select('id')
    .eq('parent_id', payload.parentId)
    .eq('student_id', payload.studentId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.log(
      '[daily_instructions] existing lookup:',
      existingError
    );

    throw existingError;
  }

  const row = {
    parent_id:
      payload.parentId,

    student_id:
      payload.studentId,

    bus_id:
      payload.busId ?? null,

    for_date:
      payload.date,

    instruction_date:
      payload.date,

    status:
      payload.status,

    note:
      payload.note?.trim() ||
      null,

    notify_driver:
      payload.notifyDriver !==
      false,

    is_seen_by_driver: false,
    is_seen_by_school: false,
  };

  if (existing?.id) {
    const { data, error } =
      await supabase
        .from(
          'parent_daily_instructions'
        )
        .update(row)
        .eq('id', existing.id)
        .select('*')
        .single();

    if (error) {
      console.log(
        '[daily_instructions] update error:',
        error
      );

      throw error;
    }

    return data;
  }

  const { data, error } =
    await supabase
      .from(
        'parent_daily_instructions'
      )
      .insert(row)
      .select('*')
      .single();

  if (error) {
    console.log(
      '[daily_instructions] insert error:',
      error
    );

    throw error;
  }

  return data;
}