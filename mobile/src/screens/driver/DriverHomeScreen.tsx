import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useAuth,
} from '../../hooks/useAuth';

import {
  useAppTheme,
} from '../../theme/ThemeContext';

import {
  useLanguage,
} from '../../i18n/LanguageContext';

import {
  DriverDashboardData,
  getDriverDashboard,
} from '../../services/driverService';

import {
  ApprovedDriverExcuse,
  approvedExcuseLabel,
  approvedExcuseMap,
  getApprovedDriverExcuses,
} from '../../services/driverExcuseService';

type IconName =
  React.ComponentProps<typeof Ionicons>['name'];

type TripMode =
  | 'to_school'
  | 'to_home';

type StudentStatus =
  | 'on_route'
  | 'boarded'
  | 'delivered'
  | 'absent'
  | 'arrived'
  | 'unknown';

function firstValue(
  ...values: unknown[]
) {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ''
    ) {
      return String(value);
    }
  }

  return '';
}

function getTripMode(
  date = new Date()
): TripMode {
  return date.getHours() < 12
    ? 'to_school'
    : 'to_home';
}

function studentName(
  student: Record<string, any>,
  isRTL: boolean
) {
  return isRTL
    ? firstValue(
        student.full_name_ar,
        student.full_name,
        student.full_name_en,
        student.name_ar,
        student.name,
        student.name_en,
        'طالب'
      )
    : firstValue(
        student.full_name_en,
        student.full_name,
        student.full_name_ar,
        student.name_en,
        student.name,
        student.name_ar,
        'Student'
      );
}

function normalizeStatus(
  value: unknown
): StudentStatus {
  const status =
    String(value ?? '')
      .trim()
      .toLowerCase();

  if (
    [
      'boarded',
      'picked',
      'pickup',
      'picked_up',
      'on_bus',
    ].includes(status)
  ) {
    return 'boarded';
  }

  if (
    [
      'delivered',
      'dropoff',
      'dropped_off',
      'arrived_home',
    ].includes(status)
  ) {
    return 'delivered';
  }

  if (
    [
      'absent',
      'not_boarded',
      'did_not_ride',
      'no_show',
    ].includes(status)
  ) {
    return 'absent';
  }

  if (
    status === 'arrived'
  ) {
    return 'arrived';
  }

  return status
    ? 'unknown'
    : 'on_route';
}

function formatTime(
  value: unknown
) {
  if (!value) {
    return '--:--';
  }

  const date =
    new Date(String(value));

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '--:--';
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  );
}

