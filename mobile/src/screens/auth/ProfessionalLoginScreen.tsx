import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import React, {
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
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
  useLanguage,
} from '../../i18n/LanguageContext';

import {
  useAppTheme,
} from '../../theme/ThemeContext';

import {
  SchoolAccessReason,
  schoolAccessMessage,
} from '../../services/schoolAccessService';

type LoginRole =
  | 'parent'
  | 'teacher'
  | 'driver'
  | 'admin';

type Props = {
  navigation: any;
  role: LoginRole;
};

type IconName =
  React.ComponentProps<
    typeof Ionicons
  >['name'];

type RoleUi = {
  icon: IconName;
  accent: string;
  softLight: string;
  softDark: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
};

const ROLE_UI: Record<LoginRole, RoleUi> = {
  parent: {
    icon: 'people-outline',
    accent: '#0D9F68',
    softLight: '#E8F7EF',
    softDark: 'rgba(13,159,104,0.16)',
    titleAr: 'تسجيل دخول ولي الأمر',
    titleEn: 'Parent Login',
    subtitleAr:
      'تابع رحلة أبنائك بأمان واطمئنان',
    subtitleEn:
      'Follow your children safely and easily',
  },

  driver: {
    icon: 'bus-outline',
    accent: '#F4B942',
    softLight: '#FFF5DF',
    softDark: 'rgba(244,185,66,0.16)',
    titleAr: 'تسجيل دخول السائق',
    titleEn: 'Driver Login',
    subtitleAr:
      'ابدأ رحلتك المدرسية بأمان',
    subtitleEn:
      'Start your school trip safely',
  },

  teacher: {
    icon: 'school-outline',
    accent: '#3488F5',
    softLight: '#EEF5FF',
    softDark: 'rgba(52,136,245,0.16)',
    titleAr: 'تسجيل دخول المعلم',
    titleEn: 'Teacher Login',
    subtitleAr:
      'متابعة الطلاب والرحلات بسهولة',
    subtitleEn:
      'Monitor students and trips easily',
  },

  admin: {
    icon: 'shield-checkmark-outline',
    accent: '#7657F6',
    softLight: '#F0EEFF',
    softDark: 'rgba(118,87,246,0.17)',
    titleAr: 'تسجيل دخول الإدارة',
    titleEn: 'Administration Login',
    subtitleAr:
      'الدخول إلى إدارة المدرسة والنظام',
    subtitleEn:
      'Access school and system administration',
  },
};

function friendlyError(
  value: unknown,
  isRTL: boolean,
  role: LoginRole,
) {
  const rawMessage = String(
    (value as any)?.message ??
      value ??
      '',
  );

  const schoolAccessPrefix =
    'SCHOOL_ACCESS:';

  if (
    rawMessage.includes(
      schoolAccessPrefix,
    )
  ) {
    const reason =
      rawMessage
        .split(
          schoolAccessPrefix,
        )[1]
        ?.trim()
        .split(/\s+/)[0] as
        | SchoolAccessReason
        | undefined;

    return schoolAccessMessage(
      role,
      reason ??
        'check_failed',
      isRTL,
    );
  }

  const message =
    rawMessage.toLowerCase();

  if (
    message.includes('incorrect username') ||
    message.includes('wrong_username_or_pin')
  ) {
    return isRTL
      ? 'اسم المستخدم أو الرقم السري غير صحيح.'
      : 'Incorrect username or PIN.';
  }

  if (
    message.includes(
      'invalid login credentials',
    )
  ) {
    return isRTL
      ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
      : 'Incorrect email or password.';
  }

  if (
    message.includes('inactive') ||
    message.includes('disabled')
  ) {
    return isRTL
      ? 'هذا الحساب موقوف. يرجى التواصل مع الإدارة.'
      : 'This account is disabled. Please contact administration.';
  }

  if (
    message.includes('network') ||
    message.includes('fetch')
  ) {
    return isRTL
      ? 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.'
      : 'Could not reach the server. Check your internet connection.';
  }

  return isRTL
    ? 'تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.'
    : 'Login failed. Please check your details and try again.';
}

