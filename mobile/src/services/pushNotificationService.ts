import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import {
  Platform,
} from 'react-native';

import {
  supabase,
} from '../lib/supabase';

import {
  openRoleNotifications,
} from '../navigation/navigationRef';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const PUSH_TOKEN_KEY =
  'smart_school_bus_expo_push_token_v2';

const PUSH_DEVICE_ID_KEY =
  'smart_school_bus_push_device_id_v2';

let presentationConfigured =
  false;

const ANDROID_NOTIFICATION_CHANNEL_ID =
  'smart-school-bus-default';

const ANDROID_NOTIFICATION_CHANNEL_NAME =
  'Smart School Bus';

async function ensureAndroidNotificationChannel() {
  if (
    Platform.OS !==
    'android'
  ) {
    return;
  }

  await Notifications
    .setNotificationChannelAsync(
      ANDROID_NOTIFICATION_CHANNEL_ID,
      {
        name:
          ANDROID_NOTIFICATION_CHANNEL_NAME,

        description:
          'School bus trips, alerts, attendance, and school notifications.',

        importance:
          Notifications.AndroidImportance.MAX,

        sound:
          'default',

        enableVibrate:
          true,

        vibrationPattern: [
          0,
          250,
          250,
          250,
        ],

        showBadge:
          true,

        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,

        bypassDnd:
          false,
      }
    );
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type SupportedPushRole =
  | 'parent'
  | 'teacher'
  | 'driver'
  | 'admin';

export type PushIdentity = {
  id?: string | null;
  role?: string | null;

  full_name?: string | null;
  username?: string | null;

  school_id?: string | null;
  route_id?: string | null;
  bus_id?: string | null;

  raw?: Record<string, any> | null;
};

export type PushRegistrationResult = {
  token: string | null;

  permission:
    | Notifications.PermissionStatus
    | null;

  role?: SupportedPushRole | null;

  linkedId?: string | null;

  saved?: boolean;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isUuid(
  value: unknown
): value is string {
  if (
    typeof value !==
    'string'
  ) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function uuidOrNull(
  value: unknown
) {
  return isUuid(value)
    ? value.trim()
    : null;
}

function normalizeRole(
  value: unknown
): SupportedPushRole | null {
  const role =
    String(
      value ?? ''
    )
      .trim()
      .toLowerCase();

  if (
    role === 'parent'
  ) {
    return 'parent';
  }

  if (
    role === 'teacher'
  ) {
    return 'teacher';
  }

  if (
    role === 'driver'
  ) {
    return 'driver';
  }

  if (
    [
      'admin',
      'school_admin',
      'super_admin',
    ].includes(role)
  ) {
    return 'admin';
  }

  return null;
}

function projectId() {
  return (
    Constants.expoConfig
      ?.extra
      ?.eas
      ?.projectId ??
    Constants.easConfig
      ?.projectId ??
    null
  );
}

function appVersion() {
  return (
    Constants.expoConfig
      ?.version ??
    null
  );
}

function identityName(
  user: PushIdentity
) {
  return (
    user.full_name ??
    user.raw?.full_name ??
    user.raw?.name ??
    user.username ??
    user.raw?.username ??
    null
  );
}

function identitySchoolId(
  user: PushIdentity
) {
  return uuidOrNull(
    user.school_id ??
    user.raw?.school_id
  );
}

function identityRouteId(
  user: PushIdentity
) {
  return uuidOrNull(
    user.route_id ??
    user.raw?.route_id
  );
}

function identityBusId(
  user: PushIdentity
) {
  return uuidOrNull(
    user.bus_id ??
    user.raw?.bus_id
  );
}

function identityAuthUserId(
  user: PushIdentity,
  role: SupportedPushRole
) {
  /*
   * Admin profile.id هو auth.uid عندك.
   * PIN users غالبًا user_id عندهم منفصل، لذلك نستخدم
   * auth_user_id فقط إن كان موجودًا فعلًا.
   */

  if (
    role === 'admin' &&
    isUuid(user.id)
  ) {
    return user.id;
  }

  return uuidOrNull(
    user.raw?.auth_user_id
  );
}

async function getOrCreateDeviceId() {
  const current =
    await SecureStore.getItemAsync(
      PUSH_DEVICE_ID_KEY
    );

  if (current) {
    return current;
  }

  const created =
    [
      Platform.OS,
      Date.now(),
      Math.random()
        .toString(36)
        .slice(2, 12),
    ].join('-');

  await SecureStore.setItemAsync(
    PUSH_DEVICE_ID_KEY,
    created
  );

  return created;
}

/* -------------------------------------------------------------------------- */
/* Notification presentation                                                  */
/* -------------------------------------------------------------------------- */

export function configurePushNotificationPresentation() {
  if (
    presentationConfigured
  ) {
    return;
  }

  presentationConfigured =
    true;

  Notifications.setNotificationHandler({
    handleNotification:
      async () => ({
        shouldShowBanner:
          true,

        shouldShowList:
          true,

        shouldPlaySound:
          true,

        shouldSetBadge:
          true,
      }),
  });
}

/* -------------------------------------------------------------------------- */
/* Unified token registration                                                 */
/* -------------------------------------------------------------------------- */

async function saveUnifiedPushToken(
  user: PushIdentity,
  expoToken: string
) {
  const role =
    normalizeRole(
      user.role
    );

  const linkedId =
    uuidOrNull(
      user.id
    );

  if (
    !role ||
    !linkedId
  ) {
    throw new Error(
      `Invalid push identity. role=${String(
        user.role
      )} id=${String(
        user.id
      )}`
    );
  }

  const deviceId =
    await getOrCreateDeviceId();

  const args = {
    p_user_id:
      identityAuthUserId(
        user,
        role
      ),

    p_linked_id:
      linkedId,

    p_user_role:
      role,

    p_user_name:
      identityName(
        user
      ),

    p_school_id:
      identitySchoolId(
        user
      ),

    p_route_id:
      identityRouteId(
        user
      ),

    p_bus_id:
      identityBusId(
        user
      ),

    p_expo_push_token:
      expoToken,

    p_native_push_token:
      null,

    p_device_id:
      deviceId,

    p_platform:
      Platform.OS,

    p_app_version:
      appVersion(),
  };

  console.log(
    '[push] saving unified token:',
    {
      role,
      linkedId,
      schoolId:
        args.p_school_id,
      routeId:
        args.p_route_id,
      busId:
        args.p_bus_id,
      platform:
        args.p_platform,
    }
  );

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'upsert_push_token',
      args
    );

  if (error) {
    console.log(
      '[push] upsert_push_token ERROR:',
      {
        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint,

        code:
          error.code,

        role,

        linkedId,
      }
    );

    throw error;
  }

  const result =
    data as
      | Record<
          string,
          any
        >
      | null;

  if (
    result?.ok === false
  ) {
    throw new Error(
      String(
        result.error ??
        'Push token save failed.'
      )
    );
  }

  console.log(
    '[push] unified token saved:',
    result
  );

  /*
   * Compatibility مع النظام القديم.
   * drivers ما زالت Edge Function تستخدمه كـ fallback.
   */
  if (
    role === 'driver'
  ) {
    const {
      error:
        driverError,
    } =
      await supabase
        .from('drivers')
        .update({
          expo_push_token:
            expoToken,

          push_enabled:
            true,

          push_updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          'id',
          linkedId
        );

    if (
      driverError
    ) {
      console.log(
        '[push] drivers compatibility:',
        driverError.message
      );
    }
  }

  /*
   * parents عندك يحتوي expo_push_token بالفعل.
   */
  if (
    role === 'parent'
  ) {
    const {
      error:
        parentError,
    } =
      await supabase
        .from('parents')
        .update({
          expo_push_token:
            expoToken,
        })
        .eq(
          'id',
          linkedId
        );

    if (
      parentError
    ) {
      console.log(
        '[push] parents compatibility:',
        parentError.message
      );
    }
  }

  /*
   * teachers لا يوجد عنده expo_push_token في schema الحالية،
   * لذلك يعتمد على user_push_tokens فقط.
   *
   * Admin كذلك يعتمد على user_push_tokens.
   */

  return {
    role,
    linkedId,
    result,
  };
}

/* -------------------------------------------------------------------------- */
/* Register                                                                   */
/* -------------------------------------------------------------------------- */

export async function registerForPushNotifications(
  user?: PushIdentity | null
): Promise<PushRegistrationResult> {
  configurePushNotificationPresentation();

  try {
    await ensureAndroidNotificationChannel();
  } catch (
    error
  ) {
    console.log(
      '[push] Android channel setup failed:',
      error
    );
  }

  if (
    !user?.id ||
    !user?.role
  ) {
    return {
      token:
        null,

      permission:
        null,

      role:
        null,

      linkedId:
        null,

      saved:
        false,
    };
  }

  const role =
    normalizeRole(
      user.role
    );

  const linkedId =
    uuidOrNull(
      user.id
    );

  console.log(
    '[push] current user:',
    {
      id:
        user.id,

      role:
        user.role,

      normalizedRole:
        role,

      school_id:
        user.school_id ??
        user.raw?.school_id ??
        null,

      route_id:
        user.route_id ??
        user.raw?.route_id ??
        null,

      bus_id:
        user.bus_id ??
        user.raw?.bus_id ??
        null,

      auth_user_id:
        user.raw?.auth_user_id ??
        null,
    }
  );

  if (
    !role ||
    !linkedId
  ) {
    console.log(
      '[push] unsupported identity:',
      {
        role:
          user.role,

        id:
          user.id,
      }
    );

    return {
      token:
        null,

      permission:
        null,

      role,
      linkedId,
      saved:
        false,
    };
  }

  const current =
    await Notifications
      .getPermissionsAsync();

  let status =
    current.status;

  if (
    status !==
    'granted'
  ) {
    const requested =
      await Notifications
        .requestPermissionsAsync();

    status =
      requested.status;
  }

  if (
    status !==
    'granted'
  ) {
    console.log(
      '[push] permission not granted:',
      status
    );

    return {
      token:
        null,

      permission:
        status,

      role,

      linkedId,

      saved:
        false,
    };
  }

  const easProjectId =
    projectId();

  if (
    !easProjectId
  ) {
    console.log(
      '[push] EAS projectId is missing.'
    );

    return {
      token:
        null,

      permission:
        status,

      role,

      linkedId,

      saved:
        false,
    };
  }

  try {
    const response =
      await Notifications
        .getExpoPushTokenAsync({
          projectId:
            easProjectId,
        });

    const token =
      response.data;

    await SecureStore
      .setItemAsync(
        PUSH_TOKEN_KEY,
        token
      );

    const saved =
      await saveUnifiedPushToken(
        user,
        token
      );

    console.log(
      '[push] Expo token ready:',
      token
    );

    console.log(
      '[push] registration complete:',
      {
        role:
          saved.role,

        linkedId:
          saved.linkedId,
      }
    );

    return {
      token,

      permission:
        status,

      role:
        saved.role,

      linkedId:
        saved.linkedId,

      saved:
        true,
    };
  } catch (
    error: any
  ) {
    console.log(
      '[push] registration FAILED:',
      {
        message:
          error?.message ??
          String(error),

        role,

        linkedId,
      }
    );

    return {
      token:
        null,

      permission:
        status,

      role,

      linkedId,

      saved:
        false,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Notification tap                                                          */
/* -------------------------------------------------------------------------- */

function pushData(
  response:
    Notifications.NotificationResponse
) {
  return (
    response.notification
      .request.content
      .data as
        | Record<
            string,
            any
          >
        | undefined
  );
}

function handleNotificationResponse(
  response:
    Notifications.NotificationResponse
) {
  const data =
    pushData(
      response
    ) ?? {};

  const notificationId =
    data.notification_id ??
    data.notificationId ??
    data.id ??
    null;

  const role =
    normalizeRole(
      data.recipient_role ??
      data.user_role ??
      data.role
    );

  const screen =
    String(
      data.screen ?? ''
    );

  let resolvedRole =
    role;

  if (
    !resolvedRole
  ) {
    if (
      screen ===
      'ParentNotifications'
    ) {
      resolvedRole =
        'parent';
    } else if (
      screen ===
      'TeacherNotifications'
    ) {
      resolvedRole =
        'teacher';
    } else if (
      screen ===
      'DriverNotifications'
    ) {
      resolvedRole =
        'driver';
    } else if (
      screen ===
      'AdminNotifications'
    ) {
      resolvedRole =
        'admin';
    }
  }

  if (
    !resolvedRole
  ) {
    console.log(
      '[push] notification tap has no role:',
      data
    );

    return;
  }

  openRoleNotifications(
    resolvedRole,
    notificationId
      ? String(
          notificationId
        )
      : null
  );
}

export function attachPushNotificationListeners() {
  const responseSubscription =
    Notifications
      .addNotificationResponseReceivedListener(
        handleNotificationResponse
      );

  return () => {
    responseSubscription
      .remove();
  };
}

export async function openLastNotificationResponseIfAny() {
  try {
    const response =
      await Notifications
        .getLastNotificationResponseAsync();

    if (
      response
    ) {
      handleNotificationResponse(
        response
      );
    }
  } catch (
    error
  ) {
    console.log(
      '[push] last response:',
      error
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Logout                                                                     */
/* -------------------------------------------------------------------------- */

export async function deactivatePushForUser(
  user?: PushIdentity | null
) {
  if (
    !user?.id
  ) {
    return;
  }

  const role =
    normalizeRole(
      user.role
    );

  const linkedId =
    uuidOrNull(
      user.id
    );

  if (
    !role ||
    !linkedId
  ) {
    return;
  }

  const deviceId =
    await SecureStore
      .getItemAsync(
        PUSH_DEVICE_ID_KEY
      );

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'deactivate_push_token',
      {
        p_user_role:
          role,

        p_linked_id:
          linkedId,

        p_device_id:
          deviceId ??
          null,
      }
    );

  if (
    error
  ) {
    console.log(
      '[push] deactivate error:',
      error
    );

    return;
  }

  console.log(
    '[push] token deactivated:',
    data
  );
}

/* -------------------------------------------------------------------------- */
/* Saved token                                                                */
/* -------------------------------------------------------------------------- */

export async function getSavedExpoPushToken() {
  return SecureStore
    .getItemAsync(
      PUSH_TOKEN_KEY
    );
}

/* -------------------------------------------------------------------------- */
/* Local test                                                                 */
/* -------------------------------------------------------------------------- */

export async function presentNotificationLocally(
  args: {
    role:
      SupportedPushRole;

    notificationId?:
      string | null;

    title:
      string;

    body:
      string;

    data?:
      Record<
        string,
        any
      >;
  }
) {
  const screen =
    args.role ===
      'parent'
      ? 'ParentNotifications'
      : args.role ===
        'teacher'
      ? 'TeacherNotifications'
      : args.role ===
        'admin'
      ? 'AdminNotifications'
      : 'DriverNotifications';

  await Notifications
    .scheduleNotificationAsync({
      content: {
        title:
          args.title,

        body:
          args.body,

        sound:
          'default',

        data: {
          ...(
            args.data ??
            {}
          ),

          notification_id:
            args.notificationId ??
            undefined,

          recipient_role:
            args.role,

          screen,
        },
      },

      trigger:
        Platform.OS === 'android'
          ? {
              type:
                Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds:
                1,
              channelId:
                ANDROID_NOTIFICATION_CHANNEL_ID,
            }
          : null,
    });
}