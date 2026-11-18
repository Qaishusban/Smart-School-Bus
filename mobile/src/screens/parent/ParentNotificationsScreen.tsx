import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Modal,
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
  getParentTrackingChildren,
} from '../../services/busService';

import {
  ParentNotificationItem,
  getParentNotificationsFeed,
  markAllParentNotificationsRead,
  markParentNotificationRead,
  subscribeParentNotifications,
} from '../../services/parentNotificationService';

type IconName =
  React.ComponentProps<
    typeof Ionicons
  >['name'];

type FilterType =
  | 'all'
  | 'trip'
  | 'student'
  | 'school';

function normalize(
  value?: string | null
) {
  return String(
    value ?? ''
  )
    .trim()
    .toLowerCase()
    .replace(
      /[\s-]+/g,
      '_'
    );
}

function notificationIcon(
  item:
    ParentNotificationItem
): IconName {
  if (
    item.source ===
    'broadcast'
  ) {
    return 'megaphone';
  }

  const type =
    normalize(
      item.type
    );

  if (
    [
      'trip_started',
      'trip_ended',
    ].includes(type)
  ) {
    return 'bus';
  }

  if (
    [
      'eta_10m',
      'eta_5m',
      'eta_10',
      'eta_5',
    ].includes(type)
  ) {
    return 'time';
  }

  if (
    [
      'arrived',
      'arrival',
      'arrived_home',
    ].includes(type)
  ) {
    return 'location';
  }

  if (
    [
      'picked',
      'picked_up',
      'pickup',
      'boarded',
      'on_bus',
    ].includes(type)
  ) {
    return 'person-add';
  }

  if (
    [
      'delivered',
      'dropoff',
      'dropped_off',
    ].includes(type)
  ) {
    return 'home';
  }

  if (
    [
      'absent',
      'not_boarded',
      'no_show',
      'did_not_ride',
    ].includes(type)
  ) {
    return 'close-circle';
  }

  if (
    type.includes(
      'incident'
    )
  ) {
    return 'warning';
  }

  return 'notifications';
}

function notificationColor(
  item:
    ParentNotificationItem
) {
  if (
    item.source ===
    'broadcast'
  ) {
    return '#7C3AED';
  }

  const type =
    normalize(
      item.type
    );

  if (
    [
      'picked',
      'picked_up',
      'pickup',
      'boarded',
      'on_bus',
      'delivered',
      'dropoff',
      'dropped_off',
    ].includes(type)
  ) {
    return '#16A66A';
  }

  if (
    [
      'arrived',
      'arrival',
      'arrived_home',
    ].includes(type)
  ) {
    return '#1976B9';
  }

  if (
    type.includes(
      'incident'
    ) ||
    [
      'absent',
      'not_boarded',
      'no_show',
      'did_not_ride',
    ].includes(type)
  ) {
    return '#D94A4A';
  }

  if (
    [
      'eta_10m',
      'eta_5m',
      'eta_10',
      'eta_5',
    ].includes(type)
  ) {
    return '#F29F05';
  }

  return '#607D8B';
}

function formatDate(
  value: string
) {
  try {
    return new Date(
      value
    ).toLocaleDateString(
      [],
      {
        year:
          'numeric',
        month:
          'short',
        day:
          'numeric',
      }
    );
  } catch {
    return '—';
  }
}

function formatTime(
  value: string
) {
  try {
    return new Date(
      value
    ).toLocaleTimeString(
      [],
      {
        hour:
          '2-digit',
        minute:
          '2-digit',
      }
    );
  } catch {
    return '—';
  }
}

function isToday(
  value: string
) {
  try {
    const date =
      new Date(value);

    const now =
      new Date();

    return (
      date.getFullYear() ===
        now.getFullYear() &&
      date.getMonth() ===
        now.getMonth() &&
      date.getDate() ===
        now.getDate()
    );
  } catch {
    return false;
  }
}

