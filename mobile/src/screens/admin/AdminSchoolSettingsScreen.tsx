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
  ImageSourcePropType,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../hooks/useAuth';
import { useResolvedSchoolId } from '../../hooks/useResolvedSchoolId';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { supabase } from '../../lib/supabase';

import AdminSelectionModal, {
  SelectionItem,
} from '../../components/admin/AdminSelectionModal';
import AdminImagePickerField from '../../components/admin/AdminImagePickerField';
import AdminLocationPickerPanel from '../../components/admin/AdminLocationPickerPanel';

const SYSTEM_LOGO = require('../../assets/system-logo.png') as ImageSourcePropType;

type AnyRow = Record<string, any>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

type SchoolForm = {
  name: string;
  phone: string;
  email: string;
  logo_url: string;
  lat: string;
  lng: string;
  current_academic_year_id: string;
  is_active: boolean;
};

type AdminPrefs = {
  push_enabled: boolean;
  mute_all: boolean;
  school_announcements: boolean;
  general_broadcasts: boolean;
  bus_incidents: boolean;
  attendance_changes: boolean;
};

const DEFAULT_PREFS: AdminPrefs = {
  push_enabled: true,
  mute_all: false,
  school_announcements: true,
  general_broadcasts: true,
  bus_incidents: true,
  attendance_changes: true,
};

