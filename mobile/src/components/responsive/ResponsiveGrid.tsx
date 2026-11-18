import React from 'react';
import {
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';

import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

type ResponsiveGridProps = {
  children: React.ReactNode;
  gap?: number;
  minItemWidth?: number;
  maxColumns?: number;
  style?: StyleProp<ViewStyle>;
};

export default function ResponsiveGrid({
  children,
  gap = 12,
  minItemWidth = 220,
  maxColumns = 4,
  style,
}: ResponsiveGridProps) {
  const layout = useResponsiveLayout();

  const availableWidth =
    Math.min(
      layout.width,
      layout.contentMaxWidth
    ) - layout.horizontalPadding * 2;

  const columns = Math.max(
    1,
    Math.min(
      maxColumns,
      Math.floor(
        (availableWidth + gap) /
        (minItemWidth + gap)
      )
    )
  );

  const itemWidth = Math.max(
    0,
    (
      availableWidth -
      gap * (columns - 1)
    ) / columns
  );

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap,
          width: '100%',
        },
        style,
      ]}
    >
      {React.Children.toArray(children).map(
        (child, index) => (
          <View
            key={index}
            style={{
              width: itemWidth,
              minWidth: 0,
            }}
          >
            {child}
          </View>
        )
      )}
    </View>
  );
}
