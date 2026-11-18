import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../hooks/useAuth';
import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { getDriverDashboard } from '../../services/driverService';
import {
  DriverNotificationItem,
  getDriverNotifications,
  isDriverNotificationUnread,
  markAllDriverNotificationsRead,
  markDriverNotificationRead,
  normalizeDriverNotificationType,
} from '../../services/notificationService';

type FilterKey =
  | 'all' | 'unread' | 'requests' | 'approved' | 'rejected'
  | 'trip' | 'student' | 'incident' | 'school';

function dataOf(item: DriverNotificationItem): Record<string, any> {
  const value = (item as any).data;
  return value && typeof value === 'object' ? value : {};
}

function isParentRequest(item: DriverNotificationItem) {
  const type = normalizeDriverNotificationType(item.type);
  const source = String(dataOf(item).source ?? '').toLowerCase();
  return type === 'parent_request' || type === 'parent_request_updated' ||
    type === 'parent_request_decision' || source.includes('parent_request');
}

function requestStatus(item: DriverNotificationItem) {
  const data = dataOf(item);
  return String(data.decision ?? data.request_status ?? data.status ?? (item as any).request_status ?? 'pending').toLowerCase();
}

function category(item: DriverNotificationItem): Exclude<FilterKey, 'all' | 'unread' | 'requests' | 'approved' | 'rejected'> {
  if (isParentRequest(item)) return 'school';
  const value = `${item.type ?? ''} ${(item as any).title ?? ''}`.toLowerCase();
  if (value.includes('incident') || value.includes('delay') || value.includes('warning') || value.includes('alert')) return 'incident';
  if (value.includes('student') || value.includes('board') || value.includes('deliver') || value.includes('absent') || value.includes('pick')) return 'student';
  if (value.includes('school') || value.includes('broadcast') || value.includes('announcement')) return 'school';
  return 'trip';
}

function tone(item: DriverNotificationItem) {
  if (isParentRequest(item)) {
    const status = requestStatus(item);
    if (status === 'approved') return { color: '#15803D', bg: '#F0FDF4', border: '#22C55E', icon: 'checkmark-circle' as const };
    if (status === 'rejected') return { color: '#B42318', bg: '#FFF1F2', border: '#EF4444', icon: 'close-circle' as const };
    return { color: '#B45309', bg: '#FFFBEB', border: '#F59E0B', icon: 'time' as const };
  }

  const group = category(item);
  if (group === 'incident') return { color: '#B42318', bg: '#FFF1F2', border: '#EF4444', icon: 'warning' as const };
  if (group === 'student') return { color: '#15803D', bg: '#F0FDF4', border: '#22C55E', icon: 'people' as const };
  if (group === 'school') return { color: '#7C3AED', bg: '#F5F3FF', border: '#8B5CF6', icon: 'megaphone' as const };
  return { color: '#1D4ED8', bg: '#EFF6FF', border: '#3B82F6', icon: 'bus' as const };
}

function titleOf(item: DriverNotificationItem, rtl: boolean) {
  if (isParentRequest(item)) {
    const status = requestStatus(item);
    if (status === 'approved') return rtl ? 'طلب ولي أمر معتمد' : 'Approved Parent Request';
    if (status === 'rejected') return rtl ? 'طلب ولي أمر مرفوض' : 'Rejected Parent Request';
    return rtl ? 'طلب ولي أمر قيد الانتظار' : 'Pending Parent Request';
  }
  return String((item as any).title ?? (rtl ? 'تنبيه جديد' : 'New Alert'));
}

function bodyOf(item: DriverNotificationItem) {
  return String((item as any).body ?? (item as any).message ?? '');
}

function statusLabel(item: DriverNotificationItem, rtl: boolean) {
  const status = requestStatus(item);
  if (status === 'approved') return rtl ? 'معتمد' : 'Approved';
  if (status === 'rejected') return rtl ? 'مرفوض' : 'Rejected';
  return rtl ? 'بانتظار الاعتماد' : 'Pending';
}


