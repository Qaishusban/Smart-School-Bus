import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TeacherHomeScreen from '../screens/teacher/TeacherHomeScreen';
import TeacherMapScreen from '../screens/teacher/TeacherMapScreen';
import TeacherStudentsScreen from '../screens/teacher/TeacherStudentsScreen';
import TeacherNotificationsScreen from '../screens/teacher/TeacherNotificationsScreen';
import TeacherSettingsScreen from '../screens/teacher/TeacherSettingsScreen';
import TeacherReportScreen from '../screens/teacher/TeacherReportScreen';

import { useAppTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

export const TEACHER_ROUTES = {
  TABS: 'TeacherTabs',
  HOME: 'TeacherHome',
  MAP: 'TeacherMap',
  STUDENTS: 'TeacherStudents',
  NOTIFICATIONS: 'TeacherNotifications',
  SETTINGS: 'TeacherSettings',
  REPORT: 'TeacherReport',
} as const;

function TeacherTabs() {
  const responsiveTabs = useResponsiveLayout();
  const { theme } = useAppTheme();
  const { isRTL } = useLanguage();
  const insets = useSafeAreaInsets();

  const androidBottom =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, 14)
      : 0;

  return (
    <Tab.Navigator
      initialRouteName={TEACHER_ROUTES.HOME}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,

        sceneStyle: {
          backgroundColor: theme.colors.background,
        },

        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.tabInactive,

        tabBarLabelPosition: 'below-icon',

        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,

          // Keep iPhone sizing unchanged.
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
            theme.dark
              ? 0.26
              : 0.08,
          shadowRadius: 10,
        },

        tabBarItemStyle: {
          paddingBottom:
            Platform.OS === 'android'
              ? 2
              : 0,
        },

        tabBarLabelStyle: {
          fontSize: responsiveTabs.isLandscape
            ? 10
            : responsiveTabs.isTabletSize
            ? 11
            : 9,
          fontWeight: '800',
        },

        tabBarIcon: ({
          focused,
          color,
        }) => {
          const icon:
            React.ComponentProps<
              typeof Ionicons
            >['name'] =
            route.name === TEACHER_ROUTES.HOME
              ? focused ? 'home' : 'home-outline'
              : route.name === TEACHER_ROUTES.MAP
              ? focused ? 'map' : 'map-outline'
              : route.name === TEACHER_ROUTES.STUDENTS
              ? focused ? 'people' : 'people-outline'
              : route.name === TEACHER_ROUTES.NOTIFICATIONS
              ? focused ? 'notifications' : 'notifications-outline'
              : focused ? 'settings' : 'settings-outline';

          return (
            <Ionicons
              name={icon}
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
        name={TEACHER_ROUTES.HOME}
        component={TeacherHomeScreen}
        options={{
          title:
            isRTL
              ? 'الرئيسية'
              : 'Home',
        }}
      />

      <Tab.Screen
        name={TEACHER_ROUTES.MAP}
        component={TeacherMapScreen}
        options={{
          title:
            isRTL
              ? 'الخريطة'
              : 'Map',
        }}
      />

      <Tab.Screen
        name={TEACHER_ROUTES.STUDENTS}
        component={TeacherStudentsScreen}
        options={{
          title:
            isRTL
              ? 'الطلاب'
              : 'Students',
        }}
      />

      <Tab.Screen
        name={TEACHER_ROUTES.NOTIFICATIONS}
        component={TeacherNotificationsScreen}
        options={{
          title:
            isRTL
              ? 'الإشعارات'
              : 'Notifications',
        }}
      />

      <Tab.Screen
        name={TEACHER_ROUTES.SETTINGS}
        component={TeacherSettingsScreen}
        options={{
          title:
            isRTL
              ? 'الإعدادات'
              : 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

export default function TeacherNavigator() {
  const { theme } = useAppTheme();

  return (
    <Stack.Navigator
      initialRouteName={TEACHER_ROUTES.TABS}
      screenOptions={{
        headerShown: false,

        contentStyle: {
          backgroundColor: theme.colors.background,
        },

        animation:
          Platform.OS === 'ios'
            ? 'slide_from_right'
            : 'fade_from_bottom',
      }}
    >
      <Stack.Screen
        name={TEACHER_ROUTES.TABS}
        component={TeacherTabs}
      />

      <Stack.Screen
        name={TEACHER_ROUTES.REPORT}
        component={TeacherReportScreen}
        options={{
          presentation: 'card',
        }}
      />
    </Stack.Navigator>
  );
}