export default function ProfessionalLoginScreen({
  navigation,
  role,
}: Props) {
  const {
    signInPin,
    signInAdmin,
  } = useAuth();

  const {
    language,
    setLanguage,
    isRTL,
    direction,
    textAlign,
  } = useLanguage();

  const {
    theme,
    isDark,
  } = useAppTheme();

  const responsive = useResponsiveLayout();

  const config =
    ROLE_UI[role];

  const isAdmin =
    role === 'admin';

  const softColor =
    isDark
      ? config.softDark
      : config.softLight;

  const [
    identity,
    setIdentity,
  ] = useState('');

  const [
    secret,
    setSecret,
  ] = useState('');

  const [
    secure,
    setSecure,
  ] = useState(true);

  const [
    remember,
    setRemember,
  ] = useState(true);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const canSubmit =
    useMemo(
      () =>
        identity.trim().length > 0 &&
        secret.trim().length > 0 &&
        !loading,
      [
        identity,
        secret,
        loading,
      ],
    );

  const submit =
    async () => {
      if (!canSubmit) {
        return;
      }

      setLoading(true);

      try {
        if (isAdmin) {
          await signInAdmin(
            identity.trim(),
            secret,
            remember,
          );
        } else {
          await signInPin(
            role,
            identity.trim(),
            secret.trim(),
            remember,
          );
        }
      } catch (error) {
        Alert.alert(
          isRTL
            ? 'تعذر تسجيل الدخول'
            : 'Login Failed',
          friendlyError(
            error,
            isRTL,
            role,
          ),
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor:
            theme.colors.background,
        },
      ]}
    >
      <StatusBar
        barStyle={
          isDark
            ? 'light-content'
            : 'dark-content'
        }
        backgroundColor={
          theme.colors.background
        }
      />

      <View
        pointerEvents="none"
        style={[
          styles.decorativeCircleTop,
          {
            backgroundColor:
              isDark
                ? 'rgba(31,67,92,0.30)'
                : 'rgba(218,235,247,0.55)',
          },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.decorativeCircleBottom,
          {
            backgroundColor:
              isDark
                ? 'rgba(244,185,66,0.035)'
                : 'rgba(244,185,66,0.08)',
          },
        ]}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            {
              paddingHorizontal: responsive.horizontalPadding,
              paddingTop: responsive.isShortScreen ? 8 : 12,
              alignSelf: 'center',
              width: '100%',
              maxWidth: responsive.isTabletSize ? 680 : 520,
            },
          ]}
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={[
              styles.topRow,
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
              style={({ pressed }) => [
                styles.roundButton,
                {
                  backgroundColor:
                    theme.colors.surface,
                  borderColor:
                    theme.colors.border,
                  opacity:
                    pressed
                      ? 0.72
                      : 1,
                },
              ]}
            >
              <Ionicons
                name={
                  isRTL
                    ? 'arrow-forward'
                    : 'arrow-back'
                }
                size={23}
                color={
                  theme.colors.text
                }
              />
            </Pressable>

            <Pressable
              onPress={() =>
                setLanguage(
                  language === 'ar'
                    ? 'en'
                    : 'ar',
                )
              }
              style={({ pressed }) => [
                styles.languageButton,
                {
                  backgroundColor:
                    theme.colors.surface,
                  borderColor:
                    theme.colors.border,
                  opacity:
                    pressed
                      ? 0.72
                      : 1,
                },
              ]}
            >
              <Ionicons
                name="globe-outline"
                size={18}
                color="#0D9F68"
              />

              <Text
                style={[
                  styles.languageText,
                  {
                    color:
                      theme.colors.text,
                  },
                ]}
              >
                {language === 'ar'
                  ? 'EN'
                  : 'ع'}
              </Text>
            </Pressable>
          </View>

          <View
            style={
              styles.brandSection
            }
          >
            <View
              style={
                styles.logoBackdrop
              }
            >
              <Image
                source={require('../../../assets/smart-school-bus-logo-transparent.png')}
                resizeMode="contain"
                style={styles.logo}
              />
            </View>

            <View
              style={[
                styles.roleBadge,
                {
                  backgroundColor:
                    softColor,
                  borderColor:
                    isDark
                      ? `${config.accent}55`
                      : `${config.accent}25`,
                },
              ]}
            >
              <Ionicons
                name={config.icon}
                size={19}
                color={
                  config.accent
                }
              />

              <Text
                style={[
                  styles.roleBadgeText,
                  {
                    color:
                      config.accent,
                  },
                ]}
              >
                {isRTL
                  ? config.titleAr.replace(
                      'تسجيل دخول ',
                      '',
                    )
                  : config.titleEn.replace(
                      ' Login',
                      '',
                    )}
              </Text>
            </View>

            <Text
              style={[
                styles.title,
                {
                  color:
                    theme.colors.text,
                  textAlign,
                },
              ]}
            >
              {isRTL
                ? config.titleAr
                : config.titleEn}
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color:
                    theme.colors.textSecondary,
                  textAlign,
                },
              ]}
            >
              {isRTL
                ? config.subtitleAr
                : config.subtitleEn}
            </Text>
          </View>

          <View
            style={[
              styles.formCard,
              {
                backgroundColor:
                  theme.colors.surface,
                borderColor:
                  theme.colors.border,
                shadowOpacity:
                  isDark
                    ? 0.28
                    : 0.08,
              },
            ]}
          >
            <Text
              style={[
                styles.fieldLabel,
                {
                  color:
                    theme.colors.text,
                  textAlign,
                },
              ]}
            >
              {isAdmin
                ? isRTL
                  ? 'البريد الإلكتروني'
                  : 'Email Address'
                : isRTL
                ? 'اسم المستخدم'
                : 'Username'}
            </Text>

            <View
              style={[
                styles.inputWrap,
                {
                  flexDirection:
                    direction,
                  backgroundColor:
                    theme.colors.surface2,
                  borderColor:
                    theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.inputIcon,
                  {
                    backgroundColor:
                      softColor,
                  },
                ]}
              >
                <Ionicons
                  name={
                    isAdmin
                      ? 'mail-outline'
                      : 'person-outline'
                  }
                  size={19}
                  color={
                    config.accent
                  }
                />
              </View>

              <TextInput
                value={identity}
                onChangeText={
                  setIdentity
                }
                placeholder={
                  isAdmin
                    ? 'name@school.com'
                    : isRTL
                    ? 'أدخل اسم المستخدم'
                    : 'Enter username'
                }
                placeholderTextColor={
                  theme.colors.muted
                }
                autoCapitalize="none"
                keyboardType={
                  isAdmin
                    ? 'email-address'
                    : 'default'
                }
                autoCorrect={false}
                returnKeyType="next"
                selectionColor={
                  config.accent
                }
                style={[
                  styles.input,
                  {
                    color:
                      theme.colors.text,
                    textAlign,
                  },
                ]}
              />
            </View>

            <Text
              style={[
                styles.fieldLabel,
                {
                  color:
                    theme.colors.text,
                  textAlign,
                  marginTop: 15,
                },
              ]}
            >
              {isAdmin
                ? isRTL
                  ? 'كلمة المرور'
                  : 'Password'
                : isRTL
                ? 'الرقم السري PIN'
                : 'PIN'}
            </Text>

            <View
              style={[
                styles.inputWrap,
                {
                  flexDirection:
                    direction,
                  backgroundColor:
                    theme.colors.surface2,
                  borderColor:
                    theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.inputIcon,
                  {
                    backgroundColor:
                      softColor,
                  },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={19}
                  color={
                    config.accent
                  }
                />
              </View>

              <TextInput
                value={secret}
                onChangeText={
                  setSecret
                }
                placeholder={
                  isAdmin
                    ? isRTL
                      ? 'أدخل كلمة المرور'
                      : 'Enter password'
                    : '••••'
                }
                placeholderTextColor={
                  theme.colors.muted
                }
                secureTextEntry={
                  secure
                }
                keyboardType={
                  isAdmin
                    ? 'default'
                    : 'number-pad'
                }
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={
                  isAdmin
                    ? undefined
                    : 8
                }
                selectionColor={
                  config.accent
                }
                onSubmitEditing={
                  submit
                }
                style={[
                  styles.input,
                  {
                    color:
                      theme.colors.text,
                    textAlign,
                  },
                ]}
              />

              <Pressable
                onPress={() =>
                  setSecure(
                    current =>
                      !current,
                  )
                }
                hitSlop={10}
              >
                <Ionicons
                  name={
                    secure
                      ? 'eye-outline'
                      : 'eye-off-outline'
                  }
                  size={21}
                  color={
                    theme.colors.muted
                  }
                />
              </Pressable>
            </View>

            <View
              style={[
                styles.optionsRow,
                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <Pressable
                onPress={() =>
                  setRemember(
                    current =>
                      !current,
                  )
                }
                style={[
                  styles.rememberRow,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor:
                        remember
                          ? '#0D9F68'
                          : theme.colors.border,
                      backgroundColor:
                        remember
                          ? '#0D9F68'
                          : theme.colors.surface2,
                    },
                  ]}
                >
                  {remember && (
                    <Ionicons
                      name="checkmark"
                      size={15}
                      color="#FFFFFF"
                    />
                  )}
                </View>

                <Text
                  style={[
                    styles.rememberText,
                    {
                      color:
                        theme.colors.textSecondary,
                    },
                  ]}
                >
                  {isRTL
                    ? 'تذكرني'
                    : 'Remember me'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  Alert.alert(
                    isRTL
                      ? 'نسيت بيانات الدخول؟'
                      : 'Forgot Login?',
                    isRTL
                      ? 'يرجى التواصل مع إدارة المدرسة لإعادة تعيين بيانات الدخول.'
                      : 'Please contact the school administration to reset your login details.',
                  )
                }
              >
                <Text
                  style={[
                    styles.forgotText,
                    {
                      color:
                        config.accent,
                    },
                  ]}
                >
                  {isAdmin
                    ? isRTL
                      ? 'نسيت كلمة المرور؟'
                      : 'Forgot password?'
                    : isRTL
                    ? 'نسيت الرقم السري؟'
                    : 'Forgot PIN?'}
                </Text>
              </Pressable>
            </View>

            <Pressable
              disabled={!canSubmit}
              onPress={submit}
              style={({ pressed }) => [
                styles.loginButton,
                {
                  backgroundColor:
                    config.accent,
                  opacity:
                    !canSubmit
                      ? 0.48
                      : pressed
                      ? 0.82
                      : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Text
                    style={
                      styles.loginText
                    }
                  >
                    {isRTL
                      ? 'تسجيل الدخول'
                      : 'Login'}
                  </Text>

                  <View
                    style={
                      styles.loginArrow
                    }
                  >
                    <Ionicons
                      name={
                        isRTL
                          ? 'arrow-back'
                          : 'arrow-forward'
                      }
                      size={20}
                      color={
                        config.accent
                      }
                    />
                  </View>
                </>
              )}
            </Pressable>
          </View>

          <View
            style={[
              styles.safetyCard,
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
                styles.safetyIcon,
                {
                  backgroundColor:
                    softColor,
                },
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={21}
                color={
                  config.accent
                }
              />
            </View>

            <View style={styles.flex}>
              <Text
                style={[
                  styles.safetyTitle,
                  {
                    color:
                      theme.colors.text,
                    textAlign,
                  },
                ]}
              >
                {isRTL
                  ? 'اتصال آمن'
                  : 'Secure Access'}
              </Text>

              <Text
                style={[
                  styles.safetyText,
                  {
                    color:
                      theme.colors.muted,
                    textAlign,
                  },
                ]}
              >
                {isRTL
                  ? 'بيانات حسابك مخصصة لك ولا يجب مشاركتها مع الآخرين.'
                  : 'Your account credentials are private and should not be shared.'}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.footer,
              {
                color:
                  theme.colors.muted,
              },
            ]}
          >
            SMART SCHOOL BUS
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    flex: {
      flex: 1,
    },

    safeArea: {
      flex: 1,
      overflow: 'hidden',
    },

    decorativeCircleTop: {
      position: 'absolute',
      width: 250,
      height: 250,
      borderRadius: 125,
      top: -145,
      left: -100,
    },

    decorativeCircleBottom: {
      position: 'absolute',
      width: 230,
      height: 230,
      borderRadius: 115,
      bottom: -130,
      right: -120,
    },

    content: {
      flexGrow: 1,
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 28,
    },

    topRow: {
      justifyContent:
        'space-between',
      alignItems: 'center',
      zIndex: 2,
    },

    roundButton: {
      width: 45,
      height: 45,
      borderRadius: 15,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    languageButton: {
      minWidth: 60,
      height: 43,
      borderRadius: 15,
      borderWidth: 1,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 5,
    },

    languageText: {
      fontSize: 11,
      fontWeight: '900',
    },

    brandSection: {
      alignItems: 'center',
      marginTop: 8,
      paddingHorizontal: 8,
    },

    logoBackdrop: {
      width: 92,
      height: 108,
      borderRadius: 20,

      backgroundColor: '#FFFFFF',

      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',

      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 6,
      },
      shadowOpacity: 0.16,
      shadowRadius: 14,

      elevation: 6,
    },

    logo: {
      width: 76,
      height: 92,
    },

    roleBadge: {
      marginTop: 10,
      minHeight: 35,
      borderRadius: 14,
      paddingHorizontal: 13,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
    },

    roleBadgeText: {
      fontSize: 10,
      fontWeight: '900',
    },

    title: {
      marginTop: 13,
      fontSize: 24,
      lineHeight: 31,
      fontWeight: '900',
      width: '100%',
    },

    subtitle: {
      marginTop: 5,
      fontSize: 11,
      lineHeight: 18,
      fontWeight: '600',
      width: '100%',
    },

    formCard: {
      marginTop: 18,
      borderRadius: 27,
      padding: 17,
      borderWidth: 1,

      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowRadius: 20,

      elevation: 6,
    },

    fieldLabel: {
      fontSize: 11,
      fontWeight: '900',
      marginBottom: 7,
    },

    inputWrap: {
      height: 57,
      borderRadius: 18,
      paddingHorizontal: 10,
      borderWidth: 1,
      alignItems: 'center',
      gap: 8,
    },

    inputIcon: {
      width: 37,
      height: 37,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    input: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      paddingVertical: 0,
    },

    optionsRow: {
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginTop: 16,
      gap: 12,
    },

    rememberRow: {
      alignItems: 'center',
      gap: 7,
    },

    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    rememberText: {
      fontSize: 10,
      fontWeight: '700',
    },

    forgotText: {
      fontSize: 10,
      fontWeight: '900',
    },

    loginButton: {
      height: 57,
      marginTop: 19,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 10,
    },

    loginText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900',
    },

    loginArrow: {
      width: 31,
      height: 31,
      borderRadius: 11,
      backgroundColor:
        '#FFFFFF',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    safetyCard: {
      marginTop: 15,
      minHeight: 76,
      borderRadius: 21,
      borderWidth: 1,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
    },

    safetyIcon: {
      width: 43,
      height: 43,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    safetyTitle: {
      fontSize: 11,
      fontWeight: '900',
    },

    safetyText: {
      marginTop: 3,
      fontSize: 8.5,
      lineHeight: 13,
      fontWeight: '600',
    },

    footer: {
      marginTop: 20,
      textAlign: 'center',
      fontSize: 8,
      letterSpacing: 2.4,
      fontWeight: '900',
    },
  });