function dateOnly(value: unknown) {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function inDateRange(value: unknown, fromDate: string, toDate: string) {
  const key = dateOnly(value);
  if (!key) return !fromDate && !toDate;
  if (fromDate && key < fromDate) return false;
  if (toDate && key > toDate) return false;
  return true;
}

export default function DriverNotifications() {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();

  const [notifications, setNotifications] = useState<DriverNotificationItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [draftFilter, setDraftFilter] = useState<FilterKey>('all');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [draftFromDate, setDraftFromDate] = useState('');
  const [draftToDate, setDraftToDate] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DriverNotificationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const driverId = user?.id ?? null;

  const load = useCallback(async (spinner = true) => {
    if (!driverId) { setLoading(false); return; }
    if (spinner) setLoading(true);
    try {
      const dashboard = await getDriverDashboard({
        driverId,
        schoolId: user?.school_id ?? null,
        busId: user?.bus_id ?? null,
        busNumber: user?.bus_number ?? null,
      });
      const rows = await getDriverNotifications({
        driverId,
        schoolId: dashboard?.school?.id ?? user?.school_id ?? null,
        busId: dashboard?.bus?.id ?? user?.bus_id ?? null,
        routeId: dashboard?.route?.id ?? null,
        limit: 200,
      });
      setNotifications(rows);
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر تحميل التنبيهات' : 'Unable to Load Alerts', String(error?.message ?? error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId, user?.school_id, user?.bus_id, user?.bus_number, isRTL]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    all: notifications.length,
    unread: notifications.filter(isDriverNotificationUnread).length,
    requests: notifications.filter(isParentRequest).length,
    approved: notifications.filter((x) => isParentRequest(x) && requestStatus(x) === 'approved').length,
    rejected: notifications.filter((x) => isParentRequest(x) && requestStatus(x) === 'rejected').length,
    trip: notifications.filter((x) => category(x) === 'trip').length,
    student: notifications.filter((x) => category(x) === 'student').length,
    incident: notifications.filter((x) => category(x) === 'incident').length,
    school: notifications.filter((x) => category(x) === 'school' && !isParentRequest(x)).length,
  }), [notifications]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notifications.filter((item) => {
      if (filter === 'unread' && !isDriverNotificationUnread(item)) return false;
      if (filter === 'requests' && !isParentRequest(item)) return false;
      if (filter === 'approved' && !(isParentRequest(item) && requestStatus(item) === 'approved')) return false;
      if (filter === 'rejected' && !(isParentRequest(item) && requestStatus(item) === 'rejected')) return false;
      if (['trip', 'student', 'incident'].includes(filter) && category(item) !== filter) return false;
      if (filter === 'school' && (category(item) !== 'school' || isParentRequest(item))) return false;
      if (!inDateRange((item as any).created_at, fromDate, toDate)) return false;
      if (!q) return true;
      return `${titleOf(item, isRTL)} ${bodyOf(item)}`.toLowerCase().includes(q);
    });
  }, [notifications, filter, search, isRTL, fromDate, toDate]);

  async function open(item: DriverNotificationItem) {
    setSelected(item);
    if (!isDriverNotificationUnread(item)) return;
    try {
      await markDriverNotificationRead(item.id);
      setNotifications((current) => current.map((x) => x.id === item.id ? { ...x, status: 'read' } : x));
    } catch {}
  }

  async function markAll() {
    if (!driverId || !counts.unread) return;
    try {
      await markAllDriverNotificationsRead(driverId);
      setNotifications((current) => current.map((x) => ({ ...x, status: 'read' })));
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر تحديث التنبيهات' : 'Unable to Update Alerts', String(error?.message ?? error));
    }
  }

  if (loading) {
    return <View style={[styles.loading, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" color="#F7B83A" /></View>;
  }

  const semanticCardText = '#102A43';
  const semanticCardMuted = '#52667A';

  const filters: FilterKey[] = ['all', 'unread', 'requests', 'approved', 'rejected', 'trip', 'student', 'incident', 'school'];

  const label = (key: FilterKey) =>
    key === 'all' ? (isRTL ? 'الكل' : 'All') :
    key === 'unread' ? (isRTL ? 'جديد' : 'Unread') :
    key === 'requests' ? (isRTL ? 'طلبات الأهالي' : 'Parent Requests') :
    key === 'approved' ? (isRTL ? 'معتمدة' : 'Approved') :
    key === 'rejected' ? (isRTL ? 'مرفوضة' : 'Rejected') :
    key === 'trip' ? (isRTL ? 'الرحلات' : 'Trips') :
    key === 'student' ? (isRTL ? 'الطلاب' : 'Students') :
    key === 'incident' ? (isRTL ? 'الحوادث' : 'Incidents') :
    (isRTL ? 'المدرسة' : 'School');

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { flexDirection: direction }]}>
        <View style={styles.logo}><Ionicons name="notifications" size={24} color="#082338" /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.colors.text, textAlign }]}>{isRTL ? 'تنبيهات السائق' : 'Driver Alerts'}</Text>
          <Text style={[styles.sub, { textAlign }]}>{isRTL ? 'متابعة الرحلة والطلاب وطلبات الأهالي المعتمدة' : 'Trips, students and parent request outcomes'}</Text>
        </View>
        {!!counts.unread && <Pressable style={styles.readAll} onPress={() => void markAll()}><Ionicons name="checkmark-done" size={20} color="#082338" /></Pressable>}
      </View>

      <View style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}>
        <Ionicons name="search" size={18} color="#8493A0" />
        <TextInput value={search} onChangeText={setSearch} placeholder={isRTL ? 'بحث في التنبيهات...' : 'Search alerts...'} placeholderTextColor="#8493A0" style={[styles.input, { color: theme.colors.text, textAlign }]} />
      </View>

      <View style={[styles.filterBar, { flexDirection: direction }]}>
        <Pressable onPress={() => { setDraftFilter(filter); setDraftFromDate(fromDate); setDraftToDate(toDate); setFiltersVisible(true); }} style={[styles.filterButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}>
          <Ionicons name="options-outline" size={19} color="#082338" />
          <Text style={[styles.filterButtonText, { color: theme.colors.text }]}>{isRTL ? 'فلترة' : 'Filters'}</Text>
          {(filter !== 'all' || fromDate || toDate) ? <View style={styles.activeDot} /> : null}
        </Pressable>
        {(filter !== 'all' || fromDate || toDate) && <Text style={[styles.filterSummary, { color: theme.colors.textSecondary, textAlign }]}>{filter !== 'all' ? label(filter) : ''}{fromDate || toDate ? `  ${fromDate || '…'} → ${toDate || '…'}` : ''}</Text>}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor="#F7B83A" onRefresh={() => { setRefreshing(true); void load(false); }} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const meta = tone(item);
          return (
            <Pressable onPress={() => void open(item)} style={[styles.card, { backgroundColor: meta.bg, borderColor: meta.border, flexDirection: direction }]}>
              <View style={[styles.icon, { backgroundColor: '#FFFFFF' }]}><Ionicons name={meta.icon} size={22} color={meta.color} /></View>
              <View style={{ flex: 1 }}>
                <View style={[styles.row, { flexDirection: direction }]}>
                  <Text style={[styles.cardTitle, { color: meta.color, textAlign }]}>{titleOf(item, isRTL)}</Text>
                  {isParentRequest(item) && <View style={[styles.badge, { borderColor: meta.border }]}><Text style={[styles.badgeText, { color: meta.color }]}>{statusLabel(item, isRTL)}</Text></View>}
                </View>
                <Text numberOfLines={2} style={[styles.body, { color: semanticCardText, textAlign }]}>{bodyOf(item) || (isRTL ? 'لا توجد تفاصيل إضافية.' : 'No additional details.')}</Text>
                <Text style={[styles.date, { color: semanticCardMuted, textAlign }]}>{(item as any).created_at ? new Date((item as any).created_at).toLocaleString(isRTL ? 'ar-JO' : 'en-US') : '—'}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="notifications-off-outline" size={42} color="#98A2B3" /><Text style={{ color: theme.colors.text }}>{isRTL ? 'لا توجد تنبيهات ضمن هذا الفلتر' : 'No alerts in this filter'}</Text></View>}
      />

      <Modal visible={filtersVisible} transparent animationType="slide" onRequestClose={() => setFiltersVisible(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFiltersVisible(false)} />
          <View style={[styles.filterModal, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.modalHead, { flexDirection: direction }]}>
              <View style={styles.modalIcon}><Ionicons name="options-outline" size={23} color="#082338" /></View>
              <Text style={[styles.modalTitle, { flex: 1, color: theme.colors.text, textAlign }]}>{isRTL ? 'إعدادات الفلترة' : 'Filter Settings'}</Text>
              <Pressable onPress={() => setFiltersVisible(false)}><Ionicons name="close-circle" size={28} color={theme.colors.textSecondary} /></Pressable>
            </View>
            <Text style={[styles.sectionLabel, { color: theme.colors.text, textAlign }]}>{isRTL ? 'نوع / حالة الإشعار' : 'Notification Type / Status'}</Text>
            <View style={[styles.optionGrid, { flexDirection: direction }]}>
              {filters.map((key) => <Pressable key={key} onPress={() => setDraftFilter(key)} style={[styles.option, { borderColor: draftFilter === key ? '#F7B83A' : theme.colors.border, backgroundColor: draftFilter === key ? '#FFF4D6' : theme.colors.surface2 }]}><Text style={[styles.optionText, { color: draftFilter === key ? '#102A43' : theme.colors.text }]}>{label(key)} ({counts[key]})</Text></Pressable>)}
            </View>
            <Text style={[styles.sectionLabel, { color: theme.colors.text, textAlign }]}>{isRTL ? 'الفترة الزمنية' : 'Date Range'}</Text>
            <View style={[styles.dateRow, { flexDirection: direction }]}>
              <View style={styles.dateField}><Text style={[styles.dateLabel, { color: theme.colors.textSecondary, textAlign }]}>{isRTL ? 'من' : 'From'}</Text><TextInput value={draftFromDate} onChangeText={setDraftFromDate} placeholder="YYYY-MM-DD" placeholderTextColor="#98A2B3" style={[styles.dateInput, { color: theme.colors.text, borderColor: theme.colors.border, textAlign }]} /></View>
              <View style={styles.dateField}><Text style={[styles.dateLabel, { color: theme.colors.textSecondary, textAlign }]}>{isRTL ? 'إلى' : 'To'}</Text><TextInput value={draftToDate} onChangeText={setDraftToDate} placeholder="YYYY-MM-DD" placeholderTextColor="#98A2B3" style={[styles.dateInput, { color: theme.colors.text, borderColor: theme.colors.border, textAlign }]} /></View>
            </View>
            <View style={[styles.filterActions, { flexDirection: direction }]}>
              <Pressable onPress={() => { setDraftFilter('all'); setDraftFromDate(''); setDraftToDate(''); }} style={[styles.clearButton, { borderColor: theme.colors.border }]}><Text style={[styles.clearText, { color: theme.colors.text }]}>{isRTL ? 'مسح الكل' : 'Clear All'}</Text></Pressable>
              <Pressable onPress={() => { setFilter(draftFilter); setFromDate(draftFromDate.trim()); setToDate(draftToDate.trim()); setFiltersVisible(false); }} style={styles.applyButton}><Ionicons name="checkmark" size={18} color="#082338" /><Text style={styles.applyText}>{isRTL ? 'تطبيق' : 'Apply'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          {!!selected && (() => {
            const meta = tone(selected);
            return <View style={[styles.modal, { backgroundColor: theme.colors.surface, borderColor: meta.border }]}>
              <View style={[styles.modalHead, { flexDirection: direction }]}>
                <View style={[styles.modalIcon, { backgroundColor: meta.bg }]}><Ionicons name={meta.icon} size={25} color={meta.color} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: meta.color, textAlign }]}>{titleOf(selected, isRTL)}</Text>
                  {isParentRequest(selected) && <Text style={[styles.modalStatus, { color: meta.color, textAlign }]}>{statusLabel(selected, isRTL)}</Text>}
                </View>
                <Pressable onPress={() => setSelected(null)}><Ionicons name="close-circle" size={28} color={theme.colors.textSecondary} /></Pressable>
              </View>
              <View style={[styles.messageBox, { backgroundColor: meta.bg }]}>
                <Text style={[styles.message, { color: semanticCardText, textAlign }]}>{bodyOf(selected) || (isRTL ? 'لا توجد تفاصيل إضافية.' : 'No additional details.')}</Text>
              </View>
              {isParentRequest(selected) && <View style={styles.infoOnly}><Ionicons name="information-circle" size={19} color="#64748B" /><Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>{isRTL ? 'هذا الإشعار للمعلومة والتنفيذ فقط. الموافقة والرفض من الإدارة أو المعلم.' : 'Information/action only. Approval or rejection is handled by school administration or the teacher.'}</Text></View>}
            </View>;
          })()}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 16, alignItems: 'center', gap: 10 }, logo: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '900' }, sub: { marginTop: 3, fontSize: 9, color: '#8493A0', fontWeight: '700' },
  readAll: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: 14, borderWidth: 1, borderRadius: 17, minHeight: 52, paddingHorizontal: 12, alignItems: 'center', gap: 8 },
  input: { flex: 1, height: 50, fontSize: 12, fontWeight: '700' },
  filters: { paddingHorizontal: 14, paddingVertical: 11, gap: 7 },
  filterBar: { paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', gap: 10 },
  filterButton: { minHeight: 44, borderRadius: 14, borderWidth: 1, paddingHorizontal: 13, alignItems: 'center', gap: 7 },
  filterButtonText: { fontSize: 10, fontWeight: '900' },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' },
  filterSummary: { flex: 1, fontSize: 9, fontWeight: '700' },
  filterModal: { borderRadius: 26, borderWidth: 1, padding: 16, maxHeight: '88%' },
  sectionLabel: { marginTop: 16, marginBottom: 8, fontSize: 11, fontWeight: '900' },
  optionGrid: { flexWrap: 'wrap', gap: 7 },
  option: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9 },
  optionText: { fontSize: 9, fontWeight: '900' },
  dateRow: { gap: 8 }, dateField: { flex: 1 }, dateLabel: { marginBottom: 5, fontSize: 9, fontWeight: '800' },
  dateInput: { height: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, fontSize: 11, fontWeight: '800' },
  filterActions: { marginTop: 18, gap: 8 },
  clearButton: { flex: 1, height: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 10, fontWeight: '900' },
  applyButton: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  applyText: { color: '#082338', fontSize: 10, fontWeight: '900' }, filter: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  filterText: { fontSize: 9, fontWeight: '900' }, list: { paddingHorizontal: 14, paddingBottom: 100, gap: 8 },
  card: { borderWidth: 1, borderLeftWidth: 5, borderRadius: 20, padding: 12, gap: 10, minHeight: 92 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  row: { alignItems: 'center', gap: 8 }, cardTitle: { flex: 1, fontSize: 11, fontWeight: '900' },
  body: { marginTop: 5, fontSize: 9, lineHeight: 14, fontWeight: '600' }, date: { marginTop: 7, fontSize: 8, fontWeight: '700' },
  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 }, badgeText: { fontSize: 7, fontWeight: '900' },
  empty: { paddingTop: 80, alignItems: 'center', gap: 10 }, backdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(5,20,32,.55)' },
  modal: { borderWidth: 1, borderRadius: 26, padding: 16 }, modalHead: { alignItems: 'center', gap: 10 },
  modalIcon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, modalTitle: { fontSize: 15, fontWeight: '900' },
  modalStatus: { marginTop: 4, fontSize: 10, fontWeight: '900' }, messageBox: { marginTop: 15, borderRadius: 18, padding: 14 },
  message: { fontSize: 10, lineHeight: 17, fontWeight: '700' }, infoOnly: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  infoText: { flex: 1, fontSize: 9, lineHeight: 14, fontWeight: '700' },
});
