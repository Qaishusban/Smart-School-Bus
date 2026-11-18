import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Camera, Map as MapView, Marker } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../hooks/useAuth';
import { useResolvedSchoolId } from '../../hooks/useResolvedSchoolId';
import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { MAP_CONFIG } from '../../config/mapConfig';
import {
  AdminRow,
  getAdminMapData,
  subscribeToAdminBusLocations,
} from '../../services/adminPremiumService';
import AdminMapFilterModal, { AdminMapViewMode } from '../../components/admin/AdminMapFilterModal';

type CameraHandle = React.ElementRef<typeof Camera>;
type ViewMode = AdminMapViewMode;

type MarkerDetails = {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  image?: string | null;
  lines: string[];
};

function validCoordinate(lat: unknown, lng: unknown) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function ageText(value: unknown, isRTL: boolean) {
  if (!value) return isRTL ? 'غير معروف' : 'Unknown';
  const date = new Date(String(value));
  const diff = Date.now() - date.getTime();
  if (!Number.isFinite(diff)) return '—';
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return isRTL ? 'الآن' : 'Now';
  if (minutes < 60) return isRTL ? `قبل ${minutes} د` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return isRTL ? `قبل ${hours} س` : `${hours}h ago`;
}

export default function AdminFleetMapScreen() {
  const responsiveMap = useResponsiveLayout();

  const { user } = useAuth();
  const { schoolId } = useResolvedSchoolId(user);
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();
  const cameraRef = useRef<CameraHandle>(null);

  const [school, setSchool] = useState<AdminRow | null>(null);
  const [routes, setRoutes] = useState<AdminRow[]>([]);
  const [students, setStudents] = useState<AdminRow[]>([]);
  const [buses, setBuses] = useState<AdminRow[]>([]);
  const [teachers, setTeachers] = useState<AdminRow[]>([]);
  const [liveLocations, setLiveLocations] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ViewMode>('all');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [filterModal, setFilterModal] = useState(false);
  const [search, setSearch] = useState('');
  const [markerDetails, setMarkerDetails] = useState<MarkerDetails | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getAdminMapData(schoolId);
      setSchool(result.school);
      setRoutes(result.routes ?? []);
      setStudents(result.students ?? []);
      setBuses(result.buses ?? []);
      setTeachers(result.teachers ?? []);
      setLiveLocations(result.liveLocations ?? []);
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر تحميل الخريطة' : 'Unable to Load Map', error?.message ?? String(error));
    } finally {
      setLoading(false);
    }
  }, [schoolId, isRTL]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!buses.length) return;

    const busIds = buses.map((bus) => String(bus.id));

    return subscribeToAdminBusLocations(
      busIds,
      (row) => {
        if (
          !row?.bus_id ||
          !busIds.includes(String(row.bus_id)) ||
          !validCoordinate(row.lat, row.lng)
        ) {
          return;
        }

        setLiveLocations((current) => {
          const existing = current.find(
            (item) => String(item.bus_id) === String(row.bus_id)
          );

          if (existing?.updated_at && row?.updated_at) {
            const oldTime = new Date(String(existing.updated_at)).getTime();
            const newTime = new Date(String(row.updated_at)).getTime();

            if (
              Number.isFinite(oldTime) &&
              Number.isFinite(newTime) &&
              newTime < oldTime
            ) {
              return current;
            }
          }

          return [
            row,
            ...current.filter(
              (item) => String(item.bus_id) !== String(row.bus_id)
            ),
          ];
        });
      }
    );
  }, [buses]);

  /*
   * مزامنة احتياطية لبيانات الخريطة كل 15 ثانية.
   * الاشتراك المباشر أعلاه هو التحديث الأساسي والفوري.
   */
  useEffect(() => {
    if (!schoolId) return;

    const timer = setInterval(async () => {
      try {
        const result = await getAdminMapData(schoolId);

        setSchool(result.school);
        setRoutes(result.routes ?? []);
        setStudents(result.students ?? []);
        setBuses(result.buses ?? []);
        setTeachers(result.teachers ?? []);
        setLiveLocations(result.liveLocations ?? []);
      } catch (error) {
        console.log('[AdminFleetMap] FALLBACK SYNC ERROR:', error);
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [schoolId]);

  const busById = useMemo(() => new Map(buses.map((row) => [String(row.id), row])), [buses]);
  const routeById = useMemo(() => new Map(routes.map((row) => [String(row.id), row])), [routes]);
  const selectedRoute = selectedRouteId ? routeById.get(selectedRouteId) ?? null : null;
  const routeBusId = selectedRoute?.bus_id ? String(selectedRoute.bus_id) : null;

  const visibleStudents = useMemo(() => {
    if (mode === 'buses') return [];
    return students.filter((student) => {
      if (!validCoordinate(student.home_lat, student.home_lng)) return false;
      if (mode === 'route' && selectedRouteId) return String(student.route_id ?? '') === String(selectedRouteId);
      return true;
    });
  }, [students, mode, selectedRouteId]);

  const visibleTeachers = useMemo(() => {
    if (mode === 'students' || mode === 'buses') return [];
    return teachers.filter((teacher) => {
      const lat = teacher.current_lat ?? teacher.home_lat;
      const lng = teacher.current_lng ?? teacher.home_lng;
      if (!validCoordinate(lat, lng)) return false;
      if (mode === 'route' && selectedRouteId) return String(teacher.route_id ?? '') === String(selectedRouteId);
      return true;
    });
  }, [teachers, mode, selectedRouteId]);

  const visibleLocations = useMemo(() => {
    if (mode === 'students') return [];
    return liveLocations.filter((location) => {
      if (!validCoordinate(location.lat, location.lng)) return false;
      if (mode === 'route' && routeBusId) return String(location.bus_id) === routeBusId;
      return true;
    });
  }, [liveLocations, mode, routeBusId]);

  const center = useMemo<[number, number]>(() => {
    const coords: Array<[number, number]> = [];
    visibleStudents.forEach((s) => coords.push([Number(s.home_lng), Number(s.home_lat)]));
    visibleTeachers.forEach((t) => coords.push([Number(t.current_lng ?? t.home_lng), Number(t.current_lat ?? t.home_lat)]));
    visibleLocations.forEach((l) => coords.push([Number(l.lng), Number(l.lat)]));
    if (school && validCoordinate(school.lat, school.lng)) coords.push([Number(school.lng), Number(school.lat)]);
    if (!coords.length) return [MAP_CONFIG.defaultCenter.longitude, MAP_CONFIG.defaultCenter.latitude];
    return [coords.reduce((sum, item) => sum + item[0], 0) / coords.length, coords.reduce((sum, item) => sum + item[1], 0) / coords.length];
  }, [visibleStudents, visibleTeachers, visibleLocations, school]);

  const suggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    const rows: Array<{ key: string; type: 'student' | 'bus' | 'route' | 'teacher'; title: string; subtitle: string; row: AdminRow }> = [];
    students.forEach((row) => {
      const hay = [row.full_name, row.grade_name, row.section_name].filter(Boolean).join(' ').toLowerCase();
      if (hay.includes(term)) rows.push({ key: `s-${row.id}`, type: 'student', title: String(row.full_name ?? '—'), subtitle: [row.grade_name, row.section_name].filter(Boolean).join(' • '), row });
    });
    teachers.forEach((row) => {
      const hay = [row.full_name, row.phone, row.subject].filter(Boolean).join(' ').toLowerCase();
      if (hay.includes(term)) rows.push({ key: `t-${row.id}`, type: 'teacher', title: String(row.full_name ?? '—'), subtitle: String(row.subject ?? row.phone ?? ''), row });
    });
    buses.forEach((row) => {
      const hay = [row.bus_number, row.plate_number, row.driver_name].filter(Boolean).join(' ').toLowerCase();
      if (hay.includes(term)) rows.push({ key: `b-${row.id}`, type: 'bus', title: `${isRTL ? 'باص' : 'Bus'} ${String(row.bus_number ?? '—')}`, subtitle: String(row.plate_number ?? row.driver_name ?? ''), row });
    });
    routes.forEach((row) => {
      if (String(row.name ?? '').toLowerCase().includes(term)) rows.push({ key: `r-${row.id}`, type: 'route', title: String(row.name ?? '—'), subtitle: String(row.direction ?? ''), row });
    });
    return rows.slice(0, 6);
  }, [search, students, teachers, buses, routes, isRTL]);

  function chooseSuggestion(item: (typeof suggestions)[number]) {
    if (item.type === 'route') {
      setMode('route');
      setSelectedRouteId(String(item.row.id));
      setSearch(item.title);
      return;
    }
    if (item.type === 'student' && validCoordinate(item.row.home_lat, item.row.home_lng)) {
      cameraRef.current?.easeTo({ center: [Number(item.row.home_lng), Number(item.row.home_lat)], zoom: 17, duration: 500 });
    }
    if (item.type === 'teacher') {
      const lat = item.row.current_lat ?? item.row.home_lat;
      const lng = item.row.current_lng ?? item.row.home_lng;
      if (validCoordinate(lat, lng)) cameraRef.current?.easeTo({ center: [Number(lng), Number(lat)], zoom: 17, duration: 500 });
    }
    if (item.type === 'bus') {
      const live = liveLocations.find((row) => String(row.bus_id) === String(item.row.id));
      if (live && validCoordinate(live.lat, live.lng)) cameraRef.current?.easeTo({ center: [Number(live.lng), Number(live.lat)], zoom: 17, duration: 500 });
    }
    setSearch(item.title);
  }

  function clearSearch() {
    setSearch('');
    cameraRef.current?.easeTo({ center, zoom: mode === 'route' ? 14 : 11.5, duration: 400 });
  }

  if (loading) {
    return <View style={[styles.loading, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" color="#F7B83A" /></View>;
  }

  return (
    <View style={styles.root}>
      <MapView style={StyleSheet.absoluteFill} mapStyle={MAP_CONFIG.developmentStyle} attribution logo compass androidView="texture">
        <Camera ref={cameraRef} initialViewState={{ center, zoom: 11.5 }} minZoom={3} maxZoom={20} />

        {school && validCoordinate(school.lat, school.lng) && (
          <Marker id="school-marker" lngLat={[Number(school.lng), Number(school.lat)]} anchor="center">
            <Pressable style={styles.namedMarkerWrap} onPress={() => setMarkerDetails({ title: String(school.name ?? (isRTL ? 'المدرسة' : 'School')), icon: 'school-outline', image: school.logo_url ? String(school.logo_url) : null, lines: [school.email ? `${isRTL ? 'البريد' : 'Email'}: ${school.email}` : '', school.phone ? `${isRTL ? 'الهاتف' : 'Phone'}: ${school.phone}` : ''].filter(Boolean) })}>
              <View style={styles.schoolMarker}>{school.logo_url ? <Image source={{ uri: String(school.logo_url) }} style={styles.markerLogo} resizeMode="contain" /> : <Ionicons name="school" size={19} color="#0A2D44" />}</View>
              <Text numberOfLines={1} style={styles.markerName}>{String(school.name ?? (isRTL ? 'المدرسة' : 'School'))}</Text>
            </Pressable>
          </Marker>
        )}

        {visibleStudents.map((student) => (
          <Marker key={`student-${student.id}`} id={`student-${student.id}`} lngLat={[Number(student.home_lng), Number(student.home_lat)]} anchor="center">
            <Pressable style={styles.namedMarkerWrap} onPress={() => setMarkerDetails({ title: String(student.full_name ?? student.name ?? (isRTL ? 'طالب' : 'Student')), icon: 'person-outline', image: student.photo_url ? String(student.photo_url) : null, lines: [[student.grade_name ?? student.grade, student.section_name ?? student.section].filter(Boolean).join(' • '), student.parent_phone ? `${isRTL ? 'ولي الأمر' : 'Parent'}: ${student.parent_phone}` : ''].filter(Boolean) })}>
              <View style={styles.studentMarker}><Ionicons name="person" size={13} color="#FFFFFF" /></View>
              <Text numberOfLines={1} style={styles.markerName}>{String(student.full_name ?? student.name ?? '—')}</Text>
            </Pressable>
          </Marker>
        ))}

        {visibleTeachers.map((teacher) => {
          const lat = Number(teacher.current_lat ?? teacher.home_lat);
          const lng = Number(teacher.current_lng ?? teacher.home_lng);
          return (
            <Marker key={`teacher-${teacher.id}`} id={`teacher-${teacher.id}`} lngLat={[lng, lat]} anchor="center">
              <Pressable style={styles.namedMarkerWrap} onPress={() => setMarkerDetails({ title: String(teacher.full_name ?? (isRTL ? 'معلم / مشرف' : 'Teacher / Supervisor')), icon: 'school-outline', image: teacher.photo_url ? String(teacher.photo_url) : teacher.avatar_url ? String(teacher.avatar_url) : null, lines: [teacher.subject ? String(teacher.subject) : '', teacher.phone ? `${isRTL ? 'الهاتف' : 'Phone'}: ${teacher.phone}` : '', routeById.get(String(teacher.route_id ?? ''))?.name ? `${isRTL ? 'المسار' : 'Route'}: ${routeById.get(String(teacher.route_id))?.name}` : ''].filter(Boolean) })}>
                <View style={styles.teacherMarker}><Ionicons name="school" size={14} color="#FFFFFF" /></View>
                <Text numberOfLines={1} style={styles.markerName}>{String(teacher.full_name ?? '—')}</Text>
              </Pressable>
            </Marker>
          );
        })}

        {visibleLocations.map((location) => {
          const bus = busById.get(String(location.bus_id));
          return (
            <Marker key={`bus-${location.bus_id}`} id={`bus-${location.bus_id}`} lngLat={[Number(location.lng), Number(location.lat)]} anchor="center">
              <Pressable style={styles.namedMarkerWrap} onPress={() => setMarkerDetails({ title: `${isRTL ? 'باص' : 'Bus'} ${String(bus?.bus_number ?? '—')}`, icon: 'bus-outline', image: bus?.photo_url ? String(bus.photo_url) : null, lines: [bus?.driver_name ? `${isRTL ? 'السائق' : 'Driver'}: ${bus.driver_name}` : '', bus?.plate_number ? `${isRTL ? 'اللوحة' : 'Plate'}: ${bus.plate_number}` : '', ageText(location.updated_at, isRTL)].filter(Boolean) })}>
                <View style={styles.busMarker}><Ionicons name="bus" size={18} color="#0A2D44" /></View>
                <Text numberOfLines={1} style={styles.markerName}>{`${isRTL ? 'باص' : 'Bus'} ${String(bus?.bus_number ?? '—')}`}</Text>
              </Pressable>
            </Marker>
          );
        })}
      </MapView>

      <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.topControls} pointerEvents="box-none">
          <View style={styles.topSearchRow}>
            <View style={[styles.searchCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}>
            <Ionicons name="search-outline" size={18} color="#8191A0" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={isRTL ? 'بحث طالب، معلم، باص أو مسار...' : 'Search student, teacher, bus or route...'}
              placeholderTextColor="#8191A0"
              style={[styles.searchInput, { color: theme.colors.text, textAlign }]}
            />
            {!!search && (
              <Pressable onPress={clearSearch} style={styles.clearButton}>
                <Ionicons name="close" size={18} color="#0A2D44" />
              </Pressable>
            )}
          </View>
        </View>

        {!!search.trim() && !!suggestions.length && (
          <View style={[styles.searchSuggestions, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {suggestions.map((item, index) => (
              <Pressable key={item.key} onPress={() => chooseSuggestion(item)} style={[styles.suggestionRow, { flexDirection: direction, borderBottomColor: theme.colors.border }, index === suggestions.length - 1 && { borderBottomWidth: 0 }]}>
                <Ionicons name={item.type === 'student' ? 'person-outline' : item.type === 'teacher' ? 'school-outline' : item.type === 'bus' ? 'bus-outline' : 'map-outline'} size={17} color="#F7B83A" />
                <View style={{ flex: 1 }}><Text style={[styles.suggestionTitle, { color: theme.colors.text, textAlign }]}>{item.title}</Text><Text style={[styles.suggestionSub, { color: theme.colors.textSecondary, textAlign }]}>{item.subtitle}</Text></View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={[styles.summary, { flexDirection: direction }]}>
          <Summary icon="people" value={visibleStudents.length} label={isRTL ? 'طالب ظاهر' : 'Students'} />
          <View style={styles.summaryDivider} />
          <Summary icon="bus" value={visibleLocations.length} label={isRTL ? 'باص مباشر' : 'Live Buses'} />
          <View style={styles.summaryDivider} />
          <Summary icon="map" value={routes.length} label={isRTL ? 'مسار' : 'Routes'} />
        </View>

        <Pressable
          onPress={() => setFilterModal(true)}
          style={[styles.filterButton, { flexDirection: direction }]}
        >
          <Ionicons name="options-outline" size={19} color="#0A2D44" />
          <Text style={styles.filterButtonText}>
            {mode === 'route' && selectedRoute
              ? `${isRTL ? 'الفلاتر' : 'Filters'} • ${String(selectedRoute.name ?? '')}`
              : isRTL
              ? 'الفلاتر وخيارات العرض'
              : 'Filters & display'}
          </Text>
        </Pressable>
        </View>

        <View style={[
  styles.busStripWrap,
  {
    bottom: responsiveMap.isLandscape ? 4 : 8,
    left: responsiveMap.isTabletSize ? 20 : 0,
    right: responsiveMap.isTabletSize ? 20 : 0,
  },
]} pointerEvents="box-none">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.busStrip, { flexDirection: direction }]}>
            {visibleLocations.map((location) => {
              const bus = busById.get(String(location.bus_id));
              return <Pressable key={`live-${location.bus_id}`} onPress={() => cameraRef.current?.easeTo({ center: [Number(location.lng), Number(location.lat)], zoom: 17, duration: 450 })} style={[styles.liveCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><View style={styles.liveIcon}><Ionicons name="bus" size={17} color="#0A2D44" /></View><Text style={[styles.liveTitle, { color: theme.colors.text }]}>{`${isRTL ? 'باص' : 'Bus'} ${String(bus?.bus_number ?? '—')}`}</Text><Text style={styles.liveSub}>{bus?.driver_name ? String(bus.driver_name) : ageText(location.updated_at, isRTL)}</Text></Pressable>;
            })}
          </ScrollView>
        </View>
      </SafeAreaView>

      <AdminMapFilterModal visible={filterModal} mode={mode} selectedRouteId={selectedRouteId} routes={routes} onClose={() => setFilterModal(false)} onApply={(nextMode, routeId) => { setMode(nextMode); setSelectedRouteId(routeId); setFilterModal(false); }} />

      <Modal transparent animationType="fade" visible={!!markerDetails} onRequestClose={() => setMarkerDetails(null)}>
        <View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setMarkerDetails(null)} />{!!markerDetails && <View style={[styles.detailCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><View style={[styles.detailTop, { flexDirection: direction }]}>{markerDetails.image ? <Image source={{ uri: markerDetails.image }} style={styles.detailImage} resizeMode="cover" /> : <View style={styles.detailIcon}><Ionicons name={markerDetails.icon} size={25} color="#0A2D44" /></View>}<View style={{ flex: 1 }}><Text style={[styles.detailTitle, { color: theme.colors.text, textAlign }]}>{markerDetails.title}</Text>{markerDetails.lines.map((line, index) => <Text key={`${line}-${index}`} style={[styles.detailLine, { color: theme.colors.textSecondary, textAlign }]}>{line}</Text>)}</View><Pressable onPress={() => setMarkerDetails(null)} style={styles.modalClose}><Ionicons name="close" size={20} color="#0A2D44" /></Pressable></View></View>}</View>
      </Modal>
    </View>
  );

  function Summary({ icon, value, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; value: number; label: string }) {
    return <View style={styles.summaryItem}><Ionicons name={icon} size={14} color="#F7B83A" /><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A2D44' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject },
  topControls: { marginTop: 18, marginHorizontal: 12, zIndex: 24 },
  topSearchRow: { zIndex: 24 },
  searchCard: { height: 54, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 7 },
  searchInput: { flex: 1, height: 52, fontSize: 10.5, fontWeight: '700' },
  clearButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  filterButton: { alignSelf: 'flex-start', marginTop: 9, minHeight: 42, borderRadius: 14, backgroundColor: '#F7B83A', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  filterButtonText: { color: '#0A2D44', fontSize: 8.5, fontWeight: '900' },
  searchSuggestions: { position: 'absolute', top: 60, left: 0, right: 0, zIndex: 30, borderRadius: 17, borderWidth: 1, overflow: 'hidden' },
  suggestionRow: { minHeight: 54, paddingHorizontal: 11, alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  suggestionTitle: { fontSize: 9.5, fontWeight: '900' },
  suggestionSub: { marginTop: 2, fontSize: 7, fontWeight: '600' },
  summary: { marginTop: 9, minHeight: 53, borderRadius: 17, backgroundColor: 'rgba(10,45,68,0.95)', alignItems: 'center', zIndex: 18 },
  summaryItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryValue: { color: '#FFFFFF', marginTop: 2, fontSize: 10, fontWeight: '900' },
  summaryLabel: { color: '#AFC2D0', marginTop: 1, fontSize: 6.5, fontWeight: '700' },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: 'rgba(255,255,255,0.18)' },
  namedMarkerWrap: { alignItems: 'center', maxWidth: 115 },
  schoolMarker: { width: 44, height: 44, borderRadius: 15, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  markerLogo: { width: 34, height: 34 },
  studentMarker: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#0A2D44', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  teacherMarker: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#8B5CF6', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  busMarker: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F7B83A', borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  markerName: { marginTop: 2, maxWidth: 115, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.93)', color: '#0A2D44', fontSize: 6.6, fontWeight: '900', textAlign: 'center' },
  busStripWrap: { position: 'absolute', left: 0, right: 0, bottom: 8 },
  busStrip: { paddingHorizontal: 12, gap: 7 },
  liveCard: { minWidth: 132, minHeight: 61, borderWidth: 1, borderRadius: 17, padding: 8 },
  liveIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  liveTitle: { marginTop: 4, fontSize: 8.5, fontWeight: '900' },
  liveSub: { marginTop: 2, color: '#20A06A', fontSize: 6.8, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(5,20,32,0.55)', justifyContent: 'center', padding: 18 },
  detailCard: { borderRadius: 24, borderWidth: 1, padding: 15 },
  detailTop: { alignItems: 'center', gap: 10 },
  detailImage: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#FFFFFF' },
  detailIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  detailTitle: { fontSize: 13, fontWeight: '900' },
  detailLine: { marginTop: 4, fontSize: 8.5, fontWeight: '600' },
  modalClose: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
});