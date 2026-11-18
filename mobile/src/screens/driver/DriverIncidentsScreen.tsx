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
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  getDriverDashboard,
} from '../../services/driverService';

import {
  createDriverIncident,
  DriverIncidentItem,
  DriverIncidentSeverity,
  getDriverIncidents,
} from '../../services/driverIncidentService';

type IncidentTypeKey =
  | 'delay'
  | 'traffic'
  | 'breakdown'
  | 'accident'
  | 'medical'
  | 'behavior'
  | 'other';

type IncidentTypeOption = {
  key: IncidentTypeKey;
  icon:
    React.ComponentProps<
      typeof Ionicons
    >['name'];
  ar: string;
  en: string;
  defaultSeverity:
    DriverIncidentSeverity;
};

const INCIDENT_TYPES:
  IncidentTypeOption[] = [
    {
      key: 'delay',
      icon: 'time',
      ar: 'تأخير',
      en: 'Delay',
      defaultSeverity:
        'low',
    },
    {
      key: 'traffic',
      icon: 'car',
      ar: 'ازدحام',
      en: 'Traffic',
      defaultSeverity:
        'low',
    },
    {
      key: 'breakdown',
      icon: 'construct',
      ar: 'عطل بالباص',
      en: 'Bus Breakdown',
      defaultSeverity:
        'high',
    },
    {
      key: 'accident',
      icon: 'warning',
      ar: 'حادث',
      en: 'Accident',
      defaultSeverity:
        'critical',
    },
    {
      key: 'medical',
      icon: 'medkit',
      ar: 'حالة صحية طارئة',
      en: 'Medical Emergency',
      defaultSeverity:
        'critical',
    },
    {
      key: 'behavior',
      icon: 'people',
      ar: 'مشكلة سلوكية',
      en: 'Behavior Issue',
      defaultSeverity:
        'medium',
    },
    {
      key: 'other',
      icon: 'ellipsis-horizontal-circle',
      ar: 'أخرى',
      en: 'Other',
      defaultSeverity:
        'medium',
    },
  ];

const SEVERITIES: Array<{
  key:
    DriverIncidentSeverity;
  ar: string;
  en: string;
}> = [
  {
    key: 'low',
    ar: 'منخفضة',
    en: 'Low',
  },
  {
    key: 'medium',
    ar: 'متوسطة',
    en: 'Medium',
  },
  {
    key: 'high',
    ar: 'عالية',
    en: 'High',
  },
  {
    key: 'critical',
    ar: 'حرجة',
    en: 'Critical',
  },
];

function severityMeta(
  value: unknown,
  isRTL: boolean
) {
  const severity =
    String(
      value ?? 'medium'
    )
      .trim()
      .toLowerCase();

  if (
    severity ===
    'critical'
  ) {
    return {
      label:
        isRTL
          ? 'حرجة'
          : 'Critical',
      color: '#B42318',
      bg: '#FEE4E2',
      icon:
        'alert-circle' as const,
    };
  }

  if (
    severity === 'high'
  ) {
    return {
      label:
        isRTL
          ? 'عالية'
          : 'High',
      color: '#D92D20',
      bg: '#FEF3F2',
      icon:
        'warning' as const,
    };
  }

  if (
    severity === 'low'
  ) {
    return {
      label:
        isRTL
          ? 'منخفضة'
          : 'Low',
      color: '#027A48',
      bg: '#ECFDF3',
      icon:
        'information-circle' as const,
    };
  }

  return {
    label:
      isRTL
        ? 'متوسطة'
        : 'Medium',
    color: '#B54708',
    bg: '#FFF4E5',
    icon:
      'alert-circle' as const,
  };
}

function formatDateTime(
  value:
    string | null | undefined,
  isRTL:
    boolean
) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—';
  }

  return date.toLocaleString(
    isRTL
      ? 'ar-JO'
      : 'en-GB',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  );
}

