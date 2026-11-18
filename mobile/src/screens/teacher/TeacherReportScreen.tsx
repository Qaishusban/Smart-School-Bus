import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../hooks/useAuth';
import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  createTeacherReportExcel,
  createTeacherReportPdf,
  loadTeacherReportData,
  shareTeacherReportFile,
  TEACHER_REPORT_COLUMNS,
  TeacherReportPayload,
} from '../../services/teacherReportService';
import {
  busNumber,
  normalizeAttendanceStatus,
  routeName,
  rowName,
  TripPeriod,
} from '../../services/teacherService';

type PeriodFilter = 'all' | TripPeriod;
type DatePreset = 'today' | 'week' | 'month' | 'custom';
type DateTarget = 'start' | 'end';

type StudentOption = { id: string; name: string; subtitle: string };

const GOLD = '#F4B942';
const NAVY = '#0A2D44';

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseKey(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function presetRange(preset: Exclude<DatePreset, 'custom'>) {
  const today = new Date();
  const endDate = dateKey(today);
  const start = new Date(today);
  if (preset === 'today') return { startDate: endDate, endDate };
  start.setDate(today.getDate() - (preset === 'week' ? 6 : 29));
  return { startDate: dateKey(start), endDate };
}

function prettyDate(value: string, isRTL: boolean) {
  return parseKey(value).toLocaleDateString(isRTL ? 'ar-JO' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function rowDate(value: unknown, isRTL: boolean) {
  if (!value) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(isRTL ? 'ar-JO' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function periodText(value: unknown, isRTL: boolean) {
  const p = String(value ?? '').toLowerCase();
  if (p === 'morning') return isRTL ? 'صباحية' : 'Morning';
  if (p === 'afternoon' || p === 'evening') return isRTL ? 'مسائية' : 'Afternoon';
  return '—';
}

function statusMeta(value: unknown, isRTL: boolean) {
  const s = normalizeAttendanceStatus(value);
  if (s === 'boarded') return { label: isRTL ? 'تم الاستلام' : 'Boarded', icon: 'enter-outline' as const, color: '#0D8B61', bg: '#E8F7F0' };
  if (s === 'arrived') return { label: isRTL ? 'وصل المدرسة' : 'Arrived', icon: 'school-outline' as const, color: '#5363D8', bg: '#EEF0FF' };
  if (s === 'delivered') return { label: isRTL ? 'تم التوصيل' : 'Delivered', icon: 'home-outline' as const, color: '#087E82', bg: '#E7F8F7' };
  if (s === 'absent') return { label: isRTL ? 'غائب / معذور' : 'Absent', icon: 'close-circle-outline' as const, color: '#C43E47', bg: '#FDEBEC' };
  return { label: String(value ?? '—'), icon: 'ellipse-outline' as const, color: '#64748B', bg: '#F1F5F9' };
}

export default function TeacherReportScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();
  const initial = useMemo(() => presetRange('month'), []);

  const [preset, setPreset] = useState<DatePreset>('month');
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [payload, setPayload] = useState<TeacherReportPayload | null>(null);
  const [selectedColumns, setSelectedColumns] = useState(TEACHER_REPORT_COLUMNS.map((x) => x.key));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [studentModal, setStudentModal] = useState(false);
  const [columnsModal, setColumnsModal] = useState(false);
  const [dateModal, setDateModal] = useState(false);
  const [dateTarget, setDateTarget] = useState<DateTarget>('start');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const load = useCallback(async (refresh = false) => {
    if (!user?.id) { setLoading(false); return; }
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      setPayload(await loadTeacherReportData({
        teacherId: user.id,
        username: user.username ?? null,
        schoolId: user.school_id ?? null,
        startDate,
        endDate,
        period,
        studentId,
      }));
    } catch (error: any) {
      console.log('TeacherReportScreen:', error);
      Alert.alert(isRTL ? 'تعذر تحميل التقرير' : 'Unable to load report', error?.message ?? 'Report loading failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, user?.username, user?.school_id, startDate, endDate, period, studentId, isRTL]);

  useEffect(() => { void load(); }, [load]);

  const students = useMemo<StudentOption[]>(() => (payload?.context?.students ?? []).map((item: any) => {
    const s = item?.student ?? item;
    return {
      id: String(s?.id ?? ''),
      name: rowName(s) || String(s?.full_name ?? s?.name ?? '—'),
      subtitle: [s?.grade_name ?? s?.grade, s?.section_name ?? s?.section].filter(Boolean).join(' • '),
    };
  }).filter((x) => !!x.id).sort((a, b) => a.name.localeCompare(b.name)), [payload]);

  const selectedStudent = students.find((x) => x.id === studentId) ?? null;
  const rows = payload?.rows ?? [];
  const teacherName = rowName(payload?.context?.teacher) || user?.full_name || (isRTL ? 'المعلم / المشرف' : 'Teacher / Supervisor');
  const schoolName = String(payload?.context?.school?.name ?? payload?.context?.school?.name_ar ?? payload?.context?.school?.name_en ?? (isRTL ? 'المدرسة' : 'School'));
  const currentRoute = routeName(payload?.context?.route) || '—';
  const currentBus = busNumber(payload?.context?.bus) || '—';
  const logoUrl = String(payload?.context?.school?.logo_url ?? payload?.context?.school?.logo ?? '');

  const summary = useMemo(() => {
    const count = (s: string) => rows.filter((r: any) => normalizeAttendanceStatus(r.status) === s).length;
    return { total: rows.length, boarded: count('boarded'), arrived: count('arrived'), delivered: count('delivered'), absent: count('absent') };
  }, [rows]);

  const applyPreset = (next: Exclude<DatePreset, 'custom'>) => {
    const range = presetRange(next);
    setPreset(next); setStartDate(range.startDate); setEndDate(range.endDate);
  };

  const openDate = (target: DateTarget) => {
    setDateTarget(target);
    setCalendarMonth(parseKey(target === 'start' ? startDate : endDate));
    setDateModal(true);
  };

  const chooseDate = (value: string) => {
    if (dateTarget === 'start') {
      setStartDate(value);
      if (value > endDate) setEndDate(value);
    } else {
      setEndDate(value);
      if (value < startDate) setStartDate(value);
    }
    setPreset('custom');
    setDateModal(false);
  };

  const reportTitle = isRTL ? 'تقرير حضور وإشراف النقل المدرسي' : 'School Transportation Supervision Report';

  const validateExport = () => {
    if (!selectedColumns.length) {
      Alert.alert(isRTL ? 'أعمدة التقرير' : 'Report columns', isRTL ? 'اختر عموداً واحداً على الأقل.' : 'Select at least one column.');
      return false;
    }
    return true;
  };

  const exportPdf = async () => {
    if (!payload || !validateExport() || exporting) return;
    try {
      setExporting('pdf');
      const uri = await createTeacherReportPdf({ payload, columns: selectedColumns, isRTL, title: reportTitle, startDate, endDate, period });
      // Important: stop loading BEFORE opening the native share sheet.
      setExporting(null);
      await shareTeacherReportFile(uri, 'pdf', reportTitle);
    } catch (error: any) {
      setExporting(null);
      Alert.alert(isRTL ? 'تعذر إنشاء PDF' : 'PDF export failed', error?.message ?? 'PDF export failed');
    }
  };

  const exportExcel = async () => {
    if (!payload || !validateExport() || exporting) return;
    try {
      setExporting('excel');
      const uri = await createTeacherReportExcel({ payload, columns: selectedColumns, isRTL, title: reportTitle, startDate, endDate, period });
      setExporting(null);
      await shareTeacherReportFile(uri, 'excel', reportTitle);
    } catch (error: any) {
      setExporting(null);
      Alert.alert(isRTL ? 'تعذر إنشاء Excel' : 'Excel export failed', error?.message ?? 'Excel export failed');
    }
  };

  if (loading && !payload) {
    return <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.loadingIcon, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><Ionicons name="document-text-outline" size={31} color={GOLD} /></View>
      <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 18 }} />
      <Text style={[styles.loadingTitle, { color: theme.colors.text }]}>{isRTL ? 'جاري تجهيز التقارير' : 'Preparing reports'}</Text>
    </View>;
  }

  return <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
    <View style={[styles.header, { flexDirection: direction }]}>
      <Pressable onPress={() => navigation.goBack()} style={[styles.iconBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={21} color={theme.colors.text} /></Pressable>
      <View style={{ flex: 1 }}><Text style={[styles.kicker, { textAlign }]}>SMART SCHOOL BUS</Text><Text style={[styles.pageTitle, { color: theme.colors.text, textAlign }]}>{isRTL ? 'التقارير' : 'Reports'}</Text></View>
      <Pressable onPress={() => void load(true)} style={[styles.iconBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>{refreshing ? <ActivityIndicator size="small" color={GOLD} /> : <Ionicons name="refresh" size={19} color={theme.colors.text} />}</Pressable>
    </View>

    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} tintColor={GOLD} onRefresh={() => void load(true)} />} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={[styles.heroTop, { flexDirection: direction }]}>
          <View style={styles.schoolLogo}>{logoUrl ? <Image source={{ uri: logoUrl }} style={styles.schoolLogoImage} resizeMode="contain" /> : <Ionicons name="school" size={25} color={NAVY} />}</View>
          <View style={{ flex: 1 }}><Text style={[styles.heroLabel, { textAlign }]}>{isRTL ? 'تقرير المعلم / مشرف النقل' : 'TEACHER / TRANSPORT SUPERVISOR'}</Text><Text style={[styles.heroName, { textAlign }]} numberOfLines={1}>{teacherName}</Text><Text style={[styles.heroSchool, { textAlign }]} numberOfLines={1}>{schoolName}</Text></View>
          <Ionicons name="stats-chart" size={24} color={GOLD} />
        </View>
        <View style={[styles.heroMetrics, { flexDirection: direction }]}>
          <HeroMetric icon="map-outline" label={isRTL ? 'المسار' : 'Route'} value={currentRoute} />
          <HeroDivider />
          <HeroMetric icon="bus-outline" label={isRTL ? 'الباص' : 'Bus'} value={currentBus} />
          <HeroDivider />
          <HeroMetric icon="people-outline" label={isRTL ? 'الطلاب' : 'Students'} value={String(students.length)} />
        </View>
      </View>

      <Card theme={theme}>
        <SectionHeader icon="options-outline" title={isRTL ? 'خيارات التقرير' : 'Report options'} subtitle={isRTL ? 'الفترة الافتراضية شهر ويمكنك تحديد أي تاريخ من وإلى' : 'Default is one month; choose any custom date range'} theme={theme} textAlign={textAlign} />
        <Text style={[styles.fieldLabel, { color: theme.colors.text, textAlign }]}>{isRTL ? 'اختصار الفترة' : 'Quick range'}</Text>
        <View style={[styles.segment, { flexDirection: direction, backgroundColor: theme.colors.surface2 }]}>
          <Seg label={isRTL ? 'اليوم' : 'Today'} active={preset === 'today'} onPress={() => applyPreset('today')} theme={theme} />
          <Seg label={isRTL ? '7 أيام' : '7 Days'} active={preset === 'week'} onPress={() => applyPreset('week')} theme={theme} />
          <Seg label={isRTL ? 'شهر' : 'Month'} active={preset === 'month'} onPress={() => applyPreset('month')} theme={theme} />
        </View>

        <Text style={[styles.fieldLabel, { color: theme.colors.text, textAlign }]}>{isRTL ? 'الفترة المطلوبة' : 'Requested period'}</Text>
        <View style={[styles.dateRow, { flexDirection: direction }]}>
          <DateBox label={isRTL ? 'من تاريخ' : 'From'} value={prettyDate(startDate, isRTL)} onPress={() => openDate('start')} theme={theme} textAlign={textAlign} />
          <View style={[styles.dateArrow, { backgroundColor: theme.colors.surface2 }]}><Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={15} color={GOLD} /></View>
          <DateBox label={isRTL ? 'إلى تاريخ' : 'To'} value={prettyDate(endDate, isRTL)} onPress={() => openDate('end')} theme={theme} textAlign={textAlign} />
        </View>

        <Text style={[styles.fieldLabel, { color: theme.colors.text, textAlign }]}>{isRTL ? 'فترة الرحلة' : 'Trip period'}</Text>
        <View style={[styles.segment, { flexDirection: direction, backgroundColor: theme.colors.surface2 }]}>
          <Seg label={isRTL ? 'الكل' : 'All'} active={period === 'all'} onPress={() => setPeriod('all')} theme={theme} />
          <Seg label={isRTL ? 'صباحية' : 'Morning'} active={period === 'morning'} onPress={() => setPeriod('morning')} theme={theme} />
          <Seg label={isRTL ? 'مسائية' : 'Afternoon'} active={period === 'afternoon'} onPress={() => setPeriod('afternoon')} theme={theme} />
        </View>

        <Text style={[styles.fieldLabel, { color: theme.colors.text, textAlign }]}>{isRTL ? 'الطالب' : 'Student'}</Text>
        <Pressable onPress={() => setStudentModal(true)} style={[styles.selector, { flexDirection: direction, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}>
          <View style={styles.selectorIcon}><Ionicons name="person-outline" size={18} color={NAVY} /></View>
          <View style={{ flex: 1 }}><Text style={[styles.selectorMini, { color: theme.colors.muted, textAlign }]}>{isRTL ? 'التقرير خاص بـ' : 'Report for'}</Text><Text style={[styles.selectorValue, { color: theme.colors.text, textAlign }]} numberOfLines={1}>{selectedStudent?.name ?? (isRTL ? 'جميع الطلاب' : 'All students')}</Text></View>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={theme.colors.muted} />
        </Pressable>
      </Card>

      <Card theme={theme}>
        <SectionHeader icon="analytics-outline" title={isRTL ? 'ملخص النتائج' : 'Results summary'} subtitle={isRTL ? `${summary.total} حركة خلال الفترة المحددة` : `${summary.total} records in selected period`} theme={theme} textAlign={textAlign} />
        <View style={[styles.summary, { flexDirection: direction, borderColor: theme.colors.border }]}>
          <Summary icon="enter-outline" value={summary.boarded} label={isRTL ? 'استلام' : 'Boarded'} color="#0D8B61" />
          <Divider theme={theme} /><Summary icon="school-outline" value={summary.arrived} label={isRTL ? 'المدرسة' : 'Arrived'} color="#5363D8" />
          <Divider theme={theme} /><Summary icon="home-outline" value={summary.delivered} label={isRTL ? 'توصيل' : 'Delivered'} color="#087E82" />
          <Divider theme={theme} /><Summary icon="close-circle-outline" value={summary.absent} label={isRTL ? 'غياب' : 'Absent'} color="#C43E47" />
        </View>
      </Card>

      <Card theme={theme}>
        <View style={[styles.exportHead, { flexDirection: direction }]}>
          <SectionHeader icon="print-outline" title={isRTL ? 'التقرير الرسمي' : 'Official report'} subtitle={isRTL ? 'بترويسة المدرسة وشعارها وملخص كامل' : 'School header, logo and complete summary'} theme={theme} textAlign={textAlign} compact />
          <Pressable onPress={() => setColumnsModal(true)} style={[styles.customBtn, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}><Ionicons name="options-outline" size={15} color={GOLD} /><Text style={[styles.customText, { color: theme.colors.text }]}>{isRTL ? 'الأعمدة' : 'Columns'}</Text></Pressable>
        </View>
        <View style={[styles.exportButtons, { flexDirection: direction }]}>
          <Pressable disabled={!!exporting} onPress={() => void exportPdf()} style={[styles.exportBtn, { backgroundColor: '#B83E47' }, !!exporting && styles.disabled]}>{exporting === 'pdf' ? <ActivityIndicator color="#fff" /> : <Ionicons name="document-text-outline" size={21} color="#fff" />}<View><Text style={styles.exportTitle}>PDF</Text><Text style={styles.exportSub}>{isRTL ? 'طباعة ومشاركة' : 'Print & Share'}</Text></View></Pressable>
          <Pressable disabled={!!exporting} onPress={() => void exportExcel()} style={[styles.exportBtn, { backgroundColor: '#167653' }, !!exporting && styles.disabled]}>{exporting === 'excel' ? <ActivityIndicator color="#fff" /> : <Ionicons name="grid-outline" size={21} color="#fff" />}<View><Text style={styles.exportTitle}>Excel</Text><Text style={styles.exportSub}>{isRTL ? 'حفظ وتحليل' : 'Save & Analyze'}</Text></View></Pressable>
        </View>
      </Card>

      <View style={[styles.listHead, { flexDirection: direction }]}><View style={{ flex: 1 }}><Text style={[styles.listTitle, { color: theme.colors.text, textAlign }]}>{isRTL ? 'سجل الحركات' : 'Activity log'}</Text><Text style={[styles.listSub, { color: theme.colors.textSecondary, textAlign }]}>{isRTL ? 'القائمة تبقى ظاهرة أثناء وبعد التصدير' : 'Records remain visible during and after export'}</Text></View><View style={[styles.countBadge, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}><Text style={[styles.countText, { color: theme.colors.text }]}>{rows.length}</Text></View></View>

      {!rows.length ? <View style={[styles.empty, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><Ionicons name="file-tray-outline" size={30} color={theme.colors.muted} /><Text style={[styles.emptyTitle, { color: theme.colors.text }]}>{isRTL ? 'لا توجد حركات ضمن الفترة' : 'No records in this period'}</Text></View> : rows.map((row: any, index) => {
        const st = statusMeta(row.status, isRTL);
        return <View key={String(row.id ?? `${row.student_id}-${row.created_at}-${index}`)} style={[styles.record, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={[styles.recordTop, { flexDirection: direction }]}><View style={[styles.avatar, { backgroundColor: theme.colors.surface2 }]}><Ionicons name="person" size={18} color={GOLD} /></View><View style={{ flex: 1 }}><Text style={[styles.recordName, { color: theme.colors.text, textAlign }]} numberOfLines={1}>{String(row.student_name ?? '—')}</Text><Text style={[styles.recordClass, { color: theme.colors.textSecondary, textAlign }]}>{[row.grade_name, row.section_name].filter(Boolean).join(' • ') || '—'}</Text></View><View style={[styles.status, { backgroundColor: st.bg }]}><Ionicons name={st.icon} size={14} color={st.color} /><Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text></View></View>
          <View style={[styles.recordMeta, { flexDirection: direction, borderTopColor: theme.colors.border }]}><Meta icon="time-outline" value={periodText(row.trip_period, isRTL)} color={theme.colors.textSecondary} /><Meta icon="bus-outline" value={String(row.bus_number ?? '—')} color={theme.colors.textSecondary} /><Meta icon="calendar-outline" value={rowDate(row.created_at, isRTL)} color={theme.colors.textSecondary} /></View>
        </View>;
      })}
      <View style={{ height: 30 }} />
    </ScrollView>

    <DatePickerModal visible={dateModal} onClose={() => setDateModal(false)} month={calendarMonth} setMonth={setCalendarMonth} selected={dateTarget === 'start' ? startDate : endDate} onSelect={chooseDate} isRTL={isRTL} direction={direction} theme={theme} textAlign={textAlign} title={dateTarget === 'start' ? (isRTL ? 'اختر تاريخ البداية' : 'Select start date') : (isRTL ? 'اختر تاريخ النهاية' : 'Select end date')} />

    <PickerSheet visible={studentModal} onClose={() => setStudentModal(false)} title={isRTL ? 'اختيار الطالب' : 'Select student'} theme={theme} direction={direction} textAlign={textAlign}>
      <ChoiceRow title={isRTL ? 'جميع الطلاب' : 'All students'} subtitle={isRTL ? 'عرض التقرير لجميع الطلاب' : 'Show all students'} selected={!studentId} onPress={() => { setStudentId(null); setStudentModal(false); }} theme={theme} direction={direction} textAlign={textAlign} />
      {students.map((s) => <ChoiceRow key={s.id} title={s.name} subtitle={s.subtitle || (isRTL ? 'طالب' : 'Student')} selected={studentId === s.id} onPress={() => { setStudentId(s.id); setStudentModal(false); }} theme={theme} direction={direction} textAlign={textAlign} />)}
    </PickerSheet>

    <PickerSheet visible={columnsModal} onClose={() => setColumnsModal(false)} title={isRTL ? 'أعمدة التقرير' : 'Report columns'} theme={theme} direction={direction} textAlign={textAlign}>
      <View style={[styles.bulkRow, { flexDirection: direction }]}><Pressable onPress={() => setSelectedColumns(TEACHER_REPORT_COLUMNS.map((x) => x.key))} style={[styles.bulkBtn, { backgroundColor: theme.colors.surface2 }]}><Text style={[styles.bulkText, { color: theme.colors.text }]}>{isRTL ? 'تحديد الكل' : 'Select all'}</Text></Pressable><Pressable onPress={() => setSelectedColumns([])} style={[styles.bulkBtn, { backgroundColor: theme.colors.surface2 }]}><Text style={[styles.bulkText, { color: theme.colors.text }]}>{isRTL ? 'إلغاء الكل' : 'Clear all'}</Text></Pressable></View>
      {TEACHER_REPORT_COLUMNS.map((c) => <ChoiceRow key={c.key} title={isRTL ? c.ar : c.en} subtitle={c.key} selected={selectedColumns.includes(c.key)} onPress={() => setSelectedColumns((old) => old.includes(c.key) ? old.filter((x) => x !== c.key) : [...old, c.key])} theme={theme} direction={direction} textAlign={textAlign} />)}
    </PickerSheet>
  </SafeAreaView>;
}

function Card({ children, theme }: any) { return <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>{children}</View>; }
function SectionHeader({ icon, title, subtitle, theme, textAlign, compact }: any) { return <View style={[styles.sectionHead, compact && { flex: 1 }]}><View style={[styles.sectionIcon, { backgroundColor: theme.colors.surface2 }]}><Ionicons name={icon} size={18} color={GOLD} /></View><View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: theme.colors.text, textAlign }]}>{title}</Text><Text style={[styles.sectionSub, { color: theme.colors.textSecondary, textAlign }]}>{subtitle}</Text></View></View>; }
function Seg({ label, active, onPress, theme }: any) { return <Pressable onPress={onPress} style={[styles.segBtn, { backgroundColor: active ? (theme.dark ? GOLD : '#fff') : 'transparent', borderColor: active ? (theme.dark ? GOLD : theme.colors.border) : 'transparent' }]}><Text style={[styles.segText, { color: active ? (theme.dark ? NAVY : theme.colors.text) : theme.colors.textSecondary }]}>{label}</Text></Pressable>; }
function DateBox({ label, value, onPress, theme, textAlign }: any) { return <Pressable onPress={onPress} style={[styles.dateBox, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}><Text style={[styles.dateLabel, { color: theme.colors.muted, textAlign }]}>{label}</Text><View style={styles.dateValueRow}><Ionicons name="calendar-outline" size={16} color={GOLD} /><Text style={[styles.dateValue, { color: theme.colors.text }]}>{value}</Text></View></Pressable>; }
function HeroMetric({ icon, label, value }: any) { return <View style={styles.heroMetric}><Ionicons name={icon} size={16} color={GOLD} /><Text style={styles.heroMetricValue} numberOfLines={1}>{value}</Text><Text style={styles.heroMetricLabel}>{label}</Text></View>; }
function HeroDivider() { return <View style={styles.heroDivider} />; }
function Summary({ icon, value, label, color }: any) { return <View style={styles.summaryItem}><Ionicons name={icon} size={16} color={color} /><Text style={[styles.summaryValue, { color }]}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }
function Divider({ theme }: any) { return <View style={[styles.summaryDivider, { backgroundColor: theme.colors.border }]} />; }
function Meta({ icon, value, color }: any) { return <View style={styles.metaItem}><Ionicons name={icon} size={13} color={color} /><Text style={[styles.metaText, { color }]} numberOfLines={1}>{value}</Text></View>; }

function PickerSheet({ visible, onClose, title, children, theme, direction, textAlign }: any) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBack}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} /><View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}><View style={styles.handle} /><View style={[styles.sheetHead, { flexDirection: direction, borderBottomColor: theme.colors.border }]}><Text style={[styles.sheetTitle, { color: theme.colors.text, textAlign }]}>{title}</Text><Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.colors.surface2 }]}><Ionicons name="close" size={20} color={theme.colors.text} /></Pressable></View><ScrollView contentContainerStyle={styles.sheetList}>{children}</ScrollView></View></View></Modal>;
}

function ChoiceRow({ title, subtitle, selected, onPress, theme, direction, textAlign }: any) {
  return <Pressable onPress={onPress} style={[styles.choice, { flexDirection: direction, backgroundColor: selected ? theme.colors.surface2 : theme.colors.surface, borderColor: selected ? GOLD : theme.colors.border }]}><View style={[styles.check, { backgroundColor: selected ? GOLD : theme.colors.surface2, borderColor: selected ? GOLD : theme.colors.border }]}>{selected ? <Ionicons name="checkmark" size={16} color={NAVY} /> : <Ionicons name="ellipse-outline" size={15} color={theme.colors.muted} />}</View><View style={{ flex: 1 }}><Text style={[styles.choiceTitle, { color: theme.colors.text, textAlign }]}>{title}</Text><Text style={[styles.choiceSub, { color: theme.colors.textSecondary, textAlign }]}>{subtitle}</Text></View></Pressable>;
}

function DatePickerModal({ visible, onClose, month, setMonth, selected, onSelect, isRTL, direction, theme, textAlign, title }: any) {
  const year = month.getFullYear(); const m = month.getMonth();
  const first = new Date(year, m, 1); const days = new Date(year, m + 1, 0).getDate();
  const offset = first.getDay();
  const cells: Array<number | null> = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const monthLabel = month.toLocaleDateString(isRTL ? 'ar-JO' : 'en-US', { month: 'long', year: 'numeric' });
  const names = isRTL ? ['أح','إث','ثل','أر','خم','جم','سب'] : ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const move = (delta: number) => setMonth(new Date(year, m + delta, 1));
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBack}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} /><View style={[styles.calendar, { backgroundColor: theme.colors.surface }]}><View style={[styles.sheetHead, { flexDirection: direction, borderBottomColor: theme.colors.border }]}><Text style={[styles.sheetTitle, { color: theme.colors.text, textAlign }]}>{title}</Text><Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.colors.surface2 }]}><Ionicons name="close" size={20} color={theme.colors.text} /></Pressable></View><View style={styles.calendarBody}><View style={[styles.monthNav, { flexDirection: direction }]}><Pressable onPress={() => move(-1)} style={[styles.monthBtn, { backgroundColor: theme.colors.surface2 }]}><Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={18} color={theme.colors.text} /></Pressable><Text style={[styles.monthTitle, { color: theme.colors.text }]}>{monthLabel}</Text><Pressable onPress={() => move(1)} style={[styles.monthBtn, { backgroundColor: theme.colors.surface2 }]}><Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={theme.colors.text} /></Pressable></View><View style={styles.weekRow}>{names.map((n) => <Text key={n} style={[styles.weekName, { color: theme.colors.muted }]}>{n}</Text>)}</View><View style={styles.daysGrid}>{cells.map((d, i) => { if (!d) return <View key={`e${i}`} style={styles.dayCell} />; const key = dateKey(new Date(year, m, d)); const active = key === selected; return <Pressable key={key} onPress={() => onSelect(key)} style={[styles.dayCell, active && { backgroundColor: GOLD }]}><Text style={[styles.dayText, { color: active ? NAVY : theme.colors.text }]}>{d}</Text></Pressable>; })}</View></View></View></View></Modal>;
}

const styles = StyleSheet.create({
  safe:{flex:1}, loading:{flex:1,alignItems:'center',justifyContent:'center'}, loadingIcon:{width:70,height:70,borderRadius:22,borderWidth:1,alignItems:'center',justifyContent:'center'}, loadingTitle:{marginTop:12,fontSize:15,fontWeight:'900'},
  header:{minHeight:70,alignItems:'center',gap:11,paddingHorizontal:16,paddingVertical:9}, iconBtn:{width:43,height:43,borderRadius:14,borderWidth:1,alignItems:'center',justifyContent:'center'}, kicker:{fontSize:8,fontWeight:'900',letterSpacing:1.2,color:'#B77C12'}, pageTitle:{fontSize:21,fontWeight:'900'}, content:{paddingHorizontal:16,paddingBottom:20},
  hero:{backgroundColor:NAVY,borderRadius:25,padding:17,marginBottom:13,overflow:'hidden'}, heroTop:{alignItems:'center',gap:11}, schoolLogo:{width:47,height:47,borderRadius:15,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',overflow:'hidden',padding:4}, schoolLogoImage:{width:'100%',height:'100%'}, heroLabel:{fontSize:7.5,fontWeight:'900',color:GOLD,letterSpacing:.4}, heroName:{fontSize:15,fontWeight:'900',color:'#fff',marginTop:2}, heroSchool:{fontSize:9.5,fontWeight:'600',color:'#AEC0CB',marginTop:2}, heroMetrics:{marginTop:15,paddingTop:13,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'rgba(255,255,255,.16)',alignItems:'center'}, heroMetric:{flex:1,alignItems:'center',minWidth:0}, heroMetricValue:{fontSize:10,fontWeight:'900',color:'#fff',marginTop:4,maxWidth:'100%'}, heroMetricLabel:{fontSize:7.5,fontWeight:'700',color:'#91A8B6',marginTop:2}, heroDivider:{width:StyleSheet.hairlineWidth,height:32,backgroundColor:'rgba(255,255,255,.16)'},
  card:{borderRadius:21,borderWidth:1,padding:14,marginBottom:13}, sectionHead:{flexDirection:'row',alignItems:'center',gap:9,marginBottom:13}, sectionIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center'}, sectionTitle:{fontSize:13.5,fontWeight:'900'}, sectionSub:{fontSize:8.5,fontWeight:'600',marginTop:2}, fieldLabel:{fontSize:10.5,fontWeight:'900',marginTop:4,marginBottom:7}, segment:{padding:4,borderRadius:13,marginBottom:13}, segBtn:{flex:1,minHeight:37,borderRadius:10,borderWidth:1,alignItems:'center',justifyContent:'center'}, segText:{fontSize:9.5,fontWeight:'900'},
  dateRow:{alignItems:'center',gap:7,marginBottom:13}, dateBox:{flex:1,minHeight:61,borderRadius:14,borderWidth:1,padding:10}, dateLabel:{fontSize:8,fontWeight:'700'}, dateValueRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:6}, dateValue:{fontSize:9.5,fontWeight:'900'}, dateArrow:{width:29,height:29,borderRadius:10,alignItems:'center',justifyContent:'center'}, selector:{minHeight:59,borderRadius:14,borderWidth:1,alignItems:'center',gap:9,paddingHorizontal:10}, selectorIcon:{width:36,height:36,borderRadius:11,backgroundColor:GOLD,alignItems:'center',justifyContent:'center'}, selectorMini:{fontSize:7.5,fontWeight:'700'}, selectorValue:{fontSize:11,fontWeight:'900',marginTop:2},
  summary:{paddingTop:12,borderTopWidth:StyleSheet.hairlineWidth,alignItems:'center'}, summaryItem:{flex:1,alignItems:'center'}, summaryValue:{fontSize:16,fontWeight:'900',marginTop:3}, summaryLabel:{fontSize:7.5,fontWeight:'700',color:'#7A8D9C',marginTop:1}, summaryDivider:{width:StyleSheet.hairlineWidth,height:42}, exportHead:{alignItems:'center',gap:8}, customBtn:{minHeight:36,borderRadius:11,borderWidth:1,paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:5}, customText:{fontSize:8.5,fontWeight:'900'}, exportButtons:{gap:8}, exportBtn:{flex:1,minHeight:58,borderRadius:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8}, exportTitle:{color:'#fff',fontSize:12,fontWeight:'900'}, exportSub:{color:'rgba(255,255,255,.72)',fontSize:7.5,fontWeight:'600'}, disabled:{opacity:.55},
  listHead:{alignItems:'center',marginTop:5,marginBottom:9}, listTitle:{fontSize:14.5,fontWeight:'900'}, listSub:{fontSize:8.5,fontWeight:'600',marginTop:2}, countBadge:{minWidth:38,height:31,borderRadius:10,borderWidth:1,alignItems:'center',justifyContent:'center'}, countText:{fontSize:11,fontWeight:'900'}, empty:{borderRadius:19,borderWidth:1,padding:28,alignItems:'center'}, emptyTitle:{fontSize:12,fontWeight:'900',marginTop:8}, record:{borderRadius:17,borderWidth:1,padding:11,marginBottom:8}, recordTop:{alignItems:'center',gap:9}, avatar:{width:39,height:39,borderRadius:12,alignItems:'center',justifyContent:'center'}, recordName:{fontSize:11.5,fontWeight:'900'}, recordClass:{fontSize:8,fontWeight:'600',marginTop:2}, status:{minHeight:28,borderRadius:999,paddingHorizontal:8,flexDirection:'row',alignItems:'center',gap:4}, statusText:{fontSize:7.5,fontWeight:'900'}, recordMeta:{marginTop:10,paddingTop:9,borderTopWidth:StyleSheet.hairlineWidth,gap:8}, metaItem:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:4}, metaText:{flex:1,fontSize:7.5,fontWeight:'700'},
  modalBack:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(2,12,20,.64)'}, sheet:{maxHeight:'84%',borderTopLeftRadius:27,borderTopRightRadius:27,overflow:'hidden'}, handle:{width:39,height:4,borderRadius:999,backgroundColor:'#A6B2BB',alignSelf:'center',marginTop:9}, sheetHead:{alignItems:'center',gap:10,padding:15,borderBottomWidth:StyleSheet.hairlineWidth}, sheetTitle:{flex:1,fontSize:15,fontWeight:'900'}, closeBtn:{width:36,height:36,borderRadius:11,alignItems:'center',justifyContent:'center'}, sheetList:{padding:14,paddingBottom:25}, choice:{minHeight:58,borderRadius:15,borderWidth:1,alignItems:'center',gap:10,paddingHorizontal:11,marginBottom:8}, check:{width:34,height:34,borderRadius:11,borderWidth:1,alignItems:'center',justifyContent:'center'}, choiceTitle:{fontSize:11,fontWeight:'900'}, choiceSub:{fontSize:7.5,fontWeight:'600',marginTop:2}, bulkRow:{gap:8,marginBottom:9}, bulkBtn:{flex:1,minHeight:37,borderRadius:11,alignItems:'center',justifyContent:'center'}, bulkText:{fontSize:8.5,fontWeight:'900'},
  calendar:{borderTopLeftRadius:27,borderTopRightRadius:27,overflow:'hidden'}, calendarBody:{padding:15,paddingBottom:28}, monthNav:{alignItems:'center',justifyContent:'space-between',marginBottom:14}, monthBtn:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center'}, monthTitle:{fontSize:14,fontWeight:'900'}, weekRow:{flexDirection:'row',marginBottom:5}, weekName:{width:'14.285%',textAlign:'center',fontSize:8,fontWeight:'800'}, daysGrid:{flexDirection:'row',flexWrap:'wrap'}, dayCell:{width:'14.285%',aspectRatio:1,alignItems:'center',justifyContent:'center',borderRadius:12}, dayText:{fontSize:10.5,fontWeight:'800'},
});