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
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Camera,
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
  ParentTrackingChild,
  getParentTrackingChildren,
} from '../../services/busService';

import {
  subscribeToBusLocation,
  subscribeToTrackingPoints,
} from '../../services/trackingService';

import {
  getParentRequests,
} from '../../services/parentRequestService';

import {
  supabase,
} from '../../lib/supabase';

import {
  MAP_CONFIG,
} from '../../config/mapConfig';

import {
  useAppTheme,
} from '../../theme/ThemeContext';

import {
  useLanguage,
} from '../../i18n/LanguageContext';

type CameraHandle =
  React.ElementRef<typeof Camera>;

type Point = {
  lat: number;
  lng: number;
};

function validCoordinate(
  lat: unknown,
  lng: unknown
) {
  const latitude =
    Number(lat);

  const longitude =
    Number(lng);

  return (
    Number.isFinite(
      latitude
    ) &&
    Number.isFinite(
      longitude
    ) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(
      latitude === 0 &&
      longitude === 0
    )
  );
}

function point(
  lat: unknown,
  lng: unknown
): Point | null {
  if (
    !validCoordinate(
      lat,
      lng
    )
  ) {
    return null;
  }

  return {
    lat:
      Number(lat),

    lng:
      Number(lng),
  };
}

function nameOfStudent(
  student: Record<
    string,
    any
  > | null
) {
  return (
    student?.full_name ??
    student?.name ??
    student?.full_name_ar ??
    student?.full_name_en ??
    'الطالب'
  );
}

function initials(
  name: string
) {
  const parts =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (!parts.length) {
    return 'ST';
  }

  if (
    parts.length === 1
  ) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    (
      parts[0]?.[0] ??
      ''
    ) +
    (
      parts[1]?.[0] ??
      ''
    )
  ).toUpperCase();
}

function timeText(
  value?: string | null
) {
  if (!value) {
    return '--:--';
  }

  try {
    return new Date(
      value
    ).toLocaleTimeString(
      [],
      {
        hour:
          '2-digit',
        minute:
          '2-digit',
      }
    );
  } catch {
    return '--:--';
  }
}

function fullDateText(
  value?: string | null
) {
  if (!value) {
    return '—';
  }

  try {
    return new Date(
      value
    ).toLocaleString();
  } catch {
    return '—';
  }
}

function statusText(
  value: unknown,
  isRTL: boolean
) {
  const raw =
    String(
      value ?? ''
    )
      .trim()
      .toLowerCase();

  if (!raw) {
    return isRTL
      ? 'غير محدد'
      : 'Not available';
  }

  const ar:
    Record<
      string,
      string
    > = {
    picked:
      'تم صعود الطالب',

    pickup:
      'تم صعود الطالب',

    picked_up:
      'تم صعود الطالب',

    boarded:
      'داخل الباص',

    on_bus:
      'داخل الباص',

    delivered:
      'تم التوصيل',

    dropoff:
      'تم التوصيل',

    dropped_off:
      'تم التوصيل',

    arrived_home:
      'وصل المنزل',

    arrived:
      'وصل الباص',

    arrival:
      'وصل الباص',

    absent:
      'غائب',

    not_boarded:
      'لم يصعد',

    did_not_ride:
      'لم يركب',

    no_show:
      'لم يحضر',
  };

  const en:
    Record<
      string,
      string
    > = {
    picked:
      'Picked Up',

    pickup:
      'Picked Up',

    picked_up:
      'Picked Up',

    boarded:
      'On Bus',

    on_bus:
      'On Bus',

    delivered:
      'Delivered',

    dropoff:
      'Delivered',

    dropped_off:
      'Delivered',

    arrived_home:
      'Arrived Home',

    arrived:
      'Bus Arrived',

    arrival:
      'Bus Arrived',

    absent:
      'Absent',

    not_boarded:
      'Not Boarded',

    did_not_ride:
      'Did Not Ride',

    no_show:
      'No Show',
  };

  return (
    isRTL
      ? ar[raw]
      : en[raw]
  ) ?? String(value);
}

function minutesOld(
  value?: string | null
) {
  if (!value) {
    return null;
  }

  const ts =
    new Date(
      value
    ).getTime();

  if (
    !Number.isFinite(ts)
  ) {
    return null;
  }

  return (
    Date.now() - ts
  ) / 60000;
}


type ParentOperationalRequest = Record<string, any>;

