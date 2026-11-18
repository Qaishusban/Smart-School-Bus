import React, { useMemo, useState } from 'react';

import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { PinRole } from '../../types/auth';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAppTheme } from '../../theme/ThemeContext';

interface Props {
  role: PinRole;
  navigation: any;
}

export default function PinLoginScreen({
  role,
  navigation,
}: Props) {
  const { signInPin } = useAuth();

  const {
    t,
    isRTL,
    textAlign,
    direction,
    language,
    setLanguage,
  } = useLanguage();

  const {
    theme,
    isDark,
    setMode,
  } = useAppTheme();

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);

  const roleData = useMemo(() => {
    if (role === 'teacher') {
      return {
        title: t('teacherPortal'),
        icon: 'school' as const,
      };
    }

    if (role === 'driver') {
      return {
        title: t('driverPortal'),
        icon: 'bus' as const,
      };
    }

    return {
      title: t('parentPortal'),
      icon: 'people' as const,
    };
  }, [role, t]);

  const submit = async () => {
    if (!username.trim() || !pin.trim()) {
      Alert.alert(
        t('loginError'),
        t('requiredFields')
      );
      return;
    }

    try {
      setLoading(true);

      await signInPin(
        role,
        username,
        pin
      );
    } catch (error) {
      Alert.alert(
        t('loginError'),
        error instanceof Error
          ? error.message
          : t('loginError')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.safe,
        {
          backgroundColor:
            theme.colors.background,
        },
      ]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            styles.content
          }
        >
          <View style={styles.topRow}>
            <Pressable
              onPress={() =>
                navigation.goBack()
              }
              style={[
                styles.roundButton,
                {
                  backgroundColor:
                    theme.colors.surface,
                  borderColor:
                    theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name={
                  isRTL
                    ? 'arrow-forward'
                    : 'arrow-back'
                }
                size={21}
                color={theme.colors.text}
              />
            </Pressable>

            <View style={styles.topActions}>
              <Pressable
                onPress={() =>
                  setLanguage(
                    language === 'ar'
                      ? 'en'
                      : 'ar'
                  )
                }
                style={[
                  styles.languageButton,
                  {
                    backgroundColor:
                      theme.colors.surface,
                    borderColor:
                      theme.colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="language-outline"
                  size={18}
                  color={theme.colors.text}
                />

                <Text
                  style={{
                    color:
                      theme.colors.text,
                    fontWeight: '800',
                  }}
                >
                  {language === 'ar'
                    ? 'EN'
                    : 'عربي'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  setMode(
                    isDark
                      ? 'light'
                      : 'dark'
                  )
                }
                style={[
                  styles.roundButton,
                  {
                    backgroundColor:
                      theme.colors.surface,
                    borderColor:
                      theme.colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={
                    isDark
                      ? 'sunny-outline'
                      : 'moon-outline'
                  }
                  size={20}
                  color={theme.colors.text}
                />
              </Pressable>
            </View>
          </View>

          <View
            style={[
              styles.hero,
              {
                backgroundColor:
                  isDark
                    ? theme.colors.surface
                    : '#102A43',
              },
            ]}
          >
            <View
              style={[
                styles.heroIcon,
                {
                  backgroundColor:
                    theme.colors.accent,
                },
              ]}
            >
              <Ionicons
                name={roleData.icon}
                size={40}
                color="#102A43"
              />
            </View>

            <Text style={styles.heroTitle}>
              {roleData.title}
            </Text>

            <Text style={styles.heroSubtitle}>
              {t('secureLogin')}
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
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: theme.colors.text,
                  textAlign,
                },
              ]}
            >
              {t('username')}
            </Text>

            <View
              style={[
                styles.inputContainer,
                {
                  borderColor:
                    theme.colors.border,
                  backgroundColor:
                    theme.colors.surface2,
                  flexDirection: direction,
                },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={theme.colors.muted}
              />

              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t(
                  'enterUsername'
                )}
                placeholderTextColor={
                  theme.colors.muted
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
                styles.label,
                styles.pinLabel,
                {
                  color: theme.colors.text,
                  textAlign,
                },
              ]}
            >
              {t('pin')}
            </Text>

            <View
              style={[
                styles.inputContainer,
                {
                  borderColor:
                    theme.colors.border,
                  backgroundColor:
                    theme.colors.surface2,
                  flexDirection: direction,
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={theme.colors.muted}
              />

              <TextInput
                value={pin}
                onChangeText={setPin}
                secureTextEntry={!showPin}
                keyboardType="number-pad"
                maxLength={12}
                placeholder={t('enterPin')}
                placeholderTextColor={
                  theme.colors.muted
                }
                style={[
                  styles.input,
                  {
                    color:
                      theme.colors.text,
                    textAlign,
                  },
                ]}
                onSubmitEditing={submit}
              />

              <Pressable
                onPress={() =>
                  setShowPin((value) => !value)
                }
              >
                <Ionicons
                  name={
                    showPin
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={21}
                  color={theme.colors.muted}
                />
              </Pressable>
            </View>

            <Pressable
              disabled={loading}
              onPress={submit}
              style={({ pressed }) => [
                styles.loginButton,
                {
                  backgroundColor:
                    theme.colors.primary,
                  opacity:
                    loading
                      ? 0.6
                      : pressed
                      ? 0.86
                      : 1,
                },
              ]}
            >
              {loading ? (
                <Text
                  style={[
                    styles.loginText,
                    {
                      color:
                        theme.dark
                          ? '#102A43'
                          : '#FFFFFF',
                    },
                  ]}
                >
                  {t('signingIn')}
                </Text>
              ) : (
                <View
                  style={{
                    flexDirection:
                      direction,
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="log-in-outline"
                    size={20}
                    color={
                      theme.dark
                        ? '#102A43'
                        : '#FFFFFF'
                    }
                  />

                  <Text
                    style={[
                      styles.loginText,
                      {
                        color:
                          theme.dark
                            ? '#102A43'
                            : '#FFFFFF',
                      },
                    ]}
                  >
                    {t('signIn')}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.securityNote}>
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={theme.colors.success}
            />

            <Text
              style={{
                color:
                  theme.colors.textSecondary,
                fontSize: 11,
                flex: 1,
                textAlign,
              }}
            >
              {t('privacyNote')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 36,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
  },

  topActions: {
    flexDirection: 'row',
    gap: 8,
  },

  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  languageButton: {
    height: 44,
    minWidth: 76,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hero: {
    minHeight: 210,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  heroIcon: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 17,
    textAlign: 'center',
  },

  heroSubtitle: {
    color: '#D9E2EC',
    fontSize: 13,
    marginTop: 6,
  },

  formCard: {
    marginTop: -18,
    marginHorizontal: 8,
    borderWidth: 1,
    borderRadius: 26,
    padding: 20,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 5,
  },

  label: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },

  pinLabel: {
    marginTop: 17,
  },

  inputContainer: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 10,
  },

  input: {
    flex: 1,
    fontSize: 15,
    minHeight: 54,
  },

  loginButton: {
    minHeight: 56,
    borderRadius: 17,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loginText: {
    fontSize: 15,
    fontWeight: '900',
  },

  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: 18,
    marginTop: 22,
  },
});
