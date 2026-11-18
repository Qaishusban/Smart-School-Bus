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
import { supabase } from '../../lib/supabase';
import {
  decideParentRequest,
  type ParentRequestDecision,
} from '../../services/parentRequestDecisionService';

type Row = {
  id: string;
  school_id: string | null;
  bus_id: string | null;
  driver_id: string | null;
  teacher_id: string | null;
  student_id: string | null;
  parent_id: string | null;
  route_id: string | null;
  type: string | null;
  title: string | null;
  body: string | null;
  message: string | null;
  data: Record<string, any> | null;
  status: string | null;
  is_read: boolean | null;
  date_key: string | null;
  created_at: string | null;
};

type ParentRequest = Record<string, any>;
type Filter = 'all' | 'needs_action' | 'pending' | 'approved' | 'rejected' | 'unread' | 'requests' | 'trip' | 'student' | 'school' | 'incident' | 'other';

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function isParentRequest(row: Row) {
  const source = normalize(row.data?.source);
  const type = normalize(row.type);
  return type === 'parent_request' ||
    type === 'parent_request_updated' ||
    source === 'parent_request' ||
    source === 'parent_requests';
}

function requestId(row: Row) {
  const value = row.data?.request_id ?? row.data?.source_id;
  return value ? String(value) : null;
}

function statusLabel(status: string, rtl: boolean) {
  if (status === 'approved') return rtl ? 'تمت الموافقة' : 'Approved';
  if (status === 'rejected') return rtl ? 'مرفوض' : 'Rejected';
  return rtl ? 'بانتظار القرار' : 'Pending';
}

