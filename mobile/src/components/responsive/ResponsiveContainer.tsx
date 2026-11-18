import React from 'react';
import {
  View,
  ViewStyle,
  StyleProp,
  ScrollView,
  ScrollViewProps,
} from 'react-native';

import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

type ResponsiveContainerProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  maxWidth?: number;
  scrollable?: boolean;
  padded?: boolean;
  centered?: boolean;
  scrollProps?: Omit<
    ScrollViewProps,
    'children' | 'contentContainerStyle'
  >;
};

export default function ResponsiveContainer({
  children,
  style,
  contentStyle,
  maxWidth,
  scrollable = false,
  padded = true,
  centered = true,
  scrollProps,
}: ResponsiveContainerProps) {
  const layout = useResponsiveLayout();

  const containerWidth =
    maxWidth ?? layout.contentMaxWidth;

  const responsiveStyle: ViewStyle = {
    width: '100%',
    maxWidth: containerWidth,
    alignSelf: centered ? 'center' : 'stretch',
    paddingHorizontal: padded
      ? layout.horizontalPadding
      : 0,
  };

  if (scrollable) {
    return (
      <ScrollView
        {...scrollProps}
        style={[{ flex: 1 }, style]}
        contentContainerStyle={[
          { flexGrow: 1 },
          contentStyle,
        ]}
      >
        <View style={responsiveStyle}>
          {children}
        </View>
      </ScrollView>
    );
  }

  return (
    <View
      style={[
        { flex: 1, width: '100%' },
        style,
      ]}
    >
      <View
        style={[
          { flex: 1 },
          responsiveStyle,
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
