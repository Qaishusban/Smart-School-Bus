import { supabase } from '../lib/supabase';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as SecureStore from 'expo-secure-store';

import {
  loginAdmin as loginAdminService,
  loginWithPin,
  logoutAdmin,
} from '../services/authService';

import {
  checkSchoolAccess,
  schoolAccessErrorCode,
  subscribeToSchoolAccess,
} from '../services/schoolAccessService';

import {
  AppUser,
  PinRole,
} from '../types/auth';

export type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;

  signInPin: (
    role: PinRole,
    username: string,
    pin: string,
    remember?: boolean
  ) => Promise<void>;

  signInAdmin: (
    email: string,
    password: string,
    remember?: boolean
  ) => Promise<void>;

  signOut: () => Promise<void>;
};

type StoredPinSession = {
  kind: 'pin';
  token: string;
  user: AppUser;
  remember: boolean;
};

type StoredAdminSession = {
  kind: 'admin';
  user: AppUser;
  remember: boolean;
};

type StoredSession =
  | StoredPinSession
  | StoredAdminSession;

const STORAGE_KEY =
  'smart_school_bus_session_v1';

const ACCESS_RECHECK_MS = 30_000;

export const AuthContext =
  createContext<AuthContextValue | null>(
    null
  );

async function saveStoredSession(
  value: StoredSession
) {
  try {
    await SecureStore.setItemAsync(
      STORAGE_KEY,
      JSON.stringify(value)
    );
  } catch (error) {
    console.log(
      'Auth save session error:',
      error
    );
  }
}

async function removeStoredSession() {
  try {
    await SecureStore.deleteItemAsync(
      STORAGE_KEY
    );
  } catch (error) {
    console.log(
      'Auth remove session error:',
      error
    );
  }
}

async function readStoredSession():
  Promise<StoredSession | null> {
  try {
    const raw =
      await SecureStore.getItemAsync(
        STORAGE_KEY
      );

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(
        raw
      ) as StoredSession;
    } catch (error) {
      console.log(
        'Auth parse session error:',
        error
      );

      await removeStoredSession();

      return null;
    }
  } catch (error) {
    console.log(
      'Auth read session error:',
      error
    );

    return null;
  }
}

