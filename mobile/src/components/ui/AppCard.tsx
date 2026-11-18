import React, { ReactNode } from 'react';

import {
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';

import { useAppTheme } from '../../theme/ThemeContext';

export default function AppCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        {
          backgroundColor:
            theme.colors.surface,

          borderRadius:
            theme.radius.lg,

          padding:
            theme.spacing.lg,

          borderWidth: 1,

          borderColor:
            theme.colors.border,

          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 6,
          },
          shadowOpacity:
            theme.dark ? 0.22 : 0.06,
          shadowRadius: 16,
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