function isYesterday(
  value: string
) {
  try {
    const date =
      new Date(value);

    const yesterday =
      new Date();

    yesterday.setDate(
      yesterday.getDate() -
        1
    );

    return (
      date.getFullYear() ===
        yesterday.getFullYear() &&
      date.getMonth() ===
        yesterday.getMonth() &&
      date.getDate() ===
        yesterday.getDate()
    );
  } catch {
    return false;
  }
}

function groupLabel(
  value: string,
  isRTL: boolean
) {
  if (isToday(value)) {
    return isRTL
      ? 'اليوم'
      : 'Today';
  }

  if (
    isYesterday(value)
  ) {
    return isRTL
      ? 'أمس'
      : 'Yesterday';
  }

  return formatDate(
    value
  );
}

function getFilterForItem(
  item:
    ParentNotificationItem
): FilterType {
  if (
    item.source ===
    'broadcast'
  ) {
    return 'school';
  }

  const type =
    normalize(
      item.type
    );

  if (
    [
      'trip_started',
      'trip_ended',
      'eta_10',
      'eta_5',
      'eta_10m',
      'eta_5m',
      'arrived',
      'arrival',
    ].includes(type)
  ) {
    return 'trip';
  }

  if (
    [
      'picked',
      'picked_up',
      'pickup',
      'boarded',
      'on_bus',
      'delivered',
      'dropoff',
      'dropped_off',
      'absent',
      'not_boarded',
      'did_not_ride',
      'no_show',
    ].includes(type)
  ) {
    return 'student';
  }

  return 'all';
}

