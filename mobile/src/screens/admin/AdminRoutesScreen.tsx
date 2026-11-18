import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

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
import AdminMultiSelectPanel, {
  MultiSelectItem,
} from '../../components/admin/AdminMultiSelectPanel';

type Row = Record<string, any>;

type RouteForm = {
  id?: string;
  name: string;
  direction: string;
  bus_id: string;
  teacher_id: string;
  morning_start_time: string;
  morning_end_time: string;
  afternoon_start_time: string;
  afternoon_end_time: string;
  notes: string;
  is_active: boolean;
};

const EMPTY_FORM: RouteForm = {
  name: '',
  direction: 'both',
  bus_id: '',
  teacher_id: '',
  morning_start_time: '',
  morning_end_time: '',
  afternoon_start_time: '',
  afternoon_end_time: '',
  notes: '',
  is_active: true,
};

type PickerKey = 'direction' | 'bus_id' | 'teacher_id' | null;

function directionLabel(value: unknown, isRTL: boolean) {
  if (value === 'morning') return isRTL ? 'صباحي' : 'Morning';
  if (value === 'afternoon') return isRTL ? 'مسائي' : 'Afternoon';
  return isRTL ? 'صباحي ومسائي' : 'Morning & Afternoon';
}

export default function AdminRoutesScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();

  const { schoolId } = useResolvedSchoolId(user);

  const [school, setSchool] = useState<Row | null>(null);
  const [currentYear, setCurrentYear] = useState<Row | null>(null);
  const [routes, setRoutes] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [buses, setBuses] = useState<Row[]>([]);
  const [teachers, setTeachers] = useState<Row[]>([]);
  const [assignments, setAssignments] = useState<Row[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editorVisible, setEditorVisible] = useState(false);
  const [studentPanel, setStudentPanel] = useState(false);
  const [picker, setPicker] = useState<PickerKey>(null);
  const [form, setForm] = useState<RouteForm>(EMPTY_FORM);

  const load = useCallback(async (refresh = false) => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    refresh ? setRefreshing(true) : setLoading(true);

    try {
      const [
        schoolResult,
        routesResult,
        studentsResult,
        busesResult,
        teachersResult,
        yearsResult,
      ] = await Promise.all([
        supabase.from('schools').select('*').eq('id', schoolId).maybeSingle(),
        supabase.from('routes').select('*').eq('school_id', schoolId).order('name'),
        supabase.from('students').select('*').eq('school_id', schoolId).eq('is_active', true).order('full_name'),
        supabase.from('buses').select('*').eq('school_id', schoolId).eq('is_active', true).order('bus_number'),
        supabase.from('teachers').select('*').eq('school_id', schoolId).eq('is_active', true).order('full_name'),
        supabase.from('academic_years').select('*').eq('school_id', schoolId).order('start_date', { ascending: false }),
      ]);

      if (schoolResult.error) throw schoolResult.error;
      if (routesResult.error) throw routesResult.error;
      if (studentsResult.error) throw studentsResult.error;
      if (busesResult.error) throw busesResult.error;
      if (teachersResult.error) throw teachersResult.error;
      if (yearsResult.error) throw yearsResult.error;

      const schoolRow = schoolResult.data ?? null;
      const years = yearsResult.data ?? [];
      const year =
        years.find((item: any) => item.is_current === true) ??
        years.find(
          (item: any) =>
            String(item.id) === String(schoolRow?.current_academic_year_id ?? '')
        ) ??
        null;

      setSchool(schoolRow);
      setRoutes(routesResult.data ?? []);
      setStudents(studentsResult.data ?? []);
      setBuses(busesResult.data ?? []);
      setTeachers(teachersResult.data ?? []);
      setCurrentYear(year);

      const routeIds = (routesResult.data ?? []).map((row: any) => row.id);

      if (!routeIds.length) {
        setAssignments([]);
      } else {
        const assignmentResult = await supabase
          .from('route_students')
          .select('*')
          .in('route_id', routeIds)
          .order('order_index');

        if (assignmentResult.error) throw assignmentResult.error;

        const allAssignments = assignmentResult.data ?? [];
        const preferredByStudent = new Map<string, Row>();

        allAssignments.forEach((row: Row) => {
          const studentId = String(row.student_id ?? '');
          if (!studentId) return;

          const current = preferredByStudent.get(studentId);
          const rowIsCurrent =
            !!year?.id &&
            String(row.academic_year_id ?? '') === String(year.id);
          const rowIsLegacy = row.academic_year_id == null;

          if (!current) {
            if (rowIsCurrent || rowIsLegacy || !year?.id) {
              preferredByStudent.set(studentId, row);
            }
            return;
          }

          const currentIsExact =
            !!year?.id &&
            String(current.academic_year_id ?? '') === String(year.id);

          if (!currentIsExact && rowIsCurrent) {
            preferredByStudent.set(studentId, row);
          }
        });

        (studentsResult.data ?? []).forEach((student: Row) => {
          const studentId = String(student.id ?? '');
          const legacyRouteId = String(student.route_id ?? '');

          if (
            !studentId ||
            !legacyRouteId ||
            !routeIds.map(String).includes(legacyRouteId) ||
            preferredByStudent.has(studentId)
          ) {
            return;
          }

          preferredByStudent.set(studentId, {
            id: `legacy-${studentId}`,
            student_id: studentId,
            route_id: legacyRouteId,
            academic_year_id: year?.id ?? null,
            order_index: 9999,
            _legacy_from_student: true,
          });
        });

        setAssignments(Array.from(preferredByStudent.values()));
      }
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'تعذر تحميل المسارات' : 'Unable to Load Routes',
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

  const busById = useMemo(
    () => new Map(buses.map((row) => [String(row.id), row])),
    [buses]
  );

  const teacherById = useMemo(
    () => new Map(teachers.map((row) => [String(row.id), row])),
    [teachers]
  );

  const assignmentByStudent = useMemo(
    () =>
      new Map(
        assignments.map((row) => [
          String(row.student_id),
          row,
        ])
      ),
    [assignments]
  );

  const routeStudentIds = useMemo(() => {
    if (!form.id) return [];

    return assignments
      .filter((row) => String(row.route_id) === String(form.id))
      .sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0))
      .map((row) => String(row.student_id));
  }, [assignments, form.id]);

  const selectableStudents: MultiSelectItem[] = useMemo(() => {
    return students
      .filter((student) => {
        const existing = assignmentByStudent.get(String(student.id));

        if (!existing) return true;
        return String(existing.route_id) === String(form.id ?? '');
      })
      .map((student) => ({
        value: String(student.id),
        title: String(student.full_name ?? ''),
        subtitle: [
          student.grade_name ?? student.class_name,
          student.section_name,
        ]
          .filter(Boolean)
          .join(' • '),
        meta: student.parent_phone ? String(student.parent_phone) : '',
      }));
  }, [students, assignmentByStudent, form.id]);

  const directionItems: SelectionItem[] = [
    {
      value: 'morning',
      title: isRTL ? 'صباحي' : 'Morning',
      subtitle: isRTL ? 'رحلة الذهاب للمدرسة' : 'Trip to school',
      icon: 'sunny-outline',
    },
    {
      value: 'afternoon',
      title: isRTL ? 'مسائي' : 'Afternoon',
      subtitle: isRTL ? 'رحلة العودة من المدرسة' : 'Return trip',
      icon: 'moon-outline',
    },
    {
      value: 'both',
      title: isRTL ? 'صباحي ومسائي' : 'Morning & Afternoon',
      subtitle: isRTL ? 'المسار يعمل في الفترتين' : 'Route runs in both periods',
      icon: 'swap-horizontal-outline',
    },
  ];

  const busItems: SelectionItem[] = buses.map((row) => ({
    value: String(row.id),
    title: isRTL
      ? `باص ${String(row.bus_number ?? '')}`
      : `Bus ${String(row.bus_number ?? '')}`,
    subtitle: String(row.plate_number ?? ''),
    meta: row.capacity ? String(row.capacity) : '',
    icon: 'bus-outline',
  }));

  const teacherItems: SelectionItem[] = teachers.map((row) => ({
    value: String(row.id),
    title: String(row.full_name ?? ''),
    subtitle: String(row.phone ?? row.email ?? ''),
    icon: 'school-outline',
  }));

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditorVisible(true);
  }

  function openEdit(route: Row) {
    setForm({
      id: String(route.id),
      name: String(route.name ?? ''),
      direction: String(route.direction ?? 'both'),
      bus_id: String(route.bus_id ?? ''),
      teacher_id: String(route.teacher_id ?? ''),
      morning_start_time: String(route.morning_start_time ?? (route.direction !== 'afternoon' ? route.start_time : '') ?? '').slice(0, 5),
      morning_end_time: String(route.morning_end_time ?? (route.direction !== 'afternoon' ? route.end_time : '') ?? '').slice(0, 5),
      afternoon_start_time: String(route.afternoon_start_time ?? (route.direction === 'afternoon' ? route.start_time : '') ?? '').slice(0, 5),
      afternoon_end_time: String(route.afternoon_end_time ?? (route.direction === 'afternoon' ? route.end_time : '') ?? '').slice(0, 5),
      notes: String(route.notes ?? ''),
      is_active: route.is_active !== false,
    });

    setEditorVisible(true);
  }

  async function saveRoute() {
    if (!schoolId) return;

    if (!form.name.trim()) {
      Alert.alert(
        isRTL ? 'حقل مطلوب' : 'Required',
        isRTL ? 'اسم المسار مطلوب.' : 'Route name is required.'
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        school_id: schoolId,
        name: form.name.trim(),
        direction: form.direction,
        bus_id: form.bus_id || null,
        teacher_id: form.teacher_id || null,
        morning_start_time: form.morning_start_time.trim() || null,
        morning_end_time: form.morning_end_time.trim() || null,
        afternoon_start_time: form.afternoon_start_time.trim() || null,
        afternoon_end_time: form.afternoon_end_time.trim() || null,
        start_time: (form.direction === 'afternoon' ? form.afternoon_start_time : form.morning_start_time).trim() || null,
        end_time: (form.direction === 'afternoon' ? form.afternoon_end_time : form.morning_end_time).trim() || null,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      };

      let saved: Row;

      if (form.id) {
        const { error } = await supabase
          .from('routes')
          .update(payload)
          .eq('id', form.id);

        if (error) throw error;

        const result = await supabase
          .from('routes')
          .select('*')
          .eq('id', form.id)
          .limit(1);

        if (result.error) throw result.error;

        saved = (result.data ?? [])[0] ?? {
          id: form.id,
          ...payload,
        };
      } else {
        const { data, error } = await supabase
          .from('routes')
          .insert(payload)
          .select('*')
          .limit(1);

        if (error) throw error;

        saved = (data ?? [])[0] ?? payload;
      }

      setForm((current) => ({
        ...current,
        id: String(saved.id),
      }));

      setEditorVisible(false);
      await load(false);
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'تعذر حفظ المسار' : 'Unable to Save Route',
        error?.message ?? String(error)
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveStudents(selectedIds: string[]) {
    if (!form.id || !schoolId) return;

    setSaving(true);

    try {
      const currentRows = assignments.filter(
        (row) => String(row.route_id) === String(form.id)
      );

      const selectedSet = new Set(selectedIds.map(String));

      const rowsToRemove = currentRows.filter(
        (row) => !selectedSet.has(String(row.student_id))
      );

      const realRemoveIds = rowsToRemove
        .filter((row) => !row._legacy_from_student && !String(row.id).startsWith('legacy-'))
        .map((row) => String(row.id));

      if (realRemoveIds.length) {
        const { error } = await supabase
          .from('route_students')
          .delete()
          .in('id', realRemoveIds);

        if (error) throw error;
      }

      const removedStudentIds = rowsToRemove.map(
        (row) => String(row.student_id)
      );

      if (removedStudentIds.length) {
        const { error } = await supabase
          .from('students')
          .update({ route_id: null })
          .in('id', removedStudentIds)
          .eq('school_id', schoolId);

        if (error) throw error;
      }

      for (let index = 0; index < selectedIds.length; index += 1) {
        const studentId = String(selectedIds[index]);

        let existingQuery = supabase
          .from('route_students')
          .select('id')
          .eq('route_id', form.id)
          .eq('student_id', studentId);

        existingQuery = currentYear?.id
          ? existingQuery.eq('academic_year_id', currentYear.id)
          : existingQuery.is('academic_year_id', null);

        const existingResult = await existingQuery.limit(1);

        if (existingResult.error) throw existingResult.error;

        if (!(existingResult.data ?? []).length) {
          const { error } = await supabase
            .from('route_students')
            .insert({
              route_id: form.id,
              student_id: studentId,
              academic_year_id: currentYear?.id ?? null,
              order_index: index + 1,
            });

          if (error) throw error;
        }
      }

      for (let index = 0; index < selectedIds.length; index += 1) {
        const studentId = selectedIds[index];

        let orderQuery = supabase
          .from('route_students')
          .update({ order_index: index + 1 })
          .eq('route_id', form.id)
          .eq('student_id', studentId);

        orderQuery = currentYear?.id
          ? orderQuery.eq('academic_year_id', currentYear.id)
          : orderQuery.is('academic_year_id', null);

        const { error } = await orderQuery;

        if (error) throw error;
      }

      if (selectedIds.length) {
        const { error } = await supabase
          .from('students')
          .update({ route_id: form.id })
          .in('id', selectedIds)
          .eq('school_id', schoolId);

        if (error) throw error;
      }

      setStudentPanel(false);
      await load(false);
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'تعذر ربط الطلاب' : 'Unable to Assign Students',
        error?.message ?? String(error)
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteRoute(route: Row) {
    Alert.alert(
      isRTL ? 'حذف المسار' : 'Delete Route',
      isRTL
        ? 'سيتم حذف ربط الطلاب بهذا المسار أيضاً. هل تريد المتابعة؟'
        : 'Student assignments for this route will also be removed. Continue?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error: assignmentError } = await supabase
                .from('route_students')
                .delete()
                .eq('route_id', route.id);

              if (assignmentError) throw assignmentError;

              await supabase
                .from('students')
                .update({ route_id: null })
                .eq('route_id', route.id)
                .eq('school_id', schoolId);

              const { error } = await supabase
                .from('routes')
                .delete()
                .eq('id', route.id);

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
      <View
        style={[
          styles.loading,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator color="#F7B83A" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.safe,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <AdminBrandHeader
        title={isRTL ? 'المسارات والطلاب' : 'Routes & Students'}
        subtitle={
          isRTL
            ? `إدارة المسار وربط الطلاب من نفس الشاشة • ${
                currentYear?.name ?? 'بدون سنة'
              }`
            : `Manage route and students together • ${
                currentYear?.name ?? 'No year'
              }`
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

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#F7B83A"
            onRefresh={() => void load(true)}
          />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.info,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              flexDirection: direction,
            },
          ]}
        >
          <View style={styles.infoIcon}>
            <Ionicons name="link-outline" size={20} color="#0A2D44" />
          </View>

          <Text
            style={[
              styles.infoText,
              {
                color: theme.colors.textSecondary,
                textAlign,
              },
            ]}
          >
            {isRTL
              ? 'الطالب المرتبط بمسار في السنة الحالية لا يظهر للاختيار في مسار آخر، لذلك ما بصير يتكرر بالغلط.'
              : 'A student assigned to one route in the current year is hidden from other routes, preventing duplicate assignments.'}
          </Text>
        </View>

        {routes.map((route) => {
          const routeAssignments = assignments.filter(
            (row) => String(row.route_id) === String(route.id)
          );

          const bus = busById.get(String(route.bus_id ?? ''));
          const teacher = teacherById.get(String(route.teacher_id ?? ''));

          return (
            <View
              key={String(route.id)}
              style={[
                styles.routeCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.routeTop,
                  { flexDirection: direction },
                ]}
              >
                <View style={styles.routeIcon}>
                  <Ionicons name="map" size={22} color="#0A2D44" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.routeName,
                      {
                        color: theme.colors.text,
                        textAlign,
                      },
                    ]}
                  >
                    {String(route.name ?? '—')}
                  </Text>

                  <Text
                    style={[
                      styles.routeMeta,
                      {
                        color: theme.colors.textSecondary,
                        textAlign,
                      },
                    ]}
                  >
                    {directionLabel(route.direction, isRTL)}
                    {bus?.bus_number
                      ? ` • ${isRTL ? 'باص' : 'Bus'} ${bus.bus_number}`
                      : ''}
                    {teacher?.full_name ? ` • ${teacher.full_name}` : ''}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        route.is_active === false
                          ? 'rgba(217,74,74,0.10)'
                          : 'rgba(32,160,106,0.10)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          route.is_active === false
                            ? '#D94A4A'
                            : '#20A06A',
                      },
                    ]}
                  >
                    {route.is_active === false
                      ? isRTL
                        ? 'متوقف'
                        : 'Inactive'
                      : isRTL
                      ? 'فعال'
                      : 'Active'}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.routeStats,
                  { flexDirection: direction },
                ]}
              >
                <Mini
                  icon="people-outline"
                  label={isRTL ? 'الطلاب' : 'Students'}
                  value={String(routeAssignments.length)}
                />
                <View style={styles.routeDivider} />
                <Mini
                  icon="sunny-outline"
                  label={isRTL ? 'الصباحي' : 'Morning'}
                  value={`${String(route.morning_start_time ?? route.start_time ?? '—').slice(0, 5)} - ${String(route.morning_end_time ?? route.end_time ?? '—').slice(0, 5)}`}
                />
                <View style={styles.routeDivider} />
                <Mini
                  icon="moon-outline"
                  label={isRTL ? 'المسائي' : 'Afternoon'}
                  value={`${String(route.afternoon_start_time ?? '—').slice(0, 5)} - ${String(route.afternoon_end_time ?? '—').slice(0, 5)}`}
                />
              </View>

              <View
                style={[
                  styles.actions,
                  { flexDirection: direction },
                ]}
              >
                <Pressable
                  onPress={() => {
                    openEdit(route);
                    setTimeout(() => setStudentPanel(true), 120);
                  }}
                  style={styles.studentButton}
                >
                  <Ionicons name="people" size={18} color="#0A2D44" />
                  <Text style={styles.studentButtonText}>
                    {isRTL ? 'اختيار الطلاب' : 'Select Students'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => openEdit(route)}
                  style={[
                    styles.secondaryAction,
                    {
                      backgroundColor: theme.colors.surface2,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons name="create-outline" size={18} color={theme.colors.text} />
                </Pressable>

                <Pressable
                  onPress={() => void deleteRoute(route)}
                  style={styles.deleteAction}
                >
                  <Ionicons name="trash-outline" size={18} color="#D94A4A" />
                </Pressable>
              </View>
            </View>
          );
        })}

        {!routes.length && (
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={38} color="#8191A0" />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              {isRTL ? 'لا توجد مسارات' : 'No Routes'}
            </Text>
            <Text
              style={[
                styles.emptySub,
                { color: theme.colors.textSecondary },
              ]}
            >
              {isRTL
                ? 'أضف أول مسار ثم اربط الطلاب من نفس الشاشة.'
                : 'Add the first route, then assign students from the same screen.'}
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={editorVisible}
        onRequestClose={() => !saving && setEditorVisible(false)}
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
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />

            <View
              style={[
                styles.sheetHeader,
                { flexDirection: direction },
              ]}
            >
              <View style={styles.sheetIcon}>
                <Ionicons name="map-outline" size={21} color="#0A2D44" />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.sheetTitle,
                    { color: theme.colors.text, textAlign },
                  ]}
                >
                  {form.id
                    ? isRTL
                      ? 'تعديل المسار'
                      : 'Edit Route'
                    : isRTL
                    ? 'إضافة مسار'
                    : 'Add Route'}
                </Text>
                <Text
                  style={[
                    styles.sheetSub,
                    { color: theme.colors.textSecondary, textAlign },
                  ]}
                >
                  {isRTL
                    ? 'كل الاختيارات من مربعات حوار واضحة بدون أي IDs.'
                    : 'All references use clear dialogs with no technical IDs.'}
                </Text>
              </View>

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

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Field
                label={isRTL ? 'اسم المسار' : 'Route Name'}
                icon="text-outline"
                value={form.name}
                onChange={(value) =>
                  setForm((current) => ({ ...current, name: value }))
                }
              />

              <Choice
                label={isRTL ? 'اتجاه الرحلة' : 'Trip Direction'}
                icon="swap-horizontal-outline"
                value={directionLabel(form.direction, isRTL)}
                onPress={() => setPicker('direction')}
              />

              <Choice
                label={isRTL ? 'الحافلة' : 'Bus'}
                icon="bus-outline"
                value={
                  busById.get(form.bus_id)?.bus_number
                    ? `${
                        isRTL ? 'باص' : 'Bus'
                      } ${busById.get(form.bus_id)?.bus_number}`
                    : isRTL
                    ? 'اختر الحافلة'
                    : 'Select Bus'
                }
                onPress={() => setPicker('bus_id')}
              />

              <Choice
                label={isRTL ? 'المعلم / المشرف' : 'Teacher / Supervisor'}
                icon="school-outline"
                value={
                  teacherById.get(form.teacher_id)?.full_name ??
                  (isRTL ? 'اختر المشرف' : 'Select Supervisor')
                }
                onPress={() => setPicker('teacher_id')}
              />

              <Text style={[styles.periodTitle, { color: theme.colors.text, textAlign }]}>{isRTL ? 'الفترة الصباحية' : 'Morning Period'}</Text>
              <Field label={isRTL ? 'بداية الفترة الصباحية' : 'Morning Start'} icon="sunny-outline" value={form.morning_start_time} placeholder="HH:MM" onChange={(value) => setForm((current) => ({ ...current, morning_start_time: value }))} />
              <Field label={isRTL ? 'نهاية الفترة الصباحية' : 'Morning End'} icon="time-outline" value={form.morning_end_time} placeholder="HH:MM" onChange={(value) => setForm((current) => ({ ...current, morning_end_time: value }))} />

              <Text style={[styles.periodTitle, { color: theme.colors.text, textAlign }]}>{isRTL ? 'الفترة المسائية' : 'Afternoon Period'}</Text>
              <Field label={isRTL ? 'بداية الفترة المسائية' : 'Afternoon Start'} icon="moon-outline" value={form.afternoon_start_time} placeholder="HH:MM" onChange={(value) => setForm((current) => ({ ...current, afternoon_start_time: value }))} />
              <Field label={isRTL ? 'نهاية الفترة المسائية' : 'Afternoon End'} icon="time-outline" value={form.afternoon_end_time} placeholder="HH:MM" onChange={(value) => setForm((current) => ({ ...current, afternoon_end_time: value }))} />

              <Field
                label={isRTL ? 'ملاحظات' : 'Notes'}
                icon="document-text-outline"
                value={form.notes}
                multiline
                onChange={(value) =>
                  setForm((current) => ({ ...current, notes: value }))
                }
              />

              <View
                style={[
                  styles.activeRow,
                  {
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                    flexDirection: direction,
                  },
                ]}
              >
                <View style={styles.choiceIcon}>
                  <Ionicons name="power-outline" size={18} color="#0A2D44" />
                </View>

                <Text
                  style={[
                    styles.activeTitle,
                    { color: theme.colors.text, textAlign },
                  ]}
                >
                  {isRTL ? 'المسار فعال' : 'Route Active'}
                </Text>

                <Switch
                  value={form.is_active}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, is_active: value }))
                  }
                  trackColor={{ false: '#D7E0E8', true: '#F6D180' }}
                  thumbColor={form.is_active ? '#F7B83A' : '#FFFFFF'}
                />
              </View>

              {form.id && (
                <Pressable
                  onPress={() => setStudentPanel(true)}
                  style={styles.manageStudents}
                >
                  <Ionicons name="people" size={20} color="#0A2D44" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.manageStudentsTitle}>
                      {isRTL ? 'طلاب هذا المسار' : 'Students on This Route'}
                    </Text>
                    <Text style={styles.manageStudentsSub}>
                      {isRTL
                        ? `${routeStudentIds.length} طالب مرتبط • اضغط للتعديل`
                        : `${routeStudentIds.length} assigned • tap to edit`}
                    </Text>
                  </View>
                  <Ionicons
                    name={isRTL ? 'chevron-back' : 'chevron-forward'}
                    size={18}
                    color="#0A2D44"
                  />
                </Pressable>
              )}

              <Pressable
                disabled={saving}
                onPress={() => void saveRoute()}
                style={[
                  styles.save,
                  { opacity: saving ? 0.72 : 1 },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#0A2D44" />
                ) : (
                  <Ionicons name="checkmark-done" size={20} color="#0A2D44" />
                )}
                <Text style={styles.saveText}>
                  {isRTL ? 'حفظ المسار' : 'Save Route'}
                </Text>
              </Pressable>
            </ScrollView>

            <AdminSelectionModal
              visible={picker === 'direction'}
              embedded
              title={isRTL ? 'اتجاه الرحلة' : 'Trip Direction'}
              items={directionItems}
              selectedValue={form.direction}
              allowClear={false}
              onClose={() => setPicker(null)}
              onSelect={(value) => {
                if (value) {
                  setForm((current) => ({ ...current, direction: value }));
                }
                setPicker(null);
              }}
            />

            <AdminSelectionModal
              visible={picker === 'bus_id'}
              embedded
              title={isRTL ? 'اختيار الحافلة' : 'Select Bus'}
              items={busItems}
              selectedValue={form.bus_id}
              onClose={() => setPicker(null)}
              onSelect={(value) => {
                setForm((current) => ({ ...current, bus_id: value ?? '' }));
                setPicker(null);
              }}
            />

            <AdminSelectionModal
              visible={picker === 'teacher_id'}
              embedded
              title={isRTL ? 'اختيار المشرف' : 'Select Supervisor'}
              items={teacherItems}
              selectedValue={form.teacher_id}
              onClose={() => setPicker(null)}
              onSelect={(value) => {
                setForm((current) => ({ ...current, teacher_id: value ?? '' }));
                setPicker(null);
              }}
            />

            <AdminMultiSelectPanel
              visible={studentPanel && !!form.id}
              title={isRTL ? 'طلاب المسار' : 'Route Students'}
              subtitle={
                isRTL
                  ? 'يظهر هنا فقط الطلاب غير المرتبطين بمسار آخر في السنة الحالية، بالإضافة لطلاب هذا المسار.'
                  : 'Only unassigned students and students already on this route are shown for the current year.'
              }
              items={selectableStudents}
              selectedValues={routeStudentIds}
              onClose={() => setStudentPanel(false)}
              onSave={(values) => void saveStudents(values)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  function Mini({
    icon,
    label,
    value,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    value: string;
  }) {
    return (
      <View style={styles.mini}>
        <Ionicons name={icon} size={13} color="#AFC2D0" />
        <Text style={styles.miniLabel}>{label}</Text>
        <Text style={styles.miniValue}>{value}</Text>
      </View>
    );
  }

  function Field({
    label,
    icon,
    value,
    onChange,
    placeholder,
    multiline = false,
  }: {
    label: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    multiline?: boolean;
  }) {
    return (
      <View style={styles.fieldGroup}>
        <Text
          style={[
            styles.fieldLabel,
            { color: theme.colors.textSecondary, textAlign },
          ]}
        >
          {label}
        </Text>

        <View
          style={[
            styles.fieldWrap,
            multiline && styles.multilineWrap,
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
            placeholder={placeholder}
            placeholderTextColor="#8191A0"
            multiline={multiline}
            style={[
              styles.input,
              multiline && styles.multilineInput,
              {
                color: theme.colors.text,
                textAlign,
              },
            ]}
          />
        </View>
      </View>
    );
  }

  function Choice({
    label,
    icon,
    value,
    onPress,
  }: {
    label: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    value: string;
    onPress: () => void;
  }) {
    return (
      <View style={styles.fieldGroup}>
        <Text
          style={[
            styles.fieldLabel,
            { color: theme.colors.textSecondary, textAlign },
          ]}
        >
          {label}
        </Text>

        <Pressable
          onPress={onPress}
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
            <Ionicons name={icon} size={18} color="#0A2D44" />
          </View>

          <Text
            numberOfLines={1}
            style={[
              styles.choiceText,
              {
                color: theme.colors.text,
                textAlign,
              },
            ]}
          >
            {value}
          </Text>

          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={17}
            color="#8191A0"
          />
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 14,
    paddingBottom: 110,
  },
  info: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 20,
    padding: 11,
    alignItems: 'center',
    gap: 9,
    marginBottom: 10,
  },
  infoIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 8.3,
    lineHeight: 13,
    fontWeight: '700',
  },
  routeCard: {
    borderWidth: 1,
    borderRadius: 23,
    padding: 13,
    marginBottom: 9,
  },
  routeTop: {
    alignItems: 'center',
    gap: 10,
  },
  routeIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeName: {
    fontSize: 13,
    fontWeight: '900',
  },
  routeMeta: {
    marginTop: 4,
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '600',
  },
  statusBadge: {
    minHeight: 29,
    borderRadius: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 7.5,
    fontWeight: '900',
  },
  routeStats: {
    minHeight: 62,
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: '#0A2D44',
    alignItems: 'center',
  },
  mini: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniLabel: {
    color: '#AFC2D0',
    marginTop: 2,
    fontSize: 6.5,
    fontWeight: '700',
  },
  miniValue: {
    color: '#FFFFFF',
    marginTop: 3,
    fontSize: 9.5,
    fontWeight: '900',
  },
  routeDivider: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  actions: {
    marginTop: 11,
    gap: 7,
  },
  studentButton: {
    flex: 1,
    height: 45,
    borderRadius: 14,
    backgroundColor: '#F7B83A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  studentButtonText: {
    color: '#0A2D44',
    fontSize: 9,
    fontWeight: '900',
  },
  secondaryAction: {
    width: 45,
    height: 45,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAction: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: 'rgba(217,74,74,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '900',
  },
  emptySub: {
    marginTop: 5,
    fontSize: 8.5,
    lineHeight: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(5,20,32,0.52)',
  },
  sheet: {
    height: '92%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 25,
  },
  handle: {
    width: 46,
    height: 4,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetHeader: {
    minHeight: 62,
    alignItems: 'center',
    gap: 9,
  },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  sheetSub: {
    marginTop: 2,
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '600',
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTitle: { marginTop: 16, marginBottom: -2, fontSize: 11, fontWeight: '900' },
  fieldGroup: {
    marginTop: 12,
  },
  fieldLabel: {
    marginBottom: 7,
    fontSize: 9.5,
    fontWeight: '800',
  },
  fieldWrap: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 11,
    alignItems: 'center',
    gap: 8,
  },
  multilineWrap: {
    minHeight: 92,
    alignItems: 'flex-start',
    paddingTop: 13,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 11,
    fontWeight: '700',
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  choice: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 16,
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
  choiceText: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '800',
  },
  activeRow: {
    minHeight: 60,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 9,
  },
  activeTitle: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '900',
  },
  manageStudents: {
    minHeight: 62,
    marginTop: 14,
    borderRadius: 17,
    backgroundColor: '#0A2D44',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  manageStudentsTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  manageStudentsSub: {
    color: '#AFC2D0',
    marginTop: 3,
    fontSize: 7.5,
    fontWeight: '700',
  },
  save: {
    marginTop: 18,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F7B83A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  saveText: {
    color: '#0A2D44',
    fontSize: 11,
    fontWeight: '900',
  },
});