function initials(
  name: string
) {
  const parts =
    String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (!parts.length) {
    return 'D';
  }

  if (
    parts.length === 1
  ) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`
    .toUpperCase();
}

export default function DriverHomeScreen({
  navigation,
}: any) {
  const responsive = useResponsiveLayout();
  void responsive;

  const {
    user,
  } = useAuth();

  const {
    theme,
    isDark,
  } = useAppTheme();

  const {
    isRTL,
    direction,
    textAlign,
  } = useLanguage();

  const [
    data,
    setData,
  ] =
    useState<
      DriverDashboardData | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState('');

  const [morningExcuses, setMorningExcuses] = useState<ApprovedDriverExcuse[]>([]);
  const [eveningExcuses, setEveningExcuses] = useState<ApprovedDriverExcuse[]>([]);

  const [
    now,
    setNow,
  ] =
    useState(
      new Date()
    );

  useEffect(() => {
    const timer =
      setInterval(
        () =>
          setNow(
            new Date()
          ),
        60 * 1000
      );

    return () =>
      clearInterval(
        timer
      );
  }, []);

  const load =
    useCallback(
      async (
        refresh = false
      ) => {
        if (!user?.id) {
          setLoading(false);
          return;
        }

        refresh
          ? setRefreshing(true)
          : setLoading(true);

        setErrorMessage('');

        try {
          const result =
            await getDriverDashboard({
              driverId:
                user.id,

              schoolId:
                user.school_id ??
                null,

              busId:
                user.bus_id ??
                null,

              busNumber:
                user.bus_number ??
                null,
            });

          setData(result);

          const studentIds = (result?.students ?? []).map((student: Record<string, any>) => String(student?.id ?? '')).filter(Boolean);
          if (studentIds.length) {
            const [morningRows, eveningRows] = await Promise.all([
              getApprovedDriverExcuses({ studentIds, tripMode: 'to_school' }),
              getApprovedDriverExcuses({ studentIds, tripMode: 'to_home' }),
            ]);
            setMorningExcuses(morningRows);
            setEveningExcuses(eveningRows);
          } else {
            setMorningExcuses([]);
            setEveningExcuses([]);
          }
        } catch (error) {
          console.log(
            'DriverHome load error:',
            error
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : isRTL
              ? 'تعذر تحميل بيانات السائق.'
              : 'Unable to load driver data.'
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        isRTL,
        user?.bus_id,
        user?.bus_number,
        user?.id,
        user?.school_id,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);

  const driver =
    data?.driver;

  const bus =
    data?.bus;

  const route =
    data?.route;

  const school =
    data?.school;

  const teacher =
    data?.teacher;

  const students =
    data?.students ??
    [];

  const tripMode =
    getTripMode(now);

  const driverName =
    isRTL
      ? firstValue(
          driver?.full_name_ar,
          driver?.full_name,
          driver?.full_name_en,
          driver?.name,
          user?.full_name,
          'السائق'
        )
      : firstValue(
          driver?.full_name_en,
          driver?.full_name,
          driver?.full_name_ar,
          driver?.name,
          user?.full_name,
          'Driver'
        );

  const schoolName =
    isRTL
      ? firstValue(
          school?.name_ar,
          school?.name,
          school?.school_name,
          school?.name_en,
          'المدرسة غير محددة'
        )
      : firstValue(
          school?.name_en,
          school?.name,
          school?.school_name,
          school?.name_ar,
          'School not assigned'
        );

  const busNumber =
    firstValue(
      bus?.bus_number,
      user?.bus_number,
      '—'
    );

  const plateNumber =
    firstValue(
      bus?.plate_number,
      bus?.plate_no,
      bus?.license_plate,
      '—'
    );

  const routeName =
    isRTL
      ? firstValue(
          route?.name_ar,
          route?.route_name,
          route?.name,
          route?.name_en,
          'المسار غير محدد'
        )
      : firstValue(
          route?.name_en,
          route?.route_name,
          route?.name,
          route?.name_ar,
          'Route not assigned'
        );

  const teacherName =
    firstValue(
      teacher?.full_name,
      teacher?.name,
      ''
    );

  const latestLocation =
    data?.latestLocation ??
    data?.latestTrackingPoint;

  const locationTime =
    formatTime(
      data?.latestLocation?.updated_at ??
        data?.latestTrackingPoint?.recorded_at
    );

  const live =
    useMemo(
      () => {
        const rawDate =
          data?.latestLocation?.updated_at;

        if (!rawDate) {
          return false;
        }

        const timestamp =
          new Date(
            rawDate
          ).getTime();

        if (
          !Number.isFinite(
            timestamp
          )
        ) {
          return false;
        }

        return (
          Date.now() -
            timestamp <
          2 * 60 * 1000
        );
      },
      [
        data?.latestLocation?.updated_at,
        now,
      ]
    );

  const morningExcuseMap = useMemo(() => approvedExcuseMap(morningExcuses), [morningExcuses]);
  const eveningExcuseMap = useMemo(() => approvedExcuseMap(eveningExcuses), [eveningExcuses]);
  const currentExcuseMap = tripMode === 'to_school' ? morningExcuseMap : eveningExcuseMap;

  const attendanceByPeriod =
    useMemo(
      () => {
        const morning =
          new Map<string, Record<string, any>>();

        const evening =
          new Map<string, Record<string, any>>();

        for (const row of data?.latestAttendance ?? []) {
          if (!row?.student_id) {
            continue;
          }

          const mode =
            String(row?.trip_mode ?? '')
              .trim()
              .toLowerCase();

          const target =
            mode === 'to_home'
              ? evening
              : morning;

          const id =
            String(row.student_id);

          if (!target.has(id)) {
            target.set(id, row);
          }
        }

        return {
          morning,
          evening,
        };
      },
      [data?.latestAttendance]
    );

  const periodCounts =
    useMemo(
      () => {
        const calculate = (
          map: Map<string, Record<string, any>>,
          excuseMap: Map<string, ApprovedDriverExcuse>
        ) => {
          let boarded = 0;
          let delivered = 0;
          let absent = 0;
          let arrived = 0;

          for (const student of students) {
            const attendance =
              map.get(String(student.id));

            const approvedExcuse = excuseMap.get(String(student.id));
            const status = approvedExcuse
              ? 'absent'
              : normalizeStatus(attendance?.status ?? attendance?.event_type);

            if (status === 'boarded') {
              boarded += 1;
            } else if (status === 'delivered') {
              delivered += 1;
            } else if (status === 'absent') {
              absent += 1;
            } else if (status === 'arrived') {
              arrived += 1;
            }
          }

          return {
            boarded,
            delivered,
            absent,
            arrived,
          };
        };

        return {
          morning: calculate(attendanceByPeriod.morning, morningExcuseMap),
          evening: calculate(attendanceByPeriod.evening, eveningExcuseMap),
        };
      },
      [attendanceByPeriod, eveningExcuseMap, morningExcuseMap, students]
    );

  const morningCompleted =
    periodCounts.morning.boarded +
    periodCounts.morning.absent;

  const eveningCompleted =
    periodCounts.evening.delivered +
    periodCounts.evening.absent;

  const morningProgress =
    students.length
      ? Math.min(
          100,
          Math.round(
            (morningCompleted / students.length) * 100
          )
        )
      : 0;

  const eveningProgress =
    students.length
      ? Math.min(
          100,
          Math.round(
            (eveningCompleted / students.length) * 100
          )
        )
      : 0;

  const studentCounts =
    tripMode === 'to_school'
      ? periodCounts.morning
      : periodCounts.evening;

  const progress =
    tripMode === 'to_school'
      ? morningProgress
      : eveningProgress;

  const tripModeTitle =
    tripMode ===
    'to_school'
      ? isRTL
        ? 'رحلة الذهاب إلى المدرسة'
        : 'Morning Trip to School'
      : isRTL
      ? 'رحلة العودة إلى المنزل'
      : 'Return Trip Home';

  const tripModeShort =
    tripMode ===
    'to_school'
      ? isRTL
        ? 'ذهاب'
        : 'To School'
      : isRTL
      ? 'عودة'
      : 'To Home';

  const canStartTrip =
    !!bus?.id &&
    !!route?.id;

  const startTrip = () => {
    if (!bus?.id) {
      Alert.alert(
        isRTL
          ? 'لا يوجد باص'
          : 'No Bus',
        isRTL
          ? 'لا يمكن بدء الرحلة قبل ربط السائق بباص.'
          : 'The driver must be assigned to a bus before starting a trip.'
      );

      return;
    }

    if (!route?.id) {
      Alert.alert(
        isRTL
          ? 'لا يوجد مسار'
          : 'No Route',
        isRTL
          ? 'لا يمكن بدء الرحلة قبل ربط الباص بمسار.'
          : 'The bus must be assigned to a route before starting a trip.'
      );

      return;
    }

    navigation.navigate(
      'DriverMap',
      {
        driverId:
          user?.id,

        busId:
          bus.id,

        routeId:
          route.id,

        startTrip:
          true,

        tripMode,
      }
    );
  };

  const openMap = () => {
    navigation.navigate(
      'DriverMap',
      {
        driverId:
          user?.id,

        busId:
          bus?.id,

        routeId:
          route?.id,

        tripMode,
      }
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.loadingScreen,
          {
            backgroundColor:
              theme.colors.background,
          },
        ]}
      >
        <View
          style={
            styles.loadingLogo
          }
        >
          <Ionicons
            name="bus"
            size={38}
            color="#0A2D44"
          />
        </View>

        <ActivityIndicator
          size="large"
          color="#F7B83A"
        />

        <Text
          style={[
            styles.loadingText,
            {
              color:
                theme.colors.textSecondary,
            },
          ]}
        >
          {isRTL
            ? 'جاري تجهيز لوحة السائق...'
            : 'Preparing driver dashboard...'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.screen,
        {
          backgroundColor:
            theme.colors.background,
        },
      ]}
    >
      <ScrollView
        style={{
          flex: 1,
        }}
        contentContainerStyle={[
          styles.content,
          {
            width: '100%',
            maxWidth: responsive.contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: responsive.horizontalPadding,
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() =>
              void load(true)
            }
            tintColor="#F7B83A"
          />
        }
      >
        {/* ================= HEADER ================= */}

        <View
          style={[
            styles.header,
            {
              flexDirection:
                direction,
            },
          ]}
        >
          <View
            style={[
              styles.driverAvatar,
              {
                borderColor:
                  theme.colors.border,
              },
            ]}
          >
            <Text
              style={
                styles.driverAvatarText
              }
            >
              {initials(
                driverName
              )}
            </Text>
          </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={[
                styles.hello,
                {
                  color:
                    theme.colors.textSecondary,

                  textAlign,
                },
              ]}
            >
              {isRTL
                ? 'أهلاً بك في لوحة السائق'
                : 'Welcome to your driver dashboard'}
            </Text>

            <Text
              numberOfLines={1}
              style={[
                styles.driverName,
                {
                  color:
                    theme.colors.text,

                  textAlign,
                },
              ]}
            >
              {driverName}
            </Text>

            <View
              style={[
                styles.schoolLine,
                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <Ionicons
                name="school-outline"
                size={13}
                color={
                  theme.colors.textSecondary
                }
              />

              <Text
                numberOfLines={1}
                style={[
                  styles.schoolText,
                  {
                    color:
                      theme.colors.textSecondary,

                    textAlign,
                  },
                ]}
              >
                {schoolName}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.headerActions,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <Pressable
              onPress={() =>
                navigation.navigate(
                  'DriverNotifications'
                )
              }
              style={[
                styles.headerButton,
                {
                  backgroundColor:
                    theme.colors.surface,

                  borderColor:
                    theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name="notifications-outline"
                size={23}
                color={
                  theme.colors.text
                }
              />
            </Pressable>

            <Pressable
              onPress={() =>
                navigation.navigate(
                  'DriverSettings'
                )
              }
              style={[
                styles.headerButton,
                {
                  backgroundColor:
                    theme.colors.surface,

                  borderColor:
                    theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name="settings-outline"
                size={22}
                color={
                  theme.colors.text
                }
              />
            </Pressable>
          </View>
        </View>

        {!!errorMessage && (
          <View
            style={[
              styles.errorCard,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <Ionicons
              name="warning-outline"
              size={21}
              color="#FFFFFF"
            />

            <Text
              style={[
                styles.errorText,
                {
                  textAlign,
                },
              ]}
            >
              {errorMessage}
            </Text>

            <Pressable
              onPress={() =>
                void load(true)
              }
            >
              <Ionicons
                name="refresh"
                size={21}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        )}

        {/* ================= TRIP HERO ================= */}

        <View
          style={
            styles.heroCard
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
                styles.heroBusIcon
              }
            >
              <Ionicons
                name="bus"
                size={31}
                color="#0A2D44"
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <View
                style={[
                  styles.modeRow,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.heroEyebrow,
                    {
                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'رحلة اليوم'
                    : "TODAY'S TRIP"}
                </Text>

                <View
                  style={
                    styles.modeBadge
                  }
                >
                  <Ionicons
                    name={
                      tripMode ===
                      'to_school'
                        ? 'sunny-outline'
                        : 'moon-outline'
                    }
                    size={12}
                    color="#F7B83A"
                  />

                  <Text
                    style={
                      styles.modeBadgeText
                    }
                  >
                    {tripModeShort}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.heroTitle,
                  {
                    textAlign,
                  },
                ]}
              >
                {tripModeTitle}
              </Text>

              <Text
                numberOfLines={1}
                style={[
                  styles.heroRoute,
                  {
                    textAlign,
                  },
                ]}
              >
                {routeName}
              </Text>
            </View>

            <View
              style={[
                styles.liveBadge,
                {
                  backgroundColor:
                    live
                      ? 'rgba(28,199,128,0.16)'
                      : 'rgba(255,255,255,0.08)',
                },
              ]}
            >
              <View
                style={[
                  styles.liveDot,
                  {
                    backgroundColor:
                      live
                        ? '#1CC780'
                        : '#93A4B0',
                  },
                ]}
              />

              <Text
                style={[
                  styles.liveText,
                  {
                    color:
                      live
                        ? '#70E7B3'
                        : '#BAC5CD',
                  },
                ]}
              >
                {live
                  ? 'LIVE'
                  : 'OFF'}
              </Text>
            </View>
          </View>

          <View
            style={
              styles.heroDivider
            }
          />

          <View
            style={[
              styles.busMetaRow,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <HeroMeta
              icon="bus-outline"
              label={
                isRTL
                  ? 'الباص'
                  : 'Bus'
              }
              value={
                busNumber
              }
              direction={
                direction
              }
            />

            <View
              style={
                styles.heroMetaDivider
              }
            />

            <HeroMeta
              icon="card-outline"
              label={
                isRTL
                  ? 'اللوحة'
                  : 'Plate'
              }
              value={
                plateNumber
              }
              direction={
                direction
              }
            />

            <View
              style={
                styles.heroMetaDivider
              }
            />

            <HeroMeta
              icon="time-outline"
              label={
                isRTL
                  ? 'آخر تحديث'
                  : 'Updated'
              }
              value={
                latestLocation
                  ? locationTime
                  : '—'
              }
              direction={
                direction
              }
            />
          </View>

          <Pressable
            onPress={
              startTrip
            }
            disabled={
              !canStartTrip
            }
            style={({ pressed }) => [
              styles.startButton,
              {
                opacity:
                  !canStartTrip
                    ? 0.45
                    : pressed
                    ? 0.86
                    : 1,
              },
            ]}
          >
            <View
              style={
                styles.startIcon
              }
            >
              <Ionicons
                name="play"
                size={22}
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
                  styles.startTitle,
                  {
                    textAlign,
                  },
                ]}
              >
                {isRTL
                  ? 'بدء الرحلة'
                  : 'Start Trip'}
              </Text>

              <Text
                style={[
                  styles.startSubtitle,
                  {
                    textAlign,
                  },
                ]}
              >
                {canStartTrip
                  ? isRTL
                    ? 'GPS • ملاحة • حالات الطلاب • إشعارات أولياء الأمور'
                    : 'GPS • Navigation • Student status • Parent alerts'
                  : isRTL
                  ? 'يجب ربط السائق بباص ومسار أولاً'
                  : 'Assign a bus and route first'}
              </Text>
            </View>

            <Ionicons
              name={
                isRTL
                  ? 'chevron-back'
                  : 'chevron-forward'
              }
              size={22}
              color="#0A2D44"
            />
          </Pressable>
        </View>

        {/* ================= PROGRESS ================= */}

        <View
          style={[
            styles.progressCard,
            {
              backgroundColor:
                theme.colors.surface,

              borderColor:
                theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.progressHeader,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <View>
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color:
                      theme.colors.text,

                    textAlign,
                  },
                ]}
              >
                {isRTL
                  ? tripMode === 'to_school'
                    ? 'تقدم الفترة الصباحية'
                    : 'تقدم الفترة المسائية'
                  : tripMode === 'to_school'
                  ? 'Morning Period Progress'
                  : 'Evening Period Progress'}
              </Text>

              <Text
                style={[
                  styles.cardSubtitle,
                  {
                    color:
                      theme.colors.textSecondary,

                    textAlign,
                  },
                ]}
              >
                {tripMode ===
                'to_school'
                  ? isRTL
                    ? 'يتم احتساب الطالب مكتملًا بعد الركوب أو تسجيل الغياب.'
                    : 'Completed after boarding or absence.'
                  : isRTL
                  ? 'يتم احتساب الطالب مكتملًا بعد التوصيل أو تسجيل الغياب.'
                  : 'Completed after delivery or absence.'}
              </Text>
            </View>

            <Text
              style={
                styles.progressPercent
              }
            >
              {progress}%
            </Text>
          </View>

          <View
            style={[
              styles.progressTrack,
              {
                backgroundColor:
                  isDark
                    ? '#253342'
                    : '#E9EEF2',
              },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    `${progress}%`,
                },
              ]}
            />
          </View>

          <View
            style={[
              styles.statsRow,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <StatCard
              icon="people-outline"
              value={
                students.length
              }
              label={
                isRTL
                  ? 'الطلاب'
                  : 'Students'
              }
              color="#3186E8"
              theme={
                theme
              }
            />

            <StatCard
              icon="bus-outline"
              value={
                studentCounts.boarded
              }
              label={
                isRTL
                  ? 'داخل الباص'
                  : 'On Bus'
              }
              color="#F7B83A"
              theme={
                theme
              }
            />

            <StatCard
              icon="checkmark-done-outline"
              value={
                studentCounts.delivered
              }
              label={
                isRTL
                  ? 'تم التوصيل'
                  : 'Delivered'
              }
              color="#0D8F5B"
              theme={
                theme
              }
            />

            <StatCard
              icon="close-circle-outline"
              value={
                studentCounts.absent
              }
              label={
                isRTL
                  ? 'غياب'
                  : 'Absent'
              }
              color="#E24C4B"
              theme={
                theme
              }
            />
          </View>
        </View>

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              marginTop: 12,
            },
          ]}
        >
          <InfoRow
            icon="sunny-outline"
            label={isRTL ? 'الصباحية' : 'Morning'}
            value={
              `${morningProgress}% • ` +
              `${periodCounts.morning.boarded} ` +
              (isRTL ? 'مستلم' : 'boarded') +
              ` • ${periodCounts.morning.absent} ` +
              (isRTL ? 'غياب/عذر' : 'absent/excused')
            }
            theme={theme}
            textAlign={textAlign}
            direction={direction}
          />

          <InfoRow
            icon="moon-outline"
            label={isRTL ? 'المسائية' : 'Evening'}
            value={
              `${eveningProgress}% • ` +
              `${periodCounts.evening.delivered} ` +
              (isRTL ? 'موصل' : 'delivered') +
              ` • ${periodCounts.evening.absent} ` +
              (isRTL ? 'غياب/عذر' : 'absent/excused')
            }
            theme={theme}
            textAlign={textAlign}
            direction={direction}
          />
        </View>

        {/* ================= QUICK ACTIONS ================= */}

        <SectionTitle
          title={
            isRTL
              ? 'الخدمات السريعة'
              : 'Quick Actions'
          }
          subtitle={
            isRTL
              ? 'كل ما يحتاجه السائق أثناء الرحلة'
              : 'Everything the driver needs during the trip'
          }
          textAlign={
            textAlign
          }
          theme={
            theme
          }
        />

        <View
          style={
            styles.actionsGrid
          }
        >
          <QuickAction
            icon="navigate-outline"
            title={
              isRTL
                ? 'الخريطة والملاحة'
                : 'Map & Navigation'
            }
            subtitle={
              isRTL
                ? 'المسار وأقرب طالب'
                : 'Route & nearest student'
            }
            color="#3186E8"
            onPress={
              openMap
            }
            theme={
              theme
            }
            textAlign={
              textAlign
            }
          />

          <QuickAction
            icon="people-outline"
            title={
              isRTL
                ? 'طلاب المسار'
                : 'Route Students'
            }
            subtitle={
              isRTL
                ? 'الحضور وحالات الرحلة'
                : 'Attendance & trip status'
            }
            color="#0D8F5B"
            onPress={() =>
              navigation.navigate(
                'DriverStudents'
              )
            }
            theme={
              theme
            }
            textAlign={
              textAlign
            }
          />

          <QuickAction
            icon="warning-outline"
            title={
              isRTL
                ? 'إرسال بلاغ'
                : 'Report Incident'
            }
            subtitle={
              isRTL
                ? 'تأخير أو عطل أو حادث'
                : 'Delay, breakdown or incident'
            }
            color="#E24C4B"
            onPress={() =>
              navigation.navigate(
                'DriverIncidents'
              )
            }
            theme={
              theme
            }
            textAlign={
              textAlign
            }
          />

          <QuickAction
            icon="notifications-outline"
            title={
              isRTL
                ? 'التنبيهات'
                : 'Notifications'
            }
            subtitle={
              isRTL
                ? 'إشعارات الإدارة والرحلة'
                : 'Administration & trip alerts'
            }
            color="#8B5CF6"
            onPress={() =>
              navigation.navigate(
                'DriverNotifications'
              )
            }
            theme={
              theme
            }
            textAlign={
              textAlign
            }
          />

          <QuickAction
            icon="settings-outline"
            title={
              isRTL
                ? 'الإعدادات'
                : 'Settings'
            }
            subtitle={
              isRTL
                ? 'الحساب واللغة والتنبيهات'
                : 'Account, language & alerts'
            }
            color="#E7A526"
            onPress={() =>
              navigation.navigate(
                'DriverSettings'
              )
            }
            theme={
              theme
            }
            textAlign={
              textAlign
            }
          />

          <QuickAction
            icon="refresh-outline"
            title={
              isRTL
                ? 'تحديث البيانات'
                : 'Refresh Data'
            }
            subtitle={
              isRTL
                ? 'تحديث الباص والطلاب'
                : 'Refresh bus & students'
            }
            color="#697586"
            onPress={() =>
              void load(true)
            }
            theme={
              theme
            }
            textAlign={
              textAlign
            }
          />
        </View>

        {/* ================= TRIP INFORMATION ================= */}

        <SectionTitle
          title={
            isRTL
              ? 'معلومات الرحلة'
              : 'Trip Information'
          }
          subtitle={
            isRTL
              ? 'البيانات المرتبطة بالسائق حاليًا'
              : 'Currently assigned driver information'
          }
          textAlign={
            textAlign
          }
          theme={
            theme
          }
        />

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor:
                theme.colors.surface,

              borderColor:
                theme.colors.border,
            },
          ]}
        >
          <InfoRow
            icon="school-outline"
            label={
              isRTL
                ? 'المدرسة'
                : 'School'
            }
            value={
              schoolName
            }
            direction={
              direction
            }
            textAlign={
              textAlign
            }
            theme={
              theme
            }
          />

          <InfoRow
            icon="navigate-outline"
            label={
              isRTL
                ? 'المسار'
                : 'Route'
            }
            value={
              routeName
            }
            direction={
              direction
            }
            textAlign={
              textAlign
            }
            theme={
              theme
            }
          />

          <InfoRow
            icon="bus-outline"
            label={
              isRTL
                ? 'الباص'
                : 'Bus'
            }
            value={
              isRTL
                ? `باص ${busNumber}`
                : `Bus ${busNumber}`
            }
            direction={
              direction
            }
            textAlign={
              textAlign
            }
            theme={
              theme
            }
          />

          {!!teacherName && (
            <InfoRow
              icon="person-outline"
              label={
                isRTL
                  ? 'المعلم / المشرف'
                  : 'Teacher / Supervisor'
              }
              value={
                teacherName
              }
              direction={
                direction
              }
              textAlign={
                textAlign
              }
              theme={
                theme
              }
            />
          )}

          <InfoRow
            icon="people-outline"
            label={
              isRTL
                ? 'عدد الطلاب'
                : 'Students'
            }
            value={
              String(
                students.length
              )
            }
            direction={
              direction
            }
            textAlign={
              textAlign
            }
            theme={
              theme
            }
            last
          />
        </View>

        {/* ================= STUDENT PREVIEW ================= */}

        {students.length >
          0 && (
          <>
            <View
              style={[
                styles.listHeader,
                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <SectionTitle
                title={
                  isRTL
                    ? 'طلاب المسار'
                    : 'Route Students'
                }
                subtitle={
                  isRTL
                    ? 'آخر الحالات المسجلة'
                    : 'Latest recorded status'
                }
                textAlign={
                  textAlign
                }
                theme={
                  theme
                }
                compact
              />

              <Pressable
                onPress={() =>
                  navigation.navigate(
                    'DriverStudents'
                  )
                }
                style={[
                  styles.viewAllButton,
                  {
                    borderColor:
                      theme.colors.border,

                    backgroundColor:
                      theme.colors.surface,
                  },
                ]}
              >
                <Text
                  style={
                    styles.viewAll
                  }
                >
                  {isRTL
                    ? 'عرض الكل'
                    : 'View All'}
                </Text>

                <Ionicons
                  name={
                    isRTL
                      ? 'chevron-back'
                      : 'chevron-forward'
                  }
                  size={15}
                  color="#E0A024"
                />
              </Pressable>
            </View>

            <View
              style={[
                styles.studentsPreview,
                {
                  backgroundColor:
                    theme.colors.surface,

                  borderColor:
                    theme.colors.border,
                },
              ]}
            >
              {students
                .slice(
                  0,
                  5
                )
                .map(
                  (
                    student,
                    index
                  ) => {
                    const attendance =
  (
    tripMode === 'to_school'
      ? attendanceByPeriod.morning
      : attendanceByPeriod.evening
  ).get(
    String(
      student.id
    )
  );

                    const approvedExcuse = currentExcuseMap.get(String(student.id));
                    const status = approvedExcuse
                      ? 'absent'
                      : normalizeStatus(attendance?.status ?? attendance?.event_type);

                    const statusMeta = getStatusMeta(
                      status,
                      isRTL,
                      approvedExcuse?.request_type
                    );

                    return (
                      <View
                        key={
                          student.id ??
                          index
                        }
                        style={[
                          styles.studentRow,
                          {
                            flexDirection:
                              direction,

                            borderBottomWidth:
                              index ===
                              Math.min(
                                students.length,
                                5
                              ) -
                                1
                                ? 0
                                : StyleSheet.hairlineWidth,

                            borderBottomColor:
                              theme.colors.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.studentAvatar,
                            {
                              backgroundColor:
                                statusMeta.background,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.studentAvatarText,
                              {
                                color:
                                  statusMeta.color,
                              },
                            ]}
                          >
                            {studentName(
                              student,
                              isRTL
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </Text>
                        </View>

                        <View
                          style={{
                            flex: 1,
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.studentName,
                              {
                                color:
                                  theme.colors.text,

                                textAlign,
                              },
                            ]}
                          >
                            {studentName(
                              student,
                              isRTL
                            )}
                          </Text>

                          <Text
                            numberOfLines={1}
                            style={[
                              styles.studentMeta,
                              {
                                color:
                                  theme.colors.textSecondary,

                                textAlign,
                              },
                            ]}
                          >
                            {firstValue(
                              student.grade_name,
                              student.grade,
                              student.section_name,
                              isRTL
                                ? 'طالب في المسار'
                                : 'Route student'
                            )}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.studentStatusBadge,
                            {
                              backgroundColor:
                                statusMeta.background,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.studentStatusText,
                              {
                                color:
                                  statusMeta.color,
                              },
                            ]}
                          >
                            {statusMeta.label}
                          </Text>
                        </View>
                      </View>
                    );
                  }
                )}
            </View>
          </>
        )}

        <View
          style={{
            height: 26,
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function getStatusMeta(
  status: StudentStatus,
  isRTL: boolean,
  excuseType?: string | null
) {
  if (
    status === 'boarded'
  ) {
    return {
      color: '#B77900',
      background:
        '#FFF6DA',
      label:
        isRTL
          ? 'داخل الباص'
          : 'On Bus',
    };
  }

  if (
    status === 'delivered'
  ) {
    return {
      color: '#0D8F5B',
      background:
        '#E8F7EF',
      label:
        isRTL
          ? 'تم التوصيل'
          : 'Delivered',
    };
  }

  if (
    status === 'absent'
  ) {
    return {
      color: '#D94A4A',
      background:
        '#FDECEC',
      label: excuseType
        ? approvedExcuseLabel(excuseType, isRTL)
        : isRTL
        ? 'غياب'
        : 'Absent',
    };
  }

  if (
    status === 'arrived'
  ) {
    return {
      color: '#2F80ED',
      background:
        '#EEF5FF',
      label:
        isRTL
          ? 'تم الوصول'
          : 'Arrived',
    };
  }

  return {
    color: '#667085',
    background:
      '#F2F4F7',
    label:
      isRTL
        ? 'على المسار'
        : 'On Route',
  };
}

function HeroMeta({
  icon,
  label,
  value,
  direction,
}: {
  icon: IconName;
  label: string;
  value: string;
  direction:
    'row'
    | 'row-reverse';
}) {
  return (
    <View
      style={
        styles.heroMeta
      }
    >
      <View
        style={[
          styles.heroMetaLabelRow,
          {
            flexDirection:
              direction,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={12}
          color="#AFC2D0"
        />

        <Text
          style={
            styles.heroMetaLabel
          }
        >
          {label}
        </Text>
      </View>

      <Text
        numberOfLines={1}
        style={
          styles.heroMetaValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({
  title,
  subtitle,
  textAlign,
  theme,
  compact = false,
}: {
  title: string;
  subtitle: string;
  textAlign:
    'left'
    | 'right';
  theme: any;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.sectionTitleWrap,
        compact && {
          marginTop: 0,
          marginBottom: 0,
        },
      ]}
    >
      <Text
        style={[
          styles.sectionTitle,
          {
            color:
              theme.colors.text,
            textAlign,
          },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.sectionSubtitle,
          {
            color:
              theme.colors.textSecondary,
            textAlign,
          },
        ]}
      >
        {subtitle}
      </Text>
    </View>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
  theme,
}: {
  icon: IconName;
  value: number;
  label: string;
  color: string;
  theme: any;
}) {
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor:
            theme.colors.surface2 ??
            theme.colors.surface,

          borderColor:
            theme.colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.statIcon,
          {
            backgroundColor:
              `${color}14`,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={color}
        />
      </View>

      <Text
        style={[
          styles.statNumber,
          {
            color:
              theme.colors.text,
          },
        ]}
      >
        {value}
      </Text>

      <Text
        numberOfLines={1}
        style={[
          styles.statLabel,
          {
            color:
              theme.colors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  color,
  onPress,
  theme,
  textAlign,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  color: string;
  onPress:
    () => void;
  theme: any;
  textAlign:
    'left'
    | 'right';
}) {
  return (
    <Pressable
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.quickCard,
        {
          backgroundColor:
            theme.colors.surface,

          borderColor:
            theme.colors.border,

          opacity:
            pressed
              ? 0.8
              : 1,

          transform: [
            {
              scale:
                pressed
                  ? 0.985
                  : 1,
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.quickIcon,
          {
            backgroundColor:
              `${color}12`,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={24}
          color={color}
        />
      </View>

      <Text
        style={[
          styles.quickTitle,
          {
            color:
              theme.colors.text,
            textAlign,
          },
        ]}
      >
        {title}
      </Text>

      <Text
        numberOfLines={2}
        style={[
          styles.quickSubtitle,
          {
            color:
              theme.colors.textSecondary,
            textAlign,
          },
        ]}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

function InfoRow({
  icon,
  label,
  value,
  direction,
  textAlign,
  theme,
  last = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  direction: any;
  textAlign:
    'left'
    | 'right';
  theme: any;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        {
          flexDirection:
            direction,

          borderBottomWidth:
            last
              ? 0
              : StyleSheet.hairlineWidth,

          borderBottomColor:
            theme.colors.border,
        },
      ]}
    >
      <View
        style={
          styles.infoIcon
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
            styles.infoLabel,
            {
              color:
                theme.colors.textSecondary,
              textAlign,
            },
          ]}
        >
          {label}
        </Text>

        <Text
          numberOfLines={1}
          style={[
            styles.infoValue,
            {
              color:
                theme.colors.text,
              textAlign,
            },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
    },

    content: {
      paddingHorizontal:
        16,
      paddingTop:
        10,
      paddingBottom:
        112,
    },

    loadingScreen: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    loadingLogo: {
      width: 72,
      height: 72,
      borderRadius: 23,
      backgroundColor:
        '#F7B83A',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 18,
    },

    loadingText: {
      marginTop: 12,
      fontSize: 12,
      fontWeight:
        '700',
    },

    header: {
      alignItems:
        'center',
      gap: 11,
      marginBottom: 16,
    },

    driverAvatar: {
      width: 52,
      height: 52,
      borderRadius: 17,
      borderWidth: 1,
      backgroundColor:
        '#F7B83A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    driverAvatarText: {
      color: '#0A2D44',
      fontSize: 16,
      fontWeight:
        '900',
    },

    hello: {
      fontSize: 10,
      fontWeight:
        '700',
    },

    driverName: {
      marginTop: 2,
      fontSize: 23,
      fontWeight:
        '900',
    },

    schoolLine: {
      marginTop: 4,
      alignItems:
        'center',
      gap: 5,
    },

    schoolText: {
      flex: 1,
      fontSize: 10,
      fontWeight:
        '700',
    },

    headerActions: {
      alignItems:
        'center',
      gap: 7,
    },

    headerButton: {
      width: 43,
      height: 43,
      borderRadius: 14,
      borderWidth: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    errorCard: {
      minHeight: 52,
      borderRadius: 17,
      paddingHorizontal: 13,
      backgroundColor:
        '#D14B4B',
      alignItems:
        'center',
      gap: 9,
      marginBottom: 13,
    },

    errorText: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 10,
      lineHeight: 15,
      fontWeight:
        '700',
    },

    heroCard: {
      borderRadius: 28,
      padding: 16,
      backgroundColor:
        '#0A2D44',
      marginBottom: 14,
      shadowColor:
        '#000',
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.15,
      shadowRadius: 18,
      elevation: 7,
    },

    heroTop: {
      alignItems:
        'center',
      gap: 11,
    },

    heroBusIcon: {
      width: 57,
      height: 57,
      borderRadius: 19,
      backgroundColor:
        '#F7B83A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    modeRow: {
      alignItems:
        'center',
      gap: 7,
    },

    heroEyebrow: {
      color:
        'rgba(255,255,255,0.55)',
      fontSize: 8,
      fontWeight:
        '900',
      letterSpacing: 0.7,
    },

    modeBadge: {
      minHeight: 24,
      paddingHorizontal: 7,
      borderRadius: 9,
      backgroundColor:
        'rgba(247,184,58,0.12)',
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 4,
    },

    modeBadgeText: {
      color: '#F7B83A',
      fontSize: 8,
      fontWeight:
        '900',
    },

    heroTitle: {
      marginTop: 4,
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight:
        '900',
    },

    heroRoute: {
      marginTop: 3,
      color:
        'rgba(255,255,255,0.66)',
      fontSize: 10,
      fontWeight:
        '700',
    },

    liveBadge: {
      minWidth: 54,
      height: 28,
      borderRadius: 11,
      paddingHorizontal: 7,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 5,
    },

    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },

    liveText: {
      fontSize: 8,
      fontWeight:
        '900',
    },

    heroDivider: {
      height:
        StyleSheet.hairlineWidth,
      backgroundColor:
        'rgba(255,255,255,0.14)',
      marginVertical: 14,
    },

    busMetaRow: {
      alignItems:
        'center',
      marginBottom: 14,
    },

    heroMeta: {
      flex: 1,
      paddingHorizontal: 5,
    },

    heroMetaLabelRow: {
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 4,
    },

    heroMetaLabel: {
      color: '#AFC2D0',
      fontSize: 7,
      fontWeight:
        '700',
    },

    heroMetaValue: {
      marginTop: 4,
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight:
        '900',
      textAlign:
        'center',
    },

    heroMetaDivider: {
      width:
        StyleSheet.hairlineWidth,
      height: 30,
      backgroundColor:
        'rgba(255,255,255,0.14)',
    },

    startButton: {
      minHeight: 68,
      borderRadius: 19,
      paddingHorizontal: 12,
      backgroundColor:
        '#F7B83A',
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 10,
    },

    startIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        'rgba(10,45,68,0.08)',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    startTitle: {
      color: '#0A2D44',
      fontSize: 14,
      fontWeight:
        '900',
    },

    startSubtitle: {
      marginTop: 2,
      color:
        'rgba(10,45,68,0.67)',
      fontSize: 8,
      lineHeight: 12,
      fontWeight:
        '700',
    },

    progressCard: {
      borderWidth: 1,
      borderRadius: 24,
      padding: 14,
      marginBottom: 8,
    },

    progressHeader: {
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
      gap: 10,
    },

    cardTitle: {
      fontSize: 15,
      fontWeight:
        '900',
    },

    cardSubtitle: {
      marginTop: 3,
      maxWidth: 255,
      fontSize: 8,
      lineHeight: 12,
      fontWeight:
        '600',
    },

    progressPercent: {
      color: '#0D8F5B',
      fontSize: 18,
      fontWeight:
        '900',
    },

    progressTrack: {
      height: 8,
      marginTop: 13,
      borderRadius: 999,
      overflow:
        'hidden',
    },

    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor:
        '#0D8F5B',
    },

    statsRow: {
      gap: 7,
      marginTop: 13,
    },

    statCard: {
      flex: 1,
      minHeight: 87,
      borderWidth: 1,
      borderRadius: 17,
      padding: 8,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    statIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    statNumber: {
      marginTop: 4,
      fontSize: 17,
      fontWeight:
        '900',
    },

    statLabel: {
      marginTop: 1,
      fontSize: 7,
      fontWeight:
        '700',
      textAlign:
        'center',
    },

    sectionTitleWrap: {
      marginTop: 20,
      marginBottom: 9,
    },

    sectionTitle: {
      fontSize: 16,
      fontWeight:
        '900',
    },

    sectionSubtitle: {
      marginTop: 2,
      fontSize: 9,
      fontWeight:
        '600',
    },

    actionsGrid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      justifyContent:
        'space-between',
      rowGap: 10,
      marginBottom: 2,
    },

    quickCard: {
      width: '48.5%',
      minHeight: 125,
      borderWidth: 1,
      borderRadius: 21,
      padding: 13,
    },

    quickIcon: {
      width: 43,
      height: 43,
      borderRadius: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    quickTitle: {
      marginTop: 9,
      fontSize: 12,
      fontWeight:
        '900',
    },

    quickSubtitle: {
      marginTop: 3,
      fontSize: 8,
      lineHeight: 12,
      fontWeight:
        '600',
    },

    infoCard: {
      borderWidth: 1,
      borderRadius: 22,
      paddingHorizontal: 13,
      overflow:
        'hidden',
    },

    infoRow: {
      minHeight: 65,
      alignItems:
        'center',
      gap: 10,
    },

    infoIcon: {
      width: 39,
      height: 39,
      borderRadius: 13,
      backgroundColor:
        'rgba(247,184,58,0.11)',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    infoLabel: {
      fontSize: 8,
      fontWeight:
        '600',
    },

    infoValue: {
      marginTop: 2,
      fontSize: 11,
      fontWeight:
        '800',
    },

    listHeader: {
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginTop: 20,
      marginBottom: 9,
    },

    viewAllButton: {
      minHeight: 34,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 9,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 3,
    },

    viewAll: {
      color: '#E0A024',
      fontSize: 9,
      fontWeight:
        '900',
    },

    studentsPreview: {
      borderWidth: 1,
      borderRadius: 21,
      paddingHorizontal: 13,
      overflow:
        'hidden',
    },

    studentRow: {
      minHeight: 67,
      alignItems:
        'center',
      gap: 10,
    },

    studentAvatar: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    studentAvatarText: {
      fontSize: 14,
      fontWeight:
        '900',
    },

    studentName: {
      fontSize: 11,
      fontWeight:
        '900',
    },

    studentMeta: {
      marginTop: 2,
      fontSize: 8,
      fontWeight:
        '600',
    },

    studentStatusBadge: {
      minHeight: 27,
      borderRadius: 9,
      paddingHorizontal: 8,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    studentStatusText: {
      fontSize: 7,
      fontWeight:
        '900',
    },
  });