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

import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../hooks/useAuth';
import { useResolvedSchoolId } from '../../hooks/useResolvedSchoolId';
import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { supabase } from '../../lib/supabase';

import {
  AdminRow,
  cleanNullable,
  deleteAdminRow,
  insertAdminRow,
  listAdminRows,
  numberNullable,
  updateAdminRow,
} from '../../services/adminPremiumService';

import AdminBrandHeader from './AdminBrandHeader';
import AdminDateField from './AdminDateField';
import AdminImagePickerField from './AdminImagePickerField';
import AdminLocationPickerPanel from './AdminLocationPickerPanel';
import AdminSelectionModal, {
  SelectionItem,
} from './AdminSelectionModal';
import AdminMultiSelectPanel, { MultiSelectItem } from './AdminMultiSelectPanel';

export type AdminPremiumField = {
  key: string;
  labelAr: string;
  labelEn: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  type?:
    | 'text'
    | 'phone'
    | 'email'
    | 'number'
    | 'date'
    | 'time'
    | 'multiline'
    | 'relation'
    | 'choice'
    | 'password'
    | 'image'
    | 'location'
    | 'multiRelation';
  required?: boolean;
  placeholderAr?: string;
  placeholderEn?: string;
  relationTable?: string;
  relationSchoolScoped?: boolean;
  relationTitle?: (row: AdminRow) => string;
  relationSubtitle?: (row: AdminRow) => string;
  relationMeta?: (row: AdminRow) => string;
  relationFilterByField?: string;
  relationFilterColumn?: string;
  mirrorLabelColumn?: string;
  joinTable?: string;
  joinThisColumn?: string;
  joinOtherColumn?: string;
  joinSchoolColumn?: string;
  joinAcademicYearColumn?: string;
  mirrorPrimaryColumn?: string;
  imageEntity?: string;
  latKey?: string;
  lngKey?: string;
  choices?: Array<{
    value: string;
    labelAr: string;
    labelEn: string;
    subtitleAr?: string;
    subtitleEn?: string;
  }>;
  allowClear?: boolean;
  defaultValue?: string;
  hiddenOnCreate?: boolean;
  hiddenOnEdit?: boolean;
  detailOnly?: boolean;
  blankOnEdit?: boolean;
  omitEmptyOnEdit?: boolean;
  transformOut?: (value: any) => any;
  renderDetail?: (
    value: any,
    row: AdminRow,
    lookupRow?: AdminRow | null
  ) => string;
};

export type AdminPremiumCrudConfig = {
  table: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  titleKey: string;
  subtitleKeys?: string[];
  searchKeys?: string[];
  orderBy?: string;
  ascending?: boolean;
  schoolScoped?: boolean;
  includeSchoolIdInPayload?: boolean;
  schoolColumn?: string;
  fields: AdminPremiumField[];
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  quickFilter?: {
    key: string;
    labelAr: string;
    labelEn: string;
    allLabelAr: string;
    allLabelEn: string;
    choices: Array<{ value: string; labelAr: string; labelEn: string }>;
  };
  emptyTitleAr?: string;
  emptyTitleEn?: string;
  emptySubtitleAr?: string;
  emptySubtitleEn?: string;
  preparePayload?: (
    payload: Record<string, any>,
    editing: AdminRow | null,
    context: {
      schoolId: string | null;
      userId: string | null;
    }
  ) => Promise<Record<string, any>> | Record<string, any>;
  afterSave?: (
    saved: AdminRow,
    editing: AdminRow | null,
    context: {
      schoolId: string | null;
      userId: string | null;
    }
  ) => Promise<void> | void;
};

type ActivePicker = {
  field: AdminPremiumField;
  items: SelectionItem[];
};

function fieldLabel(field: AdminPremiumField, isRTL: boolean) {
  return isRTL ? field.labelAr : field.labelEn;
}

function isNullish(value: unknown) {
  return value === null || value === undefined || value === '';
}

