import React from 'react';
import { Text } from 'react-native';

import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';

export default function SectionTitle({
  children,
}: {
  children: string;
}) {
  const { theme } = useAppTheme();
  const { isRTL } = useLanguage();

  return (
    <Text
      style={{
        color: theme.colors.text,
        fontSize: 19,
        fontWeight: '900',
        marginTop: 22,
        marginBottom: 12,
        textAlign: isRTL
          ? 'right'
          : 'left',
      }}
    >
      {children}
    </Text>
  );
}