function localDateKey(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentTripPeriod(date: Date = new Date()) {
  return date.getHours() < 12
    ? 'morning'
    : 'afternoon';
}

function normalizeRequestValue(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function requestAppliesNow(
  request: ParentOperationalRequest,
  studentId: string | null | undefined,
  now: Date = new Date()
) {
  if (!studentId) return false;

  const status = normalizeRequestValue(request.status);
  const type = normalizeRequestValue(request.request_type);

  if (status !== 'approved') return false;
  if (!['absence', 'no_bus'].includes(type)) return false;
  if (String(request.student_id ?? '') !== String(studentId)) return false;

  const today = localDateKey(now);
  const from = String(
    request.date_from ??
    request.request_date ??
    ''
  ).slice(0, 10);

  const to = String(
    request.date_to ??
    request.date_from ??
    request.request_date ??
    ''
  ).slice(0, 10);

  if (from && today < from) return false;
  if (to && today > to) return false;

  const period = normalizeRequestValue(
    request.trip_period ?? 'both'
  );

  if (!period || period === 'both' || period === 'all') {
    return true;
  }

  const activePeriod = currentTripPeriod(now);

  if (activePeriod === 'morning') {
    return ['morning', 'am', 'to_school'].includes(period);
  }

  return ['afternoon', 'evening', 'pm', 'to_home'].includes(period);
}

function activeApprovedRequest(
  requests: ParentOperationalRequest[],
  studentId: string | null | undefined,
  now: Date = new Date()
) {
  return requests.find(
    (request) =>
      requestAppliesNow(
        request,
        studentId,
        now
      )
  ) ?? null;
}

function requestPeriodText(
  value: unknown,
  isRTL: boolean
) {
  const period = normalizeRequestValue(value ?? 'both');

  if (period === 'morning' || period === 'am' || period === 'to_school') {
    return isRTL ? 'الفترة الصباحية' : 'Morning';
  }

  if (['afternoon', 'evening', 'pm', 'to_home'].includes(period)) {
    return isRTL ? 'الفترة المسائية' : 'Afternoon';
  }

  return isRTL ? 'الفترتان' : 'Both periods';
}

function requestDateRangeText(
  request: ParentOperationalRequest | null,
  isRTL: boolean
) {
  if (!request) return '—';

  const from = String(
    request.date_from ??
    request.request_date ??
    ''
  ).slice(0, 10);

  const to = String(
    request.date_to ??
    request.date_from ??
    request.request_date ??
    ''
  ).slice(0, 10);

  if (!from && !to) return '—';
  if (!to || from === to) return from || to;

  return isRTL
    ? `${from} إلى ${to}`
    : `${from} to ${to}`;
}

/*
 * --------------------------------------------------------
 * مكان الباص
 * --------------------------------------------------------
 */
function childBusPoint(
  child: ParentTrackingChild | null
) {
  if (!child) {
    return null;
  }

  const live =
    child.liveLocation;

  if (
    live &&
    validCoordinate(
      live.lat,
      live.lng
    )
  ) {
    return {
      lat: Number(
        live.lat
      ),

      lng: Number(
        live.lng
      ),

      heading:
        Number(
          live.heading
        ) || 0,

      updatedAt:
        live.updated_at ??
        null,

      source:
        'live' as const,
    };
  }

  const trackingPoint =
    child.lastTrackingPoint;

  if (trackingPoint) {
    const trackingLat =
      trackingPoint.lat ??
      trackingPoint.latitude;

    const trackingLng =
      trackingPoint.lng ??
      trackingPoint.longitude ??
      trackingPoint.lon;

    if (
      validCoordinate(
        trackingLat,
        trackingLng
      )
    ) {
      return {
        lat: Number(
          trackingLat
        ),

        lng: Number(
          trackingLng
        ),

        heading:
          Number(
            trackingPoint.heading
          ) || 0,

        updatedAt:
          trackingPoint.recorded_at ??
          trackingPoint.updated_at ??
          null,

        source:
          'history' as const,
      };
    }
  }

  const speedLocation =
    child.lastSpeedLocation;

  if (speedLocation) {
    const speedLat =
      speedLocation.latitude ??
      speedLocation.lat;

    const speedLng =
      speedLocation.longitude ??
      speedLocation.lng ??
      speedLocation.lon;

    if (
      validCoordinate(
        speedLat,
        speedLng
      )
    ) {
      return {
        lat: Number(
          speedLat
        ),

        lng: Number(
          speedLng
        ),

        heading:
          Number(
            speedLocation.heading
          ) || 0,

        updatedAt:
          speedLocation.recorded_at ??
          speedLocation.updated_at ??
          null,

        source:
          'history' as const,
      };
    }
  }

  return null;
}

export default function StudentTrackScreen({
  route,
  navigation,
}: any) {
  const responsiveParentMap = useResponsiveLayout();

  const cameraRef =
    useRef<CameraHandle>(
      null
    );

  const {
    user,
  } = useAuth();

  const {
    theme,
  } = useAppTheme();

  const {
    isRTL,
    direction,
    textAlign,
  } = useLanguage();

  const [
    children,
    setChildren,
  ] =
    useState<
      ParentTrackingChild[]
    >([]);

  const [
    selectedStudentId,
    setSelectedStudentId,
  ] =
    useState<
      string | null
    >(
      route?.params
        ?.studentId ??
        null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    detailsVisible,
    setDetailsVisible,
  ] =
    useState(false);

  const [
    mapReady,
    setMapReady,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string | null
    >(null);

  const [
    parentRequests,
    setParentRequests,
  ] = useState<
    ParentOperationalRequest[]
  >([]);

  const [
    statusClock,
    setStatusClock,
  ] = useState(
    () => new Date()
  );

  /*
   * ========================================================
   * تحميل بيانات ولي الأمر
   * ========================================================
   */
  const load =
    useCallback(
      async (
        refresh = false
      ) => {
        if (!user?.id) {
          setErrorMessage(
            isRTL
              ? 'لم يتم العثور على حساب ولي الأمر.'
              : 'Parent account was not found.'
          );

          setLoading(false);

          return;
        }

        if (refresh) {
          setRefreshing(
            true
          );
        } else {
          setLoading(true);
        }

        setErrorMessage(
          null
        );

        try {
          console.log(
            '[StudentTrack] AUTH USER:',
            user
          );

          const [
            rows,
            requestRows,
          ] = await Promise.all([
            getParentTrackingChildren(
              user.id
            ),
            getParentRequests(
              user.id
            ),
          ]);

          console.log(
            '[StudentTrack] CHILDREN:',
            rows.length
          );

          setChildren(
            rows
          );

          setParentRequests(
            requestRows
          );

          setStatusClock(
            new Date()
          );

          if (
            rows.length === 0
          ) {
            setErrorMessage(
              isRTL
                ? 'لم يتم العثور على أبناء مرتبطين بهذا الحساب.'
                : 'No students are linked to this parent.'
            );

            return;
          }

          const requestedId =
            route?.params
              ?.studentId ??
            null;

          const requestedExists =
            requestedId &&
            rows.some(
              (item) =>
                item.student
                  ?.id ===
                requestedId
            );

          if (
            requestedExists
          ) {
            setSelectedStudentId(
              requestedId
            );
          } else {
            setSelectedStudentId(
              rows[0]
                ?.student
                ?.id ??
                null
            );
          }
        } catch (error: any) {
          console.log(
            '[StudentTrack] LOAD ERROR:',
            error
          );

          setErrorMessage(
            error?.message ??
              (
                isRTL
                  ? 'حدث خطأ أثناء قراءة البيانات.'
                  : 'Could not load tracking data.'
              )
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        user?.id,
        route?.params
          ?.studentId,
        isRTL,
      ]
    );

  useEffect(() => {
    load();
  }, [load]);

  /*
   * تحديث اليوم / الفترة تلقائياً.
   * بهذه الطريقة لا تبقى حالة الصباح ظاهرة بعد بدء فترة المساء،
   * ولا تنتقل إجازة يوم سابق إلى اليوم التالي.
   */
  useEffect(() => {
    const timer = setInterval(
      () => setStatusClock(new Date()),
      60 * 1000
    );

    return () => clearInterval(timer);
  }, []);

  /*
   * مزامنة احتياطية خفيفة كل 15 ثانية.
   * Realtime يبقى هو المسار الأساسي، وهذه فقط للحماية من انقطاع websocket.
   */
  useEffect(() => {
    if (!user?.id) return;

    const timer = setInterval(async () => {
      try {
        const [rows, requestRows] = await Promise.all([
          getParentTrackingChildren(user.id),
          getParentRequests(user.id),
        ]);

        setChildren(rows);
        setParentRequests(requestRows);
        setStatusClock(new Date());
      } catch (error) {
        console.log('[StudentTrack] FALLBACK SYNC ERROR:', error);
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [user?.id]);

  /*
   * Realtime لطلبات ولي الأمر.
   * نحدث الطلب نفسه داخل الحالة مباشرة بدل إعادة تحميل الشاشة كاملة.
   */
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const upsertRequest = (row: ParentOperationalRequest) => {
      if (!row?.id) return;

      setParentRequests((current) => {
        const next = current.filter(
          (item) => String(item.id) !== String(row.id)
        );

        return [row, ...next];
      });

      setStatusClock(new Date());
    };

    const removeRequest = (row: ParentOperationalRequest) => {
      setParentRequests((current) =>
        current.filter((item) => {
          if (row?.id != null) {
            return String(item.id) !== String(row.id);
          }

          return !(
            row?.student_id &&
            String(item.student_id) === String(row.student_id)
          );
        })
      );

      setStatusClock(new Date());
    };

    const channel = supabase
      .channel(`parent-track-requests-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'parent_requests',
          filter: `parent_id=eq.${user.id}`,
        },
        (payload) => {
          upsertRequest(payload.new as ParentOperationalRequest);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'parent_requests',
          filter: `parent_id=eq.${user.id}`,
        },
        (payload) => {
          upsertRequest(payload.new as ParentOperationalRequest);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'parent_requests',
          filter: `parent_id=eq.${user.id}`,
        },
        (payload) => {
          removeRequest(payload.old as ParentOperationalRequest);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  /*
   * ========================================================
   * الطالب المحدد
   * ========================================================
   */
  const selectedChild =
    useMemo(() => {
      if (!children.length) {
        return null;
      }

      return (
        children.find(
          (item) =>
            item.student
              ?.id ===
            selectedStudentId
        ) ??
        children[0]
      );
    }, [
      children,
      selectedStudentId,
    ]);

  const selectedApprovedRequest =
    useMemo(
      () =>
        activeApprovedRequest(
          parentRequests,
          selectedChild?.student?.id,
          statusClock
        ),
      [
        parentRequests,
        selectedChild?.student?.id,
        statusClock,
      ]
    );

  const studentIsExcused =
    Boolean(
      selectedApprovedRequest
    );

  const selectedBusPoint =
    useMemo(
      () =>
        childBusPoint(
          selectedChild
        ),
      [selectedChild]
    );

  const studentHome =
    useMemo(
      () =>
        point(
          selectedChild
            ?.student
            ?.home_lat,

          selectedChild
            ?.student
            ?.home_lng
        ),
      [
        selectedChild
          ?.student
          ?.home_lat,
        selectedChild
          ?.student
          ?.home_lng,
      ]
    );

  const schoolPoint =
    useMemo(
      () =>
        point(
          selectedChild
            ?.school
            ?.lat,

          selectedChild
            ?.school
            ?.lng
        ),
      [
        selectedChild
          ?.school
          ?.lat,
        selectedChild
          ?.school
          ?.lng,
      ]
    );

  /*
   * ========================================================
   * Realtime للباص المحدد
   * ========================================================
   */
  useEffect(() => {
    const busId =
      selectedChild?.bus
        ?.id;

    if (!busId) {
      return;
    }

    const stopLive =
      subscribeToBusLocation(
        busId,
        (nextLocation) => {
          if (
            !validCoordinate(
              nextLocation.lat,
              nextLocation.lng
            )
          ) {
            return;
          }

          setChildren(
            (current) =>
              current.map(
                (item) =>
                  item.student
                    ?.id ===
                  selectedChild
                    .student
                    ?.id
                    ? {
                        ...item,

                        liveLocation:
                          nextLocation,
                      }
                    : item
              )
          );
        }
      );

    const stopPoint =
      subscribeToTrackingPoints(
        busId,
        (nextPoint) => {
          if (
            !validCoordinate(
              nextPoint.lat,
              nextPoint.lng
            )
          ) {
            return;
          }

          setChildren(
            (current) =>
              current.map(
                (item) =>
                  item.student
                    ?.id ===
                  selectedChild
                    .student
                    ?.id
                    ? {
                        ...item,

                        lastTrackingPoint:
                          nextPoint,
                      }
                    : item
              )
          );
        }
      );

    return () => {
      stopLive?.();
      stopPoint?.();
    };
  }, [
    selectedChild?.bus
      ?.id,
    selectedChild?.student
      ?.id,
  ]);

  /*
   * ========================================================
   * تحريك الكاميرا للباص
   * ========================================================
   */
  const locateBus =
    useCallback(() => {
      if (
        !selectedBusPoint
      ) {
        return;
      }

      cameraRef.current?.easeTo(
        {
          center: [
            selectedBusPoint.lng,
            selectedBusPoint.lat,
          ],

          zoom:
            MAP_CONFIG
              .trackingZoom,

          bearing:
            selectedBusPoint
              .heading,

          duration: 650,
        }
      );
    }, [
      selectedBusPoint,
    ]);

  useEffect(() => {
    if (
      !mapReady ||
      !selectedBusPoint
    ) {
      return;
    }

    locateBus();
  }, [
    mapReady,
    selectedStudentId,
  ]);

  /*
   * ========================================================
   * عرض الكل بدون fitBounds
   * ========================================================
   *
   * نحسب المركز يدوياً حتى لا نصطدم بتوقيع
   * fitBounds الخاص بإصدار MapLibre الحالي.
   */
  const showAll =
    useCallback(() => {
      const coords:
        Point[] = [];

      if (selectedBusPoint) {
        coords.push({
          lat:
            selectedBusPoint
              .lat,

          lng:
            selectedBusPoint
              .lng,
        });
      }

      if (studentHome) {
        coords.push(
          studentHome
        );
      }

      if (schoolPoint) {
        coords.push(
          schoolPoint
        );
      }

      if (!coords.length) {
        return;
      }

      const centerLat =
        coords.reduce(
          (
            total,
            item
          ) =>
            total +
            item.lat,
          0
        ) / coords.length;

      const centerLng =
        coords.reduce(
          (
            total,
            item
          ) =>
            total +
            item.lng,
          0
        ) / coords.length;

      const latSpan =
        Math.max(
          ...coords.map(
            (item) =>
              item.lat
          )
        ) -
        Math.min(
          ...coords.map(
            (item) =>
              item.lat
          )
        );

      const lngSpan =
        Math.max(
          ...coords.map(
            (item) =>
              item.lng
          )
        ) -
        Math.min(
          ...coords.map(
            (item) =>
              item.lng
          )
        );

      const span =
        Math.max(
          latSpan,
          lngSpan
        );

      let zoom = 15;

      if (span > 0.15) {
        zoom = 10;
      } else if (
        span > 0.08
      ) {
        zoom = 11;
      } else if (
        span > 0.04
      ) {
        zoom = 12;
      } else if (
        span > 0.02
      ) {
        zoom = 13;
      } else if (
        span > 0.008
      ) {
        zoom = 14;
      }

      cameraRef.current?.easeTo(
        {
          center: [
            centerLng,
            centerLat,
          ],

          zoom,

          bearing: 0,

          duration: 700,
        }
      );
    }, [
      selectedBusPoint,
      studentHome,
      schoolPoint,
    ]);

  /*
   * ========================================================
   * بيانات العرض
   * ========================================================
   */
  const studentName =
    nameOfStudent(
      selectedChild?.student ??
        null
    );

  const busNumber =
    selectedChild?.bus
      ?.bus_number ??
    selectedChild?.bus
      ?.number ??
    selectedChild?.student
      ?.bus_number ??
    '—';

  const plateNumber =
    selectedChild?.bus
      ?.plate_number ??
    '—';

  const routeName =
    selectedChild?.route
      ?.name ??
    selectedChild?.route
      ?.route_name ??
    (
      isRTL
        ? 'غير محدد'
        : 'Not assigned'
    );

  const driverName =
    selectedChild?.driver
      ?.full_name ??
    selectedChild?.bus
      ?.driver_name ??
    (
      isRTL
        ? 'غير محدد'
        : 'Not assigned'
    );

  const driverPhone =
    selectedChild?.driver
      ?.phone ??
    selectedChild?.driver
      ?.phone_number ??
    selectedChild?.bus
      ?.driver_phone ??
    null;

  const schoolName =
    selectedChild?.school
      ?.name ??
    selectedChild?.school
      ?.school_name ??
    (
      isRTL
        ? 'غير محدد'
        : 'Not assigned'
    );

  const attendance =
    studentIsExcused
      ? (
          isRTL
            ? 'مجاز / عذر'
            : 'Excused / Leave'
        )
      : statusText(
          selectedChild
            ?.attendance
            ?.status,
          isRTL
        );

  const activePeriodText =
    requestPeriodText(
      selectedApprovedRequest
        ?.trip_period,
      isRTL
    );

  const leaveDateRange =
    requestDateRangeText(
      selectedApprovedRequest,
      isRTL
    );

  const updatedAt =
    selectedBusPoint
      ?.updatedAt ??
    null;

  const age =
    minutesOld(
      updatedAt
    );

  const isLive =
    selectedBusPoint
      ?.source ===
      'live' &&
    age !== null &&
    age <= 2;

  const locationTitle =
    !selectedBusPoint
      ? isRTL
        ? 'لا يوجد موقع'
        : 'No Location'
      : isLive
      ? isRTL
        ? 'مباشر الآن'
        : 'Live Now'
      : isRTL
      ? 'آخر موقع معروف'
      : 'Last Known Location';

  /*
   * السرعة:
   * نعرض القيمة الموجودة نفسها.
   *
   * لا نضرب ×3.6 لأننا لا نريد نفترض
   * الوحدة قبل التأكد من مصدر السائق.
   */
  const speedValue =
    selectedChild
      ?.lastSpeedLocation
      ?.speed;

  const speedText =
    speedValue !== null &&
    speedValue !==
      undefined &&
    Number.isFinite(
      Number(speedValue)
    )
      ? `${Math.max(
          0,
          Math.round(
            Number(speedValue)
          )
        )}`
      : '—';

  const firstMapCenter:
    [number, number] =
    selectedBusPoint
      ? [
          selectedBusPoint.lng,
          selectedBusPoint.lat,
        ]
      : studentHome
      ? [
          studentHome.lng,
          studentHome.lat,
        ]
      : schoolPoint
      ? [
          schoolPoint.lng,
          schoolPoint.lat,
        ]
      : [
          MAP_CONFIG
            .defaultCenter
            .longitude,

          MAP_CONFIG
            .defaultCenter
            .latitude,
        ];

  if (loading) {
    return (
      <View
        style={[
          styles.loading,
          {
            backgroundColor:
              theme.colors
                .background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color="#F7B83A"
        />

        <Text
          style={[
            styles.loadingText,
            {
              color:
                theme.colors
                  .text,
            },
          ]}
        >
          {isRTL
            ? 'جاري قراءة بيانات الأبناء والباص...'
            : 'Loading student and bus data...'}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            theme.colors
              .background,
        },
      ]}
    >
      <Map
        style={
          StyleSheet
            .absoluteFill
        }
        mapStyle={
          MAP_CONFIG
            .developmentStyle
        }
        attribution
        logo
        compass
        androidView="texture"
        onDidFinishLoadingMap={() =>
          setMapReady(true)
        }
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center:
              firstMapCenter,

            zoom:
              selectedBusPoint
                ? MAP_CONFIG
                    .trackingZoom
                : 14,
          }}
          minZoom={4}
          maxZoom={20}
        />

        {/* مدرسة الطالب المحدد */}
        {schoolPoint && (
          <Marker
            id="selected-school"
            lngLat={[
              schoolPoint.lng,
              schoolPoint.lat,
            ]}
            anchor="bottom"
          >
            <MapPin
              icon="school"
              background="#7C3AED"
              label={
                schoolName
              }
            />
          </Marker>
        )}

        {/* بيوت جميع أبناء ولي الأمر فقط */}
        {children.map(
          (child) => {
            const home =
              point(
                child.student
                  ?.home_lat,

                child.student
                  ?.home_lng
              );

            if (!home) {
              return null;
            }

            const active =
              child.student
                ?.id ===
              selectedChild
                ?.student
                ?.id;

            return (
              <Marker
                key={`home-${
                  child.student
                    ?.id
                }`}
                id={`home-${
                  child.student
                    ?.id
                }`}
                lngLat={[
                  home.lng,
                  home.lat,
                ]}
                anchor="bottom"
              >
                <MapPin
                  icon="home"
                  background={
                    active
                      ? '#1676B8'
                      : '#64748B'
                  }
                  label={nameOfStudent(
                    child.student
                  )}
                />
              </Marker>
            );
          }
        )}

        {/* الباص */}
        {selectedBusPoint && (
          <Marker
            id="selected-bus"
            lngLat={[
              selectedBusPoint.lng,
              selectedBusPoint.lat,
            ]}
            anchor="center"
          >
            <View
              style={
                styles.busWrap
              }
            >
              <View
                style={[
                  styles.busMarker,
                  {
                    backgroundColor:
                      isLive
                        ? '#F7B83A'
                        : '#7B8C9A',
                  },
                ]}
              >
                <Ionicons
                  name="bus"
                  size={24}
                  color="#FFFFFF"
                />
              </View>

              <View
                style={
                  styles.mapLabel
                }
              >
                <Text
                  style={
                    styles.mapLabelText
                  }
                  numberOfLines={
                    1
                  }
                >
                  {isRTL
                    ? `الباص ${busNumber}`
                    : `Bus ${busNumber}`}
                </Text>
              </View>
            </View>
          </Marker>
        )}
      </Map>

      <SafeAreaView
        pointerEvents="box-none"
        style={[
          styles.overlay,
          {
            paddingHorizontal:
              responsiveParentMap.horizontalPadding,
          },
        ]}
      >
        {/* HEADER */}
        <View
          pointerEvents="auto"
          style={[
            styles.header,
            {
              width: '100%',
              maxWidth: responsiveParentMap.isTabletSize
                ? 680
                : undefined,
              alignSelf: 'center',
            },
            {
              backgroundColor:
                theme.colors
                  .surface,
            },
          ]}
        >
          <Pressable
            style={[
              styles.headerButton,
              {
                backgroundColor:
                  theme.colors
                    .surface2,
              },
            ]}
            onPress={() =>
              navigation.goBack()
            }
          >
            <Ionicons
              name={
                isRTL
                  ? 'arrow-forward'
                  : 'arrow-back'
              }
              size={25}
              color={
                theme.colors
                  .text
              }
            />
          </Pressable>

          <View
            style={
              styles.headerCenter
            }
          >
            <Text
              style={[
                styles.headerTitle,
                {
                  color:
                    theme.colors
                      .text,
                },
              ]}
            >
              {isRTL
                ? 'تتبع الأبناء'
                : 'Children Tracking'}
            </Text>

            <Text
              style={[
                styles.headerSub,
                {
                  color:
                    theme.colors
                      .textSecondary,
                },
              ]}
            >
              {children.length}{' '}
              {isRTL
                ? 'أبناء'
                : 'children'}
            </Text>
          </View>

          <Pressable
            style={[
              styles.headerButton,
              {
                backgroundColor:
                  theme.colors
                    .surface2,
              },
            ]}
            onPress={
              showAll
            }
          >
            <Ionicons
              name="scan-outline"
              size={23}
              color="#F7B83A"
            />

            <Text
              style={
                styles.headerSmall
              }
            >
              {isRTL
                ? 'عرض الكل'
                : 'All'}
            </Text>
          </Pressable>
        </View>

        {/* ERROR واضح */}
        {!!errorMessage && (
          <View
            pointerEvents="auto"
            style={
              styles.errorBox
            }
          >
            <Ionicons
              name="warning-outline"
              size={20}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.errorText
              }
            >
              {errorMessage}
            </Text>

            <Pressable
              onPress={() =>
                load(true)
              }
            >
              <Ionicons
                name="refresh"
                size={22}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        )}

        {/* أبناء ولي الأمر */}
        {children.length >
          0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.childrenRow
            }
            style={
              styles.childrenScroll
            }
          >
            {children.map(
              (child) => {
                const active =
                  child.student
                    ?.id ===
                  selectedChild
                    ?.student
                    ?.id;

                const childName =
                  nameOfStudent(
                    child.student
                  );

                return (
                  <Pressable
                    key={
                      child.student
                        ?.id
                    }
                    onPress={() =>
                      setSelectedStudentId(
                        child
                          .student
                          ?.id
                      )
                    }
                    style={[
                      styles.childChip,

                      {
                        backgroundColor:
                          active
                            ? '#F7B83A'
                            : theme
                                .colors
                                .surface,
                      },
                    ]}
                  >
                    <View
                      style={
                        styles.childAvatar
                      }
                    >
                      <Text
                        style={
                          styles.childAvatarText
                        }
                      >
                        {initials(
                          childName
                        )}
                      </Text>
                    </View>

                    <Text
                      numberOfLines={
                        1
                      }
                      style={[
                        styles.childName,
                        {
                          color:
                            active
                              ? '#FFFFFF'
                              : theme
                                  .colors
                                  .text,
                        },
                      ]}
                    >
                      {childName}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </ScrollView>
        )}

        <View
          style={{
            flex: 1,
          }}
        />

        {/* زر تحديد الموقع */}
        <View
          style={
            styles.floatControls
          }
        >
          <Pressable
            disabled={
              !selectedBusPoint
            }
            onPress={
              locateBus
            }
            style={[
              styles.floatButton,
              {
                opacity:
                  selectedBusPoint
                    ? 1
                    : 0.45,
              },
            ]}
          >
            <Ionicons
              name="navigate"
              size={24}
              color="#082A40"
            />
          </Pressable>
        </View>

        {/* الكرت الصغير */}
        {selectedChild && (
          <View
            pointerEvents="auto"
            style={[
              styles.bottomCard,
              {
                width: '100%',
                maxWidth: responsiveParentMap.isTabletSize
                  ? 620
                  : undefined,
                alignSelf: 'center',
                maxHeight: responsiveParentMap.isLandscape
                  ? responsiveParentMap.height * 0.48
                  : responsiveParentMap.height * 0.58,
              },
              {
                backgroundColor:
                  theme.colors
                    .surface,
              },
            ]}
          >
            <ScrollView
              testID="responsiveParentCardScroll"
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingBottom: 4 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
            <View
              style={[
                styles.studentHeader,
                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <View
                style={
                  styles.bigAvatar
                }
              >
                <Text
                  style={
                    styles.bigAvatarText
                  }
                >
                  {initials(
                    studentName
                  )}
                </Text>
              </View>

              <View
                style={
                  styles.studentInfo
                }
              >
                <Text
                  numberOfLines={
                    1
                  }
                  style={[
                    styles.studentTitle,
                    {
                      color:
                        theme.colors
                          .text,

                      textAlign,
                    },
                  ]}
                >
                  {studentName}
                </Text>

                <Text
                  style={[
                    styles.updateText,
                    {
                      color:
                        theme.colors
                          .textSecondary,

                      textAlign,
                    },
                  ]}
                >
                  {locationTitle}
                  {' • '}
                  {timeText(
                    updatedAt
                  )}
                </Text>
              </View>

              {refreshing ? (
                <ActivityIndicator
                  color="#F7B83A"
                />
              ) : (
                <Pressable
                  onPress={() =>
                    load(true)
                  }
                  style={
                    styles.refresh
                  }
                >
                  <Ionicons
                    name="refresh"
                    size={21}
                    color="#F7B83A"
                  />
                </Pressable>
              )}
            </View>

            {studentIsExcused && (
              <View
                style={[
                  styles.leaveBanner,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                <View
                  style={
                    styles.leaveIcon
                  }
                >
                  <Ionicons
                    name="calendar"
                    size={22}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={[
                      styles.leaveTitle,
                      {
                        textAlign,
                      },
                    ]}
                  >
                    {isRTL
                      ? 'الطالب مجاز لهذه الفترة'
                      : 'Student is excused for this period'}
                  </Text>

                  <Text
                    style={[
                      styles.leaveSub,
                      {
                        textAlign,
                      },
                    ]}
                  >
                    {activePeriodText}
                    {' • '}
                    {leaveDateRange}
                  </Text>
                </View>
              </View>
            )}

            <View
              style={[
                styles.infoRow,
                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <InfoBox
                icon="bus-outline"
                title={
                  isRTL
                    ? 'الباص'
                    : 'Bus'
                }
                value={String(
                  busNumber
                )}
              />

              <InfoBox
                icon="git-branch-outline"
                title={
                  isRTL
                    ? 'المسار'
                    : 'Route'
                }
                value={
                  routeName
                }
              />

              <InfoBox
                icon="checkmark-circle-outline"
                title={
                  isRTL
                    ? 'حالة الطالب'
                    : 'Status'
                }
                value={
                  attendance
                }
              />
            </View>

            <View
              style={[
                styles.actions,
                {
                  flexDirection:
                    direction,
                },
              ]}
            >
              <Pressable
                disabled={
                  !selectedBusPoint
                }
                onPress={
                  locateBus
                }
                style={[
                  styles.locateAction,
                  {
                    borderColor:
                      theme.colors
                        .border,

                    opacity:
                      selectedBusPoint
                        ? 1
                        : 0.45,
                  },
                ]}
              >
                <Ionicons
                  name="locate-outline"
                  size={19}
                  color={
                    theme.colors
                      .text
                  }
                />

                <Text
                  style={[
                    styles.locateText,
                    {
                      color:
                        theme.colors
                          .text,
                    },
                  ]}
                >
                  {isRTL
                    ? 'موقع الباص'
                    : 'Locate Bus'}
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.detailsAction
                }
                onPress={() =>
                  setDetailsVisible(
                    true
                  )
                }
              >
                <Ionicons
                  name="list-outline"
                  size={20}
                  color="#082A40"
                />

                <Text
                  style={
                    styles.detailsText
                  }
                >
                  {isRTL
                    ? 'عرض التفاصيل'
                    : 'Details'}
                </Text>
              </Pressable>
            </View>
            </ScrollView>
          </View>
        )}
      </SafeAreaView>

      {/* DETAILS MODAL */}
      <Modal
        visible={
          detailsVisible
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setDetailsVisible(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <Pressable
            style={
              StyleSheet
                .absoluteFill
            }
            onPress={() =>
              setDetailsVisible(
                false
              )
            }
          />

          <View
            style={[
              styles.sheet,
              {
                backgroundColor:
                  theme.colors
                    .surface,
                width: '100%',
                maxWidth: responsiveParentMap.isTabletSize
                  ? 680
                  : undefined,
                alignSelf: 'center',
                maxHeight: responsiveParentMap.isLandscape
                  ? '90%'
                  : '72%',
                borderTopLeftRadius: 30,
                borderTopRightRadius: 30,
              },
            ]}
          >
            <View
              style={
                styles.handle
              }
            />

            <View
              style={[
                styles.sheetHeader,
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
                    styles.sheetTitle,
                    {
                      color:
                        theme.colors
                          .text,

                      textAlign,
                    },
                  ]}
                >
                  {isRTL
                    ? 'تفاصيل التتبع'
                    : 'Tracking Details'}
                </Text>

                <Text
                  style={[
                    styles.sheetSub,
                    {
                      color:
                        theme.colors
                          .textSecondary,

                      textAlign,
                    },
                  ]}
                >
                  {studentName}
                </Text>
              </View>

              <Pressable
                style={[
                  styles.closeButton,
                  {
                    backgroundColor:
                      theme.colors
                        .surface2,
                  },
                ]}
                onPress={() =>
                  setDetailsVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={23}
                  color={
                    theme.colors
                      .text
                  }
                />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
            >
              <DetailBox
                icon="person-outline"
                label={
                  isRTL
                    ? 'اسم الطالب'
                    : 'Student'
                }
                value={
                  studentName
                }
              />

              <DetailBox
                icon="business-outline"
                label={
                  isRTL
                    ? 'المدرسة'
                    : 'School'
                }
                value={
                  schoolName
                }
              />

              <DetailBox
                icon="bus-outline"
                label={
                  isRTL
                    ? 'رقم الباص'
                    : 'Bus Number'
                }
                value={String(
                  busNumber
                )}
              />

              <DetailBox
                icon="card-outline"
                label={
                  isRTL
                    ? 'رقم اللوحة'
                    : 'Plate'
                }
                value={String(
                  plateNumber
                )}
              />

              <DetailBox
                icon="git-branch-outline"
                label={
                  isRTL
                    ? 'المسار'
                    : 'Route'
                }
                value={
                  routeName
                }
              />

              <DetailBox
                icon="person-circle-outline"
                label={
                  isRTL
                    ? 'السائق'
                    : 'Driver'
                }
                value={
                  driverName
                }
              />

              <DetailBox
                icon="speedometer-outline"
                label={
                  isRTL
                    ? 'السرعة'
                    : 'Speed'
                }
                value={
                  speedText ===
                  '—'
                    ? '—'
                    : `${speedText} ${
                        isRTL
                          ? 'كم/س'
                          : 'km/h'
                      }`
                }
              />

              <DetailBox
                icon="checkmark-circle-outline"
                label={
                  isRTL
                    ? 'حالة الطالب'
                    : 'Status'
                }
                value={
                  attendance
                }
              />

              {studentIsExcused && (
                <>
                  <DetailBox
                    icon="calendar-outline"
                    label={
                      isRTL
                        ? 'حالة النقل الحالية'
                        : 'Current Transport Status'
                    }
                    value={
                      isRTL
                        ? 'مجاز / عذر'
                        : 'Excused / Leave'
                    }
                  />

                  <DetailBox
                    icon="time-outline"
                    label={
                      isRTL
                        ? 'الفترة'
                        : 'Period'
                    }
                    value={
                      activePeriodText
                    }
                  />

                  <DetailBox
                    icon="calendar-number-outline"
                    label={
                      isRTL
                        ? 'مدة الإجازة'
                        : 'Leave Dates'
                    }
                    value={
                      leaveDateRange
                    }
                  />

                  {!!selectedApprovedRequest?.notes && (
                    <DetailBox
                      icon="document-text-outline"
                      label={
                        isRTL
                          ? 'ملاحظة ولي الأمر'
                          : 'Parent Note'
                      }
                      value={String(
                        selectedApprovedRequest
                          .notes
                      )}
                    />
                  )}
                </>
              )}

              <DetailBox
                icon="radio-outline"
                label={
                  isRTL
                    ? 'حالة الموقع'
                    : 'Tracking'
                }
                value={
                  locationTitle
                }
              />

              <DetailBox
                icon="time-outline"
                label={
                  isRTL
                    ? 'آخر تحديث'
                    : 'Last Update'
                }
                value={fullDateText(
                  updatedAt
                )}
              />

              {driverPhone && (
                <Pressable
                  style={
                    styles.callButton
                  }
                  onPress={() =>
                    Linking.openURL(
                      `tel:${driverPhone}`
                    ).catch(
                      console.log
                    )
                  }
                >
                  <Ionicons
                    name="call"
                    size={21}
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.callText
                    }
                  >
                    {isRTL
                      ? `اتصال بالسائق - ${driverPhone}`
                      : `Call Driver - ${driverPhone}`}
                  </Text>
                </Pressable>
              )}

              <View
                style={{
                  height: 25,
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );

  function InfoBox({
    icon,
    title,
    value,
  }: {
    icon:
      React.ComponentProps<
        typeof Ionicons
      >['name'];

    title: string;
    value: string;
  }) {
    return (
      <View
        style={[
          styles.infoBox,
          {
            backgroundColor:
              theme.colors
                .surface2,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color="#F7B83A"
        />

        <Text
          style={[
            styles.infoLabel,
            {
              color:
                theme.colors
                  .textSecondary,
            },
          ]}
        >
          {title}
        </Text>

        <Text
          numberOfLines={
            1
          }
          style={[
            styles.infoValue,
            {
              color:
                theme.colors
                  .text,
            },
          ]}
        >
          {value}
        </Text>
      </View>
    );
  }

  function DetailBox({
    icon,
    label,
    value,
  }: {
    icon:
      React.ComponentProps<
        typeof Ionicons
      >['name'];

    label: string;
    value: string;
  }) {
    return (
      <View
        style={[
          styles.detailBox,
          {
            backgroundColor:
              theme.colors
                .surface2,

            flexDirection:
              direction,
          },
        ]}
      >
        <View
          style={
            styles.detailIcon
          }
        >
          <Ionicons
            name={icon}
            size={20}
            color="#F7B83A"
          />
        </View>

        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={[
              styles.detailLabel,
              {
                color:
                  theme.colors
                    .textSecondary,

                textAlign,
              },
            ]}
          >
            {label}
          </Text>

          <Text
            selectable
            style={[
              styles.detailValue,
              {
                color:
                  theme.colors
                    .text,

                textAlign,
              },
            ]}
          >
            {value}
          </Text>
        </View>
      </View>
    );
  }
}

function MapPin({
  icon,
  background,
  label,
}: {
  icon:
    React.ComponentProps<
      typeof Ionicons
    >['name'];

  background: string;
  label: string;
}) {
  return (
    <View
      style={
        styles.pinWrap
      }
    >
      <View
        style={[
          styles.pin,
          {
            backgroundColor:
              background,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={22}
          color="#FFFFFF"
        />
      </View>

      <View
        style={
          styles.mapLabel
        }
      >
        <Text
          numberOfLines={1}
          style={
            styles.mapLabelText
          }
        >
          {label}
        </Text>
      </View>
    </View>
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
      padding: 25,
    },

    loadingText: {
      marginTop: 12,
      fontSize: 14,
      fontWeight: '700',
      textAlign:
        'center',
    },

    overlay: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 13,
    },

    header: {
      minHeight: 75,
      borderRadius: 25,
      padding: 10,
      flexDirection: 'row',
      alignItems:
        'center',

      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 5,
      },
      shadowOpacity: 0.16,
      shadowRadius: 15,
      elevation: 9,
    },

    headerButton: {
      width: 54,
      height: 54,
      borderRadius: 18,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    headerCenter: {
      flex: 1,
      alignItems:
        'center',
    },

    headerTitle: {
      fontSize: 23,
      fontWeight: '900',
    },

    headerSub: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '600',
    },

    headerSmall: {
      marginTop: 1,
      color: '#F7B83A',
      fontSize: 8,
      fontWeight: '800',
    },

    errorBox: {
      marginTop: 9,
      minHeight: 48,
      borderRadius: 16,
      paddingHorizontal: 13,
      backgroundColor: '#C0392B',
      flexDirection: 'row',
      alignItems:
        'center',
      gap: 8,
    },

    errorText: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },

    childrenScroll: {
      flexGrow: 0,
      marginTop: 10,
    },

    childrenRow: {
      gap: 9,
      paddingRight: 5,
    },

    childChip: {
      height: 50,
      minWidth: 135,
      maxWidth: 205,
      borderRadius: 17,
      paddingHorizontal: 9,
      flexDirection: 'row',
      alignItems:
        'center',

      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.12,
      shadowRadius: 7,
      elevation: 4,
    },

    childAvatar: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor:
        'rgba(255,255,255,0.22)',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    childAvatarText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },

    childName: {
      flex: 1,
      marginHorizontal: 9,
      fontSize: 13,
      fontWeight: '900',
    },

    floatControls: {
      alignSelf:
        'flex-end',
      marginBottom: 10,
    },

    floatButton: {
      width: 53,
      height: 53,
      borderRadius: 27,
      backgroundColor:
        '#FFFFFF',
      alignItems:
        'center',
      justifyContent:
        'center',

      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.2,
      shadowRadius: 9,
      elevation: 7,
    },

    bottomCard: {
      borderRadius: 27,
      padding: 14,

      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 12,
    },

    studentHeader: {
      alignItems:
        'center',
    },

    bigAvatar: {
      width: 52,
      height: 52,
      borderRadius: 17,
      backgroundColor:
        '#F7B83A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    bigAvatarText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },

    studentInfo: {
      flex: 1,
      marginHorizontal: 11,
    },

    studentTitle: {
      fontSize: 19,
      fontWeight: '900',
    },

    updateText: {
      marginTop: 3,
      fontSize: 10,
      fontWeight: '600',
    },

    refresh: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    leaveBanner: {
      marginTop: 11,
      borderRadius: 18,
      padding: 11,
      alignItems: 'center',
      gap: 10,
      backgroundColor: '#16A66A',
    },

    leaveIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    leaveTitle: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },

    leaveSub: {
      marginTop: 3,
      color: 'rgba(255,255,255,0.9)',
      fontSize: 9,
      fontWeight: '700',
    },

    infoRow: {
      gap: 7,
      marginTop: 11,
    },

    infoBox: {
      flex: 1,
      minHeight: 64,
      borderRadius: 16,
      padding: 6,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    infoLabel: {
      marginTop: 2,
      fontSize: 8,
    },

    infoValue: {
      marginTop: 2,
      fontSize: 10,
      fontWeight: '900',
      textAlign:
        'center',
    },

    actions: {
      gap: 8,
      marginTop: 10,
    },

    locateAction: {
      flex: 1,
      height: 44,
      borderRadius: 15,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 6,
    },

    locateText: {
      fontSize: 11,
      fontWeight: '800',
    },

    detailsAction: {
      flex: 1.1,
      height: 44,
      borderRadius: 15,
      backgroundColor:
        '#F7B83A',
      flexDirection: 'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 6,
    },

    detailsText: {
      color: '#082A40',
      fontSize: 12,
      fontWeight: '900',
    },

    pinWrap: {
      alignItems:
        'center',
    },

    pin: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 4,
      borderColor:
        '#FFFFFF',
      alignItems:
        'center',
      justifyContent:
        'center',

      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.2,
      shadowRadius: 7,
      elevation: 6,
    },

    busWrap: {
      alignItems:
        'center',
    },

    busMarker: {
      width: 54,
      height: 54,
      borderRadius: 19,
      borderWidth: 4,
      borderColor:
        '#FFFFFF',
      alignItems:
        'center',
      justifyContent:
        'center',

      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.22,
      shadowRadius: 8,
      elevation: 8,
    },

    mapLabel: {
      marginTop: 3,
      maxWidth: 150,
      backgroundColor:
        '#082A40',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },

    mapLabelText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '800',
    },

    modalOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.45)',
      justifyContent:
        'flex-end',
    },

    sheet: {
      maxHeight: '72%',
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 17,
      paddingTop: 9,
    },

    handle: {
      width: 50,
      height: 5,
      borderRadius: 3,
      backgroundColor:
        '#8395A7',
      opacity: 0.6,
      alignSelf:
        'center',
      marginBottom: 11,
    },

    sheetHeader: {
      alignItems:
        'center',
      marginBottom: 13,
    },

    sheetTitle: {
      fontSize: 20,
      fontWeight: '900',
    },

    sheetSub: {
      marginTop: 2,
      fontSize: 11,
    },

    closeButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    detailBox: {
      minHeight: 63,
      marginBottom: 8,
      padding: 10,
      borderRadius: 17,
      alignItems:
        'center',
    },

    detailIcon: {
      width: 39,
      height: 39,
      borderRadius: 13,
      backgroundColor:
        'rgba(247,184,58,0.14)',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginHorizontal: 8,
    },

    detailLabel: {
      fontSize: 9,
      fontWeight: '600',
    },

    detailValue: {
      marginTop: 2,
      fontSize: 13,
      fontWeight: '900',
    },

    callButton: {
      marginTop: 5,
      height: 49,
      borderRadius: 16,
      backgroundColor:
        '#14B866',
      flexDirection: 'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 8,
    },

    callText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
    },
  });