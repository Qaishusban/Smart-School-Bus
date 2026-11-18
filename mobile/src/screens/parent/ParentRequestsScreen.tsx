import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
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
  getParentTrackingChildren,
  ParentTrackingChild,
} from '../../services/busService';

import {
  canEditParentRequest,
  createParentRequest,
  getParentRequests,
  ParentRequestPeriod,
  ParentRequestType,
  parentRequestEditRemainingMs,
  updateParentRequest,
} from '../../services/parentRequestService';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type DateTarget =
  | 'from'
  | 'to'
  | null;

type HistoryTab =
  | 'current'
  | 'upcoming'
  | 'previous'
  | 'all';

type RequestOption = {
  value: ParentRequestType;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  ar: string;
  en: string;
  transportRelated?: boolean;
};

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const GOLD = '#F4B942';
const NAVY = '#0A2D44';

const REQUEST_TYPES: RequestOption[] = [
  {
    value: 'absence',
    icon: 'calendar-outline',
    ar: 'إجازة / غياب',
    en: 'Absence / Leave',
    transportRelated: true,
  },
  {
    value: 'no_bus',
    icon: 'bus-outline',
    ar: 'عدم استخدام الباص',
    en: 'No Bus',
    transportRelated: true,
  },
  {
    value: 'pickup_change',
    icon: 'location-outline',
    ar: 'تغيير الاستلام',
    en: 'Pickup Change',
    transportRelated: true,
  },
  {
    value: 'dropoff_change',
    icon: 'home-outline',
    ar: 'تغيير التوصيل',
    en: 'Drop-off Change',
    transportRelated: true,
  },
  {
    value: 'transport',
    icon: 'swap-horizontal-outline',
    ar: 'طلب نقل',
    en: 'Transport Request',
    transportRelated: true,
  },
  {
    value: 'delay',
    icon: 'time-outline',
    ar: 'تأخير / ملاحظة',
    en: 'Delay / Note',
    transportRelated: true,
  },
  {
    value: 'bus_issue',
    icon: 'alert-circle-outline',
    ar: 'مشكلة بالباص',
    en: 'Bus Issue',
    transportRelated: true,
  },
  {
    value: 'school_request',
    icon: 'school-outline',
    ar: 'طلب للمدرسة',
    en: 'School Request',
  },
  {
    value: 'complaint',
    icon: 'chatbox-ellipses-outline',
    ar: 'شكوى / ملاحظة',
    en: 'Complaint',
  },
  {
    value: 'other',
    icon: 'ellipsis-horizontal-outline',
    ar: 'أخرى',
    en: 'Other',
  },
];

/* -------------------------------------------------------------------------- */
/* Date helpers                                                               */
/* -------------------------------------------------------------------------- */

function localDateISO(
  date = new Date()
) {
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

function parseDateKey(
  value: string
) {
  const [
    year,
    month,
    day,
  ] = value
    .split('-')
    .map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
}

function monthKey(
  date: Date
) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function daysInMonth(
  date: Date
) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  ).getDate();
}

function firstWeekday(
  date: Date
) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  ).getDay();
}

function addDays(
  dateKey: string,
  amount: number
) {
  const date =
    parseDateKey(dateKey);

  date.setDate(
    date.getDate() + amount
  );

  return localDateISO(date);
}

