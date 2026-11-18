import { supabase } from '../lib/supabase';

export async function getStudentDailyStatus(studentId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('student_daily_status')
    .select('*')
    .eq('student_id', studentId)
    .eq('date', today)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
