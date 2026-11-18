import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
import AdminSelectionModal, { SelectionItem } from '../../components/admin/AdminSelectionModal';
import {
  addSupportMessage,
  createSupportTicket,
  listSupportMessages,
  listSupportTickets,
} from '../../services/adminSupportService';

type Row = Record<string, any>;
type Priority = 'low' | 'medium' | 'high' | 'urgent';

function statusLabel(value: string, isRTL: boolean) {
  const map: Record<string, [string, string]> = {
    open: ['مفتوحة', 'Open'], in_progress: ['قيد المعالجة', 'In Progress'], waiting_school: ['بانتظار المدرسة', 'Waiting for School'], resolved: ['محلولة', 'Resolved'], closed: ['مغلقة', 'Closed'],
  };
  return map[value] ? (isRTL ? map[value][0] : map[value][1]) : value;
}

export default function AdminSupportScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();
  const { schoolId } = useResolvedSchoolId(user);

  const [school, setSchool] = useState<Row | null>(null);
  const [tickets, setTickets] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [details, setDetails] = useState<Row | null>(null);
  const [messages, setMessages] = useState<Row[]>([]);
  const [priorityPicker, setPriorityPicker] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('technical');
  const [priority, setPriority] = useState<Priority>('medium');
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!schoolId) { setLoading(false); return; }
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [schoolResult, ticketRows] = await Promise.all([
        supabase.from('schools').select('*').eq('id', schoolId).limit(1),
        listSupportTickets(schoolId),
      ]);
      if (schoolResult.error) throw schoolResult.error;
      setSchool((schoolResult.data ?? [])[0] ?? null);
      setTickets(ticketRows as Row[]);
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر تحميل الدعم الفني' : 'Unable to Load Support', error?.message ?? String(error));
    } finally { setLoading(false); setRefreshing(false); }
  }, [schoolId, isRTL]);

  useEffect(() => { void load(); }, [load]);

  const priorityItems: SelectionItem[] = [
    { value: 'low', title: isRTL ? 'منخفضة' : 'Low', icon: 'arrow-down-outline' },
    { value: 'medium', title: isRTL ? 'متوسطة' : 'Medium', icon: 'remove-outline' },
    { value: 'high', title: isRTL ? 'مرتفعة' : 'High', icon: 'arrow-up-outline' },
    { value: 'urgent', title: isRTL ? 'عاجلة' : 'Urgent', icon: 'warning-outline' },
  ];

  async function openTicket(ticket: Row) {
    setDetails(ticket);
    try { setMessages((await listSupportMessages(String(ticket.id))) as Row[]); }
    catch (error: any) { Alert.alert(isRTL ? 'تعذر تحميل المحادثة' : 'Unable to Load Conversation', error?.message ?? String(error)); }
  }

  async function create() {
    if (!schoolId || !user?.id || !subject.trim() || !description.trim()) {
      Alert.alert(isRTL ? 'بيانات ناقصة' : 'Missing Data', isRTL ? 'اكتب عنوان ووصف المشكلة.' : 'Enter the ticket subject and description.'); return;
    }
    setSaving(true);
    try {
      await createSupportTicket({ schoolId, createdBy: user.id, subject, description, priority, category });
      setEditorVisible(false); setSubject(''); setDescription(''); setPriority('medium'); setCategory('technical');
      await load(false);
    } catch (error: any) { Alert.alert(isRTL ? 'تعذر فتح التذكرة' : 'Unable to Create Ticket', error?.message ?? String(error)); }
    finally { setSaving(false); }
  }

  async function sendReply() {
    if (!details || !user?.id || !reply.trim()) return;
    setSaving(true);
    try {
      await addSupportMessage({ ticketId: String(details.id), senderId: user.id, senderRole: String(user.role ?? 'admin'), message: reply });
      setReply('');
      setMessages((await listSupportMessages(String(details.id))) as Row[]);
    } catch (error: any) { Alert.alert(isRTL ? 'تعذر إرسال الرد' : 'Unable to Send Reply', error?.message ?? String(error)); }
    finally { setSaving(false); }
  }

  if (loading) return <View style={[styles.loading, { backgroundColor: theme.colors.background }]}><ActivityIndicator color="#F7B83A" size="large" /></View>;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <AdminBrandHeader
        title={isRTL ? 'الدعم الفني' : 'Technical Support'}
        subtitle={isRTL ? 'تذاكر مباشرة بين المدرسة وإدارة النظام' : 'Direct tickets between the school and system administration'}
        schoolName={String(school?.name ?? (isRTL ? 'المدرسة' : 'School'))}
        schoolLogoUrl={school?.logo_url ?? null}
        onBack={() => navigation.goBack()}
        right={<Pressable onPress={() => setEditorVisible(true)} style={styles.add}><Ionicons name="add" size={23} color="#0A2D44" /></Pressable>}
      />

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} tintColor="#F7B83A" onRefresh={() => void load(true)} />} contentContainerStyle={styles.content}>
        <View style={[styles.intro, { backgroundColor: '#0A2D44', flexDirection: direction }]}>
          <View style={styles.introIcon}><Ionicons name="headset-outline" size={22} color="#0A2D44" /></View>
          <View style={{ flex: 1 }}><Text style={[styles.introTitle, { textAlign }]}>{isRTL ? 'مركز دعم موحد' : 'Unified Support Center'}</Text><Text style={[styles.introSub, { textAlign }]}>{isRTL ? 'لاحقاً نفس التذاكر ستظهر على ويب إدارة النظام لمتابعة المدارس والعقود والاشتراكات.' : 'These same tickets are ready to appear in the future system-management web portal.'}</Text></View>
        </View>

        {tickets.map((ticket) => (
          <Pressable key={String(ticket.id)} onPress={() => void openTicket(ticket)} style={[styles.ticket, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}>
            <View style={styles.ticketIcon}><Ionicons name="chatbubbles-outline" size={20} color="#0A2D44" /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.ticketTitle, { color: theme.colors.text, textAlign }]}>{String(ticket.subject ?? '—')}</Text>
              <Text numberOfLines={2} style={[styles.ticketBody, { color: theme.colors.textSecondary, textAlign }]}>{String(ticket.description ?? '')}</Text>
              <View style={[styles.metaRow, { flexDirection: direction }]}><Text style={styles.status}>{statusLabel(String(ticket.status ?? 'open'), isRTL)}</Text><Text style={[styles.date, { color: theme.colors.textSecondary }]}>{String(ticket.created_at ?? '').slice(0, 10)}</Text></View>
            </View>
          </Pressable>
        ))}
        {!tickets.length && <View style={styles.empty}><Ionicons name="headset-outline" size={42} color="#8191A0" /><Text style={[styles.emptyTitle, { color: theme.colors.text }]}>{isRTL ? 'لا توجد تذاكر دعم' : 'No Support Tickets'}</Text></View>}
      </ScrollView>

      <Modal transparent animationType="slide" visible={editorVisible} onRequestClose={() => setEditorVisible(false)}>
        <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setEditorVisible(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.colors.text, textAlign }]}>{isRTL ? 'فتح تذكرة دعم' : 'Create Support Ticket'}</Text>
            <TextInput value={subject} onChangeText={setSubject} placeholder={isRTL ? 'عنوان المشكلة' : 'Issue subject'} placeholderTextColor="#8191A0" style={[styles.input, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text, textAlign }]} />
            <Pressable onPress={() => setPriorityPicker(true)} style={[styles.choice, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, flexDirection: direction }]}><Ionicons name="flag-outline" size={18} color="#F7B83A" /><Text style={[styles.choiceText, { color: theme.colors.text, textAlign }]}>{priorityItems.find((item) => item.value === priority)?.title}</Text><Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={17} color="#8191A0" /></Pressable>
            <TextInput value={category} onChangeText={setCategory} placeholder={isRTL ? 'التصنيف' : 'Category'} placeholderTextColor="#8191A0" style={[styles.input, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text, textAlign }]} />
            <TextInput value={description} onChangeText={setDescription} multiline placeholder={isRTL ? 'اشرح المشكلة بالتفصيل...' : 'Describe the issue...'} placeholderTextColor="#8191A0" style={[styles.input, styles.desc, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text, textAlign }]} />
            <Pressable disabled={saving} onPress={() => void create()} style={styles.primary}><Ionicons name="send-outline" size={19} color="#0A2D44" /><Text style={styles.primaryText}>{isRTL ? 'إرسال التذكرة' : 'Submit Ticket'}</Text></Pressable>
            <AdminSelectionModal visible={priorityPicker} embedded title={isRTL ? 'الأولوية' : 'Priority'} items={priorityItems} selectedValue={priority} allowClear={false} onClose={() => setPriorityPicker(false)} onSelect={(value) => { if (value) setPriority(value as Priority); setPriorityPicker(false); }} />
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={!!details} onRequestClose={() => setDetails(null)}>
        <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setDetails(null)} />
          {!!details && <View style={[styles.sheet, styles.chatSheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.colors.text, textAlign }]}>{String(details.subject ?? '')}</Text>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
              <View style={[styles.problemBox, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}><Text style={[styles.problemText, { color: theme.colors.text, textAlign }]}>{String(details.description ?? '')}</Text></View>
              {messages.map((message) => <View key={String(message.id)} style={[styles.message, { backgroundColor: message.sender_role === 'system_admin' ? 'rgba(247,184,58,0.16)' : theme.colors.surface2, borderColor: theme.colors.border }]}><Text style={[styles.messageRole, { color: theme.colors.textSecondary, textAlign }]}>{String(message.sender_role ?? '')}</Text><Text style={[styles.messageText, { color: theme.colors.text, textAlign }]}>{String(message.message ?? '')}</Text></View>)}
            </ScrollView>
            <View style={[styles.replyRow, { flexDirection: direction }]}><TextInput value={reply} onChangeText={setReply} placeholder={isRTL ? 'اكتب ردك...' : 'Write a reply...'} placeholderTextColor="#8191A0" style={[styles.replyInput, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text, textAlign }]} /><Pressable onPress={() => void sendReply()} style={styles.replyButton}><Ionicons name="send" size={18} color="#0A2D44" /></Pressable></View>
          </View>}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, add: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' }, content: { padding: 14, paddingBottom: 110 },
  intro: { minHeight: 86, borderRadius: 22, padding: 12, gap: 10, alignItems: 'center' }, introIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' }, introTitle: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' }, introSub: { color: '#AFC2D0', marginTop: 4, fontSize: 7.6, lineHeight: 12, fontWeight: '600' },
  ticket: { minHeight: 100, borderWidth: 1, borderRadius: 21, padding: 11, gap: 10, marginTop: 9 }, ticketIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' }, ticketTitle: { fontSize: 10.5, fontWeight: '900' }, ticketBody: { marginTop: 4, fontSize: 8, lineHeight: 12, fontWeight: '600' }, metaRow: { marginTop: 8, alignItems: 'center', justifyContent: 'space-between' }, status: { color: '#20A06A', fontSize: 7.5, fontWeight: '900' }, date: { fontSize: 7, fontWeight: '700' }, empty: { paddingVertical: 70, alignItems: 'center' }, emptyTitle: { marginTop: 8, fontSize: 12, fontWeight: '900' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,20,32,0.58)' }, sheet: { minHeight: 520, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, padding: 16, paddingBottom: 28 }, chatSheet: { height: '88%' }, sheetTitle: { fontSize: 15, fontWeight: '900', marginBottom: 10 }, input: { height: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, marginTop: 9, fontSize: 10, fontWeight: '700' }, desc: { height: 140, paddingTop: 12, textAlignVertical: 'top' }, choice: { height: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 11, marginTop: 9, alignItems: 'center', gap: 8 }, choiceText: { flex: 1, fontSize: 10, fontWeight: '800' }, primary: { height: 52, borderRadius: 16, backgroundColor: '#F7B83A', marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, primaryText: { color: '#0A2D44', fontSize: 10.5, fontWeight: '900' },
  problemBox: { borderWidth: 1, borderRadius: 17, padding: 12, marginBottom: 10 }, problemText: { fontSize: 9.5, lineHeight: 15, fontWeight: '700' }, message: { borderWidth: 1, borderRadius: 16, padding: 10, marginBottom: 7 }, messageRole: { fontSize: 7, fontWeight: '900' }, messageText: { marginTop: 4, fontSize: 9, lineHeight: 14, fontWeight: '700' }, replyRow: { gap: 7, marginTop: 7 }, replyInput: { flex: 1, height: 48, borderWidth: 1, borderRadius: 15, paddingHorizontal: 11, fontSize: 9.5, fontWeight: '700' }, replyButton: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
});
