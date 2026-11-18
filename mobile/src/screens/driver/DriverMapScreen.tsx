import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
} from '@maplibre/maplibre-react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useAuth,
} from '../../hooks/useAuth';

import {
  useAppTheme,
} from '../../theme/ThemeContext';

import {
  useLanguage,
} from '../../i18n/LanguageContext';

import {
  MAP_CONFIG,
} from '../../config/mapConfig';

import {
  getCurrentDriverLocation,
  requestDriverLocationPermission,
  watchDriverLocation,
  DriverLocationPoint,
} from '../../services/locationService';

import {
  DriverRouteStudent,
  DriverStudentStatus,
  DriverTripMode,
  createDriverIncident,
  endDriverTrip,
  getActiveTripInfo,
  getDriverRouteStudents,
  notifyStudentEta,
  notifyTripEndedParents,
  notifyTripStartedParents,
  setDriverStudentStatus,
  startDriverTrip,
  writeDriverLocation,
} from '../../services/driverTripService';

import {
  DrivingRouteResult,
  getDrivingRoute,
  getNearestDrivingIndex,
} from '../../services/routingService';

import {
  getDriverDashboard,
} from '../../services/driverService';

import {
  approvedExcuseMap,
  getApprovedDriverExcuses,
} from '../../services/driverExcuseService';

type CameraHandle =
  React.ElementRef<typeof Camera>;

const SCREEN_HEIGHT =
  Dimensions.get('window').height;

const SHEET_COLLAPSED = 205;
const SHEET_EXPANDED =
  Math.min(
    520,
    SCREEN_HEIGHT * 0.58
  );

function validCoordinate(
  lat: unknown,
  lng: unknown
) {
  const latitude =
    Number(lat);

  const longitude =
    Number(lng);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function studentPoint(
  item: DriverRouteStudent
) {
  const student =
    item.student ?? {};

  if (
    !validCoordinate(
      student.home_lat,
      student.home_lng
    )
  ) {
    return null;
  }

  return {
    latitude:
      Number(
        student.home_lat
      ),

    longitude:
      Number(
        student.home_lng
      ),
  };
}

function schoolPoint(
  school: Record<string, any> | null | undefined
) {
  if (!school) {
    return null;
  }

  const latitude =
    school.lat ??
    school.latitude ??
    school.school_lat ??
    school.location_lat ??
    school.address_lat;

  const longitude =
    school.lng ??
    school.longitude ??
    school.lon ??
    school.school_lng ??
    school.location_lng ??
    school.address_lng;

  if (!validCoordinate(latitude, longitude)) {
    return null;
  }

  return {
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
}

function studentName(
  item: DriverRouteStudent
) {
  return String(
    item.student?.full_name ??
    item.student?.name ??
    item.student?.full_name_ar ??
    item.student?.full_name_en ??
    'Student'
  );
}

function normalize(
  value: unknown
) {
  return String(
    value ?? ''
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      '_'
    );
}

function logicalStatus(
  value: unknown
):
  | 'arrived'
  | 'boarded'
  | 'absent'
  | 'delivered'
  | null {
  const status =
    normalize(value);

  if (
    [
      'picked',
      'pickup',
      'picked_up',
      'boarded',
      'on_bus',
    ].includes(status)
  ) {
    return 'boarded';
  }

  if (
    [
      'delivered',
      'dropoff',
      'dropped_off',
      'arrived_home',
    ].includes(status)
  ) {
    return 'delivered';
  }

  if (
    [
      'absent',
      'not_boarded',
      'did_not_ride',
      'no_show',
    ].includes(status)
  ) {
    return 'absent';
  }

  if (
    [
      'arrived',
      'arrival',
    ].includes(status)
  ) {
    return 'arrived';
  }

  return null;
}

function isDelivered(
  item: DriverRouteStudent
) {
  return (
    logicalStatus(
      item.latest_status
    ) === 'delivered'
  );
}

function isBoarded(
  item: DriverRouteStudent
) {
  return (
    logicalStatus(
      item.latest_status
    ) === 'boarded'
  );
}

function isAbsent(
  item: DriverRouteStudent
) {
  return (
    item.is_excluded ||
    logicalStatus(
      item.latest_status
    ) === 'absent'
  );
}

function formatDistance(
  meters?:
    | number
    | null
) {
  if (
    meters === null ||
    meters === undefined ||
    !Number.isFinite(
      meters
    )
  ) {
    return '—';
  }

  if (
    meters <
    1000
  ) {
    return `${Math.round(
      meters
    )} m`;
  }

  return `${(
    meters / 1000
  ).toFixed(1)} km`;
}

function formatEta(
  seconds?:
    | number
    | null
) {
  if (
    seconds === null ||
    seconds === undefined ||
    !Number.isFinite(
      seconds
    )
  ) {
    return '—';
  }

  return `${Math.max(
    1,
    Math.round(
      seconds / 60
    )
  )} min`;
}

function toRadians(
  value: number
) {
  return (
    value *
    Math.PI /
    180
  );
}

function directDistanceMeters(
  a: {
    latitude: number;
    longitude: number;
  },
  b: {
    latitude: number;
    longitude: number;
  }
) {
  const earthRadius =
    6371000;

  const dLat =
    toRadians(
      b.latitude -
      a.latitude
    );

  const dLng =
    toRadians(
      b.longitude -
      a.longitude
    );

  const lat1 =
    toRadians(
      a.latitude
    );

  const lat2 =
    toRadians(
      b.latitude
    );

  const h =
    Math.sin(
      dLat / 2
    ) ** 2 +
    Math.cos(lat1) *
    Math.cos(lat2) *
    Math.sin(
      dLng / 2
    ) ** 2;

  return (
    2 *
    earthRadius *
    Math.atan2(
      Math.sqrt(h),
      Math.sqrt(
        1 - h
      )
    )
  );
}

function headingDifference(a: number | null | undefined, b: number | null | undefined) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  const diff = Math.abs(x - y) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function zoomForDistance(
  meters?:
    | number
    | null
) {
  if (!meters) return 18.2;
  if (meters <= 120) return 18.7;
  if (meters <= 300) return 18.4;
  if (meters <= 700) return 18.0;
  if (meters <= 1500) return 17.6;
  if (meters <= 4000) return 17.0;
  return 16.3;
}

function automaticTripMode(
  date:
    Date = new Date()
): DriverTripMode {
  /*
   * 00:00 -> 11:59 = morning / to school
   * 12:00 -> 23:59 = evening / to home
   */
  return (
    date.getHours() < 12
      ? 'to_school'
      : 'to_home'
  );
}

function navigationCenterAhead(
  location:
    DriverLocationPoint,
  distanceMeters:
    number = 75
): [
  number,
  number
] {
  const heading =
    Number(
      location.heading
    );

  if (
    !Number.isFinite(
      heading
    )
  ) {
    return [
      location.longitude,
      location.latitude,
    ];
  }

  const earth =
    6378137;

  const bearing =
    heading *
    Math.PI /
    180;

  const lat1 =
    location.latitude *
    Math.PI /
    180;

  const lng1 =
    location.longitude *
    Math.PI /
    180;

  const angular =
    distanceMeters /
    earth;

  const lat2 =
    Math.asin(
      Math.sin(lat1) *
        Math.cos(angular) +
      Math.cos(lat1) *
        Math.sin(angular) *
        Math.cos(bearing)
    );

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) *
        Math.sin(angular) *
        Math.cos(lat1),
      Math.cos(angular) -
        Math.sin(lat1) *
        Math.sin(lat2)
    );

  return [
    lng2 *
      180 /
      Math.PI,

    lat2 *
      180 /
      Math.PI,
  ];
}

