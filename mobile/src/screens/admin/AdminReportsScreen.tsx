import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';

import { useAuth } from '../../hooks/useAuth';
import { useResolvedSchoolId } from '../../hooks/useResolvedSchoolId';
import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { supabase } from '../../lib/supabase';
import AdminBrandHeader from '../../components/admin/AdminBrandHeader';
import AdminDateField from '../../components/admin/AdminDateField';
import AdminSelectionModal, { SelectionItem } from '../../components/admin/AdminSelectionModal';
import AdminMultiSelectPanel, { MultiSelectItem } from '../../components/admin/AdminMultiSelectPanel';
import {
  AdminReportResult,
  AdminReportType,
  exportAdminReportExcel,
  exportAdminReportPdf,
  getAdminReport,
} from '../../services/adminReportsService';

type Row = Record<string, any>;

type ReportMeta = {
  type: AdminReportType;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  ar: string;
  en: string;
  subAr: string;
  subEn: string;
  usesRoute?: boolean;
  usesDate?: boolean;
  usesPeriod?: boolean;
};

const REPORTS: ReportMeta[] = [
  { type: 'students', icon: 'people-outline', ar: 'تقرير الطلاب', en: 'Students Report', subAr: 'الصف والشعبة والمسار وبيانات ولي الأمر', subEn: 'Grade, section, route and parent data', usesRoute: true },
  { type: 'teachers', icon: 'school-outline', ar: 'تقرير المعلمين والمشرفين', en: 'Teachers & Supervisors', subAr: 'البيانات والحساب والمسار والمادة', subEn: 'Profile, account, route and subject', usesRoute: true },
  { type: 'drivers', icon: 'car-outline', ar: 'تقرير السائقين', en: 'Drivers Report', subAr: 'البيانات والرخص وتاريخ الانتهاء', subEn: 'Profile, licenses and expiry dates' },
  { type: 'buses', icon: 'bus-outline', ar: 'تقرير الحافلات', en: 'Buses Report', subAr: 'السعة والسائقون والترخيص', subEn: 'Capacity, drivers and license' },
  { type: 'routes', icon: 'map-outline', ar: 'تقرير المسارات والطلاب', en: 'Routes & Students', subAr: 'الصباحي والمسائي والباص والمشرف', subEn: 'Morning/afternoon times, bus and supervisor', usesRoute: true },
  { type: 'attendance', icon: 'clipboard-outline', ar: 'تقرير حضور الرحلات', en: 'Trip Attendance', subAr: 'صباحي أو مسائي مع حالات الطالب', subEn: 'Morning/afternoon student attendance', usesRoute: true, usesDate: true, usesPeriod: true },
  { type: 'incidents', icon: 'warning-outline', ar: 'تقرير الحوادث والبلاغات', en: 'Incidents Report', subAr: 'الحوادث والخطورة والتواريخ', subEn: 'Incidents, severity and dates', usesDate: true },
  { type: 'alerts', icon: 'notifications-outline', ar: 'تقرير التنبيهات والإشعارات', en: 'Alerts & Notifications', subAr: 'أعياد الميلاد والرخص وحالة الإرسال', subEn: 'Birthdays, licenses and delivery status', usesDate: true },
  { type: 'trips', icon: 'navigate-outline', ar: 'تقرير أحداث الرحلات', en: 'Trip Events', subAr: 'بداية ونهاية وأحداث الرحلات', subEn: 'Trip starts, ends and events', usesRoute: true, usesDate: true },
];

