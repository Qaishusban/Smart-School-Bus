import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import {
  NavigationContainer,
} from '@react-navigation/native';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import {
  useAuth,
} from '../hooks/useAuth';

import StartupSplash
  from '../screens/auth/StartupSplash';

import RoleSelectionScreen
  from '../screens/auth/RoleSelectionScreen';

import ParentLogin
  from '../screens/auth/ParentLogin';

import TeacherLoginScreen
  from '../screens/auth/TeacherLoginScreen';

import DriverLogin
  from '../screens/auth/DriverLogin';

import AdminLogin
  from '../screens/auth/AdminLogin';

import ParentNavigator
  from './ParentNavigator';

import TeacherNavigator
  from './TeacherNavigator';

import DriverNavigator
  from './DriverNavigator';

import AdminNavigator
  from './AdminNavigator';

import {
  flushPendingNotificationNavigation,
  navigationRef,
} from './navigationRef';

const Stack =
  createNativeStackNavigator();

/* -------------------------------------------------------------------------- */
/* Loading                                                                    */
/* -------------------------------------------------------------------------- */

function LoadingScreen() {
  return (
    <View
      style={
        styles.loading
      }
    >
      <ActivityIndicator
        size="large"
        color="#F7B83A"
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Navigator                                                                  */
/* -------------------------------------------------------------------------- */

export default function RootNavigator() {
  const {
    user,
    loading,
  } = useAuth();

  const [
    splashFinished,
    setSplashFinished,
  ] =
    useState(false);

  const finishSplash =
    useCallback(
      () => {
        setSplashFinished(
          true
        );
      },
      []
    );

  if (
    !splashFinished
  ) {
    return (
      <StartupSplash
        duration={
          4500
        }
        onFinish={
          finishSplash
        }
      />
    );
  }

  if (
    loading
  ) {
    return (
      <LoadingScreen />
    );
  }

  return (
    <NavigationContainer
      ref={
        navigationRef
      }
      onReady={() => {
        flushPendingNotificationNavigation();
      }}
    >
      {!user ? (
        <Stack.Navigator
          initialRouteName="RoleSelection"
          screenOptions={{
            headerShown:
              false,

            animation:
              'fade',

            contentStyle: {
              backgroundColor:
                '#F5F8FB',
            },
          }}
        >
          <Stack.Screen
            name="RoleSelection"
            component={
              RoleSelectionScreen
            }
          />

          <Stack.Screen
            name="ParentLogin"
            component={
              ParentLogin
            }
            options={{
              animation:
                'slide_from_right',
            }}
          />

          <Stack.Screen
            name="TeacherLogin"
            component={
              TeacherLoginScreen
            }
            options={{
              animation:
                'slide_from_right',
            }}
          />

          <Stack.Screen
            name="DriverLogin"
            component={
              DriverLogin
            }
            options={{
              animation:
                'slide_from_right',
            }}
          />

          <Stack.Screen
            name="AdminLogin"
            component={
              AdminLogin
            }
            options={{
              animation:
                'slide_from_right',
            }}
          />
        </Stack.Navigator>
      ) : user.role ===
        'parent' ? (
        <ParentNavigator />
      ) : user.role ===
        'teacher' ? (
        <TeacherNavigator />
      ) : user.role ===
        'driver' ? (
        <DriverNavigator />
      ) : (
        <AdminNavigator />
      )}
    </NavigationContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles =
  StyleSheet.create({
    loading: {
      flex:
        1,

      justifyContent:
        'center',

      alignItems:
        'center',

      backgroundColor:
        '#F5F8FB',
    },
  });