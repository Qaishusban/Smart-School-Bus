import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as SecureStore from 'expo-secure-store';

import {
  Language,
  TranslationKey,
  translations,
} from './translations';

const LANGUAGE_KEY =
  'smart_bus_language_v1';

interface LanguageContextValue {
  language: Language;
  isRTL: boolean;

  direction:
    | 'row'
    | 'row-reverse';

  textAlign:
    | 'left'
    | 'right';

  t: (
    key: TranslationKey
  ) => string;

  setLanguage: (
    language: Language
  ) => Promise<void>;
}

const LanguageContext =
  createContext<
    LanguageContextValue | undefined
  >(undefined);

export function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [language, setLanguageState] =
    useState<Language>('ar');

  useEffect(() => {
    async function restore() {
      const saved =
        await SecureStore.getItemAsync(
          LANGUAGE_KEY
        );

      if (
        saved === 'ar' ||
        saved === 'en'
      ) {
        setLanguageState(saved);
      }
    }

    restore();
  }, []);

  const setLanguage = async (
    nextLanguage: Language
  ) => {
    setLanguageState(nextLanguage);

    await SecureStore.setItemAsync(
      LANGUAGE_KEY,
      nextLanguage
    );
  };

  const isRTL =
    language === 'ar';

  const value = useMemo(
    () => ({
      language,

      isRTL,

      direction: isRTL
        ? ('row-reverse' as const)
        : ('row' as const),

      textAlign: isRTL
        ? ('right' as const)
        : ('left' as const),

      t: (
        key: TranslationKey
      ) =>
        translations[language][key] ??
        key,

      setLanguage,
    }),
    [language, isRTL]
  );

  return (
    <LanguageContext.Provider
      value={value}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const value =
    useContext(LanguageContext);

  if (!value) {
    throw new Error(
      'useLanguage must be used inside LanguageProvider'
    );
  }

  return value;
}
