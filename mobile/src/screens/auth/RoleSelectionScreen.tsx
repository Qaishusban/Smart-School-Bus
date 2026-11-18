import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import React from 'react';

import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useLanguage,
} from '../../i18n/LanguageContext';

import {
  useAppTheme,
} from '../../theme/ThemeContext';

type RoleKey =
  | 'parent'
  | 'driver'
  | 'teacher'
  | 'admin';

type IconName =
  React.ComponentProps<
    typeof Ionicons
  >['name'];

const ROLE_CONFIG: Array<{
  key: RoleKey;
  icon: IconName;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  tint: string;
  softLight: string;
  softDark: string;
}> = [
  {
    key: 'parent',
    icon: 'people-outline',
    titleAr: 'ولي الأمر',
    titleEn: 'Parent',
    subtitleAr:
      'متابعة الأبناء والباص',
    subtitleEn:
      'Track children and bus',
    tint: '#0D9F68',
    softLight: '#E8F7EF',
    softDark:
      'rgba(13,159,104,0.16)',
  },
  {
    key: 'driver',
    icon: 'bus-outline',
    titleAr: 'السائق',
    titleEn: 'Driver',
    subtitleAr: 'إدارة الرحلات',
    subtitleEn: 'Manage trips',
    tint: '#F4B942',
    softLight: '#FFF5DF',
    softDark:
      'rgba(244,185,66,0.16)',
  },
  {
    key: 'teacher',
    icon: 'school-outline',
    titleAr: 'المعلم',
    titleEn: 'Teacher',
    subtitleAr: 'متابعة الطلاب',
    subtitleEn: 'Monitor students',
    tint: '#3488F5',
    softLight: '#EEF5FF',
    softDark:
      'rgba(52,136,245,0.16)',
  },
  {
    key: 'admin',
    icon:
      'shield-checkmark-outline',
    titleAr: 'الإدارة',
    titleEn: 'Administration',
    subtitleAr:
      'إدارة النظام والمدرسة',
    subtitleEn:
      'Manage school and system',
    tint: '#7657F6',
    softLight: '#F0EEFF',
    softDark:
      'rgba(118,87,246,0.17)',
  },
];

