import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../hooks/useAuth';
import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  decideTeacherParentRequest,
  getTeacherNotifications,
  isTeacherNotificationUnread,
  markAllTeacherNotificationsRead,
  markTeacherNotificationRead,
  subscribeTeacherNotifications,
  teacherNotificationBody,
  teacherNotificationTitle,
  type TeacherNotificationItem,
} from '../../services/teacherNotificationService';

type Filter = 'all' | 'needs_action' | 'pending' | 'approved' | 'rejected' | 'unread' | 'requests' | 'trip' | 'student' | 'school';

function dataOf(item: TeacherNotificationItem) {
  return item.data && typeof item.data === 'object' ? item.data : {};
}

function requestIdOf(item: TeacherNotificationItem) {
  const data = dataOf(item);
  const raw = data.request_id ?? data.source_id;
  if (raw) return String(raw);
  return item.id.startsWith('parent_request:') ? item.id.slice('parent_request:'.length) : null;
}

function isParentRequest(item: TeacherNotificationItem) {
  const type = String(item.type ?? '').toLowerCase();
  const source = String(dataOf(item).source ?? '').toLowerCase();
  return type.includes('parent_request') || source === 'parent_requests' || source === 'parent_request';
}

function requestStatus(item: TeacherNotificationItem) {
  return String(dataOf(item).request_status ?? dataOf(item).status ?? 'pending').toLowerCase();
}

function group(item: TeacherNotificationItem): Exclude<Filter, 'all' | 'unread'> {
  const value = `${item.type ?? ''} ${item.title ?? ''}`.toLowerCase();
  if (value.includes('parent') || value.includes('student') || value.includes('boarded') || value.includes('delivered') || value.includes('absent')) return 'student';
  if (value.includes('school') || value.includes('broadcast') || value.includes('announcement')) return 'school';
  return 'trip';
}

function statusLabel(value: string, isRTL: boolean) {
  if (value === 'approved') return isRTL ? 'تمت الموافقة' : 'Approved';
  if (value === 'rejected') return isRTL ? 'مرفوض' : 'Rejected';
  return isRTL ? 'بانتظار القرار' : 'Pending';
}

