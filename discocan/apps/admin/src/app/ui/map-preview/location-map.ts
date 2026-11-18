export interface MapCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export function mapCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): MapCoordinates | null {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

function coordinateQuery(point: MapCoordinates): string {
  return `${String(point.latitude)},${String(point.longitude)}`;
}

export function locationMap(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | null {
  const point = mapCoordinates(latitude, longitude);
  if (!point) {
    return null;
  }
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', coordinateQuery(point));
  return url.href;
}
