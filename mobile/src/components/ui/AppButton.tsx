import React from 'react';

import {
  ActivityIndicator,
  Pressable,
  Text,
} from 'react-native';

import { useAppTheme } from '../../theme/ThemeContext';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

export default function AppButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: Props) {
  const { theme } = useAppTheme();

  const backgroundColor =
    variant === 'danger'
      ? theme.colors.danger
      : variant === 'secondary'
      ? theme.colors.surface2
      : theme.colors.primary;

  const textColor =
    variant === 'secondary'
      ? theme.colors.text
      : theme.dark &&
        variant === 'primary'
      ? '#071A2C'
      : '#FFFFFF';

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: theme.radius.md,
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
        opacity:
          disabled || loading
            ? 0.55
            : pressed
            ? 0.85
            : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator
          color={textColor}
        />
      ) : (
        <Text
          style={{
            color: textColor,
            fontSize: 15,
            fontWeight: '800',
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