function formatDate(
  value: string,
  isRTL: boolean
) {
  const date =
    parseDateKey(value);

  return date.toLocaleDateString(
    isRTL
      ? 'ar-JO'
      : 'en-US',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function childName(
  child?: ParentTrackingChild | null
) {
  return (
    child?.student?.full_name ??
    child?.student?.name ??
    'Student'
  );
}

function requestTypeInfo(
  value: unknown
) {
  return (
    REQUEST_TYPES.find(
      (item) =>
        item.value === value
    ) ??
    REQUEST_TYPES[
      REQUEST_TYPES.length - 1
    ]
  );
}

function statusMeta(
  value: unknown,
  isRTL: boolean
) {
  const status =
    String(
      value ?? 'pending'
    )
      .trim()
      .toLowerCase();

  switch (status) {
    case 'approved':
      return {
        label: isRTL
          ? 'معتمد'
          : 'Approved',
        color: '#0D9566',
        icon:
          'checkmark-circle-outline' as const,
      };

    case 'completed':
      return {
        label: isRTL
          ? 'مكتمل'
          : 'Completed',
        color: '#087E82',
        icon:
          'checkmark-done-circle-outline' as const,
      };

    case 'rejected':
      return {
        label: isRTL
          ? 'مرفوض'
          : 'Rejected',
        color: '#C9444D',
        icon:
          'close-circle-outline' as const,
      };

    default:
      return {
        label: isRTL
          ? 'قيد المراجعة'
          : 'Pending',
        color: '#D48C16',
        icon:
          'time-outline' as const,
      };
  }
}

function periodText(
  value: unknown,
  isRTL: boolean
) {
  if (value === 'morning') {
    return isRTL
      ? 'الفترة الصباحية'
      : 'Morning';
  }

  if (value === 'afternoon') {
    return isRTL
      ? 'الفترة المسائية'
      : 'Afternoon';
  }

  return isRTL
    ? 'الصباحية والمسائية'
    : 'Morning & Afternoon';
}

function requestDates(
  request: any
) {
  return {
    from:
      request.date_from ??
      request.request_date ??
      localDateISO(),

    to:
      request.date_to ??
      request.request_date ??
      localDateISO(),
  };
}

function remainingText(
  request: any,
  isRTL: boolean
) {
  const remaining =
    parentRequestEditRemainingMs(
      request
    );

  if (remaining <= 0) {
    return isRTL
      ? 'انتهت مهلة التعديل'
      : 'Editing window ended';
  }

  const hours =
    Math.floor(
      remaining /
        (60 * 60 * 1000)
    );

  const minutes =
    Math.floor(
      (remaining %
        (60 * 60 * 1000)) /
        (60 * 1000)
    );

  return isRTL
    ? `متبقي للتعديل ${hours}س ${minutes}د`
    : `${hours}h ${minutes}m left to edit`;
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export default function ParentRequestsScreen({
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

  const today =
    localDateISO();

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
    selectedType,
    setSelectedType,
  ] =
    useState<ParentRequestType>(
      'absence'
    );

  const [
    tripPeriod,
    setTripPeriod,
  ] =
    useState<ParentRequestPeriod>(
      'both'
    );

  const [
    dateFrom,
    setDateFrom,
  ] =
    useState(today);

  const [
    dateTo,
    setDateTo,
  ] =
    useState(today);

  const [notes, setNotes] =
    useState('');

  const [
    requests,
    setRequests,
  ] =
    useState<any[]>([]);

  const [
    historyTab,
    setHistoryTab,
  ] =
    useState<HistoryTab>(
      'current'
    );

  const [
    editingRequest,
    setEditingRequest,
  ] =
    useState<any | null>(
      null
    );

  const [
    dateTarget,
    setDateTarget,
  ] =
    useState<DateTarget>(
      null
    );

  const [
    calendarMonth,
    setCalendarMonth,
  ] =
    useState(
      monthKey(new Date())
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
    saving,
    setSaving,
  ] =
    useState(false);

  /*
   * يجعل عداد الـ24 ساعة
   * يتحدث أثناء بقاء الشاشة مفتوحة.
   */
  const [
    clock,
    setClock,
  ] =
    useState(Date.now());

  useEffect(() => {
    const timer =
      setInterval(
        () =>
          setClock(
            Date.now()
          ),
        60 * 1000
      );

    return () =>
      clearInterval(timer);
  }, []);

  void clock;

  /* ------------------------------------------------------------------------ */
  /* Selected child                                                           */
  /* ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------ */
  /* Load                                                                     */
  /* ------------------------------------------------------------------------ */

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

        try {
          const [
            childRows,
            requestRows,
          ] =
            await Promise.all([
              getParentTrackingChildren(
                user.id
              ),

              getParentRequests(
                user.id
              ),
            ]);

          setChildren(
            childRows
          );

          setRequests(
            requestRows
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
        } catch (
          error: any
        ) {
          console.log(
            'ParentRequests load:',
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
          setRefreshing(false);
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
    void load();
  }, [load]);

  /* ------------------------------------------------------------------------ */
  /* History                                                                  */
  /* ------------------------------------------------------------------------ */

  const filteredRequests =
    useMemo(() => {
      return requests.filter(
        (request) => {
          const dates =
            requestDates(
              request
            );

          if (
            historyTab ===
            'all'
          ) {
            return true;
          }

          if (
            historyTab ===
            'current'
          ) {
            return (
              dates.from <=
                today &&
              dates.to >=
                today
            );
          }

          if (
            historyTab ===
            'upcoming'
          ) {
            return (
              dates.from >
              today
            );
          }

          return (
            dates.to <
            today
          );
        }
      );
    }, [
      requests,
      historyTab,
      today,
    ]);

  /* ------------------------------------------------------------------------ */
  /* Form                                                                     */
  /* ------------------------------------------------------------------------ */

  const resetForm =
    useCallback(() => {
      setEditingRequest(
        null
      );

      setSelectedType(
        'absence'
      );

      setTripPeriod(
        'both'
      );

      setDateFrom(
        localDateISO()
      );

      setDateTo(
        localDateISO()
      );

      setNotes('');
    }, []);

  const startEdit =
    useCallback(
      (request: any) => {
        if (
          !canEditParentRequest(
            request
          )
        ) {
          Alert.alert(
            isRTL
              ? 'الطلب مقفل'
              : 'Request locked',
            isRTL
              ? 'انتهت مهلة التعديل أو تم اعتماد الطلب.'
              : 'The editing window has ended or the request was approved.'
          );

          return;
        }

        const dates =
          requestDates(
            request
          );

        setEditingRequest(
          request
        );

        setSelectedStudentId(
          request.student_id
        );

        setSelectedType(
          request.request_type ??
            'other'
        );

        setTripPeriod(
          request.trip_period ??
            'both'
        );

        setDateFrom(
          dates.from
        );

        setDateTo(
          dates.to
        );

        setNotes(
          request.notes ?? ''
        );
      },
      [isRTL]
    );

  const submit =
    useCallback(
      async () => {
        if (
          !user?.id ||
          !selectedChild
            ?.student?.id
        ) {
          return;
        }

        if (
          dateTo <
          dateFrom
        ) {
          Alert.alert(
            isRTL
              ? 'التاريخ غير صحيح'
              : 'Invalid dates',
            isRTL
              ? 'تاريخ النهاية يجب أن يكون مساويًا أو بعد تاريخ البداية.'
              : 'End date must be on or after start date.'
          );

          return;
        }

        const schoolId =
          selectedChild
            .school?.id ??
          selectedChild
            .student
            ?.school_id ??
          user.school_id ??
          null;

        if (!schoolId) {
          Alert.alert(
            isRTL
              ? 'تنبيه'
              : 'Notice',
            isRTL
              ? 'لم يتم العثور على مدرسة الطالب.'
              : 'Student school was not found.'
          );

          return;
        }

        setSaving(true);

        try {
          if (
            editingRequest
          ) {
            await updateParentRequest(
              {
                requestId:
                  editingRequest.id,

                parentId:
                  user.id,

                requestType:
                  selectedType,

                dateFrom,
                dateTo,

                tripPeriod,

                notes,
              }
            );
          } else {
            await createParentRequest(
              {
                schoolId:
                  String(
                    schoolId
                  ),

                parentId:
                  user.id,

                studentId:
                  selectedChild
                    .student.id,

                requestType:
                  selectedType,

                dateFrom,
                dateTo,

                tripPeriod,

                notes,
              }
            );
          }

          const wasEdit =
            !!editingRequest;

          resetForm();

          await load(true);

          Alert.alert(
            isRTL
              ? wasEdit
                ? 'تم التعديل'
                : 'تم الإرسال'
              : wasEdit
              ? 'Updated'
              : 'Sent',
            isRTL
              ? wasEdit
                ? 'تم تعديل الطلب وإشعار الجهات المرتبطة.'
                : 'تم إرسال الطلب وإشعار الجهات المرتبطة.'
              : wasEdit
              ? 'The request was updated and related users were notified.'
              : 'The request was sent and related users were notified.'
          );
        } catch (
          error: any
        ) {
          console.log(
            'parent request submit:',
            error
          );

          const message =
            String(
              error?.message ??
                ''
            );

          if (
            message.includes(
              'edit_window_expired'
            )
          ) {
            Alert.alert(
              isRTL
                ? 'انتهت مهلة التعديل'
                : 'Editing expired',
              isRTL
                ? 'مر أكثر من 24 ساعة على تقديم الطلب ولا يمكن تعديله.'
                : 'More than 24 hours have passed and this request can no longer be edited.'
            );
          } else if (
            message.includes(
              'request_locked'
            )
          ) {
            Alert.alert(
              isRTL
                ? 'الطلب معتمد'
                : 'Request locked',
              isRTL
                ? 'تم اعتماد الطلب ولا يمكن تعديله.'
                : 'This request has been approved and can no longer be edited.'
            );
          } else {
            Alert.alert(
              isRTL
                ? 'تعذر الحفظ'
                : 'Could not save',
              message
            );
          }

          await load(true);
        } finally {
          setSaving(false);
        }
      },
      [
        user,
        selectedChild,
        dateFrom,
        dateTo,
        editingRequest,
        selectedType,
        tripPeriod,
        notes,
        resetForm,
        load,
        isRTL,
      ]
    );

  /* ------------------------------------------------------------------------ */
  /* Calendar                                                                 */
  /* ------------------------------------------------------------------------ */

  const openCalendar =
    useCallback(
      (
        target: Exclude<
          DateTarget,
          null
        >
      ) => {
        const value =
          target === 'from'
            ? dateFrom
            : dateTo;

        setCalendarMonth(
          monthKey(
            parseDateKey(
              value
            )
          )
        );

        setDateTarget(
          target
        );
      },
      [
        dateFrom,
        dateTo,
      ]
    );

  const chooseDate =
    useCallback(
      (value: string) => {
        if (
          dateTarget ===
          'from'
        ) {
          setDateFrom(
            value
          );

          if (
            dateTo <
            value
          ) {
            setDateTo(
              value
            );
          }
        } else if (
          dateTarget ===
          'to'
        ) {
          if (
            value <
            dateFrom
          ) {
            setDateFrom(
              value
            );
          }

          setDateTo(
            value
          );
        }

        setDateTarget(
          null
        );
      },
      [
        dateTarget,
        dateFrom,
        dateTo,
      ]
    );

  /* ------------------------------------------------------------------------ */
  /* Loading                                                                  */
  /* ------------------------------------------------------------------------ */

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
          style={[
            styles.loadingIcon,
            {
              backgroundColor:
                theme.colors
                  .surface,
            },
          ]}
        >
          <Ionicons
            name="document-text-outline"
            size={30}
            color={GOLD}
          />
        </View>

        <ActivityIndicator
          size="large"
          color={GOLD}
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
                  .text,
            },
          ]}
        >
          {isRTL
            ? 'جاري تحميل الطلبات'
            : 'Loading requests'}
        </Text>
      </View>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

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
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            tintColor={GOLD}
            onRefresh={() =>
              void load(true)
            }
          />
        }
      >
        {/* Header */}

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
                borderColor:
                  theme.colors
                    .border,
              },
            ]}
          >
            <Ionicons
              name={
                isRTL
                  ? 'chevron-forward'
                  : 'chevron-back'
              }
              size={21}
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
                styles.headerCaption,
                {
                  textAlign,
                },
              ]}
            >
              SMART SCHOOL BUS
            </Text>

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
                ? 'طلبات ولي الأمر'
                : 'Parent Requests'}
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
                ? 'إدارة الغياب والإجازات وطلبات النقل'
                : 'Absence, leave and transportation requests'}
            </Text>
          </View>

          <Pressable
            onPress={() =>
              void load(true)
            }
            style={[
              styles.iconButton,
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
            <Ionicons
              name="refresh"
              size={19}
              color={
                theme.colors
                  .text
              }
            />
          </Pressable>
        </View>

        {/* Intro */}

        <View
          style={
            styles.heroCard
          }
        >
          <View
            style={
              styles.heroGlow
            }
          />

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
                styles.heroIcon
              }
            >
              <Ionicons
                name="shield-checkmark"
                size={25}
                color={NAVY}
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={[
                  styles.heroTitle,
                  {
                    textAlign,
                  },
                ]}
              >
                {isRTL
                  ? 'إبلاغ المدرسة بسهولة'
                  : 'Keep the school informed'}
              </Text>

              <Text
                style={[
                  styles.heroText,
                  {
                    textAlign,
                  },
                ]}
              >
                {isRTL
                  ? 'يتم ربط الطلب بالطالب والمسار والباص والمعلم والسائق تلقائيًا.'
                  : 'Requests are automatically linked to the student, route, bus, teacher and driver.'}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.heroNotice,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={16}
              color={GOLD}
            />

            <Text
              style={
                styles.heroNoticeText
              }
            >
              {isRTL
                ? 'يمكن تعديل الطلب خلال أول 24 ساعة ما لم يتم اعتماده.'
                : 'A request can be edited during the first 24 hours unless approved.'}
            </Text>
          </View>
        </View>

        {/* Student */}

        <SectionHeading
          title={
            isRTL
              ? 'الطالب'
              : 'Student'
          }
          subtitle={
            isRTL
              ? 'اختر الطالب المرتبط بالطلب'
              : 'Choose the student for this request'
          }
          theme={theme}
          textAlign={textAlign}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.studentList
          }
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
                  disabled={
                    !!editingRequest
                  }
                  onPress={() =>
                    setSelectedStudentId(
                      child.student
                        ?.id ??
                        null
                    )
                  }
                  style={[
                    styles.studentChip,
                    {
                      backgroundColor:
                        active
                          ? GOLD
                          : theme
                              .colors
                              .surface,

                      borderColor:
                        active
                          ? GOLD
                          : theme
                              .colors
                              .border,

                      opacity:
                        editingRequest &&
                        !active
                          ? 0.45
                          : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.studentAvatar,
                      {
                        backgroundColor:
                          active
                            ? 'rgba(10,45,68,0.10)'
                            : theme
                                .colors
                                .surface2,
                      },
                    ]}
                  >
                    <Ionicons
                      name="person"
                      size={17}
                      color={
                        active
                          ? NAVY
                          : GOLD
                      }
                    />
                  </View>

                  <Text
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.studentName,
                      {
                        color:
                          active
                            ? NAVY
                            : theme
                                .colors
                                .text,
                      },
                    ]}
                  >
                    {childName(
                      child
                    )}
                  </Text>
                </Pressable>
              );
            }
          )}
        </ScrollView>

        {/* Form */}

        <View
          style={[
            styles.formCard,
            {
              backgroundColor:
                theme.colors
                  .surface,
              borderColor:
                editingRequest
                  ? GOLD
                  : theme
                      .colors
                      .border,
            },
          ]}
        >
          <View
            style={[
              styles.formHeader,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <View
              style={[
                styles.formHeaderIcon,
                {
                  backgroundColor:
                    theme.colors
                      .surface2,
                },
              ]}
            >
              <Ionicons
                name={
                  editingRequest
                    ? 'create-outline'
                    : 'add-circle-outline'
                }
                size={21}
                color={GOLD}
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={[
                  styles.formTitle,
                  {
                    color:
                      theme.colors
                        .text,
                    textAlign,
                  },
                ]}
              >
                {editingRequest
                  ? isRTL
                    ? 'تعديل الطلب'
                    : 'Edit Request'
                  : isRTL
                  ? 'طلب جديد'
                  : 'New Request'}
              </Text>

              <Text
                style={[
                  styles.formSub,
                  {
                    color:
                      theme.colors
                        .textSecondary,
                    textAlign,
                  },
                ]}
              >
                {editingRequest
                  ? remainingText(
                      editingRequest,
                      isRTL
                    )
                  : isRTL
                  ? 'حدد نوع الطلب والفترة والتاريخ'
                  : 'Select request type, period and dates'}
              </Text>
            </View>

            {editingRequest && (
              <Pressable
                onPress={
                  resetForm
                }
                style={[
                  styles.cancelEdit,
                  {
                    backgroundColor:
                      theme.colors
                        .surface2,
                  },
                ]}
              >
                <Ionicons
                  name="close"
                  size={17}
                  color={
                    theme.colors
                      .text
                  }
                />
              </Pressable>
            )}
          </View>

          {/* Request types */}

          <Text
            style={[
              styles.fieldLabel,
              {
                color:
                  theme.colors
                    .text,
                textAlign,
              },
            ]}
          >
            {isRTL
              ? 'نوع الطلب'
              : 'Request type'}
          </Text>

          <View
            style={
              styles.typeGrid
            }
          >
            {REQUEST_TYPES.map(
              (item) => {
                const active =
                  selectedType ===
                  item.value;

                return (
                  <Pressable
                    key={
                      item.value
                    }
                    onPress={() =>
                      setSelectedType(
                        item.value
                      )
                    }
                    style={[
                      styles.typeCard,
                      {
                        backgroundColor:
                          active
                            ? GOLD
                            : theme
                                .colors
                                .surface2,

                        borderColor:
                          active
                            ? GOLD
                            : theme
                                .colors
                                .border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        item.icon
                      }
                      size={21}
                      color={
                        active
                          ? NAVY
                          : GOLD
                      }
                    />

                    <Text
                      style={[
                        styles.typeText,
                        {
                          color:
                            active
                              ? NAVY
                              : theme
                                  .colors
                                  .text,
                        },
                      ]}
                    >
                      {isRTL
                        ? item.ar
                        : item.en}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>

          {/* Dates */}

          <Text
            style={[
              styles.fieldLabel,
              {
                color:
                  theme.colors
                    .text,
                textAlign,
              },
            ]}
          >
            {isRTL
              ? 'مدة الطلب'
              : 'Request dates'}
          </Text>

          <View
            style={[
              styles.dateRow,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <DateBox
              label={
                isRTL
                  ? 'من تاريخ'
                  : 'From'
              }
              value={formatDate(
                dateFrom,
                isRTL
              )}
              onPress={() =>
                openCalendar(
                  'from'
                )
              }
              theme={theme}
              textAlign={textAlign}
            />

            <View
              style={[
                styles.dateArrow,
                {
                  backgroundColor:
                    theme.colors
                      .surface2,
                },
              ]}
            >
              <Ionicons
                name={
                  isRTL
                    ? 'arrow-back'
                    : 'arrow-forward'
                }
                size={16}
                color={GOLD}
              />
            </View>

            <DateBox
              label={
                isRTL
                  ? 'إلى تاريخ'
                  : 'To'
              }
              value={formatDate(
                dateTo,
                isRTL
              )}
              onPress={() =>
                openCalendar(
                  'to'
                )
              }
              theme={theme}
              textAlign={textAlign}
            />
          </View>

          <View
            style={[
              styles.quickDates,
              {
                flexDirection:
                  direction,
              },
            ]}
          >
            <QuickDate
              label={
                isRTL
                  ? 'اليوم'
                  : 'Today'
              }
              onPress={() => {
                const now =
                  localDateISO();

                setDateFrom(
                  now
                );

                setDateTo(
                  now
                );
              }}
              theme={theme}
            />

            <QuickDate
              label={
                isRTL
                  ? 'يومان'
                  : '2 Days'
              }
              onPress={() => {
                const now =
                  localDateISO();

                setDateFrom(
                  now
                );

                setDateTo(
                  addDays(
                    now,
                    1
                  )
                );
              }}
              theme={theme}
            />

            <QuickDate
              label={
                isRTL
                  ? 'أسبوع'
                  : 'Week'
              }
              onPress={() => {
                const now =
                  localDateISO();

                setDateFrom(
                  now
                );

                setDateTo(
                  addDays(
                    now,
                    6
                  )
                );
              }}
              theme={theme}
            />
          </View>

          {/* Period */}

          <Text
            style={[
              styles.fieldLabel,
              {
                color:
                  theme.colors
                    .text,
                textAlign,
              },
            ]}
          >
            {isRTL
              ? 'فترة الباص'
              : 'Bus period'}
          </Text>

          <View
            style={[
              styles.periodSelector,
              {
                flexDirection:
                  direction,
                backgroundColor:
                  theme.colors
                    .surface2,
              },
            ]}
          >
            <PeriodButton
              label={
                isRTL
                  ? 'الفترتين'
                  : 'Both'
              }
              icon="repeat-outline"
              selected={
                tripPeriod ===
                'both'
              }
              onPress={() =>
                setTripPeriod(
                  'both'
                )
              }
              theme={theme}
            />

            <PeriodButton
              label={
                isRTL
                  ? 'صباحية'
                  : 'Morning'
              }
              icon="sunny-outline"
              selected={
                tripPeriod ===
                'morning'
              }
              onPress={() =>
                setTripPeriod(
                  'morning'
                )
              }
              theme={theme}
            />

            <PeriodButton
              label={
                isRTL
                  ? 'مسائية'
                  : 'Afternoon'
              }
              icon="moon-outline"
              selected={
                tripPeriod ===
                'afternoon'
              }
              onPress={() =>
                setTripPeriod(
                  'afternoon'
                )
              }
              theme={theme}
            />
          </View>

          {/* Notes */}

          <Text
            style={[
              styles.fieldLabel,
              {
                color:
                  theme.colors
                    .text,
                textAlign,
              },
            ]}
          >
            {isRTL
              ? 'التفاصيل'
              : 'Details'}
          </Text>

          <TextInput
            multiline
            value={notes}
            onChangeText={
              setNotes
            }
            textAlign={
              isRTL
                ? 'right'
                : 'left'
            }
            placeholder={
              isRTL
                ? 'أضف أي تفاصيل مهمة للمدرسة أو المعلم أو السائق...'
                : 'Add any important details for the school, teacher or driver...'
            }
            placeholderTextColor={
              theme.colors
                .muted
            }
            style={[
              styles.input,
              {
                color:
                  theme.colors
                    .text,

                backgroundColor:
                  theme.colors
                    .surface2,

                borderColor:
                  theme.colors
                    .border,
              },
            ]}
          />

          <Pressable
            disabled={
              saving ||
              !selectedChild
            }
            onPress={() =>
              void submit()
            }
            style={({ pressed }) => [
              styles.submitButton,
              pressed && {
                opacity: 0.85,
              },
              {
                opacity:
                  saving ||
                  !selectedChild
                    ? 0.55
                    : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator
                color={NAVY}
              />
            ) : (
              <>
                <Ionicons
                  name={
                    editingRequest
                      ? 'checkmark-circle'
                      : 'paper-plane'
                  }
                  size={20}
                  color={NAVY}
                />

                <Text
                  style={
                    styles.submitText
                  }
                >
                  {editingRequest
                    ? isRTL
                      ? 'حفظ التعديلات'
                      : 'Save Changes'
                    : isRTL
                    ? 'إرسال الطلب'
                    : 'Send Request'}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* History */}

        <SectionHeading
          title={
            isRTL
              ? 'سجل الطلبات'
              : 'Request History'
          }
          subtitle={
            isRTL
              ? 'جميع الطلبات الحالية والسابقة'
              : 'Current and previous requests'
          }
          theme={theme}
          textAlign={textAlign}
        />

        <View
          style={[
            styles.historyTabs,
            {
              flexDirection:
                direction,
              backgroundColor:
                theme.colors
                  .surface,
              borderColor:
                theme.colors
                  .border,
            },
          ]}
        >
          <HistoryTabButton
            label={
              isRTL
                ? 'الحالية'
                : 'Current'
            }
            selected={
              historyTab ===
              'current'
            }
            onPress={() =>
              setHistoryTab(
                'current'
              )
            }
            theme={theme}
          />

          <HistoryTabButton
            label={
              isRTL
                ? 'القادمة'
                : 'Upcoming'
            }
            selected={
              historyTab ===
              'upcoming'
            }
            onPress={() =>
              setHistoryTab(
                'upcoming'
              )
            }
            theme={theme}
          />

          <HistoryTabButton
            label={
              isRTL
                ? 'السابقة'
                : 'Previous'
            }
            selected={
              historyTab ===
              'previous'
            }
            onPress={() =>
              setHistoryTab(
                'previous'
              )
            }
            theme={theme}
          />

          <HistoryTabButton
            label={
              isRTL
                ? 'الكل'
                : 'All'
            }
            selected={
              historyTab ===
              'all'
            }
            onPress={() =>
              setHistoryTab(
                'all'
              )
            }
            theme={theme}
          />
        </View>

        {filteredRequests.length ===
        0 ? (
          <View
            style={[
              styles.empty,
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
                styles.emptyIcon,
                {
                  backgroundColor:
                    theme.colors
                      .surface2,
                },
              ]}
            >
              <Ionicons
                name="file-tray-outline"
                size={29}
                color={GOLD}
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
                ? 'لا توجد طلبات'
                : 'No requests'}
            </Text>

            <Text
              style={[
                styles.emptySub,
                {
                  color:
                    theme.colors
                      .textSecondary,
                },
              ]}
            >
              {isRTL
                ? 'لا توجد طلبات ضمن هذا التصنيف.'
                : 'There are no requests in this category.'}
            </Text>
          </View>
        ) : (
          filteredRequests.map(
            (request) => {
              const meta =
                statusMeta(
                  request.status,
                  isRTL
                );

              const type =
                requestTypeInfo(
                  request.request_type
                );

              const child =
                children.find(
                  (item) =>
                    String(
                      item.student
                        ?.id
                    ) ===
                    String(
                      request.student_id
                    )
                );

              const dates =
                requestDates(
                  request
                );

              const editable =
                canEditParentRequest(
                  request
                );

              return (
                <View
                  key={
                    request.id
                  }
                  style={[
                    styles.requestCard,
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
                      styles.requestTop,
                      {
                        flexDirection:
                          direction,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.requestIcon,
                        {
                          backgroundColor:
                            `${meta.color}14`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          type.icon
                        }
                        size={22}
                        color={
                          meta.color
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.requestIdentity
                      }
                    >
                      <Text
                        style={[
                          styles.requestTitle,
                          {
                            color:
                              theme
                                .colors
                                .text,
                            textAlign,
                          },
                        ]}
                      >
                        {isRTL
                          ? type.ar
                          : type.en}
                      </Text>

                      <Text
                        style={[
                          styles.requestStudent,
                          {
                            color:
                              theme
                                .colors
                                .textSecondary,
                            textAlign,
                          },
                        ]}
                      >
                        {childName(
                          child
                        )}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            `${meta.color}14`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          meta.icon
                        }
                        size={13}
                        color={
                          meta.color
                        }
                      />

                      <Text
                        style={[
                          styles.statusText,
                          {
                            color:
                              meta.color,
                          },
                        ]}
                      >
                        {meta.label}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.requestInfo,
                      {
                        flexDirection:
                          direction,
                        backgroundColor:
                          theme.colors
                            .surface2,
                      },
                    ]}
                  >
                    <InfoItem
                      icon="calendar-outline"
                      label={
                        isRTL
                          ? 'من'
                          : 'From'
                      }
                      value={formatDate(
                        dates.from,
                        isRTL
                      )}
                      theme={theme}
                      textAlign={textAlign}
                    />

                    <InfoDivider
                      theme={theme}
                    />

                    <InfoItem
                      icon="calendar-clear-outline"
                      label={
                        isRTL
                          ? 'إلى'
                          : 'To'
                      }
                      value={formatDate(
                        dates.to,
                        isRTL
                      )}
                      theme={theme}
                      textAlign={textAlign}
                    />

                    <InfoDivider
                      theme={theme}
                    />

                    <InfoItem
                      icon="time-outline"
                      label={
                        isRTL
                          ? 'الفترة'
                          : 'Period'
                      }
                      value={periodText(
                        request.trip_period,
                        isRTL
                      )}
                      theme={theme}
                      textAlign={textAlign}
                    />
                  </View>

                  {!!request.notes && (
                    <View
                      style={[
                        styles.requestNotes,
                        {
                          borderColor:
                            theme.colors
                              .border,
                        },
                      ]}
                    >
                      <Ionicons
                        name="chatbox-outline"
                        size={14}
                        color={
                          theme.colors
                            .muted
                        }
                      />

                      <Text
                        style={[
                          styles.requestNotesText,
                          {
                            color:
                              theme
                                .colors
                                .textSecondary,
                            textAlign,
                          },
                        ]}
                      >
                        {
                          request.notes
                        }
                      </Text>
                    </View>
                  )}

                  <View
                    style={[
                      styles.requestFooter,
                      {
                        flexDirection:
                          direction,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.lockState,
                        {
                          backgroundColor:
                            editable
                              ? 'rgba(244,185,66,0.10)'
                              : theme
                                  .colors
                                  .surface2,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          editable
                            ? 'time-outline'
                            : 'lock-closed-outline'
                        }
                        size={14}
                        color={
                          editable
                            ? '#D48C16'
                            : theme
                                .colors
                                .muted
                        }
                      />

                      <Text
                        style={[
                          styles.lockText,
                          {
                            color:
                              editable
                                ? '#D48C16'
                                : theme
                                    .colors
                                    .textSecondary,
                          },
                        ]}
                      >
                        {editable
                          ? remainingText(
                              request,
                              isRTL
                            )
                          : isRTL
                          ? 'الطلب نهائي'
                          : 'Request locked'}
                      </Text>
                    </View>

                    {editable && (
                      <Pressable
                        onPress={() =>
                          startEdit(
                            request
                          )
                        }
                        style={
                          styles.editButton
                        }
                      >
                        <Ionicons
                          name="create-outline"
                          size={15}
                          color={NAVY}
                        />

                        <Text
                          style={
                            styles.editButtonText
                          }
                        >
                          {isRTL
                            ? 'تعديل'
                            : 'Edit'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            }
          )
        )}

        <View
          style={{
            height: 30,
          }}
        />
      </ScrollView>

      {/* Calendar */}

      <Modal
        visible={
          dateTarget !==
          null
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setDateTarget(
            null
          )
        }
      >
        <View
          style={
            styles.modalBackdrop
          }
        >
          <Pressable
            style={
              StyleSheet.absoluteFill
            }
            onPress={() =>
              setDateTarget(
                null
              )
            }
          />

          <View
            style={[
              styles.calendarCard,
              {
                backgroundColor:
                  theme.colors
                    .surface,
              },
            ]}
          >
            <View
              style={[
                styles.calendarHeader,
                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <Pressable
                onPress={() => {
                  const next =
                    new Date(
                      calendarMonth
                    );

                  next.setMonth(
                    next.getMonth() -
                      1
                  );

                  setCalendarMonth(
                    monthKey(
                      next
                    )
                  );
                }}
                style={[
                  styles.calendarArrow,
                  {
                    backgroundColor:
                      theme.colors
                        .surface2,
                  },
                ]}
              >
                <Ionicons
                  name={
                    isRTL
                      ? 'chevron-forward'
                      : 'chevron-back'
                  }
                  size={18}
                  color={
                    theme.colors
                      .text
                  }
                />
              </Pressable>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={[
                    styles.calendarTitle,
                    {
                      color:
                        theme.colors
                          .text,
                    },
                  ]}
                >
                  {calendarMonth.toLocaleDateString(
                    isRTL
                      ? 'ar-JO'
                      : 'en-US',
                    {
                      month:
                        'long',
                      year:
                        'numeric',
                    }
                  )}
                </Text>

                <Text
                  style={[
                    styles.calendarSub,
                    {
                      color:
                        theme.colors
                          .textSecondary,
                    },
                  ]}
                >
                  {dateTarget ===
                  'from'
                    ? isRTL
                      ? 'اختر تاريخ البداية'
                      : 'Select start date'
                    : isRTL
                    ? 'اختر تاريخ النهاية'
                    : 'Select end date'}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  const next =
                    new Date(
                      calendarMonth
                    );

                  next.setMonth(
                    next.getMonth() +
                      1
                  );

                  setCalendarMonth(
                    monthKey(
                      next
                    )
                  );
                }}
                style={[
                  styles.calendarArrow,
                  {
                    backgroundColor:
                      theme.colors
                        .surface2,
                  },
                ]}
              >
                <Ionicons
                  name={
                    isRTL
                      ? 'chevron-back'
                      : 'chevron-forward'
                  }
                  size={18}
                  color={
                    theme.colors
                      .text
                  }
                />
              </Pressable>
            </View>

            <CalendarGrid
              month={
                calendarMonth
              }
              selected={
                dateTarget ===
                'from'
                  ? dateFrom
                  : dateTo
              }
              dateFrom={
                dateFrom
              }
              dateTo={
                dateTo
              }
              isRTL={
                isRTL
              }
              theme={
                theme
              }
              onSelect={
                chooseDate
              }
            />

            <Pressable
              onPress={() =>
                setDateTarget(
                  null
                )
              }
              style={[
                styles.calendarCancel,
                {
                  backgroundColor:
                    theme.colors
                      .surface2,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    theme.colors
                      .text,
                  fontWeight:
                    '900',
                }}
              >
                {isRTL
                  ? 'إلغاء'
                  : 'Cancel'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* Small components                                                           */
/* -------------------------------------------------------------------------- */

function SectionHeading({
  title,
  subtitle,
  theme,
  textAlign,
}: any) {
  return (
    <View
      style={
        styles.sectionHeading
      }
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
  );
}

function DateBox({
  label,
  value,
  onPress,
  theme,
  textAlign,
}: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.dateBox,
        {
          backgroundColor:
            theme.colors
              .surface2,
          borderColor:
            theme.colors
              .border,
        },
      ]}
    >
      <View
        style={
          styles.dateBoxIcon
        }
      >
        <Ionicons
          name="calendar-outline"
          size={17}
          color={GOLD}
        />
      </View>

      <Text
        style={[
          styles.dateLabel,
          {
            color:
              theme.colors
                .muted,
            textAlign,
          },
        ]}
      >
        {label}
      </Text>

      <Text
        numberOfLines={1}
        style={[
          styles.dateValue,
          {
            color:
              theme.colors
                .text,
            textAlign,
          },
        ]}
      >
        {value}
      </Text>
    </Pressable>
  );
}

function QuickDate({
  label,
  onPress,
  theme,
}: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.quickDate,
        {
          backgroundColor:
            theme.colors
              .surface2,
          borderColor:
            theme.colors
              .border,
        },
      ]}
    >
      <Text
        style={[
          styles.quickDateText,
          {
            color:
              theme.colors
                .textSecondary,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PeriodButton({
  label,
  icon,
  selected,
  onPress,
  theme,
}: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.periodButton,
        {
          backgroundColor:
            selected
              ? GOLD
              : 'transparent',
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={
          selected
            ? NAVY
            : theme.colors
                .textSecondary
        }
      />

      <Text
        style={[
          styles.periodButtonText,
          {
            color:
              selected
                ? NAVY
                : theme.colors
                    .textSecondary,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function HistoryTabButton({
  label,
  selected,
  onPress,
  theme,
}: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.historyTab,
        {
          backgroundColor:
            selected
              ? GOLD
              : 'transparent',
        },
      ]}
    >
      <Text
        style={[
          styles.historyTabText,
          {
            color:
              selected
                ? NAVY
                : theme.colors
                    .textSecondary,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InfoItem({
  icon,
  label,
  value,
  theme,
  textAlign,
}: any) {
  return (
    <View
      style={
        styles.infoItem
      }
    >
      <View
        style={
          styles.infoLabelRow
        }
      >
        <Ionicons
          name={icon}
          size={11}
          color={
            theme.colors
              .muted
          }
        />

        <Text
          style={[
            styles.infoLabel,
            {
              color:
                theme.colors
                  .muted,
            },
          ]}
        >
          {label}
        </Text>
      </View>

      <Text
        numberOfLines={2}
        style={[
          styles.infoValue,
          {
            color:
              theme.colors
                .text,
            textAlign,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function InfoDivider({
  theme,
}: any) {
  return (
    <View
      style={[
        styles.infoDivider,
        {
          backgroundColor:
            theme.colors
              .border,
        },
      ]}
    />
  );
}

function CalendarGrid({
  month,
  selected,
  dateFrom,
  dateTo,
  isRTL,
  theme,
  onSelect,
}: any) {
  const weekdayNames =
    isRTL
      ? [
          'ح',
          'ن',
          'ث',
          'ر',
          'خ',
          'ج',
          'س',
        ]
      : [
          'S',
          'M',
          'T',
          'W',
          'T',
          'F',
          'S',
        ];

  const blanks =
    firstWeekday(month);

  const count =
    daysInMonth(month);

  const cells:
    (number | null)[] = [
    ...Array(
      blanks
    ).fill(null),

    ...Array.from(
      {
        length: count,
      },
      (_, index) =>
        index + 1
    ),
  ];

  while (
    cells.length % 7 !==
    0
  ) {
    cells.push(null);
  }

  return (
    <View>
      <View
        style={
          styles.weekRow
        }
      >
        {weekdayNames.map(
          (name, index) => (
            <Text
              key={`${name}-${index}`}
              style={[
                styles.weekday,
                {
                  color:
                    theme
                      .colors
                      .muted,
                },
              ]}
            >
              {name}
            </Text>
          )
        )}
      </View>

      <View
        style={
          styles.daysGrid
        }
      >
        {cells.map(
          (day, index) => {
            if (!day) {
              return (
                <View
                  key={
                    index
                  }
                  style={
                    styles.dayCell
                  }
                />
              );
            }

            const date =
              new Date(
                month.getFullYear(),
                month.getMonth(),
                day
              );

            const key =
              localDateISO(
                date
              );

            const active =
              key ===
              selected;

            const inRange =
              key >=
                dateFrom &&
              key <=
                dateTo;

            return (
              <Pressable
                key={key}
                onPress={() =>
                  onSelect(
                    key
                  )
                }
                style={[
                  styles.dayCell,
                  active && {
                    backgroundColor:
                      GOLD,
                  },
                  !active &&
                    inRange && {
                      backgroundColor:
                        'rgba(244,185,66,0.10)',
                    },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    {
                      color:
                        active
                          ? NAVY
                          : theme
                              .colors
                              .text,
                    },
                  ]}
                >
                  {day}
                </Text>
              </Pressable>
            );
          }
        )}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

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

    loadingIcon: {
      width: 68,
      height: 68,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },

    loadingText: {
      marginTop: 12,
      fontSize: 14,
      fontWeight: '900',
    },

    content: {
      padding: 16,
      paddingBottom: 40,
    },

    header: {
      alignItems: 'center',
      marginBottom: 15,
      gap: 10,
    },

    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 15,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    headerText: {
      flex: 1,
    },

    headerCaption: {
      color: '#C68B1D',
      fontSize: 7.5,
      fontWeight: '900',
      letterSpacing: 1,
    },

    title: {
      fontSize: 21,
      fontWeight: '900',
      marginTop: 1,
    },

    sub: {
      marginTop: 2,
      fontSize: 9,
      fontWeight: '600',
    },

    heroCard: {
      backgroundColor: NAVY,
      borderRadius: 24,
      padding: 17,
      overflow: 'hidden',
      marginBottom: 18,
    },

    heroGlow: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(244,185,66,0.08)',
      right: -45,
      top: -70,
    },

    heroTop: {
      alignItems: 'center',
      gap: 11,
    },

    heroIcon: {
      width: 47,
      height: 47,
      borderRadius: 15,
      backgroundColor: GOLD,
      alignItems: 'center',
      justifyContent: 'center',
    },

    heroTitle: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900',
    },

    heroText: {
      color: '#AFC1CD',
      fontSize: 9,
      lineHeight: 14,
      marginTop: 3,
      fontWeight: '600',
    },

    heroNotice: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        'rgba(255,255,255,0.14)',
      alignItems: 'center',
      gap: 6,
    },

    heroNoticeText: {
      color: '#D4DEE5',
      flex: 1,
      fontSize: 8.5,
      fontWeight: '700',
    },

    sectionHeading: {
      marginTop: 6,
      marginBottom: 9,
    },

    sectionTitle: {
      fontSize: 15,
      fontWeight: '900',
    },

    sectionSub: {
      marginTop: 2,
      fontSize: 9,
      fontWeight: '600',
    },

    studentList: {
      gap: 8,
      paddingBottom: 5,
    },

    studentChip: {
      height: 49,
      minWidth: 130,
      maxWidth: 190,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 9,
    },

    studentAvatar: {
      width: 33,
      height: 33,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },

    studentName: {
      flexShrink: 1,
      fontSize: 10.5,
      fontWeight: '900',
    },

    formCard: {
      marginTop: 14,
      borderRadius: 24,
      borderWidth: 1,
      padding: 15,
      marginBottom: 18,
    },

    formHeader: {
      alignItems: 'center',
      gap: 9,
      marginBottom: 13,
    },

    formHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },

    formTitle: {
      fontSize: 15,
      fontWeight: '900',
    },

    formSub: {
      marginTop: 2,
      fontSize: 8.5,
      fontWeight: '600',
    },

    cancelEdit: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },

    fieldLabel: {
      fontSize: 11,
      fontWeight: '900',
      marginTop: 12,
      marginBottom: 8,
    },

    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },

    typeCard: {
      width: '31.7%',
      minHeight: 75,
      borderRadius: 15,
      borderWidth: 1,
      paddingHorizontal: 5,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },

    typeText: {
      marginTop: 5,
      fontSize: 8.5,
      lineHeight: 12,
      textAlign: 'center',
      fontWeight: '900',
    },

    dateRow: {
      alignItems: 'center',
      gap: 6,
    },

    dateBox: {
      flex: 1,
      minHeight: 76,
      borderRadius: 15,
      borderWidth: 1,
      padding: 9,
    },

    dateBoxIcon: {
      marginBottom: 5,
    },

    dateLabel: {
      fontSize: 7.5,
      fontWeight: '700',
    },

    dateValue: {
      marginTop: 3,
      fontSize: 9.5,
      fontWeight: '900',
    },

    dateArrow: {
      width: 29,
      height: 29,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },

    quickDates: {
      gap: 6,
      marginTop: 7,
    },

    quickDate: {
      flex: 1,
      minHeight: 34,
      borderRadius: 11,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    quickDateText: {
      fontSize: 8.5,
      fontWeight: '800',
    },

    periodSelector: {
      borderRadius: 14,
      padding: 4,
    },

    periodButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 11,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 3,
    },

    periodButtonText: {
      fontSize: 8.5,
      fontWeight: '900',
    },

    input: {
      minHeight: 100,
      borderRadius: 16,
      borderWidth: 1,
      padding: 12,
      fontSize: 12,
      textAlignVertical: 'top',
    },

    submitButton: {
      minHeight: 51,
      marginTop: 13,
      borderRadius: 16,
      backgroundColor: GOLD,
      flexDirection: 'row',
      gap: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },

    submitText: {
      color: NAVY,
      fontSize: 12,
      fontWeight: '900',
    },

    historyTabs: {
      borderRadius: 15,
      borderWidth: 1,
      padding: 4,
      marginBottom: 11,
    },

    historyTab: {
      flex: 1,
      minHeight: 37,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },

    historyTabText: {
      fontSize: 8,
      fontWeight: '900',
    },

    empty: {
      padding: 25,
      borderRadius: 21,
      borderWidth: 1,
      alignItems: 'center',
    },

    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyTitle: {
      marginTop: 10,
      fontSize: 13,
      fontWeight: '900',
    },

    emptySub: {
      marginTop: 4,
      fontSize: 9,
      textAlign: 'center',
      fontWeight: '600',
    },

    requestCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 12,
      marginBottom: 9,
    },

    requestTop: {
      alignItems: 'center',
      gap: 9,
    },

    requestIcon: {
      width: 43,
      height: 43,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },

    requestIdentity: {
      flex: 1,
      minWidth: 0,
    },

    requestTitle: {
      fontSize: 11.5,
      fontWeight: '900',
    },

    requestStudent: {
      fontSize: 8.5,
      marginTop: 2,
      fontWeight: '600',
    },

    statusBadge: {
      maxWidth: 110,
      minHeight: 29,
      borderRadius: 10,
      paddingHorizontal: 7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },

    statusText: {
      fontSize: 7.5,
      fontWeight: '900',
    },

    requestInfo: {
      marginTop: 11,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 7,
      alignItems: 'stretch',
    },

    infoItem: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 4,
    },

    infoLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },

    infoLabel: {
      fontSize: 6.5,
      fontWeight: '700',
    },

    infoValue: {
      marginTop: 3,
      fontSize: 7.5,
      lineHeight: 10,
      fontWeight: '800',
    },

    infoDivider: {
      width:
        StyleSheet.hairlineWidth,
      minHeight: 31,
    },

    requestNotes: {
      marginTop: 9,
      paddingTop: 9,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 6,
    },

    requestNotesText: {
      flex: 1,
      fontSize: 9,
      lineHeight: 14,
      fontWeight: '600',
    },

    requestFooter: {
      alignItems: 'center',
      gap: 7,
      marginTop: 10,
    },

    lockState: {
      flex: 1,
      minHeight: 34,
      borderRadius: 11,
      paddingHorizontal: 9,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },

    lockText: {
      flex: 1,
      fontSize: 7.5,
      fontWeight: '800',
    },

    editButton: {
      minHeight: 34,
      borderRadius: 11,
      backgroundColor: GOLD,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },

    editButtonText: {
      color: NAVY,
      fontSize: 8.5,
      fontWeight: '900',
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor:
        'rgba(2,12,20,0.65)',
      justifyContent: 'center',
      padding: 17,
    },

    calendarCard: {
      borderRadius: 25,
      padding: 15,
    },

    calendarHeader: {
      alignItems: 'center',
      marginBottom: 15,
      gap: 8,
    },

    calendarArrow: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },

    calendarTitle: {
      fontSize: 15,
      textAlign: 'center',
      fontWeight: '900',
    },

    calendarSub: {
      fontSize: 8.5,
      textAlign: 'center',
      marginTop: 2,
      fontWeight: '600',
    },

    weekRow: {
      flexDirection: 'row',
      marginBottom: 5,
    },

    weekday: {
      width: '14.285%',
      textAlign: 'center',
      fontSize: 8,
      fontWeight: '900',
    },

    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },

    dayCell: {
      width: '14.285%',
      aspectRatio: 1,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },

    dayText: {
      fontSize: 10,
      fontWeight: '900',
    },

    calendarCancel: {
      minHeight: 44,
      marginTop: 12,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });