import React from 'react';

import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';

export default function LoadingState() {
  const { theme } = useAppTheme();
  const { t } = useLanguage();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator size="large" />

      <Text
        style={{
          marginTop: 12,
          color:
            theme.colors.textSecondary,
        }}
      >
        {t('loading')}
      </Text>
    </View>
  );
}
