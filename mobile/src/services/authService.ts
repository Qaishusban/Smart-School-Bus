import { supabase } from '../lib/supabase';

import {
  AppRole,
  AppUser,
  PinLoginResponse,
  PinRole,
} from '../types/auth';

import {
  checkSchoolAccess,
  schoolAccessErrorCode,
} from './schoolAccessService';

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null;
}

function normalizePinUser(
  role: PinRole,
  data: Record<string, unknown>
): AppUser {
  const id = String(data.id ?? '');

  const parentId = stringOrNull(data.parent_id);
  const teacherId = stringOrNull(data.teacher_id);
  const driverId = stringOrNull(data.driver_id);

  return {
    id,
    role,
    full_name: stringOrNull(data.full_name),
    name: stringOrNull(data.name),
    username: stringOrNull(data.username),
    email: stringOrNull(data.email),
    phone: stringOrNull(data.phone),
    school_id: stringOrNull(data.school_id),
    route_id: stringOrNull(data.route_id),
    bus_id: stringOrNull(data.bus_id),
    bus_number: stringOrNull(data.bus_number),
    student_id: stringOrNull(data.student_id),

    parent_id:
      role === 'parent'
        ? parentId ?? id
        : parentId,

    teacher_id:
      role === 'teacher'
        ? teacherId ?? id
        : teacherId,

    driver_id:
      role === 'driver'
        ? driverId ?? id
        : driverId,

    is_active:
      typeof data.is_active === 'boolean'
        ? data.is_active
        : null,

    can_login:
      typeof data.can_login === 'boolean'
        ? data.can_login
        : null,

    raw: data,
  };
}

export async function loginWithPin(
  role: PinRole,
  username: string,
  pin: string
): Promise<{
  token: string;
  user: AppUser;
}> {
  const cleanUsername = username.trim();
  const cleanPin = pin.trim();

  if (!cleanUsername || !cleanPin) {
    throw new Error('Please enter username and PIN.');
  }

  const { data, error } = await supabase.rpc('pin_login', {
    p_role: role,
    p_username: cleanUsername,
    p_pin: cleanPin,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = data as PinLoginResponse;

  if (!result?.ok) {
    if (result?.error === 'wrong_username_or_pin') {
      throw new Error('Incorrect username or PIN.');
    }

    if (result?.error === 'bad_role') {
      throw new Error('Invalid user role.');
    }

    throw new Error(result?.error ?? 'Login failed.');
  }

  if (!result.token || !result.user) {
    throw new Error('Invalid login response.');
  }

  const user = normalizePinUser(role, result.user);

  if (role === 'parent' && user.can_login === false) {
    throw new Error('This parent account is disabled.');
  }

  if (
    (role === 'teacher' || role === 'driver') &&
    user.is_active === false
  ) {
    throw new Error('This account is inactive.');
  }

  const access = await checkSchoolAccess(user);

  if (!access.allowed) {
    throw new Error(schoolAccessErrorCode(access));
  }

  return {
    token: result.token,
    user,
  };
}

export async function loginAdmin(
  email: string,
  password: string
): Promise<AppUser> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !password) {
    throw new Error('Please enter email and password.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  const authUser = data.user;

  if (!authUser) {
    throw new Error('Admin login failed.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'id, full_name, role, school_id, email, phone, job_title, is_active'
    )
    .eq('id', authUser.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    await supabase.auth.signOut();
    throw new Error('User profile was not found.');
  }

  const role = profile.role as AppRole;

  if (!['admin', 'school_admin', 'super_admin'].includes(role)) {
    await supabase.auth.signOut();
    throw new Error(
      'This account does not have administrator access.'
    );
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut();
    throw new Error('This administrator account is inactive.');
  }

  const user: AppUser = {
    id: profile.id,
    role,
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    job_title: profile.job_title,
    school_id: profile.school_id,
    is_active: profile.is_active,
    raw: {
      ...profile,
      auth_user_id: authUser.id,
    },
  };

  const access = await checkSchoolAccess(user);

  if (!access.allowed) {
    await supabase.auth.signOut();
    throw new Error(schoolAccessErrorCode(access));
  }

  return user;
}

export async function logoutAdmin() {
  await supabase.auth.signOut();
}
