export type RoutingPoint = {
  latitude: number;
  longitude: number;
};

export type TrafficLevel = 'unknown' | 'low' | 'moderate' | 'heavy' | 'severe';

export type DrivingRouteResult = {
  geometry: {
    type: 'Feature';
    properties: Record<string, never>;
    geometry: { type: 'LineString'; coordinates: number[][] };
  };
  trafficGeometry: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      properties: { congestion: TrafficLevel; congestionNumeric: number | null };
      geometry: { type: 'LineString'; coordinates: number[][] };
    }>;
  } | null;
  distanceMeters: number;
  durationSeconds: number;
  typicalDurationSeconds: number | null;
  delaySeconds: number | null;
  nextInstruction: string | null;
  nextRoadName: string | null;
  provider: 'mapbox-traffic' | 'osm-de' | 'osrm';
  trafficAware: boolean;
  hasCongestion: boolean;
  hasSevereCongestion: boolean;
  alternativeCount: number;
};

const ENV_BASE =
  process.env.EXPO_PUBLIC_ROUTING_BASE_URL?.replace(/\/+$/, '') || null;

const MAPBOX_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ||
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim() ||
  null;

const FALLBACK_PROVIDERS = ENV_BASE
  ? [{ name: 'osrm' as const, base: ENV_BASE, prefix: '/route/v1/driving' }]
  : [
      { name: 'osm-de' as const, base: 'https://routing.openstreetmap.de', prefix: '/routed-car/route/v1/driving' },
      { name: 'osrm' as const, base: 'https://router.project-osrm.org', prefix: '/route/v1/driving' },
    ];

function coordinate(p: RoutingPoint) {
  return `${p.longitude},${p.latitude}`;
}

function toRadians(v: number) {
  return (v * Math.PI) / 180;
}

