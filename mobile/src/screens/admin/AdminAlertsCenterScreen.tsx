import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../hooks/useAuth';
import { useResolvedSchoolId } from '../../hooks/useResolvedSchoolId';
import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { supabase } from '../../lib/supabase';
import AdminBrandHeader from '../../components/admin/AdminBrandHeader';
import AdminDateField from '../../components/admin/AdminDateField';
import AdminSelectionModal, { SelectionItem } from '../../components/admin/AdminSelectionModal';
import {
  generateSchoolAlerts,
  getSchoolAlertSettings,
  listSchoolAlertEvents,
  saveSchoolAlertSettings,
  SchoolAlertSettings,
  sendManualSchoolNotification,
  resolveLicenseAlert,
} from '../../services/adminAlertService';

type Row = Record<string, any>;

type TargetRole = 'all' | 'parent' | 'driver' | 'teacher';

function kindMeta(type: string, isRTL: boolean) {
  if (type === 'birthday') {
    return { icon: 'gift-outline' as const, color: '#8B5CF6', label: isRTL ? 'عيد ميلاد' : 'Birthday' };
  }
  if (type === 'driver_license') {
    return { icon: 'card-outline' as const, color: '#D97706', label: isRTL ? 'رخصة سائق' : 'Driver License' };
  }
  return { icon: 'bus-outline' as const, color: '#D94A4A', label: isRTL ? 'ترخيص باص' : 'Bus License' };
}


function parseReminderDays(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,;\s]+/)
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item))
        .map((item) => Math.max(0, Math.min(365, Math.round(item))))
    )
  ).sort((a, b) => b - a);
}

function normalizeTimeInput(value: string) {
  const digits = value.replace(/[^0-9:]/g, '').slice(0, 5);
  if (digits.length === 4 && !digits.includes(':')) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }
  return digits;
}

