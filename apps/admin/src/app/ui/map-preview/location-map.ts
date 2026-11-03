export interface MapCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export type GoogleMapView = 'place' | 'streetview' | 'directions';

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

/** Value equality, so a re-read of the same place keeps the map's view and frame. */
export function sameCoordinates(a: MapCoordinates | null, b: MapCoordinates | null): boolean {
  return a === b || (!!a && !!b && a.latitude === b.latitude && a.longitude === b.longitude);
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

export function googleMapStreetView(point: MapCoordinates): string {
  const url = new URL('https://www.google.com/maps/@');
  url.searchParams.set('api', '1');
  url.searchParams.set('map_action', 'pano');
  url.searchParams.set('viewpoint', coordinateQuery(point));
  return url.href;
}

export function googleMapEmbed(
  key: string,
  language: string,
  origin: MapCoordinates,
  destination: MapCoordinates | null,
  view: GoogleMapView,
): string {
  const url = new URL(`https://www.google.com/maps/embed/v1/${view}`);
  url.searchParams.set('key', key);
  url.searchParams.set('language', language);
  if (view === 'directions' && destination) {
    url.searchParams.set('origin', coordinateQuery(origin));
    url.searchParams.set('destination', coordinateQuery(destination));
    url.searchParams.set('mode', 'driving');
  } else if (view === 'streetview') {
    url.searchParams.set('location', coordinateQuery(origin));
  } else {
    url.searchParams.set('q', coordinateQuery(origin));
    url.searchParams.set('zoom', '15');
  }
  return url.href;
}
