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
import AdminSelectionModal, {
  SelectionItem,
} from '../../components/admin/AdminSelectionModal';

type Row = Record<string, any>;
type TabKey = 'grades' | 'sections';

export default function AdminGradesSectionsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();

  const { schoolId } = useResolvedSchoolId(user);

  const [school, setSchool] = useState<Row | null>(null);
  const [grades, setGrades] = useState<Row[]>([]);
  const [sections, setSections] = useState<Row[]>([]);
  const [tab, setTab] = useState<TabKey>('grades');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editorVisible, setEditorVisible] = useState(false);
  const [gradePicker, setGradePicker] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    refresh ? setRefreshing(true) : setLoading(true);

    try {
      const [schoolResult, gradesResult, sectionsResult] = await Promise.all([
        supabase.from('schools').select('*').eq('id', schoolId).maybeSingle(),
        supabase
          .from('school_grades')
          .select('*')
          .eq('school_id', schoolId)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('school_sections')
          .select('*')
          .eq('school_id', schoolId)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
      ]);

      if (schoolResult.error) throw schoolResult.error;
      if (gradesResult.error) throw gradesResult.error;
      if (sectionsResult.error) throw sectionsResult.error;

      setSchool(schoolResult.data ?? null);
      setGrades(gradesResult.data ?? []);
      setSections(sectionsResult.data ?? []);
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'تعذر تحميل الصفوف والشعب' : 'Unable to Load Grades & Sections',
        error?.message ?? String(error)
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [schoolId, isRTL]);

  useEffect(() => {
    void load();
  }, [load]);

  const gradeById = useMemo(
    () => new Map(grades.map((item) => [String(item.id), item])),
    [grades]
  );

  const gradeItems: SelectionItem[] = grades
    .filter((item) => item.is_active !== false)
    .map((item) => ({
      value: String(item.id),
      title: String(item.name ?? ''),
      subtitle: item.code ? String(item.code) : '',
      icon: 'school-outline',
    }));

  const rows = tab === 'grades' ? grades : sections;

  function openCreate() {
    setEditing(null);
    setName('');
    setCode('');
    setSortOrder('');
    setGradeId('');
    setActive(true);
    setEditorVisible(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    setName(String(row.name ?? ''));
    setCode(String(row.code ?? ''));
    setSortOrder(row.sort_order == null ? '' : String(row.sort_order));
    setGradeId(String(row.grade_id ?? ''));
    setActive(row.is_active !== false);
    setEditorVisible(true);
  }

  async function save() {
    if (!schoolId || !name.trim()) {
      Alert.alert(
        isRTL ? 'حقل مطلوب' : 'Required',
        isRTL ? 'الاسم مطلوب.' : 'Name is required.'
      );
      return;
    }

    if (tab === 'sections' && !gradeId) {
      Alert.alert(
        isRTL ? 'اختر الصف' : 'Select Grade',
        isRTL ? 'كل شعبة يجب أن تكون مرتبطة بصف.' : 'Every section must belong to a grade.'
      );
      return;
    }

    setSaving(true);

    try {
      const table = tab === 'grades' ? 'school_grades' : 'school_sections';
      const payload: Record<string, any> = {
        school_id: schoolId,
        name: name.trim(),
        code: code.trim() || null,
        sort_order: sortOrder.trim() ? Number(sortOrder) : 0,
        is_active: active,
      };

      if (tab === 'sections') {
        payload.grade_id = gradeId;
      }

      if (editing?.id) {
        const { error } = await supabase
          .from(table)
          .update(payload)
          .eq('id', editing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
      }

      setEditorVisible(false);
      await load(false);
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'تعذر الحفظ' : 'Save Failed',
        error?.message ?? String(error)
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: Row) {
    const table = tab === 'grades' ? 'school_grades' : 'school_sections';

    Alert.alert(
      isRTL ? 'تأكيد الحذف' : 'Confirm Delete',
      isRTL
        ? 'إذا كان العنصر مستخدماً لدى طلاب، يفضل تعطيله بدل حذفه.'
        : 'If this item is already used by students, disabling it is safer than deleting it.',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from(table)
                .delete()
                .eq('id', row.id);

              if (error) throw error;
              await load(false);
            } catch (error: any) {
              Alert.alert(
                isRTL ? 'تعذر الحذف' : 'Delete Failed',
                error?.message ?? String(error)
              );
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color="#F7B83A" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
    >
      <AdminBrandHeader
        title={isRTL ? 'الصفوف والشعب' : 'Grades & Sections'}
        subtitle={
          isRTL
            ? 'Master Data جاهزة للربط المستقبلي مع نظام المدرسة والمحاسبة'
            : 'Master data ready for future School ERP / Accounting integration'
        }
        schoolName={String(school?.name ?? (isRTL ? 'المدرسة' : 'School'))}
        schoolLogoUrl={school?.logo_url ?? null}
        onBack={() => navigation.goBack()}
        right={
          <Pressable onPress={openCreate} style={styles.add}>
            <Ionicons name="add" size={23} color="#0A2D44" />
          </Pressable>
        }
      />

      <View
        style={[
          styles.tabs,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            flexDirection: direction,
          },
        ]}
      >
        <Tab
          active={tab === 'grades'}
          icon="school-outline"
          title={isRTL ? 'الصفوف' : 'Grades'}
          count={grades.length}
          onPress={() => setTab('grades')}
        />
        <Tab
          active={tab === 'sections'}
          icon="grid-outline"
          title={isRTL ? 'الشعب' : 'Sections'}
          count={sections.length}
          onPress={() => setTab('sections')}
        />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#F7B83A"
            onRefresh={() => void load(true)}
          />
        }
        contentContainerStyle={styles.content}
      >
        {rows.map((row) => (
          <Pressable
            key={String(row.id)}
            onPress={() => openEdit(row)}
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                flexDirection: direction,
              },
            ]}
          >
            <View style={styles.cardIcon}>
              <Ionicons
                name={tab === 'grades' ? 'school-outline' : 'grid-outline'}
                size={20}
                color="#0A2D44"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.cardTitle,
                  { color: theme.colors.text, textAlign },
                ]}
              >
                {String(row.name ?? '—')}
              </Text>

              <Text
                style={[
                  styles.cardSub,
                  { color: theme.colors.textSecondary, textAlign },
                ]}
              >
                {tab === 'sections'
                  ? `${
                      isRTL ? 'الصف' : 'Grade'
                    }: ${String(gradeById.get(String(row.grade_id))?.name ?? '—')}${
                      row.code ? ` • ${row.code}` : ''
                    }`
                  : row.code
                  ? String(row.code)
                  : isRTL
                  ? 'بدون رمز'
                  : 'No code'}
              </Text>
            </View>

            <View
              style={[
                styles.activeBadge,
                {
                  backgroundColor:
                    row.is_active === false
                      ? 'rgba(217,74,74,0.09)'
                      : 'rgba(32,160,106,0.09)',
                },
              ]}
            >
              <Text
                style={[
                  styles.activeText,
                  {
                    color:
                      row.is_active === false ? '#D94A4A' : '#20A06A',
                  },
                ]}
              >
                {row.is_active === false
                  ? isRTL
                    ? 'متوقف'
                    : 'Inactive'
                  : isRTL
                  ? 'فعال'
                  : 'Active'}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={editorVisible}
        onRequestClose={() => setEditorVisible(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !saving && setEditorVisible(false)}
          />

          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={[styles.sheetHeader, { flexDirection: direction }]}>
              <View style={styles.sheetIcon}>
                <Ionicons
                  name={tab === 'grades' ? 'school-outline' : 'grid-outline'}
                  size={20}
                  color="#0A2D44"
                />
              </View>

              <Text
                style={[
                  styles.sheetTitle,
                  { color: theme.colors.text, textAlign },
                ]}
              >
                {editing
                  ? tab === 'grades'
                    ? isRTL
                      ? 'تعديل الصف'
                      : 'Edit Grade'
                    : isRTL
                    ? 'تعديل الشعبة'
                    : 'Edit Section'
                  : tab === 'grades'
                  ? isRTL
                    ? 'إضافة صف'
                    : 'Add Grade'
                  : isRTL
                  ? 'إضافة شعبة'
                  : 'Add Section'}
              </Text>

              <Pressable
                onPress={() => setEditorVisible(false)}
                style={[
                  styles.close,
                  {
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </Pressable>
            </View>

            {tab === 'sections' && (
              <View style={styles.fieldGroup}>
                <Text
                  style={[
                    styles.label,
                    { color: theme.colors.textSecondary, textAlign },
                  ]}
                >
                  {isRTL ? 'الصف' : 'Grade'}
                </Text>

                <Pressable
                  onPress={() => setGradePicker(true)}
                  style={[
                    styles.choice,
                    {
                      backgroundColor: theme.colors.surface2,
                      borderColor: theme.colors.border,
                      flexDirection: direction,
                    },
                  ]}
                >
                  <View style={styles.choiceIcon}>
                    <Ionicons name="school-outline" size={18} color="#0A2D44" />
                  </View>
                  <Text
                    style={[
                      styles.choiceText,
                      { color: theme.colors.text, textAlign },
                    ]}
                  >
                    {String(
                      gradeById.get(gradeId)?.name ??
                        (isRTL ? 'اختر الصف' : 'Select Grade')
                    )}
                  </Text>
                  <Ionicons
                    name={isRTL ? 'chevron-back' : 'chevron-forward'}
                    size={17}
                    color="#8191A0"
                  />
                </Pressable>
              </View>
            )}

            <Input
              label={isRTL ? 'الاسم' : 'Name'}
              icon="text-outline"
              value={name}
              onChange={setName}
            />
            <Input
              label={isRTL ? 'الرمز' : 'Code'}
              icon="code-outline"
              value={code}
              onChange={setCode}
            />
            <Input
              label={isRTL ? 'الترتيب' : 'Sort Order'}
              icon="list-outline"
              value={sortOrder}
              onChange={setSortOrder}
              keyboardType="number-pad"
            />

            <View
              style={[
                styles.switchRow,
                {
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                  flexDirection: direction,
                },
              ]}
            >
              <Ionicons name="power-outline" size={18} color="#F7B83A" />
              <Text
                style={[
                  styles.switchTitle,
                  { color: theme.colors.text, textAlign },
                ]}
              >
                {isRTL ? 'فعال' : 'Active'}
              </Text>
              <Switch
                value={active}
                onValueChange={setActive}
                trackColor={{ false: '#D7E0E8', true: '#F6D180' }}
                thumbColor={active ? '#F7B83A' : '#FFFFFF'}
              />
            </View>

            <View style={[styles.actions, { flexDirection: direction }]}>
              <Pressable
                disabled={saving}
                onPress={() => void save()}
                style={styles.save}
              >
                {saving ? (
                  <ActivityIndicator color="#0A2D44" />
                ) : (
                  <Ionicons name="checkmark-done" size={20} color="#0A2D44" />
                )}
                <Text style={styles.saveText}>
                  {isRTL ? 'حفظ' : 'Save'}
                </Text>
              </Pressable>

              {!!editing && (
                <Pressable
                  onPress={() => void remove(editing)}
                  style={styles.delete}
                >
                  <Ionicons name="trash-outline" size={19} color="#D94A4A" />
                </Pressable>
              )}
            </View>

            <AdminSelectionModal
              visible={gradePicker}
              embedded
              title={isRTL ? 'اختيار الصف' : 'Select Grade'}
              items={gradeItems}
              selectedValue={gradeId}
              allowClear={false}
              onClose={() => setGradePicker(false)}
              onSelect={(value) => {
                setGradeId(value ?? '');
                setGradePicker(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  function Tab({
    active,
    icon,
    title,
    count,
    onPress,
  }: {
    active: boolean;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    count: number;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.tab,
          {
            backgroundColor: active ? '#F7B83A' : theme.colors.surface2,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={active ? '#0A2D44' : theme.colors.textSecondary}
        />
        <Text
          style={[
            styles.tabText,
            { color: active ? '#0A2D44' : theme.colors.text },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.tabCount,
            { color: active ? '#0A2D44' : theme.colors.textSecondary },
          ]}
        >
          {count}
        </Text>
      </Pressable>
    );
  }

  function Input({
    label,
    icon,
    value,
    onChange,
    keyboardType,
  }: {
    label: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    value: string;
    onChange: (value: string) => void;
    keyboardType?: any;
  }) {
    return (
      <View style={styles.fieldGroup}>
        <Text
          style={[
            styles.label,
            { color: theme.colors.textSecondary, textAlign },
          ]}
        >
          {label}
        </Text>
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              flexDirection: direction,
            },
          ]}
        >
          <Ionicons name={icon} size={18} color="#F7B83A" />
          <TextInput
            value={value}
            onChangeText={onChange}
            keyboardType={keyboardType}
            style={[
              styles.input,
              { color: theme.colors.text, textAlign },
            ]}
          />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  add: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    minHeight: 60,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 19,
    borderWidth: 1,
    padding: 6,
    gap: 6,
  },
  tab: {
    flex: 1,
    borderRadius: 14,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tabText: { fontSize: 9, fontWeight: '900' },
  tabCount: { fontSize: 7.5, fontWeight: '900' },
  content: { padding: 14, paddingBottom: 110 },
  card: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 11,
    alignItems: 'center',
    gap: 9,
    marginBottom: 8,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 11, fontWeight: '900' },
  cardSub: { marginTop: 3, fontSize: 8, fontWeight: '600' },
  activeBadge: {
    minHeight: 29,
    borderRadius: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeText: { fontSize: 7, fontWeight: '900' },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(5,20,32,0.52)',
  },
  sheet: {
    minHeight: 500,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    padding: 16,
    paddingBottom: 28,
  },
  sheetHeader: { alignItems: 'center', gap: 9, marginBottom: 5 },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { flex: 1, fontSize: 14, fontWeight: '900' },
  close: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: { marginTop: 12 },
  label: { marginBottom: 7, fontSize: 9.5, fontWeight: '800' },
  inputWrap: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 11,
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1, height: 50, fontSize: 11, fontWeight: '700' },
  choice: {
    minHeight: 53,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 9,
    alignItems: 'center',
    gap: 8,
  },
  choiceIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: { flex: 1, fontSize: 10.5, fontWeight: '800' },
  switchRow: {
    minHeight: 58,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 11,
    alignItems: 'center',
    gap: 8,
  },
  switchTitle: { flex: 1, fontSize: 10, fontWeight: '900' },
  actions: { marginTop: 18, gap: 8 },
  save: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#F7B83A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveText: { color: '#0A2D44', fontSize: 10.5, fontWeight: '900' },
  delete: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(217,74,74,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
