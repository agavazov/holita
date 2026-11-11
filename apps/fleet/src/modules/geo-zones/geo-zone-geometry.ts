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
