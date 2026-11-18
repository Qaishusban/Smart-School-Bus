import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  Modal,
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
import * as SecureStore from 'expo-secure-store';

import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { supabase } from '../../lib/supabase';
import {
  getTeacherNotificationPreferences,
  resolveTeacherProfile,
  rowName,
  saveTeacherNotificationPreferences
} from '../../services/teacherService';
import TeacherLocationPickerModal from '../../components/teacher/TeacherLocationPickerModal';

const SYSTEM_LOGO = require('../../assets/system-logo.png') as ImageSourcePropType;

type Prefs = {
  push_enabled: boolean;
  mute_all: boolean;
  driver_updates: boolean;
  bus_incidents: boolean;
  attendance_changes: boolean;
  school_announcements: boolean;
};

const DEFAULT_PREFS: Prefs = {
  push_enabled: true,
  mute_all: false,
  driver_updates: true,
  bus_incidents: true,
  attendance_changes: true,
  school_announcements: true,
};

const SESSION_STORAGE_KEY = 'smart_school_bus_session_v1';

async function getCurrentPinSessionToken(): Promise<string> {
  const raw = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);

  if (!raw) throw new Error('SESSION_NOT_FOUND');

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('SESSION_INVALID');
  }

  const token =
    parsed?.token ??
    parsed?.sessionToken ??
    parsed?.session_token ??
    parsed?.pinToken ??
    parsed?.pin_token ??
    parsed?.session?.token ??
    null;

  if (!token) throw new Error('SESSION_TOKEN_NOT_FOUND');

  return String(token);
}