export default function ParentNotificationsScreen({
  navigation,
  route,
}: any) {
  const {
    user,
  } = useAuth();

  const {
    theme,
  } =
    useAppTheme();

  const {
    isRTL,
    direction,
    textAlign,
  } =
    useLanguage();

  const [
    notifications,
    setNotifications,
  ] =
    useState<
      ParentNotificationItem[]
    >([]);

  const [
    studentIds,
    setStudentIds,
  ] =
    useState<string[]>(
      []
    );

  const [
    schoolIds,
    setSchoolIds,
  ] =
    useState<string[]>(
      []
    );

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
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    selectedFilter,
    setSelectedFilter,
  ] =
    useState<FilterType>(
      'all'
    );

  const [
    selected,
    setSelected,
  ] =
    useState<
      ParentNotificationItem | null
    >(null);

  const pushedNotificationId =
    route?.params
      ?.notificationId
      ? String(
          route.params
            .notificationId
        )
      : null;

  const handledPushNotificationRef =
    useRef<
      string | null
    >(null);

  const load =
    useCallback(
      async (
        refresh = false
      ) => {
        if (!user?.id) {
          setLoading(false);

          setError(
            isRTL
              ? 'لم يتم العثور على حساب ولي الأمر.'
              : 'Parent account was not found.'
          );

          return;
        }

        if (refresh) {
          setRefreshing(
            true
          );
        } else {
          setLoading(true);
        }

        setError(null);

        try {
          const children =
            await getParentTrackingChildren(
              user.id
            );

          const nextStudentIds =
            Array.from(
              new Set(
                children
                  .map(
                    (item) =>
                      item.student
                        ?.id
                  )
                  .filter(
                    Boolean
                  )
              )
            ) as string[];

          const nextSchoolIds =
            Array.from(
              new Set(
                children
                  .map(
                    (item) =>
                      item.school
                        ?.id ??
                      item.student
                        ?.school_id
                  )
                  .filter(
                    Boolean
                  )
              )
            ) as string[];

          setStudentIds(
            nextStudentIds
          );

          setSchoolIds(
            nextSchoolIds
          );

          const feed =
            await getParentNotificationsFeed(
              {
                parentId:
                  user.id,

                studentIds:
                  nextStudentIds,

                schoolIds:
                  nextSchoolIds,
              }
            );

          setNotifications(
            feed
          );
        } catch (
          loadError: any
        ) {
          console.log(
            'ParentNotifications load error:',
            loadError
          );

          setError(
            loadError?.message ??
              (
                isRTL
                  ? 'تعذر تحميل الإشعارات.'
                  : 'Could not load notifications.'
              )
          );
        } finally {
          setLoading(false);
          setRefreshing(
            false
          );
        }
      },
      [
        user?.id,
        isRTL,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const stop =
      subscribeParentNotifications(
        user.id,
        studentIds,
        () => {
          void load(true);
        }
      );

    return stop;
  }, [
    user?.id,
    studentIds.join(
      '|'
    ),
    load,
  ]);

  const unreadCount =
    useMemo(
      () =>
        notifications.filter(
          (item) =>
            item.source ===
              'bus' &&
            !item.is_read
        ).length,
      [
        notifications,
      ]
    );

  const filtered =
    useMemo(
      () => {
        if (
          selectedFilter ===
          'all'
        ) {
          return notifications;
        }

        return notifications.filter(
          (item) =>
            getFilterForItem(
              item
            ) ===
            selectedFilter
        );
      },
      [
        notifications,
        selectedFilter,
      ]
    );

  const grouped =
    useMemo(
      () => {
        const groups =
          new Map<
            string,
            ParentNotificationItem[]
          >();

        for (
          const item of
          filtered
        ) {
          const key =
            groupLabel(
              item.created_at,
              isRTL
            );

          const current =
            groups.get(
              key
            ) ?? [];

          current.push(
            item
          );

          groups.set(
            key,
            current
          );
        }

        return Array.from(
          groups.entries()
        );
      },
      [
        filtered,
        isRTL,
      ]
    );

  const openNotification =
    useCallback(
      async (
        item:
          ParentNotificationItem
      ) => {
        setSelected(
          item
        );

        if (
          item.source ===
            'bus' &&
          !item.is_read
        ) {
          try {
            await markParentNotificationRead(
              item
            );

            setNotifications(
              (current) =>
                current.map(
                  (notification) =>
                    notification
                      .id ===
                    item.id
                      ? {
                          ...notification,
                          is_read:
                            true,
                        }
                      : notification
                )
            );

            setSelected(
              (current) =>
                current?.id ===
                item.id
                  ? {
                      ...current,
                      is_read:
                        true,
                    }
                  : current
            );
          } catch (
            readError
          ) {
            console.log(
              'mark read error:',
              readError
            );
          }
        }
      },
      []
    );

  /*
   * فتح الإشعار المحدد القادم من Push Notification.
   */
  useEffect(() => {
    if (
      !pushedNotificationId ||
      loading ||
      notifications.length ===
        0 ||
      handledPushNotificationRef
        .current ===
        pushedNotificationId
    ) {
      return;
    }

    const target =
      notifications.find(
        (item) =>
          String(
            item.id
          ) ===
          pushedNotificationId
      );

    if (!target) {
      return;
    }

    handledPushNotificationRef.current =
      pushedNotificationId;

    void openNotification(
      target
    );

    try {
      navigation?.setParams?.({
        notificationId:
          undefined,
      });
    } catch (
      navigationError
    ) {
      console.log(
        'clear parent notification param:',
        navigationError
      );
    }
  }, [
    loading,
    navigation,
    notifications,
    openNotification,
    pushedNotificationId,
  ]);

  useEffect(() => {
    if (
      !pushedNotificationId
    ) {
      handledPushNotificationRef.current =
        null;
    }
  }, [
    pushedNotificationId,
  ]);

  const markAllRead =
    async () => {
      try {
        await markAllParentNotificationsRead(
          notifications
        );

        setNotifications(
          (current) =>
            current.map(
              (item) =>
                item.source ===
                  'bus'
                  ? {
                      ...item,
                      is_read:
                        true,
                    }
                  : item
            )
        );

        setSelected(
          (current) =>
            current &&
            current.source ===
              'bus'
              ? {
                  ...current,
                  is_read:
                    true,
                }
              : current
        );
      } catch (
        markError
      ) {
        console.log(
          'mark all read error:',
          markError
        );
      }
    };

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
            styles.loadingIcon
          }
        >
          <Ionicons
            name="notifications"
            size={35}
            color="#FFFFFF"
          />
        </View>

        <ActivityIndicator
          size="large"
          color="#F7B83A"
          style={{
            marginTop: 18,
          }}
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
            ? 'جاري تحميل الإشعارات...'
            : 'Loading notifications...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={[
        'top',
      ]}
      style={[
        styles.safeArea,

        {
          backgroundColor:
            theme.colors
              .background,
        },
      ]}
    >
      <ScrollView
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
        contentContainerStyle={
          styles.content
        }
      >
        <View
          style={[
            styles.header,

            {
              flexDirection:
                direction,
            },
          ]}
        >
          <Pressable
            onPress={() =>
              navigation.goBack()
            }
            style={[
              styles.headerButton,

              {
                backgroundColor:
                  theme.colors
                    .surface,
              },
            ]}
          >
            <Ionicons
              name={
                isRTL
                  ? 'arrow-forward'
                  : 'arrow-back'
              }
              size={24}
              color={
                theme.colors
                  .text
              }
            />
          </Pressable>

          <View
            style={
              styles.headerText
            }
          >
            <Text
              style={[
                styles.title,

                {
                  color:
                    theme.colors
                      .text,

                  textAlign,
                },
              ]}
            >
              {isRTL
                ? 'الإشعارات'
                : 'Notifications'}
            </Text>

            <Text
              style={[
                styles.subtitle,

                {
                  color:
                    theme.colors
                      .textSecondary,

                  textAlign,
                },
              ]}
            >
              {unreadCount >
              0
                ? isRTL
                  ? `${unreadCount} غير مقروء`
                  : `${unreadCount} unread`
                : isRTL
                ? 'كل الإشعارات مقروءة'
                : 'All caught up'}
            </Text>
          </View>

          <Pressable
            disabled={
              unreadCount ===
              0
            }
            onPress={() =>
              void markAllRead()
            }
            style={[
              styles.headerButton,

              {
                backgroundColor:
                  theme.colors
                    .surface,

                opacity:
                  unreadCount >
                  0
                    ? 1
                    : 0.45,
              },
            ]}
          >
            <Ionicons
              name="checkmark-done"
              size={24}
              color="#F7B83A"
            />
          </Pressable>
        </View>

        {!!error && (
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
              {error}
            </Text>

            <Pressable
              onPress={() =>
                void load(true)
              }
            >
              <Ionicons
                name="refresh"
                size={22}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        )}

        <View
          style={[
            styles.summaryCard,

            {
              backgroundColor:
                '#0A2D44',
            },
          ]}
        >
          <View
            style={[
              styles.summaryIcon,

              {
                backgroundColor:
                  'rgba(247,184,58,0.16)',
              },
            ]}
          >
            <Ionicons
              name="notifications"
              size={29}
              color="#F7B83A"
            />
          </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.summaryTitle
              }
            >
              {isRTL
                ? 'آخر التنبيهات'
                : 'Latest Alerts'}
            </Text>

            <Text
              style={
                styles.summarySub
              }
            >
              {isRTL
                ? `${notifications.length} إشعار وتنبيه`
                : `${notifications.length} notifications`}
            </Text>
          </View>

          {unreadCount >
            0 && (
            <View
              style={
                styles.unreadBadge
              }
            >
              <Text
                style={
                  styles.unreadBadgeText
                }
              >
                {unreadCount >
                99
                  ? '99+'
                  : unreadCount}
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.filters
          }
        >
          <FilterChip
            value="all"
            icon="apps-outline"
            label={
              isRTL
                ? 'الكل'
                : 'All'
            }
          />

          <FilterChip
            value="trip"
            icon="bus-outline"
            label={
              isRTL
                ? 'الرحلة'
                : 'Trip'
            }
          />

          <FilterChip
            value="student"
            icon="person-outline"
            label={
              isRTL
                ? 'الطلاب'
                : 'Students'
            }
          />

          <FilterChip
            value="school"
            icon="school-outline"
            label={
              isRTL
                ? 'المدرسة'
                : 'School'
            }
          />
        </ScrollView>

        {filtered.length ===
        0 ? (
          <View
            style={[
              styles.emptyCard,

              {
                backgroundColor:
                  theme.colors
                    .surface,
              },
            ]}
          >
            <View
              style={
                styles.emptyIcon
              }
            >
              <Ionicons
                name="notifications-off-outline"
                size={34}
                color="#F7B83A"
              />
            </View>

            <Text
              style={[
                styles.emptyTitle,

                {
                  color:
                    theme.colors
                      .text,
                },
              ]}
            >
              {isRTL
                ? 'لا توجد إشعارات'
                : 'No Notifications'}
            </Text>

            <Text
              style={[
                styles.emptyText,

                {
                  color:
                    theme.colors
                      .textSecondary,
                },
              ]}
            >
              {isRTL
                ? 'ستظهر هنا إشعارات الرحلات وحالة الطلاب وإعلانات المدرسة.'
                : 'Trip alerts, student updates and school announcements will appear here.'}
            </Text>
          </View>
        ) : (
          grouped.map(
            ([
              label,
              items,
            ]) => (
              <View
                key={label}
                style={
                  styles.group
                }
              >
                <Text
                  style={[
                    styles.groupTitle,

                    {
                      color:
                        theme.colors
                          .textSecondary,

                      textAlign,
                    },
                  ]}
                >
                  {label}
                </Text>

                {items.map(
                  (item) => {
                    const color =
                      notificationColor(
                        item
                      );

                    return (
                      <Pressable
                        key={`${item.source}-${item.id}`}
                        onPress={() =>
                          void openNotification(
                            item
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.notificationCard,

                          {
                            backgroundColor:
                              theme
                                .colors
                                .surface,

                            borderColor:
                              !item.is_read &&
                              item.source ===
                                'bus'
                                ? color
                                : theme
                                    .colors
                                    .border,

                            opacity:
                              pressed
                                ? 0.82
                                : 1,

                            flexDirection:
                              direction,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.notificationIcon,

                            {
                              backgroundColor:
                                `${color}16`,
                            },
                          ]}
                        >
                          <Ionicons
                            name={notificationIcon(
                              item
                            )}
                            size={24}
                            color={
                              color
                            }
                          />
                        </View>

                        <View
                          style={
                            styles.notificationContent
                          }
                        >
                          <View
                            style={[
                              styles.notificationTitleRow,

                              {
                                flexDirection:
                                  direction,
                              },
                            ]}
                          >
                            <Text
                              numberOfLines={
                                1
                              }
                              style={[
                                styles.notificationTitle,

                                {
                                  color:
                                    theme
                                      .colors
                                      .text,

                                  textAlign,
                                },
                              ]}
                            >
                              {item.title}
                            </Text>

                            {!item.is_read &&
                              item.source ===
                                'bus' && (
                                <View
                                  style={[
                                    styles.unreadDot,

                                    {
                                      backgroundColor:
                                        color,
                                    },
                                  ]}
                                />
                              )}
                          </View>

                          <Text
                            numberOfLines={
                              2
                            }
                            style={[
                              styles.notificationBody,

                              {
                                color:
                                  theme
                                    .colors
                                    .textSecondary,

                                textAlign,
                              },
                            ]}
                          >
                            {item.body ||
                              (
                                isRTL
                                  ? 'لا توجد تفاصيل إضافية.'
                                  : 'No additional details.'
                              )}
                          </Text>

                          <View
                            style={[
                              styles.metaRow,

                              {
                                flexDirection:
                                  direction,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.metaText,

                                {
                                  color:
                                    theme
                                      .colors
                                      .textSecondary,
                                },
                              ]}
                            >
                              {formatTime(
                                item.created_at
                              )}
                            </Text>

                            <View
                              style={
                                styles.metaDot
                              }
                            />

                            <Text
                              style={[
                                styles.metaText,

                                {
                                  color,
                                },
                              ]}
                            >
                              {item.source ===
                              'broadcast'
                                ? isRTL
                                  ? 'إعلان المدرسة'
                                  : 'School'
                                : isRTL
                                ? 'تنبيه الباص'
                                : 'Bus Alert'}
                            </Text>
                          </View>
                        </View>

                        <Ionicons
                          name={
                            isRTL
                              ? 'chevron-back'
                              : 'chevron-forward'
                          }
                          size={19}
                          color={
                            theme.colors
                              .textSecondary
                          }
                        />
                      </Pressable>
                    );
                  }
                )}
              </View>
            )
          )
        )}

        <View
          style={{
            height: 25,
          }}
        />
      </ScrollView>

      <Modal
        visible={
          Boolean(
            selected
          )
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setSelected(null)
        }
      >
        <View
          style={
            styles.modalBackdrop
          }
        >
          <Pressable
            style={
              StyleSheet
                .absoluteFill
            }
            onPress={() =>
              setSelected(null)
            }
          />

          {selected && (
            <View
              style={[
                styles.sheet,

                {
                  backgroundColor:
                    theme.colors
                      .surface,
                },
              ]}
            >
              <View
                style={
                  styles.handle
                }
              />

              <View
                style={[
                  styles.sheetHeader,

                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <View
                  style={[
                    styles.sheetIcon,

                    {
                      backgroundColor:
                        `${notificationColor(
                          selected
                        )}16`,
                    },
                  ]}
                >
                  <Ionicons
                    name={notificationIcon(
                      selected
                    )}
                    size={27}
                    color={notificationColor(
                      selected
                    )}
                  />
                </View>

                <View
                  style={{
                    flex: 1,
                    marginHorizontal:
                      10,
                  }}
                >
                  <Text
                    style={[
                      styles.sheetTitle,

                      {
                        color:
                          theme.colors
                            .text,

                        textAlign,
                      },
                    ]}
                  >
                    {selected.title}
                  </Text>

                  <Text
                    style={[
                      styles.sheetTime,

                      {
                        color:
                          theme.colors
                            .textSecondary,

                        textAlign,
                      },
                    ]}
                  >
                    {formatDate(
                      selected
                        .created_at
                    )}{' '}
                    •{' '}
                    {formatTime(
                      selected
                        .created_at
                    )}
                  </Text>
                </View>

                <Pressable
                  style={[
                    styles.closeButton,

                    {
                      backgroundColor:
                        theme.colors
                          .surface2,
                    },
                  ]}
                  onPress={() =>
                    setSelected(
                      null
                    )
                  }
                >
                  <Ionicons
                    name="close"
                    size={23}
                    color={
                      theme.colors
                        .text
                    }
                  />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={
                  false
                }
              >
                <Text
                  style={[
                    styles.sheetBody,

                    {
                      color:
                        theme.colors
                          .text,

                      textAlign,
                    },
                  ]}
                >
                  {selected.body ||
                    (
                      isRTL
                        ? 'لا توجد تفاصيل إضافية لهذا الإشعار.'
                        : 'No additional details for this notification.'
                    )}
                </Text>

                <View
                  style={[
                    styles.detailInfo,

                    {
                      backgroundColor:
                        theme.colors
                          .surface2,
                    },
                  ]}
                >
                  <DetailRow
                    label={
                      isRTL
                        ? 'النوع'
                        : 'Type'
                    }
                    value={
                      selected.type
                    }
                  />

                  <DetailRow
                    label={
                      isRTL
                        ? 'المصدر'
                        : 'Source'
                    }
                    value={
                      selected.source ===
                      'broadcast'
                        ? isRTL
                          ? 'المدرسة'
                          : 'School Broadcast'
                        : isRTL
                        ? 'نظام الباص'
                        : 'Bus System'
                    }
                  />

                  {!!selected.student_id && (
                    <DetailRow
                      label={
                        isRTL
                          ? 'مرتبط بطالب'
                          : 'Student'
                      }
                      value={
                        isRTL
                          ? 'نعم'
                          : 'Yes'
                      }
                    />
                  )}

                  {!!selected.bus_id && (
                    <DetailRow
                      label={
                        isRTL
                          ? 'مرتبط بباص'
                          : 'Bus Related'
                      }
                      value={
                        isRTL
                          ? 'نعم'
                          : 'Yes'
                      }
                    />
                  )}
                </View>

                {!!selected.student_id && (
                  <Pressable
                    style={
                      styles.trackingButton
                    }
                    onPress={() => {
                      const studentId =
                        selected.student_id;

                      setSelected(null);

                      navigation.navigate(
                        'StudentTrack',
                        {
                          studentId,
                        }
                      );
                    }}
                  >
                    <Ionicons
                      name="navigate"
                      size={21}
                      color="#0A2D44"
                    />

                    <Text
                      style={
                        styles.trackingButtonText
                      }
                    >
                      {isRTL
                        ? 'فتح تتبع الطالب'
                        : 'Open Student Tracking'}
                    </Text>
                  </Pressable>
                )}

                <View
                  style={{
                    height: 28,
                  }}
                />
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );

  function FilterChip({
    value,
    icon,
    label,
  }: {
    value:
      FilterType;

    icon:
      IconName;

    label:
      string;
  }) {
    const active =
      value ===
      selectedFilter;

    return (
      <Pressable
        onPress={() =>
          setSelectedFilter(
            value
          )
        }
        style={[
          styles.filterChip,

          {
            backgroundColor:
              active
                ? '#F7B83A'
                : theme
                    .colors
                    .surface,

            borderColor:
              active
                ? '#F7B83A'
                : theme
                    .colors
                    .border,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={17}
          color={
            active
              ? '#0A2D44'
              : theme.colors
                  .textSecondary
          }
        />

        <Text
          style={[
            styles.filterText,

            {
              color:
                active
                  ? '#0A2D44'
                  : theme
                      .colors
                      .text,
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  function DetailRow({
    label,
    value,
  }: {
    label:
      string;

    value:
      string;
  }) {
    return (
      <View
        style={[
          styles.detailRow,

          {
            flexDirection:
              direction,
          },
        ]}
      >
        <Text
          style={[
            styles.detailLabel,

            {
              color:
                theme.colors
                  .textSecondary,
            },
          ]}
        >
          {label}
        </Text>

        <Text
          style={[
            styles.detailValue,

            {
              color:
                theme.colors
                  .text,
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

    content: {
      paddingHorizontal:
        16,
      paddingTop: 9,
      paddingBottom:
        25,
    },

    loading: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    loadingIcon: {
      width: 75,
      height: 75,
      borderRadius: 25,
      backgroundColor:
        '#0A2D44',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    loadingText: {
      marginTop: 10,
      fontSize: 12,
      fontWeight:
        '600',
    },

    header: {
      alignItems:
        'center',
      marginBottom: 15,
    },

    headerButton: {
      width: 50,
      height: 50,
      borderRadius: 17,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    headerText: {
      flex: 1,
      marginHorizontal:
        11,
    },

    title: {
      fontSize: 25,
      fontWeight:
        '900',
    },

    subtitle: {
      marginTop: 2,
      fontSize: 10,
      fontWeight:
        '600',
    },

    errorCard: {
      minHeight: 50,
      borderRadius: 16,
      paddingHorizontal:
        12,
      backgroundColor:
        '#C74444',
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
      marginBottom: 12,
    },

    errorText: {
      flex: 1,
      color:
        '#FFFFFF',
      fontSize: 11,
      fontWeight:
        '700',
    },

    summaryCard: {
      minHeight: 92,
      borderRadius: 24,
      padding: 14,
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 13,
    },

    summaryIcon: {
      width: 58,
      height: 58,
      borderRadius: 19,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    summaryTitle: {
      color:
        '#FFFFFF',
      fontSize: 16,
      fontWeight:
        '900',
    },

    summarySub: {
      color:
        '#B9CAD6',
      fontSize: 10,
      fontWeight:
        '600',
      marginTop: 3,
    },

    unreadBadge: {
      minWidth: 34,
      height: 34,
      borderRadius: 12,
      paddingHorizontal:
        7,
      backgroundColor:
        '#F7B83A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    unreadBadgeText: {
      color:
        '#0A2D44',
      fontWeight:
        '900',
      fontSize: 12,
    },

    filters: {
      gap: 8,
      paddingBottom: 14,
    },

    filterChip: {
      height: 39,
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal:
        12,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
    },

    filterText: {
      fontSize: 11,
      fontWeight:
        '800',
    },

    group: {
      marginBottom: 13,
    },

    groupTitle: {
      marginBottom: 7,
      fontSize: 11,
      fontWeight:
        '800',
    },

    notificationCard: {
      minHeight: 92,
      borderRadius: 21,
      borderWidth: 1,
      padding: 12,
      alignItems:
        'center',
      marginBottom: 8,

      shadowColor:
        '#000',

      shadowOffset: {
        width: 0,
        height: 3,
      },

      shadowOpacity:
        0.06,

      shadowRadius:
        8,

      elevation:
        3,
    },

    notificationIcon: {
      width: 51,
      height: 51,
      borderRadius: 17,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    notificationContent: {
      flex: 1,
      marginHorizontal:
        10,
    },

    notificationTitleRow: {
      alignItems:
        'center',
    },

    notificationTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight:
        '900',
    },

    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginHorizontal:
        5,
    },

    notificationBody: {
      fontSize: 10,
      lineHeight: 16,
      marginTop: 4,
      fontWeight:
        '500',
    },

    metaRow: {
      alignItems:
        'center',
      marginTop: 7,
    },

    metaText: {
      fontSize: 8,
      fontWeight:
        '700',
    },

    metaDot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor:
        '#95A5A6',
      marginHorizontal:
        6,
    },

    emptyCard: {
      marginTop: 15,
      padding: 28,
      borderRadius: 24,
      alignItems:
        'center',
    },

    emptyIcon: {
      width: 66,
      height: 66,
      borderRadius: 22,
      backgroundColor:
        'rgba(247,184,58,0.13)',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    emptyTitle: {
      marginTop: 13,
      fontSize: 17,
      fontWeight:
        '900',
    },

    emptyText: {
      marginTop: 6,
      fontSize: 11,
      lineHeight: 18,
      textAlign:
        'center',
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.44)',
      justifyContent:
        'flex-end',
    },

    sheet: {
      maxHeight:
        '68%',
      borderTopLeftRadius:
        30,
      borderTopRightRadius:
        30,
      paddingHorizontal:
        17,
      paddingTop: 9,
    },

    handle: {
      width: 50,
      height: 5,
      borderRadius: 3,
      backgroundColor:
        '#8FA1AF',
      opacity: 0.6,
      alignSelf:
        'center',
      marginBottom: 12,
    },

    sheetHeader: {
      alignItems:
        'center',
      marginBottom: 14,
    },

    sheetIcon: {
      width: 53,
      height: 53,
      borderRadius: 18,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    sheetTitle: {
      fontSize: 18,
      fontWeight:
        '900',
    },

    sheetTime: {
      fontSize: 9,
      marginTop: 3,
    },

    closeButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    sheetBody: {
      fontSize: 14,
      lineHeight: 23,
      fontWeight:
        '600',
      marginBottom: 13,
    },

    detailInfo: {
      borderRadius: 18,
      paddingHorizontal:
        12,
      paddingVertical:
        5,
    },

    detailRow: {
      minHeight: 43,
      alignItems:
        'center',
      borderBottomWidth:
        StyleSheet
          .hairlineWidth,
      borderBottomColor:
        'rgba(120,130,140,0.25)',
    },

    detailLabel: {
      flex: 1,
      fontSize: 9,
      fontWeight:
        '600',
    },

    detailValue: {
      maxWidth:
        '58%',
      fontSize: 11,
      fontWeight:
        '800',
    },

    trackingButton: {
      marginTop: 12,
      height: 49,
      borderRadius: 16,
      backgroundColor:
        '#F7B83A',
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 7,
    },

    trackingButtonText: {
      color:
        '#0A2D44',
      fontSize: 13,
      fontWeight:
        '900',
    },
  });