export default function DriverMapScreen({
  route,
  navigation,
}: any) {
  const responsiveMap = useResponsiveLayout();

  const cameraRef =
    useRef<CameraHandle>(
      null
    );

  const locationStopRef =
    useRef<
      (() => void) | null
    >(null);

  const routingAbortRef =
    useRef<
      AbortController | null
    >(null);

  const lastWriteRef =
    useRef(0);

  const lastNearestRef =
    useRef(0);

  const lastRoutingRef =
    useRef(0);

  const lastRouteOriginRef =
    useRef<DriverLocationPoint | null>(null);

  const lastRouteHeadingRef =
    useRef<number | null>(null);

  const autoStartHandledRef =
    useRef(false);

  const lastEtaTargetRef =
    useRef<string | null>(
      null
    );

  const autoEndingRef =
    useRef(false);

  const sheetHeight =
    useRef(
      new Animated.Value(
        SHEET_COLLAPSED
      )
    ).current;

  const [
    sheetExpanded,
    setSheetExpanded,
  ] =
    useState(false);

  const [
    now,
    setNow,
  ] =
    useState(
      new Date()
    );

  const [
    incidentVisible,
    setIncidentVisible,
  ] =
    useState(false);

  const [
    incidentReason,
    setIncidentReason,
  ] =
    useState('');

  const [
    incidentDetails,
    setIncidentDetails,
  ] =
    useState('');

  const [
    incidentSaving,
    setIncidentSaving,
  ] =
    useState(false);

  const {
    user,
  } = useAuth();

  const {
    theme,
  } = useAppTheme();

  const {
    isRTL,
    textAlign,
    direction,
  } = useLanguage();

  const params =
    route?.params ??
    {};

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    dashboard,
    setDashboard,
  ] =
    useState<any>(
      null
    );

  const [
    tripActive,
    setTripActive,
  ] =
    useState(false);

  const [
    tripMode,
    setTripMode,
  ] =
    useState<DriverTripMode>(
      automaticTripMode()
    );

  const [
    currentLocation,
    setCurrentLocation,
  ] =
    useState<
      DriverLocationPoint | null
    >(null);

  const [
    students,
    setStudents,
  ] =
    useState<
      DriverRouteStudent[]
    >([]);

  const [
    selectedStudentId,
    setSelectedStudentId,
  ] =
    useState<
      string | null
    >(null);

  const [
    nextStudentId,
    setNextStudentId,
  ] =
    useState<
      string | null
    >(null);

  const [
    drivingRoute,
    setDrivingRoute,
  ] =
    useState<
      DrivingRouteResult | null
    >(null);

  const [
    mapReady,
    setMapReady,
  ] =
    useState(false);

  const [
    starting,
    setStarting,
  ] =
    useState(false);

  const [
    ending,
    setEnding,
  ] =
    useState(false);

  const [
    studentSaving,
    setStudentSaving,
  ] =
    useState<
      string | null
    >(null);

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<
      | 'on_route'
      | 'picked'
      | 'delivered'
      | 'excused'
    >(
      'on_route'
    );

  const driverId =
    user?.id ??
    null;

  const busId =
    params.busId ??
    dashboard?.bus?.id ??
    user?.bus_id ??
    null;

  const routeId =
    params.routeId ??
    dashboard?.route?.id ??
    null;

  const schoolId =
    dashboard?.school?.id ??
    user?.school_id ??
    null;

  const busNumber =
    dashboard?.bus?.bus_number ??
    user?.bus_number ??
    null;

  const context =
    useMemo(() => {
      if (
        !driverId ||
        !busId
      ) {
        return null;
      }

      return {
        driverId,
        busId,

        schoolId:
          schoolId ??
          null,

        routeId:
          routeId ??
          null,

        tripMode,
      };
    }, [
      busId,
      driverId,
      routeId,
      schoolId,
      tripMode,
    ]);

  const loadStudents =
    useCallback(
      async (
        resolvedRouteId:
          string,
        mode:
          DriverTripMode,
        since:
          string | null
      ) => {
        const rows =
          await getDriverRouteStudents(
            resolvedRouteId,
            {
              tripMode:
                mode,

              attendanceSince:
                since,

              busId:
                busId ??
                null,
            }
          );

        const approvedExcuses = await getApprovedDriverExcuses({
          studentIds: rows.map((item) => item.student_id),
          tripMode: mode,
        });
        const excuseMap = approvedExcuseMap(approvedExcuses);
        const mergedRows = rows.map((item) => {
          const excuse = excuseMap.get(String(item.student_id));
          if (!excuse) return item;
          return {
            ...item,
            is_excluded: true,
            instruction_status: excuse.request_type === 'no_bus' ? 'no_bus' : 'absence',
            instruction_note: excuse.notes ?? (excuse.request_type === 'no_bus' ? 'Approved parent request: no bus' : 'Approved parent leave / absence'),
          };
        });

        setStudents(mergedRows);
        return mergedRows;
      },
      [
        busId,
      ]
    );

  const load =
    useCallback(
      async () => {
        if (
          !driverId
        ) {
          setLoading(
            false
          );

          return;
        }

        try {
          const result =
            await getDriverDashboard({
              driverId,

              schoolId:
                user?.school_id ??
                null,

              busId:
                params.busId ??
                user?.bus_id ??
                null,

              busNumber:
                user?.bus_number ??
                null,
            });

          setDashboard(
            result
          );

          const resolvedBusId =
            params.busId ??
            result?.bus?.id ??
            user?.bus_id ??
            null;

          const resolvedRouteId =
            params.routeId ??
            result?.route?.id ??
            null;

          const info =
            await getActiveTripInfo(
              driverId,
              resolvedBusId
            );

          setTripActive(
            info.active
          );

          if (
            info.mode
          ) {
            setTripMode(
              info.mode
            );
          }

          if (
            resolvedRouteId
          ) {
            await loadStudents(
              resolvedRouteId,

              info.mode ??
                tripMode,

              info.startedAt
            );
          }

          const permission =
            await requestDriverLocationPermission();

          if (
            permission.granted
          ) {
            const location =
              await getCurrentDriverLocation();

            if (
              location
            ) {
              setCurrentLocation(
                location
              );
            }
          }
        } catch (error) {
          console.log(
            'DriverMap load:',
            error
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        driverId,
        loadStudents,
        params.busId,
        params.routeId,
        tripMode,
        user?.bus_id,
        user?.bus_number,
        user?.school_id,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer =
      setInterval(
        () => {
          const current =
            new Date();

          setNow(
            current
          );

          if (
            !tripActive
          ) {
            setTripMode(
              automaticTripMode(
                current
              )
            );
          }
        },
        30000
      );

    return () =>
      clearInterval(
        timer
      );
  }, [
    tripActive,
  ]);

  const stopTracking =
    useCallback(
      () => {
        locationStopRef.current?.();

        locationStopRef.current =
          null;
      },
      []
    );

  const beginTracking =
    useCallback(
      async () => {
        if (
          !context
        ) {
          return;
        }

        stopTracking();

        const permission =
          await requestDriverLocationPermission();

        if (
          !permission.granted
        ) {
          return;
        }

        locationStopRef.current =
          await watchDriverLocation(
            async (
              location
            ) => {
              setCurrentLocation(
                location
              );

              if (
                mapReady
              ) {
                cameraRef.current?.easeTo({
                  center:
                    navigationCenterAhead(
                      location,
                      70
                    ),

                  zoom:
                    zoomForDistance(
                      drivingRoute?.distanceMeters
                    ),

                  bearing:
                    location.heading ??
                    0,

                  pitch:
                    58,

                  duration:
                    500,
                });
              }

              const now =
                Date.now();

              if (
                now -
                  lastWriteRef.current >=
                5000
              ) {
                lastWriteRef.current =
                  now;

                try {
                  await writeDriverLocation(
                    context,
                    location
                  );
                } catch (error) {
                  console.log(
                    'GPS write:',
                    error
                  );
                }
              }
            }
          );
      },
      [
        context,
        drivingRoute?.distanceMeters,
        mapReady,
        stopTracking,
      ]
    );

  useEffect(() => {
    if (
      tripActive &&
      context
    ) {
      void beginTracking();
    } else {
      stopTracking();
    }

    return stopTracking;
  }, [
    beginTracking,
    context,
    stopTracking,
    tripActive,
  ]);

  const onRouteStudents =
    useMemo(() => {
      return students.filter(
        (
          item
        ) => {
          if (
            isAbsent(
              item
            ) ||
            isDelivered(
              item
            )
          ) {
            return false;
          }

          if (
            tripMode ===
            'to_school'
          ) {
            return !isBoarded(
              item
            );
          }

          return true;
        }
      );
    }, [
      students,
      tripMode,
    ]);

  const pickedStudents =
    useMemo(
      () =>
        students.filter(
          (
            item
          ) =>
            isBoarded(
              item
            ) &&
            !isDelivered(
              item
            )
        ),
      [
        students,
      ]
    );

  const deliveredStudents =
    useMemo(
      () =>
        students.filter(
          isDelivered
        ),
      [
        students,
      ]
    );

  const excusedStudents =
    useMemo(
      () =>
        students.filter(
          isAbsent
        ),
      [
        students,
      ]
    );

  const currentSchoolPoint =
    useMemo(
      () =>
        schoolPoint(
          dashboard?.school
        ),
      [
        dashboard?.school,
      ]
    );

  const morningStudentsComplete =
    useMemo(
      () =>
        students.length > 0 &&
        students.every(
          (item) =>
            isAbsent(item) ||
            isBoarded(item) ||
            isDelivered(item)
        ),
      [students]
    );

  const eveningStudentsComplete =
    useMemo(
      () =>
        students.length > 0 &&
        students.every(
          (item) =>
            isAbsent(item) ||
            isDelivered(item)
        ),
      [students]
    );

  const visibleList =
    activeTab ===
    'picked'
      ? pickedStudents
      : activeTab ===
        'delivered'
      ? deliveredStudents
      : activeTab ===
        'excused'
      ? excusedStudents
      : onRouteStudents;

  /*
   * Always choose a navigation target immediately.
   * 1) local GPS distance gives an instant nearest student
   * 2) OSRM table refines that choice by real driving time
   *
   * This prevents the map from opening with a manually-selected student
   * while nextStudentId is still null.
   */
  useEffect(() => {
    if (
      !tripActive ||
      !currentLocation ||
      !onRouteStudents.length
    ) {
      setNextStudentId(
        null
      );

      return;
    }

    const candidates =
      onRouteStudents
        .map((item) => ({
          item,
          point:
            studentPoint(
              item
            ),
        }))
        .filter(
          (
            row
          ): row is {
            item:
              DriverRouteStudent;

            point: {
              latitude:
                number;
              longitude:
                number;
            };
          } =>
            !!row.point
        );

    if (
      !candidates.length
    ) {
      setNextStudentId(
        null
      );

      return;
    }

    const origin = {
      latitude:
        currentLocation.latitude,

      longitude:
        currentLocation.longitude,
    };

    const immediate =
      [...candidates].sort(
        (
          a,
          b
        ) =>
          directDistanceMeters(
            origin,
            a.point
          ) -
          directDistanceMeters(
            origin,
            b.point
          )
      )[0];

    if (
      immediate
    ) {
      setNextStudentId(
        immediate.item.student_id
      );

      setSelectedStudentId(
        immediate.item.student_id
      );
    }

    const now =
      Date.now();

    if (
      now -
        lastNearestRef.current <
      12000
    ) {
      return;
    }

    lastNearestRef.current =
      now;

    const abort =
      new AbortController();

    void getNearestDrivingIndex(
      origin,

      candidates.map(
        (
          row
        ) =>
          row.point
      ),

      abort.signal
    )
      .then(
        (
          nearest
        ) => {
          if (
            !nearest
          ) {
            return;
          }

          const target =
            candidates[
              nearest.index
            ];

          if (
            !target
          ) {
            return;
          }

          setNextStudentId(
            target.item.student_id
          );

          setSelectedStudentId(
            target.item.student_id
          );
        }
      )
      .catch(
        (
          error
        ) => {
          if (
            error?.name !==
            'AbortError'
          ) {
            console.log(
              'Nearest student routing:',
              error
            );
          }
        }
      );

    return () => {
      abort.abort();
    };
  }, [
    currentLocation,
    onRouteStudents,
    tripActive,
  ]);

  const nextStudent =
    useMemo(
      () =>
        students.find(
          (
            item
          ) =>
            item.student_id ===
            nextStudentId
        ) ??
        null,
      [
        nextStudentId,
        students,
      ]
    );

  const selectedStudent =
    useMemo(
      () =>
        students.find(
          (
            item
          ) =>
            item.student_id ===
            selectedStudentId
        ) ??
        nextStudent ??
        null,
      [
        nextStudent,
        selectedStudentId,
        students,
      ]
    );

  /*
   * Navigation route:
   * only street-following routing geometry is drawn.
   * We never draw a fake straight navigation line.
   */
  useEffect(() => {
    if (
      !tripActive ||
      !currentLocation
    ) {
      setDrivingRoute(
        null
      );

      return;
    }

    const navigatingToSchool =
      tripMode === 'to_school' &&
      morningStudentsComplete &&
      !nextStudent;

    const target =
      navigatingToSchool
        ? currentSchoolPoint
        : nextStudent
        ? studentPoint(nextStudent)
        : null;

    if (!target) {
      setDrivingRoute(
        null
      );

      return;
    }

    const origin = {
      latitude:
        currentLocation.latitude,

      longitude:
        currentLocation.longitude,
    };

    const now = Date.now();

    const previousOrigin = lastRouteOriginRef.current;
    const movedMeters = previousOrigin
      ? directDistanceMeters(
          {
            latitude: previousOrigin.latitude,
            longitude: previousOrigin.longitude,
          },
          origin
        )
      : Number.POSITIVE_INFINITY;

    const directionChanged =
      headingDifference(
        lastRouteHeadingRef.current,
        currentLocation.heading
      ) >= 28;

    // Refresh periodically, and immediately after a meaningful move/turn.
    if (
      now - lastRoutingRef.current < 8000 &&
      movedMeters < 35 &&
      !directionChanged
    ) {
      return;
    }

    lastRoutingRef.current = now;
    lastRouteOriginRef.current = currentLocation;
    lastRouteHeadingRef.current =
      Number.isFinite(Number(currentLocation.heading))
        ? Number(currentLocation.heading)
        : null;

    routingAbortRef.current?.abort();

    const abort =
      new AbortController();

    routingAbortRef.current =
      abort;

    void getDrivingRoute(
      origin,
      target,
      abort.signal,
      {
        heading: currentLocation.heading ?? null,
      }
    )
      .then(
        (
          result
        ) => {
          if (
            !result
          ) {
            setDrivingRoute(
              null
            );

            return;
          }

          setDrivingRoute(
            result
          );

          if (
            mapReady
          ) {
            cameraRef.current?.easeTo({
              center:
                navigationCenterAhead(
                  currentLocation,
                  80
                ),

              zoom:
                zoomForDistance(
                  result.distanceMeters
                ),

              bearing:
                currentLocation.heading ??
                0,

              pitch:
                52,

              duration:
                500,
            });
          }
        }
      )
      .catch(
        (
          error
        ) => {
          if (
            error?.name !==
            'AbortError'
          ) {
            console.log(
              'Driving route:',
              error
            );
          }
        }
      );

    return () => {
      abort.abort();
    };
  }, [
    currentLocation,
    mapReady,
    nextStudent,
    tripActive,
    tripMode,
    morningStudentsComplete,
    currentSchoolPoint,
  ]);

  useEffect(() => {
    if (
      !tripActive ||
      !context ||
      !nextStudent ||
      !drivingRoute?.durationSeconds
    ) {
      return;
    }

    const etaMinutes =
      drivingRoute.durationSeconds /
      60;

    if (
      etaMinutes > 10
    ) {
      return;
    }

    const etaBand =
      etaMinutes <= 5
        ? '5'
        : '10';

    const guardKey =
      `${nextStudent.student_id}:${tripMode}:${etaBand}`;

    if (
      lastEtaTargetRef.current ===
      guardKey
    ) {
      return;
    }

    lastEtaTargetRef.current =
      guardKey;

    void notifyStudentEta(
      context,
      nextStudent,
      etaMinutes
    ).catch((error) => {
      console.log(
        'ETA notification:',
        error
      );

      lastEtaTargetRef.current =
        null;
    });
  }, [
    context,
    drivingRoute?.durationSeconds,
    nextStudent,
    tripActive,
    tripMode,
  ]);

  const animateSheet =
    useCallback(
      (
        expanded:
          boolean
      ) => {
        setSheetExpanded(
          expanded
        );

        Animated.spring(
          sheetHeight,
          {
            toValue:
              expanded
                ? SHEET_EXPANDED
                : SHEET_COLLAPSED,

            useNativeDriver:
              false,

            damping:
              22,

            stiffness:
              210,

            mass:
              0.8,
          }
        ).start();
      },
      [
        sheetHeight,
      ]
    );

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder:
            (
              _,
              gesture
            ) =>
              Math.abs(
                gesture.dy
              ) > 8,

          onPanResponderMove:
            (
              _,
              gesture
            ) => {
              const base =
                sheetExpanded
                  ? SHEET_EXPANDED
                  : SHEET_COLLAPSED;

              const next =
                Math.max(
                  SHEET_COLLAPSED,

                  Math.min(
                    SHEET_EXPANDED,

                    base -
                      gesture.dy
                  )
                );

              sheetHeight.setValue(
                next
              );
            },

          onPanResponderRelease:
            (
              _,
              gesture
            ) => {
              if (
                gesture.dy <
                -35
              ) {
                animateSheet(
                  true
                );
              } else if (
                gesture.dy >
                35
              ) {
                animateSheet(
                  false
                );
              } else {
                animateSheet(
                  sheetExpanded
                );
              }
            },
        }),
      [
        animateSheet,
        sheetExpanded,
        sheetHeight,
      ]
    );

  async function startTrip() {
    if (
      starting ||
      tripActive
    ) {
      return;
    }

    const currentMode =
      automaticTripMode();

    if (
      tripMode !==
      currentMode
    ) {
      setTripMode(
        currentMode
      );
    }

    if (
      !context ||
      !routeId
    ) {
      Alert.alert(
        isRTL
          ? 'بيانات ناقصة'
          : 'Missing Data',

        isRTL
          ? 'تأكد من ربط السائق بالباص والمسار.'
          : 'Make sure the driver has a bus and route.'
      );

      return;
    }

    try {
      setStarting(
        true
      );

      const permission =
        await requestDriverLocationPermission();

      if (
        !permission.granted
      ) {
        return;
      }

      const location =
        await getCurrentDriverLocation();

      if (
        location
      ) {
        setCurrentLocation(
          location
        );
      }

      const startContext = {
        ...context,
        tripMode:
          currentMode,
      };

      const event =
        await startDriverTrip(
          startContext,
          location
        );

      const startedAt =
        event?.created_at ??
        new Date().toISOString();

      const rows =
        await loadStudents(
          routeId,
          currentMode,
          startedAt
        );

      await notifyTripStartedParents(
        startContext,
        rows
      );

      setTripActive(
        true
      );

      animateSheet(
        false
      );

      Alert.alert(
        isRTL
          ? 'تم بدء الرحلة'
          : 'Trip Started',

        currentMode ===
        'to_school'
          ? isRTL
            ? 'بدأت الجولة الصباحية وتم إرسال إشعار للأهالي.'
            : 'Morning trip started and parents were notified.'
          : isRTL
          ? 'بدأت الجولة المسائية وتم إرسال إشعار للأهالي.'
          : 'Evening trip started and parents were notified.'
      );
    } catch (error: any) {
      Alert.alert(
        isRTL
          ? 'تعذر بدء الرحلة'
          : 'Unable to Start Trip',

        error?.message ??
          String(error)
      );
    } finally {
      setStarting(
        false
      );
    }
  }


  useEffect(() => {
    if (
      loading ||
      autoStartHandledRef.current ||
      params.startTrip !== true
    ) {
      return;
    }

    if (
      tripActive
    ) {
      autoStartHandledRef.current =
        true;

      return;
    }

    if (
      !context ||
      !routeId
    ) {
      return;
    }

    autoStartHandledRef.current =
      true;

    void startTrip();
  }, [
    loading,
    params.startTrip,
    tripActive,
    context,
    routeId,
  ]);

  async function endTrip(options?: {
    automatic?: boolean;
  }) {
    if (
      !context ||
      !tripActive ||
      ending
    ) {
      return;
    }

    try {
      setEnding(
        true
      );

      const location =
        currentLocation ??
        (await getCurrentDriverLocation());

      await endDriverTrip(
        context,
        location
      );

      try {
        await notifyTripEndedParents(
          context,
          students
        );
      } catch (notificationError) {
        console.log(
          'Trip end notifications:',
          notificationError
        );
      }

      stopTracking();

      setTripActive(
        false
      );

      setDrivingRoute(
        null
      );

      setNextStudentId(
        null
      );

      setSelectedStudentId(
        null
      );

      animateSheet(
        false
      );

      if (!options?.automatic) {
        Alert.alert(
          isRTL
            ? 'تم إنهاء الرحلة'
            : 'Trip Ended'
        );
      }
    } catch (error: any) {
      Alert.alert(
        isRTL
          ? 'تعذر إنهاء الرحلة'
          : 'Unable to End Trip',

        error?.message ??
          String(error)
      );
    } finally {
      setEnding(
        false
      );
    }
  }


  /*
   * Automatic trip completion:
   *
   * Morning:
   *   last required student handled -> navigate to school ->
   *   end only when the bus physically reaches the school.
   *
   * Evening:
   *   last required student delivered/excused -> end automatically.
   */
  useEffect(() => {
    if (
      !tripActive ||
      !context ||
      ending ||
      autoEndingRef.current ||
      !students.length
    ) {
      return;
    }

    if (
      tripMode === 'to_home' &&
      eveningStudentsComplete
    ) {
      autoEndingRef.current = true;

      void endTrip({
        automatic: true,
      }).finally(() => {
        autoEndingRef.current = false;
      });

      return;
    }

    if (
      tripMode !== 'to_school' ||
      !morningStudentsComplete ||
      !currentLocation ||
      !currentSchoolPoint
    ) {
      return;
    }

    const distanceToSchool =
      directDistanceMeters(
        {
          latitude:
            currentLocation.latitude,
          longitude:
            currentLocation.longitude,
        },
        currentSchoolPoint
      );

    /*
     * 120m gives GPS a practical arrival radius around the school gate.
     */
    if (distanceToSchool > 120) {
      return;
    }

    autoEndingRef.current = true;

    void endTrip({
      automatic: true,
    }).finally(() => {
      autoEndingRef.current = false;
    });
  }, [
    context,
    currentLocation,
    currentSchoolPoint,
    ending,
    eveningStudentsComplete,
    morningStudentsComplete,
    students.length,
    tripActive,
    tripMode,
  ]);

  function confirmEndTrip() {
    Alert.alert(
      isRTL
        ? 'إنهاء الرحلة'
        : 'End Trip',

      isRTL
        ? 'هل أنت متأكد من إنهاء الرحلة؟'
        : 'Are you sure you want to end the trip?',

      [
        {
          text:
            isRTL
              ? 'إلغاء'
              : 'Cancel',

          style:
            'cancel',
        },

        {
          text:
            isRTL
              ? 'إنهاء'
              : 'End',

          style:
            'destructive',

          onPress: () => {
  void endTrip();
},
        },
      ]
    );
  }

  function actionCopy(
    status:
      DriverStudentStatus
  ) {
    if (
      status ===
      'arrived'
    ) {
      return isRTL
        ? 'تأكيد الوصول إلى موقع الطالب؟'
        : 'Confirm arrival at the student location?';
    }

    if (
      status ===
      'boarded'
    ) {
      return isRTL
        ? 'تأكيد استلام الطالب وصعوده إلى الباص؟'
        : 'Confirm student pickup and boarding?';
    }

    if (
      status ===
      'absent'
    ) {
      return isRTL
        ? 'تأكيد تسجيل الطالب غائبًا عن الرحلة؟'
        : 'Confirm marking the student absent?';
    }

    return isRTL
      ? 'تأكيد توصيل الطالب بأمان؟'
      : 'Confirm student delivery?';
  }

  function requestStudentAction(
    item:
      DriverRouteStudent,
    status:
      DriverStudentStatus
  ) {
    Alert.alert(
      isRTL
        ? 'تأكيد العملية'
        : 'Confirm Action',

      actionCopy(
        status
      ),

      [
        {
          text:
            isRTL
              ? 'إلغاء'
              : 'Cancel',

          style:
            'cancel',
        },

        {
          text:
            isRTL
              ? 'موافق'
              : 'Confirm',

          onPress:
            () =>
              executeStudentAction(
                item,
                status
              ),
        },
      ]
    );
  }

  async function executeStudentAction(
    item:
      DriverRouteStudent,
    status:
      DriverStudentStatus
  ) {
    if (
      !context ||
      !tripActive
    ) {
      return;
    }

    try {
      setStudentSaving(
        item.student_id
      );

      const result =
        await setDriverStudentStatus(
          context,
          {
            studentId:
              item.student_id,

            status,

            busNumber:
              busNumber
                ? String(
                    busNumber
                  )
                : null,

            studentName:
              studentName(
                item
              ),

            parentId:
              item.parent_id,
          }
        );

      setStudents(
        (
          current
        ) =>
          current.map(
            (
              student
            ) =>
              student.student_id ===
              item.student_id
                ? {
                    ...student,

                    latest_status:
                      status,

                    latest_status_at:
                      result?.created_at ??
                      new Date().toISOString(),
                  }
                : student
          )
      );

      if (
        status ===
          'boarded' ||
        status ===
          'absent' ||
        status ===
          'delivered'
      ) {
        setSelectedStudentId(
          null
        );

        lastNearestRef.current =
          0;

        lastEtaTargetRef.current =
          null;
      }
    } catch (error: any) {
      Alert.alert(
        isRTL
          ? 'تعذر تنفيذ العملية'
          : 'Unable to Complete Action',

        error?.message ??
          String(error)
      );
    } finally {
      setStudentSaving(
        null
      );
    }
  }

  async function callParent(
    item:
      DriverRouteStudent
  ) {
    const phone =
      String(
        item.parent_phone ??
        ''
      ).trim();

    if (
      !phone
    ) {
      Alert.alert(
        isRTL
          ? 'لا يوجد رقم'
          : 'No Phone Number'
      );

      return;
    }

    const url =
      `tel:${phone.replace(
        /[^\d+]/g,
        ''
      )}`;

    if (
      await Linking.canOpenURL(
        url
      )
    ) {
      await Linking.openURL(
        url
      );
    }
  }

  async function saveIncident() {
    if (
      !context ||
      !incidentReason.trim()
    ) {
      return;
    }

    try {
      setIncidentSaving(
        true
      );

      await createDriverIncident(
        context,
        {
          title:
            incidentReason.trim(),

          details:
            incidentDetails.trim() ||
            null,

          severity:
            'medium',
        }
      );

      setIncidentVisible(
        false
      );

      setIncidentReason(
        ''
      );

      setIncidentDetails(
        ''
      );

      Alert.alert(
        isRTL
          ? 'تم إرسال البلاغ'
          : 'Report Sent',

        isRTL
          ? 'تم إرسال البلاغ للإدارة بنجاح.'
          : 'The report was sent to administration.'
      );
    } catch (error: any) {
      Alert.alert(
        isRTL
          ? 'تعذر إرسال البلاغ'
          : 'Unable to Send Report',

        error?.message ??
          String(error)
      );
    } finally {
      setIncidentSaving(
        false
      );
    }
  }

  const tripDate =
    now.toLocaleDateString(
      isRTL
        ? 'ar-JO'
        : 'en-GB',
      {
        weekday:
          'short',
        day:
          '2-digit',
        month:
          'short',
        year:
          'numeric',
      }
    );

  const tripTime =
    now.toLocaleTimeString(
      isRTL
        ? 'ar-JO'
        : 'en-US',
      {
        hour:
          '2-digit',
        minute:
          '2-digit',
      }
    );

  const routeStreet =
    drivingRoute?.nextRoadName?.trim() ||
    (isRTL
      ? 'جاري تحميل مسار الشوارع...'
      : 'Loading street route...');

  const initialCenter:
    [number, number] =
      currentLocation
        ? [
            currentLocation.longitude,
            currentLocation.latitude,
          ]
        : [
            MAP_CONFIG.defaultCenter.longitude,
            MAP_CONFIG.defaultCenter.latitude,
          ];

  if (
    loading
  ) {
    return (
      <SafeAreaView
        style={[
          styles.loading,
          {
            backgroundColor:
              theme.colors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color="#F7B83A"
        />
      </SafeAreaView>
    );
  }

  return (
    <View
      style={
        styles.container
      }
    >
      <Map
        style={
          StyleSheet.absoluteFill
        }
        mapStyle={
          MAP_CONFIG.developmentStyle
        }
        attribution
        logo
        compass
        androidView="texture"
        onDidFinishLoadingMap={() =>
          setMapReady(
            true
          )
        }
      >
        <Camera
          ref={
            cameraRef
          }
          initialViewState={{
            center:
              initialCenter,

            zoom:
              currentLocation
                ? 17.4
                : MAP_CONFIG.defaultZoom,
          }}
          minZoom={3}
          maxZoom={20}
        />

        {!!drivingRoute && (
          <GeoJSONSource
            id="navigation-route"
            data={
              drivingRoute.geometry as any
            }
          >
            <Layer
              id="navigation-shadow"
              type="line"
              paint={{
                'line-color':
                  '#FFFFFF',

                'line-width':
                  14,

                'line-opacity':
                  1,
              } as any}
            />

            <Layer
              id="navigation-line"
              type="line"
              paint={{
                'line-color': '#126BFF',
                'line-width': 9,
                'line-opacity': 1,
              } as any}
            />
          </GeoJSONSource>
        )}

        {!!drivingRoute?.trafficGeometry && (
          <GeoJSONSource
            id="navigation-traffic"
            data={drivingRoute.trafficGeometry as any}
          >
            <Layer
              id="navigation-traffic-moderate"
              type="line"
              filter={['==', ['get', 'congestion'], 'moderate'] as any}
              paint={{
                'line-color': '#F59E0B',
                'line-width': 9.5,
                'line-opacity': 0.98,
              } as any}
            />
            <Layer
              id="navigation-traffic-heavy"
              type="line"
              filter={['==', ['get', 'congestion'], 'heavy'] as any}
              paint={{
                'line-color': '#EF4444',
                'line-width': 10,
                'line-opacity': 1,
              } as any}
            />
            <Layer
              id="navigation-traffic-severe"
              type="line"
              filter={['==', ['get', 'congestion'], 'severe'] as any}
              paint={{
                'line-color': '#B91C1C',
                'line-width': 11,
                'line-opacity': 1,
              } as any}
            />
          </GeoJSONSource>
        )}

        {students.map(
          (
            item
          ) => {
            const point =
              studentPoint(
                item
              );

            if (
              !point
            ) {
              return null;
            }

            const isNext =
              item.student_id ===
              nextStudentId;

            return (
              <Marker
                key={
                  item.route_student_id
                }
                id={`student-${item.student_id}`}
                lngLat={[
                  point.longitude,
                  point.latitude,
                ]}
                anchor="center"
              >
                <Pressable
                  onPress={() =>
                    setSelectedStudentId(
                      item.student_id
                    )
                  }
                  style={[
                    styles.studentMarkerOuter,

                    {
                      backgroundColor:
                        isAbsent(
                          item
                        )
                          ? 'rgba(148,163,184,0.20)'
                          : isNext
                          ? 'rgba(247,184,58,0.28)'
                          : 'rgba(10,45,68,0.16)',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.studentMarker,

                      {
                        backgroundColor:
                          isAbsent(
                            item
                          )
                            ? '#94A3B8'
                            : isNext
                            ? '#F7B83A'
                            : '#0A2D44',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.markerText,

                        {
                          color:
                            isNext
                              ? '#0A2D44'
                              : '#FFFFFF',
                        },
                      ]}
                    >
                      {item.order_index}
                    </Text>
                  </View>
                </Pressable>
              </Marker>
            );
          }
        )}

        {!!currentLocation && (
          <Marker
            id="driver-bus"
            lngLat={[
              currentLocation.longitude,
              currentLocation.latitude,
            ]}
            anchor="center"
          >
            <View
              style={
                styles.busMarkerOuter
              }
            >
              <View
                style={
                  styles.busMarker
                }
              >
                <Ionicons
                  name="bus"
                  size={24}
                  color="#0A2D44"
                />
              </View>
            </View>
          </Marker>
        )}
      </Map>

      <SafeAreaView
        pointerEvents="box-none"
        style={
          styles.overlay
        }
      >
        <View
          style={[
            styles.header,

            {
              backgroundColor:
                theme.colors.surface,

              flexDirection:
                direction,
            },
          ]}
        >
          <Pressable
            style={
              styles.headerButton
            }
            onPress={() =>
              navigation.goBack()
            }
          >
            <Ionicons
              name={
                isRTL
                  ? 'chevron-forward'
                  : 'chevron-back'
              }
              size={23}
              color={
                theme.colors.text
              }
            />
          </Pressable>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={[
                styles.headerTitle,

                {
                  color:
                    theme.colors.text,

                  textAlign,
                },
              ]}
            >
              {tripMode ===
              'to_school'
                ? isRTL
                  ? 'رحلة إلى المدرسة'
                  : 'Trip to School'
                : isRTL
                ? 'رحلة إلى المنزل'
                : 'Trip Home'}
            </Text>

            <Text
              numberOfLines={1}
              style={[
                styles.headerSub,

                {
                  color:
                    theme.colors.textSecondary,

                  textAlign,
                },
              ]}
            >
              {`${
                tripMode ===
                'to_school'
                  ? isRTL
                    ? 'الجولة الصباحية'
                    : 'Morning Trip'
                  : isRTL
                  ? 'الجولة المسائية'
                  : 'Evening Trip'
              } • ${tripDate} • ${tripTime}`}
            </Text>
          </View>

          <View
            style={[
              styles.liveBadge,

              {
                backgroundColor:
                  tripActive
                    ? '#E8F8F1'
                    : '#F2F4F7',
              },
            ]}
          >
            <View
              style={[
                styles.liveDot,

                {
                  backgroundColor:
                    tripActive
                      ? '#10A66A'
                      : '#98A2B3',
                },
              ]}
            />

            <Text
              style={[
                styles.liveText,

                {
                  color:
                    tripActive
                      ? '#08774A'
                      : '#667085',
                },
              ]}
            >
              {tripActive
                ? 'LIVE'
                : 'OFF'}
            </Text>
          </View>
        </View>

        {tripActive && (
          <View
            style={
              styles.tripInfoStrip
            }
          >
            <View
              style={
                styles.tripInfoMain
              }
            >
              <Ionicons
                name="navigate"
                size={18}
                color="#1677FF"
              />

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={
                    styles.tripInfoStreet
                  }
                >
                  {routeStreet}
                </Text>

                <Text
                  style={
                    styles.tripInfoMeta
                  }
                >
                  {formatDistance(
                    drivingRoute?.distanceMeters
                  )}
                  {' • '}
                  {formatEta(
                    drivingRoute?.durationSeconds
                  )}
                  {drivingRoute?.trafficAware
                    ? drivingRoute.hasSevereCongestion
                      ? isRTL ? ' • ازدحام شديد' : ' • Severe traffic'
                      : drivingRoute.hasCongestion
                      ? isRTL ? ' • ازدحام' : ' • Traffic'
                      : isRTL ? ' • الطريق سالك' : ' • Clear'
                    : ''}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() =>
                setIncidentVisible(
                  true
                )
              }
              style={
                styles.reportMiniButton
              }
            >
              <Ionicons
                name="warning"
                size={17}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.reportMiniText
                }
              >
                {isRTL
                  ? 'بلاغ'
                  : 'Report'}
              </Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      <Pressable
        style={[
          styles.recenter,

          {
            backgroundColor:
              theme.colors.surface,

            bottom:
              sheetExpanded
                ? SHEET_EXPANDED +
                  22
                : SHEET_COLLAPSED +
                  22,
          },
        ]}
        onPress={() => {
          if (
            !currentLocation
          ) {
            return;
          }

          cameraRef.current?.easeTo({
            center:
              navigationCenterAhead(
                currentLocation,
                80
              ),

            zoom:
              zoomForDistance(
                drivingRoute?.distanceMeters
              ),

            bearing:
              currentLocation.heading ??
              0,

            pitch:
              52,

            duration:
              450,
          });
        }}
      >
        <Ionicons
          name="locate"
          size={23}
          color="#0A2D44"
        />
      </Pressable>

      <Animated.View
        style={[
          styles.sheet,

          {
            height: sheetHeight.interpolate({
              inputRange: [0, SHEET_EXPANDED],
              outputRange: [
                0,
                Math.min(
                  SHEET_EXPANDED,
                  responsiveMap.isLandscape
                    ? responsiveMap.height * 0.55
                    : responsiveMap.height * 0.75
                ),
              ],
              extrapolate: 'clamp',
            }),

            backgroundColor:
              theme.colors.surface,

            borderColor:
              theme.colors.border,
          },
        ]}
      >
        <View
          {...panResponder.panHandlers}
          style={
            styles.sheetHandleArea
          }
        >
          <View
            style={
              styles.sheetHandle
            }
          />

          <Ionicons
            name={
              sheetExpanded
                ? 'chevron-down'
                : 'chevron-up'
            }
            size={18}
            color="#667085"
          />
        </View>

        {!tripActive ? (
          <>
            <View
              style={[
                styles.autoModeCard,
                {
                  backgroundColor:
                    theme.colors.background,
                  borderColor:
                    theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name={
                  tripMode ===
                  'to_school'
                    ? 'sunny'
                    : 'moon'
                }
                size={23}
                color={
                  tripMode ===
                  'to_school'
                    ? '#E99A00'
                    : '#475467'
                }
              />

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={[
                    styles.autoModeTitle,
                    {
                      color:
                        theme.colors.text,
                      textAlign,
                    },
                  ]}
                >
                  {tripMode ===
                  'to_school'
                    ? isRTL
                      ? 'الجولة الصباحية'
                      : 'Morning Trip'
                    : isRTL
                    ? 'الجولة المسائية'
                    : 'Evening Trip'}
                </Text>

                <Text
                  style={[
                    styles.autoModeSub,
                    {
                      color:
                        theme.colors.textSecondary,
                      textAlign,
                    },
                  ]}
                >
                  {tripMode ===
                  'to_school'
                    ? isRTL
                      ? 'تتفعّل تلقائيًا من 12:00 ص إلى 11:59 ص'
                      : 'Auto: 12:00 AM – 11:59 AM'
                    : isRTL
                    ? 'تتفعّل تلقائيًا من 12:00 م إلى 11:59 م'
                    : 'Auto: 12:00 PM – 11:59 PM'}
                </Text>
              </View>
            </View>

            <Pressable
              disabled={
                starting
              }
              onPress={
                startTrip
              }
              style={
                styles.startButton
              }
            >
              {starting ? (
                <ActivityIndicator
                  color="#0A2D44"
                />
              ) : (
                <Ionicons
                  name="play"
                  size={20}
                  color="#0A2D44"
                />
              )}

              <Text
                style={
                  styles.startText
                }
              >
                {isRTL
                  ? 'بدء الرحلة'
                  : 'START TRIP'}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View
              style={[
                styles.tabsRow,

                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <StudentTab
                count={
                  onRouteStudents.length
                }
                active={
                  activeTab ===
                  'on_route'
                }
                title={
                  isRTL
                    ? 'قيد التنفيذ'
                    : 'On Route'
                }
                onPress={() =>
                  setActiveTab(
                    'on_route'
                  )
                }
              />

              <StudentTab
                count={
                  pickedStudents.length
                }
                active={
                  activeTab ===
                  'picked'
                }
                title={
                  isRTL
                    ? 'تم استلامهم'
                    : 'Picked Up'
                }
                onPress={() =>
                  setActiveTab(
                    'picked'
                  )
                }
              />

              <StudentTab
                count={
                  deliveredStudents.length
                }
                active={
                  activeTab ===
                  'delivered'
                }
                title={
                  isRTL
                    ? 'تم توصيلهم'
                    : 'Delivered'
                }
                onPress={() =>
                  setActiveTab(
                    'delivered'
                  )
                }
              />

              <StudentTab
                count={
                  excusedStudents.length
                }
                active={
                  activeTab ===
                  'excused'
                }
                title={
                  isRTL
                    ? 'مجاز / عذر'
                    : 'Excused'
                }
                onPress={() =>
                  setActiveTab(
                    'excused'
                  )
                }
              />
            </View>

            {sheetExpanded ? (
              <ScrollView
                style={
                  styles.studentsScroll
                }
                contentContainerStyle={
                  styles.studentsContent
                }
                showsVerticalScrollIndicator={
                  false
                }
              >
                {visibleList.map(
                  (
                    item
                  ) => (
                    <StudentRow
                      key={
                        item.route_student_id
                      }
                      item={
                        item
                      }
                      active={
                        item.student_id ===
                        nextStudentId
                      }
                      theme={
                        theme
                      }
                      isRTL={
                        isRTL
                      }
                      textAlign={
                        textAlign
                      }
                      onPress={() =>
                        setSelectedStudentId(
                          item.student_id
                        )
                      }
                      onCall={() =>
                        callParent(
                          item
                        )
                      }
                    />
                  )
                )}
              </ScrollView>
            ) : (
              selectedStudent && (
                <View
                  style={[
                    styles.activeStudentCard,

                    {
                      borderColor:
                        '#F7B83A',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.activeStudentTop,

                      {
                        flexDirection:
                          direction,
                      },
                    ]}
                  >
                    <View
                      style={
                        styles.studentNumber
                      }
                    >
                      <Text
                        style={
                          styles.studentNumberText
                        }
                      >
                        {selectedStudent.order_index}
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.studentName,

                          {
                            color:
                              theme.colors.text,

                            textAlign,
                          },
                        ]}
                      >
                        {studentName(
                          selectedStudent
                        )}
                      </Text>

                      <Text
                        style={[
                          styles.studentMeta,

                          {
                            color:
                              theme.colors.textSecondary,

                            textAlign,
                          },
                        ]}
                      >
                        {selectedStudent.student_id ===
                        nextStudentId
                          ? isRTL
                            ? 'الطالب التالي'
                            : 'Next student'
                          : isRTL
                          ? 'طالب محدد'
                          : 'Selected student'}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() =>
                        callParent(
                          selectedStudent
                        )
                      }
                      style={
                        styles.callButton
                      }
                    >
                      <Ionicons
                        name="call"
                        size={18}
                        color="#10A66A"
                      />
                    </Pressable>
                  </View>

                  {selectedStudent.is_excluded ? (
                    <View
                      style={[
                        styles.excludedNotice,
                        {
                          flexDirection:
                            direction,
                        },
                      ]}
                    >
                      <Ionicons
                        name="information-circle"
                        size={18}
                        color="#D92D20"
                      />

                      <Text
                        style={[
                          styles.excludedNoticeText,
                          {
                            textAlign,
                          },
                        ]}
                      >
                        {isRTL
                          ? 'هذا الطالب مستثنى من الرحلة حسب تعليمات ولي الأمر.'
                          : 'This student is excluded from this trip by parent instruction.'}
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={
                        styles.actionsRow
                      }
                    >
                      <DriverAction
                        title={
                          isRTL
                            ? 'وصلت'
                            : 'Arrived'
                        }
                        icon="location"
                        color="#2563EB"
                        loading={
                          studentSaving ===
                          selectedStudent.student_id
                        }
                        onPress={() =>
                          requestStudentAction(
                            selectedStudent,
                            'arrived'
                          )
                        }
                      />

                      {tripMode ===
                      'to_school' ? (
                        <>
                          <DriverAction
                            title={
                              isRTL
                                ? 'تم الاستلام'
                                : 'Boarded'
                            }
                            icon="enter"
                            color="#10A66A"
                            loading={
                              studentSaving ===
                              selectedStudent.student_id
                            }
                            onPress={() =>
                              requestStudentAction(
                                selectedStudent,
                                'boarded'
                              )
                            }
                          />

                          <DriverAction
                            title={
                              isRTL
                                ? 'غائب'
                                : 'Absent'
                            }
                            icon="close-circle"
                            color="#D92D20"
                            loading={
                              studentSaving ===
                              selectedStudent.student_id
                            }
                            onPress={() =>
                              requestStudentAction(
                                selectedStudent,
                                'absent'
                              )
                            }
                          />
                        </>
                      ) : (
                        <>
                          <DriverAction
                            title={
                              isRTL
                                ? 'تم التوصيل'
                                : 'Delivered'
                            }
                            icon="checkmark-done"
                            color="#7C3AED"
                            loading={
                              studentSaving ===
                              selectedStudent.student_id
                            }
                            onPress={() =>
                              requestStudentAction(
                                selectedStudent,
                                'delivered'
                              )
                            }
                          />

                          <DriverAction
                            title={
                              isRTL
                                ? 'غائب'
                                : 'Absent'
                            }
                            icon="close-circle"
                            color="#D92D20"
                            loading={
                              studentSaving ===
                              selectedStudent.student_id
                            }
                            onPress={() =>
                              requestStudentAction(
                                selectedStudent,
                                'absent'
                              )
                            }
                          />
                        </>
                      )}
                    </View>
                  )}
                </View>
              )
            )}

            <Pressable
              disabled={
                ending
              }
              onPress={
                confirmEndTrip
              }
              style={
                styles.endButton
              }
            >
              {ending ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <Ionicons
                  name="stop"
                  size={20}
                  color="#FFFFFF"
                />
              )}

              <Text
                style={
                  styles.endText
                }
              >
                {isRTL
                  ? 'إنهاء الرحلة'
                  : 'END TRIP'}
              </Text>
            </Pressable>
          </>
        )}
      </Animated.View>

      <Modal
        visible={
          incidentVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setIncidentVisible(
            false
          )
        }
      >
        <KeyboardAvoidingView
          style={
            styles.modalBackdrop
          }
          behavior={
            Platform.OS ===
            'ios'
              ? 'padding'
              : undefined
          }
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor:
                  theme.colors.surface,
              },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color:
                        theme.colors.text,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'بلاغ تأخير / مشكلة'
                    : 'Delay / Issue Report'}
                </Text>

                <Text
                  style={[
                    styles.modalSub,
                    {
                      color:
                        theme.colors.textSecondary,
                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'سيظهر البلاغ مباشرة للإدارة'
                    : 'This report will be visible to administration'}
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  setIncidentVisible(
                    false
                  )
                }
                style={
                  styles.modalClose
                }
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={
                    theme.colors.text
                  }
                />
              </Pressable>
            </View>

            <View
              style={
                styles.reasonGrid
              }
            >
              {[
                isRTL
                  ? 'ازدحام مروري'
                  : 'Traffic Delay',
                isRTL
                  ? 'عطل في الباص'
                  : 'Bus Problem',
                isRTL
                  ? 'حادث'
                  : 'Accident',
                isRTL
                  ? 'ظرف طارئ'
                  : 'Emergency',
              ].map(
                (
                  reason
                ) => (
                  <Pressable
                    key={
                      reason
                    }
                    onPress={() =>
                      setIncidentReason(
                        reason
                      )
                    }
                    style={[
                      styles.reasonButton,
                      {
                        borderColor:
                          incidentReason ===
                          reason
                            ? '#F7B83A'
                            : theme.colors.border,

                        backgroundColor:
                          incidentReason ===
                          reason
                            ? '#FFF8E7'
                            : theme.colors.background,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          theme.colors.text,
                        fontSize:
                          10,
                        fontWeight:
                          '800',
                      }}
                    >
                      {reason}
                    </Text>
                  </Pressable>
                )
              )}
            </View>

            <TextInput
              value={
                incidentDetails
              }
              onChangeText={
                setIncidentDetails
              }
              multiline
              placeholder={
                isRTL
                  ? 'اكتب تفاصيل مختصرة...'
                  : 'Add short details...'
              }
              placeholderTextColor="#98A2B3"
              style={[
                styles.incidentInput,
                {
                  color:
                    theme.colors.text,
                  borderColor:
                    theme.colors.border,
                  textAlign,
                },
              ]}
            />

            <Pressable
              disabled={
                incidentSaving ||
                !incidentReason.trim()
              }
              onPress={
                saveIncident
              }
              style={[
                styles.sendIncidentButton,
                {
                  opacity:
                    incidentSaving ||
                    !incidentReason.trim()
                      ? 0.5
                      : 1,
                },
              ]}
            >
              {incidentSaving ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Ionicons
                    name="send"
                    size={18}
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.sendIncidentText
                    }
                  >
                    {isRTL
                      ? 'إرسال للإدارة'
                      : 'SEND TO ADMIN'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function StudentTab({
  count,
  active,
  title,
  onPress,
}: {
  count:
    number;
  active:
    boolean;
  title:
    string;
  onPress:
    () => void;
}) {
  return (
    <Pressable
      onPress={
        onPress
      }
      style={[
        styles.tab,

        {
          borderColor:
            active
              ? '#F7B83A'
              : '#E4E7EC',

          backgroundColor:
            active
              ? '#FFF8E7'
              : '#F8FAFC',
        },
      ]}
    >
      <Text
        style={
          styles.tabCount
        }
      >
        {count}
      </Text>

      <Text
        numberOfLines={1}
        style={
          styles.tabTitle
        }
      >
        {title}
      </Text>
    </Pressable>
  );
}

function StudentRow({
  item,
  active,
  theme,
  isRTL,
  textAlign,
  onPress,
  onCall,
}: any) {
  return (
    <Pressable
      onPress={
        onPress
      }
      style={[
        styles.studentRow,

        {
          borderColor:
            active
              ? '#F7B83A'
              : theme.colors.border,

          backgroundColor:
            active
              ? '#FFF9EB'
              : theme.colors.background,
        },
      ]}
    >
      <View
        style={[
          styles.studentRowNumber,

          {
            backgroundColor:
              active
                ? '#F7B83A'
                : '#E9EEF5',
          },
        ]}
      >
        <Text
          style={{
            fontWeight:
              '900',

            color:
              active
                ? '#0A2D44'
                : '#475467',
          }}
        >
          {item.order_index}
        </Text>
      </View>

      <View
        style={{
          flex: 1,
        }}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.studentRowName,

            {
              color:
                theme.colors.text,

              textAlign,
            },
          ]}
        >
          {studentName(
            item
          )}
        </Text>

        <Text
          numberOfLines={1}
          style={[
            styles.studentRowMeta,

            {
              color:
                item.is_excluded
                  ? '#D92D20'
                  : theme.colors.textSecondary,

              textAlign,
            },
          ]}
        >
          {item.is_excluded
            ? `${item.instruction_status ?? ''} ${item.instruction_note ?? ''}`.trim()
            : active
            ? isRTL
              ? 'الطالب التالي'
              : 'Next student'
            : normalize(
                item.latest_status
              ) ||
              (isRTL
                ? 'بانتظار السائق'
                : 'Waiting')}
        </Text>
      </View>

      {!!item.parent_phone && (
        <Pressable
          onPress={
            onCall
          }
          style={
            styles.rowCall
          }
        >
          <Ionicons
            name="call"
            size={17}
            color="#10A66A"
          />
        </Pressable>
      )}
    </Pressable>
  );
}

function DriverAction({
  title,
  icon,
  color,
  loading,
  onPress,
}: {
  title:
    string;
  icon:
    React.ComponentProps<
      typeof Ionicons
    >['name'];
  color:
    string;
  loading:
    boolean;
  onPress:
    () => void;
}) {
  return (
    <Pressable
      disabled={
        loading
      }
      onPress={
        onPress
      }
      style={[
        styles.action,

        {
          borderColor:
            color,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            color
          }
        />
      ) : (
        <Ionicons
          name={
            icon
          }
          size={18}
          color={
            color
          }
        />
      )}

      <Text
        numberOfLines={1}
        style={[
          styles.actionText,

          {
            color,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
    },

    loading: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    overlay: {
      position:
        'absolute',
      left: 0,
      right: 0,
      top: 0,
    },

    header: {
      marginHorizontal:
        14,
      marginTop: 5,
      minHeight: 66,
      paddingHorizontal:
        10,
      borderRadius:
        22,
      alignItems:
        'center',
      gap: 9,
      shadowColor:
        '#000',
      shadowOpacity:
        0.13,
      shadowRadius:
        13,
      elevation: 6,
    },

    headerButton: {
      width: 42,
      height: 42,
      borderRadius:
        14,
      backgroundColor:
        'rgba(127,127,127,0.08)',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    headerTitle: {
      fontSize: 16,
      fontWeight:
        '900',
    },

    headerSub: {
      marginTop: 2,
      fontSize: 10,
      fontWeight:
        '700',
    },

    liveBadge: {
      height: 34,
      borderRadius:
        14,
      paddingHorizontal:
        11,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
    },

    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },

    liveText: {
      fontSize: 10,
      fontWeight:
        '900',
    },

    navigationBanner: {
      marginHorizontal:
        28,
      marginTop: 9,
      minHeight: 68,
      borderRadius:
        18,
      backgroundColor:
        '#0A2D44',
      paddingHorizontal:
        14,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 12,
      shadowColor:
        '#000',
      shadowOpacity:
        0.15,
      shadowRadius:
        12,
      elevation: 6,
    },

    navInstruction: {
      color:
        '#FFFFFF',
      fontSize: 13,
      fontWeight:
        '900',
    },

    navMeta: {
      color:
        '#D8E4EE',
      marginTop: 3,
      fontSize: 11,
      fontWeight:
        '800',
    },

    recenter: {
      position:
        'absolute',
      right: 18,
      width: 50,
      height: 50,
      borderRadius:
        17,
      alignItems:
        'center',
      justifyContent:
        'center',
      shadowColor:
        '#000',
      shadowOpacity:
        0.12,
      shadowRadius:
        10,
      elevation: 5,
    },

    busMarkerOuter: {
      width: 56,
      height: 56,
      borderRadius:
        28,
      backgroundColor:
        'rgba(247,184,58,0.28)',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    busMarker: {
      width: 42,
      height: 42,
      borderRadius:
        15,
      backgroundColor:
        '#F7B83A',
      borderWidth: 3,
      borderColor:
        '#FFFFFF',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    studentMarkerOuter: {
      width: 44,
      height: 44,
      borderRadius:
        22,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    studentMarker: {
      width: 32,
      height: 32,
      borderRadius:
        16,
      borderWidth: 2,
      borderColor:
        '#FFFFFF',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    markerText: {
      fontSize: 10,
      fontWeight:
        '900',
    },

    sheet: {
      position:
        'absolute',
      left: 10,
      right: 10,
      bottom: 8,
      borderWidth: 1,
      borderRadius:
        28,
      paddingHorizontal:
        12,
      paddingBottom:
        12,
      overflow:
        'hidden',
      shadowColor:
        '#000',
      shadowOpacity:
        0.17,
      shadowRadius:
        18,
      elevation: 10,
    },

    sheetHandleArea: {
      height: 30,
      alignItems:
        'center',
      justifyContent:
        'center',
      flexDirection:
        'row',
      gap: 6,
    },

    sheetHandle: {
      width: 45,
      height: 5,
      borderRadius:
        3,
      backgroundColor:
        '#B8C2CF',
    },

    modeRow: {
      gap: 8,
      marginBottom:
        10,
    },

    modeButton: {
      flex: 1,
      height: 88,
      borderWidth: 1.3,
      borderRadius:
        17,
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 3,
    },

    modeTitle: {
      fontSize: 11,
      fontWeight:
        '900',
    },

    modeSub: {
      fontSize: 8,
      fontWeight:
        '700',
    },

    startButton: {
      minHeight: 54,
      borderRadius:
        16,
      backgroundColor:
        '#F7B83A',
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 8,
    },

    startText: {
      color:
        '#0A2D44',
      fontSize: 13,
      fontWeight:
        '900',
    },

    tabsRow: {
      gap: 6,
      marginBottom:
        9,
    },

    tab: {
      flex: 1,
      minHeight: 53,
      borderWidth: 1,
      borderRadius:
        14,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        3,
    },

    tabCount: {
      color:
        '#0A2D44',
      fontSize: 14,
      fontWeight:
        '900',
    },

    tabTitle: {
      color:
        '#667085',
      marginTop: 1,
      fontSize: 7,
      fontWeight:
        '800',
      textAlign:
        'center',
    },

    studentsScroll: {
      flex: 1,
      marginBottom: 8,
    },

    studentsContent: {
      gap: 6,
      paddingBottom: 4,
    },

    studentRow: {
      minHeight: 54,
      borderWidth: 1,
      borderRadius:
        14,
      paddingHorizontal:
        8,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
    },

    studentRowNumber: {
      width: 32,
      height: 32,
      borderRadius:
        10,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    studentRowName: {
      fontSize: 11,
      fontWeight:
        '900',
    },

    studentRowMeta: {
      marginTop: 2,
      fontSize: 8,
      fontWeight:
        '700',
    },

    rowCall: {
      width: 34,
      height: 34,
      borderRadius:
        11,
      backgroundColor:
        '#ECFDF3',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    activeStudentCard: {
      borderWidth: 1.2,
      borderRadius:
        18,
      padding: 9,
      marginBottom: 8,
      backgroundColor:
        '#FFF9EB',
    },

    activeStudentTop: {
      alignItems:
        'center',
      gap: 8,
      marginBottom: 8,
    },

    studentNumber: {
      width: 34,
      height: 34,
      borderRadius:
        11,
      backgroundColor:
        '#F7B83A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    studentNumberText: {
      color:
        '#0A2D44',
      fontSize: 12,
      fontWeight:
        '900',
    },

    studentName: {
      fontSize: 13,
      fontWeight:
        '900',
    },

    studentMeta: {
      marginTop: 2,
      fontSize: 8,
      fontWeight:
        '700',
    },

    callButton: {
      width: 37,
      height: 37,
      borderRadius:
        12,
      backgroundColor:
        '#ECFDF3',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    excludedNotice: {
      minHeight: 44,
      borderRadius: 13,
      backgroundColor: '#FDECEC',
      paddingHorizontal: 10,
      paddingVertical: 8,
      alignItems: 'center',
      gap: 7,
    },

    excludedNoticeText: {
      flex: 1,
      color: '#B42318',
      fontSize: 8,
      lineHeight: 12,
      fontWeight: '800',
    },

    actionsRow: {
      flexDirection:
        'row',
      gap: 6,
    },

    action: {
      flex: 1,
      minHeight: 42,
      borderWidth: 1,
      borderRadius:
        13,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 5,
      paddingHorizontal:
        5,
    },

    actionText: {
      fontSize: 9,
      fontWeight:
        '900',
    },

    endButton: {
      minHeight: 52,
      borderRadius:
        16,
      backgroundColor:
        '#D92D20',
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 8,
    },

    endText: {
      color:
        '#FFFFFF',
      fontSize: 13,
      fontWeight:
        '900',
    },

    tripInfoStrip: {
      marginHorizontal: 20,
      marginTop: 8,
      minHeight: 56,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.96)',
      paddingHorizontal: 10,
      paddingVertical: 7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      shadowColor: '#000',
      shadowOpacity: 0.09,
      shadowRadius: 10,
      elevation: 4,
    },

    tripInfoMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    tripInfoStreet: {
      color: '#0A2D44',
      fontSize: 11,
      fontWeight: '900',
    },

    tripInfoMeta: {
      marginTop: 2,
      color: '#667085',
      fontSize: 9,
      fontWeight: '800',
    },

    reportMiniButton: {
      minWidth: 64,
      height: 40,
      paddingHorizontal: 10,
      borderRadius: 13,
      backgroundColor: '#D92D20',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },

    reportMiniText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(2,6,23,0.56)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },

    modalCard: {
      width: '100%',
      maxWidth: 520,
      borderRadius: 24,
      padding: 16,
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 20,
      elevation: 12,
    },

    modalHeader: {
      alignItems: 'center',
      gap: 10,
      marginBottom: 13,
    },

    modalTitle: {
      fontSize: 17,
      fontWeight: '900',
    },

    modalSub: {
      marginTop: 3,
      fontSize: 9,
      fontWeight: '700',
    },

    modalClose: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: 'rgba(127,127,127,0.09)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    reasonGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginBottom: 10,
    },

    reasonButton: {
      width: '48.8%',
      minHeight: 42,
      borderWidth: 1,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },

    incidentInput: {
      minHeight: 95,
      borderWidth: 1,
      borderRadius: 14,
      padding: 11,
      textAlignVertical: 'top',
      fontSize: 12,
    },

    sendIncidentButton: {
      minHeight: 50,
      marginTop: 11,
      borderRadius: 15,
      backgroundColor: '#D92D20',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },

    sendIncidentText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },

    autoModeCard: {
      minHeight: 64,
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 12,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    autoModeTitle: {
      fontSize: 12,
      fontWeight: '900',
    },

    autoModeSub: {
      marginTop: 2,
      fontSize: 8,
      fontWeight: '700',
    },
  });