/** GeoJSON ring: [longitude, latitude] pairs, closed (the first point repeats as the last). */
export type Ring = readonly (readonly [number, number])[];

export interface GeoZoneShape {
  readonly id: string;
  readonly ring: Ring;
  readonly minLatitude: number;
  readonly maxLatitude: number;
  readonly minLongitude: number;
  readonly maxLongitude: number;
}

export interface PositionSample {
  readonly id: string;
  readonly vehicleId: string;
  readonly recordedAt: Date;
  readonly latitude: number;
  readonly longitude: number;
}

export interface ZoneState {
  readonly kind: 'ENTER' | 'EXIT';
  readonly occurredAt: Date;
}

export interface ZoneTransition extends ZoneState {
  readonly zoneId: string;
  readonly vehicleId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly sampleId: string;
}

export function ringBounds(ring: Ring) {
  const latitudes = ring.map(([, latitude]) => latitude);
  const longitudes = ring.map(([longitude]) => longitude);
  return {
    minLatitude: Math.min(...latitudes),
    maxLatitude: Math.max(...latitudes),
    minLongitude: Math.min(...longitudes),
    maxLongitude: Math.max(...longitudes),
  };
}

export function polygonJson(ring: Ring) {
  return {
    type: 'Polygon',
    coordinates: [ring.map(([longitude, latitude]) => [longitude, latitude])],
  };
}

/** Outer ring of a stored GeoJSON Polygon. */
export function storedRing(polygon: unknown): Ring {
  if (typeof polygon !== 'object' || polygon === null || !('coordinates' in polygon)) {
    return [];
  }
  const outer: unknown = Array.isArray(polygon.coordinates) ? polygon.coordinates[0] : undefined;
  if (!Array.isArray(outer)) {
    return [];
  }
  return outer.flatMap((point: unknown): [number, number][] =>
    Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number'
      ? [[point[0], point[1]]]
      : [],
  );
}

/** Bounding-box prefilter, then even-odd ray casting in degrees. */
export function containsPoint(zone: GeoZoneShape, latitude: number, longitude: number): boolean {
  if (
    latitude < zone.minLatitude ||
    latitude > zone.maxLatitude ||
    longitude < zone.minLongitude ||
    longitude > zone.maxLongitude
  ) {
    return false;
  }
  let inside = false;
  const ring = zone.ring;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] ?? [0, 0];
    const [xj, yj] = ring[j] ?? [0, 0];
    if (
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function stateKey(vehicleId: string, zoneId: string): string {
  return `${vehicleId}/${zoneId}`;
}

/**
 * Entries and exits for samples in time order per vehicle. A vehicle without a previous event is
 * outside; samples not later than the last event of a vehicle and zone are ignored.
 */
export function zoneTransitions(
  zones: readonly GeoZoneShape[],
  samples: readonly PositionSample[],
  state: Map<string, ZoneState>,
): ZoneTransition[] {
  const ordered = [...samples].sort(
    (a, b) =>
      a.vehicleId.localeCompare(b.vehicleId) || a.recordedAt.getTime() - b.recordedAt.getTime(),
  );
  const transitions: ZoneTransition[] = [];
  for (const sample of ordered) {
    if (sample.latitude === 0 && sample.longitude === 0) {
      continue;
    }
    for (const zone of zones) {
      const key = stateKey(sample.vehicleId, zone.id);
      const previous = state.get(key);
      if (previous && sample.recordedAt <= previous.occurredAt) {
        continue;
      }
      const inside = containsPoint(zone, sample.latitude, sample.longitude);
      if (inside === (previous?.kind === 'ENTER')) {
        continue;
      }
      const transition: ZoneTransition = {
        zoneId: zone.id,
        vehicleId: sample.vehicleId,
        kind: inside ? 'ENTER' : 'EXIT',
        occurredAt: sample.recordedAt,
        latitude: sample.latitude,
        longitude: sample.longitude,
        sampleId: sample.id,
      };
      state.set(key, transition);
      transitions.push(transition);
    }
  }
  return transitions;
}

export const MAX_ZONE_VERTICES = 2000;

/** Field error code and message when the vertices do not form a simple polygon, else null. */
export function ringProblem(
  points: readonly { latitude: number; longitude: number }[],
): { code: 'TOO_MANY_ITEMS' | 'OUT_OF_RANGE' | 'INVALID_VALUE'; message: string } | null {
  const open = [...points];
  const first = open[0];
  const last = open.at(-1);
  if (
    open.length > 1 &&
    first &&
    last &&
    first.latitude === last.latitude &&
    first.longitude === last.longitude
  ) {
    open.pop();
  }
  if (open.length < 3 || open.length > MAX_ZONE_VERTICES) {
    return {
      code: 'TOO_MANY_ITEMS',
      message: `Use 3 to ${String(MAX_ZONE_VERTICES)} vertices.`,
    };
  }
  if (
    open.some(
      (point) =>
        !Number.isFinite(point.latitude) ||
        !Number.isFinite(point.longitude) ||
        Math.abs(point.latitude) > 90 ||
        Math.abs(point.longitude) > 180,
    )
  ) {
    return {
      code: 'OUT_OF_RANGE',
      message: 'Use latitudes from -90 to 90 and longitudes from -180 to 180.',
    };
  }
  const ring: Ring = open.map((point) => [point.longitude, point.latitude]);
  const n = ring.length;
  const vertex = (index: number) => ring[index % n] ?? [0, 0];
  if (
    new Set(ring.map(([longitude, latitude]) => `${String(longitude)},${String(latitude)}`))
      .size !== n
  ) {
    return { code: 'INVALID_VALUE', message: 'Do not repeat a vertex.' };
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) {
        continue;
      }
      if (segmentsCross(vertex(i), vertex(i + 1), vertex(j), vertex(j + 1))) {
        return { code: 'INVALID_VALUE', message: 'The zone outline must not cross itself.' };
      }
    }
  }
  return null;
}

/** Closed ring in [longitude, latitude] order from validated vertices. */
export function closedRing(points: readonly { latitude: number; longitude: number }[]): Ring {
  const ring: [number, number][] = points.map((point) => [point.longitude, point.latitude]);
  const first = ring[0];
  const last = ring.at(-1);
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

function orientation(
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
): number {
  return Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
}

function onSegment(
  a: readonly [number, number],
  b: readonly [number, number],
  p: readonly [number, number],
): boolean {
  return (
    Math.min(a[0], b[0]) <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] &&
    p[1] <= Math.max(a[1], b[1])
  );
}

function segmentsCross(
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
  d: readonly [number, number],
): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) {
    return true;
  }
  return (
    (o1 === 0 && onSegment(a, b, c)) ||
    (o2 === 0 && onSegment(a, b, d)) ||
    (o3 === 0 && onSegment(c, d, a)) ||
    (o4 === 0 && onSegment(c, d, b))
  );
}
