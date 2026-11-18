import { brand } from './colors';

export const lightTheme = {
  dark: false,

  colors: {
    primary: brand.navy,
    primarySoft: '#EAF0F6',

    accent: brand.gold,

    background: '#F4F7FB',
    surface: '#FFFFFF',
    surface2: '#F8FAFC',

    text: '#102A43',
    textSecondary: '#627D98',
    muted: '#829AB1',

    border: '#E3EAF2',

    success: brand.success,
    warning: brand.warning,
    danger: brand.danger,
    info: brand.info,

    tabBar: '#FFFFFF',
    tabInactive: '#829AB1',

    overlay: 'rgba(7, 26, 44, 0.45)',
  },

  radius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 22,
    xl: 28,
    round: 999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
    xxxl: 36,
  },
};

export const darkTheme = {
  ...lightTheme,

  dark: true,

  colors: {
    ...lightTheme.colors,

    primary: '#F4B942',
    primarySoft: '#172A3D',

    accent: '#F4B942',

    background: '#07131F',
    surface: '#0E2030',
    surface2: '#132A3D',

    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    muted: '#8CA0B3',

    border: '#20384C',

    tabBar: '#0B1B29',
    tabInactive: '#7890A4',

    overlay: 'rgba(0,0,0,0.65)',
  },
};

export type AppTheme = typeof lightTheme;
export type ThemeMode = 'light' | 'dark' | 'system';
