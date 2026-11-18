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
  Image,
  Linking,
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
  getParentTrackingChildren,
  ParentTrackingChild,
} from '../../services/busService';

import {
  useAppTheme,
} from '../../theme/ThemeContext';

import {
  useLanguage,
} from '../../i18n/LanguageContext';

type IconName =
  React.ComponentProps<typeof Ionicons>['name'];

function firstText(
  ...values: any[]
) {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined &&
      String(value).trim()
    ) {
      return String(value).trim();
    }
  }

  return '';
}

function studentName(
  child: ParentTrackingChild | null,
  isRTL: boolean
) {
  const student = child?.student;

  return firstText(
    isRTL
      ? student?.full_name_ar
      : student?.full_name_en,
    student?.full_name,
    student?.name,
    student?.full_name_ar,
    student?.full_name_en,
    isRTL ? 'الطالب' : 'Student'
  );
}

function parentName(
  child: ParentTrackingChild | null,
  user: any,
  isRTL: boolean
) {
  const parent = child?.parent;

  return firstText(
    isRTL
      ? parent?.full_name_ar
      : parent?.full_name_en,
    parent?.full_name,
    parent?.name,
    parent?.full_name_ar,
    parent?.full_name_en,
    user?.full_name,
    isRTL ? 'ولي الأمر' : 'Parent'
  );
}

function schoolName(
  child: ParentTrackingChild | null,
  isRTL: boolean
) {
  const school = child?.school;

  return firstText(
    isRTL
      ? school?.name_ar
      : school?.name_en,
    school?.name,
    school?.school_name,
    school?.name_ar,
    school?.name_en,
    isRTL ? 'المدرسة' : 'School'
  );
}