function requestTypeLabel(value: unknown, isRTL: boolean) {
  const key = String(value ?? '').toLowerCase();
  const map: Record<string, [string, string]> = {
    absence: ['غياب / إجازة', 'Absence / Leave'],
    no_bus: ['عدم استخدام الباص', 'Not Riding Bus'],
    pickup_change: ['تغيير الاستلام', 'Pickup Change'],
    dropoff_change: ['تغيير التوصيل', 'Drop-off Change'],
    transport: ['طلب نقل', 'Transport Request'],
    delay: ['تأخير / ملاحظة', 'Delay / Note'],
    bus_issue: ['مشكلة بالباص', 'Bus Issue'],
    school_request: ['طلب للمدرسة', 'School Request'],
    complaint: ['شكوى', 'Complaint'],
    other: ['أخرى', 'Other'],
  };
  const row = map[key] ?? [String(value ?? '—'), String(value ?? '—')];
  return isRTL ? row[0] : row[1];
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

export default function TeacherNotificationsScreen() {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();

  const [rows, setRows] = useState<TeacherNotificationItem[]>([]);
  const [selected, setSelected] = useState<TeacherNotificationItem | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [draftFilter, setDraftFilter] = useState<Filter>('all');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [draftFromDate, setDraftFromDate] = useState('');
  const [draftToDate, setDraftToDate] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const result = await getTeacherNotifications({
        teacherId: user.id,
        schoolId: user.school_id ?? null,
      });
      setRows(result);

      setSelected((current) => {
        if (!current) return null;
        const id = requestIdOf(current);
        return result.find((row) => row.id === current.id || (id && requestIdOf(row) === id)) ?? current;
      });
    } catch (error) {
      console.log('TeacherNotifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, user?.school_id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    return subscribeTeacherNotifications(user.id, () => void load(false));
  }, [user?.id, load]);

  const counts = useMemo(() => ({
    all: rows.length,
    needs_action: rows.filter((x) => isParentRequest(x) && requestStatus(x) === 'pending').length,
    pending: rows.filter((x) => isParentRequest(x) && requestStatus(x) === 'pending').length,
    approved: rows.filter((x) => isParentRequest(x) && requestStatus(x) === 'approved').length,
    rejected: rows.filter((x) => isParentRequest(x) && requestStatus(x) === 'rejected').length,
    unread: rows.filter(isTeacherNotificationUnread).length,
    requests: rows.filter(isParentRequest).length,
    trip: rows.filter((x) => group(x) === 'trip').length,
    student: rows.filter((x) => group(x) === 'student').length,
    school: rows.filter((x) => group(x) === 'school').length,
  }), [rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((item) => {
      if (filter === 'needs_action' && !(isParentRequest(item) && requestStatus(item) === 'pending')) return false;
      if (filter === 'pending' && !(isParentRequest(item) && requestStatus(item) === 'pending')) return false;
      if (filter === 'approved' && !(isParentRequest(item) && requestStatus(item) === 'approved')) return false;
      if (filter === 'rejected' && !(isParentRequest(item) && requestStatus(item) === 'rejected')) return false;
      if (filter === 'unread' && !isTeacherNotificationUnread(item)) return false;
      if (filter === 'requests' && !isParentRequest(item)) return false;
      if (['trip', 'student', 'school'].includes(filter) && group(item) !== filter) return false;
      const dateValue = isParentRequest(item)
        ? (dataOf(item).date_from ?? item.created_at)
        : item.created_at;
      if (!inDateRange(dateValue, fromDate, toDate)) return false;
      if (!term) return true;
      return `${teacherNotificationTitle(item, isRTL)} ${teacherNotificationBody(item, isRTL)}`
        .toLowerCase()
        .includes(term);
    });
  }, [rows, filter, search, isRTL, fromDate, toDate]);

  async function openItem(item: TeacherNotificationItem) {
    setSelected(item);
    if (!isTeacherNotificationUnread(item)) return;
    try {
      await markTeacherNotificationRead(item.id);
      setRows((current) => current.map((row) => row.id === item.id ? { ...row, is_read: true } : row));
    } catch {}
  }

  async function decide(decision: 'approved' | 'rejected') {
    if (!selected || !user?.id || !user.school_id) return;
    const requestId = requestIdOf(selected);
    if (!requestId) return;

    setDeciding(true);
    try {
      await decideTeacherParentRequest({
        requestId,
        schoolId: user.school_id,
        teacherId: user.id,
        decision,
      });
      await load(false);
      Alert.alert(
        isRTL ? 'تم حفظ القرار' : 'Decision Saved',
        decision === 'approved'
          ? (isRTL ? 'تمت الموافقة على طلب ولي الأمر.' : 'The parent request was approved.')
          : (isRTL ? 'تم رفض طلب ولي الأمر.' : 'The parent request was rejected.')
      );
    } catch (error: any) {
      if (String(error?.message ?? '') === 'request_already_decided') {
        await load(false);
        Alert.alert(
          isRTL ? 'تم حسم الطلب' : 'Request Already Decided',
          isRTL ? 'قام طرف آخر بحسم الطلب قبلك، وتم تحديث الحالة.' : 'Another authorized user decided this request first. The status has been refreshed.'
        );
      } else {
        Alert.alert(isRTL ? 'تعذر حفظ القرار' : 'Unable to Save', String(error?.message ?? error));
      }
    } finally {
      setDeciding(false);
    }
  }

  if (loading) {
    return <View style={[styles.loading, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" color="#F7B83A" /></View>;
  }

  const selectedData = selected ? dataOf(selected) : {};
  const selectedStatus = selected ? requestStatus(selected) : '';
  const canDecide = !!selected && isParentRequest(selected) && selectedStatus === 'pending';

  const semanticCardText = '#102A43';
  const semanticCardMuted = '#52667A';

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { flexDirection: direction }]}>
        <View style={styles.headerIcon}><Ionicons name="notifications" size={23} color="#0A2D44" /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.colors.text, textAlign }]}>{isRTL ? 'إشعارات المعلم' : 'Teacher Notifications'}</Text>
          <Text style={[styles.headerSub, { color: theme.colors.textSecondary, textAlign }]}>{isRTL ? `${counts.unread} غير مقروء` : `${counts.unread} unread`}</Text>
        </View>
        {!!counts.unread && (
          <Pressable
            onPress={() => void markAllTeacherNotificationsRead(user?.id ?? '').then(() => load(false))}
            style={styles.readAll}
          >
            <Ionicons name="checkmark-done" size={19} color="#0A2D44" />
          </Pressable>
        )}
      </View>

      <View style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}>
        <Ionicons name="search" size={18} color="#8191A0" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={isRTL ? 'بحث في الإشعارات...' : 'Search notifications...'}
          placeholderTextColor="#8191A0"
          style={[styles.searchInput, { color: theme.colors.text, textAlign }]}
        />
      </View>

      <View style={[styles.filterBar, { flexDirection: direction }]}>
        <Pressable
          onPress={() => {
            setDraftFilter(filter);
            setDraftFromDate(fromDate);
            setDraftToDate(toDate);
            setFiltersVisible(true);
          }}
          style={[styles.filterButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}
        >
          <Ionicons name="options-outline" size={19} color="#0A2D44" />
          <Text style={[styles.filterButtonText, { color: theme.colors.text }]}>
            {isRTL ? 'فلترة' : 'Filters'}
          </Text>
          {(filter !== 'all' || fromDate || toDate) ? <View style={styles.activeDot} /> : null}
        </Pressable>
        {(filter !== 'all' || fromDate || toDate) && (
          <Text style={[styles.filterSummary, { color: theme.colors.textSecondary, textAlign }]}>
            {filter !== 'all' ? `${isRTL ? 'فلتر مفعّل' : 'Filtered'}` : ''}
            {fromDate || toDate ? `  ${fromDate || '…'} → ${toDate || '…'}` : ''}
          </Text>
        )}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor="#F7B83A" onRefresh={() => void load(true)} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const parentRequest = isParentRequest(item);
          const status = requestStatus(item);
          return (
            <Pressable
              onPress={() => void openItem(item)}
              style={[styles.card, {
                backgroundColor: parentRequest
                  ? status === 'approved' ? '#F0FDF4'
                  : status === 'rejected' ? '#FFF1F2'
                  : '#FFFBEB'
                  : theme.colors.surface,
                borderColor: parentRequest
                  ? status === 'approved' ? '#22C55E'
                  : status === 'rejected' ? '#EF4444'
                  : '#F59E0B'
                  : isTeacherNotificationUnread(item) ? '#3B82F6' : theme.colors.border,
                borderLeftWidth: 5,
                flexDirection: direction
              }]}
            >
              <View style={styles.cardIcon}>
                <Ionicons name={parentRequest ? 'document-text-outline' : 'notifications-outline'} size={21} color="#0A2D44" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={[styles.row, { flexDirection: direction }]}>
                  <Text style={[styles.cardTitle, { color: parentRequest ? semanticCardText : theme.colors.text, textAlign }]}>{teacherNotificationTitle(item, isRTL)}</Text>
                  {parentRequest && <View style={[styles.status, status === 'approved' ? styles.approved : status === 'rejected' ? styles.rejected : styles.pending]}><Text style={styles.statusText}>{statusLabel(status, isRTL)}</Text></View>}
                </View>
                <Text numberOfLines={2} style={[styles.body, { color: parentRequest ? semanticCardMuted : theme.colors.textSecondary, textAlign }]}>{teacherNotificationBody(item, isRTL)}</Text>
                <Text style={[styles.date, { color: parentRequest ? semanticCardMuted : theme.colors.textSecondary, textAlign }]}>{item.created_at ? new Date(item.created_at).toLocaleString(isRTL ? 'ar-JO' : 'en-US') : '—'}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="notifications-off-outline" size={40} color="#98A2B3" /><Text style={{ color: theme.colors.text }}>{isRTL ? 'لا توجد إشعارات' : 'No Notifications'}</Text></View>}
      />

      <Modal transparent animationType="slide" visible={filtersVisible} onRequestClose={() => setFiltersVisible(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFiltersVisible(false)} />
          <View style={[styles.filterModal, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.modalHead, { flexDirection: direction }]}>
              <View style={styles.modalIcon}><Ionicons name="options-outline" size={23} color="#0A2D44" /></View>
              <Text style={[styles.modalTitle, { flex: 1, color: theme.colors.text, textAlign }]}>{isRTL ? 'إعدادات الفلترة' : 'Filter Settings'}</Text>
              <Pressable onPress={() => setFiltersVisible(false)}><Ionicons name="close-circle" size={28} color={theme.colors.textSecondary} /></Pressable>
            </View>

            <Text style={[styles.sectionLabel, { color: theme.colors.text, textAlign }]}>{isRTL ? 'نوع / حالة الإشعار' : 'Notification Type / Status'}</Text>
            <View style={[styles.optionGrid, { flexDirection: direction }]}>
              {(['all','needs_action','pending','approved','rejected','unread','requests','trip','student','school'] as Filter[]).map((key) => (
                <Pressable key={key} onPress={() => setDraftFilter(key)} style={[styles.option, { borderColor: draftFilter === key ? '#F7B83A' : theme.colors.border, backgroundColor: draftFilter === key ? '#FFF4D6' : theme.colors.surface2 }]}>
                  <Text style={[styles.optionText, { color: draftFilter === key ? '#102A43' : theme.colors.text }]}>
                    {key === 'all' ? (isRTL ? 'الكل' : 'All') :
                     key === 'needs_action' ? (isRTL ? 'يحتاج موافقتي' : 'Needs My Decision') :
                     key === 'pending' ? (isRTL ? 'قيد الانتظار' : 'Pending') :
                     key === 'approved' ? (isRTL ? 'تمت الموافقة' : 'Approved') :
                     key === 'rejected' ? (isRTL ? 'مرفوض' : 'Rejected') :
                     key === 'unread' ? (isRTL ? 'غير مقروء' : 'Unread') :
                     key === 'requests' ? (isRTL ? 'طلبات الأهالي' : 'Parent Requests') :
                     key === 'trip' ? (isRTL ? 'الرحلات' : 'Trips') :
                     key === 'student' ? (isRTL ? 'الطلاب' : 'Students') : (isRTL ? 'المدرسة' : 'School')}
                  </Text>
                </Pressable>
              ))}
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

      <Modal transparent animationType="fade" visible={!!selected} onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          {!!selected && (
            <View style={[styles.modal, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={[styles.modalHead, { flexDirection: direction }]}>
                <View style={styles.modalIcon}><Ionicons name={isParentRequest(selected) ? 'document-text-outline' : 'notifications-outline'} size={23} color="#0A2D44" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.colors.text, textAlign }]}>{teacherNotificationTitle(selected, isRTL)}</Text>
                  {isParentRequest(selected) && <Text style={[styles.modalStatus, { textAlign }]}>{statusLabel(selectedStatus, isRTL)}</Text>}
                </View>
                <Pressable onPress={() => setSelected(null)}><Ionicons name="close-circle" size={28} color={theme.colors.textSecondary} /></Pressable>
              </View>

              <View style={[styles.detailBox, { backgroundColor: theme.colors.surface2 }]}>
                <Info label={isRTL ? 'الطالب' : 'Student'} value={String(selectedData.student_name ?? '—')} />
                {isParentRequest(selected) && <Info label={isRTL ? 'نوع الطلب' : 'Request Type'} value={requestTypeLabel(selectedData.request_type, isRTL)} />}
                {isParentRequest(selected) && <Info label={isRTL ? 'من تاريخ' : 'From'} value={String(selectedData.date_from ?? selected.date_key ?? '—')} />}
                {isParentRequest(selected) && <Info label={isRTL ? 'إلى تاريخ' : 'To'} value={String(selectedData.date_to ?? selected.date_key ?? '—')} />}
                {isParentRequest(selected) && <Info label={isRTL ? 'الفترة' : 'Period'} value={String(selectedData.trip_period ?? 'both')} />}
                <Text style={[styles.message, { color: theme.colors.text, textAlign }]}>{teacherNotificationBody(selected, isRTL)}</Text>
              </View>

              {canDecide && (
                <View style={[styles.actions, { flexDirection: direction }]}>
                  <Pressable disabled={deciding} onPress={() => void decide('approved')} style={[styles.action, styles.approve]}>
                    {deciding ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" /><Text style={styles.actionText}>{isRTL ? 'موافقة' : 'Approve'}</Text></>}
                  </Pressable>
                  <Pressable disabled={deciding} onPress={() => void decide('rejected')} style={[styles.action, styles.reject]}>
                    <Ionicons name="close-circle-outline" size={20} color="#FFFFFF" /><Text style={styles.actionText}>{isRTL ? 'رفض' : 'Reject'}</Text>
                  </Pressable>
                </View>
              )}

              {isParentRequest(selected) && !canDecide && (
                <View style={[styles.finalBox, selectedStatus === 'approved' ? styles.finalApproved : styles.finalRejected]}>
                  <Ionicons name={selectedStatus === 'approved' ? 'checkmark-circle' : 'close-circle'} size={20} color={selectedStatus === 'approved' ? '#15803D' : '#B42318'} />
                  <Text style={[styles.finalText, { color: selectedStatus === 'approved' ? '#15803D' : '#B42318' }]}>{statusLabel(selectedStatus, isRTL)}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );

  function Info({ label, value }: { label: string; value: string }) {
    return <View style={[styles.info, { flexDirection: direction }]}><Text style={[styles.infoLabel, { color: theme.colors.textSecondary, textAlign }]}>{label}</Text><Text style={[styles.infoValue, { color: theme.colors.text, textAlign }]}>{value}</Text></View>;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', gap: 10 },
  headerIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0A2D44' },
  headerSub: { marginTop: 2, fontSize: 11, color: '#8191A0', fontWeight: '700' },
  readAll: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: 14, minHeight: 52, borderRadius: 17, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, height: 50, fontSize: 12, fontWeight: '700' },
  filters: { paddingHorizontal: 14, paddingVertical: 10, gap: 6, flexWrap: 'wrap' },
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
  dateRow: { gap: 8 },
  dateField: { flex: 1 },
  dateLabel: { marginBottom: 5, fontSize: 9, fontWeight: '800' },
  dateInput: { height: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, fontSize: 11, fontWeight: '800' },
  filterActions: { marginTop: 18, gap: 8 },
  clearButton: { flex: 1, height: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 10, fontWeight: '900' },
  applyButton: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  applyText: { color: '#082338', fontSize: 10, fontWeight: '900' },
  filter: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  filterText: { fontSize: 9, fontWeight: '900' },
  list: { paddingHorizontal: 14, paddingBottom: 110, gap: 8 },
  card: { borderWidth: 1, borderRadius: 20, padding: 12, gap: 10, minHeight: 92 },
  cardIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF4D6', alignItems: 'center', justifyContent: 'center' },
  row: { alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 11, fontWeight: '900' },
  body: { marginTop: 5, fontSize: 9, lineHeight: 14, fontWeight: '600' },
  date: { marginTop: 7, fontSize: 8, fontWeight: '700' },
  status: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  pending: { backgroundColor: '#FFF4D6' },
  approved: { backgroundColor: '#DCFCE7' },
  rejected: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 7, fontWeight: '900', color: '#0A2D44' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(5,20,32,0.55)' },
  modal: { borderRadius: 26, borderWidth: 1, padding: 16 },
  modalHead: { alignItems: 'center', gap: 10 },
  modalIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 15, fontWeight: '900' },
  modalStatus: { marginTop: 4, fontSize: 10, fontWeight: '900', color: '#F59E0B' },
  detailBox: { marginTop: 15, borderRadius: 18, padding: 12 },
  info: { minHeight: 38, alignItems: 'center', gap: 8 },
  infoLabel: { flex: 1, fontSize: 9, fontWeight: '700' },
  infoValue: { flex: 1, fontSize: 9, fontWeight: '900' },
  message: { marginTop: 8, fontSize: 10, lineHeight: 16, fontWeight: '700' },
  actions: { marginTop: 14, gap: 9 },
  action: { flex: 1, height: 49, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  approve: { backgroundColor: '#15803D' },
  reject: { backgroundColor: '#B42318' },
  actionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  finalBox: { marginTop: 14, minHeight: 48, borderRadius: 15, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  finalApproved: { backgroundColor: '#DCFCE7' },
  finalRejected: { backgroundColor: '#FEE2E2' },
  finalText: { fontSize: 11, fontWeight: '900' },
});
