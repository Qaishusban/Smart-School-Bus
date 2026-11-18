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
  KeyboardAvoidingView,
  Linking,
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
import * as SecureStore from 'expo-secure-store';

import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { supabase } from '../../lib/supabase';

type AnyRow = Record<string, any>;

type IconName =
  React.ComponentProps<typeof Ionicons>['name'];

type EditMode = 'phone' | 'pin' | null;

type NotificationPrefs = {
  push_enabled: boolean;
  trip_started: boolean;
  trip_ended: boolean;
  eta_10: boolean;
  eta_5: boolean;
  arrived: boolean;
  driver_updates: boolean;
  bus_incidents: boolean;
  attendance_changes: boolean;
  school_announcements: boolean;
  general_broadcasts: boolean;
  mute_all: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  push_enabled: true,
  trip_started: true,
  trip_ended: true,
  eta_10: true,
  eta_5: true,
  arrived: true,
  driver_updates: true,
  bus_incidents: true,
  attendance_changes: false,
  school_announcements: true,
  general_broadcasts: true,
  mute_all: false,
};

function displayParentName(
  parent: AnyRow | null,
  user: AnyRow | null,
  isRTL: boolean
) {
  if (isRTL) {
    return (
      parent?.full_name_ar ??
      parent?.full_name ??
      parent?.full_name_en ??
      user?.full_name ??
      'ولي الأمر'
    );
  }

  return (
    parent?.full_name_en ??
    parent?.full_name ??
    parent?.full_name_ar ??
    user?.full_name ??
    'Parent'
  );
}

function initials(name: string) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return 'P';

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

function cleanPhone(value: string) {
  return value.replace(/[^\d+]/g, '').trim();
}

function maskPhone(value?: string | null) {
  if (!value) return '—';
  return value;
}


const SESSION_STORAGE_KEY = 'smart_school_bus_session_v1';

async function getCurrentPinSessionToken(): Promise<string> {
  const raw = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);

  if (!raw) {
    throw new Error('SESSION_NOT_FOUND');
  }

  let parsed: any = null;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('SESSION_INVALID');
  }

  // Support the recovered session formats without coupling this screen
  // to a single historical shape.
  const token =
    parsed?.token ??
    parsed?.sessionToken ??
    parsed?.session_token ??
    parsed?.pinToken ??
    parsed?.pin_token ??
    parsed?.session?.token ??
    null;

  if (!token) {
    throw new Error('SESSION_TOKEN_NOT_FOUND');
  }

  return String(token);
}

type StableInputProps = {
  label: string;
  icon: IconName;
  value: string;
  onChangeText: (value: string) => void;
  textColor: string;
  secondaryColor: string;
  surfaceColor: string;
  borderColor: string;
  textAlign: 'auto' | 'left' | 'right' | 'center' | 'justify';
  direction: 'row' | 'row-reverse';
  keyboardType?: any;
  placeholder?: string;
  secureTextEntry?: boolean;
  rightIcon?: IconName;
  onRightPress?: () => void;
  maxLength?: number;
};

