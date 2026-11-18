import * as SecureStore from 'expo-secure-store';

import {
  StoredAdminSession,
  StoredPinSession,
} from '../types/auth';

const SESSION_KEY = 'smart_school_bus_session_v1';

export type StoredSession =
  | {
      kind: 'pin';
      data: StoredPinSession;
    }
  | {
      kind: 'admin';
      data: StoredAdminSession;
    };

export async function savePinSession(
  session: StoredPinSession
) {
  const payload: StoredSession = {
    kind: 'pin',
    data: session,
  };

  await SecureStore.setItemAsync(
    SESSION_KEY,
    JSON.stringify(payload)
  );
}

export async function saveAdminSession(
  session: StoredAdminSession
) {
  const payload: StoredSession = {
    kind: 'admin',
    data: session,
  };

  await SecureStore.setItemAsync(
    SESSION_KEY,
    JSON.stringify(payload)
  );
}

export async function loadStoredSession():
  Promise<StoredSession | null> {
  try {
    const value = await SecureStore.getItemAsync(SESSION_KEY);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as StoredSession;
  } catch {
    return null;
  }
}

export async function clearStoredSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
