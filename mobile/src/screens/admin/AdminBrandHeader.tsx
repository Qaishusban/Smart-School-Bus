import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';

const SYSTEM_LOGO = require('../../assets/system-logo.png') as ImageSourcePropType;

type Props = {
  title: string;
  subtitle?: string;
  schoolName?: string;
  schoolLogoUrl?: string | null;
  onBack?: () => void;
  right?: React.ReactNode;
  compact?: boolean;
};

export default function AdminBrandHeader({
  title,
  subtitle,
  schoolName,
  schoolLogoUrl,
  onBack,
  right,
  compact = false,
}: Props) {
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        compact && styles.compact,
      ]}
    >
      <View
        style={[
          styles.brandRow,
          {
            flexDirection: direction,
          },
        ]}
      >
        {!!onBack && (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={[
              styles.back,
              {
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Ionicons
              name={isRTL ? 'chevron-forward' : 'chevron-back'}
              size={21}
              color={theme.colors.text}
            />
          </Pressable>
        )}

        <View style={styles.systemLogoBox}>
          <Image source={SYSTEM_LOGO} style={styles.systemLogo} resizeMode="contain" />
        </View>

        <View style={styles.copy}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
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
                styles.subtitle,
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

        {!!schoolName && (
          <View
            style={[
              styles.schoolBrand,
              {
                flexDirection: direction,
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.schoolLogoBox}>
              {schoolLogoUrl ? (
                <Image
                  source={{ uri: schoolLogoUrl }}
                  style={styles.schoolLogo}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons name="school" size={18} color="#0A2D44" />
              )}
            </View>

            <Text
              numberOfLines={1}
              style={[
                styles.schoolName,
                {
                  color: theme.colors.text,
                  textAlign,
                },
              ]}
            >
              {schoolName}
            </Text>
          </View>
        )}

        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 14,
    marginTop: 7,
    minHeight: 72,
    borderRadius: 23,
    borderWidth: 1,
    paddingHorizontal: 11,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  compact: {
    minHeight: 64,
  },
  brandRow: {
    alignItems: 'center',
    gap: 9,
  },
  back: {
    width: 39,
    height: 39,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemLogoBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#0A2D44',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  systemLogo: {
    width: 42,
    height: 42,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 8.5,
    fontWeight: '700',
  },
  schoolBrand: {
    maxWidth: 122,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
  },
  schoolLogoBox: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  schoolLogo: {
    width: 27,
    height: 27,
  },
  schoolName: {
    maxWidth: 70,
    fontSize: 7.8,
    fontWeight: '900',
  },
});
