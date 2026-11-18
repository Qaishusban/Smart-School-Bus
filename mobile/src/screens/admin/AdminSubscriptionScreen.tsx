import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
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
import { supabase } from '../../lib/supabase';

import AdminBrandHeader from '../../components/admin/AdminBrandHeader';

type Row = Record<string, any>;

export default function AdminSubscriptionScreen({
  navigation,
}: any) {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();

  const [school, setSchool] = useState<Row | null>(null);
  const [year, setYear] = useState<Row | null>(null);
  const [subscription, setSubscription] = useState<Row | null>(null);
  const [packageRow, setPackageRow] = useState<Row | null>(null);
  const [stats, setStats] = useState({
    students: 0,
    buses: 0,
    liveBuses: 0,
    drivers: 0,
    routes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!user?.school_id) {
      setLoading(false);
      return;
    }

    refresh ? setRefreshing(true) : setLoading(true);

    try {
      const schoolId = user.school_id;

      const [
        schoolResult,
        studentsResult,
        busesResult,
        driversResult,
        routesResult,
      ] = await Promise.all([
        supabase.from('schools').select('*').eq('id', schoolId).maybeSingle(),
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId),
        supabase
          .from('buses')
          .select('id')
          .eq('school_id', schoolId),
        supabase
          .from('drivers')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('is_active', true),
        supabase
          .from('routes')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('is_active', true),
      ]);

      const schoolRow = (schoolResult.data ?? null) as Row | null;
      setSchool(schoolRow);

      let currentYear: Row | null = null;

      if (schoolRow?.current_academic_year_id) {
        const { data } = await supabase
          .from('academic_years')
          .select('*')
          .eq('id', schoolRow.current_academic_year_id)
          .maybeSingle();

        currentYear = (data ?? null) as Row | null;
      }

      setYear(currentYear);

      const subscriptionResult = await supabase
        .from('school_subscriptions')
        .select('*')
        .eq('school_id', schoolId)
        .order('starts_at', { ascending: false })
        .limit(1);

      if (!subscriptionResult.error) {
        const subscriptionRow = (subscriptionResult.data ?? [])[0] ?? null;
        setSubscription(subscriptionRow);

        if (subscriptionRow?.package_id) {
          const packageResult = await supabase
            .from('system_packages')
            .select('*')
            .eq('id', subscriptionRow.package_id)
            .limit(1);
          setPackageRow(packageResult.error ? null : ((packageResult.data ?? [])[0] ?? null));
        } else {
          setPackageRow(null);
        }
      } else {
        setSubscription(null);
        setPackageRow(null);
      }

      const busIds = (busesResult.data ?? [])
        .map((row: any) => row.id)
        .filter(Boolean);

      let liveBuses = 0;

      if (busIds.length) {
        const { data } = await supabase
          .from('bus_live_locations')
          .select('bus_id')
          .in('bus_id', busIds);

        liveBuses = new Set(
          (data ?? []).map((row: any) => String(row.bus_id))
        ).size;
      }

      setStats({
        students: studentsResult.count ?? 0,
        buses: busIds.length,
        liveBuses,
        drivers: driversResult.count ?? 0,
        routes: routesResult.count ?? 0,
      });
    } catch (error) {
      console.log('Admin system status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.school_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxStudents = Number(school?.max_students ?? 0);

  const utilization = useMemo(() => {
    if (!maxStudents || maxStudents <= 0) return 0;
    return Math.min(
      100,
      Math.round((stats.students / maxStudents) * 100)
    );
  }, [maxStudents, stats.students]);

  if (loading) {
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" color="#F7B83A" />
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
        title={isRTL ? 'الاشتراك وحالة النظام' : 'Subscription & System Status'}
        subtitle={
          isRTL
            ? 'الباقة، تواريخ الاشتراك وبيانات تشغيل المدرسة'
            : 'Package, subscription dates and operational school data'
        }
        schoolName={String(school?.name ?? (isRTL ? 'المدرسة' : 'School'))}
        schoolLogoUrl={school?.logo_url ?? null}
        onBack={() => navigation.goBack()}
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
            styles.subscriptionCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={[styles.subscriptionTop, { flexDirection: direction }]}>
            <View style={styles.packageIcon}>
              <Ionicons name="diamond-outline" size={21} color="#0A2D44" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.packageName, { color: theme.colors.text, textAlign }]}>
                {subscription
                  ? String((isRTL ? packageRow?.name_ar : packageRow?.name_en) ?? packageRow?.code ?? (isRTL ? 'باقة المدرسة' : 'School Package'))
                  : isRTL ? 'لا يوجد اشتراك مسجل بعد' : 'No subscription configured yet'}
              </Text>
              <Text style={[styles.packageStatus, { color: theme.colors.textSecondary, textAlign }]}>
                {subscription
                  ? `${String(subscription.status ?? '—')} • ${String(subscription.starts_at ?? '—')} → ${String(subscription.ends_at ?? '—')}`
                  : isRTL ? 'سيتم ربط هذه الشاشة مع ويب إدارة النظام.' : 'This page is ready for the system-management web portal.'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark" size={31} color="#0A2D44" />
          </View>

          <Text style={styles.heroTitle}>
            {school?.is_active === false
              ? isRTL
                ? 'المدرسة غير فعالة'
                : 'School Inactive'
              : isRTL
              ? 'المدرسة تعمل'
              : 'School Operational'}
          </Text>

          <Text style={styles.heroSub}>
            {isRTL
              ? 'هذه الشاشة تعرض معلومات تشغيلية حقيقية من النظام، بدون أي حالة اشتراك افتراضية.'
              : 'This page shows actual operational information, without invented subscription states.'}
          </Text>
        </View>

        <View
          style={[
            styles.grid,
            { flexDirection: direction },
          ]}
        >
          <Stat icon="people" value={stats.students} label={isRTL ? 'طلاب' : 'Students'} />
          <Stat icon="bus" value={stats.liveBuses} label={isRTL ? 'باص مباشر' : 'Live Buses'} />
          <Stat icon="car" value={stats.drivers} label={isRTL ? 'سائق فعال' : 'Active Drivers'} />
          <Stat icon="git-branch" value={stats.routes} label={isRTL ? 'مسار فعال' : 'Active Routes'} />
        </View>

        <Text
          style={[
            styles.sectionTitle,
            { color: theme.colors.text, textAlign },
          ]}
        >
          {isRTL ? 'الاستخدام والسعة' : 'Usage & Capacity'}
        </Text>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.capacityTop,
              { flexDirection: direction },
            ]}
          >
            <View>
              <Text
                style={[
                  styles.capacityValue,
                  { color: theme.colors.text },
                ]}
              >
                {stats.students} / {maxStudents || '—'}
              </Text>

              <Text
                style={[
                  styles.capacityLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {isRTL
                  ? 'طلاب مسجلون من الحد الأعلى'
                  : 'Registered students vs maximum'}
              </Text>
            </View>

            <View style={styles.percentBadge}>
              <Text style={styles.percentText}>{utilization}%</Text>
            </View>
          </View>

          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${utilization}%` },
              ]}
            />
          </View>
        </View>

        <Text
          style={[
            styles.sectionTitle,
            { color: theme.colors.text, textAlign },
          ]}
        >
          {isRTL ? 'المعلومات الحالية' : 'Current Information'}
        </Text>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Info label={isRTL ? 'المدرسة' : 'School'} value={String(school?.name ?? '—')} />
          <Info label={isRTL ? 'السنة الدراسية' : 'Academic Year'} value={String(year?.name ?? '—')} />
          <Info label={isRTL ? 'بداية السنة' : 'Year Start'} value={String(year?.start_date ?? '—')} />
          <Info label={isRTL ? 'نهاية السنة' : 'Year End'} value={String(year?.end_date ?? '—')} />
          <Info label={isRTL ? 'إجمالي الحافلات' : 'Total Buses'} value={String(stats.buses)} last />
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  function Stat({
    icon,
    value,
    label,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    value: string | number;
    label: string;
  }) {
    return (
      <View
        style={[
          styles.stat,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.statIcon}>
          <Ionicons name={icon} size={22} color="#0A2D44" />
        </View>
        <Text style={[styles.statValue, { color: theme.colors.text }]}>
          {String(value)}
        </Text>
        <Text
          style={[
            styles.statLabel,
            { color: theme.colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      </View>
    );
  }

  function Info({
    label,
    value,
    last = false,
  }: {
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
        <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={[styles.infoValue, { color: theme.colors.text }]}>
          {value}
        </Text>
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
  content: {
    padding: 14,
    paddingBottom: 110,
  },
  subscriptionCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 13,
    marginBottom: 10,
  },
  subscriptionTop: {
    alignItems: 'center',
    gap: 10,
  },
  packageIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageName: {
    fontSize: 11.5,
    fontWeight: '900',
  },
  packageStatus: {
    marginTop: 4,
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '700',
  },
  hero: {
    borderRadius: 27,
    backgroundColor: '#0A2D44',
    padding: 20,
    alignItems: 'center',
  },
  heroIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  heroSub: {
    color: '#B9CAD6',
    marginTop: 5,
    fontSize: 9,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  grid: {
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 14,
  },
  stat: {
    width: '48.5%',
    minHeight: 105,
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
  },
  statIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '900',
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  capacityTop: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  capacityValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  capacityLabel: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '600',
  },
  percentBadge: {
    minWidth: 53,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    color: '#0A2D44',
    fontSize: 11,
    fontWeight: '900',
  },
  track: {
    height: 9,
    borderRadius: 5,
    backgroundColor: '#EAECF0',
    overflow: 'hidden',
    marginBottom: 15,
  },
  fill: {
    height: '100%',
    backgroundColor: '#F7B83A',
    borderRadius: 5,
  },
  infoRow: {
    minHeight: 52,
    alignItems: 'center',
  },
  infoLabel: {
    flex: 1,
    fontSize: 9,
    fontWeight: '600',
  },
  infoValue: {
    maxWidth: '58%',
    fontSize: 10,
    fontWeight: '800',
  },
});
