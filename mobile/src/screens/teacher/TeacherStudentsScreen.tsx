import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  getTeacherStudents,
  rowName,
  TeacherStudentRow,
  TripPeriod,
} from '../../services/teacherService';

import {
  callPhone,
  getParentContactsMap,
  ParentContact,
  statusLabel,
} from '../../services/teacherSupervisorService';

type FilterKey =
  | 'all'
  | 'boarded'
  | 'arrived'
  | 'delivered'
  | 'absent'
  | 'unmarked';

function normalizedStatus(
  item: TeacherStudentRow
): FilterKey {
  const status = String(
    item.attendance?.status ?? ''
  )
    .trim()
    .toLowerCase();

  if (status === 'boarded') {
    return 'boarded';
  }

  if (status === 'arrived') {
    return 'arrived';
  }

  if (status === 'delivered') {
    return 'delivered';
  }

  if (status === 'absent') {
    return 'absent';
  }

  return 'unmarked';
}

function formatBirthDate(
  value: unknown,
  isRTL: boolean
) {
  if (!value) return '—';

  const text = String(value);

  const d = new Date(text);

  if (Number.isNaN(d.getTime())) {
    return text;
  }

  return d.toLocaleDateString(
    isRTL ? 'ar-JO' : 'en-US',
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  );
}

