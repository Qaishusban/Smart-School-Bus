import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { LanguageProvider } from './src/i18n/LanguageContext';
import { useAuth } from './src/hooks/useAuth';
import RootNavigator from './src/navigation/RootNavigator';
import AppUpdateGate from './src/components/AppUpdateGate';

import {
  attachPushNotificationListeners,
  configurePushNotificationPresentation,
  openLastNotificationResponseIfAny,
  registerForPushNotifications,
} from './src/services/pushNotificationService';

configurePushNotificationPresentation();

function PushBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    const detach = attachPushNotificationListeners();
    void openLastNotificationResponseIfAny();
    return detach;
  }, []);

  useEffect(() => {
    if (!user) return;

    const linkedId =
      user.role === 'parent'
        ? user.parent_id ?? user.id
        : user.role === 'teacher'
          ? user.teacher_id ?? user.id
          : user.role === 'driver'
            ? user.driver_id ?? user.id
            : user.id;

    void registerForPushNotifications({
      id: linkedId,
      role: user.role,
      full_name: user.full_name ?? user.name ?? null,
      username: user.username ?? null,
      school_id: user.school_id ?? null,
      route_id: user.route_id ?? null,
      bus_id: user.bus_id ?? null,
      raw:
        user.raw && typeof user.raw === 'object'
          ? (user.raw as Record<string, any>)
          : null,
    });
  }, [user]);

  return null;
}

function AppContent() {
  const { isDark, theme } = useAppTheme();

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />

      <AuthProvider>
        <PushBootstrap />

        <AppUpdateGate>
          <RootNavigator />
        </AppUpdateGate>
      </AuthProvider>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AppContent />
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}