import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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

type Row = Record<string, any>;

export default function AdminIntegrationSettingsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { schoolId } = useResolvedSchoolId(user);
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();

  const [school, setSchool] = useState<Row | null>(null);
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [externalSchoolId, setExternalSchoolId] = useState('');
  const [syncStudents, setSyncStudents] = useState(true);
  const [syncParents, setSyncParents] = useState(true);
  const [syncTeachers, setSyncTeachers] = useState(true);
  const [syncGrades, setSyncGrades] = useState(true);

  const load = useCallback(async () => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [schoolResult, integrationResult] = await Promise.all([
        supabase.from('schools').select('*').eq('id', schoolId).maybeSingle(),
        supabase.from('school_integrations').select('*').eq('school_id', schoolId).eq('provider', 'q_school_erp').maybeSingle(),
      ]);
      if (schoolResult.error) throw schoolResult.error;
      if (integrationResult.error && integrationResult.error.code !== 'PGRST116') throw integrationResult.error;
      const current = integrationResult.data ?? null;
      setSchool(schoolResult.data ?? null);
      setRow(current);
      setEnabled(current?.enabled === true);
      setBaseUrl(String(current?.base_url ?? ''));
      setExternalSchoolId(String(current?.external_school_id ?? ''));
      setSyncStudents(current?.sync_students !== false);
      setSyncParents(current?.sync_parents !== false);
      setSyncTeachers(current?.sync_teachers !== false);
      setSyncGrades(current?.sync_grades !== false);
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر تحميل الربط' : 'Unable to Load Integration', error?.message ?? String(error));
    } finally { setLoading(false); }
  }, [schoolId, isRTL]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!schoolId) return;
    setSaving(true);
    try {
      const payload = {
        school_id: schoolId,
        provider: 'q_school_erp',
        enabled,
        base_url: baseUrl.trim() || null,
        external_school_id: externalSchoolId.trim() || null,
        sync_students: syncStudents,
        sync_parents: syncParents,
        sync_teachers: syncTeachers,
        sync_grades: syncGrades,
        updated_at: new Date().toISOString(),
      };
      const query = row?.id
        ? supabase.from('school_integrations').update(payload).eq('id', row.id)
        : supabase.from('school_integrations').insert(payload);
      const { error } = await query;
      if (error) throw error;
      await load();
      Alert.alert(isRTL ? 'تم الحفظ' : 'Saved', isRTL ? 'تم حفظ إعدادات الربط مع Q School ERP.' : 'Q School ERP integration settings were saved.');
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر الحفظ' : 'Save Failed', error?.message ?? String(error));
    } finally { setSaving(false); }
  }

  if (loading) return <View style={[styles.loading, { backgroundColor: theme.colors.background }]}><ActivityIndicator color="#F7B83A" size="large" /></View>;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <AdminBrandHeader title={isRTL ? 'ربط Q School ERP' : 'Q School ERP Integration'} subtitle={isRTL ? 'تهيئة الربط بدون تغيير بيانات Smart Bus الحالية' : 'Prepare integration without changing current Smart Bus data'} schoolName={String(school?.name ?? '')} schoolLogoUrl={school?.logo_url ?? null} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: '#0A2D44' }]}><View style={styles.heroIcon}><Ionicons name="git-compare-outline" size={26} color="#0A2D44" /></View><View style={{ flex: 1 }}><Text style={styles.heroTitle}>{isRTL ? 'Smart Bus ↔ Q School ERP' : 'Smart Bus ↔ Q School ERP'}</Text><Text style={styles.heroSub}>{isRTL ? 'الصفوف والشعب والطلاب وأولياء الأمور والمعلمون مجهزون للمزامنة.' : 'Grades, sections, students, parents and teachers are ready for synchronization.'}</Text></View></View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Toggle label={isRTL ? 'تفعيل الربط' : 'Enable Integration'} value={enabled} onValueChange={setEnabled} icon="power-outline" />
          <Input label={isRTL ? 'عنوان API' : 'API Base URL'} value={baseUrl} onChangeText={setBaseUrl} placeholder="https://..." icon="link-outline" />
          <Input label={isRTL ? 'معرف المدرسة في Q School' : 'Q School External School ID'} value={externalSchoolId} onChangeText={setExternalSchoolId} placeholder={isRTL ? 'يحدد من نظام Q School' : 'Provided by Q School ERP'} icon="school-outline" />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text, textAlign }]}>{isRTL ? 'بيانات المزامنة' : 'Sync Data'}</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Toggle label={isRTL ? 'الطلاب' : 'Students'} value={syncStudents} onValueChange={setSyncStudents} icon="people-outline" />
          <Toggle label={isRTL ? 'أولياء الأمور' : 'Parents'} value={syncParents} onValueChange={setSyncParents} icon="person-outline" />
          <Toggle label={isRTL ? 'المعلمون والمشرفون' : 'Teachers & Supervisors'} value={syncTeachers} onValueChange={setSyncTeachers} icon="school-outline" />
          <Toggle label={isRTL ? 'الصفوف والشعب' : 'Grades & Sections'} value={syncGrades} onValueChange={setSyncGrades} icon="grid-outline" />
        </View>

        <View style={[styles.note, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}><Ionicons name="information-circle-outline" size={20} color="#F7B83A" /><Text style={[styles.noteText, { color: theme.colors.textSecondary, textAlign }]}>{isRTL ? 'هذه الشاشة تجهز إعدادات الربط فقط. مفتاح API/التوثيق النهائي نضيفه عند تجهيز Q School ERP API حتى ما نخزن أسرار بشكل غير آمن داخل التطبيق.' : 'This screen prepares integration settings. Final API authentication will be added when the Q School ERP API is ready so secrets are not stored unsafely in the app.'}</Text></View>

        <Pressable disabled={saving} onPress={() => void save()} style={[styles.save, { opacity: saving ? 0.7 : 1 }]}>{saving ? <ActivityIndicator color="#0A2D44" /> : <Ionicons name="checkmark-done" size={21} color="#0A2D44" />}<Text style={styles.saveText}>{isRTL ? 'حفظ إعدادات الربط' : 'Save Integration Settings'}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );

  function Input({ label, value, onChangeText, placeholder, icon }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
    return <View style={styles.field}><Text style={[styles.label, { color: theme.colors.textSecondary, textAlign }]}>{label}</Text><View style={[styles.inputWrap, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, flexDirection: direction }]}><Ionicons name={icon} size={18} color="#F7B83A" /><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8191A0" autoCapitalize="none" style={[styles.input, { color: theme.colors.text, textAlign }]} /></View></View>;
  }

  function Toggle({ label, value, onValueChange, icon }: { label: string; value: boolean; onValueChange: (value: boolean) => void; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
    return <View style={[styles.toggleRow, { flexDirection: direction, borderBottomColor: theme.colors.border }]}><View style={styles.toggleIcon}><Ionicons name={icon} size={18} color="#0A2D44" /></View><Text style={[styles.toggleLabel, { color: theme.colors.text, textAlign }]}>{label}</Text><Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#D7E0E8', true: '#F6D180' }} thumbColor={value ? '#F7B83A' : '#FFFFFF'} /></View>;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 14, paddingBottom: 110 },
  hero: { borderRadius: 24, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 }, heroIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' }, heroTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' }, heroSub: { marginTop: 4, color: '#AFC2D0', fontSize: 8, lineHeight: 12, fontWeight: '600' },
  card: { marginTop: 12, borderWidth: 1, borderRadius: 22, padding: 12 }, sectionTitle: { marginTop: 16, marginBottom: 7, fontSize: 13, fontWeight: '900' }, field: { marginTop: 10 }, label: { marginBottom: 6, fontSize: 9.5, fontWeight: '800' }, inputWrap: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 11, alignItems: 'center', gap: 8 }, input: { flex: 1, height: 50, fontSize: 10.5, fontWeight: '700' }, toggleRow: { minHeight: 58, alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth }, toggleIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' }, toggleLabel: { flex: 1, fontSize: 10, fontWeight: '900' }, note: { marginTop: 12, borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: 'row', gap: 8 }, noteText: { flex: 1, fontSize: 8, lineHeight: 13, fontWeight: '600' }, save: { marginTop: 16, height: 52, borderRadius: 16, backgroundColor: '#F7B83A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, saveText: { color: '#0A2D44', fontSize: 10.5, fontWeight: '900' },
});