export function straightDistanceMeters(a: RoutingPoint, b: RoutingPoint) {
  const earth = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function instructionFromStep(step: any): string | null {
  if (!step) return null;
  const maneuver = step.maneuver ?? {};
  const type = String(maneuver.type ?? '').replace(/_/g, ' ').trim();
  const modifier = String(maneuver.modifier ?? '').replace(/_/g, ' ').trim();
  const road = String(step.name ?? '').trim();
  const parts = [type, modifier, road ? `onto ${road}` : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

function levelOf(value: unknown): TrafficLevel {
  const v = String(value ?? '').toLowerCase();
  if (v === 'low' || v === 'moderate' || v === 'heavy' || v === 'severe') return v;
  return 'unknown';
}

function buildTrafficGeometry(route: any) {
  const coords: number[][] = route?.geometry?.coordinates ?? [];
  const annotation = route?.legs?.[0]?.annotation ?? {};
  const levels: unknown[] = annotation?.congestion ?? [];
  const numeric: Array<number | null> = annotation?.congestion_numeric ?? [];
  if (coords.length < 2 || (!levels.length && !numeric.length)) return null;

  const count = Math.min(coords.length - 1, Math.max(levels.length, numeric.length));
  const features: any[] = [];

  for (let i = 0; i < count; i += 1) {
    const raw = numeric[i] === null || numeric[i] === undefined ? null : Number(numeric[i]);
    let level = levelOf(levels[i]);

    if (level === 'unknown' && Number.isFinite(raw)) {
      if ((raw as number) >= 80) level = 'severe';
      else if ((raw as number) >= 60) level = 'heavy';
      else if ((raw as number) >= 35) level = 'moderate';
      else level = 'low';
    }

    features.push({
      type: 'Feature',
      properties: {
        congestion: level,
        congestionNumeric: Number.isFinite(raw) ? raw : null,
      },
      geometry: {
        type: 'LineString',
        coordinates: [coords[i], coords[i + 1]],
      },
    });
  }

  return { type: 'FeatureCollection' as const, features };
}

function congestionScore(route: any) {
  const a = route?.legs?.[0]?.annotation ?? {};
  const numeric: Array<number | null> = a?.congestion_numeric ?? [];
  const values = numeric.map(Number).filter(Number.isFinite);
  if (values.length) {
    return values.filter(v => v >= 80).length * 8 +
      values.filter(v => v >= 60 && v < 80).length * 3 +
      values.filter(v => v >= 35 && v < 60).length;
  }
  return (a?.congestion ?? []).reduce((score: number, raw: unknown) => {
    const level = levelOf(raw);
    return score + (level === 'severe' ? 8 : level === 'heavy' ? 3 : level === 'moderate' ? 1 : 0);
  }, 0);
}

function trafficResult(route: any, alternatives: number): DrivingRouteResult | null {
  if (!route?.geometry?.coordinates?.length) return null;
  const steps = route?.legs?.[0]?.steps ?? [];
  const next = steps.find((s: any) => Number(s?.distance ?? 0) > 10) ?? steps[0] ?? null;
  const trafficGeometry = buildTrafficGeometry(route);
  const features = trafficGeometry?.features ?? [];
  const hasSevereCongestion = features.some((f: any) =>
    f.properties?.congestion === 'severe' || Number(f.properties?.congestionNumeric ?? 0) >= 80
  );
  const hasCongestion = features.some((f: any) =>
    ['moderate', 'heavy', 'severe'].includes(String(f.properties?.congestion ?? '')) ||
    Number(f.properties?.congestionNumeric ?? 0) >= 35
  );
  const duration = Number(route.duration ?? 0);
  const typical = Number(route.duration_typical ?? route?.legs?.[0]?.duration_typical ?? NaN);

  return {
    geometry: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.geometry.coordinates } },
    trafficGeometry,
    distanceMeters: Number(route.distance ?? 0),
    durationSeconds: duration,
    typicalDurationSeconds: Number.isFinite(typical) ? typical : null,
    delaySeconds: Number.isFinite(typical) ? Math.max(0, duration - typical) : null,
    nextInstruction: instructionFromStep(next),
    nextRoadName: next?.name ? String(next.name) : null,
    provider: 'mapbox-traffic',
    trafficAware: true,
    hasCongestion,
    hasSevereCongestion,
    alternativeCount: alternatives,
  };
}

async function requestTraffic(
  origin: RoutingPoint,
  destination: RoutingPoint,
  heading?: number | null,
  signal?: AbortSignal
): Promise<DrivingRouteResult | null> {
  if (!MAPBOX_TOKEN) return null;

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    overview: 'full',
    geometries: 'geojson',
    steps: 'true',
    alternatives: 'true',
    annotations: 'distance,duration,speed,congestion,congestion_numeric',
    depart_at: 'now',
    continue_straight: 'true',
  });

  const h = Number(heading);
  if (Number.isFinite(h)) {
    const normalized = ((h % 360) + 360) % 360;
    params.set('bearings', `${Math.round(normalized)},90;`);
    params.set('radiuses', '100;100');
    params.set('avoid_maneuver_radius', '80');
  }

  const url =
    'https://api.mapbox.com/directions/v5/mapbox/driving-traffic/' +
    `${coordinate(origin)};${coordinate(destination)}?${params.toString()}`;

  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) return null;
  const json = await response.json();
  const routes: any[] = Array.isArray(json?.routes) ? json.routes : [];
  if (!routes.length) return null;

  const ranked = [...routes].sort((a, b) => {
    const da = Number(a?.duration ?? Number.POSITIVE_INFINITY);
    const db = Number(b?.duration ?? Number.POSITIVE_INFINITY);
    if (Math.abs(da - db) <= 90) {
      const congestionDiff = congestionScore(a) - congestionScore(b);
      if (congestionDiff !== 0) return congestionDiff;
    }
    return da - db;
  });

  return trafficResult(ranked[0], Math.max(0, routes.length - 1));
}

async function requestFallback(
  provider: (typeof FALLBACK_PROVIDERS)[number],
  origin: RoutingPoint,
  destination: RoutingPoint,
  signal?: AbortSignal
): Promise<DrivingRouteResult | null> {
  const url =
    `${provider.base}${provider.prefix}/${coordinate(origin)};${coordinate(destination)}` +
    '?overview=full&geometries=geojson&steps=true&alternatives=true';

  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) return null;
  const json = await response.json();
  const routes: any[] = Array.isArray(json?.routes) ? json.routes : [];
  const route = routes[0];
  if (!route?.geometry?.coordinates?.length) return null;

  const steps = route?.legs?.[0]?.steps ?? [];
  const next = steps.find((s: any) => Number(s?.distance ?? 0) > 10) ?? steps[0] ?? null;

  return {
    geometry: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.geometry.coordinates } },
    trafficGeometry: null,
    distanceMeters: Number(route.distance ?? 0),
    durationSeconds: Number(route.duration ?? 0),
    typicalDurationSeconds: null,
    delaySeconds: null,
    nextInstruction: instructionFromStep(next),
    nextRoadName: next?.name ? String(next.name) : null,
    provider: provider.name,
    trafficAware: false,
    hasCongestion: false,
    hasSevereCongestion: false,
    alternativeCount: Math.max(0, routes.length - 1),
  };
}