export default function DriverIncidentsScreen() {
  const {
    user,
  } = useAuth();

  const {
    theme,
    isDark,
  } = useAppTheme();

  const {
    isRTL,
    textAlign,
    direction,
  } = useLanguage();

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

  const [
    dashboard,
    setDashboard,
  ] =
    useState<any>(null);

  const [
    incidents,
    setIncidents,
  ] =
    useState<
      DriverIncidentItem[]
    >([]);

  const [
    formVisible,
    setFormVisible,
  ] =
    useState(false);

  const [
    selectedType,
    setSelectedType,
  ] =
    useState<IncidentTypeKey>(
      'delay'
    );

  const [
    severity,
    setSeverity,
  ] =
    useState<
      DriverIncidentSeverity
    >('low');

  const [
    details,
    setDetails,
  ] =
    useState('');

  const [
    selectedIncident,
    setSelectedIncident,
  ] =
    useState<
      DriverIncidentItem | null
    >(null);

  const driverId =
    user?.id ??
    null;

  const load =
    useCallback(
      async (
        showSpinner:
          boolean = true
      ) => {
        if (
          !driverId
        ) {
          setLoading(false);
          return;
        }

        try {
          if (
            showSpinner
          ) {
            setLoading(true);
          }

          const result =
            await getDriverDashboard({
              driverId,

              schoolId:
                user?.school_id ??
                null,

              busId:
                user?.bus_id ??
                null,

              busNumber:
                user?.bus_number ??
                null,
            });

          setDashboard(
            result
          );

          const rows =
            await getDriverIncidents({
              driverId,

              schoolId:
                result?.school?.id ??
                user?.school_id ??
                null,

              busId:
                result?.bus?.id ??
                user?.bus_id ??
                null,

              limit: 100,
            });

          setIncidents(rows);
        } catch (
          error: any
        ) {
          console.log(
            'Driver incidents:',
            error
          );

          Alert.alert(
            isRTL
              ? 'تعذر تحميل البلاغات'
              : 'Unable to Load Reports',
            error?.message ??
              String(error)
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        driverId,
        isRTL,
        user?.bus_id,
        user?.bus_number,
        user?.school_id,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);

  const typeOption =
    useMemo(
      () =>
        INCIDENT_TYPES.find(
          (item) =>
            item.key ===
            selectedType
        ) ??
        INCIDENT_TYPES[0],
      [selectedType]
    );

  const todayCount =
    useMemo(
      () => {
        const today =
          new Date();

        return incidents.filter(
          (item) => {
            const date =
              new Date(
                item.happened_at
              );

            return (
              date.getFullYear() ===
                today.getFullYear() &&
              date.getMonth() ===
                today.getMonth() &&
              date.getDate() ===
                today.getDate()
            );
          }
        ).length;
      },
      [incidents]
    );

  function openForm() {
    setSelectedType(
      'delay'
    );
    setSeverity('low');
    setDetails('');
    setFormVisible(true);
  }

  function chooseType(
    item:
      IncidentTypeOption
  ) {
    setSelectedType(
      item.key
    );
    setSeverity(
      item.defaultSeverity
    );
  }

  async function submitIncident() {
    if (!driverId) {
      return;
    }

    const schoolId =
      dashboard?.school?.id ??
      user?.school_id ??
      null;

    const busId =
      dashboard?.bus?.id ??
      user?.bus_id ??
      null;

    if (
      !schoolId ||
      !busId
    ) {
      Alert.alert(
        isRTL
          ? 'بيانات غير مكتملة'
          : 'Missing Information',
        isRTL
          ? 'لم يتم العثور على المدرسة أو الباص المرتبط بالسائق.'
          : 'The driver school or bus could not be resolved.'
      );

      return;
    }

    if (
      selectedType ===
        'other' &&
      !details.trim()
    ) {
      Alert.alert(
        isRTL
          ? 'أضف التفاصيل'
          : 'Add Details',
        isRTL
          ? 'يرجى كتابة تفاصيل البلاغ.'
          : 'Please enter incident details.'
      );

      return;
    }

    const title =
      isRTL
        ? typeOption.ar
        : typeOption.en;

    Alert.alert(
      isRTL
        ? 'تأكيد إرسال البلاغ'
        : 'Confirm Report',
      isRTL
        ? `هل تريد إرسال بلاغ "${typeOption.ar}" إلى الإدارة؟`
        : `Send "${typeOption.en}" report to administration?`,
      [
        {
          text:
            isRTL
              ? 'إلغاء'
              : 'Cancel',
          style:
            'cancel',
        },
        {
          text:
            isRTL
              ? 'إرسال'
              : 'Send',
          style:
            severity ===
              'critical'
              ? 'destructive'
              : 'default',
          onPress:
            async () => {
              try {
                setSaving(true);

                const created =
                  await createDriverIncident({
                    schoolId,
                    busId,
                    driverId,
                    title,
                    details:
                      details.trim() ||
                      null,
                    severity,
                    happenedAt:
                      new Date().toISOString(),
                  });

                setIncidents(
                  (current) => [
                    created,
                    ...current,
                  ]
                );

                setFormVisible(
                  false
                );

                setDetails('');

                Alert.alert(
                  isRTL
                    ? 'تم إرسال البلاغ'
                    : 'Report Sent',
                  isRTL
                    ? 'تم تسجيل البلاغ وإرساله للإدارة بنجاح.'
                    : 'The incident report was recorded successfully.'
                );
              } catch (
                error: any
              ) {
                console.log(
                  'submit incident:',
                  error
                );

                Alert.alert(
                  isRTL
                    ? 'تعذر إرسال البلاغ'
                    : 'Unable to Send Report',
                  error?.message ??
                    String(error)
                );
              } finally {
                setSaving(false);
              }
            },
        },
      ]
    );
  }

  function renderIncident({
    item,
  }: {
    item:
      DriverIncidentItem;
  }) {
    const meta =
      severityMeta(
        item.severity,
        isRTL
      );

    return (
      <Pressable
        onPress={() =>
          setSelectedIncident(
            item
          )
        }
        style={[
          styles.reportCard,
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
            styles.reportTop,
            {
              flexDirection:
                direction,
            },
          ]}
        >
          <View
            style={[
              styles.reportIcon,
              {
                backgroundColor:
                  meta.bg,
              },
            ]}
          >
            <Ionicons
              name={
                meta.icon
              }
              size={21}
              color={
                meta.color
              }
            />
          </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.reportTitle,
                {
                  color:
                    theme.colors.text,
                  textAlign,
                },
              ]}
            >
              {item.title}
            </Text>

            <Text
              numberOfLines={2}
              style={[
                styles.reportDetails,
                {
                  color:
                    theme.colors.textSecondary,
                  textAlign,
                },
              ]}
            >
              {item.details ||
                (isRTL
                  ? 'بدون تفاصيل إضافية.'
                  : 'No additional details.')}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.reportFooter,
            {
              flexDirection:
                direction,
            },
          ]}
        >
          <View
            style={[
              styles.severityBadge,
              {
                backgroundColor:
                  meta.bg,
              },
            ]}
          >
            <Text
              style={[
                styles.severityText,
                {
                  color:
                    meta.color,
                },
              ]}
            >
              {meta.label}
            </Text>
          </View>

          <Text
            style={[
              styles.dateText,
              {
                color:
                  theme.colors.textSecondary,
              },
            ]}
          >
            {formatDateTime(
              item.happened_at,
              isRTL
            )}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.container,
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
          style={
            styles.headerIcon
          }
        >
          <Ionicons
            name="warning"
            size={23}
            color="#B42318"
          />
        </View>

        <View
          style={{
            flex: 1,
          }}
        >
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
              ? 'بلاغات السائق'
              : 'Driver Reports'}
          </Text>

          <Text
            numberOfLines={1}
            style={[
              styles.headerSub,
              {
                color:
                  theme.colors.textSecondary,
                textAlign,
              },
            ]}
          >
            {dashboard?.bus?.bus_number
              ? isRTL
                ? `الباص ${dashboard.bus.bus_number}`
                : `Bus ${dashboard.bus.bus_number}`
              : isRTL
              ? 'إرسال ومتابعة البلاغات'
              : 'Submit and review reports'}
          </Text>
        </View>

        <Pressable
          onPress={
            openForm
          }
          style={
            styles.addButton
          }
        >
          <Ionicons
            name="add"
            size={23}
            color="#FFFFFF"
          />
        </Pressable>
      </View>

      <View
        style={[
          styles.summaryRow,
          {
            flexDirection:
              direction,
          },
        ]}
      >
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor:
                theme.colors.surface,
              borderColor:
                theme.colors.border,
            },
          ]}
        >
          <Ionicons
            name="documents"
            size={19}
            color="#0A2D44"
          />

          <Text
            style={[
              styles.summaryCount,
              {
                color:
                  theme.colors.text,
              },
            ]}
          >
            {incidents.length}
          </Text>

          <Text
            style={[
              styles.summaryLabel,
              {
                color:
                  theme.colors.textSecondary,
              },
            ]}
          >
            {isRTL
              ? 'كل البلاغات'
              : 'All Reports'}
          </Text>
        </View>

        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor:
                theme.colors.surface,
              borderColor:
                theme.colors.border,
            },
          ]}
        >
          <Ionicons
            name="today"
            size={19}
            color="#D88B00"
          />

          <Text
            style={[
              styles.summaryCount,
              {
                color:
                  theme.colors.text,
              },
            ]}
          >
            {todayCount}
          </Text>

          <Text
            style={[
              styles.summaryLabel,
              {
                color:
                  theme.colors.textSecondary,
              },
            ]}
          >
            {isRTL
              ? 'بلاغات اليوم'
              : 'Today'}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.notice,
          {
            backgroundColor:
              isDark
                ? '#2A2113'
                : '#FFF8E7',
            flexDirection:
              direction,
          },
        ]}
      >
        <Ionicons
          name="information-circle"
          size={18}
          color="#D88B00"
        />

        <Text
          style={[
            styles.noticeText,
            {
              color:
                theme.colors.text,
              textAlign,
            },
          ]}
        >
          {isRTL
            ? 'استخدم البلاغ عند وجود تأخير، عطل، حادث أو أي حالة تحتاج متابعة الإدارة.'
            : 'Use reports for delays, breakdowns, accidents, or situations requiring administration attention.'}
        </Text>
      </View>

      {loading ? (
        <View
          style={
            styles.loading
          }
        >
          <ActivityIndicator
            size="large"
            color="#E24C4B"
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
              ? 'جاري تحميل البلاغات...'
              : 'Loading reports...'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={
            incidents
          }
          keyExtractor={
            (item) =>
              item.id
          }
          renderItem={
            renderIncident
          }
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              tintColor="#E24C4B"
              onRefresh={() => {
                setRefreshing(
                  true
                );
                void load(false);
              }}
            />
          }
          contentContainerStyle={
            incidents.length
              ? styles.listContent
              : styles.emptyContent
          }
          ListEmptyComponent={
            <View
              style={
                styles.empty
              }
            >
              <View
                style={
                  styles.emptyIcon
                }
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={37}
                  color="#10A66A"
                />
              </View>

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
                  ? 'لا توجد بلاغات'
                  : 'No Reports'}
              </Text>

              <Text
                style={[
                  styles.emptySub,
                  {
                    color:
                      theme.colors.textSecondary,
                  },
                ]}
              >
                {isRTL
                  ? 'عند الحاجة اضغط زر + لإرسال بلاغ جديد للإدارة.'
                  : 'Tap + when you need to send a new report to administration.'}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={
          formVisible
        }
        animationType="slide"
        transparent
        onRequestClose={() =>
          !saving &&
          setFormVisible(false)
        }
      >
        <KeyboardAvoidingView
          behavior={
            Platform.OS ===
            'ios'
              ? 'padding'
              : undefined
          }
          style={
            styles.modalBackdrop
          }
        >
          <View
            style={[
              styles.formCard,
              {
                backgroundColor:
                  theme.colors.surface,
              },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                {
                  flexDirection:
                    direction,
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
                    styles.modalTitle,
                    {
                      color:
                        theme.colors.text,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'بلاغ جديد'
                    : 'New Report'}
                </Text>

                <Text
                  style={[
                    styles.modalSub,
                    {
                      color:
                        theme.colors.textSecondary,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'سيتم إرسال البلاغ للإدارة وربطه بالباص والسائق.'
                    : 'The report will be linked to the driver and bus.'}
                </Text>
              </View>

              <Pressable
                disabled={
                  saving
                }
                onPress={() =>
                  setFormVisible(false)
                }
                style={
                  styles.closeButton
                }
              >
                <Ionicons
                  name="close"
                  size={21}
                  color={
                    theme.colors.text
                  }
                />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.formScroll
              }
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
                {isRTL
                  ? 'نوع البلاغ'
                  : 'Report Type'}
              </Text>

              <View
                style={
                  styles.typeGrid
                }
              >
                {INCIDENT_TYPES.map(
                  (item) => {
                    const active =
                      selectedType ===
                      item.key;

                    return (
                      <Pressable
                        key={
                          item.key
                        }
                        onPress={() =>
                          chooseType(
                            item
                          )
                        }
                        style={[
                          styles.typeCard,
                          {
                            borderColor:
                              active
                                ? '#E24C4B'
                                : theme.colors.border,
                            backgroundColor:
                              active
                                ? isDark
                                  ? '#321D1D'
                                  : '#FEF3F2'
                                : theme.colors.surface,
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            item.icon
                          }
                          size={20}
                          color={
                            active
                              ? '#E24C4B'
                              : theme.colors.textSecondary
                          }
                        />

                        <Text
                          numberOfLines={2}
                          style={[
                            styles.typeLabel,
                            {
                              color:
                                active
                                  ? '#E24C4B'
                                  : theme.colors.text,
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
                {isRTL
                  ? 'درجة الخطورة'
                  : 'Severity'}
              </Text>

              <View
                style={[
                  styles.severityRow,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                {SEVERITIES.map(
                  (item) => {
                    const active =
                      severity ===
                      item.key;

                    const meta =
                      severityMeta(
                        item.key,
                        isRTL
                      );

                    return (
                      <Pressable
                        key={
                          item.key
                        }
                        onPress={() =>
                          setSeverity(
                            item.key
                          )
                        }
                        style={[
                          styles.severityChoice,
                          {
                            borderColor:
                              active
                                ? meta.color
                                : theme.colors.border,
                            backgroundColor:
                              active
                                ? meta.bg
                                : theme.colors.surface,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.severityChoiceText,
                            {
                              color:
                                active
                                  ? meta.color
                                  : theme.colors.textSecondary,
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
                {isRTL
                  ? 'تفاصيل البلاغ'
                  : 'Report Details'}
              </Text>

              <TextInput
                value={
                  details
                }
                onChangeText={
                  setDetails
                }
                multiline
                maxLength={1000}
                placeholder={
                  isRTL
                    ? 'اكتب ما حدث بشكل واضح...'
                    : 'Describe what happened...'
                }
                placeholderTextColor="#98A2B3"
                textAlignVertical="top"
                style={[
                  styles.detailsInput,
                  {
                    color:
                      theme.colors.text,
                    borderColor:
                      theme.colors.border,
                    backgroundColor:
                      theme.colors.background,
                    textAlign,
                  },
                ]}
              />

              <Text
                style={[
                  styles.counter,
                  {
                    color:
                      theme.colors.textSecondary,
                    textAlign:
                      isRTL
                        ? 'left'
                        : 'right',
                  },
                ]}
              >
                {details.length}/1000
              </Text>

              <Pressable
                disabled={
                  saving
                }
                onPress={
                  submitIncident
                }
                style={[
                  styles.submitButton,
                  {
                    opacity:
                      saving
                        ? 0.65
                        : 1,
                  },
                ]}
              >
                {saving ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="send"
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.submitText
                      }
                    >
                      {isRTL
                        ? 'إرسال البلاغ للإدارة'
                        : 'Send Report'}
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={
          !!selectedIncident
        }
        animationType="fade"
        transparent
        onRequestClose={() =>
          setSelectedIncident(
            null
          )
        }
      >
        <View
          style={
            styles.detailBackdrop
          }
        >
          {!!selectedIncident && (
            <View
              style={[
                styles.detailCard,
                {
                  backgroundColor:
                    theme.colors.surface,
                },
              ]}
            >
              <View
                style={[
                  styles.modalHeader,
                  {
                    flexDirection:
                      direction,
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
                      styles.modalTitle,
                      {
                        color:
                          theme.colors.text,
                        textAlign,
                      },
                    ]}
                  >
                    {selectedIncident.title}
                  </Text>

                  <Text
                    style={[
                      styles.modalSub,
                      {
                        color:
                          theme.colors.textSecondary,
                        textAlign,
                      },
                    ]}
                  >
                    {formatDateTime(
                      selectedIncident.happened_at,
                      isRTL
                    )}
                  </Text>
                </View>

                <Pressable
                  onPress={() =>
                    setSelectedIncident(
                      null
                    )
                  }
                  style={
                    styles.closeButton
                  }
                >
                  <Ionicons
                    name="close"
                    size={21}
                    color={
                      theme.colors.text
                    }
                  />
                </Pressable>
              </View>

              {(() => {
                const meta =
                  severityMeta(
                    selectedIncident.severity,
                    isRTL
                  );

                return (
                  <View
                    style={[
                      styles.detailSeverity,
                      {
                        backgroundColor:
                          meta.bg,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        meta.icon
                      }
                      size={17}
                      color={
                        meta.color
                      }
                    />

                    <Text
                      style={[
                        styles.detailSeverityText,
                        {
                          color:
                            meta.color,
                        },
                      ]}
                    >
                      {meta.label}
                    </Text>
                  </View>
                );
              })()}

              <Text
                style={[
                  styles.detailText,
                  {
                    color:
                      theme.colors.text,
                    textAlign,
                  },
                ]}
              >
                {selectedIncident.details ||
                  (isRTL
                    ? 'لا توجد تفاصيل إضافية.'
                    : 'No additional details.')}
              </Text>

              <Pressable
                onPress={() =>
                  setSelectedIncident(
                    null
                  )
                }
                style={
                  styles.doneButton
                }
              >
                <Text
                  style={
                    styles.doneText
                  }
                >
                  {isRTL
                    ? 'إغلاق'
                    : 'Close'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
    },

    header: {
      marginHorizontal: 14,
      marginTop: 6,
      minHeight: 72,
      borderWidth: 1,
      borderRadius: 22,
      paddingHorizontal: 12,
      alignItems: 'center',
      gap: 10,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },

    headerIcon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      backgroundColor: '#FDECEC',
      alignItems: 'center',
      justifyContent: 'center',
    },

    headerTitle: {
      fontSize: 17,
      fontWeight: '900',
    },

    headerSub: {
      marginTop: 2,
      fontSize: 10,
      fontWeight: '700',
    },

    addButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: '#E24C4B',
      alignItems: 'center',
      justifyContent: 'center',
    },

    summaryRow: {
      marginTop: 12,
      marginHorizontal: 14,
      gap: 8,
    },

    summaryCard: {
      flex: 1,
      minHeight: 78,
      borderWidth: 1,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },

    summaryCount: {
      marginTop: 3,
      fontSize: 17,
      fontWeight: '900',
    },

    summaryLabel: {
      marginTop: 1,
      fontSize: 9,
      fontWeight: '800',
    },

    notice: {
      marginTop: 10,
      marginHorizontal: 14,
      borderRadius: 15,
      padding: 10,
      alignItems: 'flex-start',
      gap: 7,
    },

    noticeText: {
      flex: 1,
      fontSize: 9,
      lineHeight: 14,
      fontWeight: '700',
    },

    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    loadingText: {
      marginTop: 9,
      fontSize: 11,
      fontWeight: '700',
    },

    listContent: {
      padding: 14,
      paddingBottom: 115,
      gap: 9,
    },

    reportCard: {
      borderWidth: 1,
      borderRadius: 18,
      padding: 11,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 7,
      elevation: 2,
    },

    reportTop: {
      gap: 9,
      alignItems: 'flex-start',
    },

    reportIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },

    reportTitle: {
      fontSize: 13,
      fontWeight: '900',
    },

    reportDetails: {
      marginTop: 3,
      fontSize: 9,
      lineHeight: 14,
      fontWeight: '700',
    },

    reportFooter: {
      marginTop: 9,
      paddingTop: 8,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor: '#E4E7EC',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    severityBadge: {
      minHeight: 26,
      borderRadius: 9,
      paddingHorizontal: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },

    severityText: {
      fontSize: 8,
      fontWeight: '900',
    },

    dateText: {
      fontSize: 8,
      fontWeight: '700',
    },

    emptyContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingBottom: 110,
    },

    empty: {
      alignItems: 'center',
      paddingHorizontal: 25,
    },

    emptyIcon: {
      width: 74,
      height: 74,
      borderRadius: 24,
      backgroundColor: '#ECFDF3',
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyTitle: {
      marginTop: 12,
      fontSize: 15,
      fontWeight: '900',
      textAlign: 'center',
    },

    emptySub: {
      marginTop: 5,
      fontSize: 10,
      lineHeight: 16,
      fontWeight: '700',
      textAlign: 'center',
    },

    modalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor:
        'rgba(2,6,23,0.55)',
    },

    formCard: {
      maxHeight: '92%',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 24,
    },

    modalHeader: {
      alignItems: 'center',
      gap: 10,
    },

    modalTitle: {
      fontSize: 17,
      fontWeight: '900',
    },

    modalSub: {
      marginTop: 2,
      fontSize: 9,
      lineHeight: 14,
      fontWeight: '700',
    },

    closeButton: {
      width: 39,
      height: 39,
      borderRadius: 13,
      backgroundColor:
        'rgba(127,127,127,0.09)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    formScroll: {
      paddingTop: 15,
      paddingBottom: 20,
    },

    sectionTitle: {
      marginTop: 4,
      marginBottom: 8,
      fontSize: 11,
      fontWeight: '900',
    },

    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 15,
    },

    typeCard: {
      width: '31.5%',
      minHeight: 76,
      borderWidth: 1,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },

    typeLabel: {
      marginTop: 5,
      fontSize: 8,
      lineHeight: 11,
      fontWeight: '900',
      textAlign: 'center',
    },

    severityRow: {
      gap: 6,
      marginBottom: 15,
    },

    severityChoice: {
      flex: 1,
      minHeight: 42,
      borderWidth: 1,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },

    severityChoiceText: {
      fontSize: 8,
      fontWeight: '900',
      textAlign: 'center',
    },

    detailsInput: {
      minHeight: 120,
      borderWidth: 1,
      borderRadius: 15,
      padding: 12,
      fontSize: 11,
      lineHeight: 18,
      fontWeight: '700',
    },

    counter: {
      marginTop: 5,
      fontSize: 8,
      fontWeight: '700',
    },

    submitButton: {
      minHeight: 52,
      marginTop: 14,
      borderRadius: 16,
      backgroundColor: '#E24C4B',
      flexDirection: 'row',
      gap: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },

    submitText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '900',
    },

    detailBackdrop: {
      flex: 1,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(2,6,23,0.55)',
    },

    detailCard: {
      width: '100%',
      maxWidth: 520,
      borderRadius: 24,
      padding: 16,
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 20,
      elevation: 12,
    },

    detailSeverity: {
      alignSelf: 'flex-start',
      marginTop: 15,
      minHeight: 32,
      paddingHorizontal: 10,
      borderRadius: 10,
      flexDirection: 'row',
      gap: 5,
      alignItems: 'center',
    },

    detailSeverityText: {
      fontSize: 9,
      fontWeight: '900',
    },

    detailText: {
      marginTop: 14,
      fontSize: 12,
      lineHeight: 19,
      fontWeight: '700',
    },

    doneButton: {
      minHeight: 49,
      marginTop: 17,
      borderRadius: 15,
      backgroundColor: '#0A2D44',
      alignItems: 'center',
      justifyContent: 'center',
    },

    doneText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '900',
    },
  });