export default function TeacherStudentsScreen() {
  const { user } = useAuth();

  const { theme } =
    useAppTheme();

  const {
    isRTL,
    direction,
    textAlign,
  } = useLanguage();

  const [rows, setRows] =
    useState<TeacherStudentRow[]>([]);

  const [
    contacts,
    setContacts,
  ] = useState<
    Record<string, ParentContact[]>
  >({});

  const [period, setPeriod] =
    useState<TripPeriod>(
      new Date().getHours() < 12
        ? 'morning'
        : 'afternoon'
    );

  const [filter, setFilter] =
    useState<FilterKey>('all');

  const [search, setSearch] =
    useState('');

  const [
    filterOpen,
    setFilterOpen,
  ] = useState(false);

  const [
    parentsOpen,
    setParentsOpen,
  ] = useState(false);

  const [
    selectedStudentId,
    setSelectedStudentId,
  ] = useState<string | null>(
    null
  );

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (!user?.id) return;

      refresh
        ? setRefreshing(true)
        : setLoading(true);

      try {
        const data =
          await getTeacherStudents({
            teacherId: user.id,
            username:
              user.username ?? null,
            schoolId:
              user.school_id ?? null,
            period,
          });

        setRows(data);

        const ids = data.map(
          (item) =>
            String(item.student.id)
        );

        try {
          const map =
            await getParentContactsMap(
              ids
            );

          setContacts(map);
        } catch (error) {
          console.warn(
            'Teacher parent contacts:',
            error
          );

          setContacts({});
        }
      } catch (error: any) {
        Alert.alert(
          isRTL
            ? 'تعذر تحميل الطلاب'
            : 'Unable to Load Students',
          error?.message ??
            String(error)
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      user?.id,
      user?.username,
      user?.school_id,
      period,
      isRTL,
    ]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const term = search
      .trim()
      .toLowerCase();

    return rows.filter(
      (item) => {
        if (
          filter !== 'all' &&
          normalizedStatus(item) !==
            filter
        ) {
          return false;
        }

        if (!term) {
          return true;
        }

        const student =
          item.student;

        const studentContacts =
          contacts[
            String(student.id)
          ] ?? [];

        const haystack = [
          rowName(student),
          student.grade_name,
          student.grade,
          student.section_name,
          student.section,
          student.class_name,
          student.parent_phone,
          student.birth_date,
          ...studentContacts.flatMap(
            (contact) => [
              contact.name,
              contact.relation,
              contact.phone,
            ]
          ),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(
          term
        );
      }
    );
  }, [
    rows,
    search,
    filter,
    contacts,
  ]);

  const counts = useMemo(() => {
    const result: Record<
      FilterKey,
      number
    > = {
      all: rows.length,
      boarded: 0,
      arrived: 0,
      delivered: 0,
      absent: 0,
      unmarked: 0,
    };

    rows.forEach((item) => {
      result[
        normalizedStatus(item)
      ] += 1;
    });

    return result;
  }, [rows]);

  const selectedContacts =
    useMemo(() => {
      if (!selectedStudentId) {
        return [];
      }

      return (
        contacts[
          selectedStudentId
        ] ?? []
      );
    }, [
      contacts,
      selectedStudentId,
    ]);

  async function callContact(
    phone: string
  ) {
    try {
      await callPhone(phone);
    } catch (error: any) {
      Alert.alert(
        isRTL
          ? 'تعذر الاتصال'
          : 'Unable to Call',
        error?.message ??
          String(error)
      );
    }
  }

  function openParentNumbers(
    studentId: string
  ) {
    const list =
      contacts[studentId] ?? [];

    if (!list.length) {
      Alert.alert(
        isRTL
          ? 'لا توجد أرقام'
          : 'No Phone Numbers',
        isRTL
          ? 'لا يوجد رقم ولي أمر محفوظ لهذا الطالب.'
          : 'No parent phone number is saved for this student.'
      );

      return;
    }

    if (list.length === 1) {
      void callContact(
        list[0].phone
      );

      return;
    }

    setSelectedStudentId(
      studentId
    );

    setParentsOpen(true);
  }

  if (loading) {
    return (
      <View
        style={[
          styles.loading,
          {
            backgroundColor:
              theme.colors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color="#F7B83A"
        />
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
            theme.colors.background,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor:
              theme.colors.surface,

            borderColor:
              theme.colors.border,

            flexDirection:
              direction,
          },
        ]}
      >
        <View
          style={styles.headerIcon}
        >
          <Ionicons
            name="people"
            size={23}
            color="#0A2D44"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.headerTitle,
              {
                color:
                  theme.colors.text,

                textAlign,
              },
            ]}
          >
            {isRTL
              ? 'طلاب المسار'
              : 'Route Students'}
          </Text>

          <Text
            style={[
              styles.headerSub,
              {
                color:
                  theme.colors
                    .textSecondary,

                textAlign,
              },
            ]}
          >
            {isRTL
              ? `${rows.length} طالب • بيانات الطالب وأولياء الأمور`
              : `${rows.length} students • Student and parent details`}
          </Text>
        </View>

        <Pressable
          onPress={() =>
            setFilterOpen(true)
          }
          style={
            styles.filterButton
          }
        >
          <Ionicons
            name="options-outline"
            size={20}
            color="#0A2D44"
          />
        </Pressable>
      </View>

      <View
        style={[
          styles.search,
          {
            backgroundColor:
              theme.colors.surface,

            borderColor:
              theme.colors.border,

            flexDirection:
              direction,
          },
        ]}
      >
        <Ionicons
          name="search"
          size={19}
          color="#8191A0"
        />

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={
            isRTL
              ? 'ابحث بالطالب أو الصف أو ولي الأمر...'
              : 'Search student, grade or parent...'
          }
          placeholderTextColor="#8191A0"
          style={[
            styles.searchInput,
            {
              color:
                theme.colors.text,

              textAlign,
            },
          ]}
        />

        {!!search && (
          <Pressable
            onPress={() =>
              setSearch('')
            }
          >
            <Ionicons
              name="close-circle"
              size={19}
              color="#8191A0"
            />
          </Pressable>
        )}
      </View>

      <View
        style={[
          styles.quickRow,
          {
            flexDirection: direction,
          },
        ]}
      >
        <View
          style={[
            styles.quickPill,
            {
              backgroundColor:
                theme.colors.surface,

              borderColor:
                theme.colors.border,
            },
          ]}
        >
          <Ionicons
            name={
              period === 'morning'
                ? 'sunny-outline'
                : 'moon-outline'
            }
            size={15}
            color="#F7B83A"
          />

          <Text
            style={[
              styles.quickText,
              {
                color:
                  theme.colors.text,
              },
            ]}
          >
            {period === 'morning'
              ? isRTL
                ? 'الفترة الصباحية'
                : 'Morning'
              : isRTL
              ? 'الفترة المسائية'
              : 'Afternoon'}
          </Text>
        </View>

        <View
          style={[
            styles.quickPill,
            {
              backgroundColor:
                theme.colors.surface,

              borderColor:
                theme.colors.border,
            },
          ]}
        >
          <Ionicons
            name="funnel-outline"
            size={15}
            color="#F7B83A"
          />

          <Text
            style={[
              styles.quickText,
              {
                color:
                  theme.colors.text,
              },
            ]}
          >
            {filter === 'all'
              ? isRTL
                ? 'الكل'
                : 'All'
              : `${counts[filter]}`}
          </Text>
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) =>
          String(item.student.id)
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#F7B83A"
            onRefresh={() =>
              void load(true)
            }
          />
        }
        contentContainerStyle={
          styles.list
        }
        showsVerticalScrollIndicator={
          false
        }
        renderItem={({
          item,
          index,
        }) => {
          const student =
            item.student;

          const studentId =
            String(student.id);

          const studentContacts =
            contacts[studentId] ??
            [];

          const grade = String(
            student.grade_name ??
              student.grade ??
              ''
          );

          const section = String(
            student.section_name ??
              student.section ??
              ''
          );

          const className = String(
            student.class_name ?? ''
          );

          const birthDate =
            formatBirthDate(
              student.birth_date,
              isRTL
            );

          const fallbackPhone =
            String(
              student.parent_phone ??
                ''
            ).trim();

          const allContacts =
            studentContacts.length
              ? studentContacts
              : fallbackPhone
              ? [
                  {
                    id: `fallback-${studentId}`,
                    name: isRTL
                      ? 'ولي الأمر'
                      : 'Parent',
                    relation: '',
                    phone:
                      fallbackPhone,
                  },
                ]
              : [];

          const uniqueParents =
            Array.from(
              new Map(
                allContacts.map(
                  (contact) => [
                    `${contact.name}-${contact.relation}`,
                    contact,
                  ]
                )
              ).values()
            );

          return (
            <View
              style={[
                styles.card,
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
                  styles.cardTop,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <View
                  style={
                    styles.orderBox
                  }
                >
                  <Text
                    style={
                      styles.orderText
                    }
                  >
                    {index + 1}
                  </Text>
                </View>

                <View
                  style={{ flex: 1 }}
                >
                  <Text
                    style={[
                      styles.studentName,
                      {
                        color:
                          theme.colors
                            .text,

                        textAlign,
                      },
                    ]}
                  >
                    {rowName(student)}
                  </Text>

                  <Text
                    style={[
                      styles.studentMeta,
                      {
                        color:
                          theme.colors
                            .textSecondary,

                        textAlign,
                      },
                    ]}
                  >
                    {[
                      grade,
                      section,
                      className,
                    ]
                      .filter(Boolean)
                      .join(' • ') ||
                      '—'}
                  </Text>
                </View>

                <Pressable
                  onPress={() =>
                    openParentNumbers(
                      studentId
                    )
                  }
                  style={[
                    styles.callButton,
                    {
                      opacity:
                        allContacts.length
                          ? 1
                          : 0.4,
                    },
                  ]}
                >
                  <Ionicons
                    name="call"
                    size={18}
                    color="#FFFFFF"
                  />
                </Pressable>
              </View>

              <View
                style={
                  styles.infoGrid
                }
              >
                <Info
                  icon="information-circle-outline"
                  label={
                    isRTL
                      ? 'الحالة'
                      : 'Status'
                  }
                  value={statusLabel(
                    item,
                    period,
                    isRTL
                  )}
                />

                <Info
                  icon="calendar-outline"
                  label={
                    isRTL
                      ? 'تاريخ الميلاد'
                      : 'Birth Date'
                  }
                  value={birthDate}
                />

                <Info
                  icon="time-outline"
                  label={
                    isRTL
                      ? 'وقت الاستلام'
                      : 'Pickup'
                  }
                  value={String(
                    item.routeStudent
                      .pickup_time ??
                      '—'
                  )}
                />

                <Info
                  icon="time-outline"
                  label={
                    isRTL
                      ? 'وقت التوصيل'
                      : 'Drop-off'
                  }
                  value={String(
                    item.routeStudent
                      .dropoff_time ??
                      '—'
                  )}
                />
              </View>

              <View
                style={[
                  styles.parentsSection,
                  {
                    backgroundColor:
                      theme.colors
                        .surface2,
                  },
                ]}
              >
                <View
                  style={[
                    styles.parentsTitleRow,
                    {
                      flexDirection:
                        direction,
                    },
                  ]}
                >
                  <View
                    style={
                      styles.parentIcon
                    }
                  >
                    <Ionicons
                      name="people-outline"
                      size={16}
                      color="#0A2D44"
                    />
                  </View>

                  <View
                    style={{ flex: 1 }}
                  >
                    <Text
                      style={[
                        styles.parentsTitle,
                        {
                          color:
                            theme.colors
                              .text,

                          textAlign,
                        },
                      ]}
                    >
                      {isRTL
                        ? 'أولياء الأمور'
                        : 'Parents'}
                    </Text>

                    <Text
                      style={[
                        styles.parentsCount,
                        {
                          color:
                            theme.colors
                              .textSecondary,

                          textAlign,
                        },
                      ]}
                    >
                      {isRTL
                        ? `${uniqueParents.length} ولي أمر • ${allContacts.length} رقم`
                        : `${uniqueParents.length} parents • ${allContacts.length} numbers`}
                    </Text>
                  </View>
                </View>

                {!allContacts.length ? (
                  <Text
                    style={[
                      styles.noParentText,
                      {
                        color:
                          theme.colors
                            .textSecondary,

                        textAlign,
                      },
                    ]}
                  >
                    {isRTL
                      ? 'لا توجد بيانات ولي أمر مرتبطة بهذا الطالب.'
                      : 'No parent information linked to this student.'}
                  </Text>
                ) : (
                  allContacts.map(
                    (contact) => (
                      <View
                        key={contact.id}
                        style={[
                          styles.parentRow,
                          {
                            flexDirection:
                              direction,

                            borderTopColor:
                              theme.colors
                                .border,
                          },
                        ]}
                      >
                        <View
                          style={{
                            flex: 1,
                          }}
                        >
                          <Text
                            style={[
                              styles.parentName,
                              {
                                color:
                                  theme.colors
                                    .text,

                                textAlign,
                              },
                            ]}
                          >
                            {contact.name ||
                              (isRTL
                                ? 'ولي الأمر'
                                : 'Parent')}
                          </Text>

                          <Text
                            style={[
                              styles.parentRelation,
                              {
                                color:
                                  theme.colors
                                    .textSecondary,

                                textAlign,
                              },
                            ]}
                          >
                            {[
                              contact.relation,
                              contact.phone,
                            ]
                              .filter(
                                Boolean
                              )
                              .join(
                                ' • '
                              )}
                          </Text>
                        </View>

                        <Pressable
                          onPress={() =>
                            void callContact(
                              contact.phone
                            )
                          }
                          style={
                            styles.miniCall
                          }
                        >
                          <Ionicons
                            name="call-outline"
                            size={16}
                            color="#FFFFFF"
                          />
                        </Pressable>
                      </View>
                    )
                  )
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View
            style={styles.empty}
          >
            <Ionicons
              name="people-outline"
              size={38}
              color="#98A2B3"
            />

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
                ? 'لا يوجد طلاب بهذه الفلاتر.'
                : 'No students match these filters.'}
            </Text>
          </View>
        }
      />

      {/* FILTERS */}
      <Modal
        transparent
        animationType="slide"
        visible={filterOpen}
        onRequestClose={() =>
          setFilterOpen(false)
        }
      >
        <View
          style={styles.backdrop}
        >
          <Pressable
            style={
              StyleSheet.absoluteFill
            }
            onPress={() =>
              setFilterOpen(false)
            }
          />

          <View
            style={[
              styles.sheet,
              {
                backgroundColor:
                  theme.colors.surface,
              },
            ]}
          >
            <View
              style={[
                styles.sheetHead,
                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <View
                style={
                  styles.sheetIcon
                }
              >
                <Ionicons
                  name="options"
                  size={20}
                  color="#0A2D44"
                />
              </View>

              <Text
                style={[
                  styles.sheetTitle,
                  {
                    flex: 1,
                    color:
                      theme.colors.text,

                    textAlign,
                  },
                ]}
              >
                {isRTL
                  ? 'فلاتر الطلاب'
                  : 'Student Filters'}
              </Text>

              <Pressable
                onPress={() =>
                  setFilterOpen(false)
                }
                style={[
                  styles.close,
                  {
                    backgroundColor:
                      theme.colors
                        .surface2,
                  },
                ]}
              >
                <Ionicons
                  name="close"
                  size={19}
                  color={
                    theme.colors.text
                  }
                />
              </Pressable>
            </View>

            <Text
              style={[
                styles.label,
                {
                  color:
                    theme.colors
                      .textSecondary,

                  textAlign,
                },
              ]}
            >
              {isRTL
                ? 'الفترة'
                : 'Period'}
            </Text>

            <View
              style={[
                styles.periodRow,
                {
                  flexDirection:
                    direction,

                  backgroundColor:
                    theme.colors
                      .surface2,
                },
              ]}
            >
              <Pressable
                onPress={() =>
                  setPeriod(
                    'morning'
                  )
                }
                style={[
                  styles.periodButton,

                  period ===
                    'morning' &&
                    styles.periodActive,
                ]}
              >
                <Ionicons
                  name="sunny-outline"
                  size={17}
                  color="#0A2D44"
                />

                <Text
                  style={
                    styles.periodText
                  }
                >
                  {isRTL
                    ? 'صباحية'
                    : 'Morning'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  setPeriod(
                    'afternoon'
                  )
                }
                style={[
                  styles.periodButton,

                  period ===
                    'afternoon' &&
                    styles.periodActive,
                ]}
              >
                <Ionicons
                  name="moon-outline"
                  size={17}
                  color="#0A2D44"
                />

                <Text
                  style={
                    styles.periodText
                  }
                >
                  {isRTL
                    ? 'مسائية'
                    : 'Afternoon'}
                </Text>
              </Pressable>
            </View>

            <Text
              style={[
                styles.label,
                {
                  color:
                    theme.colors
                      .textSecondary,

                  textAlign,
                },
              ]}
            >
              {isRTL
                ? 'الحالة'
                : 'Status'}
            </Text>

            {(
              [
                [
                  'all',
                  isRTL
                    ? 'الكل'
                    : 'All',
                  'apps-outline',
                ],
                [
                  'boarded',
                  isRTL
                    ? 'تم الاستلام'
                    : 'Boarded',
                  'bus-outline',
                ],
                [
                  'arrived',
                  isRTL
                    ? 'وصل المدرسة'
                    : 'Arrived',
                  'school-outline',
                ],
                [
                  'delivered',
                  isRTL
                    ? 'تم التوصيل'
                    : 'Delivered',
                  'home-outline',
                ],
                [
                  'absent',
                  isRTL
                    ? 'غائب'
                    : 'Absent',
                  'close-circle-outline',
                ],
                [
                  'unmarked',
                  isRTL
                    ? 'لم يسجل'
                    : 'Unmarked',
                  'ellipse-outline',
                ],
              ] as const
            ).map(
              ([
                key,
                label,
                icon,
              ]) => (
                <Pressable
                  key={key}
                  onPress={() =>
                    setFilter(key)
                  }
                  style={[
                    styles.filterRow,
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
                    style={
                      styles.filterIcon
                    }
                  >
                    <Ionicons
                      name={icon}
                      size={18}
                      color="#0A2D44"
                    />
                  </View>

                  <Text
                    style={[
                      styles.filterText,
                      {
                        flex: 1,

                        color:
                          theme.colors
                            .text,

                        textAlign,
                      },
                    ]}
                  >
                    {label}{' '}
                    ({counts[key]})
                  </Text>

                  <Ionicons
                    name={
                      filter === key
                        ? 'checkmark-circle'
                        : 'ellipse-outline'
                    }
                    size={22}
                    color={
                      filter === key
                        ? '#10A66A'
                        : '#98A2B3'
                    }
                  />
                </Pressable>
              )
            )}

            <Pressable
              onPress={() =>
                setFilterOpen(false)
              }
              style={styles.apply}
            >
              <Ionicons
                name="checkmark-done"
                size={19}
                color="#0A2D44"
              />

              <Text
                style={
                  styles.applyText
                }
              >
                {isRTL
                  ? 'تطبيق'
                  : 'Apply'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MULTIPLE PHONE NUMBERS */}
      <Modal
        transparent
        animationType="slide"
        visible={parentsOpen}
        onRequestClose={() =>
          setParentsOpen(false)
        }
      >
        <View
          style={styles.backdrop}
        >
          <Pressable
            style={
              StyleSheet.absoluteFill
            }
            onPress={() =>
              setParentsOpen(false)
            }
          />

          <View
            style={[
              styles.sheet,
              {
                backgroundColor:
                  theme.colors.surface,
              },
            ]}
          >
            <View
              style={[
                styles.sheetHead,
                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <View
                style={
                  styles.sheetIcon
                }
              >
                <Ionicons
                  name="call"
                  size={20}
                  color="#0A2D44"
                />
              </View>

              <Text
                style={[
                  styles.sheetTitle,
                  {
                    flex: 1,

                    color:
                      theme.colors.text,

                    textAlign,
                  },
                ]}
              >
                {isRTL
                  ? 'اختر رقم ولي الأمر'
                  : 'Choose Parent Number'}
              </Text>

              <Pressable
                onPress={() =>
                  setParentsOpen(false)
                }
                style={[
                  styles.close,
                  {
                    backgroundColor:
                      theme.colors
                        .surface2,
                  },
                ]}
              >
                <Ionicons
                  name="close"
                  size={19}
                  color={
                    theme.colors.text
                  }
                />
              </Pressable>
            </View>

            <ScrollView>
              {selectedContacts.map(
                (contact) => (
                  <Pressable
                    key={contact.id}
                    onPress={() => {
                      setParentsOpen(
                        false
                      );

                      setTimeout(() => {
                        void callContact(
                          contact.phone
                        );
                      }, 150);
                    }}
                    style={[
                      styles.contactChoice,
                      {
                        flexDirection:
                          direction,

                        borderColor:
                          theme.colors
                            .border,

                        backgroundColor:
                          theme.colors
                            .surface2,
                      },
                    ]}
                  >
                    <View
                      style={
                        styles.contactChoiceIcon
                      }
                    >
                      <Ionicons
                        name="person-outline"
                        size={18}
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
                          styles.contactChoiceName,
                          {
                            color:
                              theme.colors
                                .text,

                            textAlign,
                          },
                        ]}
                      >
                        {contact.name}
                      </Text>

                      <Text
                        style={[
                          styles.contactChoiceSub,
                          {
                            color:
                              theme.colors
                                .textSecondary,

                            textAlign,
                          },
                        ]}
                      >
                        {[
                          contact.relation,
                          contact.phone,
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.contactCall
                      }
                    >
                      <Ionicons
                        name="call"
                        size={17}
                        color="#FFFFFF"
                      />
                    </View>
                  </Pressable>
                )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  function Info({
    icon,
    label,
    value,
  }: {
    icon: React.ComponentProps<
      typeof Ionicons
    >['name'];

    label: string;
    value: string;
  }) {
    return (
      <View
        style={[
          styles.infoCell,
          {
            backgroundColor:
              theme.colors.surface2,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={14}
          color="#F7B83A"
        />

        <Text
          style={[
            styles.infoLabel,
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
          numberOfLines={2}
          style={[
            styles.infoValue,
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
    safe: {
      flex: 1,
    },

    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    header: {
      margin: 14,
      marginBottom: 8,
      minHeight: 86,
      borderWidth: 1,
      borderRadius: 23,
      padding: 12,
      alignItems: 'center',
      gap: 9,
    },

    headerIcon: {
      width: 50,
      height: 50,
      borderRadius: 16,
      backgroundColor: '#F7B83A',
      alignItems: 'center',
      justifyContent: 'center',
    },

    headerTitle: {
      fontSize: 18,
      fontWeight: '900',
    },

    headerSub: {
      marginTop: 3,
      fontSize: 8,
      fontWeight: '600',
    },

    filterButton: {
      width: 46,
      height: 46,
      borderRadius: 15,
      backgroundColor: '#F7B83A',
      alignItems: 'center',
      justifyContent: 'center',
    },

    search: {
      marginHorizontal: 14,
      minHeight: 52,
      borderWidth: 1,
      borderRadius: 17,
      paddingHorizontal: 10,
      alignItems: 'center',
      gap: 7,
    },

    searchInput: {
      flex: 1,
      height: 50,
      fontSize: 10.2,
      fontWeight: '700',
    },

    quickRow: {
      paddingHorizontal: 14,
      paddingTop: 9,
      gap: 7,
    },

    quickPill: {
      minHeight: 35,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },

    quickText: {
      fontSize: 8,
      fontWeight: '900',
    },

    list: {
      padding: 14,
      paddingBottom: 110,
    },

    card: {
      borderWidth: 1,
      borderRadius: 21,
      padding: 12,
      marginBottom: 10,
    },

    cardTop: {
      alignItems: 'center',
      gap: 9,
    },

    orderBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: '#0A2D44',
      alignItems: 'center',
      justifyContent: 'center',
    },

    orderText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900',
    },

    studentName: {
      fontSize: 12,
      fontWeight: '900',
    },

    studentMeta: {
      marginTop: 3,
      fontSize: 7.8,
      fontWeight: '600',
    },

    callButton: {
      width: 43,
      height: 43,
      borderRadius: 14,
      backgroundColor: '#10A66A',
      alignItems: 'center',
      justifyContent: 'center',
    },

    infoGrid: {
      marginTop: 11,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },

    infoCell: {
      width: '48.8%',
      minHeight: 69,
      borderRadius: 14,
      padding: 9,
    },

    infoLabel: {
      marginTop: 4,
      fontSize: 6.8,
      fontWeight: '700',
    },

    infoValue: {
      marginTop: 2,
      fontSize: 8.7,
      fontWeight: '900',
    },

    parentsSection: {
      marginTop: 10,
      borderRadius: 16,
      padding: 10,
    },

    parentsTitleRow: {
      alignItems: 'center',
      gap: 8,
    },

    parentIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: '#F7B83A',
      alignItems: 'center',
      justifyContent: 'center',
    },

    parentsTitle: {
      fontSize: 9.5,
      fontWeight: '900',
    },

    parentsCount: {
      marginTop: 2,
      fontSize: 7,
      fontWeight: '700',
    },

    parentRow: {
      minHeight: 52,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      marginTop: 8,
      paddingTop: 8,
      alignItems: 'center',
      gap: 8,
    },

    parentName: {
      fontSize: 9,
      fontWeight: '900',
    },

    parentRelation: {
      marginTop: 2,
      fontSize: 7.2,
      fontWeight: '600',
    },

    miniCall: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: '#10A66A',
      alignItems: 'center',
      justifyContent: 'center',
    },

    noParentText: {
      marginTop: 10,
      fontSize: 7.8,
      fontWeight: '700',
    },

    empty: {
      paddingTop: 70,
      alignItems: 'center',
    },

    emptyText: {
      marginTop: 8,
      fontSize: 9,
      fontWeight: '700',
    },

    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor:
        'rgba(5,20,32,0.48)',
    },

    sheet: {
      maxHeight: '88%',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 16,
      paddingBottom: 28,
    },

    sheetHead: {
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },

    sheetIcon: {
      width: 43,
      height: 43,
      borderRadius: 14,
      backgroundColor: '#F7B83A',
      alignItems: 'center',
      justifyContent: 'center',
    },

    sheetTitle: {
      fontSize: 14,
      fontWeight: '900',
    },

    close: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },

    label: {
      marginTop: 10,
      marginBottom: 6,
      fontSize: 8.5,
      fontWeight: '800',
    },

    periodRow: {
      minHeight: 46,
      borderRadius: 14,
      padding: 3,
    },

    periodButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: 11,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },

    periodActive: {
      backgroundColor: '#F7B83A',
    },

    periodText: {
      color: '#0A2D44',
      fontSize: 8.5,
      fontWeight: '900',
    },

    filterRow: {
      minHeight: 55,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      alignItems: 'center',
      gap: 8,
    },

    filterIcon: {
      width: 37,
      height: 37,
      borderRadius: 12,
      backgroundColor: '#FFF5D8',
      alignItems: 'center',
      justifyContent: 'center',
    },

    filterText: {
      fontSize: 9.3,
      fontWeight: '900',
    },

    apply: {
      marginTop: 14,
      minHeight: 48,
      borderRadius: 15,
      backgroundColor: '#F7B83A',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },

    applyText: {
      color: '#0A2D44',
      fontSize: 10,
      fontWeight: '900',
    },

    contactChoice: {
      minHeight: 70,
      borderWidth: 1,
      borderRadius: 16,
      padding: 10,
      marginBottom: 8,
      alignItems: 'center',
      gap: 8,
    },

    contactChoiceIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: '#F7B83A',
      alignItems: 'center',
      justifyContent: 'center',
    },

    contactChoiceName: {
      fontSize: 10,
      fontWeight: '900',
    },

    contactChoiceSub: {
      marginTop: 3,
      fontSize: 7.5,
      fontWeight: '600',
    },

    contactCall: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: '#10A66A',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });