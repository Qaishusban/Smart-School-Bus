import React from 'react';

import {
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '../../theme/ThemeContext';

export default function EmptyState({
  title,
  message,
  icon = '🚌',
}: {
  title: string;
  message?: string;
  icon?: string;
}) {
  const { theme } = useAppTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <Text style={{ fontSize: 44 }}>
        {icon}
      </Text>

      <Text
        style={{
          marginTop: 14,
          color: theme.colors.text,
          fontWeight: '900',
          fontSize: 17,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>

      {!!message && (
        <Text
          style={{
            marginTop: 7,
            color:
              theme.colors.textSecondary,
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          {message}
        </Text>
      )}
    </View>
  );
}