export default function RoleSelectionScreen({
  navigation,
}: any) {
  const {
    isRTL,
    direction,
    textAlign,
    language,
    setLanguage,
  } = useLanguage();

  const {
    theme,
    isDark,
  } = useAppTheme();

  const responsive = useResponsiveLayout();


  const responsiveRoleColumns =
    responsive.width >= 1050 ? 4 :
    responsive.width >= 720 ? 3 :
    responsive.width >= 520 ? 2 :
    2;

  const responsiveRoleGap = 11;

  const responsiveRoleAvailableWidth =
    Math.min(
      responsive.width,
      responsive.contentMaxWidth
    ) - responsive.horizontalPadding * 2;

  const responsiveRoleCardWidth =
    Math.max(
      0,
      (
        responsiveRoleAvailableWidth -
        responsiveRoleGap * (responsiveRoleColumns - 1)
      ) / responsiveRoleColumns
    );

  const openRole = (
    role: RoleKey,
  ) => {
    if (role === 'parent') {
      navigation.navigate(
        'ParentLogin',
      );
      return;
    }

    if (role === 'driver') {
      navigation.navigate(
        'DriverLogin',
      );
      return;
    }

    if (role === 'teacher') {
      navigation.navigate(
        'TeacherLogin',
      );
      return;
    }

    navigation.navigate(
      'AdminLogin',
    );
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
          styles.decorativeTop,
          {
            backgroundColor:
              isDark
                ? 'rgba(31,67,92,0.28)'
                : 'rgba(219,237,248,0.65)',
          },
        ]}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: responsive.horizontalPadding,
            paddingTop: responsive.isShortScreen ? 8 : 12,
            alignSelf: 'center',
            width: '100%',
            maxWidth: responsive.contentMaxWidth,
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={[
            styles.topBar,
            {
              flexDirection:
                direction,
            },
          ]}
        >
          <View
            style={[
              styles.brandLogoBox,
              {
                backgroundColor:
                  isDark
                    ? '#FFFFFF'
                    : 'transparent',
              },
            ]}
          >
            <Image
              source={require('../../../assets/smart-school-bus-logo-transparent.png')}
              resizeMode="contain"
              style={
                styles.brandLogo
              }
            />
          </View>

          <View
            style={styles.brandText}
          >
            <Text
              style={[
                styles.brandSmart,
                {
                  color:
                    theme.colors.text,
                  textAlign,
                },
              ]}
            >
              SMART
            </Text>

            <Text
              style={[
                styles.brandBus,
                { textAlign },
              ]}
            >
              SCHOOL BUS
            </Text>
          </View>

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
          style={styles.hero}
        >
          <View
            style={[
              styles.heroIcon,
              {
                backgroundColor:
                  isDark
                    ? 'rgba(244,185,66,0.16)'
                    : 'rgba(244,185,66,0.18)',
              },
            ]}
          >
            <Ionicons
              name="location"
              size={25}
              color={
                isDark
                  ? '#F4B942'
                  : '#0A2D44'
              }
            />
          </View>

          <Text
            style={[
              styles.welcome,
              {
                color:
                  theme.colors.text,
                textAlign,
              },
            ]}
          >
            {isRTL
              ? 'مرحباً بك'
              : 'Welcome'}
          </Text>

          <Text
            style={[
              styles.welcomeSub,
              {
                color:
                  theme.colors.textSecondary,
                textAlign,
              },
            ]}
          >
            {isRTL
              ? 'اختر نوع الحساب للمتابعة'
              : 'Choose your account type to continue'}
          </Text>
        </View>

        <View
          style={styles.grid}
        >
          {ROLE_CONFIG.map(
            role => (
              <Pressable
                key={role.key}
                onPress={() =>
                  openRole(
                    role.key,
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.roleCard,

                  { width: responsiveRoleCardWidth },
                  {
                    backgroundColor:
                      theme.colors.surface,
                    borderColor:
                      theme.colors.border,
                    opacity:
                      pressed
                        ? 0.78
                        : 1,
                    shadowOpacity:
                      isDark
                        ? 0.24
                        : 0.07,
                  },
                ]}
              >
                <View
                  style={[
                    styles.roleIcon,
                    {
                      backgroundColor:
                        isDark
                          ? role.softDark
                          : role.softLight,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      role.icon
                    }
                    size={31}
                    color={
                      role.tint
                    }
                  />
                </View>

                <Text
                  style={[
                    styles.roleTitle,
                    {
                      color:
                        theme.colors.text,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? role.titleAr
                    : role.titleEn}
                </Text>

                <Text
                  style={[
                    styles.roleSubtitle,
                    {
                      color:
                        theme.colors.textSecondary,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? role.subtitleAr
                    : role.subtitleEn}
                </Text>

                <View
                  style={[
                    styles.arrow,
                    {
                      backgroundColor:
                        role.tint,
                      [isRTL
                        ? 'left'
                        : 'right']: 14,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      isRTL
                        ? 'arrow-back'
                        : 'arrow-forward'
                    }
                    size={17}
                    color="#FFFFFF"
                  />
                </View>
              </Pressable>
            ),
          )}
        </View>

        <View
          style={styles.footer}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color="#0D9F68"
          />

          <Text
            style={[
              styles.footerText,
              {
                color:
                  theme.colors.textSecondary,
              },
            ]}
          >
            {isRTL
              ? 'معاً لنقل مدرسي أكثر أماناً'
              : 'Together for safer school transportation'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      overflow: 'hidden',
    },

    decorativeTop: {
      position: 'absolute',
      width: 280,
      height: 280,
      borderRadius: 140,
      top: -170,
      right: -120,
    },

    content: {
      flexGrow: 1,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 28,
    },

    topBar: {
      alignItems: 'center',
    },

    brandLogoBox: {
      width: 76,
      height: 56,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent:
        'center',
      overflow: 'hidden',
    },

    brandLogo: {
      width: 72,
      height: 52,
    },

    brandText: {
      flex: 1,
    },

    brandSmart: {
      marginHorizontal: 11,
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    brandBus: {
      marginHorizontal: 11,
      color: '#F4B942',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    languageButton: {
      minWidth: 59,
      height: 42,
      borderRadius: 15,
      borderWidth: 1,
      paddingHorizontal: 10,
      flexDirection: 'row',
      gap: 5,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    languageText: {
      fontWeight: '900',
      fontSize: 11,
    },

    hero: {
      alignItems: 'center',
      marginTop: 42,
      marginBottom: 26,
    },

    heroIcon: {
      width: 55,
      height: 55,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent:
        'center',
      marginBottom: 14,
    },

    welcome: {
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '900',
    },

    welcomeSub: {
      marginTop: 6,
      fontSize: 12,
      lineHeight: 19,
      fontWeight: '600',
    },

    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 11,
    },

    roleCard: {
      width: '48%',
      minHeight: 190,
      borderRadius: 25,
      borderWidth: 1,
      padding: 15,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 5,
      },
      shadowRadius: 14,
      elevation: 4,
    },

    roleIcon: {
      width: 63,
      height: 63,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    roleTitle: {
      marginTop: 19,
      fontSize: 17,
      fontWeight: '900',
    },

    roleSubtitle: {
      marginTop: 5,
      minHeight: 30,
      fontSize: 10,
      lineHeight: 15,
      fontWeight: '600',
    },

    arrow: {
      position: 'absolute',
      bottom: 14,
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    footer: {
      marginTop: 34,
      flexDirection: 'row',
      gap: 7,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    footerText: {
      fontSize: 9,
      fontWeight: '700',
    },
  });