function formatDateTime(value: unknown, isRTL: boolean) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString(isRTL ? 'ar-JO' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AdminPremiumCrudScreen({
  config,
  navigation,
}: {
  config: AdminPremiumCrudConfig;
  navigation: any;
}) {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const {
    isRTL,
    direction,
    textAlign,
  } = useLanguage();

  const { schoolId } = useResolvedSchoolId(user);

  const [school, setSchool] =
    useState<AdminRow | null>(null);

  const [rows, setRows] =
    useState<AdminRow[]>([]);

  const [lookupRows, setLookupRows] =
    useState<Record<string, AdminRow[]>>({});

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [search, setSearch] =
    useState('');

  const [quickFilterValue, setQuickFilterValue] =
    useState('all');

  const [quickFilterOpen, setQuickFilterOpen] =
    useState(false);

  const [formVisible, setFormVisible] =
    useState(false);

  const [detailsVisible, setDetailsVisible] =
    useState(false);

  const [editing, setEditing] =
    useState<AdminRow | null>(null);

  const [details, setDetails] =
    useState<AdminRow | null>(null);

  const [values, setValues] =
    useState<Record<string, any>>({});

  const [picker, setPicker] =
    useState<ActivePicker | null>(null);

  const [multiPicker, setMultiPicker] =
    useState<AdminPremiumField | null>(null);

  const [locationField, setLocationField] =
    useState<AdminPremiumField | null>(null);

  const load = useCallback(
    async (
      showSpinner: boolean = true
    ) => {
      if (showSpinner) {
        setLoading(true);
      }

      try {
        const mainPromise =
          listAdminRows(
            config.table,
            schoolId,
            {
              schoolScoped:
                config.schoolScoped,
              orderBy:
                config.orderBy,
              ascending:
                config.ascending,
              limit: 500,
            }
          );

        const schoolPromise =
          schoolId
            ? listAdminRows(
                'schools',
                null,
                {
                  schoolScoped: false,
                  limit: 100,
                }
              ).then((items) =>
                items.find(
                  (row) =>
                    String(row.id) ===
                    String(schoolId)
                ) ?? null
              )
            : Promise.resolve(null);

        const relationFields =
          config.fields.filter(
            (field) =>
              (field.type ===
                'relation' || field.type === 'multiRelation') &&
              field.relationTable
          );

        const relationEntries =
          await Promise.all(
            relationFields.map(
              async (field) => {
                const result =
                  await listAdminRows(
                    String(
                      field.relationTable
                    ),
                    schoolId,
                    {
                      schoolScoped:
                        field.relationSchoolScoped !==
                        false,
                      limit: 500,
                    }
                  ).catch(
                    () => []
                  );

                return [
                  field.key,
                  result,
                ] as const;
              }
            )
          );

        const [mainRows, schoolRow] =
          await Promise.all([
            mainPromise,
            schoolPromise,
          ]);

        setRows(mainRows);
        setSchool(schoolRow);
        setLookupRows(
          Object.fromEntries(
            relationEntries
          )
        );
      } catch (error: any) {
        Alert.alert(
          isRTL
            ? 'تعذر تحميل البيانات'
            : 'Unable to Load Data',
          error?.message ??
            String(error)
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      config,
      schoolId,
      isRTL,
    ]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows =
    useMemo(() => {
      const term = search.trim().toLowerCase();
      const keys = config.searchKeys?.length
        ? config.searchKeys
        : [config.titleKey, ...(config.subtitleKeys ?? [])];

      return rows.filter((row) => {
        if (
          config.quickFilter &&
          quickFilterValue !== 'all' &&
          String(row[config.quickFilter.key] ?? '') !== quickFilterValue
        ) {
          return false;
        }

        if (!term) return true;

        return keys
          .map((key) => String(row[key] ?? ''))
          .join(' ')
          .toLowerCase()
          .includes(term);
      });
    }, [config, rows, search, quickFilterValue]);

  const getLookupRow = (
    field: AdminPremiumField,
    value: unknown
  ) =>
    (lookupRows[field.key] ??
      []).find(
      (row) =>
        String(row.id) ===
        String(value ?? '')
    ) ?? null;

  const getDisplayValue = (
    field: AdminPremiumField,
    row: AdminRow
  ) => {
    const value = row[field.key];

    if (
      field.type ===
      'relation'
    ) {
      const lookup =
        getLookupRow(
          field,
          value
        );

      if (!lookup) {
        return isNullish(value)
          ? '—'
          : isRTL
          ? 'غير محدد'
          : 'Not selected';
      }

      return (
        field.relationTitle?.(
          lookup
        ) ??
        String(
          lookup.full_name ??
            lookup.name ??
            lookup.bus_number ??
            '—'
        )
      );
    }

    if (
      field.type ===
      'choice'
    ) {
      const choice =
        field.choices?.find(
          (item) =>
            String(item.value) ===
            String(value)
        );

      return choice
        ? isRTL
          ? choice.labelAr
          : choice.labelEn
        : isNullish(value)
        ? '—'
        : String(value);
    }

    if (
      field.renderDetail
    ) {
      return field.renderDetail(
        value,
        row,
        undefined
      );
    }

    if (
      field.key ===
        'created_at' ||
      field.key ===
        'updated_at' ||
      field.key ===
        'happened_at'
    ) {
      return formatDateTime(
        value,
        isRTL
      );
    }

    if (isNullish(value)) {
      return '—';
    }

    return String(value);
  };

  const titleForRow = (
    row: AdminRow
  ) => {
    const field =
      config.fields.find(
        (item) =>
          item.key ===
          config.titleKey
      );

    if (field) {
      return getDisplayValue(
        field,
        row
      );
    }

    const value =
      row[config.titleKey];

    return isNullish(value)
      ? '—'
      : String(value);
  };

  const subtitleForRow = (
    row: AdminRow
  ) => {
    const values =
      (config.subtitleKeys ??
        [])
        .map((key) => {
          const field =
            config.fields.find(
              (item) =>
                item.key === key
            );

          if (field) {
            return getDisplayValue(
              field,
              row
            );
          }

          return String(
            row[key] ?? ''
          );
        })
        .filter(
          (value) =>
            value &&
            value !== '—'
        );

    return values.join(' • ');
  };

  const blankForm = () => {
    const next: Record<
      string,
      any
    > = {};

    config.fields.forEach(
      (field) => {
        if (
          field.detailOnly ||
          field.hiddenOnCreate
        ) {
          return;
        }

        next[field.key] = field.type === 'multiRelation' ? [] : (field.defaultValue ?? '');

        if (field.type === 'location') {
          if (field.latKey) next[field.latKey] = '';
          if (field.lngKey) next[field.lngKey] = '';
        }
      }
    );

    return next;
  };

  const openCreate = () => {
    setEditing(null);
    setValues(blankForm());
    setFormVisible(true);
  };

  const openEdit = async (
    row: AdminRow
  ) => {
    const next: Record<
      string,
      any
    > = {};

    config.fields.forEach(
      (field) => {
        if (
          field.detailOnly ||
          field.hiddenOnEdit
        ) {
          return;
        }

        const value =
          row[field.key];

        if (field.type === 'multiRelation') {
          next[field.key] = [];
          return;
        }

        next[field.key] =
          field.blankOnEdit
            ? ''
            : isNullish(value)
            ? ''
            : String(value);

        if (field.type === 'location') {
          if (field.latKey) {
            const latValue = row[field.latKey];
            next[field.latKey] = isNullish(latValue) ? '' : String(latValue);
          }

          if (field.lngKey) {
            const lngValue = row[field.lngKey];
            next[field.lngKey] = isNullish(lngValue) ? '' : String(lngValue);
          }
        }
      }
    );

    const multiFields = config.fields.filter(
      (field) =>
        field.type === 'multiRelation' &&
        field.joinTable &&
        field.joinThisColumn &&
        field.joinOtherColumn
    );

    for (const field of multiFields) {
      try {
        let query = supabase
          .from(String(field.joinTable))
          .select(String(field.joinOtherColumn))
          .eq(String(field.joinThisColumn), row.id);

        if (field.joinSchoolColumn && schoolId) {
          query = query.eq(field.joinSchoolColumn, schoolId);
        }

        const result = await query;
        if (!result.error) {
          next[field.key] = (result.data ?? []).map(
            (item: any) => String(item[field.joinOtherColumn!])
          );
        }
      } catch {
        next[field.key] = [];
      }
    }

    setDetailsVisible(false);
    setEditing(row);
    setValues(next);
    setFormVisible(true);
  };

  const openDetails = (
    row: AdminRow
  ) => {
    setDetails(row);
    setDetailsVisible(true);
  };

  const openPicker = (
    field: AdminPremiumField
  ) => {
    if (
      field.type ===
      'relation'
    ) {
      let source =
        lookupRows[field.key] ??
        [];

      if (
        field.relationFilterByField &&
        field.relationFilterColumn
      ) {
        const selectedParent =
          values[field.relationFilterByField];

        if (!selectedParent) {
          Alert.alert(
            isRTL ? 'اختيار سابق مطلوب' : 'Previous Selection Required',
            isRTL
              ? 'يرجى اختيار الحقل المرتبط أولاً.'
              : 'Please choose the related field first.'
          );

          return;
        }

        source = source.filter((row) =>
          String(row[field.relationFilterColumn!]) ===
          String(selectedParent)
        );
      }

      const items: SelectionItem[] =
        source.map(
          (row) => ({
            value: String(
              row.id
            ),
            title:
              field.relationTitle?.(
                row
              ) ??
              String(
                row.full_name ??
                  row.name ??
                  row.bus_number ??
                  '—'
              ),
            subtitle:
              field.relationSubtitle?.(
                row
              ) ??
              '',
            meta:
              field.relationMeta?.(
                row
              ) ??
              '',
            icon:
              field.icon ??
              'ellipse-outline',
            raw: row,
          })
        );

      setPicker({
        field,
        items,
      });

      return;
    }

    if (
      field.type ===
      'choice'
    ) {
      const items: SelectionItem[] =
        (field.choices ??
          []).map(
          (choice) => ({
            value:
              choice.value,
            title: isRTL
              ? choice.labelAr
              : choice.labelEn,
            subtitle: isRTL
              ? choice.subtitleAr
              : choice.subtitleEn,
            icon:
              field.icon ??
              'checkmark-circle-outline',
          })
        );

      setPicker({
        field,
        items,
      });
    }
  };

  const validate = () => {
    for (const field of config.fields) {
      if (
        field.detailOnly ||
        (editing &&
          field.hiddenOnEdit) ||
        (!editing &&
          field.hiddenOnCreate)
      ) {
        continue;
      }

      const value =
        values[field.key];

      if (
        field.required &&
        !String(
          value ?? ''
        ).trim()
      ) {
        Alert.alert(
          isRTL
            ? 'حقل مطلوب'
            : 'Required Field',
          isRTL
            ? `يرجى تعبئة ${field.labelAr}.`
            : `Please fill ${field.labelEn}.`
        );

        return false;
      }

      if (
        field.type === 'location' &&
        field.required &&
        field.latKey &&
        field.lngKey &&
        (
          !String(values[field.latKey] ?? '').trim() ||
          !String(values[field.lngKey] ?? '').trim()
        )
      ) {
        Alert.alert(
          isRTL ? 'الموقع مطلوب' : 'Location Required',
          isRTL
            ? `يرجى تحديد ${field.labelAr} من الخريطة.`
            : `Please select ${field.labelEn} from the map.`
        );

        return false;
      }

      if (
        field.type ===
          'date' &&
        value &&
        !/^\d{4}-\d{2}-\d{2}$/.test(
          String(value)
        )
      ) {
        Alert.alert(
          isRTL
            ? 'تاريخ غير صحيح'
            : 'Invalid Date',
          isRTL
            ? `${field.labelAr}: استخدم YYYY-MM-DD أو اختر التاريخ من التقويم.`
            : `${field.labelEn}: use YYYY-MM-DD or choose from the calendar.`
        );

        return false;
      }

      if (
        field.type ===
          'time' &&
        value &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(
          String(value)
        )
      ) {
        Alert.alert(
          isRTL
            ? 'وقت غير صحيح'
            : 'Invalid Time',
          isRTL
            ? `${field.labelAr}: استخدم HH:MM.`
            : `${field.labelEn}: use HH:MM.`
        );

        return false;
      }
    }

    return true;
  };

  const save = async () => {
    if (!validate()) {
      return;
    }

    setSaving(true);

    try {
      let payload: Record<
        string,
        any
      > = {};

      if (
        config.includeSchoolIdInPayload !== false &&
        config.schoolScoped !== false &&
        schoolId
      ) {
        payload[
          config.schoolColumn ??
            'school_id'
        ] = schoolId;
      }

      config.fields.forEach(
        (field) => {
          if (
            field.detailOnly ||
            (editing &&
              field.hiddenOnEdit) ||
            (!editing &&
              field.hiddenOnCreate)
          ) {
            return;
          }

          if (field.type === 'multiRelation') {
            if (field.mirrorPrimaryColumn) {
              const selected = Array.isArray(values[field.key])
                ? values[field.key]
                : [];
              payload[field.mirrorPrimaryColumn] = selected[0] ?? null;
            }
            return;
          }

          if (
            field.type === 'location'
          ) {
            if (field.latKey) {
              payload[field.latKey] =
                numberNullable(values[field.latKey]);
            }

            if (field.lngKey) {
              payload[field.lngKey] =
                numberNullable(values[field.lngKey]);
            }

            return;
          }

          const raw =
            values[field.key];

          if (
            editing &&
            field.omitEmptyOnEdit &&
            !String(raw ?? '').trim()
          ) {
            return;
          }

          if (
            field.type ===
            'number'
          ) {
            payload[field.key] =
              numberNullable(raw);

            return;
          }

          if (
            field.transformOut
          ) {
            payload[field.key] =
              field.transformOut(
                raw
              );
          } else {
            payload[field.key] =
              cleanNullable(raw);
          }

          if (
            field.type === 'relation' &&
            field.mirrorLabelColumn
          ) {
            const selectedRow =
              getLookupRow(field, raw);

            payload[field.mirrorLabelColumn] =
              selectedRow
                ? (
                    field.relationTitle?.(selectedRow) ??
                    String(
                      selectedRow.full_name ??
                      selectedRow.name ??
                      selectedRow.bus_number ??
                      ''
                    )
                  )
                : null;
          }
        }
      );

      if (
        config.preparePayload
      ) {
        payload =
          await config.preparePayload(
            payload,
            editing,
            {
              schoolId,
              userId:
                user?.id ??
                null,
            }
          );
      }

      let saved: AdminRow;

      if (editing?.id) {
        saved =
          await updateAdminRow(
            config.table,
            String(
              editing.id
            ),
            payload
          );
      } else {
        saved =
          await insertAdminRow(
            config.table,
            payload
          );
      }

      const multiFields = config.fields.filter(
        (field) =>
          field.type === 'multiRelation' &&
          field.joinTable &&
          field.joinThisColumn &&
          field.joinOtherColumn
      );

      for (const field of multiFields) {
        const selected = Array.isArray(values[field.key])
          ? values[field.key].map(String)
          : [];

        let deleteQuery = supabase
          .from(String(field.joinTable))
          .delete()
          .eq(String(field.joinThisColumn), saved.id);

        if (field.joinSchoolColumn && schoolId) {
          deleteQuery = deleteQuery.eq(field.joinSchoolColumn, schoolId);
        }

        const deleted = await deleteQuery;
        if (deleted.error) throw deleted.error;

        if (selected.length) {
          const rowsToInsert = selected.map((otherId: string, index: number) => ({
            [String(field.joinThisColumn)]: saved.id,
            [String(field.joinOtherColumn)]: otherId,
            ...(field.joinSchoolColumn && schoolId
              ? { [field.joinSchoolColumn]: schoolId }
              : {}),
            ...(field.joinAcademicYearColumn && (school as any)?.current_academic_year_id
              ? { [field.joinAcademicYearColumn]: (school as any).current_academic_year_id }
              : {}),
            ...(field.joinTable === 'parent_students'
              ? { is_primary: index === 0 }
              : {}),
          }));

          const inserted = await supabase
            .from(String(field.joinTable))
            .insert(rowsToInsert);

          if (inserted.error) throw inserted.error;
        }
      }

      if (
        config.afterSave
      ) {
        await config.afterSave(
          saved,
          editing,
          {
            schoolId,
            userId:
              user?.id ??
              null,
          }
        );
      }

      setFormVisible(false);
      setEditing(null);
      await load(false);
    } catch (error: any) {
      Alert.alert(
        isRTL
          ? 'تعذر الحفظ'
          : 'Save Failed',
        error?.message ??
          String(error)
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (
    row: AdminRow
  ) => {
    Alert.alert(
      isRTL
        ? 'تأكيد الحذف'
        : 'Confirm Delete',
      isRTL
        ? `هل تريد حذف "${titleForRow(row)}"؟`
        : `Delete "${titleForRow(row)}"?`,
      [
        {
          text: isRTL
            ? 'إلغاء'
            : 'Cancel',
          style: 'cancel',
        },
        {
          text: isRTL
            ? 'حذف'
            : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAdminRow(
                config.table,
                String(row.id)
              );

              setDetailsVisible(
                false
              );

              await load(false);
            } catch (
              error: any
            ) {
              Alert.alert(
                isRTL
                  ? 'تعذر الحذف'
                  : 'Delete Failed',
                error?.message ??
                  String(
                    error
                  )
              );
            }
          },
        },
      ]
    );
  };

  const schoolName =
    String(
      school?.name ??
        (isRTL
          ? 'المدرسة'
          : 'School')
    );

  const schoolLogo =
    school?.logo_url
      ? String(
          school.logo_url
        )
      : null;

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
        <View style={styles.loadingBadge}>
          <ActivityIndicator
            size="large"
            color="#F7B83A"
          />
        </View>

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
            ? 'جاري تجهيز البيانات...'
            : 'Preparing data...'}
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
      <AdminBrandHeader
        title={
          isRTL
            ? config.titleAr
            : config.titleEn
        }
        subtitle={
          isRTL
            ? config.subtitleAr
            : config.subtitleEn
        }
        schoolName={schoolName}
        schoolLogoUrl={
          schoolLogo
        }
        onBack={() =>
          navigation.goBack()
        }
        right={
          config.canCreate !==
          false ? (
            <Pressable
              onPress={
                openCreate
              }
              style={
                styles.addButton
              }
            >
              <Ionicons
                name="add"
                size={23}
                color="#0A2D44"
              />
            </Pressable>
          ) : undefined
        }
      />

      <View
        style={[
          styles.searchCard,
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
          style={[
            styles.searchIcon,
            {
              backgroundColor:
                theme.colors
                  .surface2,
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={19}
            color="#8191A0"
          />
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={
            isRTL
              ? `بحث في ${config.titleAr}...`
              : `Search ${config.titleEn}...`
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
              size={20}
              color="#8191A0"
            />
          </Pressable>
        )}

        <View
          style={[
            styles.countBadge,
            {
              backgroundColor:
                'rgba(247,184,58,0.13)',
            },
          ]}
        >
          <Text
            style={
              styles.countText
            }
          >
            {
              filteredRows.length
            }
          </Text>
        </View>
      </View>

      {!!config.quickFilter && (
        <Pressable
          onPress={() => setQuickFilterOpen(true)}
          style={[
            styles.quickFilterButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              flexDirection: direction,
            },
          ]}
        >
          <View style={styles.quickFilterIcon}>
            <Ionicons name="options-outline" size={17} color="#0A2D44" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.quickFilterLabel, { color: theme.colors.textSecondary, textAlign }]}>
              {isRTL ? config.quickFilter.labelAr : config.quickFilter.labelEn}
            </Text>
            <Text style={[styles.quickFilterValue, { color: theme.colors.text, textAlign }]}>
              {quickFilterValue === 'all'
                ? (isRTL ? config.quickFilter.allLabelAr : config.quickFilter.allLabelEn)
                : (isRTL
                    ? config.quickFilter.choices.find((item) => item.value === quickFilterValue)?.labelAr
                    : config.quickFilter.choices.find((item) => item.value === quickFilterValue)?.labelEn) ?? quickFilterValue}
            </Text>
          </View>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={17} color="#8191A0" />
        </Pressable>
      )}

      <FlatList
        data={filteredRows}
        keyExtractor={(
          item,
          index
        ) =>
          String(
            item.id ?? index
          )
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
              void load(false);
            }}
          />
        }
        contentContainerStyle={
          filteredRows.length
            ? styles.list
            : styles.emptyList
        }
        renderItem={({
          item,
        }) => (
          <Pressable
            onPress={() =>
              openDetails(item)
            }
            style={({
              pressed,
            }) => [
              styles.rowCard,
              {
                backgroundColor:
                  theme.colors
                    .surface,
                borderColor:
                  theme.colors
                    .border,
                flexDirection:
                  direction,
                opacity: pressed
                  ? 0.76
                  : 1,
              },
            ]}
          >
            <View
              style={
                styles.rowIcon
              }
            >
              <Ionicons
                name={
                  config.icon
                }
                size={22}
                color="#0A2D44"
              />
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.rowTitle,
                  {
                    color:
                      theme.colors
                        .text,
                    textAlign,
                  },
                ]}
              >
                {titleForRow(
                  item
                )}
              </Text>

              {!!subtitleForRow(
                item
              ) && (
                <Text
                  numberOfLines={
                    2
                  }
                  style={[
                    styles.rowSub,
                    {
                      color:
                        theme.colors
                          .textSecondary,
                      textAlign,
                    },
                  ]}
                >
                  {subtitleForRow(
                    item
                  )}
                </Text>
              )}
            </View>

            <View
              style={[
                styles.openIcon,
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
              <Ionicons
                name={
                  isRTL
                    ? 'chevron-back'
                    : 'chevron-forward'
                }
                size={17}
                color="#8191A0"
              />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View
            style={
              styles.empty
            }
          >
            <View
              style={[
                styles.emptyIcon,
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
              <Ionicons
                name={
                  config.icon
                }
                size={34}
                color="#8191A0"
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
                ? config.emptyTitleAr ??
                  'لا توجد بيانات'
                : config.emptyTitleEn ??
                  'No data yet'}
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
                ? config.emptySubtitleAr ??
                  'استخدم زر الإضافة لإنشاء أول سجل.'
                : config.emptySubtitleEn ??
                  'Use the add button to create the first record.'}
            </Text>
          </View>
        }
      />

      {/* Create / Edit */}
      {!!config.quickFilter && (
        <AdminSelectionModal
          visible={quickFilterOpen}
          title={isRTL ? config.quickFilter.labelAr : config.quickFilter.labelEn}
          items={[
            {
              value: 'all',
              title: isRTL ? config.quickFilter.allLabelAr : config.quickFilter.allLabelEn,
              icon: 'layers-outline',
            },
            ...config.quickFilter.choices.map((item) => ({
              value: item.value,
              title: isRTL ? item.labelAr : item.labelEn,
              icon: (
                item.value === 'morning'
                  ? 'sunny-outline'
                  : item.value === 'afternoon'
                  ? 'moon-outline'
                  : 'ellipse-outline'
              ) as React.ComponentProps<typeof Ionicons>['name'],
            })),
          ]}
          selectedValue={quickFilterValue}
          allowClear={false}
          onClose={() => setQuickFilterOpen(false)}
          onSelect={(value) => {
            setQuickFilterValue(value ?? 'all');
            setQuickFilterOpen(false);
          }}
        />
      )}

      <Modal
        transparent
        animationType="slide"
        visible={formVisible}
        onRequestClose={() =>
          setFormVisible(false)
        }
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
        >
          <Pressable
            style={
              StyleSheet.absoluteFill
            }
            onPress={() =>
              !saving &&
              setFormVisible(false)
            }
          />

          <View
            style={[
              styles.formSheet,
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
                styles.handle,
                {
                  backgroundColor:
                    theme.colors
                      .border,
                },
              ]}
            />

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
                  styles.modalIcon
                }
              >
                <Ionicons
                  name={
                    editing
                      ? 'create-outline'
                      : 'add'
                  }
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
                    styles.modalTitle,
                    {
                      color:
                        theme.colors
                          .text,
                      textAlign,
                    },
                  ]}
                >
                  {editing
                    ? isRTL
                      ? `تعديل ${config.titleAr}`
                      : `Edit ${config.titleEn}`
                    : isRTL
                    ? `إضافة ${config.titleAr}`
                    : `Add ${config.titleEn}`}
                </Text>

                <Text
                  style={[
                    styles.modalSub,
                    {
                      color:
                        theme.colors
                          .textSecondary,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'الحقول التقنية ومعرفات قاعدة البيانات مخفية تلقائياً.'
                    : 'Technical database IDs and constraints are hidden automatically.'}
                </Text>
              </View>

              <Pressable
                disabled={saving}
                onPress={() =>
                  setFormVisible(
                    false
                  )
                }
                style={[
                  styles.closeButton,
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
                <Ionicons
                  name="close"
                  size={21}
                  color={
                    theme.colors
                      .text
                  }
                />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.formContent
              }
            >
              {config.fields.map(
                (field) => {
                  if (
                    field.detailOnly ||
                    (editing &&
                      field.hiddenOnEdit) ||
                    (!editing &&
                      field.hiddenOnCreate)
                  ) {
                    return null;
                  }

                  if (
                    field.type ===
                    'date'
                  ) {
                    return (
                      <AdminDateField
                        key={
                          field.key
                        }
                        label={fieldLabel(
                          field,
                          isRTL
                        )}
                        required={
                          field.required
                        }
                        value={String(
                          values[
                            field.key
                          ] ?? ''
                        )}
                        onChange={(
                          value
                        ) =>
                          setValues(
                            (
                              current
                            ) => ({
                              ...current,
                              [field.key]:
                                value,
                            })
                          )
                        }
                      />
                    );
                  }

                  if (
                    field.type === 'image'
                  ) {
                    return (
                      <AdminImagePickerField
                        key={field.key}
                        label={fieldLabel(field, isRTL)}
                        required={field.required}
                        schoolId={schoolId}
                        entity={field.imageEntity ?? config.table}
                        value={String(values[field.key] ?? '') || null}
                        onChange={(url) =>
                          setValues((current) => ({
                            ...current,
                            [field.key]: url,
                          }))
                        }
                      />
                    );
                  }

                  if (
                    field.type === 'location'
                  ) {
                    const lat =
                      field.latKey
                        ? Number(values[field.latKey] ?? NaN)
                        : NaN;

                    const lng =
                      field.lngKey
                        ? Number(values[field.lngKey] ?? NaN)
                        : NaN;

                    const hasCoordinates =
                      Number.isFinite(lat) &&
                      Number.isFinite(lng);

                    return (
                      <View
                        key={field.key}
                        style={styles.fieldGroup}
                      >
                        <Text
                          style={[
                            styles.fieldLabel,
                            {
                              color: theme.colors.textSecondary,
                              textAlign,
                            },
                          ]}
                        >
                          {fieldLabel(field, isRTL)}
                          {field.required ? ' *' : ''}
                        </Text>

                        <Pressable
                          onPress={() => setLocationField(field)}
                          style={[
                            styles.choiceField,
                            {
                              backgroundColor: theme.colors.surface2,
                              borderColor: theme.colors.border,
                              flexDirection: direction,
                            },
                          ]}
                        >
                          <View style={styles.choiceIcon}>
                            <Ionicons
                              name="location-outline"
                              size={18}
                              color="#0A2D44"
                            />
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.choiceText,
                                {
                                  color: hasCoordinates
                                    ? theme.colors.text
                                    : '#8191A0',
                                  textAlign,
                                },
                              ]}
                            >
                              {hasCoordinates
                                ? isRTL
                                  ? 'تم تحديد الموقع على الخريطة'
                                  : 'Location selected on map'
                                : isRTL
                                ? 'فتح الخريطة وتحديد الموقع'
                                : 'Open map and select location'}
                            </Text>

                            {hasCoordinates && (
                              <Text
                                style={{
                                  marginTop: 2,
                                  fontSize: 7.5,
                                  fontWeight: '700',
                                  color: theme.colors.textSecondary,
                                  textAlign,
                                }}
                              >
                                {lat.toFixed(6)}, {lng.toFixed(6)}
                              </Text>
                            )}
                          </View>

                          <Ionicons
                            name={isRTL ? 'chevron-back' : 'chevron-forward'}
                            size={17}
                            color="#8191A0"
                          />
                        </Pressable>
                      </View>
                    );
                  }

                  if (field.type === 'multiRelation') {
                    const selectedValues = Array.isArray(values[field.key])
                      ? values[field.key].map(String)
                      : [];
                    const source = lookupRows[field.key] ?? [];
                    const selectedTitles = source
                      .filter((row) => selectedValues.includes(String(row.id)))
                      .map((row) => field.relationTitle?.(row) ?? String(row.full_name ?? row.name ?? row.id));

                    return (
                      <View key={field.key} style={styles.fieldGroup}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, textAlign }]}>
                          {fieldLabel(field, isRTL)}{field.required ? ' *' : ''}
                        </Text>

                        <Pressable
                          onPress={() => setMultiPicker(field)}
                          style={[styles.choiceField, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, flexDirection: direction }]}
                        >
                          <View style={styles.choiceIcon}>
                            <Ionicons name={field.icon ?? 'people-outline'} size={18} color="#0A2D44" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={2} style={[styles.choiceText, { color: theme.colors.text, textAlign }]}>
                              {selectedTitles.length
                                ? selectedTitles.join(' • ')
                                : (isRTL ? 'اضغط لاختيار أكثر من عنصر' : 'Tap to select multiple items')}
                            </Text>
                            <Text style={{ marginTop: 2, fontSize: 7.5, fontWeight: '700', color: theme.colors.textSecondary, textAlign }}>
                              {isRTL ? `${selectedValues.length} محدد` : `${selectedValues.length} selected`}
                            </Text>
                          </View>
                          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={17} color="#8191A0" />
                        </Pressable>
                      </View>
                    );
                  }

                  if (
                    field.type ===
                      'relation' ||
                    field.type ===
                      'choice'
                  ) {
                    const selectedValue =
                      values[
                        field.key
                      ];

                    let display =
                      isRTL
                        ? 'اختر...'
                        : 'Select...';

                    if (
                      field.type ===
                      'relation'
                    ) {
                      const row =
                        getLookupRow(
                          field,
                          selectedValue
                        );

                      if (row) {
                        display =
                          field.relationTitle?.(
                            row
                          ) ??
                          String(
                            row.full_name ??
                              row.name ??
                              row.bus_number ??
                              '—'
                          );
                      }
                    } else {
                      const choice =
                        field.choices?.find(
                          (
                            item
                          ) =>
                            String(
                              item.value
                            ) ===
                            String(
                              selectedValue ??
                                ''
                            )
                        );

                      if (
                        choice
                      ) {
                        display =
                          isRTL
                            ? choice.labelAr
                            : choice.labelEn;
                      }
                    }

                    return (
                      <View
                        key={
                          field.key
                        }
                        style={
                          styles.fieldGroup
                        }
                      >
                        <Text
                          style={[
                            styles.fieldLabel,
                            {
                              color:
                                theme.colors
                                  .textSecondary,
                              textAlign,
                            },
                          ]}
                        >
                          {fieldLabel(
                            field,
                            isRTL
                          )}
                          {field.required
                            ? ' *'
                            : ''}
                        </Text>

                        <Pressable
                          onPress={() =>
                            openPicker(
                              field
                            )
                          }
                          style={[
                            styles.choiceField,
                            {
                              backgroundColor:
                                theme.colors
                                  .surface2,
                              borderColor:
                                theme.colors
                                  .border,
                              flexDirection:
                                direction,
                            },
                          ]}
                        >
                          <View
                            style={
                              styles.choiceIcon
                            }
                          >
                            <Ionicons
                              name={
                                field.icon ??
                                (field.type ===
                                'relation'
                                  ? 'search-outline'
                                  : 'list-outline')
                              }
                              size={
                                18
                              }
                              color="#0A2D44"
                            />
                          </View>

                          <Text
                            numberOfLines={
                              1
                            }
                            style={[
                              styles.choiceText,
                              {
                                color:
                                  selectedValue
                                    ? theme
                                        .colors
                                        .text
                                    : '#8191A0',
                                textAlign,
                              },
                            ]}
                          >
                            {display}
                          </Text>

                          <Ionicons
                            name={
                              isRTL
                                ? 'chevron-back'
                                : 'chevron-forward'
                            }
                            size={
                              17
                            }
                            color="#8191A0"
                          />
                        </Pressable>
                      </View>
                    );
                  }

                  const keyboardType =
                    field.type ===
                    'number'
                      ? 'decimal-pad'
                      : field.type ===
                        'phone'
                      ? 'phone-pad'
                      : field.type ===
                        'email'
                      ? 'email-address'
                      : 'default';

                  return (
                    <View
                      key={
                        field.key
                      }
                      style={
                        styles.fieldGroup
                      }
                    >
                      <Text
                        style={[
                          styles.fieldLabel,
                          {
                            color:
                              theme.colors
                                .textSecondary,
                            textAlign,
                          },
                        ]}
                      >
                        {fieldLabel(
                          field,
                          isRTL
                        )}
                        {field.required
                          ? ' *'
                          : ''}
                      </Text>

                      <View
                        style={[
                          styles.inputWrap,
                          field.type ===
                            'multiline' &&
                            styles.multilineWrap,
                          {
                            backgroundColor:
                              theme.colors
                                .surface2,
                            borderColor:
                              theme.colors
                                .border,
                            flexDirection:
                              direction,
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            field.icon ??
                            (field.type ===
                            'time'
                              ? 'time-outline'
                              : field.type ===
                                'phone'
                              ? 'call-outline'
                              : field.type ===
                                'email'
                              ? 'mail-outline'
                              : 'create-outline')
                          }
                          size={18}
                          color="#F7B83A"
                        />

                        <TextInput
                          value={String(
                            values[
                              field.key
                            ] ?? ''
                          )}
                          onChangeText={(
                            value
                          ) =>
                            setValues(
                              (
                                current
                              ) => ({
                                ...current,
                                [field.key]:
                                  value,
                              })
                            )
                          }
                          placeholder={
                            isRTL
                              ? field.placeholderAr ??
                                (field.type ===
                                'time'
                                  ? 'HH:MM'
                                  : '')
                              : field.placeholderEn ??
                                (field.type ===
                                'time'
                                  ? 'HH:MM'
                                  : '')
                          }
                          placeholderTextColor="#8191A0"
                          keyboardType={
                            keyboardType as any
                          }
                          autoCapitalize={
                            field.type ===
                            'email'
                              ? 'none'
                              : 'sentences'
                          }
                          secureTextEntry={
                            field.type ===
                            'password'
                          }
                          multiline={
                            field.type ===
                            'multiline'
                          }
                          style={[
                            styles.input,
                            field.type ===
                              'multiline' &&
                              styles.multilineInput,
                            {
                              color:
                                theme.colors
                                  .text,
                              textAlign,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                }
              )}

              <Pressable
                disabled={saving}
                onPress={() =>
                  void save()
                }
                style={({
                  pressed,
                }) => [
                  styles.saveButton,
                  {
                    opacity:
                      saving ||
                      pressed
                        ? 0.72
                        : 1,
                  },
                ]}
              >
                {saving ? (
                  <ActivityIndicator
                    color="#0A2D44"
                  />
                ) : (
                  <Ionicons
                    name="checkmark-done"
                    size={21}
                    color="#0A2D44"
                  />
                )}

                <Text
                  style={
                    styles.saveText
                  }
                >
                  {isRTL
                    ? 'حفظ البيانات'
                    : 'Save Changes'}
                </Text>
              </Pressable>
            </ScrollView>

            {!!picker && (
              <AdminSelectionModal
                visible
                embedded
                title={fieldLabel(picker.field, isRTL)}
                subtitle={
                  isRTL
                    ? 'ابحث ثم اختر القيمة المناسبة.'
                    : 'Search and select the appropriate value.'
                }
                items={picker.items}
                selectedValue={values[picker.field.key] ?? null}
                allowClear={picker.field.allowClear !== false}
                onClose={() => setPicker(null)}
                onSelect={(value, item) => {
                  setValues((current) => {
                    const next: Record<string, any> = {
                      ...current,
                      [picker.field.key]: value ?? '',
                    };

                    if (picker.field.mirrorLabelColumn) {
                      next[picker.field.mirrorLabelColumn] = item?.title ?? '';
                    }

                    if (picker.field.key === 'grade_id') {
                      next.section_id = '';
                      next.section_name = '';
                    }

                    return next;
                  });

                  setPicker(null);
                }}
              />
            )}

            {!!multiPicker && (
              <AdminMultiSelectPanel
                visible
                title={fieldLabel(multiPicker, isRTL)}
                subtitle={isRTL ? 'يمكنك تحديد أكثر من عنصر.' : 'You can select more than one item.'}
                items={(lookupRows[multiPicker.key] ?? []).map((row): MultiSelectItem => ({
                  value: String(row.id),
                  title: multiPicker.relationTitle?.(row) ?? String(row.full_name ?? row.name ?? row.id),
                  subtitle: multiPicker.relationSubtitle?.(row) ?? '',
                  meta: multiPicker.relationMeta?.(row) ?? '',
                }))}
                selectedValues={Array.isArray(values[multiPicker.key]) ? values[multiPicker.key].map(String) : []}
                onClose={() => setMultiPicker(null)}
                onSave={(selected) => {
                  setValues((current) => ({ ...current, [multiPicker.key]: selected }));
                  setMultiPicker(null);
                }}
              />
            )}

            {!!locationField && (
              <AdminLocationPickerPanel
                visible
                title={fieldLabel(locationField, isRTL)}
                latitude={
                  locationField.latKey
                    ? numberNullable(values[locationField.latKey])
                    : null
                }
                longitude={
                  locationField.lngKey
                    ? numberNullable(values[locationField.lngKey])
                    : null
                }
                onClose={() => setLocationField(null)}
                onConfirm={(latitude, longitude) => {
                  setValues((current) => ({
                    ...current,
                    ...(locationField.latKey
                      ? { [locationField.latKey]: String(latitude) }
                      : {}),
                    ...(locationField.lngKey
                      ? { [locationField.lngKey]: String(longitude) }
                      : {}),
                  }));

                  setLocationField(null);
                }}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Details */}
      <Modal
        transparent
        animationType="fade"
        visible={
          detailsVisible
        }
        onRequestClose={() =>
          setDetailsVisible(
            false
          )
        }
      >
        <View
          style={
            styles.detailsBackdrop
          }
        >
          <Pressable
            style={
              StyleSheet.absoluteFill
            }
            onPress={() =>
              setDetailsVisible(
                false
              )
            }
          />

          {details && (
            <View
              style={[
                styles.detailsCard,
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
                  styles.detailsHero,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <View
                  style={
                    styles.detailsIcon
                  }
                >
                  <Ionicons
                    name={
                      config.icon
                    }
                    size={27}
                    color="#0A2D44"
                  />
                </View>

                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    numberOfLines={
                      2
                    }
                    style={[
                      styles.detailsTitle,
                      {
                        color:
                          theme.colors
                            .text,
                        textAlign,
                      },
                    ]}
                  >
                    {titleForRow(
                      details
                    )}
                  </Text>

                  {!!subtitleForRow(
                    details
                  ) && (
                    <Text
                      style={[
                        styles.detailsSub,
                        {
                          color:
                            theme.colors
                              .textSecondary,
                          textAlign,
                        },
                      ]}
                    >
                      {subtitleForRow(
                        details
                      )}
                    </Text>
                  )}
                </View>

                <Pressable
                  onPress={() =>
                    setDetailsVisible(
                      false
                    )
                  }
                  style={[
                    styles.closeButton,
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
                  <Ionicons
                    name="close"
                    size={21}
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
                style={{
                  maxHeight: 470,
                }}
              >
                <View
                  style={
                    styles.detailsGrid
                  }
                >
                  {config.fields.map(
                    (field) => {
                      if (field.type === 'image') {
                        return null;
                      }

                      const value =
                        getDisplayValue(
                          field,
                          details
                        );

                      return (
                        <View
                          key={
                            field.key
                          }
                          style={[
                            styles.detailBox,
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
                            style={[
                              styles.detailLabelRow,
                              {
                                flexDirection:
                                  direction,
                              },
                            ]}
                          >
                            <Ionicons
                              name={
                                field.icon ??
                                'information-circle-outline'
                              }
                              size={
                                14
                              }
                              color="#8191A0"
                            />

                            <Text
                              style={[
                                styles.detailLabel,
                                {
                                  color:
                                    theme.colors
                                      .textSecondary,
                                  textAlign,
                                },
                              ]}
                            >
                              {fieldLabel(
                                field,
                                isRTL
                              )}
                            </Text>
                          </View>

                          <Text
                            selectable={
                              false
                            }
                            style={[
                              styles.detailValue,
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
                  )}
                </View>
              </ScrollView>

              <View
                style={[
                  styles.actions,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                {config.canEdit !==
                  false && (
                  <Pressable
                    onPress={() =>
                      openEdit(
                        details
                      )
                    }
                    style={
                      styles.editButton
                    }
                  >
                    <Ionicons
                      name="create-outline"
                      size={19}
                      color="#0A2D44"
                    />

                    <Text
                      style={
                        styles.editText
                      }
                    >
                      {isRTL
                        ? 'تعديل'
                        : 'Edit'}
                    </Text>
                  </Pressable>
                )}

                {config.canDelete !==
                  false && (
                  <Pressable
                    onPress={() =>
                      confirmDelete(
                        details
                      )
                    }
                    style={
                      styles.deleteButton
                    }
                  >
                    <Ionicons
                      name="trash-outline"
                      size={19}
                      color="#D94A4A"
                    />

                    <Text
                      style={
                        styles.deleteText
                      }
                    >
                      {isRTL
                        ? 'حذف'
                        : 'Delete'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safe: {
      flex: 1,
    },

    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    loadingBadge: {
      width: 68,
      height: 68,
      borderRadius: 23,
      backgroundColor:
        '#0A2D44',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    loadingText: {
      marginTop: 10,
      fontSize: 11,
      fontWeight: '700',
    },

    addButton: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor:
        '#F7B83A',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    quickFilterButton: {
      marginHorizontal: 14,
      marginTop: 8,
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 10,
      alignItems: 'center',
      gap: 8,
    },
    quickFilterIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: '#F7B83A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickFilterLabel: { fontSize: 7.5, fontWeight: '700' },
    quickFilterValue: { marginTop: 2, fontSize: 9.5, fontWeight: '900' },
    searchCard: {
      minHeight: 54,
      marginHorizontal: 14,
      marginTop: 11,
      borderWidth: 1,
      borderRadius: 18,
      paddingHorizontal: 10,
      alignItems: 'center',
      gap: 8,
    },

    searchIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    searchInput: {
      flex: 1,
      height: 52,
      fontSize: 11,
      fontWeight: '700',
    },

    countBadge: {
      minWidth: 34,
      height: 30,
      borderRadius: 10,
      paddingHorizontal: 7,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    countText: {
      color: '#0A2D44',
      fontSize: 9,
      fontWeight: '900',
    },

    list: {
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 110,
      gap: 8,
    },

    rowCard: {
      minHeight: 88,
      borderWidth: 1,
      borderRadius: 21,
      paddingHorizontal: 11,
      paddingVertical: 10,
      alignItems: 'center',
      gap: 10,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.035,
      shadowRadius: 8,
      elevation: 2,
    },

    rowIcon: {
      width: 49,
      height: 49,
      borderRadius: 16,
      backgroundColor:
        '#F7B83A',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    rowTitle: {
      fontSize: 12,
      fontWeight: '900',
    },

    rowSub: {
      marginTop: 4,
      fontSize: 8.5,
      lineHeight: 13,
      fontWeight: '600',
    },

    openIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    emptyList: {
      flexGrow: 1,
      justifyContent:
        'center',
    },

    empty: {
      alignItems: 'center',
      paddingHorizontal: 30,
    },

    emptyIcon: {
      width: 74,
      height: 74,
      borderRadius: 24,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    emptyTitle: {
      marginTop: 13,
      fontSize: 15,
      fontWeight: '900',
      textAlign: 'center',
    },

    emptySub: {
      marginTop: 5,
      fontSize: 9,
      lineHeight: 15,
      fontWeight: '600',
      textAlign: 'center',
    },

    backdrop: {
      flex: 1,
      justifyContent:
        'flex-end',
      backgroundColor:
        'rgba(5,20,32,0.50)',
    },

    formSheet: {
      maxHeight: '92%',
      borderTopLeftRadius: 31,
      borderTopRightRadius: 31,
      borderWidth: 1,
      paddingTop: 8,
      paddingHorizontal: 17,
      paddingBottom:
        Platform.OS === 'ios'
          ? 28
          : 18,
    },

    handle: {
      width: 46,
      height: 4,
      borderRadius: 3,
      alignSelf: 'center',
      marginBottom: 9,
    },

    modalHeader: {
      minHeight: 58,
      alignItems: 'center',
      gap: 9,
    },

    modalIcon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      backgroundColor:
        '#F7B83A',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    modalTitle: {
      fontSize: 15,
      fontWeight: '900',
    },

    modalSub: {
      marginTop: 2,
      fontSize: 8,
      lineHeight: 12,
      fontWeight: '600',
    },

    closeButton: {
      width: 38,
      height: 38,
      borderRadius: 13,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    formContent: {
      paddingBottom: 8,
    },

    fieldGroup: {
      marginTop: 12,
    },

    fieldLabel: {
      marginBottom: 7,
      fontSize: 10,
      fontWeight: '800',
    },

    inputWrap: {
      minHeight: 53,
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 12,
      alignItems: 'center',
      gap: 8,
    },

    multilineWrap: {
      minHeight: 92,
      alignItems:
        'flex-start',
      paddingTop: 13,
    },

    input: {
      flex: 1,
      height: 51,
      fontSize: 12,
      fontWeight: '700',
    },

    multilineInput: {
      minHeight: 75,
      textAlignVertical:
        'top',
    },

    choiceField: {
      minHeight: 54,
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 10,
      alignItems: 'center',
      gap: 8,
    },

    choiceIcon: {
      width: 35,
      height: 35,
      borderRadius: 12,
      backgroundColor:
        '#F7B83A',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    choiceText: {
      flex: 1,
      fontSize: 11,
      fontWeight: '800',
    },

    saveButton: {
      marginTop: 20,
      height: 54,
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
      fontSize: 12,
      fontWeight: '900',
    },

    detailsBackdrop: {
      flex: 1,
      justifyContent:
        'center',
      backgroundColor:
        'rgba(5,20,32,0.50)',
      paddingHorizontal: 15,
    },

    detailsCard: {
      maxHeight: '90%',
      borderRadius: 29,
      borderWidth: 1,
      padding: 16,
    },

    detailsHero: {
      minHeight: 66,
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },

    detailsIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      backgroundColor:
        '#F7B83A',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    detailsTitle: {
      fontSize: 16,
      fontWeight: '900',
    },

    detailsSub: {
      marginTop: 3,
      fontSize: 8.5,
      fontWeight: '600',
    },

    detailsGrid: {
      gap: 7,
    },

    detailBox: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 11,
    },

    detailLabelRow: {
      alignItems: 'center',
      gap: 5,
    },

    detailLabel: {
      flex: 1,
      fontSize: 8,
      fontWeight: '700',
    },

    detailValue: {
      marginTop: 5,
      fontSize: 11,
      fontWeight: '900',
    },

    actions: {
      gap: 8,
      marginTop: 14,
    },

    editButton: {
      flex: 1,
      height: 48,
      borderRadius: 15,
      backgroundColor:
        '#F7B83A',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 6,
    },

    editText: {
      color: '#0A2D44',
      fontSize: 10,
      fontWeight: '900',
    },

    deleteButton: {
      flex: 1,
      height: 48,
      borderRadius: 15,
      borderWidth: 1,
      borderColor:
        'rgba(217,74,74,0.25)',
      backgroundColor:
        'rgba(217,74,74,0.08)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 6,
    },

    deleteText: {
      color: '#D94A4A',
      fontSize: 10,
      fontWeight: '900',
    },
  });
