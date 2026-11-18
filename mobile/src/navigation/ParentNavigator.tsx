import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import React from 'react';

import {
  Platform,
} from 'react-native';

import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import ParentHomeScreen from '../screens/parent/ParentHomeScreen';
import ParentNotificationsScreen from '../screens/parent/ParentNotificationsScreen';
import ParentSettingsScreen from '../screens/parent/ParentSettingsScreen';
import StudentTrackScreen from '../screens/parent/StudentTrackScreen';
import ParentRequestsScreen from '../screens/parent/ParentRequestsScreen';
import ParentDailyInstructionsScreen from '../screens/parent/ParentDailyInstructionsScreen';

import {
  useAppTheme,
} from '../theme/ThemeContext';

import {
  useLanguage,
} from '../i18n/LanguageContext';

const Tab =
  createBottomTabNavigator();

const Stack =
  createNativeStackNavigator();

export const PARENT_ROUTES = {
  TABS: 'ParentTabs',
  HOME: 'ParentHome',
  TRACK: 'StudentTrack',
  NOTIFICATIONS: 'ParentNotifications',
  SETTINGS: 'ParentSettings',
  REQUESTS: 'ParentRequests',
  DAILY_INSTRUCTIONS: 'ParentDailyInstructions',
} as const;

function ParentTabs() {
  const responsiveTabs = useResponsiveLayout();
  const { theme } =
    useAppTheme();

  const { t } =
    useLanguage();

  const insets =
    useSafeAreaInsets();

  const androidBottom =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, 14)
      : 0;

  return (
    <Tab.Navigator
      initialRouteName={
        PARENT_ROUTES.HOME
      }
      screenOptions={({
        route,
      }) => ({
        headerShown: false,

        tabBarHideOnKeyboard:
          true,

        sceneStyle: {
          backgroundColor:
            theme.colors.background,
        },

        tabBarActiveTintColor:
          theme.colors.primary,

        tabBarInactiveTintColor:
          theme.colors.tabInactive,

        tabBarLabelPosition: 'below-icon',

        tabBarStyle: {
          backgroundColor:
            theme.colors.tabBar,

          borderTopColor:
            theme.colors.border,

          borderTopWidth: 1,

          /*
           * iOS remains exactly as before.
           * Android reserves room for the system navigation bar.
           */
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
              ? 0.22
              : 0.07,

          shadowRadius: 12,
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
            : 10,
          fontWeight: '700',
        },

        tabBarIcon: ({
          color,
          focused,
        }) => {
          let iconName:
            | 'home'
            | 'home-outline'
            | 'location'
            | 'location-outline'
            | 'notifications'
            | 'notifications-outline'
            | 'settings'
            | 'settings-outline' =
            'home-outline';

          switch (
            route.name
          ) {
            case PARENT_ROUTES.HOME:
              iconName =
                focused
                  ? 'home'
                  : 'home-outline';
              break;

            case PARENT_ROUTES.TRACK:
              iconName =
                focused
                  ? 'location'
                  : 'location-outline';
              break;

            case PARENT_ROUTES.NOTIFICATIONS:
              iconName =
                focused
                  ? 'notifications'
                  : 'notifications-outline';
              break;

            case PARENT_ROUTES.SETTINGS:
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
        name={
          PARENT_ROUTES.HOME
        }
        component={
          ParentHomeScreen
        }
        options={{
          title: t('home'),
          tabBarLabel:
            t('home'),
        }}
      />

      <Tab.Screen
        name={
          PARENT_ROUTES.TRACK
        }
        component={
          StudentTrackScreen
        }
        options={{
          title:
            t('tracking'),

          tabBarLabel:
            t('tracking'),
        }}
      />

      <Tab.Screen
        name={
          PARENT_ROUTES.NOTIFICATIONS
        }
        component={
          ParentNotificationsScreen
        }
        options={{
          title:
            t('notifications'),

          tabBarLabel:
            t('notifications'),
        }}
      />

      <Tab.Screen
        name={
          PARENT_ROUTES.SETTINGS
        }
        component={
          ParentSettingsScreen
        }
        options={{
          title:
            t('settings'),

          tabBarLabel:
            t('settings'),
        }}
      />
    </Tab.Navigator>
  );
}

export default function ParentNavigator() {
  const { theme } =
    useAppTheme();

  return (
    <Stack.Navigator
      initialRouteName={
        PARENT_ROUTES.TABS
      }
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
        name={
          PARENT_ROUTES.TABS
        }
        component={
          ParentTabs
        }
      />

      <Stack.Screen
        name={
          PARENT_ROUTES.REQUESTS
        }
        component={
          ParentRequestsScreen
        }
        options={{
          presentation:
            'card',
        }}
      />

      <Stack.Screen
        name={
          PARENT_ROUTES.DAILY_INSTRUCTIONS
        }
        component={
          ParentDailyInstructionsScreen
        }
        options={{
          presentation:
            'card',
        }}
      />
    </Stack.Navigator>
  );
}