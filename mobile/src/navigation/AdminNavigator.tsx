import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';

import AdminHomeScreen from '../screens/admin/AdminHomeScreen';
import AdminFleetMapScreen from '../screens/admin/AdminFleetMapScreen';
import AdminNotificationsScreen from '../screens/admin/AdminNotificationsScreen';
import AdminSchoolSettingsScreen from '../screens/admin/AdminSchoolSettingsScreen';

import AdminDashboard from '../screens/admin/AdminDashboard';
import AdminAcademicYearsScreen from '../screens/admin/AdminAcademicYearsScreen';
import AdminAttendanceScreen from '../screens/admin/AdminAttendanceScreen';
import AdminBroadcastsScreen from '../screens/admin/AdminBroadcastsScreen';
import AdminBusesScreen from '../screens/admin/AdminBusesScreen';
import AdminDriversScreen from '../screens/admin/AdminDriversScreen';
import AdminIncidentsScreen from '../screens/admin/AdminIncidentsScreen';
import AdminParentsScreen from '../screens/admin/AdminParentsScreen';
import AdminRoutesScreen from '../screens/admin/AdminRoutesScreen';
import AdminGradesSectionsScreen from '../screens/admin/AdminGradesSectionsScreen';
import AdminReportsScreen from '../screens/admin/AdminReportsScreen';
import AdminAlertsCenterScreen from '../screens/admin/AdminAlertsCenterScreen';
import AdminSupportScreen from '../screens/admin/AdminSupportScreen';
import AdminStudentsScreen from '../screens/admin/AdminStudentsScreen';
import AdminSubscriptionScreen from '../screens/admin/AdminSubscriptionScreen';
import AdminTeachersScreen from '../screens/admin/AdminTeachersScreen';
import AdminTripsScreen from '../screens/admin/AdminTripsScreen';
import AdminImportScreen from '../screens/admin/AdminImportScreen';
import AdminIntegrationSettingsScreen from '../screens/admin/AdminIntegrationSettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

export const ADMIN_ROUTES = {
  TABS: 'AdminTabs',

  HOME: 'AdminHome',
  MAP: 'AdminFleetMap',
  NOTIFICATIONS: 'AdminNotifications',
  SETTINGS: 'AdminSchoolSettings',

  DASHBOARD: 'AdminDashboard',
  ACADEMIC_YEARS: 'AdminAcademicYears',
  ATTENDANCE: 'AdminAttendance',
  BROADCASTS: 'AdminBroadcasts',
  BUSES: 'AdminBuses',
  DRIVERS: 'AdminDrivers',
  INCIDENTS: 'AdminIncidents',
  PARENTS: 'AdminParents',
  ROUTES: 'AdminRoutes',
  GRADES_SECTIONS: 'AdminGradesSections',
  REPORTS: 'AdminReports',
  ALERTS_CENTER: 'AdminAlertsCenter',
  SUPPORT: 'AdminSupport',
  STUDENTS: 'AdminStudents',
  SUBSCRIPTION: 'AdminSubscription',
  TEACHERS: 'AdminTeachers',
  TRIPS: 'AdminTrips',
  IMPORT: 'AdminImport',
  INTEGRATION: 'AdminIntegrationSettings',
} as const;

