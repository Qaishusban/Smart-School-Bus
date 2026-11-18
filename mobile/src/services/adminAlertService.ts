import { supabase } from '../lib/supabase';

export type SchoolAlertSettings = {
  id?: string;
  school_id: string;
  auto_enabled: boolean;
  birthdays_enabled: boolean;
  driver_license_enabled: boolean;
  bus_license_enabled: boolean;
  days_before: number;
  license_reminder_days: number[];
  birthday_send_time: string;
  license_send_time: string;
  birthday_message: string;
  send_push: boolean;
  updated_at?: string;
};

const DEFAULT_BIRTHDAY_MESSAGE =
  'كل عام وأنت بخير يا {student_name} 🎉 نتمنى لك عاماً سعيداً ومليئاً بالنجاح.';

function normalizeTime(value: unknown, fallback: string) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeReminderDays(value: unknown): number[] {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? '')
        .split(/[,;\s]+/)
        .filter(Boolean);

  const numbers = raw
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
    .map((item) => Math.max(0, Math.min(365, Math.round(item))));

  return Array.from(new Set(numbers)).sort((a, b) => b - a);
}

function normalizeSettings(
  row: Record<string, any>,
  schoolId: string
): SchoolAlertSettings {
  const reminderDays = normalizeReminderDays(
    row.license_reminder_days ?? [30, 14, 7, 3, 1, 0]
  );

  return {
    id: row.id ? String(row.id) : undefined,
    school_id: schoolId,
    auto_enabled: row.auto_enabled !== false,
    birthdays_enabled: row.birthdays_enabled !== false,
    driver_license_enabled: row.driver_license_enabled !== false,
    bus_license_enabled: row.bus_license_enabled !== false,
    days_before: Number(
      row.days_before ?? Math.max(...reminderDays, 14)
    ),
    license_reminder_days: reminderDays.length
      ? reminderDays
      : [30, 14, 7, 3, 1, 0],
    birthday_send_time: normalizeTime(row.birthday_send_time, '08:00'),
    license_send_time: normalizeTime(row.license_send_time, '08:00'),
    birthday_message:
      String(row.birthday_message ?? '').trim() || DEFAULT_BIRTHDAY_MESSAGE,
    send_push: row.send_push !== false,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function getSchoolAlertSettings(
  schoolId: string
): Promise<SchoolAlertSettings> {
  const { data, error } = await supabase
    .from('school_alert_settings')
    .select('*')
    .eq('school_id', schoolId)
    .limit(1);

  if (error) throw error;

  const row = (data ?? [])[0];
  if (row) return normalizeSettings(row, schoolId);

  const defaults = normalizeSettings({}, schoolId);

  const result = await supabase
    .from('school_alert_settings')
    .insert(defaults)
    .select('*')
    .limit(1);

  if (result.error) throw result.error;

  return normalizeSettings(
    (result.data ?? [])[0] ?? defaults,
    schoolId
  );
}

export async function saveSchoolAlertSettings(
  settings: SchoolAlertSettings
) {
  const reminderDays = normalizeReminderDays(settings.license_reminder_days);
  const normalizedDays = reminderDays.length
    ? reminderDays
    : [30, 14, 7, 3, 1, 0];

  const payload = {
    school_id: settings.school_id,
    auto_enabled: settings.auto_enabled,
    birthdays_enabled: settings.birthdays_enabled,
    driver_license_enabled: settings.driver_license_enabled,
    bus_license_enabled: settings.bus_license_enabled,
    days_before: Math.max(...normalizedDays, 0),
    license_reminder_days: normalizedDays,
    birthday_send_time: normalizeTime(settings.birthday_send_time, '08:00'),
    license_send_time: normalizeTime(settings.license_send_time, '08:00'),
    birthday_message:
      settings.birthday_message.trim() || DEFAULT_BIRTHDAY_MESSAGE,
    send_push: settings.send_push,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('school_alert_settings')
    .upsert(payload, { onConflict: 'school_id' })
    .select('*')
    .limit(1);

  if (error) throw error;

  return normalizeSettings(
    (data ?? [])[0] ?? payload,
    settings.school_id
  );
}

export async function generateSchoolAlerts(
  schoolId: string,
  force = false
) {
  const { data, error } = await supabase.rpc('generate_school_alerts', {
    p_school_id: schoolId,
    p_force: force,
  });

  if (error) throw error;

  const targeted = await supabase.rpc('dispatch_due_targeted_alerts_v9', {
    p_school_id: schoolId,
    p_force: force,
  });

  if (targeted.error) {
    console.log('Targeted alert push:', targeted.error);
  }

  return Number(data ?? 0) + Number(targeted.data ?? 0);
}

export async function listSchoolAlertEvents(
  schoolId: string,
  limit = 100
) {
  const { data, error } = await supabase
    .from('school_alert_events')
    .select('*')
    .eq('school_id', schoolId)
    .order('event_date', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function sendManualSchoolNotification(params: {
  schoolId: string;
  userId: string;
  targetRole: 'all' | 'parent' | 'driver' | 'teacher';
  title: string;
  body: string;
}) {
  const { schoolId, userId, targetRole, title, body } = params;

  const { data, error } = await supabase
    .from('school_broadcasts')
    .insert({
      school_id: schoolId,
      title,
      body,
      target_role: targetRole,
      category: 'manual_admin',
      created_by: userId,
    })
    .select('*')
    .limit(1);

  if (error) throw error;

  const broadcast = (data ?? [])[0] ?? null;

  // V8 push dispatcher sends directly to active Expo tokens through pg_net.
  // The existing school_broadcasts row is still kept so the app's current
  // internal notification flow remains compatible.
  if (broadcast?.id) {
    const pushResult = await supabase.rpc('push_school_broadcast_v8', {
      p_broadcast_id: broadcast.id,
    });

    if (pushResult.error) {
      throw pushResult.error;
    }
  }

  return broadcast;
}

export async function resolveLicenseAlert(params: {
  eventId: string;
  eventType: 'driver_license' | 'bus_license';
  entityId: string;
  newExpiryDate: string;
}) {
  const { data, error } = await supabase.rpc('resolve_school_license_alert', {
    p_event_id: params.eventId,
    p_event_type: params.eventType,
    p_entity_id: params.entityId,
    p_new_expiry_date: params.newExpiryDate,
  });

  if (error) throw error;
  return data;
}
