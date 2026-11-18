import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapView,
  Marker,
} from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MAP_CONFIG } from '../../config/mapConfig';
import { useAuth } from '../../hooks/useAuth';
import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  busNumber,
  routeName,
  rowName,
  subscribeTeacherBusLocation,
  TeacherContextData,
  TeacherStudentRow,
  TripPeriod,
} from '../../services/teacherService';
import {
  ParentContact,
  RoadRoute,
  StudentOperationalState,
  callPhone,
  getParentContacts,
  getRoadRoute,
  isStudentDoneForPeriod,
  isValidCoord,
  loadSupervisorContext,
  pickNearestPendingStudent,
  reportTeacherIncident,
  sendArrivalNotice,
  statusLabel,
  subscribeTeacherAttendance,
} from '../../services/teacherSupervisorService';

type CameraHandle = React.ElementRef<typeof Camera>;
type Row = Record<string, any>;
type FilterState = {
  students: boolean;
  bus: boolean;
  school: boolean;
  teacher: boolean;
  routeLine: boolean;
};

function formatDistance(meters?: number | null) {
  if (!meters && meters !== 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatEta(seconds?: number | null) {
  if (!seconds && seconds !== 0) return '—';
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export default function TeacherMapScreen() {
  const responsiveMap = useResponsiveLayout();

  const { user } = useAuth();
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();

  const cameraRef = useRef<CameraHandle>(null);

  const [period, setPeriod] = useState<TripPeriod>(
    new Date().getHours() < 12 ? 'morning' : 'afternoon'
  );
  const [context, setContext] = useState<TeacherContextData | null>(null);
  const [states, setStates] = useState<Record<string, StudentOperationalState>>({});
  const [liveLocation, setLiveLocation] = useState<Row | null>(null);
  const [roadRoute, setRoadRoute] = useState<RoadRoute | null>(null);
  const [target, setTarget] = useState<TeacherStudentRow | null>(null);

  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    students: true,
    bus: true,
    school: true,
    teacher: true,
    routeLine: true,
  });

  const [selectedStudent, setSelectedStudent] = useState<TeacherStudentRow | null>(null);
  const [parentContacts, setParentContacts] = useState<ParentContact[]>([]);
  const [contactOpen, setContactOpen] = useState(false);

  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentBody, setIncidentBody] = useState('');
  const [incidentSeverity, setIncidentSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [submittingIncident, setSubmittingIncident] = useState(false);

  const [arrivalSentAt, setArrivalSentAt] = useState<Record<string, number>>({});
  const [clock, setClock] = useState(Date.now());

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;

    try {
      const result = await loadSupervisorContext({
        teacherId: user.id,
        username: user.username ?? null,
        schoolId: user.school_id ?? null,
        period,
      });

      setContext(result.context);
      setStates(result.states);
      setLiveLocation((current) => current ?? result.context.liveLocation);
    } catch (error) {
      console.log('TeacherMap V3:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.username, user?.school_id, period]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const timer = setInterval(() => {
      void load();
    }, 15000);

    return () => clearInterval(timer);
  }, [user?.id, load]);

  useEffect(() => {
    if (!context?.bus?.id) return;
    return subscribeTeacherBusLocation(String(context.bus.id), setLiveLocation);
  }, [context?.bus?.id]);

  useEffect(() => {
    const ids = context?.students.map((item) => String(item.student.id)) ?? [];
    if (!ids.length) return;

    /*
     * subscribeTeacherAttendance يرسل إشعاراً عند أي تغيير في حضور
     * أحد طلاب المسار، لكنه لا يمرر payload إلى الـ callback.
     *
     * لذلك نعيد مزامنة الحالة التشغيلية مباشرة من المصدر المركزي.
     * موقع الباص نفسه يبقى Realtime مباشراً عبر
     * subscribeTeacherBusLocation بدون انتظار هذه المزامنة.
     */
    return subscribeTeacherAttendance(ids, () => {
      void load();
    });
  }, [context?.students, load]);

  const origin = useMemo(() => {
    if (liveLocation && isValidCoord(liveLocation.lat, liveLocation.lng)) {
      return {
        latitude: Number(liveLocation.lat),
        longitude: Number(liveLocation.lng),
      };
    }

    if (
      context?.teacher &&
      isValidCoord(
        context.teacher.current_lat ?? context.teacher.home_lat,
        context.teacher.current_lng ?? context.teacher.home_lng
      )
    ) {
      return {
        latitude: Number(context.teacher.current_lat ?? context.teacher.home_lat),
        longitude: Number(context.teacher.current_lng ?? context.teacher.home_lng),
      };
    }

    if (context?.school && isValidCoord(context.school.lat, context.school.lng)) {
      return {
        latitude: Number(context.school.lat),
        longitude: Number(context.school.lng),
      };
    }

    return null;
  }, [liveLocation, context]);

  useEffect(() => {
    if (!context) {
      setTarget(null);
      return;
    }

    setTarget(
      pickNearestPendingStudent({
        context,
        period,
        operational: states,
        origin,
      })
    );
  }, [context, states, origin, period]);

  useEffect(() => {
    let cancelled = false;

    async function buildRoute() {
      if (
        !origin ||
        !target ||
        !isValidCoord(target.student.home_lat, target.student.home_lng)
      ) {
        setRoadRoute(null);
        return;
      }

      const route = await getRoadRoute({
        from: origin,
        to: {
          latitude: Number(target.student.home_lat),
          longitude: Number(target.student.home_lng),
        },
      });

      if (!cancelled) setRoadRoute(route);
    }

    void buildRoute();

    return () => {
      cancelled = true;
    };
  }, [
    origin?.latitude,
    origin?.longitude,
    target?.student?.id,
    target?.student?.home_lat,
    target?.student?.home_lng,
  ]);

  const counts = useMemo(() => {
    const result = {
      total: context?.students.length ?? 0,
      done: 0,
      excused: 0,
      pending: 0,
    };

    (context?.students ?? []).forEach((item) => {
      const state = states[String(item.student.id)];

      if (state?.excused) {
        result.excused += 1;
        result.done += 1;
      } else if (isStudentDoneForPeriod(item, period, state)) {
        result.done += 1;
      } else {
        result.pending += 1;
      }
    });

    return result;
  }, [context, states, period]);

  const visibleSearchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];

    const rows: Array<{
      key: string;
      title: string;
      subtitle: string;
      lng: number;
      lat: number;
      student?: TeacherStudentRow;
    }> = [];

    (context?.students ?? []).forEach((item) => {
      const name = rowName(item.student);
      const grade = String(item.student.grade_name ?? item.student.grade ?? '');
      const section = String(item.student.section_name ?? item.student.section ?? '');
      const haystack = `${name} ${grade} ${section}`.toLowerCase();

      if (
        haystack.includes(term) &&
        isValidCoord(item.student.home_lat, item.student.home_lng)
      ) {
        rows.push({
          key: `student-${item.student.id}`,
          title: name,
          subtitle: [grade, section].filter(Boolean).join(' • '),
          lng: Number(item.student.home_lng),
          lat: Number(item.student.home_lat),
          student: item,
        });
      }
    });

    if (
      context?.school &&
      String(context.school.name ?? '').toLowerCase().includes(term) &&
      isValidCoord(context.school.lat, context.school.lng)
    ) {
      rows.push({
        key: 'school',
        title: String(context.school.name ?? ''),
        subtitle: isRTL ? 'المدرسة' : 'School',
        lng: Number(context.school.lng),
        lat: Number(context.school.lat),
      });
    }

    const driver = rowName(context?.mainDriver);
    if (
      driver.toLowerCase().includes(term) &&
      liveLocation &&
      isValidCoord(liveLocation.lat, liveLocation.lng)
    ) {
      rows.push({
        key: 'driver',
        title: driver,
        subtitle: `${isRTL ? 'باص' : 'Bus'} ${busNumber(context?.bus)}`,
        lng: Number(liveLocation.lng),
        lat: Number(liveLocation.lat),
      });
    }

    return rows.slice(0, 6);
  }, [search, context, liveLocation, isRTL]);

  const center = useMemo<[number, number]>(() => {
    if (origin) return [origin.longitude, origin.latitude];

    return [
      MAP_CONFIG.defaultCenter.longitude,
      MAP_CONFIG.defaultCenter.latitude,
    ];
  }, [origin]);

  const recenter = useCallback(() => {
    if (
      target &&
      origin &&
      isValidCoord(target.student.home_lat, target.student.home_lng)
    ) {
      const targetLng = Number(target.student.home_lng);
      const targetLat = Number(target.student.home_lat);

      const midpoint: [number, number] = [
        (origin.longitude + targetLng) / 2,
        (origin.latitude + targetLat) / 2,
      ];

      const spread = Math.max(
        Math.abs(origin.longitude - targetLng),
        Math.abs(origin.latitude - targetLat)
      );

      const zoom =
        spread < 0.004
          ? 16.5
          : spread < 0.01
          ? 15
          : spread < 0.03
          ? 13.5
          : 12;

      cameraRef.current?.easeTo({
        center: midpoint,
        zoom,
        duration: 450,
      });
      return;
    }

    cameraRef.current?.easeTo({
      center,
      zoom: 15,
      duration: 400,
    });
  }, [center, origin, target]);

  useEffect(() => {
    recenter();
  }, [target?.student?.id]);

  async function openStudent(item: TeacherStudentRow) {
    setSelectedStudent(item);

    try {
      setParentContacts(await getParentContacts(String(item.student.id)));
    } catch {
      setParentContacts([]);
    }
  }

  async function sendReachedNotice(item: TeacherStudentRow) {
    if (!user?.id) return;

    try {
      const result = await sendArrivalNotice({
        teacherId: user.id,
        studentId: String(item.student.id),
      });

      const count = Number(result?.sent_count ?? result?.count ?? 0);

      setArrivalSentAt((current) => ({
        ...current,
        [String(item.student.id)]: Date.now(),
      }));

      Alert.alert(
        isRTL ? 'تم إرسال التنبيه' : 'Notification Sent',
        isRTL
          ? `تم تنبيه ${count || parentContacts.length || 1} من أولياء الأمور. الاتصال سيتاح بعد دقيقة.`
          : `Parent notification sent. Calling is enabled after one minute.`
      );
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'تعذر إرسال التنبيه' : 'Unable to Send',
        error?.message ?? String(error)
      );
    }
  }

  function secondsUntilCall(studentId: string) {
    const sent = arrivalSentAt[studentId];
    if (!sent) return null;
    return Math.max(0, 60 - Math.floor((clock - sent) / 1000));
  }

  async function openContactPicker(item: TeacherStudentRow) {
    const sid = String(item.student.id);
    const remaining = secondsUntilCall(sid);

    if (remaining == null || remaining > 0) {
      Alert.alert(
        isRTL ? 'الاتصال غير متاح بعد' : 'Call Not Available Yet',
        remaining == null
          ? isRTL
            ? 'أرسل تنبيه الوصول أولاً، وبعد دقيقة سيسمح بالاتصال.'
            : 'Send the arrival notification first. Calling will be available after one minute.'
          : isRTL
          ? `متبقي ${remaining} ثانية.`
          : `${remaining} seconds remaining.`
      );
      return;
    }

    const contacts = await getParentContacts(sid);
    setParentContacts(contacts);
    setSelectedStudent(item);
    setContactOpen(true);
  }

  async function submitIncident() {
    if (!user?.id || !incidentTitle.trim() || !incidentBody.trim()) return;

    setSubmittingIncident(true);

    try {
      await reportTeacherIncident({
        teacherId: user.id,
        title: incidentTitle.trim(),
        body: incidentBody.trim(),
        severity: incidentSeverity,
      });

      setIncidentTitle('');
      setIncidentBody('');
      setIncidentSeverity('medium');
      setIncidentOpen(false);

      Alert.alert(
        isRTL ? 'تم إرسال البلاغ' : 'Incident Sent',
        isRTL ? 'تم إرسال البلاغ للإدارة.' : 'The incident was sent to administration.'
      );
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'تعذر إرسال البلاغ' : 'Unable to Send Incident',
        error?.message ?? String(error)
      );
    } finally {
      setSubmittingIncident(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color="#F7B83A" />
      </View>
    );
  }

  const routeFeature = roadRoute
    ? {
        type: 'Feature' as const,
        properties: {},
        geometry: roadRoute.geometry,
      }
    : null;

  return (
    <View style={styles.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_CONFIG.developmentStyle}
        attribution
        logo
        compass
        androidView="texture"
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center, zoom: 14 }}
          minZoom={3}
          maxZoom={20}
        />

        {filters.routeLine && routeFeature && (
          <GeoJSONSource id="teacher-road-route" data={routeFeature as any}>
            <Layer
              id="teacher-road-route-line"
              type="line"
              style={{
                lineColor: '#1677FF',
                lineWidth: 5,
                lineOpacity: 0.88,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </GeoJSONSource>
        )}

        {filters.school &&
          context?.school &&
          isValidCoord(context.school.lat, context.school.lng) && (
            <Marker
              id="teacher-school"
              lngLat={[Number(context.school.lng), Number(context.school.lat)]}
              anchor="bottom"
            >
              <View style={styles.schoolMarker}>
                <Ionicons name="school" size={17} color="#0A2D44" />
              </View>
            </Marker>
          )}

        {filters.teacher &&
          context?.teacher &&
          isValidCoord(
            context.teacher.current_lat ?? context.teacher.home_lat,
            context.teacher.current_lng ?? context.teacher.home_lng
          ) && (
            <Marker
              id="teacher-self"
              lngLat={[
                Number(context.teacher.current_lng ?? context.teacher.home_lng),
                Number(context.teacher.current_lat ?? context.teacher.home_lat),
              ]}
              anchor="bottom"
            >
              <View style={styles.teacherMarker}>
                <Ionicons name="person" size={15} color="#FFFFFF" />
              </View>
            </Marker>
          )}

        {filters.students &&
          (context?.students ?? []).map((item) => {
            if (!isValidCoord(item.student.home_lat, item.student.home_lng)) {
              return null;
            }

            const state = states[String(item.student.id)];
            const done = isStudentDoneForPeriod(item, period, state);
            const isTarget = target?.student.id === item.student.id;

            return (
              <Marker
                key={String(item.student.id)}
                id={`teacher-student-${item.student.id}`}
                lngLat={[
                  Number(item.student.home_lng),
                  Number(item.student.home_lat),
                ]}
                anchor="bottom"
              >
                <Pressable
                  onPress={() => void openStudent(item)}
                  style={[
                    styles.studentMarker,
                    state?.excused && styles.studentExcused,
                    done && !state?.excused && styles.studentDone,
                    isTarget && styles.studentTarget,
                  ]}
                >
                  <Ionicons
                    name={
                      state?.excused
                        ? 'calendar'
                        : done
                        ? 'checkmark'
                        : 'person'
                    }
                    size={12}
                    color="#FFFFFF"
                  />
                </Pressable>
              </Marker>
            );
          })}

        {filters.bus &&
          liveLocation &&
          isValidCoord(liveLocation.lat, liveLocation.lng) && (
            <Marker
              id="teacher-live-bus"
              lngLat={[Number(liveLocation.lng), Number(liveLocation.lat)]}
              anchor="bottom"
            >
              <View style={styles.busMarker}>
                <Ionicons name="bus" size={18} color="#0A2D44" />
              </View>
            </Marker>
          )}
      </MapView>

      <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.topStack}>
          <View
            style={[
              styles.searchCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                flexDirection: direction,
              },
            ]}
          >
            <Ionicons name="search" size={18} color="#8191A0" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={
                isRTL
                  ? 'بحث عن طالب أو سائق أو مدرسة...'
                  : 'Search student, driver or school...'
              }
              placeholderTextColor="#8191A0"
              style={[styles.searchInput, { color: theme.colors.text, textAlign }]}
            />

            {!!search && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={19} color="#8191A0" />
              </Pressable>
            )}

            <Pressable onPress={recenter} style={styles.centerButton}>
              <Ionicons name="locate" size={18} color="#0A2D44" />
            </Pressable>
          </View>

          {!!search && !!visibleSearchResults.length && (
            <View
              style={[
                styles.searchResults,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {visibleSearchResults.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    setSearch('');
                    cameraRef.current?.easeTo({
                      center: [item.lng, item.lat],
                      zoom: 17,
                      duration: 350,
                    });
                    if (item.student) void openStudent(item.student);
                  }}
                  style={[
                    styles.searchResult,
                    {
                      flexDirection: direction,
                      borderBottomColor: theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons name="location-outline" size={16} color="#F7B83A" />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.searchResultTitle,
                        { color: theme.colors.text, textAlign },
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        styles.searchResultSub,
                        { color: theme.colors.textSecondary, textAlign },
                      ]}
                    >
                      {item.subtitle}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          <View style={[styles.summary, { flexDirection: direction }]}>
            <Summary
              icon="people"
              value={counts.total}
              label={isRTL ? 'طلاب' : 'Students'}
            />
            <View style={styles.divider} />
            <Summary
              icon="checkmark-done"
              value={counts.done}
              label={period === 'morning' ? (isRTL ? 'تم الاستلام' : 'Picked') : (isRTL ? 'تم التوصيل' : 'Delivered')}
            />
            <View style={styles.divider} />
            <Summary
              icon="calendar"
              value={counts.excused}
              label={isRTL ? 'مجاز' : 'Excused'}
            />
          </View>

          <View style={[styles.actionRow, { flexDirection: direction }]}>
            <Pressable onPress={() => setFilterOpen(true)} style={styles.filterButton}>
              <Ionicons name="options-outline" size={18} color="#0A2D44" />
              <Text style={styles.filterText}>
                {isRTL ? 'الفلاتر' : 'Filters'}
              </Text>
            </Pressable>

            <Pressable onPress={() => setIncidentOpen(true)} style={styles.incidentButton}>
              <Ionicons name="warning-outline" size={18} color="#FFFFFF" />
              <Text style={styles.incidentText}>
                {isRTL ? 'بلاغ' : 'Incident'}
              </Text>
            </Pressable>

            <View
              style={[
                styles.routePill,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.routeText, { color: theme.colors.text }]}
              >
                {routeName(context?.route) || '—'}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {!!target && (
        <View
          style={[
            styles.targetCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              width: responsiveMap.isTabletSize
                ? Math.min(520, responsiveMap.width - 32)
                : undefined,
              alignSelf: responsiveMap.isTabletSize
                ? 'center'
                : undefined,
            },
          ]}
        >
          <View style={[styles.targetHead, { flexDirection: direction }]}>
            <View style={styles.targetIcon}>
              <Ionicons name="navigate" size={18} color="#0A2D44" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.targetEyebrow, { color: '#1677FF', textAlign }]}>
                {period === 'morning'
                  ? isRTL
                    ? 'الطالب التالي للاستلام'
                    : 'Next Pickup'
                  : isRTL
                  ? 'الطالب التالي للتوصيل'
                  : 'Next Delivery'}
              </Text>
              <Text
                style={[styles.targetName, { color: theme.colors.text, textAlign }]}
              >
                {rowName(target.student)}
              </Text>
              <Text
                style={[
                  styles.targetMeta,
                  { color: theme.colors.textSecondary, textAlign },
                ]}
              >
                {`${formatDistance(roadRoute?.distanceMeters)} • ${formatEta(
                  roadRoute?.durationSeconds
                )}`}
              </Text>
            </View>

            <Pressable onPress={() => void openStudent(target)} style={styles.targetMore}>
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.text} />
            </Pressable>
          </View>
        </View>
      )}

      <Modal
        transparent
        animationType="slide"
        visible={filterOpen}
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilterOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
            <SheetHeader
              icon="options"
              title={isRTL ? 'الفلاتر وخيارات العرض' : 'Filters & Display'}
              onClose={() => setFilterOpen(false)}
            />

            <Text style={[styles.sheetLabel, { color: theme.colors.textSecondary, textAlign }]}>
              {isRTL ? 'الفترة' : 'Period'}
            </Text>

            <View
              style={[
                styles.periodSwitch,
                {
                  flexDirection: direction,
                  backgroundColor: theme.colors.surface2,
                },
              ]}
            >
              <Pressable
                onPress={() => setPeriod('morning')}
                style={[
                  styles.periodButton,
                  period === 'morning' && styles.periodActive,
                ]}
              >
                <Ionicons name="sunny-outline" size={16} color="#0A2D44" />
                <Text style={styles.periodButtonText}>
                  {isRTL ? 'صباحية' : 'Morning'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setPeriod('afternoon')}
                style={[
                  styles.periodButton,
                  period === 'afternoon' && styles.periodActive,
                ]}
              >
                <Ionicons name="moon-outline" size={16} color="#0A2D44" />
                <Text style={styles.periodButtonText}>
                  {isRTL ? 'مسائية' : 'Afternoon'}
                </Text>
              </Pressable>
            </View>

            {[
              ['students', isRTL ? 'الطلاب' : 'Students', 'people-outline'],
              ['bus', isRTL ? 'الباص المباشر' : 'Live Bus', 'bus-outline'],
              ['school', isRTL ? 'المدرسة' : 'School', 'school-outline'],
              ['teacher', isRTL ? 'موقع المعلم' : 'Teacher Location', 'person-outline'],
              ['routeLine', isRTL ? 'مسار الشارع للطالب التالي' : 'Street Route to Next Student', 'navigate-outline'],
            ].map(([key, label, icon]) => {
              const checked = filters[key as keyof FilterState];

              return (
                <Pressable
                  key={key}
                  onPress={() =>
                    setFilters((current) => ({
                      ...current,
                      [key]: !current[key as keyof FilterState],
                    }))
                  }
                  style={[
                    styles.filterRow,
                    {
                      flexDirection: direction,
                      borderBottomColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.filterIcon}>
                    <Ionicons name={icon as any} size={18} color="#0A2D44" />
                  </View>
                  <Text
                    style={[
                      styles.filterRowText,
                      { flex: 1, color: theme.colors.text, textAlign },
                    ]}
                  >
                    {label}
                  </Text>
                  <Ionicons
                    name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={checked ? '#10A66A' : '#98A2B3'}
                  />
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => {
                setFilterOpen(false);
                setTimeout(recenter, 120);
              }}
              style={styles.applyButton}
            >
              <Ionicons name="checkmark-done" size={19} color="#0A2D44" />
              <Text style={styles.applyText}>
                {isRTL ? 'تطبيق' : 'Apply'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={!!selectedStudent}
        onRequestClose={() => setSelectedStudent(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedStudent(null)} />
          {!!selectedStudent && (
            <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
              <SheetHeader
                icon="person"
                title={rowName(selectedStudent.student)}
                onClose={() => setSelectedStudent(null)}
              />

              <View
                style={[
                  styles.studentStatusCard,
                  { backgroundColor: theme.colors.surface2 },
                ]}
              >
                <Text
                  style={[
                    styles.studentStatusTitle,
                    { color: theme.colors.text, textAlign },
                  ]}
                >
                  {statusLabel(
                    selectedStudent,
                    period,
                    isRTL,
                    states[String(selectedStudent.student.id)]
                  )}
                </Text>

                {!!states[String(selectedStudent.student.id)]?.instruction && (
                  <Text
                    style={[
                      styles.studentStatusSub,
                      { color: theme.colors.textSecondary, textAlign },
                    ]}
                  >
                    {states[String(selectedStudent.student.id)]?.instruction}
                  </Text>
                )}

                {!!states[String(selectedStudent.student.id)]?.request && (
                  <Text
                    style={[
                      styles.studentStatusSub,
                      { color: theme.colors.textSecondary, textAlign },
                    ]}
                  >
                    {states[String(selectedStudent.student.id)]?.request}
                  </Text>
                )}
              </View>

              <View style={[styles.actionButtons, { flexDirection: direction }]}>
                <Pressable
                  onPress={() => void sendReachedNotice(selectedStudent)}
                  style={styles.arrivalButton}
                >
                  <Ionicons name="notifications" size={18} color="#0A2D44" />
                  <Text style={styles.arrivalText}>
                    {isRTL ? 'تنبيه وصلت' : 'Arrival Alert'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void openContactPicker(selectedStudent)}
                  style={[
                    styles.callButton,
                    secondsUntilCall(String(selectedStudent.student.id)) !== 0 &&
                      styles.callButtonDisabled,
                  ]}
                >
                  <Ionicons name="call" size={18} color="#FFFFFF" />
                  <Text style={styles.callText}>
                    {secondsUntilCall(String(selectedStudent.student.id)) == null
                      ? isRTL
                        ? 'اتصال بعد التنبيه'
                        : 'Call After Alert'
                      : secondsUntilCall(String(selectedStudent.student.id))! > 0
                      ? isRTL
                        ? `${secondsUntilCall(String(selectedStudent.student.id))} ث`
                        : `${secondsUntilCall(String(selectedStudent.student.id))}s`
                      : isRTL
                      ? 'اتصال بولي الأمر'
                      : 'Call Parent'}
                  </Text>
                </Pressable>
              </View>

              <Text style={[styles.sheetLabel, { color: theme.colors.textSecondary, textAlign }]}>
                {isRTL ? 'أولياء الأمور' : 'Parents'}
              </Text>

              {parentContacts.length ? (
                parentContacts.map((contact) => (
                  <View
                    key={contact.id}
                    style={[
                      styles.parentRow,
                      {
                        flexDirection: direction,
                        borderBottomColor: theme.colors.border,
                      },
                    ]}
                  >
                    <View style={styles.parentIcon}>
                      <Ionicons name="person-outline" size={17} color="#0A2D44" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.parentName,
                          { color: theme.colors.text, textAlign },
                        ]}
                      >
                        {contact.name}
                      </Text>
                      <Text
                        style={[
                          styles.parentPhone,
                          { color: theme.colors.textSecondary, textAlign },
                        ]}
                      >
                        {[contact.relation, contact.phone]
                          .filter(Boolean)
                          .join(' • ')}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text
                  style={[
                    styles.noParents,
                    { color: theme.colors.textSecondary, textAlign },
                  ]}
                >
                  {isRTL ? 'لا توجد أرقام أولياء أمور محفوظة.' : 'No parent phone numbers found.'}
                </Text>
              )}
            </View>
          )}
        </View>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={contactOpen}
        onRequestClose={() => setContactOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setContactOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
            <SheetHeader
              icon="call"
              title={isRTL ? 'اختر رقم ولي الأمر' : 'Choose Parent Number'}
              onClose={() => setContactOpen(false)}
            />

            {parentContacts.map((contact) => (
              <Pressable
                key={contact.id}
                onPress={() => {
                  setContactOpen(false);
                  void callPhone(contact.phone);
                }}
                style={[
                  styles.parentRow,
                  {
                    flexDirection: direction,
                    borderBottomColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.parentIcon}>
                  <Ionicons name="call-outline" size={17} color="#0A2D44" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.parentName,
                      { color: theme.colors.text, textAlign },
                    ]}
                  >
                    {contact.name}
                  </Text>
                  <Text
                    style={[
                      styles.parentPhone,
                      { color: theme.colors.textSecondary, textAlign },
                    ]}
                  >
                    {[contact.relation, contact.phone].filter(Boolean).join(' • ')}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={incidentOpen}
        onRequestClose={() => setIncidentOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIncidentOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
            <SheetHeader
              icon="warning"
              title={isRTL ? 'إرسال بلاغ للإدارة' : 'Report Incident'}
              onClose={() => setIncidentOpen(false)}
            />

            <TextInput
              value={incidentTitle}
              onChangeText={setIncidentTitle}
              placeholder={isRTL ? 'عنوان البلاغ' : 'Incident title'}
              placeholderTextColor="#8191A0"
              style={[
                styles.incidentInput,
                {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                  textAlign,
                },
              ]}
            />

            <TextInput
              value={incidentBody}
              onChangeText={setIncidentBody}
              placeholder={isRTL ? 'تفاصيل البلاغ...' : 'Incident details...'}
              placeholderTextColor="#8191A0"
              multiline
              style={[
                styles.incidentTextArea,
                {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                  textAlign,
                },
              ]}
            />

            <View style={[styles.severityRow, { flexDirection: direction }]}>
              {[
                ['low', isRTL ? 'منخفض' : 'Low'],
                ['medium', isRTL ? 'متوسط' : 'Medium'],
                ['high', isRTL ? 'عالي' : 'High'],
              ].map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setIncidentSeverity(value as any)}
                  style={[
                    styles.severityButton,
                    {
                      backgroundColor:
                        incidentSeverity === value ? '#F7B83A' : theme.colors.surface2,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.severityText,
                      {
                        color:
                          incidentSeverity === value
                            ? '#0A2D44'
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              disabled={
                submittingIncident ||
                !incidentTitle.trim() ||
                !incidentBody.trim()
              }
              onPress={() => void submitIncident()}
              style={[
                styles.applyButton,
                {
                  opacity:
                    submittingIncident ||
                    !incidentTitle.trim() ||
                    !incidentBody.trim()
                      ? 0.55
                      : 1,
                },
              ]}
            >
              {submittingIncident ? (
                <ActivityIndicator color="#0A2D44" />
              ) : (
                <Ionicons name="send" size={18} color="#0A2D44" />
              )}
              <Text style={styles.applyText}>
                {isRTL ? 'إرسال البلاغ' : 'Send Incident'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );

  function Summary({
    icon,
    value,
    label,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    value: number;
    label: string;
  }) {
    return (
      <View style={styles.summaryItem}>
        <Ionicons name={icon} size={14} color="#F7B83A" />
        <Text style={styles.summaryValue}>{value}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
    );
  }

  function SheetHeader({
    icon,
    title,
    onClose,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    onClose: () => void;
  }) {
    return (
      <View style={[styles.sheetHeader, { flexDirection: direction }]}>
        <View style={styles.sheetIcon}>
          <Ionicons name={icon} size={20} color="#0A2D44" />
        </View>
        <Text
          style={[
            styles.sheetTitle,
            { flex: 1, color: theme.colors.text, textAlign },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Pressable
          onPress={onClose}
          style={[styles.sheetClose, { backgroundColor: theme.colors.surface2 }]}
        >
          <Ionicons name="close" size={19} color={theme.colors.text} />
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A2D44' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject },
  topStack: { paddingHorizontal: 12, gap: 8 },
  searchCard: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 7,
    elevation: 5,
  },
  searchInput: { flex: 1, height: 50, fontSize: 10.2, fontWeight: '700' },
  centerButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  searchResults: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  searchResult: { minHeight: 48, paddingHorizontal: 10, alignItems: 'center', gap: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  searchResultTitle: { fontSize: 9, fontWeight: '900' },
  searchResultSub: { marginTop: 2, fontSize: 7, fontWeight: '600' },
  summary: { minHeight: 58, borderRadius: 18, backgroundColor: 'rgba(10,45,68,0.96)', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryValue: { color: '#FFFFFF', marginTop: 2, fontSize: 10, fontWeight: '900' },
  summaryLabel: { color: '#AFC2D0', marginTop: 1, fontSize: 6.5, fontWeight: '700' },
  divider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: 'rgba(255,255,255,0.16)' },
  actionRow: { gap: 7 },
  filterButton: { minHeight: 44, borderRadius: 15, backgroundColor: '#F7B83A', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterText: { color: '#0A2D44', fontSize: 8.2, fontWeight: '900' },
  incidentButton: { minHeight: 44, borderRadius: 15, backgroundColor: '#D92D20', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  incidentText: { color: '#FFFFFF', fontSize: 8.2, fontWeight: '900' },
  routePill: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  routeText: { fontSize: 8.2, fontWeight: '900' },
  schoolMarker: { width: 40, height: 40, borderRadius: 14, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  teacherMarker: { width: 34, height: 34, borderRadius: 12, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  studentMarker: { width: 30, height: 30, borderRadius: 11, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#0A2D44', alignItems: 'center', justifyContent: 'center' },
  studentDone: { backgroundColor: '#10A66A' },
  studentExcused: { backgroundColor: '#667085' },
  studentTarget: { backgroundColor: '#1677FF', transform: [{ scale: 1.18 }] },
  busMarker: { width: 44, height: 44, borderRadius: 15, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  targetCard: { position: 'absolute', left: 12, right: 12, bottom: 92, borderWidth: 1, borderRadius: 20, padding: 11, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 7 },
  targetHead: { alignItems: 'center', gap: 9 },
  targetIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  targetEyebrow: { fontSize: 7.2, fontWeight: '900' },
  targetName: { marginTop: 2, fontSize: 11.5, fontWeight: '900' },
  targetMeta: { marginTop: 3, fontSize: 7.6, fontWeight: '700' },
  targetMore: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,20,32,0.45)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, paddingBottom: 28 },
  sheetHeader: { alignItems: 'center', gap: 8, marginBottom: 8 },
  sheetIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 14, fontWeight: '900' },
  sheetClose: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sheetLabel: { marginTop: 10, marginBottom: 7, fontSize: 8.5, fontWeight: '800' },
  periodSwitch: { minHeight: 45, borderRadius: 14, padding: 3 },
  periodButton: { flex: 1, minHeight: 39, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  periodActive: { backgroundColor: '#F7B83A' },
  periodButtonText: { color: '#0A2D44', fontSize: 8.5, fontWeight: '900' },
  filterRow: { minHeight: 57, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: 8 },
  filterIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FFF5D8', alignItems: 'center', justifyContent: 'center' },
  filterRowText: { fontSize: 9.5, fontWeight: '900' },
  applyButton: { marginTop: 14, minHeight: 48, borderRadius: 15, backgroundColor: '#F7B83A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  applyText: { color: '#0A2D44', fontSize: 10, fontWeight: '900' },
  studentStatusCard: { borderRadius: 16, padding: 12 },
  studentStatusTitle: { fontSize: 11, fontWeight: '900' },
  studentStatusSub: { marginTop: 5, fontSize: 8, lineHeight: 12, fontWeight: '600' },
  actionButtons: { marginTop: 11, gap: 8 },
  arrivalButton: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: '#F7B83A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  arrivalText: { color: '#0A2D44', fontSize: 8.7, fontWeight: '900' },
  callButton: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: '#10A66A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  callButtonDisabled: { backgroundColor: '#667085' },
  callText: { color: '#FFFFFF', fontSize: 8.3, fontWeight: '900' },
  parentRow: { minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: 8 },
  parentIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFF5D8', alignItems: 'center', justifyContent: 'center' },
  parentName: { fontSize: 9.5, fontWeight: '900' },
  parentPhone: { marginTop: 2, fontSize: 7.5, fontWeight: '600' },
  noParents: { paddingVertical: 12, fontSize: 8.5, fontWeight: '700' },
  incidentInput: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, fontSize: 10, fontWeight: '700' },
  incidentTextArea: { minHeight: 110, marginTop: 9, borderWidth: 1, borderRadius: 14, padding: 11, fontSize: 10, fontWeight: '700', textAlignVertical: 'top' },
  severityRow: { marginTop: 9, gap: 7 },
  severityButton: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  severityText: { fontSize: 8.3, fontWeight: '900' },
});
