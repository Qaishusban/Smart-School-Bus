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
  Image,
  Linking,
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

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

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
  DriverStudentCategory,
  DriverStudentSnapshot,
  DriverStudentsTripMode,
  getAutomaticDriverTripMode,
  getDriverRouteStudentsSnapshot,
} from '../../services/attendanceService';

type FilterKey =
  | 'all'
  | DriverStudentCategory;

type SortKey =
  | 'route_asc'
  | 'route_desc'
  | 'name_asc'
  | 'name_desc'
  | 'status';

type PhoneFilter =
  | 'all'
  | 'with_phone'
  | 'without_phone';

type InstructionFilter =
  | 'all'
  | 'with_instruction'
  | 'without_instruction';

function safeText(
  value: unknown
) {
  return String(
    value ?? ''
  ).trim();
}

function escapeHtml(
  value: unknown
) {
  return safeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function localDateKey(
  date: Date = new Date()
) {
  const y =
    date.getFullYear();

  const m =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const d =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${y}-${m}-${d}`;
}

function studentName(
  item: DriverStudentSnapshot
) {
  const student =
    item.student ??
    {};

  return String(
    student.full_name ??
    student.name ??
    student.full_name_ar ??
    student.full_name_en ??
    'Student'
  );
}

function studentSecondary(
  item: DriverStudentSnapshot,
  isRTL: boolean
) {
  const student =
    item.student ??
    {};

  const grade =
    student.grade_name ??
    student.grade ??
    student.class_name ??
    student.class ??
    null;

  const section =
    student.section_name ??
    student.section ??
    null;

  const code =
    student.student_code ??
    student.code ??
    student.admission_no ??
    null;

  const parts =
    [
      grade,
      section,
      code,
    ].filter(Boolean);

  if (parts.length) {
    return parts.join(
      ' • '
    );
  }

  return isRTL
    ? `ترتيب المسار ${item.order_index}`
    : `Route order ${item.order_index}`;
}

function categoryMeta(
  category: DriverStudentCategory,
  isRTL: boolean
) {
  if (
    category ===
    'picked_up'
  ) {
    return {
      label:
        isRTL
          ? 'تم الاستلام'
          : 'Picked Up',
      color:
        '#10A66A',
      bg:
        '#ECFDF3',
      icon:
        'enter' as const,
    };
  }

  if (
    category ===
    'delivered'
  ) {
    return {
      label:
        isRTL
          ? 'تم التوصيل'
          : 'Delivered',
      color:
        '#7C3AED',
      bg:
        '#F4F0FF',
      icon:
        'checkmark-done' as const,
    };
  }

  if (
    category ===
    'excused'
  ) {
    return {
      label:
        isRTL
          ? 'مجاز / عذر'
          : 'Excused',
      color:
        '#D92D20',
      bg:
        '#FEF3F2',
      icon:
        'moon' as const,
    };
  }

  return {
    label:
      isRTL
        ? 'على المسار'
        : 'On Route',
    color:
      '#D88B00',
    bg:
      '#FFF8E7',
    icon:
      'navigate' as const,
  };
}

function statusOrder(
  category: DriverStudentCategory
) {
  const map:
    Record<
      DriverStudentCategory,
      number
    > = {
      on_route: 1,
      picked_up: 2,
      delivered: 3,
      excused: 4,
    };

  return map[
    category
  ];
}

export default function DriverStudentsScreen({
  navigation,
}: any) {
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
    useState(
      true
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
    );

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    filter,
    setFilter,
  ] =
    useState<
      FilterKey
    >(
      'all'
    );

  const [
    mode,
    setMode,
  ] =
    useState<
      DriverStudentsTripMode
    >(
      getAutomaticDriverTripMode()
    );

  const [
    dashboard,
    setDashboard,
  ] =
    useState<any>(
      null
    );

  const [
    students,
    setStudents,
  ] =
    useState<
      DriverStudentSnapshot[]
    >([]);

  const [
    optionsVisible,
    setOptionsVisible,
  ] =
    useState(
      false
    );

  const [
    exportVisible,
    setExportVisible,
  ] =
    useState(
      false
    );

  const [
    sortBy,
    setSortBy,
  ] =
    useState<
      SortKey
    >(
      'route_asc'
    );

  const [
    phoneFilter,
    setPhoneFilter,
  ] =
    useState<
      PhoneFilter
    >(
      'all'
    );

  const [
    instructionFilter,
    setInstructionFilter,
  ] =
    useState<
      InstructionFilter
    >(
      'all'
    );

  const [
    exportFilteredOnly,
    setExportFilteredOnly,
  ] =
    useState(
      true
    );

  const [
    exporting,
    setExporting,
  ] =
    useState(
      false
    );

  const driverId =
    user?.id ??
    null;

  const routeId =
    dashboard?.route?.id ??
    null;

  const busId =
    dashboard?.bus?.id ??
    user?.bus_id ??
    null;

  const school =
  dashboard?.school ??
  null;

const schoolName =
  safeText(
    school?.name ??
    school?.school_name ??
    school?.name_ar ??
    school?.name_en ??
    dashboard?.school_name
  ) ||
  (isRTL
    ? 'المدرسة'
    : 'School');

const schoolLogo =
  safeText(
    school?.logo_url ??
    school?.logo ??
    school?.logo_path ??
    dashboard?.school_logo
  );

  const routeName =
    safeText(
      dashboard?.route?.name ??
      dashboard?.route?.route_name
    ) ||
    (isRTL
      ? 'المسار'
      : 'Route');

  const busNumber =
    safeText(
      dashboard?.bus?.bus_number ??
      dashboard?.bus?.number ??
      user?.bus_number
    ) ||
    '—';

  const plateNumber =
    safeText(
      dashboard?.bus?.plate_number ??
      dashboard?.bus?.plate_no
    );

  const load =
    useCallback(
      async (
        showSpinner:
          boolean = true
      ) => {
        if (
          !driverId
        ) {
          setLoading(
            false
          );

          return;
        }

        try {
          if (
            showSpinner
          ) {
            setLoading(
              true
            );
          }

          const currentMode =
            getAutomaticDriverTripMode();

          setMode(
            currentMode
          );

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

          const resolvedRouteId =
            result?.route?.id ??
            null;

          const resolvedBusId =
            result?.bus?.id ??
            user?.bus_id ??
            null;

          if (
            !resolvedRouteId
          ) {
            setStudents(
              []
            );

            return;
          }

          const rows =
            await getDriverRouteStudentsSnapshot({
              routeId:
                resolvedRouteId,

              busId:
                resolvedBusId,

              mode:
                currentMode,

              now:
                new Date(),
            });

          setStudents(
            rows
          );
        } catch (
          error: any
        ) {
          console.log(
            'DriverStudents load:',
            error
          );

          Alert.alert(
            isRTL
              ? 'تعذر تحميل الطلاب'
              : 'Unable to Load Students',

            error?.message ??
              String(
                error
              )
          );
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );
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

  useEffect(() => {
    const timer =
      setInterval(
        () => {
          const currentMode =
            getAutomaticDriverTripMode();

          if (
            currentMode !==
            mode
          ) {
            void load(
              false
            );
          }
        },
        60000
      );

    return () =>
      clearInterval(
        timer
      );
  }, [
    load,
    mode,
  ]);

  const counts =
    useMemo(
      () => ({
        all:
          students.length,

        on_route:
          students.filter(
            (
              item
            ) =>
              item.category ===
              'on_route'
          ).length,

        picked_up:
          students.filter(
            (
              item
            ) =>
              item.category ===
              'picked_up'
          ).length,

        delivered:
          students.filter(
            (
              item
            ) =>
              item.category ===
              'delivered'
          ).length,

        excused:
          students.filter(
            (
              item
            ) =>
              item.category ===
              'excused'
          ).length,
      }),
      [
        students,
      ]
    );

  const activeAdvancedFilters =
    useMemo(
      () => {
        let count =
          0;

        if (
          sortBy !==
          'route_asc'
        ) {
          count +=
            1;
        }

        if (
          phoneFilter !==
          'all'
        ) {
          count +=
            1;
        }

        if (
          instructionFilter !==
          'all'
        ) {
          count +=
            1;
        }

        return count;
      },
      [
        instructionFilter,
        phoneFilter,
        sortBy,
      ]
    );

  const visibleStudents =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        let rows =
          students.filter(
            (
              item
            ) => {
              if (
                filter !==
                  'all' &&
                item.category !==
                  filter
              ) {
                return false;
              }

              if (
                phoneFilter ===
                  'with_phone' &&
                !item.parent_phone
              ) {
                return false;
              }

              if (
                phoneFilter ===
                  'without_phone' &&
                item.parent_phone
              ) {
                return false;
              }

              const hasInstruction =
                Boolean(
                  item.instruction_status ||
                  item.instruction_note
                );

              if (
                instructionFilter ===
                  'with_instruction' &&
                !hasInstruction
              ) {
                return false;
              }

              if (
                instructionFilter ===
                  'without_instruction' &&
                hasInstruction
              ) {
                return false;
              }

              if (
                !query
              ) {
                return true;
              }

              const haystack =
                [
                  studentName(
                    item
                  ),

                  studentSecondary(
                    item,
                    isRTL
                  ),

                  item.parent_name ??
                    '',

                  item.parent_phone ??
                    '',

                  item.instruction_note ??
                    '',

                  item.instruction_status ??
                    '',

                  String(
                    item.order_index
                  ),
                ]
                  .join(' ')
                  .toLowerCase();

              return haystack.includes(
                query
              );
            }
          );

        rows =
          [...rows].sort(
            (
              a,
              b
            ) => {
              if (
                sortBy ===
                'route_desc'
              ) {
                return (
                  b.order_index -
                  a.order_index
                );
              }

              if (
                sortBy ===
                'name_asc'
              ) {
                return studentName(
                  a
                ).localeCompare(
                  studentName(
                    b
                  ),
                  isRTL
                    ? 'ar'
                    : 'en'
                );
              }

              if (
                sortBy ===
                'name_desc'
              ) {
                return studentName(
                  b
                ).localeCompare(
                  studentName(
                    a
                  ),
                  isRTL
                    ? 'ar'
                    : 'en'
                );
              }

              if (
                sortBy ===
                'status'
              ) {
                const diff =
                  statusOrder(
                    a.category
                  ) -
                  statusOrder(
                    b.category
                  );

                if (
                  diff !==
                  0
                ) {
                  return diff;
                }

                return (
                  a.order_index -
                  b.order_index
                );
              }

              return (
                a.order_index -
                b.order_index
              );
            }
          );

        return rows;
      },
      [
        filter,
        instructionFilter,
        isRTL,
        phoneFilter,
        search,
        sortBy,
        students,
      ]
    );

  function resetAdvancedFilters() {
    setSortBy(
      'route_asc'
    );

    setPhoneFilter(
      'all'
    );

    setInstructionFilter(
      'all'
    );
  }

  async function callParent(
    item:
      DriverStudentSnapshot
  ) {
    const phone =
      String(
        item.parent_phone ??
        ''
      ).trim();

    if (
      !phone
    ) {
      Alert.alert(
        isRTL
          ? 'لا يوجد رقم'
          : 'No Phone Number',

        isRTL
          ? 'لا يوجد رقم هاتف مسجل لولي الأمر.'
          : 'No parent phone number is available.'
      );

      return;
    }

    const url =
      `tel:${phone.replace(
        /[^\d+]/g,
        ''
      )}`;

    const supported =
      await Linking.canOpenURL(
        url
      );

    if (
      supported
    ) {
      await Linking.openURL(
        url
      );
    }
  }

  function exportRows() {
    return exportFilteredOnly
      ? visibleStudents
      : students;
  }

  function exportFileBase() {
    const modePart =
      mode ===
      'to_school'
        ? 'morning'
        : 'evening';

    return `driver-students-${modePart}-${localDateKey()}`;
  }

  function buildExportData(
    rows:
      DriverStudentSnapshot[]
  ) {
    return rows.map(
      (
        item,
        index
      ) => {
        const meta =
          categoryMeta(
            item.category,
            isRTL
          );

        return {
          '#':
            index +
            1,

          [isRTL
            ? 'ترتيب المسار'
            : 'Route Order']:
            item.order_index,

          [isRTL
            ? 'اسم الطالب'
            : 'Student Name']:
            studentName(
              item
            ),

          [isRTL
            ? 'الصف / الرقم'
            : 'Grade / Code']:
            studentSecondary(
              item,
              isRTL
            ),

          [isRTL
            ? 'الحالة'
            : 'Status']:
            meta.label,

          [isRTL
            ? 'وقت الرحلة'
            : 'Trip Time']:
            mode ===
            'to_school'
              ? item.pickup_time ??
                ''
              : item.dropoff_time ??
                '',

          [isRTL
            ? 'ولي الأمر'
            : 'Parent']:
            item.parent_name ??
            '',

          [isRTL
            ? 'هاتف ولي الأمر'
            : 'Parent Phone']:
            item.parent_phone ??
            '',

          [isRTL
            ? 'تعليمات ولي الأمر'
            : 'Parent Instruction']:
            [
              item.instruction_status,
              item.instruction_note,
            ]
              .filter(
                Boolean
              )
              .join(
                ' - '
              ),

          [isRTL
            ? 'آخر تحديث'
            : 'Last Update']:
            item.latest_attendance?.created_at
              ? new Date(
                  item.latest_attendance.created_at
                ).toLocaleString(
                  isRTL
                    ? 'ar-JO'
                    : 'en-US'
                )
              : '',
        };
      }
    );
  }

  async function exportExcel() {
    const rows =
      exportRows();

    if (
      !rows.length
    ) {
      Alert.alert(
        isRTL
          ? 'لا توجد بيانات'
          : 'No Data',
        isRTL
          ? 'لا توجد بيانات متاحة للتصدير.'
          : 'There is no data available to export.'
      );

      return;
    }

    try {
      setExporting(
        true
      );

      const data =
        buildExportData(
          rows
        );

      const worksheet =
        XLSX.utils.json_to_sheet(
          data
        );

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        isRTL
          ? 'طلاب الرحلة'
          : 'Trip Students'
      );

      const binary =
        XLSX.write(
          workbook,
          {
            type:
              'base64',
            bookType:
              'xlsx',
          }
        );

      const path =
        `${FileSystem.cacheDirectory}${exportFileBase()}.xlsx`;

      await FileSystem.writeAsStringAsync(
        path,
        binary,
        {
          encoding:
            FileSystem.EncodingType.Base64,
        }
      );

      const canShare =
        await Sharing.isAvailableAsync();

      if (
        !canShare
      ) {
        throw new Error(
          isRTL
            ? 'المشاركة غير متاحة على هذا الجهاز.'
            : 'Sharing is not available on this device.'
        );
      }

      await Sharing.shareAsync(
        path,
        {
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle:
            isRTL
              ? 'تصدير ملف Excel'
              : 'Export Excel',
          UTI:
            'org.openxmlformats.spreadsheetml.sheet',
        }
      );

      setExportVisible(
        false
      );
    } catch (
      error: any
    ) {
      console.log(
        'DriverStudents exportExcel:',
        error
      );

      Alert.alert(
        isRTL
          ? 'تعذر تصدير Excel'
          : 'Excel Export Failed',
        error?.message ??
          String(
            error
          )
      );
    } finally {
      setExporting(
        false
      );
    }
  }

  async function exportPdf() {
    const rows =
      exportRows();

    if (
      !rows.length
    ) {
      Alert.alert(
        isRTL
          ? 'لا توجد بيانات'
          : 'No Data',
        isRTL
          ? 'لا توجد بيانات متاحة للتصدير.'
          : 'There is no data available to export.'
      );

      return;
    }

    try {
      setExporting(
        true
      );

      const tripLabel =
        mode ===
        'to_school'
          ? isRTL
            ? 'الجولة الصباحية'
            : 'Morning Trip'
          : isRTL
          ? 'الجولة المسائية'
          : 'Evening Trip';

      const dateLabel =
        new Date().toLocaleDateString(
          isRTL
            ? 'ar-JO'
            : 'en-GB',
          {
            year:
              'numeric',
            month:
              'long',
            day:
              'numeric',
          }
        );

      const rowsHtml =
        rows
          .map(
            (
              item,
              index
            ) => {
              const meta =
                categoryMeta(
                  item.category,
                  isRTL
                );

              const instruction =
                [
                  item.instruction_status,
                  item.instruction_note,
                ]
                  .filter(
                    Boolean
                  )
                  .join(
                    ' - '
                  );

              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(item.order_index)}</td>
                  <td class="name">${escapeHtml(studentName(item))}</td>
                  <td>${escapeHtml(studentSecondary(item, isRTL))}</td>
                  <td><span class="badge">${escapeHtml(meta.label)}</span></td>
                  <td>${escapeHtml(
                    mode === 'to_school'
                      ? item.pickup_time ?? '—'
                      : item.dropoff_time ?? '—'
                  )}</td>
                  <td>${escapeHtml(item.parent_name ?? '—')}</td>
                  <td>${escapeHtml(item.parent_phone ?? '—')}</td>
                  <td>${escapeHtml(instruction || '—')}</td>
                </tr>
              `;
            }
          )
          .join(
            ''
          );

      const logoHtml =
        schoolLogo
          ? `<img class="logo" src="${escapeHtml(schoolLogo)}" />`
          : `<div class="logo-fallback">SB</div>`;

      const html = `
<!DOCTYPE html>
<html dir="${isRTL ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 landscape; margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    margin: 0;
    color: #0A2D44;
    background: #ffffff;
    direction: ${isRTL ? 'rtl' : 'ltr'};
  }
  .header {
    border: 1px solid #DDE4EA;
    border-radius: 18px;
    padding: 16px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }
  .logo {
    width: 68px;
    height: 68px;
    object-fit: contain;
    border-radius: 14px;
  }
  .logo-fallback {
    width: 68px;
    height: 68px;
    border-radius: 14px;
    background: #F7B83A;
    color: #0A2D44;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 900;
  }
  .head-main { flex: 1; }
  .school {
    font-size: 21px;
    font-weight: 900;
    margin-bottom: 4px;
  }
  .report-title {
    font-size: 13px;
    color: #475467;
    font-weight: 700;
  }
  .meta {
    margin-top: 9px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 10px;
    color: #667085;
  }
  .pill {
    border: 1px solid #E4E7EC;
    border-radius: 999px;
    padding: 5px 8px;
  }
  .summary {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .summary-card {
    border: 1px solid #E4E7EC;
    border-radius: 12px;
    padding: 9px;
    text-align: center;
  }
  .summary-value {
    font-size: 17px;
    font-weight: 900;
  }
  .summary-label {
    margin-top: 2px;
    color: #667085;
    font-size: 9px;
    font-weight: 700;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th {
    background: #0A2D44;
    color: #ffffff;
    font-size: 8.5px;
    padding: 7px 5px;
    border: 1px solid #163F57;
  }
  td {
    border: 1px solid #E4E7EC;
    padding: 6px 5px;
    font-size: 8px;
    vertical-align: middle;
    word-wrap: break-word;
  }
  tbody tr:nth-child(even) {
    background: #F9FAFB;
  }
  td.name {
    font-weight: 800;
  }
  .badge {
    display: inline-block;
    padding: 3px 6px;
    border-radius: 999px;
    background: #FFF8E7;
    color: #8A5A00;
    font-weight: 800;
  }
  .footer {
    margin-top: 12px;
    border-top: 1px solid #E4E7EC;
    padding-top: 8px;
    display: flex;
    justify-content: space-between;
    color: #98A2B3;
    font-size: 8px;
  }
</style>
</head>
<body>
  <div class="header">
    ${logoHtml}
    <div class="head-main">
      <div class="school">${escapeHtml(schoolName)}</div>
      <div class="report-title">
        ${isRTL ? 'كشف طلاب الرحلة' : 'Driver Trip Students Report'} •
        ${escapeHtml(tripLabel)}
      </div>
      <div class="meta">
        <span class="pill">${isRTL ? 'التاريخ' : 'Date'}: ${escapeHtml(dateLabel)}</span>
        <span class="pill">${isRTL ? 'المسار' : 'Route'}: ${escapeHtml(routeName)}</span>
        <span class="pill">${isRTL ? 'الباص' : 'Bus'}: ${escapeHtml(busNumber)}</span>
        ${
          plateNumber
            ? `<span class="pill">${isRTL ? 'اللوحة' : 'Plate'}: ${escapeHtml(plateNumber)}</span>`
            : ''
        }
        <span class="pill">${isRTL ? 'عدد السجلات' : 'Records'}: ${rows.length}</span>
      </div>
    </div>
  </div>

  <div class="summary">
    <div class="summary-card">
      <div class="summary-value">${counts.all}</div>
      <div class="summary-label">${isRTL ? 'إجمالي الطلاب' : 'Total'}</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${counts.on_route}</div>
      <div class="summary-label">${isRTL ? 'على المسار' : 'On Route'}</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${counts.picked_up}</div>
      <div class="summary-label">${isRTL ? 'تم الاستلام' : 'Picked Up'}</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${counts.delivered}</div>
      <div class="summary-label">${isRTL ? 'تم التوصيل' : 'Delivered'}</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${counts.excused}</div>
      <div class="summary-label">${isRTL ? 'مجاز / عذر' : 'Excused'}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>${isRTL ? 'الترتيب' : 'Order'}</th>
        <th>${isRTL ? 'اسم الطالب' : 'Student'}</th>
        <th>${isRTL ? 'الصف / الرقم' : 'Grade / Code'}</th>
        <th>${isRTL ? 'الحالة' : 'Status'}</th>
        <th>${isRTL ? 'الوقت' : 'Time'}</th>
        <th>${isRTL ? 'ولي الأمر' : 'Parent'}</th>
        <th>${isRTL ? 'الهاتف' : 'Phone'}</th>
        <th>${isRTL ? 'التعليمات' : 'Instruction'}</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <span>${escapeHtml(schoolName)}</span>
    <span>${isRTL ? 'Smart School Bus • تقرير السائق' : 'Smart School Bus • Driver Report'}</span>
  </div>
</body>
</html>
      `;

      const result =
        await Print.printToFileAsync({
          html,
          base64:
            false,
        });

      const finalPath =
        `${FileSystem.cacheDirectory}${exportFileBase()}.pdf`;

      await FileSystem.copyAsync({
        from:
          result.uri,
        to:
          finalPath,
      });

      const canShare =
        await Sharing.isAvailableAsync();

      if (
        !canShare
      ) {
        throw new Error(
          isRTL
            ? 'المشاركة غير متاحة على هذا الجهاز.'
            : 'Sharing is not available on this device.'
        );
      }

      await Sharing.shareAsync(
        finalPath,
        {
          mimeType:
            'application/pdf',
          dialogTitle:
            isRTL
              ? 'تصدير PDF'
              : 'Export PDF',
          UTI:
            'com.adobe.pdf',
        }
      );

      setExportVisible(
        false
      );
    } catch (
      error: any
    ) {
      console.log(
        'DriverStudents exportPdf:',
        error
      );

      Alert.alert(
        isRTL
          ? 'تعذر تصدير PDF'
          : 'PDF Export Failed',
        error?.message ??
          String(
            error
          )
      );
    } finally {
      setExporting(
        false
      );
    }
  }

  function renderStudent({
    item,
  }: {
    item:
      DriverStudentSnapshot;
  }) {
    const meta =
      categoryMeta(
        item.category,
        isRTL
      );

    return (
      <Pressable
        style={[
          styles.studentCard,

          {
            backgroundColor:
              theme.colors.surface,

            borderColor:
              item.category ===
                'on_route'
                ? '#F7B83A'
                : theme.colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.studentTop,

            {
              flexDirection:
                direction,
            },
          ]}
        >
          <View
            style={[
              styles.orderBox,

              {
                backgroundColor:
                  item.category ===
                    'on_route'
                    ? '#F7B83A'
                    : isDark
                    ? '#263241'
                    : '#E9EEF5',
              },
            ]}
          >
            <Text
              style={[
                styles.orderText,

                {
                  color:
                    item.category ===
                      'on_route'
                      ? '#0A2D44'
                      : theme.colors.text,
                },
              ]}
            >
              {item.order_index}
            </Text>
          </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              numberOfLines={
                1
              }
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
                item
              )}
            </Text>

            <Text
              numberOfLines={
                1
              }
              style={[
                styles.studentSecondary,

                {
                  color:
                    theme.colors.textSecondary,

                  textAlign,
                },
              ]}
            >
              {studentSecondary(
                item,
                isRTL
              )}
            </Text>
          </View>

          <Pressable
            onPress={() =>
              callParent(
                item
              )
            }
            style={[
              styles.callButton,

              {
                opacity:
                  item.parent_phone
                    ? 1
                    : 0.35,
              },
            ]}
          >
            <Ionicons
              name="call"
              size={18}
              color="#10A66A"
            />
          </Pressable>
        </View>

        <View
          style={[
            styles.statusLine,

            {
              flexDirection:
                direction,
            },
          ]}
        >
          <View
            style={[
              styles.statusBadge,

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
              size={14}
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

          {!!item.parent_name && (
            <Text
              numberOfLines={
                1
              }
              style={[
                styles.parentText,

                {
                  color:
                    theme.colors.textSecondary,

                  textAlign,
                },
              ]}
            >
              {isRTL
                ? `ولي الأمر: ${item.parent_name}`
                : `Parent: ${item.parent_name}`}
            </Text>
          )}
        </View>

        {item.is_excused && (
          <View
            style={
              styles.instructionBox
            }
          >
            <Ionicons
              name="information-circle"
              size={17}
              color="#D92D20"
            />

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.instructionTitle
                }
              >
                {isRTL
                  ? 'تعليمات ولي الأمر'
                  : 'Parent Instruction'}
              </Text>

              <Text
                style={
                  styles.instructionText
                }
              >
                {[
                  item.instruction_status,
                  item.instruction_note,
                ]
                  .filter(
                    Boolean
                  )
                  .join(
                    ' • '
                  ) ||
                  (isRTL
                    ? 'الطالب مستثنى من هذه الجولة.'
                    : 'Student is excluded from this trip.')}
              </Text>
            </View>
          </View>
        )}

        <View
          style={[
            styles.timeRow,

            {
              flexDirection:
                direction,
            },
          ]}
        >
          <View
            style={
              styles.timeItem
            }
          >
            <Ionicons
              name="time-outline"
              size={14}
              color="#667085"
            />

            <Text
              style={[
                styles.timeText,

                {
                  color:
                    theme.colors.textSecondary,
                },
              ]}
            >
              {mode ===
              'to_school'
                ? item.pickup_time ??
                  '—'
                : item.dropoff_time ??
                  '—'}
            </Text>
          </View>

          {!!item.latest_attendance?.created_at && (
            <Text
              style={[
                styles.lastUpdate,

                {
                  color:
                    theme.colors.textSecondary,
                },
              ]}
            >
              {new Date(
                item.latest_attendance.created_at
              ).toLocaleTimeString(
                isRTL
                  ? 'ar-JO'
                  : 'en-US',
                {
                  hour:
                    '2-digit',
                  minute:
                    '2-digit',
                }
              )}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView
      edges={[
        'top',
      ]}
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
          styles.hero,

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
            styles.heroTop,

            {
              flexDirection:
                direction,
            },
          ]}
        >
          <View
            style={
              styles.logoWrap
            }
          >
            {schoolLogo ? (
              <Image
                source={{
                  uri:
                    schoolLogo,
                }}
                style={
                  styles.schoolLogo
                }
                resizeMode="contain"
              />
            ) : (
              <View
                style={
                  styles.logoFallback
                }
              >
                <Ionicons
                  name="school"
                  size={26}
                  color="#0A2D44"
                />
              </View>
            )}
          </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              numberOfLines={
                1
              }
              style={[
                styles.schoolName,

                {
                  color:
                    theme.colors.text,

                  textAlign,
                },
              ]}
            >
              {schoolName}
            </Text>

            <Text
              style={[
                styles.pageTitle,

                {
                  color:
                    theme.colors.textSecondary,

                  textAlign,
                },
              ]}
            >
              {isRTL
                ? 'إدارة طلاب رحلة السائق'
                : 'Driver Trip Students'}
            </Text>
          </View>

          <Pressable
            onPress={() =>
              load(
                false
              )
            }
            style={[
              styles.heroAction,

              {
                backgroundColor:
                  isDark
                    ? '#263241'
                    : '#F2F4F7',
              },
            ]}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={
                theme.colors.text
              }
            />
          </Pressable>
        </View>

        <View
          style={[
            styles.tripBanner,

            {
              flexDirection:
                direction,
            },
          ]}
        >
          <View
            style={
              styles.tripIcon
            }
          >
            <Ionicons
              name={
                mode ===
                'to_school'
                  ? 'sunny'
                  : 'moon'
              }
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
                styles.tripTitle,

                {
                  textAlign,
                },
              ]}
            >
              {mode ===
              'to_school'
                ? isRTL
                  ? 'الجولة الصباحية'
                  : 'Morning Trip'
                : isRTL
                ? 'الجولة المسائية'
                : 'Evening Trip'}
            </Text>

            <Text
              numberOfLines={
                1
              }
              style={[
                styles.tripSub,

                {
                  textAlign,
                },
              ]}
            >
              {routeName} • {isRTL
                ? 'باص'
                : 'Bus'} {busNumber}
              {plateNumber
                ? ` • ${plateNumber}`
                : ''}
            </Text>
          </View>

          <View
            style={
              styles.totalBadge
            }
          >
            <Text
              style={
                styles.totalBadgeValue
              }
            >
              {
                counts.all
              }
            </Text>

            <Text
              style={
                styles.totalBadgeLabel
              }
            >
              {isRTL
                ? 'طالب'
                : 'Students'}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={
          styles.toolbarRow
        }
      >
        <View
          style={[
            styles.searchBox,

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
            color="#98A2B3"
          />

          <TextInput
            value={
              search
            }
            onChangeText={
              setSearch
            }
            placeholder={
              isRTL
                ? 'اسم الطالب، ولي الأمر، الهاتف، الرقم...'
                : 'Student, parent, phone, code...'
            }
            placeholderTextColor="#98A2B3"
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
                color="#98A2B3"
              />
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={() =>
            setOptionsVisible(
              true
            )
          }
          style={[
            styles.squareAction,

            {
              backgroundColor:
                theme.colors.surface,

              borderColor:
                activeAdvancedFilters
                  ? '#F7B83A'
                  : theme.colors.border,
            },
          ]}
        >
          <Ionicons
            name="options"
            size={20}
            color={
              activeAdvancedFilters
                ? '#D88B00'
                : theme.colors.text
            }
          />

          {activeAdvancedFilters >
            0 && (
            <View
              style={
                styles.filterDot
              }
            >
              <Text
                style={
                  styles.filterDotText
                }
              >
                {
                  activeAdvancedFilters
                }
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() =>
            setExportVisible(
              true
            )
          }
          style={
            styles.exportButton
          }
        >
          <Ionicons
            name="download-outline"
            size={20}
            color="#0A2D44"
          />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={
          false
        }
        contentContainerStyle={[
          styles.filters,

          {
            flexDirection:
              direction,
          },
        ]}
      >
        <FilterChip
          active={
            filter ===
            'all'
          }
          count={
            counts.all
          }
          label={
            isRTL
              ? 'الكل'
              : 'All'
          }
          onPress={() =>
            setFilter(
              'all'
            )
          }
        />

        <FilterChip
          active={
            filter ===
            'on_route'
          }
          count={
            counts.on_route
          }
          label={
            isRTL
              ? 'على المسار'
              : 'On Route'
          }
          onPress={() =>
            setFilter(
              'on_route'
            )
          }
        />

        <FilterChip
          active={
            filter ===
            'picked_up'
          }
          count={
            counts.picked_up
          }
          label={
            isRTL
              ? 'تم الاستلام'
              : 'Picked'
          }
          onPress={() =>
            setFilter(
              'picked_up'
            )
          }
        />

        <FilterChip
          active={
            filter ===
            'delivered'
          }
          count={
            counts.delivered
          }
          label={
            isRTL
              ? 'تم التوصيل'
              : 'Delivered'
          }
          onPress={() =>
            setFilter(
              'delivered'
            )
          }
        />

        <FilterChip
          active={
            filter ===
            'excused'
          }
          count={
            counts.excused
          }
          label={
            isRTL
              ? 'مجاز / عذر'
              : 'Excused'
          }
          onPress={() =>
            setFilter(
              'excused'
            )
          }
        />
      </ScrollView>

      <View
        style={[
          styles.resultStrip,

          {
            flexDirection:
              direction,
          },
        ]}
      >
        <Text
          style={[
            styles.resultText,

            {
              color:
                theme.colors.textSecondary,

              textAlign,
            },
          ]}
        >
          {isRTL
            ? `عرض ${visibleStudents.length} من ${students.length} طالب`
            : `Showing ${visibleStudents.length} of ${students.length} students`}
        </Text>

        {(search ||
          filter !==
            'all' ||
          activeAdvancedFilters >
            0) && (
          <Pressable
            onPress={() => {
              setSearch(
                ''
              );

              setFilter(
                'all'
              );

              resetAdvancedFilters();
            }}
          >
            <Text
              style={
                styles.clearText
              }
            >
              {isRTL
                ? 'مسح الفلاتر'
                : 'Clear filters'}
            </Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View
          style={
            styles.loading
          }
        >
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
              ? 'جاري تحميل طلاب المسار...'
              : 'Loading route students...'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={
            visibleStudents
          }
          keyExtractor={
            (
              item
            ) =>
              item.route_student_id
          }
          renderItem={
            renderStudent
          }
          contentContainerStyle={
            visibleStudents.length
              ? styles.listContent
              : styles.emptyContent
          }
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              tintColor="#F7B83A"
              onRefresh={() => {
                setRefreshing(
                  true
                );

                void load(
                  false
                );
              }}
            />
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
                  name="people-outline"
                  size={34}
                  color="#98A2B3"
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
                {search
                  ? isRTL
                    ? 'لا توجد نتائج'
                    : 'No Results'
                  : isRTL
                  ? 'لا يوجد طلاب في هذه القائمة'
                  : 'No Students in This List'}
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
                  ? 'غيّر خيارات البحث أو اسحب للأسفل لتحديث البيانات.'
                  : 'Change the filters or pull down to refresh.'}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={
          optionsVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setOptionsVisible(
            false
          )
        }
      >
        <View
          style={
            styles.modalBackdrop
          }
        >
          <View
            style={[
              styles.modalCard,

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
                styles.modalHeader,

                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <View
                style={
                  styles.modalHeaderIcon
                }
              >
                <Ionicons
                  name="options"
                  size={20}
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
                    styles.modalTitle,

                    {
                      color:
                        theme.colors.text,

                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'خيارات البحث والفلترة'
                    : 'Search & Filter Options'}
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
                    ? 'رتب النتائج وحدد الطلاب المطلوبين.'
                    : 'Sort and narrow down the student list.'}
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  setOptionsVisible(
                    false
                  )
                }
                style={
                  styles.modalClose
                }
              >
                <Ionicons
                  name="close"
                  size={20}
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
            >
              <OptionSection
                title={
                  isRTL
                    ? 'ترتيب النتائج'
                    : 'Sort Results'
                }
              >
                <ChoiceRow
                  label={
                    isRTL
                      ? 'ترتيب المسار: تصاعدي'
                      : 'Route order: ascending'
                  }
                  active={
                    sortBy ===
                    'route_asc'
                  }
                  onPress={() =>
                    setSortBy(
                      'route_asc'
                    )
                  }
                />

                <ChoiceRow
                  label={
                    isRTL
                      ? 'ترتيب المسار: تنازلي'
                      : 'Route order: descending'
                  }
                  active={
                    sortBy ===
                    'route_desc'
                  }
                  onPress={() =>
                    setSortBy(
                      'route_desc'
                    )
                  }
                />

                <ChoiceRow
                  label={
                    isRTL
                      ? 'اسم الطالب: أ → ي'
                      : 'Student name: A → Z'
                  }
                  active={
                    sortBy ===
                    'name_asc'
                  }
                  onPress={() =>
                    setSortBy(
                      'name_asc'
                    )
                  }
                />

                <ChoiceRow
                  label={
                    isRTL
                      ? 'اسم الطالب: ي → أ'
                      : 'Student name: Z → A'
                  }
                  active={
                    sortBy ===
                    'name_desc'
                  }
                  onPress={() =>
                    setSortBy(
                      'name_desc'
                    )
                  }
                />

                <ChoiceRow
                  label={
                    isRTL
                      ? 'حسب حالة الطالب'
                      : 'By student status'
                  }
                  active={
                    sortBy ===
                    'status'
                  }
                  onPress={() =>
                    setSortBy(
                      'status'
                    )
                  }
                />
              </OptionSection>

              <OptionSection
                title={
                  isRTL
                    ? 'رقم هاتف ولي الأمر'
                    : 'Parent Phone'
                }
              >
                <ChoiceRow
                  label={
                    isRTL
                      ? 'الكل'
                      : 'All'
                  }
                  active={
                    phoneFilter ===
                    'all'
                  }
                  onPress={() =>
                    setPhoneFilter(
                      'all'
                    )
                  }
                />

                <ChoiceRow
                  label={
                    isRTL
                      ? 'يوجد رقم هاتف'
                      : 'Has phone number'
                  }
                  active={
                    phoneFilter ===
                    'with_phone'
                  }
                  onPress={() =>
                    setPhoneFilter(
                      'with_phone'
                    )
                  }
                />

                <ChoiceRow
                  label={
                    isRTL
                      ? 'بدون رقم هاتف'
                      : 'No phone number'
                  }
                  active={
                    phoneFilter ===
                    'without_phone'
                  }
                  onPress={() =>
                    setPhoneFilter(
                      'without_phone'
                    )
                  }
                />
              </OptionSection>

              <OptionSection
                title={
                  isRTL
                    ? 'تعليمات ولي الأمر'
                    : 'Parent Instructions'
                }
              >
                <ChoiceRow
                  label={
                    isRTL
                      ? 'الكل'
                      : 'All'
                  }
                  active={
                    instructionFilter ===
                    'all'
                  }
                  onPress={() =>
                    setInstructionFilter(
                      'all'
                    )
                  }
                />

                <ChoiceRow
                  label={
                    isRTL
                      ? 'يوجد تعليمات'
                      : 'Has instructions'
                  }
                  active={
                    instructionFilter ===
                    'with_instruction'
                  }
                  onPress={() =>
                    setInstructionFilter(
                      'with_instruction'
                    )
                  }
                />

                <ChoiceRow
                  label={
                    isRTL
                      ? 'بدون تعليمات'
                      : 'No instructions'
                  }
                  active={
                    instructionFilter ===
                    'without_instruction'
                  }
                  onPress={() =>
                    setInstructionFilter(
                      'without_instruction'
                    )
                  }
                />
              </OptionSection>
            </ScrollView>

            <View
              style={[
                styles.modalFooter,

                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <Pressable
                onPress={
                  resetAdvancedFilters
                }
                style={[
                  styles.secondaryModalButton,

                  {
                    borderColor:
                      theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.secondaryModalText,

                    {
                      color:
                        theme.colors.text,
                    },
                  ]}
                >
                  {isRTL
                    ? 'إعادة ضبط'
                    : 'Reset'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  setOptionsVisible(
                    false
                  )
                }
                style={
                  styles.primaryModalButton
                }
              >
                <Text
                  style={
                    styles.primaryModalText
                  }
                >
                  {isRTL
                    ? `عرض النتائج (${visibleStudents.length})`
                    : `Show Results (${visibleStudents.length})`}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={
          exportVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setExportVisible(
            false
          )
        }
      >
        <View
          style={
            styles.modalBackdrop
          }
        >
          <View
            style={[
              styles.exportCard,

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
                styles.modalHeader,

                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <View
                style={
                  styles.modalHeaderIcon
                }
              >
                <Ionicons
                  name="download-outline"
                  size={20}
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
                    styles.modalTitle,

                    {
                      color:
                        theme.colors.text,

                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'تصدير كشف الطلاب'
                    : 'Export Student Report'}
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
                    ? 'PDF احترافي أو ملف Excel قابل للتعديل.'
                    : 'Professional PDF or editable Excel file.'}
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  setExportVisible(
                    false
                  )
                }
                style={
                  styles.modalClose
                }
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={
                    theme.colors.text
                  }
                />
              </Pressable>
            </View>

            <View
              style={
                styles.exportScope
              }
            >
              <Pressable
                onPress={() =>
                  setExportFilteredOnly(
                    true
                  )
                }
                style={[
                  styles.scopeChoice,

                  exportFilteredOnly &&
                    styles.scopeChoiceActive,
                ]}
              >
                <Ionicons
                  name={
                    exportFilteredOnly
                      ? 'radio-button-on'
                      : 'radio-button-off'
                  }
                  size={18}
                  color={
                    exportFilteredOnly
                      ? '#D88B00'
                      : '#98A2B3'
                  }
                />

                <Text
                  style={[
                    styles.scopeText,

                    {
                      color:
                        theme.colors.text,
                    },
                  ]}
                >
                  {isRTL
                    ? `النتائج الحالية (${visibleStudents.length})`
                    : `Current results (${visibleStudents.length})`}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  setExportFilteredOnly(
                    false
                  )
                }
                style={[
                  styles.scopeChoice,

                  !exportFilteredOnly &&
                    styles.scopeChoiceActive,
                ]}
              >
                <Ionicons
                  name={
                    !exportFilteredOnly
                      ? 'radio-button-on'
                      : 'radio-button-off'
                  }
                  size={18}
                  color={
                    !exportFilteredOnly
                      ? '#D88B00'
                      : '#98A2B3'
                  }
                />

                <Text
                  style={[
                    styles.scopeText,

                    {
                      color:
                        theme.colors.text,
                    },
                  ]}
                >
                  {isRTL
                    ? `جميع طلاب الرحلة (${students.length})`
                    : `All trip students (${students.length})`}
                </Text>
              </Pressable>
            </View>

            <Pressable
              disabled={
                exporting
              }
              onPress={() =>
                void exportPdf()
              }
              style={[
                styles.exportOption,

                {
                  borderColor:
                    theme.colors.border,

                  opacity:
                    exporting
                      ? 0.55
                      : 1,

                  flexDirection:
                    direction,
                },
              ]}
            >
              <View
                style={[
                  styles.exportOptionIcon,

                  {
                    backgroundColor:
                      '#FEF3F2',
                  },
                ]}
              >
                <Ionicons
                  name="document-text"
                  size={22}
                  color="#D92D20"
                />
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={[
                    styles.exportOptionTitle,

                    {
                      color:
                        theme.colors.text,

                      textAlign,
                    },
                  ]}
                >
                  PDF
                </Text>

                <Text
                  style={[
                    styles.exportOptionSub,

                    {
                      color:
                        theme.colors.textSecondary,

                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'هيدر المدرسة، الشعار، بيانات الرحلة، الملخص والجدول.'
                    : 'School header, logo, trip details, summary and table.'}
                </Text>
              </View>

              <Ionicons
                name={
                  isRTL
                    ? 'chevron-back'
                    : 'chevron-forward'
                }
                size={19}
                color="#98A2B3"
              />
            </Pressable>

            <Pressable
              disabled={
                exporting
              }
              onPress={() =>
                void exportExcel()
              }
              style={[
                styles.exportOption,

                {
                  borderColor:
                    theme.colors.border,

                  opacity:
                    exporting
                      ? 0.55
                      : 1,

                  flexDirection:
                    direction,
                },
              ]}
            >
              <View
                style={[
                  styles.exportOptionIcon,

                  {
                    backgroundColor:
                      '#ECFDF3',
                  },
                ]}
              >
                <Ionicons
                  name="grid"
                  size={22}
                  color="#10A66A"
                />
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={[
                    styles.exportOptionTitle,

                    {
                      color:
                        theme.colors.text,

                      textAlign,
                    },
                  ]}
                >
                  Excel
                </Text>

                <Text
                  style={[
                    styles.exportOptionSub,

                    {
                      color:
                        theme.colors.textSecondary,

                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'ملف XLSX منظم وجاهز للفرز والتحليل.'
                    : 'Structured XLSX file ready for sorting and analysis.'}
                </Text>
              </View>

              <Ionicons
                name={
                  isRTL
                    ? 'chevron-back'
                    : 'chevron-forward'
                }
                size={19}
                color="#98A2B3"
              />
            </Pressable>

            {exporting && (
              <View
                style={
                  styles.exportingRow
                }
              >
                <ActivityIndicator
                  size="small"
                  color="#F7B83A"
                />

                <Text
                  style={[
                    styles.exportingText,

                    {
                      color:
                        theme.colors.textSecondary,
                    },
                  ]}
                >
                  {isRTL
                    ? 'جاري تجهيز الملف...'
                    : 'Preparing file...'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FilterChip({
  active,
  count,
  label,
  onPress,
}: {
  active:
    boolean;
  count:
    number;
  label:
    string;
  onPress:
    () => void;
}) {
  return (
    <Pressable
      onPress={
        onPress
      }
      style={[
        styles.filterChip,

        {
          borderColor:
            active
              ? '#F7B83A'
              : '#E4E7EC',

          backgroundColor:
            active
              ? '#FFF8E7'
              : '#FFFFFF',
        },
      ]}
    >
      <Text
        style={[
          styles.filterCount,

          {
            color:
              active
                ? '#0A2D44'
                : '#667085',
          },
        ]}
      >
        {count}
      </Text>

      <Text
        numberOfLines={
          1
        }
        style={[
          styles.filterLabel,

          {
            color:
              active
                ? '#0A2D44'
                : '#667085',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function OptionSection({
  title,
  children,
}: {
  title: string;
  children:
    React.ReactNode;
}) {
  return (
    <View
      style={
        styles.optionSection
      }
    >
      <Text
        style={
          styles.optionSectionTitle
        }
      >
        {title}
      </Text>

      <View
        style={
          styles.optionSectionBody
        }
      >
        {children}
      </View>
    </View>
  );
}

function ChoiceRow({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress:
    () => void;
}) {
  return (
    <Pressable
      onPress={
        onPress
      }
      style={[
        styles.choiceRow,

        active &&
          styles.choiceRowActive,
      ]}
    >
      <Ionicons
        name={
          active
            ? 'radio-button-on'
            : 'radio-button-off'
        }
        size={18}
        color={
          active
            ? '#D88B00'
            : '#98A2B3'
        }
      />

      <Text
        style={[
          styles.choiceText,

          {
            color:
              active
                ? '#0A2D44'
                : '#475467',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
    },

    hero: {
      marginHorizontal:
        14,
      marginTop: 6,
      borderWidth: 1,
      borderRadius: 24,
      padding: 13,
      shadowColor:
        '#000',
      shadowOpacity:
        0.08,
      shadowRadius:
        14,
      elevation: 4,
    },

    heroTop: {
      alignItems:
        'center',
      gap: 10,
    },

    logoWrap: {
      width: 50,
      height: 50,
      borderRadius: 16,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E4E7EC',
      overflow:
        'hidden',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    schoolLogo: {
      width: 44,
      height: 44,
    },

    logoFallback: {
      width: '100%',
      height: '100%',
      backgroundColor:
        '#F7B83A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    schoolName: {
      fontSize: 16,
      fontWeight:
        '900',
    },

    pageTitle: {
      marginTop: 2,
      fontSize: 10,
      fontWeight:
        '700',
    },

    heroAction: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    tripBanner: {
      marginTop: 12,
      minHeight: 58,
      borderRadius: 17,
      paddingHorizontal:
        10,
      alignItems:
        'center',
      gap: 9,
      backgroundColor:
        '#FFF8E7',
      borderWidth: 1,
      borderColor:
        '#FDE7A7',
    },

    tripIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor:
        '#F7B83A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    tripTitle: {
      color:
        '#0A2D44',
      fontSize: 12,
      fontWeight:
        '900',
    },

    tripSub: {
      marginTop: 2,
      color:
        '#667085',
      fontSize: 9,
      fontWeight:
        '700',
    },

    totalBadge: {
      minWidth: 48,
      minHeight: 42,
      paddingHorizontal:
        7,
      borderRadius: 13,
      backgroundColor:
        '#FFFFFF',
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        '#FDE7A7',
    },

    totalBadgeValue: {
      color:
        '#0A2D44',
      fontSize: 14,
      fontWeight:
        '900',
    },

    totalBadgeLabel: {
      color:
        '#667085',
      fontSize: 7,
      fontWeight:
        '800',
    },

    toolbarRow: {
      marginTop: 11,
      marginHorizontal:
        14,
      flexDirection:
        'row',
      gap: 7,
    },

    searchBox: {
      flex: 1,
      minHeight: 48,
      borderWidth: 1,
      borderRadius: 15,
      paddingHorizontal:
        12,
      alignItems:
        'center',
      gap: 8,
    },

    searchInput: {
      flex: 1,
      paddingVertical: 0,
      fontSize: 11,
      fontWeight:
        '700',
    },

    squareAction: {
      width: 48,
      height: 48,
      borderWidth: 1,
      borderRadius: 15,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    filterDot: {
      position:
        'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      paddingHorizontal:
        4,
      borderRadius: 9,
      backgroundColor:
        '#D92D20',
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 2,
      borderColor:
        '#FFFFFF',
    },

    filterDotText: {
      color:
        '#FFFFFF',
      fontSize: 8,
      fontWeight:
        '900',
    },

    exportButton: {
      width: 48,
      height: 48,
      borderRadius: 15,
      backgroundColor:
        '#F7B83A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    filters: {
      paddingHorizontal:
        14,
      paddingTop: 10,
      paddingBottom: 3,
      gap: 7,
    },

    filterChip: {
      minWidth: 72,
      height: 54,
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal:
        8,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    filterCount: {
      fontSize: 14,
      fontWeight:
        '900',
    },

    filterLabel: {
      marginTop: 2,
      textAlign:
        'center',
      fontSize: 8,
      fontWeight:
        '800',
    },

    resultStrip: {
      marginHorizontal:
        14,
      marginTop: 7,
      minHeight: 28,
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap: 8,
    },

    resultText: {
      flex: 1,
      fontSize: 9,
      fontWeight:
        '700',
    },

    clearText: {
      color:
        '#D88B00',
      fontSize: 9,
      fontWeight:
        '900',
    },

    loading: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    loadingText: {
      marginTop: 9,
      fontSize: 11,
      fontWeight:
        '700',
    },

    listContent: {
      padding:
        14,
      paddingTop: 8,
      paddingBottom:
        110,
      gap: 9,
    },

    studentCard: {
      borderWidth: 1,
      borderRadius: 19,
      padding: 11,
      shadowColor:
        '#000',
      shadowOpacity:
        0.05,
      shadowRadius:
        8,
      elevation: 2,
    },

    studentTop: {
      alignItems:
        'center',
      gap: 9,
    },

    orderBox: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    orderText: {
      fontSize: 13,
      fontWeight:
        '900',
    },

    studentName: {
      fontSize: 14,
      fontWeight:
        '900',
    },

    studentSecondary: {
      marginTop: 2,
      fontSize: 9,
      fontWeight:
        '700',
    },

    callButton: {
      width: 39,
      height: 39,
      borderRadius: 13,
      backgroundColor:
        '#ECFDF3',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    statusLine: {
      marginTop: 10,
      alignItems:
        'center',
      gap: 8,
    },

    statusBadge: {
      minHeight: 30,
      borderRadius: 10,
      paddingHorizontal:
        9,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 5,
    },

    statusText: {
      fontSize: 9,
      fontWeight:
        '900',
    },

    parentText: {
      flex: 1,
      fontSize: 9,
      fontWeight:
        '700',
    },

    instructionBox: {
      marginTop: 9,
      borderRadius: 13,
      backgroundColor:
        '#FEF3F2',
      padding: 9,
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      gap: 7,
    },

    instructionTitle: {
      color:
        '#B42318',
      fontSize: 9,
      fontWeight:
        '900',
    },

    instructionText: {
      color:
        '#D92D20',
      marginTop: 2,
      fontSize: 9,
      lineHeight: 14,
      fontWeight:
        '700',
    },

    timeRow: {
      marginTop: 9,
      paddingTop: 8,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        '#E4E7EC',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    timeItem: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 5,
    },

    timeText: {
      fontSize: 9,
      fontWeight:
        '800',
    },

    lastUpdate: {
      fontSize: 8,
      fontWeight:
        '700',
    },

    emptyContent: {
      flexGrow: 1,
      justifyContent:
        'center',
      paddingBottom:
        110,
    },

    empty: {
      alignItems:
        'center',
      paddingHorizontal:
        25,
    },

    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 23,
      backgroundColor:
        '#F2F4F7',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    emptyTitle: {
      marginTop: 12,
      fontSize: 15,
      fontWeight:
        '900',
      textAlign:
        'center',
    },

    emptySub: {
      marginTop: 5,
      fontSize: 10,
      fontWeight:
        '700',
      textAlign:
        'center',
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor:
        'rgba(2, 15, 27, 0.58)',
      justifyContent:
        'flex-end',
    },

    modalCard: {
      maxHeight:
        '84%',
      borderTopLeftRadius:
        28,
      borderTopRightRadius:
        28,
      borderWidth: 1,
      padding: 16,
      paddingBottom:
        24,
    },

    exportCard: {
      borderTopLeftRadius:
        28,
      borderTopRightRadius:
        28,
      borderWidth: 1,
      padding: 16,
      paddingBottom:
        28,
    },

    modalHeader: {
      alignItems:
        'center',
      gap: 10,
      marginBottom: 14,
    },

    modalHeaderIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        '#F7B83A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    modalTitle: {
      fontSize: 15,
      fontWeight:
        '900',
    },

    modalSub: {
      marginTop: 2,
      fontSize: 9,
      lineHeight: 13,
      fontWeight:
        '700',
    },

    modalClose: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor:
        'rgba(127,127,127,0.08)',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    optionSection: {
      marginBottom:
        15,
    },

    optionSectionTitle: {
      color:
        '#667085',
      fontSize: 10,
      fontWeight:
        '900',
      marginBottom: 7,
    },

    optionSectionBody: {
      gap: 6,
    },

    choiceRow: {
      minHeight: 42,
      borderRadius: 13,
      paddingHorizontal:
        11,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 9,
      backgroundColor:
        '#F9FAFB',
      borderWidth: 1,
      borderColor:
        '#EAECF0',
    },

    choiceRowActive: {
      backgroundColor:
        '#FFF8E7',
      borderColor:
        '#F7B83A',
    },

    choiceText: {
      flex: 1,
      fontSize: 10,
      fontWeight:
        '800',
    },

    modalFooter: {
      marginTop: 6,
      gap: 8,
    },

    secondaryModalButton: {
      flex: 1,
      minHeight: 46,
      borderWidth: 1,
      borderRadius: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    secondaryModalText: {
      fontSize: 11,
      fontWeight:
        '900',
    },

    primaryModalButton: {
      flex: 2,
      minHeight: 46,
      borderRadius: 14,
      backgroundColor:
        '#F7B83A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    primaryModalText: {
      color:
        '#0A2D44',
      fontSize: 11,
      fontWeight:
        '900',
    },

    exportScope: {
      borderRadius: 16,
      backgroundColor:
        '#F9FAFB',
      padding: 8,
      gap: 6,
      marginBottom:
        12,
    },

    scopeChoice: {
      minHeight: 41,
      borderRadius: 12,
      paddingHorizontal:
        10,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
    },

    scopeChoiceActive: {
      backgroundColor:
        '#FFF8E7',
      borderWidth: 1,
      borderColor:
        '#F7B83A',
    },

    scopeText: {
      fontSize: 10,
      fontWeight:
        '800',
    },

    exportOption: {
      minHeight: 72,
      borderWidth: 1,
      borderRadius: 16,
      padding: 10,
      alignItems:
        'center',
      gap: 10,
      marginTop: 8,
    },

    exportOptionIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    exportOptionTitle: {
      fontSize: 13,
      fontWeight:
        '900',
    },

    exportOptionSub: {
      marginTop: 2,
      fontSize: 8.5,
      lineHeight: 12,
      fontWeight:
        '700',
    },

    exportingRow: {
      marginTop: 14,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 8,
    },

    exportingText: {
      fontSize: 10,
      fontWeight:
        '800',
    },
  });