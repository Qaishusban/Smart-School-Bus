import React, {
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as SecureStore from 'expo-secure-store';

import {
  AppUpdatePolicy,
  getAppUpdatePolicy,
} from '../services/appUpdateService';

import {
  useLanguage,
} from '../i18n/LanguageContext';

import {
  useAppTheme,
} from '../theme/ThemeContext';

const OPTIONAL_UPDATE_SKIP_KEY =
  'smart_bus_optional_update_skip_build_v1';

export default function AppUpdateGate({
  children,
}: {
  children: ReactNode;
}) {
  const {
    language,
    isRTL,
  } = useLanguage();

  const {
    isDark,
  } = useAppTheme();

  const [
    checking,
    setChecking,
  ] = useState(true);

  const [
    policy,
    setPolicy,
  ] =
    useState<AppUpdatePolicy | null>(
      null
    );

  const [
    visible,
    setVisible,
  ] = useState(false);

  const checkUpdate =
    useCallback(
      async () => {
        try {
          const next =
            await getAppUpdatePolicy();

          setPolicy(next);

          if (
            !next ||
            !next.updateAvailable
          ) {
            setVisible(false);
            return;
          }

          if (next.forceUpdate) {
            setVisible(true);
            return;
          }

          const skipped =
            await SecureStore
              .getItemAsync(
                OPTIONAL_UPDATE_SKIP_KEY
              );

          setVisible(
            skipped !==
              String(next.latestBuild)
          );
        } catch (error) {
          console.log(
            '[appUpdate] check failed:',
            error
          );
        } finally {
          setChecking(false);
        }
      },
      []
    );

  useEffect(() => {
    void checkUpdate();
  }, [checkUpdate]);

  const updateNow =
    useCallback(
      async () => {
        if (!policy?.storeUrl) {
          return;
        }

        try {
          const supported =
            await Linking.canOpenURL(
              policy.storeUrl
            );

          if (supported) {
            await Linking.openURL(
              policy.storeUrl
            );
          }
        } catch (error) {
          console.log(
            '[appUpdate] open store failed:',
            error
          );
        }
      },
      [policy]
    );

  const later =
    useCallback(
      async () => {
        if (
          !policy ||
          policy.forceUpdate
        ) {
          return;
        }

        await SecureStore.setItemAsync(
          OPTIONAL_UPDATE_SKIP_KEY,
          String(policy.latestBuild)
        );

        setVisible(false);
      },
      [policy]
    );

  if (checking) {
    return (
      <View
        style={[
          styles.loading,
          {
            backgroundColor:
              isDark
                ? '#07131F'
                : '#F5F8FB',
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

  const title =
    language === 'ar'
      ? policy?.titleAr
      : policy?.titleEn;

  const message =
    language === 'ar'
      ? policy?.messageAr
      : policy?.messageEn;

  return (
    <>
      {children}

      <Modal
        visible={
          visible &&
          !!policy
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (
            policy &&
            !policy.forceUpdate
          ) {
            void later();
          }
        }}
      >
        <View
          style={
            styles.overlay
          }
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor:
                  isDark
                    ? '#102231'
                    : '#FFFFFF',
              },
            ]}
          >
            <View
              style={
                styles.iconWrap
              }
            >
              <Text
                style={
                  styles.icon
                }
              >
                ↑
              </Text>
            </View>

            <Text
              style={[
                styles.title,
                {
                  color:
                    isDark
                      ? '#FFFFFF'
                      : '#102231',

                  textAlign:
                    isRTL
                      ? 'right'
                      : 'left',
                },
              ]}
            >
              {title}
            </Text>

            <Text
              style={[
                styles.message,
                {
                  color:
                    isDark
                      ? '#C9D5DF'
                      : '#536575',

                  textAlign:
                    isRTL
                      ? 'right'
                      : 'left',
                },
              ]}
            >
              {message}
            </Text>

            <View
              style={
                styles.versionBox
              }
            >
              <Text
                style={
                  styles.versionText
                }
              >
                {language === 'ar'
                  ? `الإصدار الحالي: ${policy?.currentVersion} (${policy?.currentBuild})`
                  : `Current version: ${policy?.currentVersion} (${policy?.currentBuild})`}
              </Text>

              <Text
                style={
                  styles.versionText
                }
              >
                {language === 'ar'
                  ? `الإصدار الجديد: ${policy?.latestVersion} (${policy?.latestBuild})`
                  : `New version: ${policy?.latestVersion} (${policy?.latestBuild})`}
              </Text>
            </View>

            {policy?.forceUpdate ? (
              <Text
                style={[
                  styles.required,
                  {
                    textAlign:
                      isRTL
                        ? 'right'
                        : 'left',
                  },
                ]}
              >
                {language === 'ar'
                  ? 'هذا التحديث مطلوب للاستمرار باستخدام التطبيق.'
                  : 'This update is required to continue using the app.'}
              </Text>
            ) : null}

            <Pressable
              onPress={() => {
                void updateNow();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.primaryText
                }
              >
                {language === 'ar'
                  ? 'تحديث الآن'
                  : 'Update now'}
              </Text>
            </Pressable>

            {!policy?.forceUpdate ? (
              <Pressable
                onPress={() => {
                  void later();
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.secondaryText,
                    {
                      color:
                        isDark
                          ? '#FFFFFF'
                          : '#102231',
                    },
                  ]}
                >
                  {language === 'ar'
                    ? 'لاحقًا'
                    : 'Later'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles =
  StyleSheet.create({
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    overlay: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.62)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 22,
    },

    card: {
      width: '100%',
      maxWidth: 440,
      borderRadius: 28,
      padding: 24,
      shadowColor: '#000000',
      shadowOpacity: 0.22,
      shadowRadius: 24,
      shadowOffset: {
        width: 0,
        height: 12,
      },
      elevation: 14,
    },

    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F7B83A',
      marginBottom: 20,
    },

    icon: {
      color: '#07131F',
      fontSize: 34,
      fontWeight: '900',
      marginTop: -3,
    },

    title: {
      fontSize: 23,
      fontWeight: '900',
      marginBottom: 10,
    },

    message: {
      fontSize: 15,
      lineHeight: 24,
      fontWeight: '500',
    },

    versionBox: {
      backgroundColor:
        'rgba(127,127,127,0.10)',
      borderRadius: 16,
      padding: 14,
      marginTop: 18,
      gap: 6,
    },

    versionText: {
      color: '#7B8C99',
      fontSize: 12,
      fontWeight: '700',
    },

    required: {
      color: '#D04C4C',
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 20,
      marginTop: 14,
    },

    primaryButton: {
      minHeight: 54,
      borderRadius: 17,
      backgroundColor: '#F7B83A',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 22,
    },

    primaryText: {
      color: '#07131F',
      fontSize: 16,
      fontWeight: '900',
    },

    secondaryButton: {
      minHeight: 50,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },

    secondaryText: {
      fontSize: 15,
      fontWeight: '800',
    },

    pressed: {
      opacity: 0.78,
    },
  });