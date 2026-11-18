import React, { ReactNode } from 'react';

import {
  ScrollView,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import { useAppTheme } from '../../theme/ThemeContext';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export default function AppScreen({
  children,
  scroll = false,
  style,
  contentStyle,
}: Props) {
  const { theme } = useAppTheme();

  if (scroll) {
    return (
      <SafeAreaView
        style={[
          {
            flex: 1,
            backgroundColor:
              theme.colors.background,
          },
          style,
        ]}
        edges={['top', 'left', 'right']}
      >
        <ScrollView
          contentContainerStyle={[
            {
              padding: theme.spacing.lg,
              paddingBottom: 110,
            },
            contentStyle,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        {
          flex: 1,
          backgroundColor:
            theme.colors.background,
        },
        style,
      ]}
      edges={['top', 'left', 'right']}
    >
      <View
        style={[
          {
            flex: 1,
            padding: theme.spacing.lg,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
