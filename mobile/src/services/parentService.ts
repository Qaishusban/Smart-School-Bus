import { supabase } from '../lib/supabase';

export async function getParentDashboard(token: string) {
  const { data, error } = await supabase.rpc('parent_dashboard', {
    p_token: token,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function getParentStudents(parentId: string) {
  const { data, error } = await supabase
    .from('parent_students')
    .select(`
      id,
      parent_id,
      student_id,
      academic_year_id,
      students (
  id,
  full_name,
  name,
  grade_name,
  grade,
  section_name,
  section,
  photo_url,
  avatar_url,
  home_lat,
  home_lng,
  route_id,
  bus_id,
  school_id,
  teacher_id
)
    `)
    .eq('parent_id', parentId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getParentNotifications(parentId: string) {
  const { data, error } = await supabase
    .from('bus_notifications')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getSchoolBroadcasts(schoolId: string) {
  const { data, error } = await supabase
    .from('school_broadcasts')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getLatestAttendance(studentId: string) {
  const { data, error } = await supabase
    .from('latest_bus_attendance_per_student')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