export default function AdminAlertsCenterScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();
  const { schoolId } = useResolvedSchoolId(user);

  const [school, setSchool] = useState<Row | null>(null);
  const [settings, setSettings] = useState<SchoolAlertSettings | null>(null);
  const [events, setEvents] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [targetPicker, setTargetPicker] = useState(false);
  const [targetRole, setTargetRole] = useState<TargetRole>('all');
  const [manualTitle, setManualTitle] = useState('');
  const [manualBody, setManualBody] = useState('');
  const [eventTab, setEventTab] = useState<'pending' | 'completed'>('pending');
  const [editEvent, setEditEvent] = useState<Row | null>(null);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [licenseDaysText, setLicenseDaysText] = useState('30,14,7,3,1,0');

  const load = useCallback(async (refresh = false) => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [schoolResult, currentSettings, currentEvents] = await Promise.all([
        supabase.from('schools').select('*').eq('id', schoolId).limit(1),
        getSchoolAlertSettings(schoolId),
        listSchoolAlertEvents(schoolId, 120),
      ]);
      if (schoolResult.error) throw schoolResult.error;
      setSchool((schoolResult.data ?? [])[0] ?? null);
      setSettings(currentSettings);
      setLicenseDaysText(currentSettings.license_reminder_days.join(','));
      setEvents(currentEvents as Row[]);

      if (currentSettings.auto_enabled) {
        try {
          await generateSchoolAlerts(schoolId, false);
          const refreshed = await listSchoolAlertEvents(schoolId, 120);
          setEvents(refreshed as Row[]);
        } catch (error) {
          console.log('Automatic alert generation:', error);
        }
      }
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر تحميل التنبيهات' : 'Unable to Load Alerts', error?.message ?? String(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [schoolId, isRTL]);

  useEffect(() => { void load(); }, [load]);

  const targetItems: SelectionItem[] = [
    { value: 'all', title: isRTL ? 'الجميع' : 'Everyone', subtitle: isRTL ? 'أولياء الأمور والسائقون والمشرفون' : 'Parents, drivers and supervisors', icon: 'people-outline' },
    { value: 'parent', title: isRTL ? 'أولياء الأمور' : 'Parents', icon: 'person-outline' },
    { value: 'driver', title: isRTL ? 'السائقون' : 'Drivers', icon: 'car-outline' },
    { value: 'teacher', title: isRTL ? 'المعلمون والمشرفون' : 'Teachers & Supervisors', icon: 'school-outline' },
  ];

  const counts = useMemo(() => ({
    birthdays: events.filter((row) => row.event_type === 'birthday').length,
    drivers: events.filter((row) => row.event_type === 'driver_license').length,
    buses: events.filter((row) => row.event_type === 'bus_license').length,
  }), [events]);

  async function saveSettings() {
    if (!settings) return;

    const reminderDays = parseReminderDays(licenseDaysText);
    if (!reminderDays.length) {
      Alert.alert(
        isRTL ? 'أيام التذكير مطلوبة' : 'Reminder Days Required',
        isRTL ? 'اكتب مثال: 30,14,7,3,1,0' : 'Enter values such as: 30,14,7,3,1,0'
      );
      return;
    }

    setSaving(true);
    try {
      const saved = await saveSchoolAlertSettings({
        ...settings,
        license_reminder_days: reminderDays,
      });
      setLicenseDaysText(saved.license_reminder_days.join(','));
      setSettings(saved);
      Alert.alert(isRTL ? 'تم الحفظ' : 'Saved', isRTL ? 'تم حفظ إعدادات التنبيهات.' : 'Alert settings were saved.');
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر الحفظ' : 'Save Failed', error?.message ?? String(error));
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    if (!schoolId) return;
    setRunning(true);
    try {
      const count = await generateSchoolAlerts(schoolId, true);
      const refreshed = await listSchoolAlertEvents(schoolId, 120);
      setEvents(refreshed as Row[]);
      Alert.alert(
        isRTL ? 'تم الفحص' : 'Check Complete',
        isRTL ? `تم إنشاء/تحديث ${count} تنبيه.` : `${count} alert(s) were generated or refreshed.`
      );
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر الفحص' : 'Check Failed', error?.message ?? String(error));
    } finally {
      setRunning(false);
    }
  }

  async function sendManual() {
    if (!schoolId || !user?.id || !manualTitle.trim() || !manualBody.trim()) {
      Alert.alert(isRTL ? 'بيانات ناقصة' : 'Missing Data', isRTL ? 'اكتب عنوان ومحتوى الإشعار.' : 'Enter a title and message.');
      return;
    }
    setSaving(true);
    try {
      await sendManualSchoolNotification({
        schoolId,
        userId: user.id,
        targetRole,
        title: manualTitle,
        body: manualBody,
      });
      setManualVisible(false);
      setManualTitle('');
      setManualBody('');
      Alert.alert(isRTL ? 'تم الإرسال' : 'Sent', isRTL ? 'تم تسجيل الإشعار وإرساله للجهة المحددة.' : 'The notification was queued for the selected audience.');
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر الإرسال' : 'Send Failed', error?.message ?? String(error));
    } finally {
      setSaving(false);
    }
  }

  async function completeLicenseAlert() {
    if (!editEvent || !newExpiryDate || !editEvent.entity_id) return;
    if (!['driver_license', 'bus_license'].includes(String(editEvent.event_type))) return;
    setSaving(true);
    try {
      await resolveLicenseAlert({ eventId: String(editEvent.id), eventType: String(editEvent.event_type) as 'driver_license' | 'bus_license', entityId: String(editEvent.entity_id), newExpiryDate });
      setEditEvent(null); setNewExpiryDate(''); await load(true);
      Alert.alert(isRTL ? 'تم الإنجاز' : 'Completed', isRTL ? 'تم تعديل تاريخ الانتهاء ونقل التنبيه إلى المنجزة.' : 'Expiry date updated and alert moved to completed.');
    } catch (error: any) { Alert.alert(isRTL ? 'تعذر التعديل' : 'Update Failed', error?.message ?? String(error)); }
    finally { setSaving(false); }
  }

  const visibleEvents = events.filter((row) => eventTab === 'completed' ? String(row.status ?? 'pending') === 'completed' : String(row.status ?? 'pending') !== 'completed');

  if (loading || !settings) {
    return <View style={[styles.loading, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" color="#F7B83A" /></View>;
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <AdminBrandHeader
        title={isRTL ? 'مركز التنبيهات' : 'Alert Center'}
        subtitle={isRTL ? 'أعياد الميلاد، الرخص، الإرسال اليدوي والتلقائي' : 'Birthdays, licenses, manual and automatic notifications'}
        schoolName={String(school?.name ?? (isRTL ? 'المدرسة' : 'School'))}
        schoolLogoUrl={school?.logo_url ?? null}
        onBack={() => navigation.goBack()}
        right={
          <Pressable onPress={() => setManualVisible(true)} style={styles.headerButton}>
            <Ionicons name="send-outline" size={20} color="#0A2D44" />
          </Pressable>
        }
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} tintColor="#F7B83A" onRefresh={() => void load(true)} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.summary, { flexDirection: direction }]}>
          <Stat icon="gift-outline" value={counts.birthdays} label={isRTL ? 'أعياد ميلاد' : 'Birthdays'} />
          <Stat icon="card-outline" value={counts.drivers} label={isRTL ? 'رخص سائقين' : 'Driver Licenses'} />
          <Stat icon="bus-outline" value={counts.buses} label={isRTL ? 'رخص باصات' : 'Bus Licenses'} />
        </View>

        <View style={[styles.settingsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, textAlign }]}>{isRTL ? 'إعدادات التنبيه التلقائي' : 'Automatic Alert Settings'}</Text>

          <Toggle label={isRTL ? 'التشغيل التلقائي' : 'Automatic generation'} icon="sparkles-outline" value={settings.auto_enabled} onChange={(value) => setSettings({ ...settings, auto_enabled: value })} />
          <Toggle label={isRTL ? 'تنبيهات أعياد الميلاد' : 'Birthday alerts'} icon="gift-outline" value={settings.birthdays_enabled} onChange={(value) => setSettings({ ...settings, birthdays_enabled: value })} />
          <Toggle label={isRTL ? 'انتهاء رخص السائقين' : 'Driver license expiry'} icon="card-outline" value={settings.driver_license_enabled} onChange={(value) => setSettings({ ...settings, driver_license_enabled: value })} />
          <Toggle label={isRTL ? 'انتهاء تراخيص الباصات' : 'Bus license expiry'} icon="bus-outline" value={settings.bus_license_enabled} onChange={(value) => setSettings({ ...settings, bus_license_enabled: value })} />
          <Toggle label={isRTL ? 'إرسال Push عند توفر البنية' : 'Send Push when available'} icon="notifications-outline" value={settings.send_push} onChange={(value) => setSettings({ ...settings, send_push: value })} />

          <View style={styles.settingGroup}>
            <Text style={[styles.groupTitle, { color: theme.colors.text, textAlign }]}>
              {isRTL ? 'تهنئة عيد الميلاد' : 'Birthday Greeting'}
            </Text>
            <Text style={[styles.label, { color: theme.colors.textSecondary, textAlign }]}>
              {isRTL ? 'وقت الإرسال في نفس يوم الميلاد' : 'Send time on the birthday itself'}
            </Text>
            <TextInput
              value={settings.birthday_send_time}
              onChangeText={(value) => setSettings({ ...settings, birthday_send_time: normalizeTimeInput(value) })}
              keyboardType="numbers-and-punctuation"
              placeholder="08:00"
              placeholderTextColor="#8191A0"
              style={[styles.daysInput, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text, textAlign }]}
            />
            <Text style={[styles.label, styles.spacedLabel, { color: theme.colors.textSecondary, textAlign }]}>
              {isRTL ? 'نص التهنئة — استخدم {student_name} لاسم الطالب' : 'Greeting message — use {student_name} for the student name'}
            </Text>
            <TextInput
              value={settings.birthday_message}
              onChangeText={(value) => setSettings({ ...settings, birthday_message: value })}
              multiline
              style={[styles.messageInput, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text, textAlign }]}
            />
          </View>

          <View style={styles.settingGroup}>
            <Text style={[styles.groupTitle, { color: theme.colors.text, textAlign }]}>
              {isRTL ? 'تذكير انتهاء الرخص' : 'License Expiry Reminders'}
            </Text>
            <Text style={[styles.label, { color: theme.colors.textSecondary, textAlign }]}>
              {isRTL ? 'أيام الإرسال قبل الانتهاء — افصل بفاصلة' : 'Reminder days before expiry — comma separated'}
            </Text>
            <TextInput
              value={licenseDaysText}
              onChangeText={setLicenseDaysText}
              keyboardType="numbers-and-punctuation"
              placeholder="30,14,7,3,1,0"
              placeholderTextColor="#8191A0"
              style={[styles.daysInput, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text, textAlign }]}
            />
            <Text style={[styles.helper, { color: theme.colors.textSecondary, textAlign }]}>
              {isRTL ? 'مثال: 30، 14، 7، 3، 1، 0 = أكثر من إشعار قبل تاريخ الانتهاء.' : 'Example: 30, 14, 7, 3, 1, 0 sends multiple reminders before expiry.'}
            </Text>
            <Text style={[styles.label, styles.spacedLabel, { color: theme.colors.textSecondary, textAlign }]}>
              {isRTL ? 'وقت إرسال تذكير الرخص' : 'License reminder send time'}
            </Text>
            <TextInput
              value={settings.license_send_time}
              onChangeText={(value) => setSettings({ ...settings, license_send_time: normalizeTimeInput(value) })}
              keyboardType="numbers-and-punctuation"
              placeholder="08:00"
              placeholderTextColor="#8191A0"
              style={[styles.daysInput, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text, textAlign }]}
            />
          </View>

          <View style={[styles.buttonRow, { flexDirection: direction }]}>
            <Pressable disabled={saving} onPress={() => void saveSettings()} style={styles.saveButton}>
              {saving ? <ActivityIndicator color="#0A2D44" /> : <Ionicons name="save-outline" size={19} color="#0A2D44" />}
              <Text style={styles.saveText}>{isRTL ? 'حفظ الإعدادات' : 'Save Settings'}</Text>
            </Pressable>
            <Pressable disabled={running} onPress={() => void runNow()} style={[styles.runButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface2 }]}>
              {running ? <ActivityIndicator color={theme.colors.text} /> : <Ionicons name="refresh-outline" size={19} color={theme.colors.text} />}
              <Text style={[styles.runText, { color: theme.colors.text }]}>{isRTL ? 'فحص الآن' : 'Run Now'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.eventTabs, { flexDirection: direction }]}>
          <Pressable onPress={() => setEventTab('pending')} style={[styles.eventTab, eventTab === 'pending' && styles.eventTabActive]}><Text style={[styles.eventTabText, eventTab === 'pending' && styles.eventTabTextActive]}>{isRTL ? `غير منجزة (${events.filter(r => String(r.status ?? 'pending') !== 'completed').length})` : `Pending (${events.filter(r => String(r.status ?? 'pending') !== 'completed').length})`}</Text></Pressable>
          <Pressable onPress={() => setEventTab('completed')} style={[styles.eventTab, eventTab === 'completed' && styles.eventTabActive]}><Text style={[styles.eventTabText, eventTab === 'completed' && styles.eventTabTextActive]}>{isRTL ? `منجزة (${events.filter(r => String(r.status ?? '') === 'completed').length})` : `Completed (${events.filter(r => String(r.status ?? '') === 'completed').length})`}</Text></Pressable>
        </View>
        {visibleEvents.map((row) => {
          const meta = kindMeta(String(row.event_type), isRTL);
          const canComplete = eventTab === 'pending' && ['driver_license','bus_license'].includes(String(row.event_type));
          return (
            <View key={String(row.id)} style={[styles.eventCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}>
              <View style={[styles.eventIcon, { backgroundColor: `${meta.color}18` }]}><Ionicons name={meta.icon} size={20} color={meta.color} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.eventTitle, { color: theme.colors.text, textAlign }]}>{String(row.title ?? meta.label)}</Text><Text style={[styles.eventBody, { color: theme.colors.textSecondary, textAlign }]}>{String(row.body ?? '')}</Text><Text style={[styles.eventDate, { color: meta.color, textAlign }]}>{String(row.event_date ?? '').slice(0,10)}</Text>{row.push_queued_at ? <Text style={[styles.pushStatus, { textAlign }]}>{isRTL ? `تم تجهيز Push: ${new Date(String(row.push_queued_at)).toLocaleString('ar-JO')}` : `Push queued: ${new Date(String(row.push_queued_at)).toLocaleString('en-US')}`}</Text> : null}{canComplete && <Pressable onPress={() => { setEditEvent(row); setNewExpiryDate(''); }} style={styles.completeButton}><Ionicons name="create-outline" size={15} color="#0A2D44" /><Text style={styles.completeButtonText}>{isRTL ? 'تعديل تاريخ الانتهاء وإنجاز' : 'Update expiry & complete'}</Text></Pressable>}</View>
            </View>
          );
        })}
        {!visibleEvents.length && <View style={styles.empty}><Ionicons name="checkmark-circle-outline" size={40} color="#20A06A" /><Text style={[styles.emptyText, { color: theme.colors.text }]}>{isRTL ? 'لا توجد تنبيهات في هذه القائمة' : 'No alerts in this list'}</Text></View>}
      </ScrollView>

      <Modal transparent animationType="slide" visible={!!editEvent} onRequestClose={() => setEditEvent(null)}>
        <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setEditEvent(null)} />
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.colors.text, textAlign }]}>{isRTL ? 'تعديل تاريخ الانتهاء' : 'Update Expiry Date'}</Text>
            <Text style={[styles.eventBody, { color: theme.colors.textSecondary, textAlign, marginBottom: 12 }]}>{String(editEvent?.title ?? '')}</Text>
            <AdminDateField label={isRTL ? 'تاريخ الانتهاء الجديد' : 'New expiry date'} value={newExpiryDate} onChange={setNewExpiryDate} />
            <Pressable disabled={saving || !newExpiryDate} onPress={() => void completeLicenseAlert()} style={styles.sendButton}><Ionicons name="checkmark-done" size={19} color="#0A2D44" /><Text style={styles.sendText}>{isRTL ? 'حفظ ونقل إلى المنجزة' : 'Save & Complete'}</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={manualVisible} onRequestClose={() => setManualVisible(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setManualVisible(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.colors.text, textAlign }]}>{isRTL ? 'إرسال إشعار يدوي' : 'Send Manual Notification'}</Text>
            <Pressable onPress={() => setTargetPicker(true)} style={[styles.choice, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, flexDirection: direction }]}>
              <Ionicons name="people-outline" size={18} color="#F7B83A" />
              <Text style={[styles.choiceText, { color: theme.colors.text, textAlign }]}>{targetItems.find((item) => item.value === targetRole)?.title}</Text>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={17} color="#8191A0" />
            </Pressable>
            <TextInput value={manualTitle} onChangeText={setManualTitle} placeholder={isRTL ? 'عنوان الإشعار' : 'Notification title'} placeholderTextColor="#8191A0" style={[styles.textField, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text, textAlign }]} />
            <TextInput value={manualBody} onChangeText={setManualBody} multiline placeholder={isRTL ? 'محتوى الإشعار...' : 'Notification message...'} placeholderTextColor="#8191A0" style={[styles.textField, styles.bodyField, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text, textAlign }]} />
            <Pressable disabled={saving} onPress={() => void sendManual()} style={styles.sendButton}>
              <Ionicons name="send" size={19} color="#0A2D44" /><Text style={styles.sendText}>{isRTL ? 'إرسال الآن' : 'Send Now'}</Text>
            </Pressable>

            <AdminSelectionModal
              visible={targetPicker}
              embedded
              title={isRTL ? 'المستلمون' : 'Recipients'}
              items={targetItems}
              selectedValue={targetRole}
              allowClear={false}
              onClose={() => setTargetPicker(false)}
              onSelect={(value) => { if (value) setTargetRole(value as TargetRole); setTargetPicker(false); }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  function Toggle({ label, icon, value, onChange }: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; value: boolean; onChange: (value: boolean) => void }) {
    return <View style={[styles.toggleRow, { flexDirection: direction, borderBottomColor: theme.colors.border }]}><View style={styles.toggleIcon}><Ionicons name={icon} size={17} color="#0A2D44" /></View><Text style={[styles.toggleText, { color: theme.colors.text, textAlign }]}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ false: '#D7E0E8', true: '#F6D180' }} thumbColor={value ? '#F7B83A' : '#FFFFFF'} /></View>;
  }

  function Stat({ icon, value, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; value: number; label: string }) {
    return <View style={styles.stat}><Ionicons name={icon} size={18} color="#F7B83A" /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 14, paddingBottom: 110 },
  summary: { minHeight: 82, borderRadius: 20, backgroundColor: '#0A2D44', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', justifyContent: 'center' }, statValue: { color: '#FFFFFF', marginTop: 4, fontSize: 14, fontWeight: '900' }, statLabel: { color: '#AFC2D0', marginTop: 2, fontSize: 7, fontWeight: '700' },
  settingsCard: { marginTop: 12, borderWidth: 1, borderRadius: 22, padding: 13 }, sectionTitle: { fontSize: 12, fontWeight: '900' },
  toggleRow: { minHeight: 56, alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth }, toggleIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' }, toggleText: { flex: 1, fontSize: 9.5, fontWeight: '800' },
  settingGroup: { marginTop: 14, borderRadius: 18, padding: 11, backgroundColor: 'rgba(247,184,58,0.06)' }, groupTitle: { fontSize: 10.5, fontWeight: '900', marginBottom: 9 }, label: { fontSize: 8.5, fontWeight: '700', marginBottom: 6 }, spacedLabel: { marginTop: 10 }, daysInput: { height: 48, borderWidth: 1, borderRadius: 15, paddingHorizontal: 12, fontSize: 11, fontWeight: '800' }, messageInput: { minHeight: 88, borderWidth: 1, borderRadius: 15, paddingHorizontal: 12, paddingTop: 10, fontSize: 9.5, lineHeight: 15, fontWeight: '700', textAlignVertical: 'top' }, helper: { marginTop: 5, fontSize: 7, lineHeight: 11, fontWeight: '600' },
  buttonRow: { gap: 8, marginTop: 12 }, saveButton: { flex: 1.3, height: 49, borderRadius: 15, backgroundColor: '#F7B83A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, saveText: { color: '#0A2D44', fontSize: 9.5, fontWeight: '900' }, runButton: { flex: 1, height: 49, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, runText: { fontSize: 9, fontWeight: '900' },
  pushStatus: { marginTop: 4, color: '#20A06A', fontSize: 7, fontWeight: '800' },
  eventCard: { minHeight: 86, borderWidth: 1, borderRadius: 20, padding: 11, alignItems: 'center', gap: 10, marginTop: 8 }, eventIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, eventTitle: { fontSize: 10.5, fontWeight: '900' }, eventBody: { marginTop: 3, fontSize: 8, lineHeight: 12, fontWeight: '600' }, eventDate: { marginTop: 5, fontSize: 7.5, fontWeight: '900' }, empty: { paddingVertical: 55, alignItems: 'center' }, emptyText: { marginTop: 8, fontSize: 11, fontWeight: '900' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,20,32,0.56)' }, sheet: { minHeight: 500, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, padding: 16, paddingBottom: 28 }, sheetTitle: { fontSize: 15, fontWeight: '900', marginBottom: 12 },
  choice: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 11, alignItems: 'center', gap: 8 }, choiceText: { flex: 1, fontSize: 10, fontWeight: '800' },
  textField: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, marginTop: 10, fontSize: 10.5, fontWeight: '700' }, bodyField: { height: 128, paddingTop: 12, textAlignVertical: 'top' }, sendButton: { height: 52, borderRadius: 16, backgroundColor: '#F7B83A', marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, sendText: { color: '#0A2D44', fontSize: 10.5, fontWeight: '900' },

  eventTabs: { marginTop: 16, backgroundColor: '#E9EEF3', borderRadius: 17, padding: 4, gap: 4 }, eventTab: { flex: 1, minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, eventTabActive: { backgroundColor: '#F7B83A' }, eventTabText: { color: '#647789', fontSize: 9, fontWeight: '900' }, eventTabTextActive: { color: '#0A2D44' }, completeButton: { marginTop: 8, minHeight: 34, alignSelf: 'flex-start', borderRadius: 11, paddingHorizontal: 10, backgroundColor: '#F7B83A', flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' }, completeButtonText: { color: '#0A2D44', fontSize: 8, fontWeight: '900' },
});