export default function AdminSchoolSettingsScreen() {
  const { user, signOut } = useAuth();
  const { schoolId } = useResolvedSchoolId(user);

  const {
    language,
    setLanguage,
    isRTL,
    direction,
    textAlign,
  } = useLanguage();

  const {
    theme,
    mode,
    setMode,
  } = useAppTheme();

  const [profile, setProfile] =
    useState<AnyRow | null>(null);

  const [school, setSchool] =
    useState<AnyRow | null>(null);

  const [academicYears, setAcademicYears] =
    useState<AnyRow[]>([]);

  const [prefsRow, setPrefsRow] =
    useState<AnyRow | null>(null);

  const [prefs, setPrefs] =
    useState<AdminPrefs>(DEFAULT_PREFS);

  const [loading, setLoading] =
    useState(true);

  const [savingSchool, setSavingSchool] =
    useState(false);

  const [savingPrefs, setSavingPrefs] =
    useState(false);

  const [schoolEditor, setSchoolEditor] =
    useState(false);

  const [yearPicker, setYearPicker] =
    useState(false);

  const [locationPicker, setLocationPicker] =
    useState(false);

  const [passwordVisible, setPasswordVisible] =
    useState(false);
  const [newPassword, setNewPassword] =
    useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');
  const [savingPassword, setSavingPassword] =
    useState(false);

  const [form, setForm] =
    useState<SchoolForm>({
      name: '',
      phone: '',
      email: '',
      logo_url: '',
      lat: '',
      lng: '',
      current_academic_year_id: '',
      is_active: true,
    });

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [
        schoolResult,
        profileResult,
        yearsResult,
        prefsResult,
      ] = await Promise.all([
        schoolId
          ? supabase
              .from('schools')
              .select('*')
              .eq('id', schoolId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),

        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(),

        schoolId
          ? supabase
              .from('academic_years')
              .select('*')
              .eq('school_id', schoolId)
              .order('start_date', { ascending: false })
          : Promise.resolve({ data: [], error: null } as any),

        supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .eq('user_role', 'admin')
          .maybeSingle(),
      ]);

      if (schoolResult.error) {
        console.log('AdminSettings school:', schoolResult.error.message);
      }

      if (profileResult.error) {
        console.log('AdminSettings profile:', profileResult.error.message);
      }

      if (yearsResult.error) {
        console.log('AdminSettings years:', yearsResult.error.message);
      }

      if (prefsResult.error) {
        console.log('AdminSettings prefs:', prefsResult.error.message);
      }

      const schoolRow = schoolResult.data ?? null;

      setSchool(schoolRow);
      setProfile(profileResult.data ?? null);
      setAcademicYears(yearsResult.data ?? []);
      setPrefsRow(prefsResult.data ?? null);

      setForm({
        name: String(schoolRow?.name ?? ''),
        phone: schoolRow?.phone == null ? '' : String(schoolRow.phone),
        email: String(schoolRow?.email ?? profileResult.data?.email ?? user?.email ?? ''),
        logo_url: String(schoolRow?.logo_url ?? ''),
        lat: schoolRow?.lat == null ? '' : String(schoolRow.lat),
        lng: schoolRow?.lng == null ? '' : String(schoolRow.lng),
        current_academic_year_id:
          String(schoolRow?.current_academic_year_id ?? ''),
        is_active: schoolRow?.is_active !== false,
      });

      if (prefsResult.data) {
        setPrefs({
          push_enabled: prefsResult.data.push_enabled ?? true,
          mute_all: prefsResult.data.mute_all ?? false,
          school_announcements:
            prefsResult.data.school_announcements ?? true,
          general_broadcasts:
            prefsResult.data.general_broadcasts ?? true,
          bus_incidents:
            prefsResult.data.bus_incidents ?? true,
          attendance_changes:
            prefsResult.data.attendance_changes ?? true,
        });
      }
    } catch (error) {
      console.log('AdminSettings load:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentYear = useMemo(
    () =>
      academicYears.find(
        (year) =>
          String(year.id) ===
          String(form.current_academic_year_id ?? '')
      ) ?? null,
    [academicYears, form.current_academic_year_id]
  );

  const adminName =
    String(
      profile?.full_name ??
        user?.full_name ??
        (isRTL ? 'مدير المدرسة' : 'School Admin')
    );

  const adminRole =
    String(
      profile?.job_title ??
        (isRTL ? 'إدارة المدرسة' : 'School Administration')
    );

  const initials = useMemo(() => {
    const parts = adminName.trim().split(/\s+/).filter(Boolean);

    if (!parts.length) return 'A';

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }, [adminName]);

  const saveSchool = async () => {
    if (!schoolId) return;

    if (!form.name.trim()) {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Required',
        isRTL ? 'اسم المدرسة مطلوب.' : 'School name is required.'
      );
      return;
    }

    const lat =
      form.lat.trim()
        ? Number(form.lat)
        : null;

    const lng =
      form.lng.trim()
        ? Number(form.lng)
        : null;

    if (
      lat !== null &&
      (!Number.isFinite(lat) || lat < -90 || lat > 90)
    ) {
      Alert.alert(
        isRTL ? 'موقع غير صحيح' : 'Invalid Location',
        isRTL ? 'خط العرض غير صحيح.' : 'Latitude is invalid.'
      );
      return;
    }

    if (
      lng !== null &&
      (!Number.isFinite(lng) || lng < -180 || lng > 180)
    ) {
      Alert.alert(
        isRTL ? 'موقع غير صحيح' : 'Invalid Location',
        isRTL ? 'خط الطول غير صحيح.' : 'Longitude is invalid.'
      );
      return;
    }

    setSavingSchool(true);

    try {
      const { error } = await supabase
        .from('schools')
        .update({
          name: form.name.trim(),
          phone: form.phone.trim() ? Number(form.phone.replace(/[^\d.]/g, '')) : null,
          email: form.email.trim() || null,
          logo_url: form.logo_url.trim() || null,
          lat,
          lng,
          current_academic_year_id:
            form.current_academic_year_id || null,
          is_active: form.is_active,
        })
        .eq('id', schoolId);

      if (error) throw error;

      const { error: clearError } = await supabase
        .from('academic_years')
        .update({ is_current: false })
        .eq('school_id', schoolId);

      if (clearError) throw clearError;

      if (form.current_academic_year_id) {
        const { error: currentError } = await supabase
          .from('academic_years')
          .update({ is_current: true })
          .eq('school_id', schoolId)
          .eq('id', form.current_academic_year_id);

        if (currentError) throw currentError;
      }

      setSchoolEditor(false);
      await load();
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'تعذر الحفظ' : 'Save Failed',
        error?.message ?? String(error)
      );
    } finally {
      setSavingSchool(false);
    }
  };

  const savePreferences = async (
    nextPrefs: AdminPrefs
  ) => {
    if (!user?.id) return;

    setPrefs(nextPrefs);
    setSavingPrefs(true);

    try {
      if (prefsRow?.id) {
        const { data, error } = await supabase
          .from('notification_preferences')
          .update({
            ...nextPrefs,
            updated_at: new Date().toISOString(),
          })
          .eq('id', prefsRow.id)
          .select('*')
          .limit(1);

        if (error) throw error;
        setPrefsRow((data ?? [])[0] ?? prefsRow);
      } else {
        const { data, error } = await supabase
          .from('notification_preferences')
          .insert({
            user_id: user.id,
            user_role: 'admin',
            school_id: schoolId,
            ...nextPrefs,
          })
          .select('*')
          .limit(1);

        if (error) throw error;
        setPrefsRow((data ?? [])[0] ?? null);
      }
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'تعذر حفظ الإشعارات' : 'Unable to Save Notifications',
        error?.message ?? String(error)
      );
    } finally {
      setSavingPrefs(false);
    }
  };

  const updatePref = (
    key: keyof AdminPrefs,
    value: boolean
  ) => {
    const next = {
      ...prefs,
      [key]: value,
    };

    void savePreferences(next);
  };

  const yearItems: SelectionItem[] =
    academicYears.map((year) => ({
      value: String(year.id),
      title: String(year.name ?? ''),
      subtitle:
        [year.start_date, year.end_date]
          .filter(Boolean)
          .join(' → '),
      meta:
        year.is_current === true
          ? isRTL
            ? 'الحالية'
            : 'Current'
          : '',
      icon: 'calendar-outline',
    }));

  async function changePassword() {
    if (newPassword.length < 8) { Alert.alert(isRTL ? 'كلمة مرور ضعيفة' : 'Weak Password', isRTL ? 'اكتب 8 أحرف/أرقام على الأقل.' : 'Use at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert(isRTL ? 'غير متطابقة' : 'Mismatch', isRTL ? 'تأكيد كلمة المرور غير مطابق.' : 'Password confirmation does not match.'); return; }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordVisible(false); setNewPassword(''); setConfirmPassword('');
      Alert.alert(isRTL ? 'تم التعديل' : 'Updated', isRTL ? 'تم تغيير كلمة مرور حساب الإدارة.' : 'Admin password was changed.');
    } catch (error: any) { Alert.alert(isRTL ? 'تعذر تغيير كلمة المرور' : 'Password Update Failed', error?.message ?? String(error)); }
    finally { setSavingPassword(false); }
  }

  if (loading) {
    return (
      <View
        style={[
          styles.loadingScreen,
          {
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <View style={styles.loadingBadge}>
          <ActivityIndicator color="#F7B83A" size="large" />
        </View>

        <Text
          style={[
            styles.loadingText,
            {
              color: theme.colors.textSecondary,
            },
          ]}
        >
          {isRTL ? 'جاري تحميل الإعدادات...' : 'Loading settings...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.titleRow,
            {
              flexDirection: direction,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.pageEyebrow,
                {
                  color: theme.colors.textSecondary,
                  textAlign,
                },
              ]}
            >
              SMART SCHOOL BUS
            </Text>

            <Text
              style={[
                styles.pageTitle,
                {
                  color: theme.colors.text,
                  textAlign,
                },
              ]}
            >
              {isRTL ? 'الإعدادات' : 'Settings'}
            </Text>
          </View>

          <View
            style={[
              styles.titleIcon,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Image source={SYSTEM_LOGO} style={styles.titleSystemLogo} />
          </View>
        </View>

        <View style={styles.profileCard}>
          <View
            style={[
              styles.profileTop,
              {
                flexDirection: direction,
              },
            ]}
          >
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            <View
              style={{
                flex: 1,
                marginHorizontal: 12,
              }}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.profileName,
                  {
                    textAlign,
                  },
                ]}
              >
                {adminName}
              </Text>

              <View
                style={[
                  styles.roleRow,
                  {
                    flexDirection: direction,
                  },
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={13}
                  color="#F7B83A"
                />

                <Text style={styles.profileRole}>
                  {adminRole}
                </Text>
              </View>

              <Text
                numberOfLines={1}
                style={[
                  styles.profileSchool,
                  {
                    textAlign,
                  },
                ]}
              >
                {String(school?.name ?? '—')}
              </Text>
            </View>

            <View style={styles.schoolLogoBox}>
              {school?.logo_url ? (
                <Image
                  source={{ uri: String(school.logo_url) }}
                  style={styles.schoolLogo}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons name="school" size={25} color="#0A2D44" />
              )}
            </View>
          </View>

          <View
            style={[
              styles.profileStats,
              {
                flexDirection: direction,
              },
            ]}
          >
            <MiniInfo
              icon="calendar-outline"
              label={isRTL ? 'السنة الحالية' : 'Current Year'}
              value={String(currentYear?.name ?? '—')}
            />

            <View style={styles.statDivider} />

            <MiniInfo
              icon="mail-outline"
              label={isRTL ? 'البريد الإلكتروني' : 'Email'}
              value={String(school?.email ?? profile?.email ?? user?.email ?? '—')}
            />
          </View>
        </View>

        <SectionHeader
          icon="school-outline"
          title={isRTL ? 'إعدادات المدرسة' : 'School Settings'}
          subtitle={
            isRTL
              ? 'الاسم والهاتف والبريد والشعار والموقع والسنة الحالية'
              : 'Name, phone, email, logo, location and current year'
          }
          right={
            <Pressable
              onPress={() => setSchoolEditor(true)}
              style={styles.smallAction}
            >
              <Ionicons name="create-outline" size={17} color="#0A2D44" />
              <Text style={styles.smallActionText}>
                {isRTL ? 'تعديل' : 'Edit'}
              </Text>
            </Pressable>
          }
        />

        <View
          style={[
            styles.groupCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <SettingRow
            icon="school-outline"
            iconBackground="rgba(247,184,58,0.13)"
            iconColor="#F7B83A"
            title={isRTL ? 'اسم المدرسة' : 'School Name'}
            subtitle={String(school?.name ?? '—')}
          />

          <Divider />

          <SettingRow
            icon="mail-outline"
            iconBackground="rgba(52,152,219,0.10)"
            iconColor="#3498DB"
            title={isRTL ? 'البريد الإلكتروني للمدرسة' : 'School Email'}
            subtitle={String(school?.email ?? profile?.email ?? user?.email ?? '—')}
          />

          <Divider />

          <SettingRow
            icon="calendar-outline"
            iconBackground="rgba(52,152,219,0.10)"
            iconColor="#3498DB"
            title={isRTL ? 'السنة الدراسية الحالية' : 'Current Academic Year'}
            subtitle={String(currentYear?.name ?? '—')}
          />

          <Divider />

          <SettingRow
            icon="location-outline"
            iconBackground="rgba(32,160,106,0.10)"
            iconColor="#20A06A"
            title={isRTL ? 'موقع المدرسة' : 'School Location'}
            subtitle={
              school?.lat != null && school?.lng != null
                ? `${school.lat}, ${school.lng}`
                : isRTL
                ? 'غير محدد'
                : 'Not configured'
            }
          />
        </View>

        <SectionHeader
          icon="notifications-outline"
          title={isRTL ? 'الإشعارات' : 'Notifications'}
          subtitle={
            isRTL
              ? 'تحكم بما يصل إلى حساب الإدارة'
              : 'Control what reaches the admin account'
          }
          right={
            savingPrefs ? (
              <ActivityIndicator size="small" color="#F7B83A" />
            ) : undefined
          }
        />

        <View
          style={[
            styles.groupCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <SwitchRow
            icon="notifications-outline"
            title={isRTL ? 'الإشعارات الخارجية' : 'Push Notifications'}
            subtitle={
              isRTL
                ? 'السماح بعرض إشعارات النظام.'
                : 'Allow system push notifications.'
            }
            value={prefs.push_enabled}
            onValueChange={(value) => updatePref('push_enabled', value)}
          />

          <Divider />

          <SwitchRow
            icon="school-outline"
            title={isRTL ? 'إعلانات المدرسة' : 'School Announcements'}
            subtitle={
              isRTL
                ? 'الإعلانات والتعاميم العامة.'
                : 'School-wide announcements and notices.'
            }
            value={prefs.school_announcements}
            onValueChange={(value) => updatePref('school_announcements', value)}
          />

          <Divider />

          <SwitchRow
            icon="megaphone-outline"
            title={isRTL ? 'البث العام' : 'General Broadcasts'}
            subtitle={
              isRTL
                ? 'رسائل البث الموجهة للإدارة.'
                : 'General broadcasts addressed to administration.'
            }
            value={prefs.general_broadcasts}
            onValueChange={(value) => updatePref('general_broadcasts', value)}
          />

          <Divider />

          <SwitchRow
            icon="warning-outline"
            title={isRTL ? 'بلاغات الحافلات' : 'Bus Incidents'}
            subtitle={
              isRTL
                ? 'الحوادث والمشاكل التشغيلية.'
                : 'Incidents and operational bus issues.'
            }
            value={prefs.bus_incidents}
            onValueChange={(value) => updatePref('bus_incidents', value)}
          />

          <Divider />

          <SwitchRow
            icon="clipboard-outline"
            title={isRTL ? 'تغييرات الحضور' : 'Attendance Changes'}
            subtitle={
              isRTL
                ? 'تغييرات حالات الطلاب في الرحلات.'
                : 'Student trip attendance changes.'
            }
            value={prefs.attendance_changes}
            onValueChange={(value) => updatePref('attendance_changes', value)}
          />

          <Divider />

          <SwitchRow
            icon="volume-mute-outline"
            title={isRTL ? 'كتم جميع الإشعارات' : 'Mute All'}
            subtitle={
              isRTL
                ? 'إيقاف كل التنبيهات مؤقتاً.'
                : 'Temporarily silence all alerts.'
            }
            value={prefs.mute_all}
            onValueChange={(value) => updatePref('mute_all', value)}
          />
        </View>

        <SectionHeader
          icon="color-palette-outline"
          title={isRTL ? 'المظهر' : 'Appearance'}
          subtitle={
            isRTL
              ? 'نفس إعدادات المظهر في تطبيق ولي الأمر والسائق'
              : 'Same appearance controls used by parent and driver'
          }
        />

        <View
          style={[
            styles.groupCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.fieldLabel,
              {
                color: theme.colors.text,
                textAlign,
              },
            ]}
          >
            {isRTL ? 'نمط العرض' : 'Theme'}
          </Text>

          <View
            style={[
              styles.segmentedRow,
              {
                flexDirection: direction,
              },
            ]}
          >
            <SegmentOption
              title={isRTL ? 'فاتح' : 'Light'}
              icon="sunny-outline"
              selected={mode === 'light'}
              onPress={() => void setMode('light')}
            />

            <SegmentOption
              title={isRTL ? 'داكن' : 'Dark'}
              icon="moon-outline"
              selected={mode === 'dark'}
              onPress={() => void setMode('dark')}
            />

            <SegmentOption
              title={isRTL ? 'الجهاز' : 'System'}
              icon="phone-portrait-outline"
              selected={mode === 'system'}
              onPress={() => void setMode('system')}
            />
          </View>
        </View>

        <SectionHeader
          icon="language-outline"
          title={isRTL ? 'اللغة' : 'Language'}
          subtitle={
            isRTL
              ? 'لغة واجهة التطبيق واتجاه العرض'
              : 'Application language and layout direction'
          }
        />

        <View
          style={[
            styles.groupCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.segmentedRow,
              {
                flexDirection: direction,
                paddingTop: 14,
              },
            ]}
          >
            <SegmentOption
              title="العربية"
              icon="language-outline"
              selected={language === 'ar'}
              onPress={() => void setLanguage('ar')}
            />

            <SegmentOption
              title="English"
              icon="language-outline"
              selected={language === 'en'}
              onPress={() => void setLanguage('en')}
            />
          </View>
        </View>

        <Pressable onPress={() => setPasswordVisible(true)} style={[styles.logoutButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, marginBottom: 10 }]}>
          <Ionicons name="key-outline" size={20} color="#F7B83A" />
          <Text style={[styles.logoutText, { color: theme.colors.text }]}>{isRTL ? 'تغيير كلمة مرور الإدارة' : 'Change Admin Password'}</Text>
        </Pressable>

        <Pressable
          onPress={signOut}
          style={({ pressed }) => [
            styles.logoutButton,
            {
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={21} color="#D94A4A" />
          <Text style={styles.logoutText}>
            {isRTL ? 'تسجيل الخروج' : 'Logout'}
          </Text>
        </Pressable>

        <Text
          style={[
            styles.footerText,
            {
              color: theme.colors.textSecondary,
            },
          ]}
        >
          Smart School Bus
        </Text>
      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={schoolEditor}
        onRequestClose={() => !savingSchool && setSchoolEditor(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !savingSchool && setSchoolEditor(false)}
          />

          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                {
                  flexDirection: direction,
                },
              ]}
            >
              <View
                style={[
                  styles.modalHeaderIcon,
                  {
                    backgroundColor: 'rgba(247,184,58,0.14)',
                  },
                ]}
              >
                <Ionicons name="school-outline" size={22} color="#F7B83A" />
              </View>

              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: theme.colors.text,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL ? 'تعديل إعدادات المدرسة' : 'Edit School Settings'}
                </Text>

                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      color: theme.colors.textSecondary,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'لا تظهر أي معرفات أو حقول تقنية في هذه الشاشة.'
                    : 'No technical database IDs are exposed here.'}
                </Text>
              </View>

              <Pressable
                onPress={() => setSchoolEditor(false)}
                disabled={savingSchool}
                style={[
                  styles.closeButton,
                  {
                    backgroundColor: theme.colors.surface2,
                  },
                ]}
              >
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <EditorField
                label={isRTL ? 'اسم المدرسة' : 'School Name'}
                icon="school-outline"
                value={form.name}
                onChange={(value) => setForm((current) => ({ ...current, name: value }))}
              />

              <EditorField
                label={isRTL ? 'هاتف المدرسة' : 'School Phone'}
                icon="call-outline"
                value={form.phone}
                keyboardType="phone-pad"
                onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
              />

              <EditorField
                label={isRTL ? 'البريد الإلكتروني للمدرسة' : 'School Email'}
                icon="mail-outline"
                value={form.email}
                keyboardType="email-address"
                onChange={(value) => setForm((current) => ({ ...current, email: value }))}
              />

              <AdminImagePickerField
                label={isRTL ? 'شعار المدرسة' : 'School Logo'}
                schoolId={schoolId}
                entity="school-logo"
                value={form.logo_url || null}
                onChange={(url) =>
                  setForm((current) => ({
                    ...current,
                    logo_url: url,
                  }))
                }
              />

              <View style={styles.editorField}>
                <Text
                  style={[
                    styles.editorLabel,
                    {
                      color: theme.colors.textSecondary,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL ? 'موقع المدرسة' : 'School Location'}
                </Text>

                <Pressable
                  onPress={() => setLocationPicker(true)}
                  style={[
                    styles.editorChoice,
                    {
                      backgroundColor: theme.colors.surface2,
                      borderColor: theme.colors.border,
                      flexDirection: direction,
                    },
                  ]}
                >
                  <View style={styles.editorChoiceIcon}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color="#0A2D44"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.editorChoiceText,
                        {
                          color: theme.colors.text,
                          textAlign,
                        },
                      ]}
                    >
                      {form.lat && form.lng
                        ? isRTL
                          ? 'تم تحديد موقع المدرسة'
                          : 'School location selected'
                        : isRTL
                        ? 'فتح الخريطة وتحديد الموقع'
                        : 'Open map and select location'}
                    </Text>

                    {!!form.lat && !!form.lng && (
                      <Text
                        style={{
                          marginTop: 2,
                          fontSize: 7.5,
                          fontWeight: '700',
                          color: theme.colors.textSecondary,
                          textAlign,
                        }}
                      >
                        {form.lat}, {form.lng}
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

              <View style={styles.editorField}>
                <Text
                  style={[
                    styles.editorLabel,
                    {
                      color: theme.colors.textSecondary,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL ? 'السنة الدراسية الحالية' : 'Current Academic Year'}
                </Text>

                <Pressable
                  onPress={() => setYearPicker(true)}
                  style={[
                    styles.editorChoice,
                    {
                      backgroundColor: theme.colors.surface2,
                      borderColor: theme.colors.border,
                      flexDirection: direction,
                    },
                  ]}
                >
                  <View style={styles.editorChoiceIcon}>
                    <Ionicons name="calendar-outline" size={18} color="#0A2D44" />
                  </View>

                  <Text
                    numberOfLines={1}
                    style={[
                      styles.editorChoiceText,
                      {
                        color: theme.colors.text,
                        textAlign,
                      },
                    ]}
                  >
                    {String(currentYear?.name ?? (isRTL ? 'اختر السنة' : 'Select year'))}
                  </Text>

                  <Ionicons
                    name={isRTL ? 'chevron-back' : 'chevron-forward'}
                    size={17}
                    color="#8191A0"
                  />
                </Pressable>
              </View>

              <View
                style={[
                  styles.schoolActiveRow,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface2,
                    flexDirection: direction,
                  },
                ]}
              >
                <View style={styles.editorChoiceIcon}>
                  <Ionicons name="power-outline" size={18} color="#0A2D44" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.schoolActiveTitle,
                      {
                        color: theme.colors.text,
                        textAlign,
                      },
                    ]}
                  >
                    {isRTL ? 'المدرسة فعالة' : 'School Active'}
                  </Text>

                  <Text
                    style={[
                      styles.schoolActiveSub,
                      {
                        color: theme.colors.textSecondary,
                        textAlign,
                      },
                    ]}
                  >
                    {isRTL
                      ? 'حالة تشغيل المدرسة داخل النظام.'
                      : 'Operational status of this school.'}
                  </Text>
                </View>

                <Switch
                  value={form.is_active}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, is_active: value }))
                  }
                  trackColor={{ false: '#D7E0E8', true: '#F6D180' }}
                  thumbColor={form.is_active ? '#F7B83A' : '#FFFFFF'}
                />
              </View>

              <Pressable
                disabled={savingSchool}
                onPress={() => void saveSchool()}
                style={[
                  styles.primaryButton,
                  {
                    opacity: savingSchool ? 0.72 : 1,
                  },
                ]}
              >
                {savingSchool ? (
                  <ActivityIndicator color="#0A2D44" />
                ) : (
                  <Ionicons name="checkmark-done" size={21} color="#0A2D44" />
                )}

                <Text style={styles.primaryButtonText}>
                  {isRTL ? 'حفظ إعدادات المدرسة' : 'Save School Settings'}
                </Text>
              </Pressable>
            </ScrollView>

            <AdminSelectionModal
              visible={yearPicker}
              embedded
              title={isRTL ? 'السنة الدراسية الحالية' : 'Current Academic Year'}
              subtitle={
                isRTL
                  ? 'اختر السنة التي ستعتمدها المدرسة حالياً.'
                  : 'Choose the academic year currently used by the school.'
              }
              items={yearItems}
              selectedValue={form.current_academic_year_id}
              onClose={() => setYearPicker(false)}
              onSelect={(value) => {
                setForm((current) => ({
                  ...current,
                  current_academic_year_id: value ?? '',
                }));
                setYearPicker(false);
              }}
            />

            <AdminLocationPickerPanel
              visible={locationPicker}
              title={isRTL ? 'موقع المدرسة' : 'School Location'}
              latitude={form.lat ? Number(form.lat) : null}
              longitude={form.lng ? Number(form.lng) : null}
              onClose={() => setLocationPicker(false)}
              onConfirm={(latitude, longitude) => {
                setForm((current) => ({
                  ...current,
                  lat: String(latitude),
                  lng: String(longitude),
                }));
                setLocationPicker(false);
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>


      <Modal visible={passwordVisible} transparent animationType="slide" onRequestClose={() => setPasswordVisible(false)}>
        <View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => !savingPassword && setPasswordVisible(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text, textAlign }]}>{isRTL ? 'تغيير كلمة المرور' : 'Change Password'}</Text>
            <TextInput secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholder={isRTL ? 'كلمة المرور الجديدة' : 'New password'} placeholderTextColor="#8191A0" style={[styles.passwordInput, { color: theme.colors.text, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, textAlign }]} />
            <TextInput secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder={isRTL ? 'تأكيد كلمة المرور' : 'Confirm password'} placeholderTextColor="#8191A0" style={[styles.passwordInput, { color: theme.colors.text, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, textAlign, marginTop: 10 }]} />
            <Pressable disabled={savingPassword} onPress={() => void changePassword()} style={styles.passwordSaveButton}><Text style={styles.passwordSaveText}>{savingPassword ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ كلمة المرور' : 'Save Password')}</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  function SectionHeader({
    icon,
    title,
    subtitle,
    right,
  }: {
    icon: IconName;
    title: string;
    subtitle: string;
    right?: React.ReactNode;
  }) {
    return (
      <View
        style={[
          styles.sectionHeader,
          {
            flexDirection: direction,
          },
        ]}
      >
        <View
          style={[
            styles.sectionIcon,
            {
              backgroundColor: 'rgba(247,184,58,0.14)',
            },
          ]}
        >
          <Ionicons name={icon} size={20} color="#F7B83A" />
        </View>

        <View style={{ flex: 1, marginHorizontal: 10 }}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.colors.text,
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
                color: theme.colors.textSecondary,
                textAlign,
              },
            ]}
          >
            {subtitle}
          </Text>
        </View>

        {right}
      </View>
    );
  }

  function SettingRow({
    icon,
    iconBackground,
    iconColor,
    title,
    subtitle,
  }: {
    icon: IconName;
    iconBackground: string;
    iconColor: string;
    title: string;
    subtitle?: string;
  }) {
    return (
      <View
        style={[
          styles.settingRow,
          {
            flexDirection: direction,
          },
        ]}
      >
        <View
          style={[
            styles.settingIcon,
            {
              backgroundColor: iconBackground,
            },
          ]}
        >
          <Ionicons name={icon} size={21} color={iconColor} />
        </View>

        <View style={{ flex: 1, marginHorizontal: 11 }}>
          <Text
            style={[
              styles.settingTitle,
              {
                color: theme.colors.text,
                textAlign,
              },
            ]}
          >
            {title}
          </Text>

          {!!subtitle && (
            <Text
              numberOfLines={1}
              style={[
                styles.settingSubtitle,
                {
                  color: theme.colors.textSecondary,
                  textAlign,
                },
              ]}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
    );
  }

  function SwitchRow({
    icon,
    title,
    subtitle,
    value,
    onValueChange,
  }: {
    icon: IconName;
    title: string;
    subtitle: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) {
    return (
      <View
        style={[
          styles.settingRow,
          {
            flexDirection: direction,
          },
        ]}
      >
        <View
          style={[
            styles.settingIcon,
            {
              backgroundColor: 'rgba(247,184,58,0.13)',
            },
          ]}
        >
          <Ionicons name={icon} size={21} color="#F7B83A" />
        </View>

        <View style={{ flex: 1, marginHorizontal: 11 }}>
          <Text
            style={[
              styles.settingTitle,
              {
                color: theme.colors.text,
                textAlign,
              },
            ]}
          >
            {title}
          </Text>

          <Text
            style={[
              styles.settingSubtitle,
              {
                color: theme.colors.textSecondary,
                textAlign,
              },
            ]}
          >
            {subtitle}
          </Text>
        </View>

        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#D7E0E8', true: '#F6D180' }}
          thumbColor={value ? '#F7B83A' : '#FFFFFF'}
          ios_backgroundColor="#D7E0E8"
        />
      </View>
    );
  }

  function SegmentOption({
    title,
    icon,
    selected,
    onPress,
  }: {
    title: string;
    icon: IconName;
    selected: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.segmentOption,
          {
            backgroundColor: selected ? '#F7B83A' : theme.colors.surface2,
            borderColor: selected ? '#F7B83A' : theme.colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={selected ? '#0A2D44' : theme.colors.textSecondary}
        />

        <Text
          numberOfLines={1}
          style={[
            styles.segmentText,
            {
              color: selected ? '#0A2D44' : theme.colors.text,
            },
          ]}
        >
          {title}
        </Text>
      </Pressable>
    );
  }

  function MiniInfo({
    icon,
    label,
    value,
  }: {
    icon: IconName;
    label: string;
    value: string;
  }) {
    return (
      <View style={styles.miniInfo}>
        <View
          style={[
            styles.miniLabelRow,
            {
              flexDirection: direction,
            },
          ]}
        >
          <Ionicons name={icon} size={13} color="#AFC2D0" />
          <Text style={styles.miniLabel}>{label}</Text>
        </View>

        <Text numberOfLines={1} style={styles.miniValue}>
          {value}
        </Text>
      </View>
    );
  }

  function Divider() {
    return (
      <View
        style={[
          styles.divider,
          {
            backgroundColor: theme.colors.border,
          },
        ]}
      />
    );
  }

  function EditorField({
    label,
    icon,
    value,
    onChange,
    keyboardType,
  }: {
    label: string;
    icon: IconName;
    value: string;
    onChange: (value: string) => void;
    keyboardType?: any;
  }) {
    return (
      <View style={styles.editorField}>
        <Text
          style={[
            styles.editorLabel,
            {
              color: theme.colors.textSecondary,
              textAlign,
            },
          ]}
        >
          {label}
        </Text>

        <View
          style={[
            styles.editorInputWrap,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              flexDirection: direction,
            },
          ]}
        >
          <Ionicons name={icon} size={18} color="#F7B83A" />

          <TextInput
            value={value}
            onChangeText={onChange}
            keyboardType={keyboardType}
            style={[
              styles.editorInput,
              {
                color: theme.colors.text,
                textAlign,
              },
            ]}
          />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 38,
  },

  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingBadge: {
    width: 68,
    height: 68,
    borderRadius: 23,
    backgroundColor: '#0A2D44',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
  },

  titleRow: {
    alignItems: 'center',
    marginBottom: 15,
  },

  pageEyebrow: {
    fontSize: 11,
    fontWeight: '700',
  },

  pageTitle: {
    marginTop: 2,
    fontSize: 28,
    fontWeight: '900',
  },

  titleIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  titleSystemLogo: {
    width: 46,
    height: 46,
  },

  profileCard: {
    borderRadius: 28,
    padding: 16,
    backgroundColor: '#0A2D44',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 7,
  },

  profileTop: {
    alignItems: 'center',
  },

  avatarWrap: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: '#0A2D44',
    fontSize: 20,
    fontWeight: '900',
  },

  profileName: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },

  roleRow: {
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },

  profileRole: {
    color: '#AFC2D0',
    fontSize: 10,
    fontWeight: '700',
  },

  profileSchool: {
    color: '#D9E6EF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },

  schoolLogoBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  schoolLogo: {
    width: 42,
    height: 42,
  },

  profileStats: {
    minHeight: 61,
    marginTop: 15,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },

  miniInfo: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },

  miniLabelRow: {
    alignItems: 'center',
    gap: 5,
  },

  miniLabel: {
    color: '#AFC2D0',
    fontSize: 8,
    fontWeight: '700',
  },

  miniValue: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  sectionHeader: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 9,
  },

  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
  },

  sectionSubtitle: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '600',
  },

  smallAction: {
    minHeight: 37,
    borderRadius: 12,
    backgroundColor: '#F7B83A',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  smallActionText: {
    color: '#0A2D44',
    fontSize: 8.5,
    fontWeight: '900',
  },

  groupCard: {
    borderRadius: 23,
    borderWidth: 1,
    paddingHorizontal: 13,
    overflow: 'hidden',
  },

  settingRow: {
    minHeight: 74,
    alignItems: 'center',
    paddingVertical: 10,
  },

  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  settingTitle: {
    fontSize: 12,
    fontWeight: '900',
  },

  settingSubtitle: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: '600',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
  },

  fieldLabel: {
    marginTop: 14,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '900',
  },

  segmentedRow: {
    gap: 7,
    paddingBottom: 14,
  },

  segmentOption: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  segmentText: {
    fontSize: 9,
    fontWeight: '900',
  },

  logoutButton: {
    marginTop: 25,
    height: 55,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(217,74,74,0.25)',
    backgroundColor: 'rgba(217,74,74,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  logoutText: {
    color: '#D94A4A',
    fontSize: 13,
    fontWeight: '900',
  },

  footerText: {
    marginTop: 17,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(5,20,32,0.48)',
  },

  modalCard: {
    maxHeight: '91%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
  },

  modalHeader: {
    alignItems: 'center',
    marginBottom: 15,
  },

  modalHeaderIcon: {
    width: 47,
    height: 47,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
  },

  modalSubtitle: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: '600',
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editorField: {
    marginTop: 12,
  },

  editorLabel: {
    marginBottom: 7,
    fontSize: 10,
    fontWeight: '800',
  },

  editorInputWrap: {
    height: 53,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 13,
    alignItems: 'center',
    gap: 9,
  },

  editorInput: {
    flex: 1,
    height: '100%',
    fontSize: 12,
    fontWeight: '700',
  },

  editorChoice: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 8,
  },

  editorChoiceIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editorChoiceText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
  },

  schoolActiveRow: {
    minHeight: 64,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 9,
  },

  schoolActiveTitle: {
    fontSize: 10.5,
    fontWeight: '900',
  },

  schoolActiveSub: {
    marginTop: 3,
    fontSize: 8,
    fontWeight: '600',
  },

  primaryButton: {
    marginTop: 19,
    height: 53,
    borderRadius: 17,
    backgroundColor: '#F7B83A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  primaryButtonText: {
    color: '#0A2D44',
    fontSize: 13,
    fontWeight: '900',
  },

  passwordInput: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, fontSize: 12, fontWeight: '700' }, passwordSaveButton: { height: 52, marginTop: 14, borderRadius: 16, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' }, passwordSaveText: { color: '#0A2D44', fontSize: 11, fontWeight: '900' },
});
