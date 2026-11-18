import { supabase } from '../lib/supabase';


export type ParentRequestDecision = 'approved' | 'rejected';
export type ParentRequestDecisionActor = 'teacher' | 'school_admin';
export type AnyRow = Record<string, any>;

export type DecideParentRequestArgs = {
  requestId: string;
  schoolId: string;
  decision: ParentRequestDecision;
  actor: ParentRequestDecisionActor;
  actorId?: string | null;
};

/**
 * First decision wins.
 * The UPDATE is conditional on status=pending, so simultaneous teacher/admin
 * decisions cannot overwrite one another.
 */
export async function decideParentRequest(
  args: DecideParentRequestArgs
): Promise<AnyRow> {
  if (!args.requestId || !args.schoolId) {
    throw new Error('missing_request_context');
  }

  const { data, error } = await supabase
    .from('parent_requests')
    .update({ status: args.decision })
    .eq('id', args.requestId)
    .eq('school_id', args.schoolId)
    .eq('status', 'pending')
    .select('*');

  if (error) {
    console.log('[parent-request-decision] update:', error);
    throw error;
  }

  const decided = (data ?? [])[0] as AnyRow | undefined;

  if (!decided) {
    const { data: current, error: currentError } = await supabase
      .from('parent_requests')
      .select('*')
      .eq('id', args.requestId)
      .eq('school_id', args.schoolId)
      .maybeSingle();

    if (currentError) throw currentError;

    const err = new Error('request_already_decided') as Error & {
      current?: AnyRow | null;
    };
    err.current = current ?? null;
    throw err;
  }

  // Update the already-created school/teacher/driver notification copies.
  // No new driver approval action is created: the driver only sees the result.
  const approved = args.decision === 'approved';
  const title = approved
    ? 'تمت الموافقة على طلب ولي الأمر'
    : 'تم رفض طلب ولي الأمر';
  const body = approved
    ? 'تم اعتماد الطلب ويمكن تنفيذ التعليمات المرتبطة به.'
    : 'تم رفض الطلب ولا يتم تنفيذ التعليمات المرتبطة به.';

  const nextPayload = {
    source: 'parent_request',
    request_id: decided.id,
    request_type: decided.request_type ?? null,
    date_from: decided.date_from ?? decided.request_date ?? null,
    date_to: decided.date_to ?? decided.request_date ?? null,
    trip_period: decided.trip_period ?? 'both',
    status: args.decision,
    decision_actor: args.actor,
    decision_actor_id: args.actorId ?? null,
  };

  const { error: notificationError } = await supabase
    .from('bus_notifications')
    .update({
      title,
      body,
      message: decided.notes ?? body,
      data: nextPayload,
    })
    .eq('school_id', args.schoolId)
    .contains('data', { request_id: args.requestId });

  if (notificationError) {
    // The request decision is already final. Notification refresh must not
    // roll back or duplicate the decision.
    console.log(
      '[parent-request-decision] notification refresh:',
      notificationError.message
    );
  }

  return decided;
}

export async function getParentRequestById(
  requestId: string,
  schoolId?: string | null
): Promise<AnyRow | null> {
  if (!requestId) return null;

  let query = supabase
    .from('parent_requests')
    .select('*')
    .eq('id', requestId);

  if (schoolId) query = query.eq('school_id', schoolId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export function parentRequestIdFromNotification(
  notification?: AnyRow | null
): string | null {
  if (!notification) return null;

  const data =
    notification.data && typeof notification.data === 'object'
      ? notification.data
      : {};

  const raw =
    data.request_id ??
    data.source_id ??
    (String(notification.id ?? '').startsWith('parent_request:')
      ? String(notification.id).slice('parent_request:'.length)
      : null);

  return raw ? String(raw) : null;
}

export function isPendingParentRequest(request?: AnyRow | null) {
  return String(request?.status ?? '').trim().toLowerCase() === 'pending';
}
