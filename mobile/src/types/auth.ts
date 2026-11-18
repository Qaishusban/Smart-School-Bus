export type AppRole =
  | 'parent'
  | 'teacher'
  | 'driver'
  | 'admin'
  | 'school_admin'
  | 'super_admin';

export type PinRole =
  | 'parent'
  | 'teacher'
  | 'driver';

export type AppUser = {
  id: string;
  role: AppRole;

  school_id?: string | null;

  full_name?: string | null;
  name?: string | null;

  username?: string | null;
  email?: string | null;
  phone?: string | null;

  job_title?: string | null;

  is_active?: boolean | null;
  can_login?: boolean | null;

  parent_id?: string | null;
  teacher_id?: string | null;
  driver_id?: string | null;

  student_id?: string | null;

  bus_id?: string | null;
  bus_number?: string | null;

  route_id?: string | null;

  [key: string]: unknown;
};

export type PinLoginResponse = {
  ok: boolean;
  error?: string | null;
  token?: string | null;
  user?: AppUser | null;
};

export type PinLoginResult = PinLoginResponse;

export type StoredPinSession = {
  kind: 'pin';
  token: string | null;
  user: AppUser;
  remember: boolean;
};

export type StoredAdminSession = {
  kind: 'admin';
  user: AppUser;
  remember: boolean;
};

export type StoredSession =
  | StoredPinSession
  | StoredAdminSession;