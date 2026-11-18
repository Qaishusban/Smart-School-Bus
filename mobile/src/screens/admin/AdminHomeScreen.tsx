import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
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

import {
  AdminDashboardData,
  getAdminDashboardPremium,
} from '../../services/adminPremiumService';
import { generateSchoolAlerts, getSchoolAlertSettings } from '../../services/adminAlertService';

const SYSTEM_LOGO = require('../../assets/system-logo.png') as ImageSourcePropType;

type IconName =
  React.ComponentProps<typeof Ionicons>['name'];

function firstName(value?: string | null) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.split(/\s+/)[0] ?? text;
}

function formatTime(value: unknown, isRTL: boolean) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleTimeString(isRTL ? 'ar-JO' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminHomeScreen({
  navigation,
}: any) {
  const responsive = useResponsiveLayout();
  void responsive;

  const { user } = useAuth();
  const { theme } = useAppTheme();
  const {
    isRTL,
    direction,
    textAlign,
  } = useLanguage();

  const [data, setData] =
    useState<AdminDashboardData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const { schoolId } = useResolvedSchoolId(user);

  const load = useCallback(
    async (
      refresh: boolean = false
    ) => {
      if (!schoolId) {
        setLoading(false);
        return;
      }

      refresh
        ? setRefreshing(true)
        : setLoading(true);

      try {
        const result =
          await getAdminDashboardPremium(
            schoolId,
            user?.id ?? null
          );

        setData(result);
      } catch (error) {
        console.log(
          'AdminHome load:',
          error
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [schoolId, user?.id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!schoolId) return;

    void (async () => {
      try {
        const settings = await getSchoolAlertSettings(schoolId);
        if (settings.auto_enabled) {
          await generateSchoolAlerts(schoolId, false);
        }
      } catch (error) {
        console.log('Admin automatic alerts:', error);
      }
    })();
  }, [schoolId]);

  const school =
    data?.school ?? null;

  const schoolName =
    String(
      school?.name ??
        (isRTL
          ? 'المدرسة'
          : 'School')
    );

  const schoolLogo =
    school?.logo_url
      ? String(school.logo_url)
      : null;

  const greeting =
    isRTL
      ? `أهلاً ${firstName(
          user?.full_name
        ) || 'بك'}`
      : `Welcome ${
          firstName(
            user?.full_name
          ) || 'back'
        }`;

  const capacity =
    Number(
      school?.max_students ??
        0
    );

  const studentCount =
    data?.counts.currentYearStudents ??
    data?.counts.students ??
    0;

  const capacityPercent =
    capacity > 0
      ? Math.min(
          100,
          Math.round(
            (studentCount /
              capacity) *
              100
          )
        )
      : 0;

  const liveBusCount =
    data?.liveLocations
      .length ?? 0;

  const [moduleSearch, setModuleSearch] = useState('');

  const modules = useMemo(
    () => [
      {
        key: 'map',
        icon: 'map' as IconName,
        titleAr:
          'الخريطة المباشرة',
        titleEn:
          'Live Fleet Map',
        subtitleAr:
          'الطلاب والباصات حسب الخط',
        subtitleEn:
          'Students & buses by route',
        route:
          'AdminFleetMap',
        featured: true,
      },
      {
        key: 'students',
        icon: 'people' as IconName,
        titleAr: 'الطلاب',
        titleEn: 'Students',
        subtitleAr:
          `${data?.counts.currentYearStudents ?? data?.counts.students ?? 0} طالب • ${data?.currentYear?.name ?? 'السنة الحالية'}`,
        subtitleEn:
          `${data?.counts.currentYearStudents ?? data?.counts.students ?? 0} students • ${data?.currentYear?.name ?? 'Current year'}`,
        route:
          'AdminStudents',
      },
      {
        key: 'parents',
        icon: 'person' as IconName,
        titleAr:
          'أولياء الأمور',
        titleEn: 'Parents',
        subtitleAr:
          `${data?.counts.parents ?? 0} حساب`,
        subtitleEn:
          `${data?.counts.parents ?? 0} accounts`,
        route:
          'AdminParents',
      },
      {
        key: 'drivers',
        icon: 'car' as IconName,
        titleAr: 'السائقون',
        titleEn: 'Drivers',
        subtitleAr:
          `${data?.counts.activeDrivers ?? 0} فعال`,
        subtitleEn:
          `${data?.counts.activeDrivers ?? 0} active`,
        route:
          'AdminDrivers',
      },
      {
        key: 'buses',
        icon: 'bus' as IconName,
        titleAr: 'الحافلات',
        titleEn: 'Buses',
        subtitleAr:
          `${data?.counts.activeBuses ?? 0} فعالة`,
        subtitleEn:
          `${data?.counts.activeBuses ?? 0} active`,
        route:
          'AdminBuses',
      },
      {
        key: 'routes',
        icon: 'git-branch' as IconName,
        titleAr: 'المسارات',
        titleEn: 'Routes',
        subtitleAr:
          `${data?.counts.routes ?? 0} مسار`,
        subtitleEn:
          `${data?.counts.routes ?? 0} routes`,
        route:
          'AdminRoutes',
      },
      {
        key: 'gradesSections',
        icon: 'grid' as IconName,
        titleAr: 'الصفوف والشعب',
        titleEn: 'Grades & Sections',
        subtitleAr: 'Master Data للربط مع نظام المدرسة',
        subtitleEn: 'Master data for School ERP integration',
        route: 'AdminGradesSections',
      },
      {
        key: 'reports',
        icon: 'document-text' as IconName,
        titleAr: 'التقارير',
        titleEn: 'Reports',
        subtitleAr: 'PDF و Excel بفلاتر تشغيلية',
        subtitleEn: 'PDF & Excel with operational filters',
        route: 'AdminReports',
      },
      {
        key: 'import',
        icon: 'cloud-upload' as IconName,
        titleAr: 'استيراد البيانات',
        titleEn: 'Data Import',
        subtitleAr: 'طلاب وأولياء أمور ومعلمون من Excel',
        subtitleEn: 'Students, parents & teachers from Excel',
        route: 'AdminImport',
      },
      {
        key: 'alertsCenter',
        icon: 'notifications-circle' as IconName,
        titleAr: 'مركز التنبيهات',
        titleEn: 'Alert Center',
        subtitleAr: 'أعياد الميلاد والرخص والإرسال اليدوي',
        subtitleEn: 'Birthdays, licenses & manual notifications',
        route: 'AdminAlertsCenter',
      },
      {
        key: 'support',
        icon: 'headset' as IconName,
        titleAr: 'الدعم الفني',
        titleEn: 'Technical Support',
        subtitleAr: 'تذاكر ومحادثة مع إدارة النظام',
        subtitleEn: 'Tickets & system-admin conversation',
        route: 'AdminSupport',
      },
      {
        key: 'qschoolIntegration',
        icon: 'git-compare' as IconName,
        titleAr: 'ربط Q School ERP',
        titleEn: 'Q School ERP Integration',
        subtitleAr: 'تهيئة مزامنة الطلاب والأهالي والصفوف',
        subtitleEn: 'Prepare students, parents and grades sync',
        route: 'AdminIntegrationSettings',
      },
      {
        key: 'teachers',
        icon: 'school' as IconName,
        titleAr:
          'المشرفون',
        titleEn:
          'Supervisors',
        subtitleAr:
          `${data?.counts.teachers ?? 0} مشرف`,
        subtitleEn:
          `${data?.counts.teachers ?? 0} supervisors`,
        route:
          'AdminTeachers',
      },
      {
        key: 'incidents',
        icon: 'warning' as IconName,
        titleAr: 'الحوادث والبلاغات',
        titleEn: 'Incidents',
        subtitleAr:
          `${data?.counts.incidentsToday ?? 0} اليوم`,
        subtitleEn:
          `${data?.counts.incidentsToday ?? 0} today`,
        route:
          'AdminIncidents',
      },
      {
        key: 'attendance',
        icon: 'clipboard' as IconName,
        titleAr: 'الحضور',
        titleEn: 'Attendance',
        subtitleAr:
          'حالات الرحلات',
        subtitleEn:
          'Trip statuses',
        route:
          'AdminAttendance',
      },
      {
        key: 'trips',
        icon: 'navigate' as IconName,
        titleAr: 'الرحلات',
        titleEn: 'Trips',
        subtitleAr:
          'سجل الأحداث',
        subtitleEn:
          'Event history',
        route:
          'AdminTrips',
      },
      {
        key: 'broadcasts',
        icon: 'megaphone' as IconName,
        titleAr: 'الإعلانات',
        titleEn: 'Broadcasts',
        subtitleAr:
          'إرسال للجهة المناسبة',
        subtitleEn:
          'Targeted messaging',
        route:
          'AdminBroadcasts',
      },
      {
        key: 'status',
        icon: 'shield-checkmark' as IconName,
        titleAr: 'حالة النظام',
        titleEn: 'System Status',
        subtitleAr:
          'السعة وجاهزية التشغيل',
        subtitleEn:
          'Capacity & readiness',
        route:
          'AdminSubscription',
      },
      {
        key: 'years',
        icon: 'calendar' as IconName,
        titleAr:
          'السنوات الدراسية',
        titleEn:
          'Academic Years',
        subtitleAr:
          String(
            data?.currentYear
              ?.name ?? '—'
          ),
        subtitleEn:
          String(
            data?.currentYear
              ?.name ?? '—'
          ),
        route:
          'AdminAcademicYears',
      },
    ],
    [data]
  );

  const filteredModules = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter((m) => `${m.titleAr} ${m.titleEn} ${m.subtitleAr} ${m.subtitleEn}`.toLowerCase().includes(q));
  }, [modules, moduleSearch]);

  if (loading) {
    return (
      <View
        style={[
          styles.loading,
          {
            backgroundColor:
              theme.colors
                .background,
          },
        ]}
      >
        <View
          style={
            styles.loadingLogo
          }
        >
          <Image
            source={SYSTEM_LOGO}
            style={
              styles.loadingLogoImage
            }
          />
        </View>

        <ActivityIndicator
          color="#F7B83A"
          size="large"
        />

        <Text
          style={[
            styles.loadingText,
            {
              color:
                theme.colors
                  .textSecondary,
            },
          ]}
        >
          {isRTL
            ? 'جاري تجهيز لوحة المدرسة...'
            : 'Preparing school dashboard...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.safe,
        {
          backgroundColor:
            theme.colors
              .background,
        },
      ]}
    >
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            tintColor="#F7B83A"
            onRefresh={() =>
              void load(true)
            }
          />
        }
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={[
          styles.content,
          {
            width: '100%',
            maxWidth: responsive.contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: responsive.horizontalPadding,
          },
        ]}
      >
        {/* Premium dual-brand hero */}
        <View
          style={
            styles.hero
          }
        >
          <View
            style={[
              styles.heroTop,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <View
              style={
                styles.systemLogoBox
              }
            >
              <Image
                source={
                  SYSTEM_LOGO
                }
                style={
                  styles.systemLogo
                }
                resizeMode="contain"
              />
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <Text
                style={[
                  styles.eyebrow,
                  {
                    textAlign,
                  },
                ]}
              >
                SMART SCHOOL BUS
              </Text>

              <Text
                numberOfLines={
                  1
                }
                style={[
                  styles.greeting,
                  {
                    textAlign,
                  },
                ]}
              >
                {greeting}
              </Text>

              <View
                style={[
                  styles.adminRoleRow,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={13}
                  color="#F7B83A"
                />

                <Text
                  style={
                    styles.adminRole
                  }
                >
                  {isRTL
                    ? 'إدارة المدرسة'
                    : 'School Administration'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() =>
                navigation.navigate(
                  'AdminNotifications'
                )
              }
              style={
                styles.notificationButton
              }
            >
              <Ionicons
                name="notifications-outline"
                size={21}
                color="#FFFFFF"
              />

              {(data?.counts
                .unreadNotifications ??
                0) > 0 && (
                <View
                  style={
                    styles.notificationBadge
                  }
                >
                  <Text
                    style={
                      styles.notificationBadgeText
                    }
                  >
                    {(data?.counts
                      .unreadNotifications ??
                      0) > 99
                      ? '99+'
                      : data
                          ?.counts
                          .unreadNotifications}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          <View
            style={[
              styles.schoolHero,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <View
              style={
                styles.schoolLogoBox
              }
            >
              {schoolLogo ? (
                <Image
                  source={{
                    uri: schoolLogo,
                  }}
                  style={
                    styles.schoolLogo
                  }
                  resizeMode="contain"
                />
              ) : (
                <Ionicons
                  name="school"
                  size={27}
                  color="#0A2D44"
                />
              )}
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <Text
                numberOfLines={
                  1
                }
                style={[
                  styles.schoolName,
                  {
                    textAlign,
                  },
                ]}
              >
                {schoolName}
              </Text>

              <Text
                numberOfLines={
                  1
                }
                style={[
                  styles.schoolYear,
                  {
                    textAlign,
                  },
                ]}
              >
                {isRTL
                  ? `السنة الدراسية: ${
                      data?.currentYear
                        ?.name ??
                      'غير محددة'
                    }`
                  : `Academic year: ${
                      data?.currentYear
                        ?.name ??
                      'Not set'
                    }`}
              </Text>
            </View>

            <View
              style={
                styles.liveBadge
              }
            >
              <View
                style={
                  styles.liveDot
                }
              />
              <Text
                style={
                  styles.liveText
                }
              >
                {isRTL
                  ? 'مباشر'
                  : 'LIVE'}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.heroStats,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <HeroStat
              icon="bus"
              label={
                isRTL
                  ? 'باص مباشر'
                  : 'Live Buses'
              }
              value={
                liveBusCount
              }
            />

            <View
              style={
                styles.heroDivider
              }
            />

            <HeroStat
              icon="warning-outline"
              label={
                isRTL
                  ? 'بلاغات اليوم'
                  : 'Today Incidents'
              }
              value={
                data?.counts
                  .incidentsToday ??
                0
              }
            />

            <View
              style={
                styles.heroDivider
              }
            />

            <HeroStat
              icon="people-outline"
              label={
                isRTL
                  ? 'الطلاب'
                  : 'Students'
              }
              value={
                studentCount
              }
            />
          </View>
        </View>

        {/* KPI area */}
        <SectionTitle
          icon="pulse"
          title={
            isRTL
              ? 'نبض التشغيل'
              : 'Operations Pulse'
          }
          subtitle={
            isRTL
              ? 'ملخص حي لوضع النقل المدرسي'
              : 'Live summary of school transport'
          }
        />

        <View
          style={[
            styles.kpiGrid,
            {
              flexDirection:
                direction,
            },
          ]}
        >
          <KpiCard
            icon="bus"
            value={
              data?.counts
                .activeBuses ?? 0
            }
            label={
              isRTL
                ? 'حافلات فعالة'
                : 'Active Buses'
            }
            hint={
              isRTL
                ? `${liveBusCount} تبث موقعها الآن`
                : `${liveBusCount} currently live`
            }
          />

          <KpiCard
            icon="car"
            value={
              data?.counts
                .activeDrivers ??
              0
            }
            label={
              isRTL
                ? 'سائقون فعالون'
                : 'Active Drivers'
            }
            hint={
              isRTL
                ? 'جاهزية فريق النقل'
                : 'Transport team readiness'
            }
          />

          <KpiCard
            icon="git-branch"
            value={
              data?.counts
                .routes ?? 0
            }
            label={
              isRTL
                ? 'المسارات'
                : 'Routes'
            }
            hint={
              isRTL
                ? 'المسارات المسجلة'
                : 'Configured routes'
            }
          />

          <KpiCard
            icon="school"
            value={
              data?.counts
                .teachers ?? 0
            }
            label={
              isRTL
                ? 'المشرفون'
                : 'Supervisors'
            }
            hint={
              isRTL
                ? 'مشرفو النقل'
                : 'Transport supervisors'
            }
          />
        </View>

        {/* Featured map launcher */}
        <Pressable
          onPress={() =>
            navigation.navigate(
              'AdminFleetMap'
            )
          }
          style={({
            pressed,
          }) => [
            styles.mapHero,
            {
              opacity: pressed
                ? 0.86
                : 1,
            },
          ]}
        >
          <View
            style={[
              styles.mapHeroTop,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <View
              style={
                styles.mapHeroIcon
              }
            >
              <Ionicons
                name="map"
                size={26}
                color="#0A2D44"
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={[
                  styles.mapHeroTitle,
                  {
                    textAlign,
                  },
                ]}
              >
                {isRTL
                  ? 'مركز التتبع المباشر'
                  : 'Live Tracking Center'}
              </Text>

              <Text
                style={[
                  styles.mapHeroSub,
                  {
                    textAlign,
                  },
                ]}
              >
                {isRTL
                  ? 'شاهد كل مواقع الطلاب والباصات أو فلتر حسب المسار.'
                  : 'See all student and bus locations or filter by route.'}
              </Text>
            </View>

            <View
              style={
                styles.mapHeroArrow
              }
            >
              <Ionicons
                name={
                  isRTL
                    ? 'arrow-back'
                    : 'arrow-forward'
                }
                size={20}
                color="#FFFFFF"
              />
            </View>
          </View>

          <View
            style={[
              styles.mapHeroStats,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <MapMiniStat
              icon="location"
              value={
                liveBusCount
              }
              label={
                isRTL
                  ? 'مواقع حية'
                  : 'Live locations'
              }
            />

            <MapMiniStat
              icon="people"
              value={
                studentCount
              }
              label={
                isRTL
                  ? 'طالب'
                  : 'Students'
              }
            />

            <MapMiniStat
              icon="git-branch"
              value={
                data?.counts
                  .routes ?? 0
              }
              label={
                isRTL
                  ? 'مسار'
                  : 'Routes'
              }
            />
          </View>
        </Pressable>

        {/* Capacity */}
        <SectionTitle
          icon="speedometer-outline"
          title={
            isRTL
              ? 'سعة المدرسة'
              : 'School Capacity'
          }
          subtitle={
            isRTL
              ? `عدد الطلاب المسجلين في ${data?.currentYear?.name ?? 'السنة الحالية'} مقابل الحد`
              : `Registered students in ${data?.currentYear?.name ?? 'current year'} against the configured maximum`
          }
        />

        <View
          style={[
            styles.capacityCard,
            {
              backgroundColor:
                theme.colors
                  .surface,
              borderColor:
                theme.colors
                  .border,
            },
          ]}
        >
          <View
            style={[
              styles.capacityTop,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <View>
              <Text
                style={[
                  styles.capacityNumber,
                  {
                    color:
                      theme.colors
                        .text,
                  },
                ]}
              >
                {studentCount}
                <Text
                  style={[
                    styles.capacityMax,
                    {
                      color:
                        theme.colors
                          .textSecondary,
                    },
                  ]}
                >
                  {' '}
                  /{' '}
                  {capacity || '—'}
                </Text>
              </Text>

              <Text
                style={[
                  styles.capacityLabel,
                  {
                    color:
                      theme.colors
                        .textSecondary,
                  },
                ]}
              >
                {isRTL
                  ? 'طالب مسجل'
                  : 'Registered students'}
              </Text>
            </View>

            <View
              style={
                styles.capacityPercent
              }
            >
              <Text
                style={
                  styles.capacityPercentText
                }
              >
                {capacityPercent}%
              </Text>
            </View>
          </View>

          <View
            style={
              styles.capacityTrack
            }
          >
            <View
              style={[
                styles.capacityFill,
                {
                  width:
                    `${capacityPercent}%`,
                },
              ]}
            />
          </View>

          {!!data?.yearEnrollment?.length && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.yearEnrollmentRow, { flexDirection: direction }]}
            >
              {data.yearEnrollment.map((year) => (
                <View
                  key={year.id}
                  style={[
                    styles.yearEnrollmentChip,
                    {
                      backgroundColor: year.is_current ? '#FFF4D8' : theme.colors.surface2,
                      borderColor: year.is_current ? '#F7B83A' : theme.colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.yearEnrollmentName, { color: theme.colors.text }]}>
                    {year.name}
                  </Text>
                  <Text style={styles.yearEnrollmentCount}>
                    {year.count} {isRTL ? 'طالب' : 'students'}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Modules */}
        <SectionTitle
          icon="grid-outline"
          title={
            isRTL
              ? 'إدارة المدرسة'
              : 'School Management'
          }
          subtitle={
            isRTL
              ? 'كل أدوات الإدارة في مكان واحد'
              : 'All management tools in one place'
          }
        />

        <View style={[styles.moduleSearchBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}>
          <Ionicons name="search-outline" size={19} color="#8191A0" />
          <TextInput value={moduleSearch} onChangeText={setModuleSearch} placeholder={isRTL ? 'ابحث عن شاشة أو وظيفة...' : 'Search screens or functions...'} placeholderTextColor="#8191A0" style={[styles.moduleSearchInput, { color: theme.colors.text, textAlign }]} />
          {!!moduleSearch && <Pressable onPress={() => setModuleSearch('')}><Ionicons name="close-circle" size={19} color="#8191A0" /></Pressable>}
        </View>

        <View
          style={[
            styles.moduleGrid,
            {
              flexDirection:
                direction,
            },
          ]}
        >
          {filteredModules.map(
            (module) => (
              <Pressable
                key={
                  module.key
                }
                onPress={() =>
                  navigation.navigate(
                    module.route
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.moduleCard,
                  module.featured &&
                    styles.moduleCardFeatured,
                  {
                    backgroundColor:
                      module.featured
                        ? '#0A2D44'
                        : theme
                            .colors
                            .surface,
                    borderColor:
                      module.featured
                        ? '#0A2D44'
                        : theme
                            .colors
                            .border,
                    opacity:
                      pressed
                        ? 0.77
                        : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.moduleIcon,
                    {
                      backgroundColor:
                        module.featured
                          ? '#F7B83A'
                          : 'rgba(247,184,58,0.14)',
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      module.icon
                    }
                    size={22}
                    color={
                      module.featured
                        ? '#0A2D44'
                        : '#F7B83A'
                    }
                  />
                </View>

                <Text
                  style={[
                    styles.moduleTitle,
                    {
                      color:
                        module.featured
                          ? '#FFFFFF'
                          : theme
                              .colors
                              .text,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? module.titleAr
                    : module.titleEn}
                </Text>

                <Text
                  numberOfLines={
                    2
                  }
                  style={[
                    styles.moduleSub,
                    {
                      color:
                        module.featured
                          ? '#AFC2D0'
                          : theme
                              .colors
                              .textSecondary,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? module.subtitleAr
                    : module.subtitleEn}
                </Text>
              </Pressable>
            )
          )}
        </View>

        {/* Recent events */}
        <SectionTitle
          icon="time-outline"
          title={
            isRTL
              ? 'آخر الحركة'
              : 'Latest Activity'
          }
          subtitle={
            isRTL
              ? 'آخر الرحلات والبلاغات المسجلة'
              : 'Recent trip events and incidents'
          }
        />

        <View
          style={[
            styles.activityCard,
            {
              backgroundColor:
                theme.colors
                  .surface,
              borderColor:
                theme.colors
                  .border,
            },
          ]}
        >
          {(data?.recentTrips ??
            [])
            .slice(0, 3)
            .map((trip) => (
              <ActivityRow
                key={`trip-${trip.id}`}
                icon="navigate-outline"
                title={
                  String(
                    trip.title ??
                      trip.type ??
                      (isRTL
                        ? 'حدث رحلة'
                        : 'Trip event')
                  )
                }
                subtitle={
                  String(
                    trip.body ??
                      trip.type ??
                      ''
                  )
                }
                time={formatTime(
                  trip.created_at,
                  isRTL
                )}
              />
            ))}

          {(data?.recentIncidents ??
            [])
            .slice(0, 2)
            .map((incident) => (
              <ActivityRow
                key={`incident-${incident.id}`}
                icon="warning-outline"
                title={
                  String(
                    incident.title ??
                      (isRTL
                        ? 'بلاغ'
                        : 'Incident')
                  )
                }
                subtitle={
                  String(
                    incident.severity ??
                      ''
                  )
                }
                time={formatTime(
                  incident.happened_at,
                  isRTL
                )}
                danger
              />
            ))}

          {!data?.recentTrips
            .length &&
            !data?.recentIncidents
              .length && (
              <View
                style={
                  styles.noActivity
                }
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={26}
                  color="#20A06A"
                />
                <Text
                  style={[
                    styles.noActivityText,
                    {
                      color:
                        theme.colors
                          .textSecondary,
                    },
                  ]}
                >
                  {isRTL
                    ? 'لا توجد حركة حديثة لعرضها.'
                    : 'No recent activity to display.'}
                </Text>
              </View>
            )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  function HeroStat({
    icon,
    label,
    value,
  }: {
    icon: IconName;
    label: string;
    value: number;
  }) {
    return (
      <View
        style={
          styles.heroStat
        }
      >
        <View
          style={[
            styles.heroStatLabelRow,
            {
              flexDirection:
                direction,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={13}
            color="#AFC2D0"
          />

          <Text
            style={
              styles.heroStatLabel
            }
          >
            {label}
          </Text>
        </View>

        <Text
          style={
            styles.heroStatValue
          }
        >
          {value}
        </Text>
      </View>
    );
  }

  function SectionTitle({
    icon,
    title,
    subtitle,
  }: {
    icon: IconName;
    title: string;
    subtitle: string;
  }) {
    return (
      <View
        style={[
          styles.sectionHeader,
          {
            flexDirection:
              direction,
          },
        ]}
      >
        <View
          style={
            styles.sectionIcon
          }
        >
          <Ionicons
            name={icon}
            size={19}
            color="#F7B83A"
          />
        </View>

        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color:
                  theme.colors
                    .text,
                textAlign,
              },
            ]}
          >
            {title}
          </Text>

          <Text
            style={[
              styles.sectionSub,
              {
                color:
                  theme.colors
                    .textSecondary,
                textAlign,
              },
            ]}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    );
  }

  function KpiCard({
    icon,
    value,
    label,
    hint,
  }: {
    icon: IconName;
    value: number;
    label: string;
    hint: string;
  }) {
    return (
      <View
        style={[
          styles.kpiCard,
          {
            backgroundColor:
              theme.colors
                .surface,
            borderColor:
              theme.colors
                .border,
          },
        ]}
      >
        <View
          style={
            styles.kpiIcon
          }
        >
          <Ionicons
            name={icon}
            size={21}
            color="#0A2D44"
          />
        </View>

        <Text
          style={[
            styles.kpiValue,
            {
              color:
                theme.colors
                  .text,
            },
          ]}
        >
          {value}
        </Text>

        <Text
          style={[
            styles.kpiLabel,
            {
              color:
                theme.colors
                  .text,
              textAlign,
            },
          ]}
        >
          {label}
        </Text>

        <Text
          style={[
            styles.kpiHint,
            {
              color:
                theme.colors
                  .textSecondary,
              textAlign,
            },
          ]}
        >
          {hint}
        </Text>
      </View>
    );
  }

  function MapMiniStat({
    icon,
    value,
    label,
  }: {
    icon: IconName;
    value: number;
    label: string;
  }) {
    return (
      <View
        style={
          styles.mapMiniStat
        }
      >
        <Ionicons
          name={icon}
          size={16}
          color="#F7B83A"
        />

        <Text
          style={
            styles.mapMiniValue
          }
        >
          {value}
        </Text>

        <Text
          style={
            styles.mapMiniLabel
          }
        >
          {label}
        </Text>
      </View>
    );
  }

  function ActivityRow({
    icon,
    title,
    subtitle,
    time,
    danger = false,
  }: {
    icon: IconName;
    title: string;
    subtitle: string;
    time: string;
    danger?: boolean;
  }) {
    return (
      <View
        style={[
          styles.activityRow,
          {
            flexDirection:
              direction,
            borderBottomColor:
              theme.colors
                .border,
          },
        ]}
      >
        <View
          style={[
            styles.activityIcon,
            {
              backgroundColor:
                danger
                  ? 'rgba(217,74,74,0.09)'
                  : 'rgba(247,184,58,0.13)',
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={18}
            color={
              danger
                ? '#D94A4A'
                : '#F7B83A'
            }
          />
        </View>

        <View
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          <Text
            numberOfLines={
              1
            }
            style={[
              styles.activityTitle,
              {
                color:
                  theme.colors
                    .text,
                textAlign,
              },
            ]}
          >
            {title}
          </Text>

          <Text
            numberOfLines={
              1
            }
            style={[
              styles.activitySub,
              {
                color:
                  theme.colors
                    .textSecondary,
                textAlign,
              },
            ]}
          >
            {subtitle || '—'}
          </Text>
        </View>

        <Text
          style={[
            styles.activityTime,
            {
              color:
                theme.colors
                  .textSecondary,
            },
          ]}
        >
          {time}
        </Text>
      </View>
    );
  }
}

const styles =
  StyleSheet.create({
    safe: {
      flex: 1,
    },

    content: {
      paddingHorizontal: 14,
      paddingTop: 7,
      paddingBottom: 115,
    },

    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    loadingLogo: {
      width: 80,
      height: 80,
      borderRadius: 26,
      backgroundColor:
        '#0A2D44',
      alignItems: 'center',
      justifyContent:
        'center',
      marginBottom: 16,
    },

    loadingLogoImage: {
      width: 72,
      height: 72,
    },

    loadingText: {
      marginTop: 10,
      fontSize: 11,
      fontWeight: '700',
    },

    hero: {
      borderRadius: 30,
      padding: 16,
      backgroundColor:
        '#0A2D44',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 7,
      },
      shadowOpacity: 0.14,
      shadowRadius: 18,
      elevation: 8,
    },

    heroTop: {
      alignItems: 'center',
      gap: 10,
    },

    systemLogoBox: {
      width: 57,
      height: 57,
      borderRadius: 19,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent:
        'center',
      overflow: 'hidden',
    },

    systemLogo: {
      width: 52,
      height: 52,
    },

    eyebrow: {
      color: '#F7B83A',
      fontSize: 7.5,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    greeting: {
      color: '#FFFFFF',
      marginTop: 3,
      fontSize: 21,
      fontWeight: '900',
    },

    adminRoleRow: {
      marginTop: 5,
      alignItems: 'center',
      gap: 5,
    },

    adminRole: {
      color: '#AFC2D0',
      fontSize: 8.5,
      fontWeight: '700',
    },

    notificationButton: {
      width: 44,
      height: 44,
      borderRadius: 15,
      backgroundColor:
        'rgba(255,255,255,0.07)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    notificationBadge: {
      position: 'absolute',
      top: -5,
      right: -5,
      minWidth: 19,
      height: 19,
      borderRadius: 10,
      paddingHorizontal: 4,
      backgroundColor:
        '#F7B83A',
      borderWidth: 2,
      borderColor:
        '#0A2D44',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    notificationBadgeText: {
      color: '#0A2D44',
      fontSize: 6.5,
      fontWeight: '900',
    },

    schoolHero: {
      marginTop: 16,
      minHeight: 67,
      borderRadius: 20,
      backgroundColor:
        'rgba(255,255,255,0.07)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.10)',
      paddingHorizontal: 10,
      alignItems: 'center',
      gap: 10,
    },

    schoolLogoBox: {
      width: 47,
      height: 47,
      borderRadius: 15,
      backgroundColor:
        '#FFFFFF',
      alignItems: 'center',
      justifyContent:
        'center',
      overflow: 'hidden',
    },

    schoolLogo: {
      width: 41,
      height: 41,
    },

    schoolName: {
      color: '#FFFFFF',
      fontSize: 12.5,
      fontWeight: '900',
    },

    schoolYear: {
      marginTop: 4,
      color: '#B7C8D4',
      fontSize: 7.8,
      fontWeight: '700',
    },

    liveBadge: {
      minHeight: 29,
      borderRadius: 10,
      backgroundColor:
        'rgba(32,160,106,0.14)',
      borderWidth: 1,
      borderColor:
        'rgba(32,160,106,0.35)',
      paddingHorizontal: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },

    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor:
        '#42D392',
    },

    liveText: {
      color: '#8EE9BD',
      fontSize: 7,
      fontWeight: '900',
    },

    heroStats: {
      minHeight: 65,
      marginTop: 13,
      borderRadius: 18,
      backgroundColor:
        'rgba(255,255,255,0.055)',
      alignItems: 'center',
    },

    heroStat: {
      flex: 1,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    heroStatLabelRow: {
      alignItems: 'center',
      gap: 4,
    },

    heroStatLabel: {
      color: '#AFC2D0',
      fontSize: 7,
      fontWeight: '700',
    },

    heroStatValue: {
      marginTop: 5,
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },

    heroDivider: {
      width:
        StyleSheet.hairlineWidth,
      height: 33,
      backgroundColor:
        'rgba(255,255,255,0.14)',
    },

    sectionHeader: {
      marginTop: 22,
      marginBottom: 9,
      alignItems: 'center',
      gap: 9,
    },

    sectionIcon: {
      width: 39,
      height: 39,
      borderRadius: 13,
      backgroundColor:
        'rgba(247,184,58,0.13)',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    sectionTitle: {
      fontSize: 14,
      fontWeight: '900',
    },

    sectionSub: {
      marginTop: 2,
      fontSize: 8,
      fontWeight: '600',
    },

    kpiGrid: {
      flexWrap: 'wrap',
      gap: 8,
    },

    kpiCard: {
      width: '48.8%',
      minHeight: 137,
      borderRadius: 22,
      borderWidth: 1,
      padding: 12,
    },

    kpiIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        '#F7B83A',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    kpiValue: {
      marginTop: 9,
      fontSize: 22,
      fontWeight: '900',
    },

    kpiLabel: {
      marginTop: 2,
      fontSize: 9,
      fontWeight: '900',
    },

    kpiHint: {
      marginTop: 4,
      fontSize: 7.2,
      lineHeight: 11,
      fontWeight: '600',
    },

    mapHero: {
      marginTop: 18,
      borderRadius: 26,
      padding: 15,
      backgroundColor:
        '#0A2D44',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 5,
      },
      shadowOpacity: 0.11,
      shadowRadius: 13,
      elevation: 5,
    },

    mapHeroTop: {
      alignItems: 'center',
      gap: 10,
    },

    mapHeroIcon: {
      width: 52,
      height: 52,
      borderRadius: 17,
      backgroundColor:
        '#F7B83A',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    mapHeroTitle: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900',
    },

    mapHeroSub: {
      marginTop: 4,
      color: '#AFC2D0',
      fontSize: 8,
      lineHeight: 13,
      fontWeight: '600',
    },

    mapHeroArrow: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor:
        'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    mapHeroStats: {
      marginTop: 13,
      minHeight: 60,
      borderRadius: 17,
      backgroundColor:
        'rgba(255,255,255,0.055)',
      alignItems: 'center',
    },

    mapMiniStat: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    mapMiniValue: {
      marginTop: 3,
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },

    mapMiniLabel: {
      marginTop: 2,
      color: '#AFC2D0',
      fontSize: 6.8,
      fontWeight: '700',
    },

    capacityCard: {
      borderWidth: 1,
      borderRadius: 22,
      padding: 13,
    },

    capacityTop: {
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    capacityNumber: {
      fontSize: 20,
      fontWeight: '900',
    },

    capacityMax: {
      fontSize: 12,
      fontWeight: '700',
    },

    capacityLabel: {
      marginTop: 3,
      fontSize: 8,
      fontWeight: '700',
    },

    capacityPercent: {
      minWidth: 54,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        '#F7B83A',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    capacityPercentText: {
      color: '#0A2D44',
      fontSize: 12,
      fontWeight: '900',
    },

    capacityTrack: {
      height: 9,
      marginTop: 13,
      borderRadius: 5,
      backgroundColor:
        '#E7EDF1',
      overflow: 'hidden',
    },

    yearEnrollmentRow: {
      paddingTop: 12,
      gap: 7,
    },

    yearEnrollmentChip: {
      minWidth: 112,
      borderWidth: 1,
      borderRadius: 13,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },

    yearEnrollmentName: {
      fontSize: 8.5,
      fontWeight: '900',
    },

    yearEnrollmentCount: {
      marginTop: 3,
      color: '#20A06A',
      fontSize: 7.5,
      fontWeight: '900',
    },

    capacityFill: {
      height: '100%',
      borderRadius: 5,
      backgroundColor:
        '#F7B83A',
    },

    moduleGrid: {
      flexWrap: 'wrap',
      gap: 8,
    },

    moduleCard: {
      width: '48.8%',
      minHeight: 130,
      borderWidth: 1,
      borderRadius: 22,
      padding: 12,
    },

    moduleCardFeatured: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.09,
      shadowRadius: 10,
      elevation: 3,
    },

    moduleIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    moduleTitle: {
      marginTop: 10,
      fontSize: 10.5,
      fontWeight: '900',
    },

    moduleSub: {
      marginTop: 4,
      fontSize: 7.5,
      lineHeight: 11.5,
      fontWeight: '600',
    },

    activityCard: {
      borderWidth: 1,
      borderRadius: 22,
      paddingHorizontal: 12,
      overflow: 'hidden',
    },

    activityRow: {
      minHeight: 69,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      alignItems: 'center',
      gap: 9,
    },

    activityIcon: {
      width: 39,
      height: 39,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    activityTitle: {
      fontSize: 9.5,
      fontWeight: '900',
    },

    activitySub: {
      marginTop: 3,
      fontSize: 7.5,
      fontWeight: '600',
    },

    activityTime: {
      fontSize: 7,
      fontWeight: '700',
    },

    noActivity: {
      minHeight: 110,
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal: 20,
    },

    noActivityText: {
      marginTop: 7,
      fontSize: 8.5,
      fontWeight: '700',
      textAlign: 'center',
    },

    moduleSearchBox: { height: 54, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', gap: 9, marginBottom: 12 }, moduleSearchInput: { flex: 1, fontSize: 11, fontWeight: '700' },
});
