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
  ScrollView,
  StyleSheet,
  Switch,
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
  getParentTrackingChildren,
  ParentTrackingChild,
} from '../../services/busService';

import {
  getParentDailyInstructions,
  saveDailyInstruction,
} from '../../services/parentRequestService';

type DailyStatus =
  | 'normal'
  | 'absent'
  | 'sick'
  | 'leave'
  | 'leave_holiday'
  | 'with_parent';

const STATUSES: {
  value: DailyStatus;
  icon: React.ComponentProps<
    typeof Ionicons
  >['name'];
  ar: string;
  en: string;
  color: string;
}[] = [
  {
    value: 'normal',
    icon: 'checkmark-circle-outline',
    ar: 'طبيعي',
    en: 'Normal',
    color: '#16A66A',
  },
  {
    value: 'absent',
    icon: 'close-circle-outline',
    ar: 'غائب',
    en: 'Absent',
    color: '#D94A4A',
  },
  {
    value: 'sick',
    icon: 'medkit-outline',
    ar: 'مريض',
    en: 'Sick',
    color: '#D55B74',
  },
  {
    value: 'leave',
    icon: 'calendar-outline',
    ar: 'إجازة',
    en: 'Leave',
    color: '#7C3AED',
  },
  {
    value: 'leave_holiday',
    icon: 'sunny-outline',
    ar: 'إجازة / عطلة',
    en: 'Holiday',
    color: '#E59A18',
  },
  {
    value: 'with_parent',
    icon: 'people-outline',
    ar: 'مع ولي الأمر',
    en: 'With Parent',
    color: '#1976B9',
  },
];