const StableInputField = React.memo(function StableInputField({
  label,
  icon,
  value,
  onChangeText,
  textColor,
  secondaryColor,
  surfaceColor,
  borderColor,
  textAlign,
  direction,
  keyboardType = 'default',
  placeholder,
  secureTextEntry,
  rightIcon,
  onRightPress,
  maxLength,
}: StableInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text
        style={[
          styles.inputLabel,
          {
            color: textColor,
            textAlign,
          },
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: surfaceColor,
            borderColor,
            flexDirection: direction,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={secondaryColor}
        />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor="#9AABBA"
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={maxLength}
          blurOnSubmit={false}
          style={[
            styles.input,
            {
              color: textColor,
              textAlign,
            },
          ]}
        />

        {!!rightIcon && (
          <Pressable
            onPress={onRightPress}
            hitSlop={10}
            focusable={false}
          >
            <Ionicons
              name={rightIcon}
              size={20}
              color={secondaryColor}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
});

export default function ParentSettingsScreen() {
  const { user, signOut } = useAuth();

  const {
    language,
    setLanguage,
    isRTL,
    direction,
    textAlign,
    t,
  } = useLanguage();

  const {
    theme,
    mode,
    setMode,
  } = useAppTheme();

  const [parent, setParent] = useState<AnyRow | null>(null);
  const [school, setSchool] = useState<AnyRow | null>(null);
  const [prefs, setPrefs] =
    useState<NotificationPrefs>(DEFAULT_PREFS);

  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [editMode, setEditMode] = useState<EditMode>(null);
  const [savingAccount, setSavingAccount] = useState(false);

  const [phone, setPhone] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [
        parentResult,
        schoolResult,
        prefsResult,
      ] = await Promise.all([
        supabase
          .from('parents')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(),

        user?.school_id
          ? supabase
              .from('schools')
              .select('*')
              .eq('id', user.school_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),

        supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (parentResult.error) {
        console.log(
          'ParentSettings parent error:',
          parentResult.error.message
        );
      }

      if (schoolResult.error) {
        console.log(
          'ParentSettings school error:',
          schoolResult.error.message
        );
      }

      if (prefsResult.error) {
        console.log(
          'ParentSettings prefs error:',
          prefsResult.error.message
        );
      }

      const parentRow = parentResult.data ?? null;

      setParent(parentRow);
      setSchool(schoolResult.data ?? null);

      setPhone(
        String(
          parentRow?.phone ??
            user?.phone ??
            ''
        )
      );

      if (prefsResult.data) {
        setPrefs({
          push_enabled:
            prefsResult.data.push_enabled ?? true,
          trip_started:
            prefsResult.data.trip_started ?? true,
          trip_ended:
            prefsResult.data.trip_ended ?? true,
          eta_10:
            prefsResult.data.eta_10 ?? true,
          eta_5:
            prefsResult.data.eta_5 ?? true,
          arrived:
            prefsResult.data.arrived ?? true,
          driver_updates:
            prefsResult.data.driver_updates ?? true,
          bus_incidents:
            prefsResult.data.bus_incidents ?? true,
          attendance_changes:
            prefsResult.data.attendance_changes ?? false,
          school_announcements:
            prefsResult.data.school_announcements ?? true,
          general_broadcasts:
            prefsResult.data.general_broadcasts ?? true,
          mute_all:
            prefsResult.data.mute_all ?? false,
        });
      }
    } catch (error) {
      console.log(
        'ParentSettings load exception:',
        error
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.school_id, user?.phone]);

  useEffect(() => {
    load();
  }, [load]);

  const parentName = useMemo(
    () =>
      displayParentName(
        parent,
        user as AnyRow,
        isRTL
      ),
    [parent, user, isRTL]
  );

  const schoolName = isRTL
    ? school?.name_ar ??
      school?.name ??
      school?.school_name ??
      school?.name_en ??
      ''
    : school?.name_en ??
      school?.name ??
      school?.school_name ??
      school?.name_ar ??
      '';

  const username =
    parent?.username ??
    user?.username ??
    '—';

  const parentEmail =
    parent?.email ??
    user?.email ??
    '';

  const openPhoneEditor = () => {
    setPhone(
      String(
        parent?.phone ??
          user?.phone ??
          ''
      )
    );
    setEditMode('phone');
  };

  const openPinEditor = () => {
    setNewPin('');
    setConfirmPin('');
    setShowNewPin(false);
    setShowConfirmPin(false);
    setEditMode('pin');
  };

  const closeEditor = () => {
    if (savingAccount) return;
    setEditMode(null);
    setNewPin('');
    setConfirmPin('');
  };

  const savePhone = async () => {
    if (!user?.id) return;

    const clean = cleanPhone(phone);

    if (clean.length < 7) {
      Alert.alert(
        isRTL ? 'رقم الهاتف' : 'Phone Number',
        isRTL
          ? 'يرجى إدخال رقم هاتف صحيح.'
          : 'Please enter a valid phone number.'
      );
      return;
    }

    setSavingAccount(true);

    try {
      const token = await getCurrentPinSessionToken();

      const { data, error } = await supabase.rpc(
        'parent_update_account',
        {
          p_token: token,
          p_phone: clean,
          p_new_pin: null,
        }
      );

      if (error) {
        throw error;
      }

      const result = data as AnyRow;

      if (!result?.ok) {
        throw new Error(
          result?.error ??
            (isRTL
              ? 'تعذر تحديث رقم الهاتف.'
              : 'Could not update phone number.')
        );
      }

      setParent((current) => ({
        ...(current ?? {}),
        phone: clean,
      }));

      setEditMode(null);

      Alert.alert(
        isRTL ? 'تم الحفظ' : 'Saved',
        isRTL
          ? 'تم تحديث رقم الهاتف بنجاح.'
          : 'Phone number updated successfully.'
      );
    } catch (error: any) {
      const rawMessage = String(error?.message ?? '');

      const message =
        rawMessage.includes('SESSION_')
          ? isRTL
            ? 'انتهت جلسة الدخول. سجل الخروج ثم ادخل مرة أخرى.'
            : 'Your login session has expired. Please sign in again.'
          : rawMessage ||
            (isRTL
              ? 'حدث خطأ أثناء تحديث رقم الهاتف.'
              : 'An error occurred while updating the phone number.');

      Alert.alert(
        isRTL ? 'تعذر الحفظ' : 'Could Not Save',
        message
      );
    } finally {
      setSavingAccount(false);
    }
  };

  const savePin = async () => {
    const next = newPin.trim();
    const confirm = confirmPin.trim();

    if (!/^\d{4,8}$/.test(next)) {
      Alert.alert(
        isRTL ? 'كلمة المرور الجديدة' : 'New PIN',
        isRTL
          ? 'يجب أن تكون كلمة المرور / PIN من 4 إلى 8 أرقام.'
          : 'The new PIN must contain 4 to 8 digits.'
      );
      return;
    }

    if (next !== confirm) {
      Alert.alert(
        isRTL ? 'عدم تطابق' : 'PIN Mismatch',
        isRTL
          ? 'تأكيد كلمة المرور الجديدة غير مطابق.'
          : 'The new PIN confirmation does not match.'
      );
      return;
    }

    setSavingAccount(true);

    try {
      const token = await getCurrentPinSessionToken();

      const { data, error } = await supabase.rpc(
        'parent_update_account',
        {
          p_token: token,
          p_phone: null,
          p_new_pin: next,
        }
      );

      if (error) {
        throw error;
      }

      const result = data as AnyRow;

      if (!result?.ok) {
        throw new Error(
          result?.error ??
            (isRTL
              ? 'تعذر تغيير كلمة المرور.'
              : 'Could not change PIN.')
        );
      }

      setEditMode(null);
      setNewPin('');
      setConfirmPin('');

      Alert.alert(
        isRTL ? 'تم التحديث' : 'Updated',
        isRTL
          ? 'تم تغيير كلمة المرور / PIN بنجاح.'
          : 'Your PIN has been changed successfully.'
      );
    } catch (error: any) {
      const rawMessage = String(error?.message ?? '');

      const message =
        rawMessage.includes('SESSION_')
          ? isRTL
            ? 'انتهت جلسة الدخول. سجل الخروج ثم ادخل مرة أخرى.'
            : 'Your login session has expired. Please sign in again.'
          : rawMessage ||
            (isRTL
              ? 'حدث خطأ أثناء تغيير كلمة المرور.'
              : 'An error occurred while changing your PIN.');

      Alert.alert(
        isRTL ? 'تعذر التحديث' : 'Could Not Update',
        message
      );
    } finally {
      setSavingAccount(false);
    }
  };

  const updatePreference = async (
    key: keyof NotificationPrefs,
    value: boolean
  ) => {
    if (!user?.id) return;

    const next = {
      ...prefs,
      [key]: value,
    };

    if (key === 'mute_all' && value) {
      next.push_enabled = false;
    }

    if (key === 'push_enabled' && value) {
      next.mute_all = false;
    }

    setPrefs(next);
    setSavingPrefs(true);

    try {
      const payload = {
        user_id: user.id,
        linked_id: user.id,
        user_role: 'parent',
        school_id: user.school_id ?? null,
        ...next,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('notification_preferences')
        .upsert(payload, {
          onConflict: 'user_id',
        });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.log(
        'ParentSettings save preferences error:',
        error
      );

      setPrefs(prefs);

      Alert.alert(
        isRTL ? 'الإشعارات' : 'Notifications',
        isRTL
          ? 'تعذر حفظ إعدادات الإشعارات حاليًا.'
          : 'Could not save notification settings right now.'
      );
    } finally {
      setSavingPrefs(false);
    }
  };

  const callSchool = async () => {
    const phoneNumber =
      school?.phone ??
      school?.mobile ??
      school?.contact_phone ??
      '';

    if (!phoneNumber) {
      Alert.alert(
        isRTL ? 'الاتصال بالمدرسة' : 'Call School',
        isRTL
          ? 'رقم هاتف المدرسة غير مسجل.'
          : 'The school phone number is not available.'
      );
      return;
    }

    const url = `tel:${String(phoneNumber).replace(/\s+/g, '')}`;

    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      isRTL ? 'تسجيل الخروج' : 'Log Out',
      isRTL
        ? 'هل أنت متأكد من تسجيل الخروج من الحساب؟'
        : 'Are you sure you want to log out?',
      [
        {
          text: isRTL ? 'إلغاء' : 'Cancel',
          style: 'cancel',
        },
        {
          text: isRTL ? 'تسجيل الخروج' : 'Log Out',
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
  };

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
          <Ionicons
            name="settings-outline"
            size={30}
            color="#FFFFFF"
          />
        </View>

        <ActivityIndicator
          size="large"
          color="#F7B83A"
          style={{ marginTop: 16 }}
        />

        <Text
          style={[
            styles.loadingText,
            {
              color: theme.colors.textSecondary,
            },
          ]}
        >
          {isRTL
            ? 'جاري تحميل الإعدادات...'
            : 'Loading settings...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.colors.background,
        },
      ]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ================= HEADER ================= */}

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
              {isRTL ? 'حساب ولي الأمر' : 'Parent Account'}
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
            <Ionicons
              name="settings-outline"
              size={25}
              color="#0A2D44"
            />
          </View>
        </View>

        {/* ================= PROFILE ================= */}

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
              <Text style={styles.avatarText}>
                {initials(parentName)}
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                marginHorizontal: 13,
              }}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.profileName,
                  { textAlign },
                ]}
              >
                {parentName}
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
                  size={14}
                  color="#AFC2D0"
                />

                <Text style={styles.profileRole}>
                  {isRTL ? 'ولي أمر' : 'Parent'}
                </Text>
              </View>

              <Text
                numberOfLines={1}
                style={[
                  styles.profileSchool,
                  { textAlign },
                ]}
              >
                {schoolName || '—'}
              </Text>
            </View>

            <View style={styles.schoolLogoBox}>
              {school?.logo_url ? (
                <Image
                  source={{
                    uri: school.logo_url,
                  }}
                  resizeMode="contain"
                  style={styles.schoolLogo}
                />
              ) : (
                <Ionicons
                  name="school-outline"
                  size={27}
                  color="#F7B83A"
                />
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
              icon="person-outline"
              label={
                isRTL
                  ? 'اسم المستخدم'
                  : 'Username'
              }
              value={`@${username}`}
            />

            <View style={styles.statDivider} />

            <MiniInfo
              icon="call-outline"
              label={
                isRTL ? 'رقم الهاتف' : 'Phone'
              }
              value={maskPhone(
                parent?.phone ??
                  user?.phone
              )}
            />
          </View>
        </View>

        {/* ================= ACCOUNT SECURITY ================= */}

        <SectionHeader
          icon="person-circle-outline"
          title={
            isRTL
              ? 'الحساب والأمان'
              : 'Account & Security'
          }
          subtitle={
            isRTL
              ? 'إدارة بيانات الدخول والتواصل'
              : 'Manage login and contact details'
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
            icon="call-outline"
            iconBackground="#E8F7EF"
            iconColor="#16A66A"
            title={
              isRTL
                ? 'رقم الهاتف'
                : 'Phone Number'
            }
            subtitle={
              parent?.phone ??
              user?.phone ??
              (isRTL
                ? 'غير مسجل'
                : 'Not added')
            }
            onPress={openPhoneEditor}
          />

          <Divider />

          <SettingRow
            icon="key-outline"
            iconBackground="#FFF5DF"
            iconColor="#E7A526"
            title={
              isRTL
                ? 'تغيير كلمة المرور / PIN'
                : 'Change Password / PIN'
            }
            subtitle={
              isRTL
                ? 'تغيير رمز الدخول للحساب'
                : 'Change your account login PIN'
            }
            onPress={openPinEditor}
          />

          {!!parentEmail && (
            <>
              <Divider />

              <SettingRow
                icon="mail-outline"
                iconBackground="#EEF5FF"
                iconColor="#2F80ED"
                title={
                  isRTL
                    ? 'البريد الإلكتروني'
                    : 'Email'
                }
                subtitle={parentEmail}
              />
            </>
          )}
        </View>

        {/* ================= NOTIFICATIONS ================= */}

        <SectionHeader
          icon="notifications-outline"
          title={
            isRTL
              ? 'الإشعارات والتنبيهات'
              : 'Notifications'
          }
          subtitle={
            isRTL
              ? 'اختر التنبيهات التي تهمك'
              : 'Choose the alerts you want to receive'
          }
          right={
            savingPrefs ? (
              <ActivityIndicator
                size="small"
                color="#F7B83A"
              />
            ) : null
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
            title={
              isRTL
                ? 'الإشعارات الفورية'
                : 'Push Notifications'
            }
            subtitle={
              isRTL
                ? 'استقبال التنبيهات على الجهاز'
                : 'Receive alerts on this device'
            }
            value={prefs.push_enabled}
            onValueChange={(value) =>
              updatePreference(
                'push_enabled',
                value
              )
            }
          />

          <Divider />

          <SwitchRow
            icon="bus-outline"
            title={
              isRTL
                ? 'بدء وانتهاء الرحلة'
                : 'Trip Start & End'
            }
            subtitle={
              isRTL
                ? 'تنبيه عند بدء الرحلة وانتهائها'
                : 'Alerts when the trip starts or ends'
            }
            value={
              prefs.trip_started &&
              prefs.trip_ended
            }
            onValueChange={async (value) => {
              const next = {
                ...prefs,
                trip_started: value,
                trip_ended: value,
              };
              setPrefs(next);

              if (!user?.id) return;
              setSavingPrefs(true);
              try {
                const { error } = await supabase
                  .from('notification_preferences')
                  .upsert(
                    {
                      user_id: user.id,
                      linked_id: user.id,
                      user_role: 'parent',
                      school_id:
                        user.school_id ?? null,
                      ...next,
                      updated_at:
                        new Date().toISOString(),
                    },
                    {
                      onConflict: 'user_id',
                    }
                  );

                if (error) throw error;
              } catch (error) {
                console.log(error);
                setPrefs(prefs);
              } finally {
                setSavingPrefs(false);
              }
            }}
          />

          <Divider />

          <SwitchRow
            icon="location-outline"
            title={
              isRTL
                ? 'اقتراب ووصول الباص'
                : 'Bus ETA & Arrival'
            }
            subtitle={
              isRTL
                ? 'تنبيهات 10 دقائق و5 دقائق والوصول'
                : '10 min, 5 min and arrival alerts'
            }
            value={
              prefs.eta_10 &&
              prefs.eta_5 &&
              prefs.arrived
            }
            onValueChange={async (value) => {
              const next = {
                ...prefs,
                eta_10: value,
                eta_5: value,
                arrived: value,
              };
              setPrefs(next);

              if (!user?.id) return;
              setSavingPrefs(true);
              try {
                const { error } = await supabase
                  .from('notification_preferences')
                  .upsert(
                    {
                      user_id: user.id,
                      linked_id: user.id,
                      user_role: 'parent',
                      school_id:
                        user.school_id ?? null,
                      ...next,
                      updated_at:
                        new Date().toISOString(),
                    },
                    {
                      onConflict: 'user_id',
                    }
                  );

                if (error) throw error;
              } catch (error) {
                console.log(error);
                setPrefs(prefs);
              } finally {
                setSavingPrefs(false);
              }
            }}
          />

          <Divider />

          <SwitchRow
            icon="megaphone-outline"
            title={
              isRTL
                ? 'إعلانات المدرسة'
                : 'School Announcements'
            }
            subtitle={
              isRTL
                ? 'التعاميم والإعلانات العامة'
                : 'School broadcasts and announcements'
            }
            value={
              prefs.school_announcements
            }
            onValueChange={(value) =>
              updatePreference(
                'school_announcements',
                value
              )
            }
          />

          <Divider />

          <SwitchRow
            icon="warning-outline"
            title={
              isRTL
                ? 'تنبيهات الباص والحوادث'
                : 'Bus & Incident Alerts'
            }
            subtitle={
              isRTL
                ? 'التحديثات المهمة والحوادث'
                : 'Important driver and incident updates'
            }
            value={
              prefs.driver_updates &&
              prefs.bus_incidents
            }
            onValueChange={async (value) => {
              const next = {
                ...prefs,
                driver_updates: value,
                bus_incidents: value,
              };
              setPrefs(next);

              if (!user?.id) return;
              setSavingPrefs(true);
              try {
                const { error } = await supabase
                  .from('notification_preferences')
                  .upsert(
                    {
                      user_id: user.id,
                      linked_id: user.id,
                      user_role: 'parent',
                      school_id:
                        user.school_id ?? null,
                      ...next,
                      updated_at:
                        new Date().toISOString(),
                    },
                    {
                      onConflict: 'user_id',
                    }
                  );

                if (error) throw error;
              } catch (error) {
                console.log(error);
                setPrefs(prefs);
              } finally {
                setSavingPrefs(false);
              }
            }}
          />
        </View>

        {/* ================= APP SETTINGS ================= */}

        <SectionHeader
          icon="options-outline"
          title={
            isRTL
              ? 'إعدادات التطبيق'
              : 'App Settings'
          }
          subtitle={
            isRTL
              ? 'اللغة والمظهر'
              : 'Language and appearance'
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
            {isRTL ? 'اللغة' : 'Language'}
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
              title="العربية"
              icon="language-outline"
              selected={language === 'ar'}
              onPress={() =>
                setLanguage('ar')
              }
            />

            <SegmentOption
              title="English"
              icon="language-outline"
              selected={language === 'en'}
              onPress={() =>
                setLanguage('en')
              }
            />
          </View>

          <Divider large />

          <Text
            style={[
              styles.fieldLabel,
              {
                color: theme.colors.text,
                textAlign,
              },
            ]}
          >
            {isRTL ? 'المظهر' : 'Appearance'}
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
              onPress={() =>
                setMode('light')
              }
            />

            <SegmentOption
              title={isRTL ? 'داكن' : 'Dark'}
              icon="moon-outline"
              selected={mode === 'dark'}
              onPress={() =>
                setMode('dark')
              }
            />

            <SegmentOption
              title={isRTL ? 'النظام' : 'System'}
              icon="phone-portrait-outline"
              selected={mode === 'system'}
              onPress={() =>
                setMode('system')
              }
            />
          </View>
        </View>

        {/* ================= SUPPORT ================= */}

        <SectionHeader
          icon="help-circle-outline"
          title={
            isRTL
              ? 'المساعدة والدعم'
              : 'Help & Support'
          }
          subtitle={
            isRTL
              ? 'خيارات مفيدة لولي الأمر'
              : 'Useful parent tools'
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
            icon="call-outline"
            iconBackground="#E8F7EF"
            iconColor="#16A66A"
            title={
              isRTL
                ? 'الاتصال بالمدرسة'
                : 'Call School'
            }
            subtitle={
              school?.phone ??
              school?.mobile ??
              (isRTL
                ? 'التواصل مع إدارة المدرسة'
                : 'Contact school administration')
            }
            onPress={callSchool}
          />

          <Divider />

          <SettingRow
            icon="shield-checkmark-outline"
            iconBackground="#EEF5FF"
            iconColor="#2F80ED"
            title={
              isRTL
                ? 'الخصوصية والأمان'
                : 'Privacy & Security'
            }
            subtitle={
              isRTL
                ? 'نصائح لحماية حسابك'
                : 'Tips to keep your account secure'
            }
            onPress={() =>
              Alert.alert(
                isRTL
                  ? 'الخصوصية والأمان'
                  : 'Privacy & Security',
                isRTL
                  ? 'لا تشارك اسم المستخدم أو PIN مع أي شخص، وغيّر PIN إذا شككت بأن شخصًا آخر يعرفه.'
                  : 'Do not share your username or PIN. Change your PIN if you think someone else knows it.'
              )
            }
          />

          <Divider />

          <SettingRow
            icon="information-circle-outline"
            iconBackground="#FFF5DF"
            iconColor="#E7A526"
            title={
              isRTL
                ? 'عن التطبيق'
                : 'About'
            }
            subtitle="Smart School Bus • v1.0.0"
            onPress={() =>
              Alert.alert(
                'Smart School Bus',
                isRTL
                  ? 'نظام تتبع وإدارة النقل المدرسي.'
                  : 'School transportation tracking and management system.'
              )
            }
          />
        </View>

        {/* ================= LOGOUT ================= */}

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            {
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons
            name="log-out-outline"
            size={22}
            color="#D94A4A"
          />

          <Text style={styles.logoutText}>
            {isRTL ? 'تسجيل الخروج' : 'Log Out'}
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

      {/* ================= EDIT MODAL ================= */}

      <Modal
        visible={editMode !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEditor}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeEditor}
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
                    backgroundColor:
                      editMode === 'phone'
                        ? '#E8F7EF'
                        : '#FFF5DF',
                  },
                ]}
              >
                <Ionicons
                  name={
                    editMode === 'phone'
                      ? 'call-outline'
                      : 'key-outline'
                  }
                  size={23}
                  color={
                    editMode === 'phone'
                      ? '#16A66A'
                      : '#E7A526'
                  }
                />
              </View>

              <View
                style={{
                  flex: 1,
                  marginHorizontal: 11,
                }}
              >
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: theme.colors.text,
                      textAlign,
                    },
                  ]}
                >
                  {editMode === 'phone'
                    ? isRTL
                      ? 'تعديل رقم الهاتف'
                      : 'Edit Phone Number'
                    : isRTL
                    ? 'تغيير كلمة المرور / PIN'
                    : 'Change Password / PIN'}
                </Text>

                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      color:
                        theme.colors.textSecondary,
                      textAlign,
                    },
                  ]}
                >
                  {editMode === 'phone'
                    ? isRTL
                      ? 'سيتم استخدام الرقم للتواصل معك.'
                      : 'This number will be used to contact you.'
                    : isRTL
                    ? 'أدخل الرمز الجديد ثم أكده. لا نطلب الرمز الحالي.'
                    : 'Enter the new PIN and confirm it. Current PIN is not required.'}
                </Text>
              </View>

              <Pressable
                onPress={closeEditor}
                style={[
                  styles.closeButton,
                  {
                    backgroundColor:
                      theme.colors.surface2,
                  },
                ]}
              >
                <Ionicons
                  name="close"
                  size={21}
                  color={theme.colors.text}
                />
              </Pressable>
            </View>

            {editMode === 'phone' ? (
              <>
                <StableInputField
                  label={
                    isRTL
                      ? 'رقم الهاتف الجديد'
                      : 'New Phone Number'
                  }
                  icon="call-outline"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="+9627XXXXXXXX"
                  textColor={theme.colors.text}
                  secondaryColor="#8191A0"
                  surfaceColor={theme.colors.surface2}
                  borderColor={theme.colors.border}
                  textAlign={textAlign}
                  direction={direction}
                />

                <PrimaryAction
                  title={
                    isRTL
                      ? 'حفظ رقم الهاتف'
                      : 'Save Phone Number'
                  }
                  icon="checkmark-circle-outline"
                  loading={savingAccount}
                  onPress={savePhone}
                />
              </>
            ) : (
              <>
                <StableInputField
                  label={
                    isRTL
                      ? 'كلمة المرور / PIN الجديدة'
                      : 'New PIN'
                  }
                  icon="key-outline"
                  value={newPin}
                  onChangeText={setNewPin}
                  keyboardType="number-pad"
                  secureTextEntry={!showNewPin}
                  rightIcon={
                    showNewPin
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  onRightPress={() =>
                    setShowNewPin(
                      (current) => !current
                    )
                  }
                  maxLength={8}
                  textColor={theme.colors.text}
                  secondaryColor="#8191A0"
                  surfaceColor={theme.colors.surface2}
                  borderColor={theme.colors.border}
                  textAlign={textAlign}
                  direction={direction}
                />

                <StableInputField
                  label={
                    isRTL
                      ? 'تأكيد كلمة المرور الجديدة'
                      : 'Confirm New PIN'
                  }
                  icon="checkmark-done-outline"
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  keyboardType="number-pad"
                  secureTextEntry={!showConfirmPin}
                  rightIcon={
                    showConfirmPin
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  onRightPress={() =>
                    setShowConfirmPin(
                      (current) => !current
                    )
                  }
                  maxLength={8}
                  textColor={theme.colors.text}
                  secondaryColor="#8191A0"
                  surfaceColor={theme.colors.surface2}
                  borderColor={theme.colors.border}
                  textAlign={textAlign}
                  direction={direction}
                />

                <PrimaryAction
                  title={
                    isRTL
                      ? 'تغيير كلمة المرور'
                      : 'Change PIN'
                  }
                  icon="shield-checkmark-outline"
                  loading={savingAccount}
                  onPress={savePin}
                />
              </>
            )}
          </View>
        </KeyboardAvoidingView>
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
              backgroundColor:
                'rgba(247,184,58,0.14)',
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={20}
            color="#F7B83A"
          />
        </View>

        <View
          style={{
            flex: 1,
            marginHorizontal: 10,
          }}
        >
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
                color:
                  theme.colors.textSecondary,
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
    onPress,
  }: {
    icon: IconName;
    iconBackground: string;
    iconColor: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
  }) {
    const content = (
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
              backgroundColor:
                iconBackground,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={21}
            color={iconColor}
          />
        </View>

        <View
          style={{
            flex: 1,
            marginHorizontal: 11,
          }}
        >
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
                  color:
                    theme.colors.textSecondary,
                  textAlign,
                },
              ]}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {!!onPress && (
          <Ionicons
            name={
              isRTL
                ? 'chevron-back'
                : 'chevron-forward'
            }
            size={19}
            color="#9AABBA"
          />
        )}
      </View>
    );

    if (!onPress) {
      return content;
    }

    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
        })}
      >
        {content}
      </Pressable>
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
              backgroundColor:
                'rgba(247,184,58,0.13)',
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={21}
            color="#F7B83A"
          />
        </View>

        <View
          style={{
            flex: 1,
            marginHorizontal: 11,
          }}
        >
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
                color:
                  theme.colors.textSecondary,
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
          trackColor={{
            false: '#D7E0E8',
            true: '#F6D180',
          }}
          thumbColor={
            value
              ? '#F7B83A'
              : '#FFFFFF'
          }
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
            backgroundColor: selected
              ? '#F7B83A'
              : theme.colors.surface2,
            borderColor: selected
              ? '#F7B83A'
              : theme.colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={
            selected
              ? '#0A2D44'
              : theme.colors.textSecondary
          }
        />

        <Text
          numberOfLines={1}
          style={[
            styles.segmentText,
            {
              color: selected
                ? '#0A2D44'
                : theme.colors.text,
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
          <Ionicons
            name={icon}
            size={13}
            color="#AFC2D0"
          />

          <Text style={styles.miniLabel}>
            {label}
          </Text>
        </View>

        <Text
          numberOfLines={1}
          style={styles.miniValue}
        >
          {value}
        </Text>
      </View>
    );
  }

  function Divider({
    large = false,
  }: {
    large?: boolean;
  }) {
    return (
      <View
        style={[
          styles.divider,
          {
            backgroundColor:
              theme.colors.border,
            marginVertical: large
              ? 16
              : 0,
          },
        ]}
      />
    );
  }

  function PrimaryAction({
    title,
    icon,
    loading: actionLoading,
    onPress,
  }: {
    title: string;
    icon: IconName;
    loading: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        disabled={actionLoading}
        onPress={onPress}
        style={({ pressed }) => [
          styles.primaryButton,
          {
            opacity:
              actionLoading || pressed
                ? 0.75
                : 1,
          },
        ]}
      >
        {actionLoading ? (
          <ActivityIndicator
            color="#0A2D44"
            size="small"
          />
        ) : (
          <Ionicons
            name={icon}
            size={21}
            color="#0A2D44"
          />
        )}

        <Text style={styles.primaryButtonText}>
          {title}
        </Text>
      </Pressable>
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
  },

  profileCard: {
    borderRadius: 28,
    padding: 16,
    backgroundColor: '#0A2D44',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
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
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom:
      Platform.OS === 'ios' ? 34 : 22,
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

  inputGroup: {
    marginTop: 12,
  },

  inputLabel: {
    marginBottom: 7,
    fontSize: 10,
    fontWeight: '800',
  },

  inputWrap: {
    height: 53,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 13,
    alignItems: 'center',
    gap: 9,
  },

  input: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    fontWeight: '700',
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
});