function initials(
  value: string
) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return 'ST';
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${
    parts[0]?.[0] ?? ''
  }${
    parts[1]?.[0] ?? ''
  }`.toUpperCase();
}

function normalizeStatus(
  value?: string | null
) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function attendanceLabel(
  value:
    | string
    | null
    | undefined,
  isRTL: boolean
) {
  const status = normalizeStatus(value);

  const ar: Record<string, string> = {
    picked: 'تم صعود الطالب',
    pickup: 'تم صعود الطالب',
    picked_up: 'تم صعود الطالب',
    boarded: 'داخل الباص',
    on_bus: 'داخل الباص',
    arrived: 'وصل الباص',
    arrival: 'وصل الباص',
    delivered: 'تم التوصيل',
    dropoff: 'تم التوصيل',
    dropped_off: 'تم التوصيل',
    arrived_home: 'وصل المنزل',
    absent: 'غائب',
    not_boarded: 'لم يصعد',
    did_not_ride: 'لم يركب',
    no_show: 'لم يحضر',
  };

  const en: Record<string, string> = {
    picked: 'Picked Up',
    pickup: 'Picked Up',
    picked_up: 'Picked Up',
    boarded: 'On Bus',
    on_bus: 'On Bus',
    arrived: 'Bus Arrived',
    arrival: 'Bus Arrived',
    delivered: 'Delivered',
    dropoff: 'Delivered',
    dropped_off: 'Delivered',
    arrived_home: 'Arrived Home',
    absent: 'Absent',
    not_boarded: 'Not Boarded',
    did_not_ride: 'Did Not Ride',
    no_show: 'No Show',
  };

  if (!status) {
    return isRTL
      ? 'لا توجد حالة حديثة'
      : 'No recent status';
  }

  return (
    isRTL
      ? ar[status]
      : en[status]
  ) ?? String(value);
}

function statusColor(
  value?: string | null
) {
  const status = normalizeStatus(value);

  if (
    [
      'picked',
      'pickup',
      'picked_up',
      'boarded',
      'on_bus',
    ].includes(status)
  ) {
    return '#15A86B';
  }

  if (
    [
      'delivered',
      'dropoff',
      'dropped_off',
      'arrived_home',
      'arrived',
      'arrival',
    ].includes(status)
  ) {
    return '#2384C6';
  }

  if (
    [
      'absent',
      'not_boarded',
      'did_not_ride',
      'no_show',
    ].includes(status)
  ) {
    return '#D94A4A';
  }

  return '#8A99A8';
}

function latestLocation(
  child: ParentTrackingChild | null
) {
  if (!child) {
    return null;
  }

  if (child.liveLocation) {
    return {
      updatedAt:
        child.liveLocation.updated_at ??
        null,
      live: true,
    };
  }

  if (child.lastTrackingPoint) {
    return {
      updatedAt:
        child.lastTrackingPoint.recorded_at ??
        null,
      live: false,
    };
  }

  if (child.lastSpeedLocation) {
    return {
      updatedAt:
        child.lastSpeedLocation.recorded_at ??
        null,
      live: false,
    };
  }

  return null;
}

function isLocationFresh(
  value?: string | null
) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();

  if (!Number.isFinite(time)) {
    return false;
  }

  return (
    Date.now() - time
  ) <=
    2 * 60 * 1000;
}

function formatTime(
  value?: string | null
) {
  if (!value) {
    return '—';
  }

  try {
    return new Date(value)
      .toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit',
        }
      );
  } catch {
    return '—';
  }
}

function getGrade(
  child: ParentTrackingChild | null
) {
  return firstText(
    child?.student?.grade_name,
    child?.student?.grade
  );
}

function getSection(
  child: ParentTrackingChild | null
) {
  return firstText(
    child?.student?.section_name,
    child?.student?.section
  );
}

export default function ParentHomeScreen({
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

  const [
    children,
    setChildren,
  ] = useState<
    ParentTrackingChild[]
  >([]);

  const [
    selectedStudentId,
    setSelectedStudentId,
  ] = useState<string | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null
  );

  const selectedChild =
    useMemo(() => {
      if (!children.length) {
        return null;
      }

      return (
        children.find(
          (item) =>
            item.student?.id ===
            selectedStudentId
        ) ??
        children[0]
      );
    }, [
      children,
      selectedStudentId,
    ]);

  const load =
    useCallback(
      async (
        refresh = false
      ) => {
        if (!user?.id) {
          setLoading(false);

          setErrorMessage(
            isRTL
              ? 'لم يتم العثور على حساب ولي الأمر.'
              : 'Parent account was not found.'
          );

          return;
        }

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage(null);

        try {
          const result =
            await getParentTrackingChildren(
              user.id
            );

          setChildren(result);

          if (!result.length) {
            setSelectedStudentId(
              null
            );
            return;
          }

          setSelectedStudentId(
            (current) => {
              if (
                current &&
                result.some(
                  (item) =>
                    item.student?.id ===
                    current
                )
              ) {
                return current;
              }

              return (
                result[0]?.student?.id ??
                null
              );
            }
          );
        } catch (error: any) {
          console.log(
            'ParentHome load error:',
            error
          );

          setErrorMessage(
            error?.message ??
              (
                isRTL
                  ? 'تعذر تحميل بيانات الأبناء.'
                  : 'Could not load children.'
              )
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        user?.id,
        isRTL,
      ]
    );

  useEffect(() => {
    load();
  }, [load]);

  const selectedName =
    studentName(
      selectedChild,
      isRTL
    );

  const guardianName =
    parentName(
      selectedChild,
      user,
      isRTL
    );

  const currentSchoolName =
    schoolName(
      selectedChild,
      isRTL
    );

  const routeName =
    firstText(
      selectedChild?.route?.name,
      selectedChild?.route?.route_name,
      selectedChild?.route?.name_ar,
      selectedChild?.route?.name_en,
      isRTL
        ? 'غير محدد'
        : 'Not assigned'
    );

  const busNumber =
    firstText(
      selectedChild?.bus?.bus_number,
      selectedChild?.bus?.number,
      selectedChild?.student?.bus_number,
      '—'
    );

  const plateNumber =
    firstText(
      selectedChild?.bus?.plate_number,
      '—'
    );

  const driverName =
    firstText(
      selectedChild?.driver?.full_name,
      selectedChild?.driver?.name,
      selectedChild?.bus?.driver_name,
      isRTL
        ? 'غير محدد'
        : 'Not assigned'
    );

  const teacherName =
    firstText(
      selectedChild?.teacher?.full_name,
      selectedChild?.teacher?.name,
      isRTL
        ? 'غير محدد'
        : 'Not assigned'
    );

  const parentPhone =
    firstText(
      selectedChild?.parent?.phone,
      selectedChild?.parent?.whatsapp
    );

  const parentEmail =
    firstText(
      selectedChild?.parent?.email
    );

  const schoolPhone =
    firstText(
      selectedChild?.school?.phone
    );

  const teacherPhone =
    firstText(
      selectedChild?.teacher?.phone
    );

  const driverPhone =
    firstText(
      selectedChild?.driver?.phone
    );

  const logoUrl =
    firstText(
      selectedChild?.school?.logo_url
    );

  const attendanceStatus =
    selectedChild?.attendance?.status ??
    null;

  const statusText =
    attendanceLabel(
      attendanceStatus,
      isRTL
    );

  const currentStatusColor =
    statusColor(
      attendanceStatus
    );

  const busLocation =
    latestLocation(
      selectedChild
    );

  const live =
    Boolean(
      busLocation?.live &&
      isLocationFresh(
        busLocation?.updatedAt
      )
    );

  const busState =
    !busLocation
      ? isRTL
        ? 'لا يوجد موقع مسجل'
        : 'No location'
      : live
      ? isRTL
        ? 'مباشر الآن'
        : 'Live now'
      : isRTL
      ? 'آخر موقع معروف'
      : 'Last known location';

  const openTracking =
    () => {
      if (!selectedChild) {
        return;
      }

      navigation.navigate(
        'StudentTrack',
        {
          studentId:
            selectedChild.student?.id,

          studentName:
            selectedName,

          routeId:
            selectedChild.route?.id,

          busId:
            selectedChild.bus?.id,
        }
      );
    };

  const openRequests =
    () => {
      if (!selectedChild?.student?.id) {
        Alert.alert(
          isRTL
            ? 'اختر الطالب'
            : 'Select student',
          isRTL
            ? 'يرجى اختيار الطالب أولاً.'
            : 'Please select a student first.'
        );
        return;
      }

      navigation.navigate(
        'ParentRequests',
        {
          studentId:
            selectedChild.student.id,
        }
      );
    };

  const callNumber =
    async (
      phone: string,
      label: string
    ) => {
      if (!phone) {
        Alert.alert(
          isRTL
            ? 'الرقم غير مسجل'
            : 'Phone not available',
          isRTL
            ? `لا يوجد رقم هاتف مسجل لـ ${label}.`
            : `No phone number is registered for ${label}.`
        );
        return;
      }

      const clean =
        phone.replace(
          /[^\d+]/g,
          ''
        );

      const url =
        `tel:${clean}`;

      try {
        const supported =
          await Linking.canOpenURL(
            url
          );

        if (!supported) {
          throw new Error(
            'TEL_NOT_SUPPORTED'
          );
        }

        await Linking.openURL(
          url
        );
      } catch {
        Alert.alert(
          isRTL
            ? 'تعذر إجراء الاتصال'
            : 'Could not call',
          phone
        );
      }
    };

  if (loading) {
    return (
      <View
        style={[
          styles.loadingScreen,
          {
            backgroundColor:
              theme.colors.background,
          },
        ]}
      >
        <View
          style={styles.loadingLogo}
        >
          <Ionicons
            name="bus"
            size={34}
            color="#FFFFFF"
          />
        </View>

        <ActivityIndicator
          size="large"
          color="#F7B83A"
          style={{
            marginTop: 16,
          }}
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
            ? 'جاري تحميل البيانات...'
            : 'Loading...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor:
            theme.colors.background,
        },
      ]}
      edges={['top']}
    >
      <ScrollView
        style={styles.container}
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
            refreshing={refreshing}
            onRefresh={() =>
              load(true)
            }
            tintColor="#F7B83A"
          />
        }
      >
        {/* HEADER */}
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
              styles.brandBox,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <View
              style={[
                styles.logoFrame,
                {
                  backgroundColor:
                    theme.colors.surface,
                },
              ]}
            >
              {logoUrl ? (
                <Image
                  source={{
                    uri: logoUrl,
                  }}
                  style={
                    styles.logoImage
                  }
                  resizeMode="contain"
                />
              ) : (
                <Ionicons
                  name="school"
                  size={22}
                  color="#F7B83A"
                />
              )}
            </View>

            <Text
              numberOfLines={1}
              style={[
                styles.brandName,
                {
                  color:
                    theme.colors.text,
                },
              ]}
            >
              {currentSchoolName}
            </Text>
          </View>

          <View
            style={
              styles.headerProfile
            }
          >
            <Text
              style={[
                styles.welcome,
                {
                  color:
                    theme.colors.textSecondary,
                  textAlign,
                },
              ]}
            >
              {isRTL
                ? 'أهلاً وسهلاً'
                : 'Welcome'}
            </Text>

            <Text
              numberOfLines={1}
              style={[
                styles.parentName,
                {
                  color:
                    theme.colors.text,
                  textAlign,
                },
              ]}
            >
              {guardianName}
            </Text>

            <View
              style={[
                styles.parentRoleRow,
                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={13}
                color="#7D90A4"
              />

              <Text
                style={[
                  styles.parentRole,
                  {
                    color:
                      theme.colors.textSecondary,
                  },
                ]}
              >
                {isRTL
                  ? 'ولي الأمر'
                  : 'Parent'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() =>
              navigation.navigate(
                'ParentNotifications'
              )
            }
            style={[
              styles.notificationButton,
              {
                backgroundColor:
                  theme.colors.surface,
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

            <View
              style={
                styles.notificationDot
              }
            />
          </Pressable>
        </View>

        {!!errorMessage && (
          <View
            style={
              styles.errorCard
            }
          >
            <Ionicons
              name="warning-outline"
              size={21}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.errorText
              }
            >
              {errorMessage}
            </Text>

            <Pressable
              onPress={() =>
                load(true)
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

        {children.length ===
        0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor:
                  theme.colors.surface,
              },
            ]}
          >
            <Ionicons
              name="people-outline"
              size={36}
              color="#F7B83A"
            />

            <Text
              style={[
                styles.emptyTitle,
                {
                  color:
                    theme.colors.text,
                },
              ]}
            >
              {isRTL
                ? 'لا يوجد أبناء مرتبطون بالحساب'
                : 'No children linked'}
            </Text>
          </View>
        ) : (
          <>
            {/* CHILDREN */}
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
                style={[
                  styles.sectionTitleRow,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color:
                        theme.colors.text,
                    },
                  ]}
                >
                  {isRTL
                    ? 'أبنائي'
                    : 'My Children'}
                </Text>

                <View
                  style={
                    styles.countBadge
                  }
                >
                  <Text
                    style={
                      styles.countText
                    }
                  >
                    {children.length}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.childrenRow
              }
              style={
                styles.childrenScroll
              }
            >
              {children.map(
                (child) => {
                  const name =
                    studentName(
                      child,
                      isRTL
                    );

                  const active =
                    child.student?.id ===
                    selectedChild?.student?.id;

                  return (
                    <Pressable
                      key={
                        child.student?.id
                      }
                      onPress={() =>
                        setSelectedStudentId(
                          child.student?.id ??
                            null
                        )
                      }
                      style={[
                        styles.childCard,
                        {
                          backgroundColor:
                            active
                              ? '#F7B83A'
                              : theme.colors.surface,

                          borderColor:
                            active
                              ? '#F7B83A'
                              : theme.colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.childAvatar,
                          {
                            backgroundColor:
                              active
                                ? 'rgba(255,255,255,0.22)'
                                : theme.colors.surface2,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.childAvatarText,
                            {
                              color:
                                active
                                  ? '#FFFFFF'
                                  : '#F7B83A',
                            },
                          ]}
                        >
                          {initials(name)}
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
                            styles.childName,
                            {
                              color:
                                active
                                  ? '#FFFFFF'
                                  : theme.colors.text,
                              textAlign,
                            },
                          ]}
                        >
                          {name}
                        </Text>

                        <Text
                          numberOfLines={1}
                          style={[
                            styles.childMeta,
                            {
                              color:
                                active
                                  ? 'rgba(255,255,255,0.78)'
                                  : theme.colors.textSecondary,
                              textAlign,
                            },
                          ]}
                        >
                          {[
                            getGrade(child),
                            getSection(child),
                          ]
                            .filter(Boolean)
                            .join(' • ') ||
                            (
                              isRTL
                                ? 'طالب'
                                : 'Student'
                            )}
                        </Text>
                      </View>

                      {active && (
                        <Ionicons
                          name="checkmark-circle"
                          size={19}
                          color="#FFFFFF"
                        />
                      )}
                    </Pressable>
                  );
                }
              )}
            </ScrollView>

            {/* LIVE TRACKING */}
            <View
              style={
                styles.trackingHero
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
                <View>
                  <Text
                    style={
                      styles.heroCaption
                    }
                  >
                    {isRTL
                      ? 'حالة الطالب'
                      : 'Student status'}
                  </Text>

                  <Text
                    style={[
                      styles.heroStatus,
                      {
                        color:
                          currentStatusColor ===
                          '#8A99A8'
                            ? '#FFFFFF'
                            : '#8EF1BD',
                      },
                    ]}
                  >
                    {statusText}
                  </Text>
                </View>

                <View
                  style={[
                    styles.liveBadge,
                    {
                      backgroundColor:
                        live
                          ? 'rgba(21,168,107,0.20)'
                          : 'rgba(255,255,255,0.10)',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.liveDot,
                      {
                        backgroundColor:
                          live
                            ? '#16D27A'
                            : '#9CADB8',
                      },
                    ]}
                  />

                  <Text
                    style={[
                      styles.liveBadgeText,
                      {
                        color:
                          live
                            ? '#62E9A4'
                            : '#D3DCE3',
                      },
                    ]}
                  >
                    {busState}
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.routeVisual
                }
              >
                <View
                  style={
                    styles.routeLine
                  }
                />

                <RouteStop
                  icon="home"
                  label={
                    isRTL
                      ? 'المنزل'
                      : 'Home'
                  }
                />

                <View
                  style={
                    styles.busStop
                  }
                >
                  <View
                    style={
                      styles.busStopIcon
                    }
                  >
                    <Ionicons
                      name="bus"
                      size={23}
                      color="#0A2D44"
                    />
                  </View>

                  <Text
                    style={
                      styles.busStopText
                    }
                  >
                    {isRTL
                      ? 'الباص'
                      : 'Bus'}
                    {' '}
                    {busNumber}
                  </Text>
                </View>

                <RouteStop
                  icon="school"
                  label={
                    isRTL
                      ? 'المدرسة'
                      : 'School'
                  }
                />
              </View>

              <View
                style={[
                  styles.heroFooter,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <View>
                  <Text
                    style={
                      styles.heroFooterLabel
                    }
                  >
                    {isRTL
                      ? 'آخر تحديث'
                      : 'Last update'}
                  </Text>

                  <Text
                    style={
                      styles.heroFooterValue
                    }
                  >
                    {formatTime(
                      busLocation?.updatedAt
                    )}
                  </Text>
                </View>

                <Pressable
                  onPress={
                    openTracking
                  }
                  style={
                    styles.trackButton
                  }
                >
                  <Ionicons
                    name="navigate"
                    size={18}
                    color="#0A2D44"
                  />

                  <Text
                    style={
                      styles.trackButtonText
                    }
                  >
                    {isRTL
                      ? 'فتح التتبع'
                      : 'Open tracking'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* PARENT REQUESTS */}
            <Pressable
              onPress={
                openRequests
              }
              style={({ pressed }) => [
                styles.requestsCard,
                {
                  opacity:
                    pressed
                      ? 0.9
                      : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.requestsTop,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <View
                  style={
                    styles.requestsMainIcon
                  }
                >
                  <Ionicons
                    name="document-text-outline"
                    size={27}
                    color="#0A2D44"
                  />
                </View>

                <View
                  style={
                    styles.requestsTextBox
                  }
                >
                  <Text
                    style={[
                      styles.requestsEyebrow,
                      {
                        textAlign,
                      },
                    ]}
                  >
                    {isRTL
                      ? 'مركز الطلبات'
                      : 'REQUEST CENTER'}
                  </Text>

                  <Text
                    style={[
                      styles.requestsTitle,
                      {
                        textAlign,
                      },
                    ]}
                  >
                    {isRTL
                      ? 'طلبات ولي الأمر'
                      : 'Parent Requests'}
                  </Text>

                  <Text
                    style={[
                      styles.requestsSubtitle,
                      {
                        textAlign,
                      },
                    ]}
                  >
                    {isRTL
                      ? 'الغياب، الإجازات وطلبات النقل والمدرسة'
                      : 'Absence, leave, transport and school requests'}
                  </Text>
                </View>

                <View
                  style={
                    styles.requestsArrow
                  }
                >
                  <Ionicons
                    name={
                      isRTL
                        ? 'chevron-back'
                        : 'chevron-forward'
                    }
                    size={22}
                    color="#FFFFFF"
                  />
                </View>
              </View>

              <View
                style={
                  styles.requestsDivider
                }
              />

              <View
                style={[
                  styles.requestFeatureRow,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <RequestFeature
                  icon="calendar-outline"
                  text={
                    isRTL
                      ? 'غياب وإجازة'
                      : 'Leave'
                  }
                />

                <RequestFeature
                  icon="bus-outline"
                  text={
                    isRTL
                      ? 'طلبات الباص'
                      : 'Bus'
                  }
                />

                <RequestFeature
                  icon="school-outline"
                  text={
                    isRTL
                      ? 'طلبات المدرسة'
                      : 'School'
                  }
                />
              </View>

              <View
                style={[
                  styles.requestHint,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={15}
                  color="#F7B83A"
                />

                <Text
                  style={[
                    styles.requestHintText,
                    {
                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'يمكن تعديل آخر طلب خلال أول 24 ساعة ما لم تتم الموافقة عليه.'
                    : 'The latest request can be edited within the first 24 hours unless approved.'}
                </Text>
              </View>
            </Pressable>

            {/* CONTACT */}
            <View
              style={[
                styles.panel,
                {
                  backgroundColor:
                    theme.colors.surface,
                },
              ]}
            >
              <View
                style={[
                  styles.panelTitleRow,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <View
                  style={
                    styles.panelTitleIcon
                  }
                >
                  <Ionicons
                    name="call-outline"
                    size={18}
                    color="#2384C6"
                  />
                </View>

                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={[
                      styles.panelTitle,
                      {
                        color:
                          theme.colors.text,
                        textAlign,
                      },
                    ]}
                  >
                    {isRTL
                      ? 'تواصل مباشر'
                      : 'Direct Contact'}
                  </Text>

                  <Text
                    style={[
                      styles.panelSubtitle,
                      {
                        color:
                          theme.colors.textSecondary,
                        textAlign,
                      },
                    ]}
                  >
                    {isRTL
                      ? 'اتصل بالمدرسة أو المعلم أو السائق'
                      : 'Call the school, teacher, or driver'}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.contactRow,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <ContactButton
                  icon="school"
                  title={
                    isRTL
                      ? 'المدرسة'
                      : 'School'
                  }
                  subtitle={
                    currentSchoolName
                  }
                  available={
                    Boolean(
                      schoolPhone
                    )
                  }
                  accent="#1EB06B"
                  onPress={() =>
                    callNumber(
                      schoolPhone,
                      isRTL
                        ? 'المدرسة'
                        : 'school'
                    )
                  }
                />

                <ContactButton
                  icon="person"
                  title={
                    isRTL
                      ? 'المعلم'
                      : 'Teacher'
                  }
                  subtitle={
                    teacherName
                  }
                  available={
                    Boolean(
                      teacherPhone
                    )
                  }
                  accent="#2384C6"
                  onPress={() =>
                    callNumber(
                      teacherPhone,
                      isRTL
                        ? 'المعلم'
                        : 'teacher'
                    )
                  }
                />

                <ContactButton
                  icon="call"
                  title={
                    isRTL
                      ? 'السائق'
                      : 'Driver'
                  }
                  subtitle={
                    driverName
                  }
                  available={
                    Boolean(
                      driverPhone
                    )
                  }
                  accent="#F0A91D"
                  onPress={() =>
                    callNumber(
                      driverPhone,
                      isRTL
                        ? 'السائق'
                        : 'driver'
                    )
                  }
                />
              </View>
            </View>

            {/* PARENT INFO */}
            <View
              style={[
                styles.panel,
                {
                  backgroundColor:
                    theme.colors.surface,
                },
              ]}
            >
              <View
                style={[
                  styles.panelTitleRow,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <View
                  style={
                    styles.panelTitleIcon
                  }
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color="#2384C6"
                  />
                </View>

                <Text
                  style={[
                    styles.panelTitle,
                    {
                      color:
                        theme.colors.text,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'معلومات ولي الأمر'
                    : 'Parent Information'}
                </Text>
              </View>

              <DataRow
                icon="person-outline"
                label={
                  isRTL
                    ? 'الاسم'
                    : 'Name'
                }
                value={
                  guardianName
                }
              />

              <DataRow
                icon="call-outline"
                label={
                  isRTL
                    ? 'رقم الهاتف'
                    : 'Phone'
                }
                value={
                  parentPhone || '—'
                }
              />

              <DataRow
                icon="mail-outline"
                label={
                  isRTL
                    ? 'البريد الإلكتروني'
                    : 'Email'
                }
                value={
                  parentEmail || '—'
                }
              />
            </View>

            {/* STUDENT SUMMARY */}
            <View
              style={[
                styles.panel,
                {
                  backgroundColor:
                    theme.colors.surface,
                },
              ]}
            >
              <View
                style={[
                  styles.panelTitleRow,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <View
                  style={
                    styles.panelTitleIcon
                  }
                >
                  <Ionicons
                    name="reader-outline"
                    size={18}
                    color="#F0A91D"
                  />
                </View>

                <Text
                  style={[
                    styles.panelTitle,
                    {
                      color:
                        theme.colors.text,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'ملخص الطالب'
                    : 'Student Summary'}
                </Text>
              </View>

              <View
                style={[
                  styles.summaryGrid,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <SummaryTile
                  icon="bus-outline"
                  label={
                    isRTL
                      ? 'الباص'
                      : 'Bus'
                  }
                  value={
                    busNumber
                  }
                />

                <SummaryTile
                  icon="git-branch-outline"
                  label={
                    isRTL
                      ? 'المسار'
                      : 'Route'
                  }
                  value={
                    routeName
                  }
                />
              </View>

              <View
                style={[
                  styles.summaryGrid,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <SummaryTile
                  icon="card-outline"
                  label={
                    isRTL
                      ? 'لوحة الباص'
                      : 'Plate'
                  }
                  value={
                    plateNumber
                  }
                />

                <SummaryTile
                  icon="person-outline"
                  label={
                    isRTL
                      ? 'السائق'
                      : 'Driver'
                  }
                  value={
                    driverName
                  }
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  function RouteStop({
    icon,
    label,
  }: {
    icon: IconName;
    label: string;
  }) {
    return (
      <View
        style={
          styles.routeStop
        }
      >
        <View
          style={
            styles.routeStopIcon
          }
        >
          <Ionicons
            name={icon}
            size={18}
            color="#FFFFFF"
          />
        </View>

        <Text
          style={
            styles.routeStopLabel
          }
        >
          {label}
        </Text>
      </View>
    );
  }

  function RequestFeature({
    icon,
    text,
  }: {
    icon: IconName;
    text: string;
  }) {
    return (
      <View
        style={
          styles.requestFeature
        }
      >
        <View
          style={
            styles.requestFeatureIcon
          }
        >
          <Ionicons
            name={icon}
            size={17}
            color="#F7B83A"
          />
        </View>

        <Text
          style={
            styles.requestFeatureText
          }
        >
          {text}
        </Text>
      </View>
    );
  }

  function ContactButton({
    icon,
    title,
    subtitle,
    available,
    accent,
    onPress,
  }: {
    icon: IconName;
    title: string;
    subtitle: string;
    available: boolean;
    accent: string;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.contactButton,
          {
            backgroundColor:
              `${accent}10`,
            borderColor:
              `${accent}24`,
            opacity:
              pressed
                ? 0.75
                : available
                ? 1
                : 0.6,
          },
        ]}
      >
        <View
          style={[
            styles.contactIcon,
            {
              backgroundColor:
                '#FFFFFF',
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={20}
            color={accent}
          />
        </View>

        <Text
          style={[
            styles.contactTitle,
            {
              color:
                theme.colors.text,
            },
          ]}
        >
          {title}
        </Text>

        <Text
          numberOfLines={1}
          style={[
            styles.contactSubtitle,
            {
              color:
                theme.colors.textSecondary,
            },
          ]}
        >
          {available
            ? subtitle
            : isRTL
            ? 'لا يوجد رقم'
            : 'No phone'}
        </Text>
      </Pressable>
    );
  }

  function DataRow({
    icon,
    label,
    value,
  }: {
    icon: IconName;
    label: string;
    value: string;
  }) {
    return (
      <View
        style={[
          styles.dataRow,
          {
            flexDirection:
              direction,
            borderTopColor:
              theme.colors.border,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={17}
          color="#8395A7"
        />

        <Text
          style={[
            styles.dataLabel,
            {
              color:
                theme.colors.textSecondary,
            },
          ]}
        >
          {label}
        </Text>

        <Text
          numberOfLines={1}
          style={[
            styles.dataValue,
            {
              color:
                theme.colors.text,
              textAlign:
                isRTL
                  ? 'left'
                  : 'right',
            },
          ]}
        >
          {value}
        </Text>
      </View>
    );
  }

  function SummaryTile({
    icon,
    label,
    value,
  }: {
    icon: IconName;
    label: string;
    value: string;
  }) {
    return (
      <View
        style={[
          styles.summaryTile,
          {
            backgroundColor:
              theme.colors.surface2,
          },
        ]}
      >
        <View
          style={
            styles.summaryIcon
          }
        >
          <Ionicons
            name={icon}
            size={18}
            color="#F0A91D"
          />
        </View>

        <Text
          style={[
            styles.summaryLabel,
            {
              color:
                theme.colors.textSecondary,
            },
          ]}
        >
          {label}
        </Text>

        <Text
          numberOfLines={2}
          style={[
            styles.summaryValue,
            {
              color:
                theme.colors.text,
            },
          ]}
        >
          {value}
        </Text>
      </View>
    );
  }
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },

    container: {
      flex: 1,
    },

    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 34,
    },

    loadingScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    loadingLogo: {
      width: 68,
      height: 68,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0A2D44',
    },

    loadingText: {
      fontSize: 12,
      marginTop: 10,
      fontWeight: '700',
    },

    header: {
      alignItems: 'center',
      gap: 9,
      marginBottom: 18,
    },

    brandBox: {
      flex: 1,
      alignItems: 'center',
      minWidth: 0,
      gap: 7,
    },

    logoFrame: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(10,45,68,0.06)',
    },

    logoImage: {
      width: 34,
      height: 34,
    },

    brandName: {
      flexShrink: 1,
      fontSize: 13,
      fontWeight: '900',
    },

    headerProfile: {
      flex: 1.15,
      minWidth: 0,
    },

    welcome: {
      fontSize: 10,
      fontWeight: '700',
    },

    parentName: {
      marginTop: 1,
      fontSize: 19,
      fontWeight: '900',
    },

    parentRoleRow: {
      alignItems: 'center',
      marginTop: 2,
      gap: 4,
    },

    parentRole: {
      fontSize: 9,
      fontWeight: '700',
    },

    notificationButton: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },

    notificationDot: {
      position: 'absolute',
      top: 9,
      right: 10,
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#F05252',
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
    },

    errorCard: {
      minHeight: 50,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: '#C74444',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 13,
    },

    errorText: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },

    emptyCard: {
      borderRadius: 24,
      padding: 26,
      alignItems: 'center',
      marginTop: 16,
    },

    emptyTitle: {
      marginTop: 10,
      fontSize: 15,
      fontWeight: '900',
      textAlign: 'center',
    },

    sectionHeader: {
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },

    sectionTitleRow: {
      alignItems: 'center',
      gap: 7,
    },

    sectionTitle: {
      fontSize: 17,
      fontWeight: '900',
    },

    countBadge: {
      minWidth: 26,
      height: 26,
      paddingHorizontal: 7,
      borderRadius: 10,
      backgroundColor: 'rgba(247,184,58,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    countText: {
      color: '#D99A1D',
      fontWeight: '900',
      fontSize: 11,
    },

    childrenScroll: {
      flexGrow: 0,
      marginBottom: 12,
    },

    childrenRow: {
      gap: 8,
      paddingRight: 2,
    },

    childCard: {
      width: 176,
      minHeight: 61,
      borderRadius: 18,
      borderWidth: 1,
      padding: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    childAvatar: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },

    childAvatarText: {
      fontSize: 13,
      fontWeight: '900',
    },

    childName: {
      fontSize: 12,
      fontWeight: '900',
    },

    childMeta: {
      marginTop: 2,
      fontSize: 8,
      fontWeight: '600',
    },

    trackingHero: {
      borderRadius: 25,
      padding: 15,
      backgroundColor: '#0A314A',
      overflow: 'hidden',
      marginBottom: 10,
    },

    heroTop: {
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },

    heroCaption: {
      color: '#B7C7D2',
      fontSize: 9,
      fontWeight: '700',
    },

    heroStatus: {
      marginTop: 3,
      fontSize: 18,
      fontWeight: '900',
    },

    liveBadge: {
      minHeight: 32,
      paddingHorizontal: 10,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },

    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },

    liveBadgeText: {
      fontSize: 9,
      fontWeight: '900',
    },

    routeVisual: {
      marginTop: 18,
      minHeight: 78,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      position: 'relative',
    },

    routeLine: {
      position: 'absolute',
      left: 36,
      right: 36,
      top: 21,
      height: 3,
      borderRadius: 3,
      backgroundColor: '#F7B83A',
    },

    routeStop: {
      width: 68,
      alignItems: 'center',
      zIndex: 2,
    },

    routeStopIcon: {
      width: 42,
      height: 42,
      borderRadius: 15,
      backgroundColor: '#226E99',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: '#0A314A',
    },

    routeStopLabel: {
      color: '#FFFFFF',
      marginTop: 4,
      fontSize: 9,
      fontWeight: '800',
    },

    busStop: {
      minWidth: 74,
      alignItems: 'center',
      zIndex: 3,
    },

    busStopIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: '#F7B83A',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: '#0A314A',
    },

    busStopText: {
      color: '#FFFFFF',
      marginTop: 3,
      fontSize: 9,
      fontWeight: '900',
    },

    heroFooter: {
      marginTop: 11,
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },

    heroFooterLabel: {
      color: '#9FB4C1',
      fontSize: 8,
      fontWeight: '700',
    },

    heroFooterValue: {
      marginTop: 2,
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '900',
    },

    trackButton: {
      minHeight: 42,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: '#F7B83A',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },

    trackButtonText: {
      color: '#0A2D44',
      fontSize: 11,
      fontWeight: '900',
    },

    /* New unified Parent Requests card */
    requestsCard: {
      borderRadius: 24,
      padding: 15,
      marginBottom: 10,
      backgroundColor: '#0A314A',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
    },

    requestsTop: {
      alignItems: 'center',
      gap: 11,
    },

    requestsMainIcon: {
      width: 52,
      height: 52,
      borderRadius: 17,
      backgroundColor: '#F7B83A',
      alignItems: 'center',
      justifyContent: 'center',
    },

    requestsTextBox: {
      flex: 1,
      minWidth: 0,
    },

    requestsEyebrow: {
      color: '#F7B83A',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },

    requestsTitle: {
      marginTop: 2,
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '900',
    },

    requestsSubtitle: {
      marginTop: 3,
      color: '#B8CAD6',
      fontSize: 9,
      fontWeight: '700',
      lineHeight: 14,
    },

    requestsArrow: {
      width: 35,
      height: 35,
      borderRadius: 12,
      backgroundColor:
        'rgba(255,255,255,0.10)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    requestsDivider: {
      height:
        StyleSheet.hairlineWidth,
      backgroundColor:
        'rgba(255,255,255,0.13)',
      marginVertical: 13,
    },

    requestFeatureRow: {
      gap: 7,
    },

    requestFeature: {
      flex: 1,
      minHeight: 62,
      borderRadius: 15,
      backgroundColor:
        'rgba(255,255,255,0.07)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
      paddingVertical: 8,
    },

    requestFeatureIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor:
        'rgba(247,184,58,0.13)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    requestFeatureText: {
      marginTop: 4,
      color: '#FFFFFF',
      fontSize: 8,
      fontWeight: '800',
      textAlign: 'center',
    },

    requestHint: {
      marginTop: 11,
      minHeight: 35,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      alignItems: 'center',
      gap: 7,
      backgroundColor:
        'rgba(0,0,0,0.12)',
    },

    requestHintText: {
      flex: 1,
      color: '#C5D5DF',
      fontSize: 8,
      lineHeight: 12,
      fontWeight: '700',
    },

    panel: {
      borderRadius: 22,
      padding: 13,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.05,
      shadowRadius: 9,
      elevation: 2,
    },

    panelTitleRow: {
      alignItems: 'center',
      gap: 8,
      marginBottom: 9,
    },

    panelTitleIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: '#EEF6FC',
      alignItems: 'center',
      justifyContent: 'center',
    },

    panelTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '900',
    },

    panelSubtitle: {
      marginTop: 2,
      fontSize: 8,
      fontWeight: '600',
    },

    contactRow: {
      gap: 7,
    },

    contactButton: {
      flex: 1,
      minHeight: 91,
      borderRadius: 17,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 7,
    },

    contactIcon: {
      width: 36,
      height: 36,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },

    contactTitle: {
      marginTop: 5,
      fontSize: 10,
      fontWeight: '900',
    },

    contactSubtitle: {
      marginTop: 2,
      maxWidth: '100%',
      fontSize: 7.5,
      fontWeight: '600',
      textAlign: 'center',
    },

    dataRow: {
      minHeight: 43,
      alignItems: 'center',
      borderTopWidth:
        StyleSheet.hairlineWidth,
      gap: 7,
    },

    dataLabel: {
      width: 92,
      fontSize: 9,
      fontWeight: '700',
    },

    dataValue: {
      flex: 1,
      fontSize: 10,
      fontWeight: '800',
    },

    summaryGrid: {
      gap: 8,
      marginBottom: 8,
    },

    summaryTile: {
      flex: 1,
      minHeight: 82,
      borderRadius: 17,
      padding: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },

    summaryIcon: {
      width: 31,
      height: 31,
      borderRadius: 10,
      backgroundColor:
        'rgba(247,184,58,0.13)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    summaryLabel: {
      marginTop: 4,
      fontSize: 8,
      fontWeight: '700',
    },

    summaryValue: {
      marginTop: 2,
      fontSize: 10,
      fontWeight: '900',
      textAlign: 'center',
    },
  });