function localDateISO(
  offset = 0
) {
  const date =
    new Date();

  date.setDate(
    date.getDate() +
      offset
  );

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function studentName(
  child?:
    | ParentTrackingChild
    | null
) {
  return (
    child?.student?.full_name ??
    child?.student?.name ??
    'Student'
  );
}

export default function ParentDailyInstructionsScreen({
  navigation,
  route,
}: any) {
  const { user } =
    useAuth();

  const { theme } =
    useAppTheme();

  const {
    isRTL,
    direction,
    textAlign,
  } = useLanguage();

  const [children, setChildren] =
    useState<
      ParentTrackingChild[]
    >([]);

  const [
    selectedStudentId,
    setSelectedStudentId,
  ] = useState<
    string | null
  >(
    route?.params
      ?.studentId ??
      null
  );

  const [
    selectedStatus,
    setSelectedStatus,
  ] =
    useState<DailyStatus>(
      'normal'
    );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    localDateISO()
  );

  const [note, setNote] =
    useState('');

  const [
    notifyDriver,
    setNotifyDriver,
  ] = useState(true);

  const [
    existingRows,
    setExistingRows,
  ] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const selectedChild =
    useMemo(
      () =>
        children.find(
          (item) =>
            item.student
              ?.id ===
            selectedStudentId
        ) ??
        children[0] ??
        null,
      [
        children,
        selectedStudentId,
      ]
    );

  const existingForStudent =
    useMemo(
      () =>
        existingRows.find(
          (row) =>
            row.student_id ===
            selectedChild
              ?.student?.id
        ) ?? null,
      [
        existingRows,
        selectedChild,
      ]
    );

  const load =
    useCallback(
      async () => {
        if (!user?.id) {
          setLoading(false);
          return;
        }

        setLoading(true);

        try {
          const [
            childRows,
            instructions,
          ] =
            await Promise.all([
              getParentTrackingChildren(
                user.id
              ),

              getParentDailyInstructions(
                user.id
              ),
            ]);

          setChildren(
            childRows
          );

          setExistingRows(
            instructions
          );

          if (
            childRows.length
          ) {
            const requested =
              route?.params
                ?.studentId;

            const found =
              childRows.some(
                (item) =>
                  item.student
                    ?.id ===
                  requested
              );

            setSelectedStudentId(
              found
                ? requested
                : childRows[0]
                    ?.student
                    ?.id ??
                    null
            );
          }
        } catch (error: any) {
          console.log(
            'daily instructions load:',
            error
          );

          Alert.alert(
            isRTL
              ? 'تعذر التحميل'
              : 'Could not load',
            error?.message ??
              ''
          );
        } finally {
          setLoading(false);
        }
      },
      [
        user?.id,
        route?.params
          ?.studentId,
        isRTL,
      ]
    );

  useEffect(() => {
    load();
  }, [load]);

  /*
   * عند تغيير الطالب نقرأ آخر تعليماته.
   */
  useEffect(() => {
    if (
      !existingForStudent
    ) {
      setSelectedStatus(
        'normal'
      );

      setNote('');

      setNotifyDriver(true);

      return;
    }

    const value =
      String(
        existingForStudent
          .status ??
          'normal'
      ) as DailyStatus;

    if (
      STATUSES.some(
        (item) =>
          item.value ===
          value
      )
    ) {
      setSelectedStatus(
        value
      );
    }

    setNote(
      existingForStudent
        .note ??
        ''
    );

    setNotifyDriver(
      existingForStudent
        .notify_driver !==
        false
    );

    setSelectedDate(
      existingForStudent
        .instruction_date ??
        existingForStudent
          .for_date ??
        localDateISO()
    );
  }, [
    existingForStudent
      ?.id,
    selectedStudentId,
  ]);

  const save =
    async () => {
      if (
        !user?.id ||
        !selectedChild
          ?.student?.id
      ) {
        return;
      }

      setSaving(true);

      try {
        await saveDailyInstruction(
          {
            parentId: user.id,

            studentId:
              selectedChild
                .student.id,

            busId:
              selectedChild
                .bus?.id ??
              null,

            date:
              selectedDate,

            status:
              selectedStatus,

            note,

            notifyDriver,
          }
        );

        await load();

        Alert.alert(
          isRTL
            ? 'تم الحفظ'
            : 'Saved',
          isRTL
            ? 'تم إرسال تعليمات الطالب بنجاح.'
            : 'Student instructions were saved successfully.'
        );
      } catch (error: any) {
        console.log(
          'save instruction:',
          error
        );

        Alert.alert(
          isRTL
            ? 'تعذر الحفظ'
            : 'Could not save',
          error?.message ??
            ''
        );
      } finally {
        setSaving(false);
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
            theme.colors
              .background,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
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
              styles.iconButton,
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
            style={{
              flex: 1,
              marginHorizontal: 12,
            }}
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
                ? 'تعليمات اليوم'
                : 'Daily Instructions'}
            </Text>

            <Text
              style={[
                styles.sub,
                {
                  color:
                    theme.colors
                      .textSecondary,
                  textAlign,
                },
              ]}
            >
              {isRTL
                ? 'إبلاغ السائق والمدرسة بحالة الطالب'
                : 'Update the driver and school'}
            </Text>
          </View>
        </View>

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
          {isRTL
            ? 'الطالب'
            : 'Student'}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={{
            gap: 8,
          }}
        >
          {children.map(
            (child) => {
              const active =
                child.student
                  ?.id ===
                selectedChild
                  ?.student?.id;

              return (
                <Pressable
                  key={
                    child.student
                      ?.id
                  }
                  onPress={() =>
                    setSelectedStudentId(
                      child
                        .student
                        ?.id ??
                        null
                    )
                  }
                  style={[
                    styles.childChip,
                    {
                      backgroundColor:
                        active
                          ? '#F7B83A'
                          : theme
                              .colors
                              .surface,
                    },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={
                      active
                        ? '#FFFFFF'
                        : '#F7B83A'
                    }
                  />

                  <Text
                    style={{
                      color:
                        active
                          ? '#FFFFFF'
                          : theme
                              .colors
                              .text,
                      fontWeight:
                        '900',
                    }}
                  >
                    {studentName(
                      child
                    )}
                  </Text>
                </Pressable>
              );
            }
          )}
        </ScrollView>

        <View
          style={[
            styles.card,
            {
              backgroundColor:
                theme.colors
                  .surface,
            },
          ]}
        >
          <Text
            style={[
              styles.cardTitle,
              {
                color:
                  theme.colors
                    .text,
                textAlign,
              },
            ]}
          >
            {isRTL
              ? 'تاريخ التعليمات'
              : 'Instruction Date'}
          </Text>

          <View
            style={
              styles.dateRow
            }
          >
            <DateChip
              value={
                localDateISO()
              }
              label={
                isRTL
                  ? 'اليوم'
                  : 'Today'
              }
            />

            <DateChip
              value={
                localDateISO(1)
              }
              label={
                isRTL
                  ? 'غداً'
                  : 'Tomorrow'
              }
            />
          </View>

          <Text
            style={[
              styles.selectedDate,
              {
                color:
                  theme.colors
                    .textSecondary,
              },
            ]}
          >
            {selectedDate}
          </Text>
        </View>

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
          {isRTL
            ? 'حالة الطالب'
            : 'Student Status'}
        </Text>

        <View
          style={
            styles.statusGrid
          }
        >
          {STATUSES.map(
            (item) => {
              const active =
                item.value ===
                selectedStatus;

              return (
                <Pressable
                  key={
                    item.value
                  }
                  onPress={() =>
                    setSelectedStatus(
                      item.value
                    )
                  }
                  style={[
                    styles.statusCard,
                    {
                      backgroundColor:
                        active
                          ? `${item.color}18`
                          : theme
                              .colors
                              .surface,

                      borderColor:
                        active
                          ? item.color
                          : theme
                              .colors
                              .border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusIcon,
                      {
                        backgroundColor:
                          `${item.color}16`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        item.icon
                      }
                      size={25}
                      color={
                        item.color
                      }
                    />
                  </View>

                  <Text
                    style={{
                      color:
                        theme.colors
                          .text,
                      marginTop: 7,
                      fontSize: 11,
                      fontWeight:
                        '900',
                      textAlign:
                        'center',
                    }}
                  >
                    {isRTL
                      ? item.ar
                      : item.en}
                  </Text>

                  {active && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={
                        item.color
                      }
                      style={{
                        position:
                          'absolute',
                        top: 7,
                        right: 7,
                      }}
                    />
                  )}
                </Pressable>
              );
            }
          )}
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor:
                theme.colors
                  .surface,
            },
          ]}
        >
          <Text
            style={[
              styles.cardTitle,
              {
                color:
                  theme.colors
                    .text,
                textAlign,
              },
            ]}
          >
            {isRTL
              ? 'ملاحظة'
              : 'Note'}
          </Text>

          <TextInput
            multiline
            value={note}
            onChangeText={
              setNote
            }
            textAlign={
              isRTL
                ? 'right'
                : 'left'
            }
            placeholder={
              isRTL
                ? 'مثال: الطالب لن يستخدم الباص صباحاً...'
                : 'Example: Student will not use the morning bus...'
            }
            placeholderTextColor="#8C99A5"
            style={[
              styles.input,
              {
                color:
                  theme.colors
                    .text,
                backgroundColor:
                  theme.colors
                    .surface2,
              },
            ]}
          />

          <View
            style={[
              styles.switchRow,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <View
              style={
                styles.switchIcon
              }
            >
              <Ionicons
                name="notifications-outline"
                size={21}
                color="#F7B83A"
              />
            </View>

            <View
              style={{
                flex: 1,
                marginHorizontal: 9,
              }}
            >
              <Text
                style={{
                  color:
                    theme.colors
                      .text,
                  fontWeight:
                    '900',
                  textAlign,
                }}
              >
                {isRTL
                  ? 'إشعار السائق'
                  : 'Notify Driver'}
              </Text>

              <Text
                style={{
                  color:
                    theme.colors
                      .textSecondary,
                  fontSize: 9,
                  marginTop: 2,
                  textAlign,
                }}
              >
                {isRTL
                  ? 'إرسال الحالة للسائق المرتبط بالباص'
                  : 'Send the update to the assigned driver'}
              </Text>
            </View>

            <Switch
              value={
                notifyDriver
              }
              onValueChange={
                setNotifyDriver
              }
            />
          </View>

          <Pressable
            onPress={save}
            disabled={
              saving ||
              !selectedChild
            }
            style={[
              styles.saveButton,
              {
                opacity:
                  saving
                    ? 0.6
                    : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator
                color="#0A2D44"
              />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={21}
                  color="#0A2D44"
                />

                <Text
                  style={
                    styles.saveText
                  }
                >
                  {isRTL
                    ? existingForStudent
                      ? 'تحديث التعليمات'
                      : 'حفظ وإرسال'
                    : existingForStudent
                    ? 'Update Instructions'
                    : 'Save & Send'}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {existingForStudent && (
          <View
            style={[
              styles.previousCard,
              {
                backgroundColor:
                  '#0A2D44',
              },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color="#F7B83A"
            />

            <View
              style={{
                flex: 1,
                marginHorizontal: 10,
              }}
            >
              <Text
                style={
                  styles.previousTitle
                }
              >
                {isRTL
                  ? 'تعليمات محفوظة'
                  : 'Saved Instructions'}
              </Text>

              <Text
                style={
                  styles.previousText
                }
              >
                {isRTL
                  ? `السائق: ${
                      existingForStudent.is_seen_by_driver
                        ? 'تم الاطلاع'
                        : 'لم يطلع بعد'
                    } • المدرسة: ${
                      existingForStudent.is_seen_by_school
                        ? 'تم الاطلاع'
                        : 'لم تطلع بعد'
                    }`
                  : `Driver: ${
                      existingForStudent.is_seen_by_driver
                        ? 'Seen'
                        : 'Not seen'
                    } • School: ${
                      existingForStudent.is_seen_by_school
                        ? 'Seen'
                        : 'Not seen'
                    }`}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  function DateChip({
    value,
    label,
  }: {
    value: string;
    label: string;
  }) {
    const active =
      selectedDate ===
      value;

    return (
      <Pressable
        onPress={() =>
          setSelectedDate(
            value
          )
        }
        style={[
          styles.dateChip,
          {
            backgroundColor:
              active
                ? '#F7B83A'
                : theme
                    .colors
                    .surface2,
          },
        ]}
      >
        <Ionicons
          name="calendar-outline"
          size={19}
          color={
            active
              ? '#0A2D44'
              : '#F7B83A'
          }
        />

        <Text
          style={{
            color:
              active
                ? '#0A2D44'
                : theme
                    .colors
                    .text,
            fontWeight: '900',
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
}

const styles =
  StyleSheet.create({
    safe: {
      flex: 1,
    },

    content: {
      padding: 16,
      paddingBottom: 35,
    },

    loading: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
    },

    header: {
      alignItems: 'center',
      marginBottom: 18,
    },

    iconButton: {
      width: 50,
      height: 50,
      borderRadius: 17,
      justifyContent:
        'center',
      alignItems: 'center',
    },

    title: {
      fontSize: 24,
      fontWeight: '900',
    },

    sub: {
      marginTop: 2,
      fontSize: 10,
    },

    sectionTitle: {
      marginTop: 14,
      marginBottom: 9,
      fontSize: 16,
      fontWeight: '900',
    },

    childChip: {
      height: 45,
      borderRadius: 16,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },

    card: {
      marginTop: 15,
      borderRadius: 24,
      padding: 15,
    },

    cardTitle: {
      fontSize: 15,
      fontWeight: '900',
      marginBottom: 10,
    },

    dateRow: {
      flexDirection: 'row',
      gap: 8,
    },

    dateChip: {
      flex: 1,
      height: 47,
      borderRadius: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 7,
    },

    selectedDate: {
      textAlign: 'center',
      marginTop: 8,
      fontSize: 10,
      fontWeight: '700',
    },

    statusGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },

    statusCard: {
      width: '31%',
      minHeight: 105,
      borderWidth: 1,
      borderRadius: 20,
      padding: 10,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    statusIcon: {
      width: 47,
      height: 47,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    input: {
      minHeight: 105,
      borderRadius: 17,
      padding: 12,
      textAlignVertical:
        'top',
      fontSize: 12,
    },

    switchRow: {
      alignItems: 'center',
      marginTop: 14,
    },

    switchIcon: {
      width: 43,
      height: 43,
      borderRadius: 14,
      backgroundColor:
        'rgba(247,184,58,0.14)',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    saveButton: {
      height: 50,
      marginTop: 14,
      borderRadius: 17,
      backgroundColor:
        '#F7B83A',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 8,
    },

    saveText: {
      color: '#0A2D44',
      fontWeight: '900',
      fontSize: 13,
    },

    previousCard: {
      marginTop: 12,
      borderRadius: 21,
      minHeight: 70,
      padding: 13,
      flexDirection: 'row',
      alignItems: 'center',
    },

    previousTitle: {
      color: '#FFFFFF',
      fontWeight: '900',
      fontSize: 12,
    },

    previousText: {
      color: '#B9CBD7',
      marginTop: 4,
      fontSize: 9,
    },
  });