function isAdminRole(
  role?: AppUser['role']
) {
  return (
    role === 'admin' ||
    role === 'school_admin' ||
    role === 'super_admin'
  );
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [
    user,
    setUser,
  ] =
    useState<AppUser | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const userRef =
    useRef<AppUser | null>(
      null
    );

  const forcedLogoutRef =
    useRef(false);

  useEffect(() => {
    userRef.current = user;

    if (user) {
      forcedLogoutRef.current = false;
    }
  }, [user]);

  const clearSession =
    useCallback(
      async (
        targetUser?: AppUser | null
      ) => {
        const current =
          targetUser ??
          userRef.current;

        if (isAdminRole(current?.role)) {
          try {
            await logoutAdmin();
          } catch (error) {
            console.log(
              'Admin sign out error:',
              error
            );
          }
        }

        await removeStoredSession();

        userRef.current = null;
        setUser(null);
      },
      []
    );

  const forceLogoutForAccess =
    useCallback(
      async (
        targetUser: AppUser,
        reason: string
      ) => {
        if (forcedLogoutRef.current) {
          return;
        }

        forcedLogoutRef.current = true;

        console.log(
          'School access revoked:',
          reason
        );

        await clearSession(
          targetUser
        );
      },
      [clearSession]
    );

  const verifyAccess =
    useCallback(
      async (
        targetUser: AppUser,
        forceLogout = false
      ) => {
        const access =
          await checkSchoolAccess(
            targetUser
          );

        if (!access.allowed) {
          if (forceLogout) {
            await forceLogoutForAccess(
              targetUser,
              access.reason
            );
          }

          throw new Error(
            schoolAccessErrorCode(
              access
            )
          );
        }

        return access;
      },
      [forceLogoutForAccess]
    );

  useEffect(() => {
    let mounted = true;

    const restoreSession =
      async () => {
        try {
          const stored =
            await readStoredSession();

          if (!stored) {
            return;
          }

          if (
            stored.remember !==
            true
          ) {
            await removeStoredSession();
            return;
          }

          try {
            await verifyAccess(
              stored.user,
              false
            );
          } catch (error) {
            console.log(
              'Stored session access denied:',
              error
            );

            if (
              isAdminRole(
                stored.user.role
              )
            ) {
              try {
                await logoutAdmin();
              } catch {
                // Best effort.
              }
            }

            await removeStoredSession();
            return;
          }

          if (
            mounted &&
            stored.user
          ) {
            if (isAdminRole(stored.user.role)) {
              const { data, error } =
                await supabase.auth.getUser();

              if (
                error ||
                !data.user ||
                data.user.id !== stored.user.id
              ) {
                await removeStoredSession();
                return;
              }
            }

            userRef.current =
              stored.user;

            setUser(
              stored.user
            );
          }
        } catch (error) {
          console.log(
            'Auth restore error:',
            error
          );
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    void restoreSession();

    return () => {
      mounted = false;
    };
  }, [verifyAccess]);

  const signInPin =
    useCallback(
      async (
        role: PinRole,
        username: string,
        pin: string,
        remember = true
      ) => {
        const cleanUsername =
          username.trim();

        const cleanPin =
          pin.trim();

        if (!cleanUsername) {
          throw new Error(
            'Username is required'
          );
        }

        if (!cleanPin) {
          throw new Error(
            'PIN is required'
          );
        }

        const result =
          await loginWithPin(
            role,
            cleanUsername,
            cleanPin
          );

        if (!result?.user) {
          throw new Error(
            'Login did not return a valid user'
          );
        }

        await verifyAccess(
          result.user,
          false
        );

        userRef.current =
          result.user;

        setUser(
          result.user
        );

        if (remember) {
          await saveStoredSession({
            kind: 'pin',
            token:
              result.token,
            user:
              result.user,
            remember: true,
          });
        } else {
          await removeStoredSession();
        }
      },
      [verifyAccess]
    );

  const signInAdmin =
    useCallback(
      async (
        email: string,
        password: string,
        remember = true
      ) => {
        const cleanEmail =
          email
            .trim()
            .toLowerCase();

        if (!cleanEmail) {
          throw new Error(
            'Email is required'
          );
        }

        if (!password) {
          throw new Error(
            'Password is required'
          );
        }

        const nextUser =
          await loginAdminService(
            cleanEmail,
            password
          );

        if (!nextUser) {
          throw new Error(
            'Admin login did not return a valid user'
          );
        }

        await verifyAccess(
          nextUser,
          false
        );

        userRef.current =
          nextUser;

        setUser(
          nextUser
        );

        if (remember) {
          await saveStoredSession({
            kind: 'admin',
            user:
              nextUser,
            remember: true,
          });
        } else {
          await removeStoredSession();
        }
      },
      [verifyAccess]
    );

  const signOut =
    useCallback(
      async () => {
        await clearSession(
          userRef.current
        );
      },
      [clearSession]
    );

  useEffect(() => {
    if (!user) {
      return;
    }

    if (
      user.role === 'super_admin' &&
      !user.school_id
    ) {
      return;
    }

    const schoolId =
      user.school_id;

    if (!schoolId) {
      void forceLogoutForAccess(
        user,
        'school_missing'
      );
      return;
    }

    let disposed = false;
    let checking = false;

    const checkNow =
      async () => {
        if (
          disposed ||
          checking
        ) {
          return;
        }

        checking = true;

        try {
          const access =
            await checkSchoolAccess(
              user
            );

          if (
            !disposed &&
            !access.allowed
          ) {
            await forceLogoutForAccess(
              user,
              access.reason
            );
          }
        } catch (error) {
          /*
           * Network/RLS failure must not be treated as a cancelled subscription.
           * The current session remains alive and the next realtime/poll check retries.
           */
          console.log(
            'School access recheck error:',
            error
          );
        } finally {
          checking = false;
        }
      };

    const stopRealtime =
      subscribeToSchoolAccess(
        schoolId,
        () => {
          void checkNow();
        }
      );

    const timer =
      setInterval(
        () => {
          void checkNow();
        },
        ACCESS_RECHECK_MS
      );

    void checkNow();

    return () => {
      disposed = true;
      clearInterval(timer);
      stopRealtime();
    };
  }, [
    user,
    forceLogoutForAccess,
  ]);

  const value =
    useMemo<AuthContextValue>(
      () => ({
        user,
        loading,
        signInPin,
        signInAdmin,
        signOut,
      }),
      [
        user,
        loading,
        signInPin,
        signInAdmin,
        signOut,
      ]
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth():
  AuthContextValue {
  const context =
    useContext(
      AuthContext
    );

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    );
  }

  return context;
}

export default AuthContext;