function typeLabel(value: unknown, rtl: boolean) {
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
  const pair = map[normalize(value)] ?? [String(value ?? '—'), String(value ?? '—')];
  return rtl ? pair[0] : pair[1];
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

export default function AdminNotificationsScreen() {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();

  const [rows, setRows] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Map<string, ParentRequest>>(new Map());
  const [selected, setSelected] = useState<Row | null>(null);
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
  const [saving, setSaving] = useState(false);

  const schoolId = user?.school_id ?? null;

  const load = useCallback(async (manual = false) => {
    if (!schoolId) {
      setRows([]);
      setRequests(new Map());
      setLoading(false);
      return;
    }

    manual ? setRefreshing(true) : setLoading(true);

    try {
      const [notificationResult, requestResult] = await Promise.all([
        supabase
          .from('bus_notifications')
          .select('id,school_id,bus_id,driver_id,teacher_id,student_id,parent_id,route_id,type,title,body,message,data,status,is_read,date_key,created_at')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('parent_requests')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(300),
      ]);

      if (notificationResult.error) throw notificationResult.error;
      if (requestResult.error) throw requestResult.error;

      const requestMap = new Map<string, ParentRequest>();
      (requestResult.data ?? []).forEach((row: ParentRequest) => requestMap.set(String(row.id), row));

      // For parent requests the admin sees only the school recipient copy.
      // Other notification types are preserved.
      const sourceRows = ((notificationResult.data ?? []) as Row[]).filter((row) => {
        if (!isParentRequest(row)) return true;
        return row.driver_id == null && row.teacher_id == null;
      });

      // Newest parent-request event wins for each request_id.
      const seen = new Set<string>();
      const deduped = sourceRows.filter((row) => {
        if (!isParentRequest(row)) return true;
        const id = requestId(row);
        if (!id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      setRequests(requestMap);
      setRows(deduped);

      setSelected((current) => {
        if (!current) return null;
        const id = requestId(current);
        return deduped.find((row) => row.id === current.id || (id && requestId(row) === id)) ?? null;
      });
    } catch (error: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', String(error?.message ?? error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [schoolId, isRTL]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!schoolId) return;

    const channel = supabase
      .channel(`admin-mobile-parent-requests-${schoolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bus_notifications', filter: `school_id=eq.${schoolId}` }, () => void load(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parent_requests', filter: `school_id=eq.${schoolId}` }, () => void load(false))
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [schoolId, load]);

  const unread = useMemo(() => rows.filter((x) => x.is_read !== true).length, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const req = requestId(row) ? requests.get(requestId(row)!) : null;
      const status = normalize(req?.status ?? row.data?.status ?? 'pending');
      const text = `${row.type ?? ''} ${row.title ?? ''}`.toLowerCase();
      if (filter === 'needs_action' && !(isParentRequest(row) && status === 'pending')) return false;
      if (filter === 'pending' && !(isParentRequest(row) && status === 'pending')) return false;
      if (filter === 'approved' && !(isParentRequest(row) && status === 'approved')) return false;
      if (filter === 'rejected' && !(isParentRequest(row) && status === 'rejected')) return false;
      if (filter === 'unread' && row.is_read === true) return false;
      if (filter === 'requests' && !isParentRequest(row)) return false;
      if (filter === 'trip' && !text.includes('trip')) return false;
      if (filter === 'student' && !(text.includes('student') || text.includes('board') || text.includes('deliver') || text.includes('absent'))) return false;
      if (filter === 'school' && !(text.includes('school') || text.includes('broadcast') || text.includes('announcement'))) return false;
      if (filter === 'incident' && !(text.includes('incident') || text.includes('delay') || text.includes('alert'))) return false;
      if (filter === 'other' && (isParentRequest(row) || text.includes('trip') || text.includes('student') || text.includes('school') || text.includes('incident'))) return false;
      const dateValue = isParentRequest(row)
        ? (req?.date_from ?? row.data?.date_from ?? row.created_at)
        : row.created_at;
      if (!inDateRange(dateValue, fromDate, toDate)) return false;
      if (!q) return true;

      return [
        row.title, row.body, row.message, row.type,
        req?.request_type, req?.notes, req?.status,
      ].some((value) => String(value ?? '').toLowerCase().includes(q));
    });
  }, [rows, filter, search, requests, fromDate, toDate]);

  async function markRead(row: Row) {
    if (row.is_read === true) return;
    const { error } = await supabase
      .from('bus_notifications')
      .update({ is_read: true, status: 'read' })
      .eq('id', row.id)
      .eq('school_id', schoolId ?? '');

    if (!error) {
      setRows((current) => current.map((x) => x.id === row.id ? { ...x, is_read: true, status: 'read' } : x));
    }
  }

  async function markAllRead() {
    const ids = rows.filter((x) => x.is_read !== true).map((x) => x.id);
    if (!ids.length || !schoolId) return;

    const { error } = await supabase
      .from('bus_notifications')
      .update({ is_read: true, status: 'read' })
      .eq('school_id', schoolId)
      .in('id', ids);

    if (!error) setRows((current) => current.map((x) => ids.includes(x.id) ? { ...x, is_read: true, status: 'read' } : x));
  }

  async function decide(decision: ParentRequestDecision) {
    if (!selected || !schoolId || !user?.id) return;
    const id = requestId(selected);
    if (!id) return;

    setSaving(true);
    try {
      await decideParentRequest({
        requestId: id,
        schoolId,
        decision,
        actor: 'school_admin',
        actorId: user.id,
      });
      await load(false);
      Alert.alert(
        isRTL ? 'تم حفظ القرار' : 'Decision Saved',
        decision === 'approved'
          ? (isRTL ? 'تمت الموافقة على طلب ولي الأمر.' : 'Parent request approved.')
          : (isRTL ? 'تم رفض طلب ولي الأمر.' : 'Parent request rejected.')
      );
    } catch (error: any) {
      if (String(error?.message ?? '') === 'request_already_decided') {
        await load(false);
        Alert.alert(
          isRTL ? 'تم حسم الطلب' : 'Already Decided',
          isRTL ? 'قام المعلم أو مستخدم آخر بحسم الطلب قبلك وتم تحديث الحالة.' : 'Another authorized user decided the request first. The status was refreshed.'
        );
      } else {
        Alert.alert(isRTL ? 'تعذر حفظ القرار' : 'Unable to Save', String(error?.message ?? error));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <View style={[styles.loading, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" color="#F7B83A" /></View>;
  }

  const selectedRequest = selected && requestId(selected) ? requests.get(requestId(selected)!) ?? null : null;
  const selectedStatus = normalize(selectedRequest?.status ?? selected?.data?.status ?? 'pending');
  const canDecide = !!selected && isParentRequest(selected) && selectedStatus === 'pending';

  const semanticCardText = '#102A43';
  const semanticCardMuted = '#52667A';

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { flexDirection: direction }]}>
        <View style={styles.brand}><Ionicons name="notifications" size={23} color="#082338" /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.colors.text, textAlign }]}>{isRTL ? 'مركز إشعارات الإدارة' : 'Admin Notification Center'}</Text>
          <Text style={[styles.subtitle, { textAlign }]}>{isRTL ? `${unread} غير مقروء` : `${unread} unread`}</Text>
        </View>
        {unread > 0 && <Pressable onPress={() => void markAllRead()} style={styles.readAll}><Ionicons name="checkmark-done" size={20} color="#082338" /></Pressable>}
      </View>

      <View style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}>
        <Ionicons name="search" size={18} color="#8493A0" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={isRTL ? 'بحث...' : 'Search...'}
          placeholderTextColor="#8493A0"
          style={[styles.searchInput, { color: theme.colors.text, textAlign }]}
        />
      </View>

      <View style={[styles.filterBar, { flexDirection: direction }]}>
        <Pressable onPress={() => { setDraftFilter(filter); setDraftFromDate(fromDate); setDraftToDate(toDate); setFiltersVisible(true); }} style={[styles.filterButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}>
          <Ionicons name="options-outline" size={19} color="#082338" />
          <Text style={[styles.filterButtonText, { color: theme.colors.text }]}>{isRTL ? 'فلترة' : 'Filters'}</Text>
          {(filter !== 'all' || fromDate || toDate) ? <View style={styles.activeDot} /> : null}
        </Pressable>
        {(filter !== 'all' || fromDate || toDate) && <Text style={[styles.filterSummary, { color: theme.colors.textSecondary, textAlign }]}>{filter !== 'all' ? (isRTL ? 'فلتر مفعّل' : 'Filtered') : ''}{fromDate || toDate ? `  ${fromDate || '…'} → ${toDate || '…'}` : ''}</Text>}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#F7B83A" />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const id = requestId(item);
          const req = id ? requests.get(id) : null;
          const status = normalize(req?.status ?? item.data?.status ?? 'pending');
          const parent = isParentRequest(item);

          return (
            <Pressable
              onPress={() => { setSelected(item); void markRead(item); }}
              style={[styles.card, {
                backgroundColor: parent
                  ? status === 'approved' ? '#F0FDF4'
                  : status === 'rejected' ? '#FFF1F2'
                  : '#FFFBEB'
                  : theme.colors.surface,
                borderColor: parent
                  ? status === 'approved' ? '#22C55E'
                  : status === 'rejected' ? '#EF4444'
                  : '#F59E0B'
                  : item.is_read === true ? theme.colors.border : '#3B82F6',
                borderLeftWidth: 5,
                flexDirection: direction
              }]}
            >
              <View style={styles.icon}><Ionicons name={parent ? 'document-text-outline' : 'notifications-outline'} size={21} color="#082338" /></View>
              <View style={{ flex: 1 }}>
                <View style={[styles.row, { flexDirection: direction }]}>
                  <Text style={[styles.cardTitle, { color: parent ? semanticCardText : theme.colors.text, textAlign }]}>{parent ? typeLabel(req?.request_type ?? item.data?.request_type, isRTL) : (item.title ?? item.type ?? 'Notification')}</Text>
                  {parent && <View style={[styles.badge, status === 'approved' ? styles.ok : status === 'rejected' ? styles.no : styles.wait]}><Text style={styles.badgeText}>{statusLabel(status, isRTL)}</Text></View>}
                </View>
                <Text numberOfLines={2} style={[styles.body, { color: parent ? semanticCardMuted : theme.colors.textSecondary, textAlign }]}>{String(req?.notes ?? item.body ?? item.message ?? '')}</Text>
                <Text style={[styles.date, { color: parent ? semanticCardMuted : theme.colors.textSecondary, textAlign }]}>{item.created_at ? new Date(item.created_at).toLocaleString(isRTL ? 'ar-JO' : 'en-US') : '—'}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="notifications-off-outline" size={42} color="#98A2B3" /><Text style={{ color: theme.colors.text }}>{isRTL ? 'لا توجد إشعارات' : 'No Notifications'}</Text></View>}
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
              {(['all','needs_action','pending','approved','rejected','unread','requests','trip','student','school','incident','other'] as Filter[]).map((key) => (
                <Pressable key={key} onPress={() => setDraftFilter(key)} style={[styles.option, { borderColor: draftFilter === key ? '#F7B83A' : theme.colors.border, backgroundColor: draftFilter === key ? '#FFF4D6' : theme.colors.surface2 }]}>
                  <Text style={[styles.optionText, { color: draftFilter === key ? '#102A43' : theme.colors.text }]}>
                    {key === 'all' ? (isRTL ? 'الكل' : 'All') : key === 'needs_action' ? (isRTL ? 'يحتاج موافقتي' : 'Needs My Decision') : key === 'pending' ? (isRTL ? 'قيد الانتظار' : 'Pending') : key === 'approved' ? (isRTL ? 'تمت الموافقة' : 'Approved') : key === 'rejected' ? (isRTL ? 'مرفوض' : 'Rejected') : key === 'unread' ? (isRTL ? 'غير مقروء' : 'Unread') : key === 'requests' ? (isRTL ? 'طلبات الأهالي' : 'Parent Requests') : key === 'trip' ? (isRTL ? 'الرحلات' : 'Trips') : key === 'student' ? (isRTL ? 'الطلاب' : 'Students') : key === 'school' ? (isRTL ? 'المدرسة' : 'School') : key === 'incident' ? (isRTL ? 'الحوادث والتنبيهات' : 'Incidents & Alerts') : (isRTL ? 'أخرى' : 'Other')}
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

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          {!!selected && (
            <View style={[styles.modal, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={[styles.modalHead, { flexDirection: direction }]}>
                <View style={styles.modalIcon}><Ionicons name={isParentRequest(selected) ? 'document-text-outline' : 'notifications-outline'} size={23} color="#082338" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.colors.text, textAlign }]}>
                    {isParentRequest(selected) ? typeLabel(selectedRequest?.request_type ?? selected.data?.request_type, isRTL) : (selected.title ?? selected.type ?? 'Notification')}
                  </Text>
                  {isParentRequest(selected) && <Text style={[styles.modalStatus, { textAlign }]}>{statusLabel(selectedStatus, isRTL)}</Text>}
                </View>
                <Pressable onPress={() => setSelected(null)}><Ionicons name="close-circle" size={28} color={theme.colors.textSecondary} /></Pressable>
              </View>

              <View style={[styles.details, { backgroundColor: theme.colors.surface2 }]}>
                {isParentRequest(selected) && <>
                  <Info label={isRTL ? 'من تاريخ' : 'From'} value={String(selectedRequest?.date_from ?? selected.data?.date_from ?? selected.date_key ?? '—')} />
                  <Info label={isRTL ? 'إلى تاريخ' : 'To'} value={String(selectedRequest?.date_to ?? selected.data?.date_to ?? selected.date_key ?? '—')} />
                  <Info label={isRTL ? 'الفترة' : 'Period'} value={String(selectedRequest?.trip_period ?? selected.data?.trip_period ?? 'both')} />
                </>}
                <Text style={[styles.message, { color: theme.colors.text, textAlign }]}>{String(selectedRequest?.notes ?? selected.body ?? selected.message ?? (isRTL ? 'لا توجد ملاحظات.' : 'No notes.'))}</Text>
              </View>

              {canDecide && (
                <View style={[styles.actions, { flexDirection: direction }]}>
                  <Pressable disabled={saving} onPress={() => void decide('approved')} style={[styles.action, styles.approve]}>
                    {saving ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="checkmark-circle-outline" size={20} color="#FFF" /><Text style={styles.actionText}>{isRTL ? 'موافقة' : 'Approve'}</Text></>}
                  </Pressable>
                  <Pressable disabled={saving} onPress={() => void decide('rejected')} style={[styles.action, styles.reject]}>
                    <Ionicons name="close-circle-outline" size={20} color="#FFF" /><Text style={styles.actionText}>{isRTL ? 'رفض' : 'Reject'}</Text>
                  </Pressable>
                </View>
              )}

              {isParentRequest(selected) && !canDecide && (
                <View style={[styles.final, selectedStatus === 'approved' ? styles.finalOk : styles.finalNo]}>
                  <Ionicons name={selectedStatus === 'approved' ? 'checkmark-circle' : 'close-circle'} size={20} color={selectedStatus === 'approved' ? '#15803D' : '#B42318'} />
                  <Text style={{ color: selectedStatus === 'approved' ? '#15803D' : '#B42318', fontWeight: '900' }}>{statusLabel(selectedStatus, isRTL)}</Text>
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
  header: { padding: 16, alignItems: 'center', gap: 10 },
  brand: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '900' },
  subtitle: { marginTop: 3, color: '#8493A0', fontSize: 10, fontWeight: '700' },
  readAll: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: 14, borderWidth: 1, borderRadius: 17, paddingHorizontal: 12, minHeight: 52, alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, height: 50, fontSize: 12, fontWeight: '700' },
  filters: { padding: 12, gap: 6, flexWrap: 'wrap' },
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
  dateRow: { gap: 8 }, dateField: { flex: 1 },
  dateLabel: { marginBottom: 5, fontSize: 9, fontWeight: '800' },
  dateInput: { height: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, fontSize: 11, fontWeight: '800' },
  filterActions: { marginTop: 18, gap: 8 },
  clearButton: { flex: 1, height: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 10, fontWeight: '900' },
  applyButton: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  applyText: { color: '#082338', fontSize: 10, fontWeight: '900' },
  filter: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  filterText: { fontSize: 9, fontWeight: '900' },
  list: { paddingHorizontal: 14, paddingBottom: 100, gap: 8 },
  card: { borderWidth: 1, borderRadius: 20, padding: 12, gap: 10, minHeight: 90 },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF4D6', alignItems: 'center', justifyContent: 'center' },
  row: { alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 11, fontWeight: '900' },
  body: { marginTop: 5, fontSize: 9, lineHeight: 14, fontWeight: '600' },
  date: { marginTop: 7, fontSize: 8, fontWeight: '700' },
  badge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  wait: { backgroundColor: '#FFF4D6' },
  ok: { backgroundColor: '#DCFCE7' },
  no: { backgroundColor: '#FEE2E2' },
  badgeText: { color: '#082338', fontSize: 7, fontWeight: '900' },
  empty: { paddingTop: 80, alignItems: 'center', gap: 10 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(5,20,32,.55)' },
  modal: { borderWidth: 1, borderRadius: 26, padding: 16 },
  modalHead: { alignItems: 'center', gap: 10 },
  modalIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 15, fontWeight: '900' },
  modalStatus: { marginTop: 4, color: '#F59E0B', fontSize: 10, fontWeight: '900' },
  details: { marginTop: 15, borderRadius: 18, padding: 12 },
  info: { minHeight: 38, alignItems: 'center', gap: 8 },
  infoLabel: { flex: 1, fontSize: 9, fontWeight: '700' },
  infoValue: { flex: 1, fontSize: 9, fontWeight: '900' },
  message: { marginTop: 8, fontSize: 10, lineHeight: 16, fontWeight: '700' },
  actions: { marginTop: 14, gap: 9 },
  action: { flex: 1, height: 49, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  approve: { backgroundColor: '#15803D' },
  reject: { backgroundColor: '#B42318' },
  actionText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  final: { marginTop: 14, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  finalOk: { backgroundColor: '#DCFCE7' },
  finalNo: { backgroundColor: '#FEE2E2' },
});