export async function getDrivingRoute(
  origin: RoutingPoint,
  destination: RoutingPoint,
  signal?: AbortSignal,
  options?: { heading?: number | null }
): Promise<DrivingRouteResult | null> {
  let lastError: unknown = null;

  if (MAPBOX_TOKEN) {
    try {
      const result = await requestTraffic(origin, destination, options?.heading, signal);
      if (result) return result;
    } catch (error: any) {
      if (error?.name === 'AbortError') throw error;
      lastError = error;
    }
  }

  for (const provider of FALLBACK_PROVIDERS) {
    try {
      const result = await requestFallback(provider, origin, destination, signal);
      if (result) return result;
    } catch (error: any) {
      if (error?.name === 'AbortError') throw error;
      lastError = error;
    }
  }

  if (lastError) console.log('[routing] all providers failed:', lastError);
  return null;
}

async function osrmTable(
  base: string,
  prefix: string,
  origin: RoutingPoint,
  destinations: RoutingPoint[],
  signal?: AbortSignal
) {
  const points = [origin, ...destinations];
  const coords = points.map(coordinate).join(';');
  const indexes = destinations.map((_, i) => i + 1).join(';');
  const url = `${base}${prefix}/${coords}?sources=0&destinations=${indexes}&annotations=distance,duration`;
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) return null;
  const json = await response.json();
  return {
    durations: (json?.durations?.[0] ?? []) as Array<number | null>,
    distances: (json?.distances?.[0] ?? []) as Array<number | null>,
  };
}

async function mapboxMatrix(
  origin: RoutingPoint,
  destinations: RoutingPoint[],
  signal?: AbortSignal
) {
  if (!MAPBOX_TOKEN || !destinations.length) return null;
  const limited = destinations.slice(0, 9);
  const coords = [origin, ...limited].map(coordinate).join(';');
  const indexes = limited.map((_, i) => i + 1).join(';');
  const url =
    `https://api.mapbox.com/directions-matrix/v1/mapbox/driving-traffic/${coords}` +
    `?sources=0&destinations=${indexes}&annotations=distance,duration&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) return null;
  const json = await response.json();
  return {
    durations: (json?.durations?.[0] ?? []) as Array<number | null>,
    distances: (json?.distances?.[0] ?? []) as Array<number | null>,
  };
}

export async function getNearestDrivingIndex(
  origin: RoutingPoint,
  destinations: RoutingPoint[],
  signal?: AbortSignal
): Promise<{ index: number; distanceMeters: number | null; durationSeconds: number | null } | null> {
  if (!destinations.length) return null;

  const directNearest = () => {
    let index = 0;
    let distance = Number.POSITIVE_INFINITY;
    destinations.forEach((p, i) => {
      const d = straightDistanceMeters(origin, p);
      if (d < distance) { distance = d; index = i; }
    });
    return { index, distanceMeters: Number.isFinite(distance) ? distance : null, durationSeconds: null };
  };

  const choose = (table: { durations: Array<number | null>; distances: Array<number | null> } | null) => {
    if (!table) return null;
    let index = -1;
    let duration = Number.POSITIVE_INFINITY;
    table.durations.forEach((v, i) => {
      const d = Number(v);
      if (Number.isFinite(d) && d >= 0 && d < duration) { duration = d; index = i; }
    });
    if (index < 0) return null;
    const distance = Number(table.distances[index]);
    return {
      index,
      durationSeconds: Number.isFinite(duration) ? duration : null,
      distanceMeters: Number.isFinite(distance) ? distance : null,
    };
  };

  if (MAPBOX_TOKEN) {
    try {
      const picked = choose(await mapboxMatrix(origin, destinations, signal));
      if (picked) return picked;
    } catch (error: any) {
      if (error?.name === 'AbortError') throw error;
    }
  }

  const providers = ENV_BASE
    ? [{ base: ENV_BASE, prefix: '/table/v1/driving' }]
    : [
        { base: 'https://routing.openstreetmap.de', prefix: '/routed-car/table/v1/driving' },
        { base: 'https://router.project-osrm.org', prefix: '/table/v1/driving' },
      ];

  for (const provider of providers) {
    try {
      const picked = choose(await osrmTable(provider.base, provider.prefix, origin, destinations, signal));
      if (picked) return picked;
    } catch (error: any) {
      if (error?.name === 'AbortError') throw error;
    }
  }

  return directNearest();
}