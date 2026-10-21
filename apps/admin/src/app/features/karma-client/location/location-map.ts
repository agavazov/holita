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

export function googleMapDirections(origin: MapCoordinates, destination: MapCoordinates): string {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', coordinateQuery(origin));
  url.searchParams.set('destination', coordinateQuery(destination));
  url.searchParams.set('travelmode', 'driving');
  return url.href;
}

export function googleMapEmbed(
  key: string,
  language: string,
  origin: MapCoordinates,
  destination: MapCoordinates | null,
): string {
  const url = new URL(
    `https://www.google.com/maps/embed/v1/${destination ? 'directions' : 'place'}`,
  );
  url.searchParams.set('key', key);
  url.searchParams.set('language', language);
  if (destination) {
    url.searchParams.set('origin', coordinateQuery(origin));
    url.searchParams.set('destination', coordinateQuery(destination));
    url.searchParams.set('mode', 'driving');
  } else {
    url.searchParams.set('q', coordinateQuery(origin));
    url.searchParams.set('zoom', '15');
  }
  return url.href;
}
