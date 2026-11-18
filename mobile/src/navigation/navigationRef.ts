import {
  CommonActions,
  createNavigationContainerRef,
} from '@react-navigation/native';

export type NotificationRole =
  | 'parent'
  | 'teacher'
  | 'driver'
  | 'admin';

export const navigationRef =
  createNavigationContainerRef<any>();

type PendingNotification = {
  role:
    NotificationRole;

  notificationId:
    string | null;
};

let pendingNotification:
  PendingNotification | null =
  null;

/* -------------------------------------------------------------------------- */
/* Role normalization                                                         */
/* -------------------------------------------------------------------------- */

function normalizeNotificationRole(
  role: unknown
): NotificationRole | null {
  const value =
    String(
      role ?? ''
    )
      .trim()
      .toLowerCase();

  if (
    value === 'parent'
  ) {
    return 'parent';
  }

  if (
    value === 'teacher'
  ) {
    return 'teacher';
  }

  if (
    value === 'driver'
  ) {
    return 'driver';
  }

  if (
    [
      'admin',
      'school_admin',
      'super_admin',
    ].includes(
      value
    )
  ) {
    return 'admin';
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 */
/* -------------------------------------------------------------------------- */

export function openRoleNotifications(
  inputRole:
    NotificationRole | string,
  notificationId?:
    string | null
) {
  const role =
    normalizeNotificationRole(
      inputRole
    );

  if (!role) {
    console.log(
      '[navigation] invalid notification role:',
      inputRole
    );

    return;
  }

  const id =
    notificationId
      ? String(
          notificationId
        )
      : null;

  if (
    !navigationRef.isReady()
  ) {
    pendingNotification = {
      role,
      notificationId:
        id,
    };

    return;
  }

  console.log(
    '[navigation] opening notification:',
    {
      role,
      notificationId:
        id,
    }
  );

  /*
   * Parent
   */
  if (
    role === 'parent'
  ) {
    navigationRef.dispatch(
      CommonActions.navigate({
        name:
          'ParentTabs',

        params: {
          screen:
            'ParentNotifications',

          params:
            id
              ? {
                  notificationId:
                    id,
                }
              : undefined,
        },
      })
    );

    return;
  }

  /*
   * Teacher
   */
  if (
    role === 'teacher'
  ) {
    navigationRef.dispatch(
      CommonActions.navigate({
        name:
          'TeacherTabs',

        params: {
          screen:
            'TeacherNotifications',

          params:
            id
              ? {
                  notificationId:
                    id,
                }
              : undefined,
        },
      })
    );

    return;
  }

  /*
   * Driver
   */
  if (
    role === 'driver'
  ) {
    navigationRef.dispatch(
      CommonActions.navigate({
        name:
          'DriverTabs',

        params: {
          screen:
            'DriverNotifications',

          params:
            id
              ? {
                  notificationId:
                    id,
                }
              : undefined,
        },
      })
    );

    return;
  }

  /*
   * Admin
   */
  navigationRef.dispatch(
    CommonActions.navigate({
      name:
        'AdminTabs',

      params: {
        screen:
          'AdminNotifications',

        params:
          id
            ? {
                notificationId:
                  id,
              }
            : undefined,
      },
    })
  );
}

/* -------------------------------------------------------------------------- */
/* Compatibility                                                              */
/* -------------------------------------------------------------------------- */

export function openDriverNotifications(
  notificationId?:
    string | null
) {
  openRoleNotifications(
    'driver',
    notificationId
  );
}

export function openParentNotifications(
  notificationId?:
    string | null
) {
  openRoleNotifications(
    'parent',
    notificationId
  );
}

export function openTeacherNotifications(
  notificationId?:
    string | null
) {
  openRoleNotifications(
    'teacher',
    notificationId
  );
}

export function openAdminNotifications(
  notificationId?:
    string | null
) {
  openRoleNotifications(
    'admin',
    notificationId
  );
}

/* -------------------------------------------------------------------------- */
/* Pending navigation                                                         */
/* -------------------------------------------------------------------------- */

export function flushPendingNotificationNavigation() {
  if (
    !navigationRef.isReady() ||
    !pendingNotification
  ) {
    return;
  }

  const pending =
    pendingNotification;

  pendingNotification =
    null;

  openRoleNotifications(
    pending.role,
    pending.notificationId
  );
}

export const flushPendingDriverNotificationNavigation =
  flushPendingNotificationNavigation;