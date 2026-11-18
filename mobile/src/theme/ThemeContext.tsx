import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Appearance,
  ColorSchemeName,
} from 'react-native';

import * as SecureStore from 'expo-secure-store';

import {
  AppTheme,
  darkTheme,
  lightTheme,
  ThemeMode,
} from './theme';

const THEME_KEY = 'smart_bus_theme_v1';

interface ThemeContextValue {
  theme: AppTheme;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext =
  createContext<ThemeContextValue | undefined>(
    undefined
  );

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const systemScheme: ColorSchemeName =
    Appearance.getColorScheme();

  const [mode, setModeState] =
    useState<ThemeMode>('system');

  const [systemMode, setSystemMode] =
    useState<ColorSchemeName>(systemScheme);

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY).then(
      (saved) => {
        if (
          saved === 'light' ||
          saved === 'dark' ||
          saved === 'system'
        ) {
          setModeState(saved);
        }
      }
    );

    const subscription =
      Appearance.addChangeListener(
        ({ colorScheme }) => {
          setSystemMode(colorScheme);
        }
      );

    return () => subscription.remove();
  }, []);

  const setMode = async (
    nextMode: ThemeMode
  ) => {
    setModeState(nextMode);

    await SecureStore.setItemAsync(
      THEME_KEY,
      nextMode
    );
  };

  const isDark =
    mode === 'dark' ||
    (mode === 'system' &&
      systemMode === 'dark');

  const theme = isDark
    ? darkTheme
    : lightTheme;

  const value = useMemo(
    () => ({
      theme,
      mode,
      isDark,
      setMode,
    }),
    [theme, mode, isDark]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error(
      'useAppTheme must be used inside ThemeProvider'
    );
  }

  return value;
}
