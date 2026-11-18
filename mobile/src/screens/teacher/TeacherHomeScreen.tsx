import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
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
  busNumber,
  getTeacherContext,
  periodLabel,
  routeName,
  rowName,
  TeacherContextData,
  TripPeriod,
} from '../../services/teacherService';

const SYSTEM_LOGO = require('../../assets/system-logo.png') as ImageSourcePropType;

export default function TeacherHomeScreen({ navigation }: any) {
  const responsive = useResponsiveLayout();

  const responsiveTeacherColumns =
    responsive.width >= 1100 ? 4 :
    responsive.width >= 760 ? 3 : 2;

  const responsiveTeacherGap = 8;

  const responsiveTeacherContentWidth =
    Math.max(
      0,
      Math.min(responsive.width, 1100) -
        responsive.horizontalPadding * 2
    );

  const responsiveTeacherCardWidth =
    Math.max(
      0,
      (
        responsiveTeacherContentWidth -
        responsiveTeacherGap *
          (responsiveTeacherColumns - 1)
      ) / responsiveTeacherColumns
    );

  void responsive;

  const { user } = useAuth();
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();

  const [period, setPeriod] = useState<TripPeriod>(
    new Date().getHours() < 12 ? 'morning' : 'afternoon'
  );
  const [data, setData] = useState<TeacherContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (!user?.id) return;

      refresh ? setRefreshing(true) : setLoading(true);

      try {
        setData(
          await getTeacherContext({
            teacherId: user.id,
            username: user.username ?? null,
            schoolId: user.school_id ?? null,
            period,
          })
        );
      } catch (error) {
        console.log('TeacherHome:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id, user?.username, user?.school_id, period]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const teacherName =
    rowName(data?.teacher) ||
    user?.full_name ||
    (isRTL ? 'المعلم / المشرف' : 'Teacher / Supervisor');

  const counts = data?.attendanceCounts;

  const progress = useMemo(() => {
    if (!counts?.total) return 0;
    const completed =
      period === 'morning'
        ? counts.arrived + counts.absent
        : counts.delivered + counts.absent;
    return Math.min(100, Math.round((completed / counts.total) * 100));
  }, [counts, period]);

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color="#F7B83A" />
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#F7B83A"
            onRefresh={() => void load(true)}
          />
        }
        contentContainerStyle={[
          styles.content,
          {
            width: '100%',
            maxWidth: 1100,
            alignSelf: 'center',
            paddingHorizontal: responsive.horizontalPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.brandRow, { flexDirection: direction }]}>
            <View style={styles.systemLogoWrap}>
              <Image source={SYSTEM_LOGO} style={styles.systemLogo} resizeMode="contain" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { textAlign }]}>SMART SCHOOL BUS</Text>
              <Text style={[styles.teacherName, { textAlign }]} numberOfLines={1}>
                {teacherName}
              </Text>
              <Text style={[styles.teacherRole, { textAlign }]}>
                {isRTL ? 'حساب المعلم / مشرف النقل' : 'Teacher / Transport Supervisor'}
              </Text>
            </View>

            <View style={styles.schoolLogoWrap}>
              {data?.school?.logo_url ? (
                <Image
                  source={{ uri: String(data.school.logo_url) }}
                  style={styles.schoolLogo}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons name="school" size={28} color="#0A2D44" />
              )}
            </View>
          </View>

          <View style={[styles.schoolRow, { flexDirection: direction }]}>
            <View style={styles.schoolTextWrap}>
              <Text style={[styles.schoolName, { textAlign }]} numberOfLines={1}>
                {String(data?.school?.name ?? '—')}
              </Text>
              <Text style={[styles.yearText, { textAlign }]}>
                {String(data?.academicYear?.name ?? '—')}
              </Text>
            </View>

            {!!data?.unreadNotifications && (
              <Pressable
                onPress={() => navigation.navigate('TeacherNotifications')}
                style={styles.bell}
              >
                <Ionicons name="notifications" size={20} color="#FFFFFF" />
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{data.unreadNotifications}</Text>
                </View>
              </Pressable>
            )}
          </View>

          <View style={[styles.tripStrip, { flexDirection: direction }]}>
            <Metric
              icon="map-outline"
              value={routeName(data?.route) || '—'}
              label={isRTL ? 'المسار' : 'Route'}
            />
            <View style={styles.divider} />
            <Metric
              icon="bus-outline"
              value={busNumber(data?.bus) || '—'}
              label={isRTL ? 'الباص' : 'Bus'}
            />
            <View style={styles.divider} />
            <Metric
              icon="people-outline"
              value={String(data?.students.length ?? 0)}
              label={isRTL ? 'الطلاب' : 'Students'}
            />
          </View>
        </View>

        <View style={[styles.periodBlock, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={[styles.periodHeader, { flexDirection: direction }]}>
            <View style={styles.periodIcon}>
              <Ionicons
                name={period === 'morning' ? 'sunny' : 'moon'}
                size={20}
                color="#0A2D44"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitleNoMargin, { color: theme.colors.text, textAlign }]}>
                {isRTL ? 'لوحة الفترة' : 'Period Dashboard'}
              </Text>
              <Text style={[styles.periodSub, { color: theme.colors.textSecondary, textAlign }]}>
                {periodLabel(period, isRTL)}
              </Text>
            </View>
          </View>

          <View style={[styles.segment, { flexDirection: direction, backgroundColor: theme.colors.surface2 }]}>
            <Pressable
              onPress={() => setPeriod('morning')}
              style={[styles.segmentButton, period === 'morning' && styles.segmentActive]}
            >
              <Ionicons name="sunny-outline" size={16} color={period === 'morning' ? '#0A2D44' : '#667085'} />
              <Text style={[styles.segmentText, { color: period === 'morning' ? '#0A2D44' : '#667085' }]}>
                {isRTL ? 'صباحية' : 'Morning'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setPeriod('afternoon')}
              style={[styles.segmentButton, period === 'afternoon' && styles.segmentActive]}
            >
              <Ionicons name="moon-outline" size={16} color={period === 'afternoon' ? '#0A2D44' : '#667085'} />
              <Text style={[styles.segmentText, { color: period === 'afternoon' ? '#0A2D44' : '#667085' }]}>
                {isRTL ? 'مسائية' : 'Afternoon'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.progressRow}>
            <View style={[styles.progressTrack, { backgroundColor: theme.colors.surface2 }]}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={[styles.progressText, { color: theme.colors.text }]}>{progress}%</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text, textAlign }]}>
          {isRTL ? 'ملخص اليوم' : 'Today Overview'}
        </Text>

        <View style={[styles.grid, { flexDirection: direction }]}>
          <StatCard
            title={isRTL ? 'صعد للباص' : 'Boarded'}
            value={counts?.boarded ?? 0}
            icon="enter-outline"
          />
          <StatCard
            title={isRTL ? 'وصل المدرسة' : 'Arrived'}
            value={counts?.arrived ?? 0}
            icon="school-outline"
          />
          <StatCard
            title={isRTL ? 'تم التوصيل' : 'Delivered'}
            value={counts?.delivered ?? 0}
            icon="home-outline"
          />
          <StatCard
            title={isRTL ? 'غياب' : 'Absent'}
            value={counts?.absent ?? 0}
            icon="close-circle-outline"
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text, textAlign }]}>
          {isRTL ? 'بيانات الرحلة' : 'Trip Details'}
        </Text>

        <View
          style={[
            styles.infoCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <InfoRow
            icon="map-outline"
            label={isRTL ? 'المسار' : 'Route'}
            value={routeName(data?.route) || '—'}
          />
          <InfoRow
            icon="bus-outline"
            label={isRTL ? 'الباص' : 'Bus'}
            value={busNumber(data?.bus) || '—'}
          />
          <InfoRow
            icon="person-outline"
            label={isRTL ? 'السائق' : 'Driver'}
            value={rowName(data?.mainDriver) || '—'}
          />
          <InfoRow
            icon="time-outline"
            label={isRTL ? 'وقت الصباح' : 'Morning Time'}
            value={String(
              data?.route?.morning_start_time ??
                data?.route?.start_time ??
                '—'
            )}
          />
          <InfoRow
            icon="time-outline"
            label={isRTL ? 'وقت المساء' : 'Afternoon Time'}
            value={String(
              data?.route?.afternoon_start_time ??
                data?.route?.end_time ??
                '—'
            )}
            last
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text, textAlign }]}>
          {isRTL ? 'اختصارات المشرف' : 'Supervisor Shortcuts'}
        </Text>

        <View style={[styles.actions, { flexDirection: direction }]}>
          <Action
            icon="map"
            title={isRTL ? 'الخريطة المباشرة' : 'Live Map'}
            onPress={() => navigation.navigate('TeacherMap')}
          />
          <Action
            icon="people"
            title={isRTL ? 'طلاب المسار' : 'Route Students'}
            onPress={() => navigation.navigate('TeacherStudents')}
          />
          <Action
            icon="notifications"
            title={isRTL ? 'الإشعارات' : 'Notifications'}
            onPress={() => navigation.navigate('TeacherNotifications')}
          />
          <Action
            icon="stats-chart"
            title={isRTL ? 'التقارير' : 'Reports'}
            onPress={() => navigation.navigate('TeacherReport')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  function Metric({
    icon,
    value,
    label,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    value: string;
    label: string;
  }) {
    return (
      <View style={styles.metric}>
        <Ionicons name={icon} size={15} color="#F7B83A" />
        <Text style={styles.metricValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    );
  }

  function StatCard({
    title,
    value,
    icon,
  }: {
    title: string;
    value: number;
    icon: React.ComponentProps<typeof Ionicons>['name'];
  }) {
    return (
      <View
        style={[
          styles.statCard,
          { width: responsiveTeacherCardWidth },
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <View style={styles.statIcon}>
          <Ionicons name={icon} size={20} color="#0A2D44" />
        </View>
        <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
        <Text style={[styles.statTitle, { color: theme.colors.textSecondary, textAlign }]}>
          {title}
        </Text>
      </View>
    );
  }

  function InfoRow({
    icon,
    label,
    value,
    last = false,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    value: string;
    last?: boolean;
  }) {
    return (
      <View
        style={[
          styles.infoRow,
          {
            flexDirection: direction,
            borderBottomColor: theme.colors.border,
            borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <View style={styles.infoIcon}>
          <Ionicons name={icon} size={17} color="#0A2D44" />
        </View>
        <Text style={[styles.infoLabel, { color: theme.colors.textSecondary, textAlign }]}>
          {label}
        </Text>
        <Text style={[styles.infoValue, { color: theme.colors.text, textAlign }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    );
  }

  function Action({
    icon,
    title,
    onPress,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.action,
          { width: responsiveTeacherCardWidth },
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <View style={styles.actionIcon}>
          <Ionicons name={icon} size={20} color="#0A2D44" />
        </View>
        <Text style={[styles.actionText, { color: theme.colors.text }]}>{title}</Text>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 14, paddingBottom: 110 },
  hero: { borderRadius: 30, backgroundColor: '#0A2D44', padding: 16 },
  brandRow: { alignItems: 'center', gap: 10 },
  systemLogoWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  systemLogo: { width: 47, height: 47 },
  schoolLogoWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  schoolLogo: { width: 50, height: 50 },
  eyebrow: { color: '#F7B83A', fontSize: 8, fontWeight: '900', letterSpacing: 1.6 },
  teacherName: { color: '#FFFFFF', marginTop: 4, fontSize: 18, fontWeight: '900' },
  teacherRole: { color: '#B9CAD6', marginTop: 3, fontSize: 8, fontWeight: '700' },
  schoolRow: { marginTop: 14, alignItems: 'center', gap: 10 },
  schoolTextWrap: { flex: 1 },
  schoolName: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  yearText: { color: '#AAC0CF', marginTop: 3, fontSize: 8, fontWeight: '600' },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#183F58',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#0A2D44', fontSize: 7, fontWeight: '900' },
  tripStrip: {
    marginTop: 14,
    minHeight: 78,
    borderRadius: 19,
    backgroundColor: '#163B52',
    alignItems: 'center',
  },
  metric: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  metricValue: { color: '#FFFFFF', marginTop: 3, fontSize: 10.5, fontWeight: '900' },
  metricLabel: { color: '#AAC0CF', marginTop: 2, fontSize: 7, fontWeight: '700' },
  divider: { width: StyleSheet.hairlineWidth, height: 40, backgroundColor: 'rgba(255,255,255,0.17)' },
  periodBlock: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 22,
    padding: 12,
  },
  periodHeader: { alignItems: 'center', gap: 9 },
  periodIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleNoMargin: { fontSize: 13, fontWeight: '900' },
  periodSub: { marginTop: 2, fontSize: 8, fontWeight: '700' },
  segment: { marginTop: 12, minHeight: 45, borderRadius: 14, padding: 3 },
  segmentButton: {
    flex: 1,
    minHeight: 39,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  segmentActive: { backgroundColor: '#F7B83A' },
  segmentText: { fontSize: 8.5, fontWeight: '900' },
  progressRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 7, backgroundColor: '#10A66A', borderRadius: 4 },
  progressText: { fontSize: 8, fontWeight: '900' },
  sectionTitle: { marginTop: 18, marginBottom: 8, fontSize: 14, fontWeight: '900' },
  grid: { flexWrap: 'wrap', gap: 8 },
  statCard: { width: '48.7%', minHeight: 120, borderWidth: 1, borderRadius: 21, padding: 12 },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { marginTop: 9, fontSize: 22, fontWeight: '900' },
  statTitle: { marginTop: 2, fontSize: 9, fontWeight: '700' },
  infoCard: { borderWidth: 1, borderRadius: 21, overflow: 'hidden' },
  infoRow: { minHeight: 55, paddingHorizontal: 11, alignItems: 'center', gap: 8 },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF5D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { width: 95, fontSize: 8, fontWeight: '700' },
  infoValue: { flex: 1, fontSize: 10, fontWeight: '900' },
  actions: { flexWrap: 'wrap', gap: 8 },
  action: {
    width: '48.7%',
    minHeight: 87,
    borderWidth: 1,
    borderRadius: 19,
    padding: 11,
    justifyContent: 'space-between',
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { marginTop: 8, fontSize: 10, fontWeight: '900' },
});