export default function TeacherSettingsScreen() {
  const { user, signOut } = useAuth();
  const { theme, mode, setMode } = useAppTheme();
  const { language, setLanguage, isRTL, direction, textAlign } = useLanguage();

  const [teacher, setTeacher] = useState<Record<string, any> | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  const [profileOpen, setProfileOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [reopenProfile, setReopenProfile] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [homeLat, setHomeLat] = useState<number | null>(null);
  const [homeLng, setHomeLng] = useState<number | null>(null);
  const [homeAddress, setHomeAddress] = useState('');

  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const profile = await resolveTeacherProfile({
        teacherId: user.id,
        username: user.username ?? null,
        schoolId: user.school_id ?? null,
      });

      setTeacher(profile);
      setFullName(String(profile?.full_name ?? ''));
      setPhone(String(profile?.phone ?? ''));
      setHomeLat(profile?.home_lat != null ? Number(profile.home_lat) : null);
      setHomeLng(profile?.home_lng != null ? Number(profile.home_lng) : null);
      setHomeAddress(String(profile?.home_address ?? ''));

      if (profile?.id) {
        const currentPrefs = await getTeacherNotificationPreferences({
          teacherId: String(profile.id),
          schoolId: profile.school_id ?? user.school_id ?? null,
        });

        if (currentPrefs) {
          setPrefs({
            push_enabled: currentPrefs.push_enabled !== false,
            mute_all: currentPrefs.mute_all === true,
            driver_updates: currentPrefs.driver_updates !== false,
            bus_incidents: currentPrefs.bus_incidents !== false,
            attendance_changes: currentPrefs.attendance_changes !== false,
            school_announcements: currentPrefs.school_announcements !== false,
          });
        }
      }
    } catch (error) {
      console.log('TeacherSettings V3:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.username, user?.school_id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProfileConfirmed() {
    if (!teacher?.id) return;

    setSavingProfile(true);

    try {
      const token = await getCurrentPinSessionToken();

      const { data, error } = await supabase.rpc('teacher_update_account_v4', {
        p_token: token,
        p_full_name: fullName.trim() || null,
        p_phone: phone.trim() || null,
        p_home_lat: homeLat,
        p_home_lng: homeLng,
        p_home_address: homeAddress.trim() || null,
        p_new_pin: null,
      });

      if (error) throw error;

      const result = data as Record<string, any>;

      if (!result?.ok) {
        throw new Error(result?.error ?? 'profile_update_failed');
      }

      setProfileOpen(false);
      await load();

      Alert.alert(
        isRTL ? 'تم الحفظ' : 'Saved',
        isRTL ? 'تم تحديث بيانات المعلم.' : 'Teacher profile updated.'
      );
    } catch (error: any) {
      const raw = String(error?.message ?? '');

      Alert.alert(
        isRTL ? 'تعذر الحفظ' : 'Unable to Save',
        raw.includes('SESSION_')
          ? isRTL
            ? 'انتهت جلسة الدخول. سجل الخروج ثم ادخل مرة أخرى.'
            : 'Your login session has expired. Please sign in again.'
          : raw
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePin() {
    if (!teacher?.id) return;

    if (!/^\d{4,6}$/.test(newPin)) {
      Alert.alert(
        isRTL ? 'رمز PIN غير صالح' : 'Invalid PIN',
        isRTL
          ? 'رمز PIN يجب أن يكون من 4 إلى 6 أرقام.'
          : 'PIN must contain 4 to 6 digits.'
      );
      return;
    }

    if (newPin !== confirmNewPin) {
      Alert.alert(isRTL ? 'الرمزان غير متطابقين' : 'PINs Do Not Match');
      return;
    }

    setSavingPin(true);

    try {
      const token = await getCurrentPinSessionToken();

      const { data, error } = await supabase.rpc('teacher_update_account_v4', {
        p_token: token,
        p_full_name: null,
        p_phone: null,
        p_home_lat: null,
        p_home_lng: null,
        p_home_address: null,
        p_new_pin: newPin,
      });

      if (error) throw error;

      const result = data as Record<string, any>;
      if (!result?.ok) throw new Error(result?.error ?? 'pin_update_failed');

      setNewPin('');
      setConfirmNewPin('');
      setPinOpen(false);

      Alert.alert(
        isRTL ? 'تم تغيير رمز PIN' : 'PIN Changed',
        isRTL
          ? 'تم تحديث رمز الدخول بنجاح.'
          : 'Login PIN updated successfully.'
      );
    } catch (error: any) {
      const raw = String(error?.message ?? '');

      Alert.alert(
        isRTL ? 'تعذر تغيير PIN' : 'Unable to Change PIN',
        raw.includes('SESSION_')
          ? isRTL
            ? 'انتهت جلسة الدخول. سجل الخروج ثم ادخل مرة أخرى.'
            : 'Your login session has expired. Please sign in again.'
          : raw
      );
    } finally {
      setSavingPin(false);
    }
  }

  async function updatePref(key: keyof Prefs, value: boolean) {
    if (!teacher?.id) return;

    const previous = prefs;
    const next = { ...prefs, [key]: value };

    if (key === 'mute_all' && value) next.push_enabled = false;
    if (key === 'push_enabled' && value) next.mute_all = false;

    setPrefs(next);
    setSavingPrefs(true);

    try {
      await saveTeacherNotificationPreferences({
        teacherId: String(teacher.id),
        schoolId: teacher.school_id ?? user?.school_id ?? null,
        values: next,
      });
    } catch (error: any) {
      setPrefs(previous);
      Alert.alert(
        isRTL ? 'تعذر حفظ إعدادات الإشعارات' : 'Unable to Save Notification Settings',
        error?.message ?? String(error)
      );
    } finally {
      setSavingPrefs(false);
    }
  }

  function openLocation() {
    setReopenProfile(true);
    setProfileOpen(false);
    setTimeout(() => setLocationOpen(true), 120);
  }

  function closeLocation() {
    setLocationOpen(false);
    if (reopenProfile) {
      setTimeout(() => setProfileOpen(true), 120);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color="#F7B83A" />
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.pageHeader, { flexDirection: direction }]}>
          <View style={styles.logoBox}>
            <Image source={SYSTEM_LOGO} style={styles.logo} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pageEyebrow, { textAlign }]}>SMART SCHOOL BUS</Text>
            <Text style={[styles.pageTitle, { color: theme.colors.text, textAlign }]}>
              {isRTL ? 'الإعدادات' : 'Settings'}
            </Text>
            <Text style={[styles.pageSub, { color: theme.colors.textSecondary, textAlign }]}>
              {isRTL ? 'الحساب والإشعارات والمظهر واللغة' : 'Account, notifications, appearance and language'}
            </Text>
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={[styles.profileTop, { flexDirection: direction }]}>
            <View style={styles.avatar}>
              <Ionicons name="school" size={28} color="#0A2D44" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { textAlign }]}>
                {rowName(teacher) || user?.full_name || '—'}
              </Text>
              <Text style={[styles.profileRole, { textAlign }]}>
                {isRTL ? 'المعلم / مشرف النقل' : 'Teacher / Transport Supervisor'}
              </Text>
              <Text style={[styles.profilePhone, { textAlign }]}>
                {String(teacher?.phone ?? '—')}
              </Text>
            </View>
            <Pressable onPress={() => setProfileOpen(true)} style={styles.editButton}>
              <Ionicons name="create-outline" size={19} color="#0A2D44" />
            </Pressable>
          </View>

          <View style={[styles.profileMeta, { flexDirection: direction }]}>
            <MiniInfo
              icon="person-outline"
              label={isRTL ? 'اسم المستخدم' : 'Username'}
              value={String(teacher?.username ?? '—')}
            />
            <View style={styles.profileDivider} />
            <MiniInfo
              icon="location-outline"
              label={isRTL ? 'الموقع' : 'Location'}
              value={
                homeLat != null && homeLng != null
                  ? isRTL
                    ? 'محدد'
                    : 'Set'
                  : isRTL
                  ? 'غير محدد'
                  : 'Not Set'
              }
            />
          </View>
        </View>

        <SectionTitle
          icon="notifications-outline"
          title={isRTL ? 'الإشعارات' : 'Notifications'}
          subtitle={isRTL ? 'تحكم بما يصل إلى حساب المعلم' : 'Control what reaches the teacher account'}
        />

        <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <ToggleRow
            icon="notifications-outline"
            title={isRTL ? 'الإشعارات الخارجية' : 'Push Notifications'}
            subtitle={isRTL ? 'السماح بإشعارات النظام خارج التطبيق.' : 'Allow system notifications outside the app.'}
            value={prefs.push_enabled}
            onChange={(value) => void updatePref('push_enabled', value)}
          />
          <ToggleRow
            icon="bus-outline"
            title={isRTL ? 'تحديثات السائق والرحلة' : 'Driver & Trip Updates'}
            subtitle={isRTL ? 'البداية والنهاية والتحديثات التشغيلية.' : 'Trip start/end and operational updates.'}
            value={prefs.driver_updates}
            onChange={(value) => void updatePref('driver_updates', value)}
          />
          <ToggleRow
            icon="warning-outline"
            title={isRTL ? 'بلاغات الحافلة' : 'Bus Incidents'}
            subtitle={isRTL ? 'التأخير والحوادث والمشاكل التشغيلية.' : 'Delays, incidents and operational issues.'}
            value={prefs.bus_incidents}
            onChange={(value) => void updatePref('bus_incidents', value)}
          />
          <ToggleRow
            icon="clipboard-outline"
            title={isRTL ? 'تغييرات الحضور' : 'Attendance Changes'}
            subtitle={isRTL ? 'حالات صعود ووصول وغياب وتوصيل الطلاب.' : 'Boarding, arrival, absence and delivery changes.'}
            value={prefs.attendance_changes}
            onChange={(value) => void updatePref('attendance_changes', value)}
          />
          <ToggleRow
            icon="school-outline"
            title={isRTL ? 'إعلانات المدرسة' : 'School Announcements'}
            subtitle={isRTL ? 'الإعلانات والتعليمات العامة.' : 'General announcements and instructions.'}
            value={prefs.school_announcements}
            onChange={(value) => void updatePref('school_announcements', value)}
          />
          <ToggleRow
            icon="notifications-off-outline"
            title={isRTL ? 'كتم جميع الإشعارات' : 'Mute All Notifications'}
            subtitle={isRTL ? 'إيقاف كل التنبيهات مؤقتاً.' : 'Temporarily stop all notifications.'}
            value={prefs.mute_all}
            onChange={(value) => void updatePref('mute_all', value)}
            last
          />
        </View>

        {!!savingPrefs && (
          <Text style={[styles.saving, { color: theme.colors.textSecondary }]}>
            {isRTL ? 'جاري الحفظ...' : 'Saving...'}
          </Text>
        )}

        <SectionTitle
          icon="color-palette-outline"
          title={isRTL ? 'المظهر' : 'Appearance'}
          subtitle={isRTL ? 'نفس أسلوب إعدادات الإدارة' : 'Same visual system as Admin settings'}
        />

        <View style={[styles.segmentCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={[styles.segmentRow, { flexDirection: direction }]}>
            <Segment
              icon="sunny-outline"
              label={isRTL ? 'فاتح' : 'Light'}
              active={mode === 'light'}
              onPress={() => setMode('light')}
            />
            <Segment
              icon="moon-outline"
              label={isRTL ? 'داكن' : 'Dark'}
              active={mode === 'dark'}
              onPress={() => setMode('dark')}
            />
            <Segment
              icon="phone-portrait-outline"
              label={isRTL ? 'الجهاز' : 'System'}
              active={mode === 'system'}
              onPress={() => setMode('system')}
            />
          </View>
        </View>

        <SectionTitle
          icon="language-outline"
          title={isRTL ? 'اللغة' : 'Language'}
          subtitle={isRTL ? 'لغة واتجاه واجهة التطبيق' : 'Application language and direction'}
        />

        <View style={[styles.segmentCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={[styles.segmentRow, { flexDirection: direction }]}>
            <Segment
              icon="language-outline"
              label="العربية"
              active={language === 'ar'}
              onPress={() => setLanguage('ar')}
            />
            <Segment
              icon="language-outline"
              label="English"
              active={language === 'en'}
              onPress={() => setLanguage('en')}
            />
          </View>
        </View>

        <Pressable
          onPress={() => setPinOpen(true)}
          style={[styles.securityButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
        >
          <Ionicons name="key-outline" size={20} color="#F7B83A" />
          <Text style={[styles.securityText, { color: theme.colors.text }]}>
            {isRTL ? 'تغيير رمز PIN' : 'Change PIN'}
          </Text>
        </Pressable>

        <Pressable onPress={signOut} style={styles.logout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4D55" />
          <Text style={styles.logoutText}>
            {isRTL ? 'تسجيل الخروج' : 'Logout'}
          </Text>
        </Pressable>

        <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
          Smart School Bus
        </Text>
      </ScrollView>

      <Modal transparent animationType="slide" visible={profileOpen} onRequestClose={() => setProfileOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setProfileOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
            <SheetHeader
              title={isRTL ? 'تعديل بيانات المعلم' : 'Edit Teacher Profile'}
              icon="person"
              onClose={() => setProfileOpen(false)}
            />

            <Field
              label={isRTL ? 'اسم المعلم' : 'Teacher Name'}
              value={fullName}
              onChange={setFullName}
              icon="school-outline"
            />
            <Field
              label={isRTL ? 'الهاتف' : 'Phone'}
              value={phone}
              onChange={setPhone}
              icon="call-outline"
              keyboardType="phone-pad"
            />

            <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, textAlign }]}>
              {isRTL ? 'الموقع' : 'Location'}
            </Text>

            <Pressable
              onPress={openLocation}
              style={[
                styles.locationField,
                {
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                  flexDirection: direction,
                },
              ]}
            >
              <View style={styles.locationIcon}>
                <Ionicons name="location-outline" size={19} color="#0A2D44" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.locationTitle, { color: theme.colors.text, textAlign }]}>
                  {homeLat != null && homeLng != null
                    ? isRTL
                      ? 'تم تحديد الموقع'
                      : 'Location Selected'
                    : isRTL
                    ? 'تحديد الموقع'
                    : 'Set Location'}
                </Text>
                <Text numberOfLines={1} style={[styles.locationSub, { color: theme.colors.textSecondary, textAlign }]}>
                  {homeAddress ||
                    (homeLat != null && homeLng != null
                      ? `${homeLat.toFixed(6)}, ${homeLng.toFixed(6)}`
                      : isRTL
                      ? 'اضغط لفتح الخريطة'
                      : 'Tap to open map')}
                </Text>
              </View>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color="#98A2B3"
              />
            </Pressable>

            <Pressable
              disabled={savingProfile}
              onPress={() => void saveProfileConfirmed()}
              style={[styles.saveButton, { opacity: savingProfile ? 0.6 : 1 }]}
            >
              {savingProfile ? (
                <ActivityIndicator color="#0A2D44" />
              ) : (
                <Ionicons name="checkmark-done" size={20} color="#0A2D44" />
              )}
              <Text style={styles.saveText}>
                {isRTL ? 'حفظ التعديلات' : 'Save Changes'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={pinOpen} onRequestClose={() => setPinOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPinOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
            <SheetHeader
              title={isRTL ? 'تغيير رمز PIN' : 'Change PIN'}
              icon="key"
              onClose={() => setPinOpen(false)}
            />
            <Field
              label={isRTL ? 'رمز PIN الجديد' : 'New PIN'}
              value={newPin}
              onChange={setNewPin}
              icon="lock-closed-outline"
              keyboardType="number-pad"
              secure
            />
            <Field
              label={isRTL ? 'تأكيد PIN الجديد' : 'Confirm New PIN'}
              value={confirmNewPin}
              onChange={setConfirmNewPin}
              icon="checkmark-circle-outline"
              keyboardType="number-pad"
              secure
            />
            <Pressable
              disabled={savingPin}
              onPress={() => void changePin()}
              style={[styles.saveButton, { opacity: savingPin ? 0.6 : 1 }]}
            >
              {savingPin ? <ActivityIndicator color="#0A2D44" /> : <Ionicons name="checkmark-done" size={20} color="#0A2D44" />}
              <Text style={styles.saveText}>
                {isRTL ? 'تغيير رمز PIN' : 'Change PIN'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <TeacherLocationPickerModal
        visible={locationOpen}
        latitude={homeLat}
        longitude={homeLng}
        onClose={closeLocation}
        onConfirm={(lat, lng, address) => {
          setHomeLat(lat);
          setHomeLng(lng);
          setHomeAddress(address ?? '');
          setLocationOpen(false);
          if (reopenProfile) {
            setTimeout(() => setProfileOpen(true), 120);
          }
        }}
      />
    </SafeAreaView>
  );

  function MiniInfo({
    icon,
    label,
    value,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    value: string;
  }) {
    return (
      <View style={styles.miniInfo}>
        <Ionicons name={icon} size={15} color="#F7B83A" />
        <Text style={styles.miniLabel}>{label}</Text>
        <Text style={styles.miniValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    );
  }

  function SectionTitle({
    icon,
    title,
    subtitle,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    subtitle: string;
  }) {
    return (
      <View style={[styles.sectionHeading, { flexDirection: direction }]}>
        <View style={styles.sectionHeadingIcon}>
          <Ionicons name={icon} size={20} color="#F7B83A" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionHeadingTitle, { color: theme.colors.text, textAlign }]}>
            {title}
          </Text>
          <Text style={[styles.sectionHeadingSub, { color: theme.colors.textSecondary, textAlign }]}>
            {subtitle}
          </Text>
        </View>
      </View>
    );
  }

  function ToggleRow({
    icon,
    title,
    subtitle,
    value,
    onChange,
    last = false,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    subtitle: string;
    value: boolean;
    onChange: (value: boolean) => void;
    last?: boolean;
  }) {
    return (
      <View
        style={[
          styles.toggleRow,
          {
            flexDirection: direction,
            borderBottomColor: theme.colors.border,
            borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color="#F7B83A" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: theme.colors.text, textAlign }]}>
            {title}
          </Text>
          <Text style={[styles.rowSub, { color: theme.colors.textSecondary, textAlign }]}>
            {subtitle}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: '#98A2B3', true: '#F7D176' }}
          thumbColor={value ? '#F7B83A' : '#F2F4F7'}
        />
      </View>
    );
  }

  function Segment({
    icon,
    label,
    active,
    onPress,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    active: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.segment,
          { backgroundColor: active ? '#F7B83A' : theme.colors.surface2 },
        ]}
      >
        <Ionicons name={icon} size={19} color={active ? '#0A2D44' : theme.colors.textSecondary} />
        <Text style={[styles.segmentText, { color: active ? '#0A2D44' : theme.colors.text }]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  function SheetHeader({
    title,
    icon,
    onClose,
  }: {
    title: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    onClose: () => void;
  }) {
    return (
      <View style={[styles.sheetHeader, { flexDirection: direction }]}>
        <View style={styles.sheetHeaderIcon}>
          <Ionicons name={icon} size={20} color="#0A2D44" />
        </View>
        <Text style={[styles.sheetTitle, { flex: 1, color: theme.colors.text, textAlign }]}>
          {title}
        </Text>
        <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.colors.surface2 }]}>
          <Ionicons name="close" size={19} color={theme.colors.text} />
        </Pressable>
      </View>
    );
  }

  function Field({
    label,
    value,
    onChange,
    icon,
    keyboardType = 'default',
    secure = false,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    keyboardType?: any;
    secure?: boolean;
  }) {
    return (
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, textAlign }]}>
          {label}
        </Text>
        <View
          style={[
            styles.field,
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
            secureTextEntry={secure}
            style={[styles.input, { color: theme.colors.text, textAlign }]}
          />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 14, paddingBottom: 110 },
  pageHeader: { alignItems: 'center', gap: 10, marginBottom: 12 },
  logoBox: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logo: { width: 47, height: 47 },
  pageEyebrow: { color: '#7A8B99', fontSize: 7.5, fontWeight: '900', letterSpacing: 1.1 },
  pageTitle: { marginTop: 2, fontSize: 24, fontWeight: '900' },
  pageSub: { marginTop: 2, fontSize: 8, fontWeight: '600' },
  profileCard: { borderRadius: 27, backgroundColor: '#0A2D44', padding: 15 },
  profileTop: { alignItems: 'center', gap: 10 },
  avatar: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  profileName: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  profileRole: { color: '#B9CAD6', marginTop: 3, fontSize: 8, fontWeight: '700' },
  profilePhone: { color: '#F7B83A', marginTop: 4, fontSize: 9, fontWeight: '900' },
  editButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  profileMeta: { marginTop: 13, minHeight: 66, borderRadius: 18, backgroundColor: '#173C53', alignItems: 'center' },
  miniInfo: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  miniLabel: { color: '#9FB6C6', marginTop: 2, fontSize: 6.6, fontWeight: '700' },
  miniValue: { color: '#FFFFFF', marginTop: 2, fontSize: 8.7, fontWeight: '900' },
  profileDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: 'rgba(255,255,255,0.17)' },
  sectionHeading: { marginTop: 19, marginBottom: 8, alignItems: 'center', gap: 8 },
  sectionHeadingIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: 'rgba(247,184,58,0.13)', alignItems: 'center', justifyContent: 'center' },
  sectionHeadingTitle: { fontSize: 15, fontWeight: '900' },
  sectionHeadingSub: { marginTop: 2, fontSize: 7.6, fontWeight: '600' },
  sectionCard: { borderWidth: 1, borderRadius: 23, overflow: 'hidden' },
  toggleRow: { minHeight: 72, paddingHorizontal: 12, alignItems: 'center', gap: 10 },
  rowIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(247,184,58,0.12)', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 10.5, fontWeight: '900' },
  rowSub: { marginTop: 3, fontSize: 7.5, lineHeight: 11, fontWeight: '600' },
  saving: { marginTop: 6, textAlign: 'center', fontSize: 7.5, fontWeight: '700' },
  segmentCard: { borderWidth: 1, borderRadius: 22, padding: 8 },
  segmentRow: { gap: 7 },
  segment: { flex: 1, minHeight: 68, borderRadius: 17, alignItems: 'center', justifyContent: 'center', gap: 5 },
  segmentText: { fontSize: 8.5, fontWeight: '900' },
  securityButton: { marginTop: 20, minHeight: 55, borderWidth: 1, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  securityText: { fontSize: 10.5, fontWeight: '900' },
  logout: { marginTop: 22, minHeight: 57, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(239,77,85,0.45)', backgroundColor: 'rgba(239,77,85,0.06)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { color: '#EF4D55', fontSize: 11, fontWeight: '900' },
  footerText: { marginTop: 18, textAlign: 'center', fontSize: 8, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,20,32,0.48)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 29, borderTopRightRadius: 29, padding: 16, paddingBottom: 28 },
  sheetHeader: { alignItems: 'center', gap: 8, marginBottom: 8 },
  sheetHeaderIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 15, fontWeight: '900' },
  closeButton: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  fieldGroup: { marginTop: 10 },
  fieldLabel: { marginBottom: 6, fontSize: 8.5, fontWeight: '800' },
  field: { minHeight: 51, borderWidth: 1, borderRadius: 15, paddingHorizontal: 11, alignItems: 'center', gap: 8 },
  input: { flex: 1, height: 49, fontSize: 10.5, fontWeight: '700' },
  locationField: { minHeight: 64, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, alignItems: 'center', gap: 8 },
  locationIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  locationTitle: { fontSize: 9.5, fontWeight: '900' },
  locationSub: { marginTop: 2, fontSize: 7.5, fontWeight: '600' },
  saveButton: { marginTop: 16, minHeight: 50, borderRadius: 16, backgroundColor: '#F7B83A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  saveText: { color: '#0A2D44', fontSize: 10.5, fontWeight: '900' },
  confirmCard: { marginHorizontal: 22, borderRadius: 24, padding: 18 },
  confirmIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  confirmTitle: { marginTop: 10, fontSize: 15, fontWeight: '900' },
  confirmSub: { marginTop: 5, fontSize: 8.5, lineHeight: 13, fontWeight: '600' },
  confirmInput: { marginTop: 12, minHeight: 51, borderWidth: 1, borderRadius: 15, paddingHorizontal: 11, fontSize: 14, fontWeight: '900', letterSpacing: 5 },
});
