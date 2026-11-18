import { supabase } from '../lib/supabase';

export type ParentDashboardStudent = Record<string, any>;
export type ParentDashboardRoute = Record<string, any>;
export type ParentDashboardParent = Record<string, any>;

export interface ParentDashboardData {
  parent: ParentDashboardParent | null;
  students: ParentDashboardStudent[];
  routes: ParentDashboardRoute[];
}

interface ParentDashboardRpcResponse {
  ok?: boolean;
  error?: string;
  parent?: ParentDashboardParent | null;
  students?: ParentDashboardStudent[];
  routes?: ParentDashboardRoute[];
}

export async function getParentDashboard(
  token: string
): Promise<ParentDashboardData> {
  if (!token) {
    throw new Error('session_invalid');
  }

  const { data, error } = await supabase.rpc('parent_dashboard', {
    p_token: token,
  });

  if (error) {
    console.log('parent_dashboard RPC error:', error);
    throw new Error(error.message);
  }

  const result = data as ParentDashboardRpcResponse | null;

  if (!result?.ok) {
    throw new Error(result?.error || 'parent_dashboard_failed');
  }

  return {
    parent: result.parent ?? null,
    students: Array.isArray(result.students)
      ? result.students
      : [],
    routes: Array.isArray(result.routes)
      ? result.routes
      : [],
  };
}
