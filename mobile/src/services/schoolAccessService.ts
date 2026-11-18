import { supabase } from '../lib/supabase';
import { AppRole, AppUser } from '../types/auth';

export type SchoolAccessReason =
  | 'allowed'
  | 'school_inactive'
  | 'subscription_missing'
  | 'subscription_inactive'
  | 'subscription_not_started'
  | 'subscription_expired'
  | 'trial_expired'
  | 'payment_required'
  | 'account_inactive'
  | 'school_missing'
  | 'check_failed';

export type SchoolAccessDecision = {
  allowed: boolean;
  reason: SchoolAccessReason;
  schoolId: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
};

type Row = Record<string, any>;

export async function checkSchoolAccess(
  user: AppUser
): Promise<SchoolAccessDecision> {
  if (user.is_active === false || user.can_login === false) {
    return {
      allowed: false,
      reason: 'account_inactive',
      schoolId: user.school_id ?? null,
    };
  }

  // System super admins are not tied to one school's subscription.
  if (user.role === 'super_admin' && !user.school_id) {
    return {
      allowed: true,
      reason: 'allowed',
      schoolId: null,
    };
  }

  const schoolId = user.school_id;

  if (!schoolId) {
    return {
      allowed: false,
      reason: 'school_missing',
      schoolId: null,
    };
  }

  /*
   * Security boundary:
   * The mobile client never reads school_subscriptions directly.
   * The SECURITY DEFINER RPC returns only the access decision and the
   * minimum subscription metadata needed by the access layer.
   */
  const { data, error } = await supabase.rpc('check_school_access', {
    p_school_id: schoolId,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error('School access check returned no result.');
  }

  const reason = String(row.reason ?? 'check_failed') as SchoolAccessReason;

  return {
    allowed: row.allowed === true,
    reason,
    schoolId,
    subscriptionStatus:
      typeof row.subscription_status === 'string'
        ? row.subscription_status
        : null,
  };
}

export function schoolAccessErrorCode(
  decision: SchoolAccessDecision
) {
  return `SCHOOL_ACCESS:${decision.reason}`;
}

export function isSchoolAccessError(value: unknown) {
  return String((value as any)?.message ?? value ?? '').includes(
    'SCHOOL_ACCESS:'
  );
}

export function schoolAccessMessage(
  role: AppRole,
  reason: SchoolAccessReason,
  isRTL: boolean
) {
  const isSchoolAdmin =
    role === 'admin' || role === 'school_admin';

  if (!isSchoolAdmin) {
    return isRTL
      ? 'خدمة المدرسة غير متاحة حالياً. يرجى التواصل مع إدارة المدرسة.'
      : 'The school service is currently unavailable. Please contact the school administration.';
  }

  if (reason === 'payment_required') {
    return isRTL
      ? 'تم إيقاف الخدمة لوجود دفعة مستحقة. يرجى التواصل مع إدارة النظام لتسوية المبلغ المستحق.'
      : 'Service is suspended due to an outstanding payment. Please contact system administration to settle the outstanding amount.';
  }

  if (
    reason === 'subscription_expired' ||
    reason === 'trial_expired'
  ) {
    return isRTL
      ? 'انتهى اشتراك المدرسة. يرجى التواصل مع إدارة النظام لتجديد الاشتراك.'
      : 'The school subscription has expired. Please contact system administration to renew the subscription.';
  }

  if (reason === 'subscription_not_started') {
    return isRTL
      ? 'اشتراك المدرسة غير ساري حالياً. يرجى التواصل مع إدارة النظام.'
      : 'The school subscription is not currently active. Please contact system administration.';
  }

  if (
    reason === 'subscription_missing' ||
    reason === 'subscription_inactive'
  ) {
    return isRTL
      ? 'اشتراك المدرسة غير فعال. يرجى التواصل مع إدارة النظام.'
      : 'The school subscription is inactive. Please contact system administration.';
  }

  if (reason === 'school_inactive') {
    return isRTL
      ? 'المدرسة غير فعالة حالياً. يرجى التواصل مع إدارة النظام.'
      : 'The school is currently inactive. Please contact system administration.';
  }

  if (reason === 'account_inactive') {
    return isRTL
      ? 'هذا الحساب موقوف. يرجى التواصل مع إدارة النظام.'
      : 'This account is disabled. Please contact system administration.';
  }

  return isRTL
    ? 'تعذر استخدام الخدمة حالياً. يرجى التواصل مع إدارة النظام.'
    : 'The service is currently unavailable. Please contact system administration.';
}

export function subscribeToSchoolAccess(
  schoolId: string,
  onChanged: () => void
) {
  const safeId = String(schoolId).replace(/[^a-zA-Z0-9_-]/g, '_');

  const channel = supabase
    .channel(`school-access-${safeId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'schools',
        filter: `id=eq.${schoolId}`,
      },
      () => onChanged()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'school_subscriptions',
        filter: `school_id=eq.${schoolId}`,
      },
      () => onChanged()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