function AdminTabs() {
  const responsiveTabs = useResponsiveLayout();
  const { theme, isDark } = useAppTheme();
  const { isRTL } = useLanguage();
  const insets = useSafeAreaInsets();

  const androidBottom =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, 14)
      : 0;

  return (
    <Tab.Navigator
      initialRouteName={ADMIN_ROUTES.HOME}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,

        sceneStyle: {
          backgroundColor: theme.colors.background,
        },

        tabBarActiveTintColor: '#F7B83A',
        tabBarInactiveTintColor: theme.colors.textSecondary,

        tabBarLabelPosition: 'below-icon',

        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,

          // Keep the current iPhone layout unchanged.
          // Android reserves space for 3-button and gesture navigation.
          height: responsiveTabs.isLandscape
            ? (Platform.OS === 'ios'
                ? 56 + insets.bottom
                : 54 + androidBottom)
            : (Platform.OS === 'ios'
                ? 88
                : 62 + androidBottom),

          paddingTop: responsiveTabs.isLandscape ? 3 : 8,

          paddingBottom: responsiveTabs.isLandscape
            ? (Platform.OS === 'ios'
                ? insets.bottom
                : androidBottom)
            : (Platform.OS === 'ios'
                ? 24
                : androidBottom),

          elevation: 12,

          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -4,
          },
          shadowOpacity:
            isDark
              ? 0.18
              : 0.08,
          shadowRadius: 12,
        },

        tabBarLabelStyle: {
          fontSize: responsiveTabs.isLandscape
            ? 10
            : responsiveTabs.isTabletSize
            ? 11
            : 10,
          fontWeight: '900',
        },

        tabBarIcon: ({
          focused,
          color,
        }) => {
          let iconName:
            React.ComponentProps<
              typeof Ionicons
            >['name'] =
            'ellipse-outline';

          switch (route.name) {
            case ADMIN_ROUTES.HOME:
              iconName =
                focused
                  ? 'home'
                  : 'home-outline';
              break;

            case ADMIN_ROUTES.MAP:
              iconName =
                focused
                  ? 'map'
                  : 'map-outline';
              break;

            case ADMIN_ROUTES.NOTIFICATIONS:
              iconName =
                focused
                  ? 'notifications'
                  : 'notifications-outline';
              break;

            case ADMIN_ROUTES.SETTINGS:
              iconName =
                focused
                  ? 'settings'
                  : 'settings-outline';
              break;
          }

          return (
            <Ionicons
              name={iconName}
              size={responsiveTabs.isLandscape
                ? (focused ? 22 : 21)
                : (focused ? 25 : 23)}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name={ADMIN_ROUTES.HOME}
        component={AdminHomeScreen}
        options={{
          tabBarLabel:
            isRTL
              ? 'الرئيسية'
              : 'Home',
        }}
      />

      <Tab.Screen
        name={ADMIN_ROUTES.MAP}
        component={AdminFleetMapScreen}
        options={{
          tabBarLabel:
            isRTL
              ? 'الخريطة'
              : 'Map',
        }}
      />

      <Tab.Screen
        name={ADMIN_ROUTES.NOTIFICATIONS}
        component={AdminNotificationsScreen}
        options={{
          tabBarLabel:
            isRTL
              ? 'الإشعارات'
              : 'Alerts',
        }}
      />

      <Tab.Screen
        name={ADMIN_ROUTES.SETTINGS}
        component={AdminSchoolSettingsScreen}
        options={{
          tabBarLabel:
            isRTL
              ? 'الإعدادات'
              : 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

export default function AdminNavigator() {
  const { theme } = useAppTheme();

  return (
    <Stack.Navigator
      initialRouteName={ADMIN_ROUTES.TABS}
      screenOptions={{
        headerShown: false,

        contentStyle: {
          backgroundColor:
            theme.colors.background,
        },

        animation:
          Platform.OS === 'ios'
            ? 'slide_from_right'
            : 'fade_from_bottom',
      }}
    >
      <Stack.Screen
        name={ADMIN_ROUTES.TABS}
        component={AdminTabs}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.DASHBOARD}
        component={AdminDashboard}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.ACADEMIC_YEARS}
        component={AdminAcademicYearsScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.ATTENDANCE}
        component={AdminAttendanceScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.BROADCASTS}
        component={AdminBroadcastsScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.BUSES}
        component={AdminBusesScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.DRIVERS}
        component={AdminDriversScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.INCIDENTS}
        component={AdminIncidentsScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.PARENTS}
        component={AdminParentsScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.ROUTES}
        component={AdminRoutesScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.GRADES_SECTIONS}
        component={AdminGradesSectionsScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.REPORTS}
        component={AdminReportsScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.ALERTS_CENTER}
        component={AdminAlertsCenterScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.SUPPORT}
        component={AdminSupportScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.STUDENTS}
        component={AdminStudentsScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.SUBSCRIPTION}
        component={AdminSubscriptionScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.TEACHERS}
        component={AdminTeachersScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.TRIPS}
        component={AdminTripsScreen}
        options={{
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name={ADMIN_ROUTES.IMPORT}
        component={AdminImportScreen}
        options={{
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name={ADMIN_ROUTES.INTEGRATION}
        component={AdminIntegrationSettingsScreen}
        options={{
          presentation: 'card',
        }}
      />
    </Stack.Navigator>
  );
}