function humanize(value: unknown, isRTL: boolean) {
  const text = String(value ?? '').trim();
  const ar: Record<string, string> = { morning: 'صباحية', afternoon: 'مسائية', both: 'صباحية ومسائية', boarded: 'صعد للحافلة', arrived: 'وصل', absent: 'غائب', delivered: 'تم التوصيل', active: 'فعال', inactive: 'غير فعال' };
  if (isRTL && ar[text]) return ar[text];
  return text.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminReportsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { schoolId } = useResolvedSchoolId(user);
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();

  const [school, setSchool] = useState<Row | null>(null);
  const [routes, setRoutes] = useState<Row[]>([]);
  const [selectedType, setSelectedType] = useState<AdminReportType>('students');
  const [routeId, setRouteId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [period, setPeriod] = useState<'all' | 'morning' | 'afternoon'>('all');
  const [routePicker, setRoutePicker] = useState(false);
  const [periodPicker, setPeriodPicker] = useState(false);
  const [columnPicker, setColumnPicker] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [result, setResult] = useState<AdminReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const selectedMeta = useMemo(() => REPORTS.find((item) => item.type === selectedType) ?? REPORTS[0], [selectedType]);
  const prefKey = `admin_report_columns_${selectedType}`;

  const loadBase = useCallback(async () => {
    if (!schoolId) { setLoading(false); return; }
    try {
      const [schoolResult, routesResult] = await Promise.all([
        supabase.from('schools').select('*').eq('id', schoolId).maybeSingle(),
        supabase.from('routes').select('*').eq('school_id', schoolId).order('name'),
      ]);
      if (schoolResult.error) throw schoolResult.error;
      if (routesResult.error) throw routesResult.error;
      setSchool(schoolResult.data ?? null);
      setRoutes(routesResult.data ?? []);
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر تحميل التقارير' : 'Unable to Load Reports', error?.message ?? String(error));
    } finally { setLoading(false); }
  }, [schoolId, isRTL]);

  useEffect(() => { void loadBase(); }, [loadBase]);
  useEffect(() => { setResult(null); setSelectedColumns([]); setRouteId(null); setPeriod('all'); }, [selectedType]);

  const routeItems: SelectionItem[] = routes.map((route) => ({ value: String(route.id), title: String(route.name ?? '—'), subtitle: humanize(route.direction, isRTL), icon: 'map-outline' }));
  const periodItems: SelectionItem[] = [
    { value: 'all', title: isRTL ? 'كل الفترات' : 'All Periods', icon: 'time-outline' },
    { value: 'morning', title: isRTL ? 'الفترة الصباحية' : 'Morning', icon: 'sunny-outline' },
    { value: 'afternoon', title: isRTL ? 'الفترة المسائية' : 'Afternoon', icon: 'moon-outline' },
  ];

  const columnItems: MultiSelectItem[] = (result?.columns ?? []).map((column) => ({ value: column.key, title: isRTL ? column.labelAr : column.labelEn }));

  async function generate() {
    if (!schoolId) return;
    setGenerating(true);
    try {
      const report = await getAdminReport(selectedType, {
        schoolId,
        routeId: selectedMeta.usesRoute ? routeId : null,
        fromDate: selectedMeta.usesDate ? fromDate || null : null,
        toDate: selectedMeta.usesDate ? toDate || null : null,
        period: selectedMeta.usesPeriod ? period : 'all',
      });
      setResult(report);
      const saved = await SecureStore.getItemAsync(prefKey);
      if (saved) {
        try {
          const keys = JSON.parse(saved) as string[];
          const valid = keys.filter((key) => report.columns.some((column) => column.key === key));
          setSelectedColumns(valid.length ? valid : report.columns.map((column) => column.key));
        } catch { setSelectedColumns(report.columns.map((column) => column.key)); }
      } else setSelectedColumns(report.columns.map((column) => column.key));
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر إنشاء التقرير' : 'Unable to Generate Report', error?.message ?? String(error));
    } finally { setGenerating(false); }
  }

  async function saveColumns(values: string[]) {
    if (!values.length) {
      Alert.alert(isRTL ? 'اختر عموداً' : 'Select a Column', isRTL ? 'يجب إبقاء عمود واحد على الأقل.' : 'At least one column must remain selected.');
      return;
    }
    setSelectedColumns(values);
    await SecureStore.setItemAsync(prefKey, JSON.stringify(values));
    setColumnPicker(false);
  }

  async function exportFile(kind: 'pdf' | 'excel') {
    if (!result) {
      await generate();
      return;
    }

    if (exporting) return;

    setExporting(kind);

    try {
      const params = {
        report: result,
        isRTL,
        school: {
          name: school?.name ?? '',
          email: school?.email ?? null,
          phone: school?.phone ?? null,
          logo_url: school?.logo_url ?? null,
        },
        selectedColumnKeys: selectedColumns,
      };

      const uri = kind === 'pdf'
        ? await exportAdminReportPdf(params)
        : await exportAdminReportExcel(params);

      // File generation is finished before opening the share sheet.
      // Clearing the state here prevents the next report from staying locked
      // when the user closes the share sheet without saving.
      setExporting(null);

      await Sharing.shareAsync(uri, {
        mimeType: kind === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: kind === 'pdf'
          ? (isRTL ? 'حفظ أو مشاركة تقرير PDF' : 'Save or Share PDF Report')
          : (isRTL ? 'حفظ أو مشاركة تقرير Excel' : 'Save or Share Excel Report'),
      });
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'تعذر تصدير التقرير' : 'Export Failed',
        error?.message ?? String(error)
      );
    } finally {
      setExporting(null);
    }
  }

  if (loading) return <View style={[styles.loading, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" color="#F7B83A" /></View>;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <AdminBrandHeader title={isRTL ? 'التقارير' : 'Reports'} subtitle={isRTL ? 'PDF و Excel بهيدر ثابت واختيار الأعمدة' : 'PDF & Excel with repeated header and saved columns'} schoolName={String(school?.name ?? (isRTL ? 'المدرسة' : 'School'))} schoolLogoUrl={school?.logo_url ?? null} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, textAlign }]}>{isRTL ? 'اختر التقرير' : 'Choose Report'}</Text>
        <View style={[styles.grid, { flexDirection: direction }]}>
          {REPORTS.map((item) => {
            const active = item.type === selectedType;
            return <Pressable key={item.type} onPress={() => setSelectedType(item.type)} style={[styles.reportCard, { backgroundColor: active ? '#0A2D44' : theme.colors.surface, borderColor: active ? '#0A2D44' : theme.colors.border }]}><View style={[styles.reportIcon, { backgroundColor: active ? '#F7B83A' : 'rgba(247,184,58,0.13)' }]}><Ionicons name={item.icon} size={21} color={active ? '#0A2D44' : '#F7B83A'} /></View><Text style={[styles.reportTitle, { color: active ? '#FFFFFF' : theme.colors.text, textAlign }]}>{isRTL ? item.ar : item.en}</Text><Text numberOfLines={2} style={[styles.reportSub, { color: active ? '#AFC2D0' : theme.colors.textSecondary, textAlign }]}>{isRTL ? item.subAr : item.subEn}</Text></Pressable>;
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text, textAlign }]}>{isRTL ? 'الفلاتر' : 'Filters'}</Text>
        <View style={[styles.filterCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {selectedMeta.usesRoute && <Choice label={isRTL ? 'المسار' : 'Route'} value={String(routes.find((item) => String(item.id) === String(routeId ?? ''))?.name ?? (isRTL ? 'كل المسارات' : 'All Routes'))} icon="map-outline" onPress={() => setRoutePicker(true)} />}
          {selectedMeta.usesPeriod && <Choice label={isRTL ? 'الفترة' : 'Period'} value={period === 'morning' ? (isRTL ? 'صباحية' : 'Morning') : period === 'afternoon' ? (isRTL ? 'مسائية' : 'Afternoon') : (isRTL ? 'كل الفترات' : 'All Periods')} icon="time-outline" onPress={() => setPeriodPicker(true)} />}
          {selectedMeta.usesDate && <><AdminDateField label={isRTL ? 'من تاريخ' : 'From Date'} value={fromDate} onChange={(value) => { setFromDate(value); setResult(null); }} /><AdminDateField label={isRTL ? 'إلى تاريخ' : 'To Date'} value={toDate} onChange={(value) => { setToDate(value); setResult(null); }} /></>}
          <Pressable disabled={generating} onPress={() => void generate()} style={[styles.generate, { opacity: generating ? 0.7 : 1 }]}>{generating ? <ActivityIndicator color="#0A2D44" /> : <Ionicons name="sparkles-outline" size={20} color="#0A2D44" />}<Text style={styles.generateText}>{isRTL ? 'إنشاء التقرير' : 'Generate Report'}</Text></Pressable>
        </View>

        {!!result && <>
          <View style={[styles.resultTop, { flexDirection: direction }]}><View style={{ flex: 1 }}><Text style={[styles.resultTitle, { color: theme.colors.text, textAlign }]}>{isRTL ? result.titleAr : result.titleEn}</Text><Text style={[styles.resultCount, { color: theme.colors.textSecondary, textAlign }]}>{isRTL ? `${result.rows.length} سجل • ${selectedColumns.length} عمود` : `${result.rows.length} rows • ${selectedColumns.length} columns`}</Text></View><Pressable onPress={() => setColumnPicker(true)} style={[styles.columnsButton, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}><Ionicons name="options-outline" size={17} color={theme.colors.text} /><Text style={[styles.columnsText, { color: theme.colors.text }]}>{isRTL ? 'الأعمدة' : 'Columns'}</Text></Pressable></View>
          <View style={[styles.exports, { flexDirection: direction }]}>
            <Pressable disabled={!!exporting} onPress={() => void exportFile('pdf')} style={[styles.pdf, exporting && styles.exportDisabled]}>
              {exporting === 'pdf' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />}
              <Text style={styles.exportText}>{exporting === 'pdf' ? (isRTL ? 'جاري تجهيز PDF...' : 'Preparing PDF...') : 'PDF'}</Text>
            </Pressable>
            <Pressable disabled={!!exporting} onPress={() => void exportFile('excel')} style={[styles.excel, exporting && styles.exportDisabled]}>
              {exporting === 'excel' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="grid-outline" size={18} color="#FFFFFF" />}
              <Text style={styles.exportText}>{exporting === 'excel' ? (isRTL ? 'جاري تجهيز Excel...' : 'Preparing Excel...') : 'Excel'}</Text>
            </Pressable>
          </View>
          <ScrollView horizontal><View style={[styles.table, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><View style={styles.tableHead}>{result.columns.filter((c) => selectedColumns.includes(c.key)).map((c) => <Text key={c.key} style={styles.headCell}>{isRTL ? c.labelAr : c.labelEn}</Text>)}</View>{result.rows.slice(0, 100).map((row, rowIndex) => <View key={rowIndex} style={[styles.tableRow, { backgroundColor: rowIndex % 2 ? theme.colors.surface2 : theme.colors.surface, borderBottomColor: theme.colors.border }]}>{result.columns.filter((c) => selectedColumns.includes(c.key)).map((c) => <Text key={c.key} numberOfLines={2} style={[styles.cell, { color: theme.colors.text }]}>{humanize(row[c.key], isRTL) || '—'}</Text>)}</View>)}</View></ScrollView>
        </>}
      </ScrollView>

      <AdminSelectionModal visible={routePicker} title={isRTL ? 'اختيار المسار' : 'Select Route'} items={routeItems} selectedValue={routeId} clearLabel={isRTL ? 'كل المسارات' : 'All Routes'} onClose={() => setRoutePicker(false)} onSelect={(value) => { setRouteId(value); setResult(null); setRoutePicker(false); }} />
      <AdminSelectionModal visible={periodPicker} title={isRTL ? 'اختيار الفترة' : 'Select Period'} items={periodItems} selectedValue={period} allowClear={false} onClose={() => setPeriodPicker(false)} onSelect={(value) => { setPeriod((value as any) ?? 'all'); setResult(null); setPeriodPicker(false); }} />
      <AdminMultiSelectPanel visible={columnPicker && !!result} title={isRTL ? 'الأعمدة الظاهرة' : 'Visible Columns'} subtitle={isRTL ? 'نفس الاختيار يحفظ ويطبق على PDF وExcel.' : 'The same saved selection applies to PDF and Excel.'} items={columnItems} selectedValues={selectedColumns} onClose={() => setColumnPicker(false)} onSave={(values) => void saveColumns(values)} />
    </SafeAreaView>
  );

  function Choice({ label, value, icon, onPress }: { label: string; value: string; icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void }) {
    return <View style={styles.field}><Text style={[styles.label, { color: theme.colors.textSecondary, textAlign }]}>{label}</Text><Pressable onPress={onPress} style={[styles.choice, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, flexDirection: direction }]}><View style={styles.choiceIcon}><Ionicons name={icon} size={18} color="#0A2D44" /></View><Text style={[styles.choiceText, { color: theme.colors.text, textAlign }]}>{value}</Text><Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={17} color="#8191A0" /></Pressable></View>;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 14, paddingBottom: 110 },
  sectionTitle: { marginTop: 10, marginBottom: 8, fontSize: 13, fontWeight: '900' }, grid: { flexWrap: 'wrap', gap: 8 }, reportCard: { width: '48.7%', minHeight: 128, borderRadius: 22, borderWidth: 1, padding: 12 }, reportIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, reportTitle: { marginTop: 8, fontSize: 10, fontWeight: '900' }, reportSub: { marginTop: 4, fontSize: 7.3, lineHeight: 11, fontWeight: '600' },
  filterCard: { borderRadius: 22, borderWidth: 1, padding: 13 }, field: { marginTop: 7 }, label: { marginBottom: 6, fontSize: 9.5, fontWeight: '800' }, choice: { minHeight: 53, borderRadius: 16, borderWidth: 1, paddingHorizontal: 9, alignItems: 'center', gap: 8 }, choiceIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' }, choiceText: { flex: 1, fontSize: 10.5, fontWeight: '800' }, generate: { marginTop: 16, height: 52, borderRadius: 16, backgroundColor: '#F7B83A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, generateText: { color: '#0A2D44', fontSize: 10.5, fontWeight: '900' },
  resultTop: { marginTop: 18, alignItems: 'center', gap: 8 }, resultTitle: { fontSize: 13, fontWeight: '900' }, resultCount: { marginTop: 3, fontSize: 8, fontWeight: '600' }, columnsButton: { height: 40, borderRadius: 13, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 }, columnsText: { fontSize: 8.5, fontWeight: '900' }, exports: { marginTop: 8, marginBottom: 8, gap: 7 }, pdf: { flex: 1, height: 43, borderRadius: 14, backgroundColor: '#D94A4A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, excel: { flex: 1, height: 43, borderRadius: 14, backgroundColor: '#20A06A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, exportText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  exportDisabled: { opacity: 0.72 },
  table: { minWidth: 720, borderWidth: 1, borderRadius: 18, overflow: 'hidden' }, tableHead: { minHeight: 42, backgroundColor: '#0A2D44', flexDirection: 'row', alignItems: 'center' }, headCell: { width: 140, color: '#FFFFFF', paddingHorizontal: 7, fontSize: 8, fontWeight: '900' }, tableRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth }, cell: { width: 140, paddingHorizontal: 7, fontSize: 7.8, lineHeight: 11, fontWeight: '600' },
});
