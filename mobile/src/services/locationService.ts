import * as Location from 'expo-location';

export type DriverLocationPoint = {
  latitude: number;
  longitude: number;
  heading: number | null;
  accuracy: number | null;
  speed: number | null;
};

export async function requestDriverLocationPermission() {
  const foreground =
    await Location.requestForegroundPermissionsAsync();

  if (
    foreground.status !==
    'granted'
  ) {
    return {
      granted: false,
      backgroundGranted: false,
    };
  }

  let backgroundGranted =
    false;

  try {
    const background =
      await Location.requestBackgroundPermissionsAsync();

    backgroundGranted =
      background.status ===
      'granted';
  } catch (error) {
    console.log(
      '[location] background permission:',
      error
    );
  }

  return {
    granted: true,
    backgroundGranted,
  };
}

export async function getCurrentDriverLocation():
  Promise<DriverLocationPoint | null> {
  const servicesEnabled =
    await Location.hasServicesEnabledAsync();

  if (!servicesEnabled) {
    return null;
  }

  const location =
    await Location.getCurrentPositionAsync({
      accuracy:
        Location.Accuracy.High,
    });

  return {
    latitude:
      location.coords.latitude,

    longitude:
      location.coords.longitude,

    heading:
      typeof location.coords.heading ===
        'number'
        ? location.coords.heading
        : null,

    accuracy:
      typeof location.coords.accuracy ===
        'number'
        ? location.coords.accuracy
        : null,

    speed:
      typeof location.coords.speed ===
        'number'
        ? location.coords.speed
        : null,
  };
}

export async function watchDriverLocation(
  callback: (
    location: DriverLocationPoint
  ) => void
) {
  const subscription =
    await Location.watchPositionAsync(
      {
        accuracy:
          Location.Accuracy.High,

        distanceInterval:
          10,

        timeInterval:
          5000,

        mayShowUserSettingsDialog:
          true,
      },

      (location) => {
        callback({
          latitude:
            location.coords.latitude,

          longitude:
            location.coords.longitude,

          heading:
            typeof location.coords.heading ===
              'number'
              ? location.coords.heading
              : null,

          accuracy:
            typeof location.coords.accuracy ===
              'number'
              ? location.coords.accuracy
              : null,

          speed:
            typeof location.coords.speed ===
              'number'
              ? location.coords.speed
              : null,
        });
      }
    );

  return () => {
    subscription.remove();
  };
}