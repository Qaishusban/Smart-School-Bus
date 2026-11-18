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

import DriverHomeScreen
  from '../screens/driver/DriverHomeScreen';

import DriverMapScreen
  from '../screens/driver/DriverMapScreen';

import DriverStudentsScreen
  from '../screens/driver/DriverStudentsScreen';

import DriverNotifications
  from '../screens/driver/DriverNotifications';

import DriverSettingsScreen
  from '../screens/driver/DriverSettingsScreen';

import DriverIncidentsScreen
  from '../screens/driver/DriverIncidentsScreen';

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

function DriverTabs() {
  const responsiveTabs = useResponsiveLayout();
  const {
    theme,
  } = useAppTheme();

  const {
    isRTL,
  } = useLanguage();

  const insets =
    useSafeAreaInsets();

  const androidBottom =
    Platform.OS === 'android'
      ? Math.max(
          insets.bottom,
          14
        )
      : 0;

  return (
    <Tab.Navigator
      initialRouteName="DriverHome"
      screenOptions={({
        route,
      }) => ({
        headerShown:
          false,

        tabBarHideOnKeyboard:
          true,

        tabBarActiveTintColor:
          '#F7B83A',

        tabBarInactiveTintColor:
          theme.colors.textSecondary,

        tabBarStyle: {
          backgroundColor:
            theme.colors.surface,

          borderTopColor:
            theme.colors.border,

          borderTopWidth:
            1,

          /*
           * Original iOS dimensions stay untouched.
           * Android reserves the actual navigation-bar safe area.
           */
          height: responsiveTabs.isLandscape
            ? (Platform.OS === 'ios'
                ? 56 + insets.bottom
                : 54 + androidBottom)
            : (Platform.OS === 'ios'
                ? 72
                : 64 + androidBottom),

          paddingTop: responsiveTabs.isLandscape ? 3 : 8,

          paddingBottom: responsiveTabs.isLandscape
            ? (Platform.OS === 'ios'
                ? insets.bottom
                : androidBottom)
            : (Platform.OS === 'ios'
                ? 10
                : androidBottom),

          paddingHorizontal:
            0,

          elevation:
            12,
        },

        tabBarItemStyle: {
          flex:
            1,

          alignItems:
            'center',

          justifyContent:
            'center',

          paddingHorizontal:
            0,

          paddingBottom:
            Platform.OS === 'android'
              ? 2
              : 0,

          marginHorizontal:
            0,
        },

        tabBarIconStyle: {
          alignSelf:
            'center',

          margin:
            0,
        },

        tabBarLabelPosition:
          'below-icon',

        tabBarLabelStyle: {
          fontSize:
            responsiveTabs.isLandscape
            ? 10
            : responsiveTabs.isTabletSize
            ? 11
            : 9,

          lineHeight:
            13,

          fontWeight:
            '800',

          textAlign:
            'center',

          marginTop:
            1,

          marginBottom:
            0,
        },

        tabBarIcon: ({
          color,
          size,
          focused,
        }) => {
          let iconName:
            keyof typeof Ionicons.glyphMap =
              'ellipse-outline';

          switch (
            route.name
          ) {
            case 'DriverHome':
              iconName =
                focused
                  ? 'home'
                  : 'home-outline';
              break;

            case 'DriverMap':
              iconName =
                focused
                  ? 'map'
                  : 'map-outline';
              break;

            case 'DriverStudents':
              iconName =
                focused
                  ? 'people'
                  : 'people-outline';
              break;

            case 'DriverNotifications':
              iconName =
                focused
                  ? 'notifications'
                  : 'notifications-outline';
              break;

            case 'DriverSettings':
              iconName =
                focused
                  ? 'settings'
                  : 'settings-outline';
              break;
          }

          return (
            <Ionicons
              name={
                iconName
              }
              size={
                focused
                  ? size + 2
                  : size
              }
              color={
                color
              }
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="DriverHome"
        component={
          DriverHomeScreen
        }
        options={{
          title:
            isRTL
              ? 'الرئيسية'
              : 'Home',
        }}
      />

      <Tab.Screen
        name="DriverMap"
        component={
          DriverMapScreen
        }
        options={{
          title:
            isRTL
              ? 'الخريطة'
              : 'Map',
        }}
      />

      <Tab.Screen
        name="DriverStudents"
        component={
          DriverStudentsScreen
        }
        options={{
          title:
            isRTL
              ? 'الطلاب'
              : 'Students',
        }}
      />

      <Tab.Screen
        name="DriverNotifications"
        component={
          DriverNotifications
        }
        options={{
          title:
            isRTL
              ? 'التنبيهات'
              : 'Alerts',
        }}
      />

      <Tab.Screen
        name="DriverSettings"
        component={
          DriverSettingsScreen
        }
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

export default function DriverNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown:
          false,
      }}
    >
      <Stack.Screen
        name="DriverTabs"
        component={
          DriverTabs
        }
      />

      <Stack.Screen
        name="DriverIncidents"
        component={
          DriverIncidentsScreen
        }
      />
    </Stack.Navigator>
  );
}