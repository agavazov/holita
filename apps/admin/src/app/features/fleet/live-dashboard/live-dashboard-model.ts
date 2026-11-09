import type {
  AdminLiveFleetQuery,
  AdminLiveTrackQuery,
  FleetActivityStatus,
  FleetEventSeverity,
} from '../../../../generated/graphql/operations';
import { mapCoordinates, type MapCoordinates } from '../../../ui/map-preview/location-map';
import { isoToZonedParts, zonedWallTimeToIso } from '../../../ui/format/zoned-time';

export type TruckFilter = 'all' | 'online' | 'moving' | 'problems';
export const truckFilters: readonly TruckFilter[] = ['all', 'online', 'moving', 'problems'];

export type TrailWindow = 'hour' | 'sixHours' | 'today' | 'day';
export const trailWindows: readonly TrailWindow[] = ['hour', 'sixHours', 'day', 'today'];

/** One truck as the list and the map show it. */
export interface LiveTruck {
  readonly id: string;
  readonly plate: string;
  readonly vehicle: string | null;
  readonly group: string | null;
  readonly driver: string | null;
  readonly online: boolean;
  readonly activity: FleetActivityStatus;
  readonly position: MapCoordinates | null;
  readonly positionAt: string | null;
  readonly heading: number | null;
  readonly speedKph: number | null;
  readonly address: string | null;
  readonly odometerKm: number | null;
  readonly ignition: boolean | null;
  /** Problems that require attention plus warning lamps that are on now. */
  readonly problems: number;
  readonly severity: FleetEventSeverity | null;
}

const severityRank: Record<FleetEventSeverity, number> = { INFO: 0, WARNING: 1, CRITICAL: 2 };

function worstSeverity(
  left: FleetEventSeverity | null,
  right: FleetEventSeverity | null,
): FleetEventSeverity | null {
  if (!left || !right) {
    return left ?? right;
  }
  return severityRank[left] >= severityRank[right] ? left : right;
}

export function liveTrucks(data: AdminLiveFleetQuery): LiveTruck[] {
  const vehicles = new Map(data.fleetVehicles.items.map((vehicle) => [vehicle.id, vehicle]));
  const problems = new Map<string, { count: number; severity: FleetEventSeverity | null }>();
  for (const problem of data.fleetProblems.items) {
    if (problem.vehicleId) {
      const current = problems.get(problem.vehicleId) ?? { count: 0, severity: null };
      problems.set(problem.vehicleId, {
        count: current.count + 1,
        severity: worstSeverity(current.severity, problem.severity),
      });
    }
  }
  return data.fleetMap.items
    .map((item): LiveTruck => {
      const vehicle = vehicles.get(item.vehicle.id);
      const position = mapCoordinates(item.position?.latitude, item.position?.longitude);
      const lit =
        vehicle?.currentWarnings.filter(
          (lamp) => lamp.state === 'RED' || lamp.state === 'YELLOW',
        ) ?? [];
      const lamps = lit.length;
      const lampSeverity: FleetEventSeverity | null = lit.some((lamp) => lamp.state === 'RED')
        ? 'CRITICAL'
        : lamps
          ? 'WARNING'
          : null;
      const problem = problems.get(item.vehicle.id);
      const driver = vehicle?.currentDriver;
      return {
        id: item.vehicle.id,
        plate: item.vehicle.licensePlate,
        vehicle: [vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || null,
        group: vehicle?.group?.name ?? null,
        driver: driver ? `${driver.firstName} ${driver.lastName}` : null,
        online: item.live,
        activity: item.activity,
        position,
        positionAt: item.position?.recordedAt ?? null,
        heading: item.position?.headingDeg ?? null,
        speedKph: item.position?.speedKph ?? vehicle?.state.speedKph ?? null,
        address: vehicle?.state.address ?? null,
        odometerKm: vehicle?.state.odometerKm ?? null,
        ignition: vehicle?.state.ignition ?? null,
        problems: (problem?.count ?? 0) + lamps,
        severity: worstSeverity(problem?.severity ?? null, lampSeverity),
      };
    })
    .sort(
      (left, right) =>
        Number(right.online) - Number(left.online) || left.plate.localeCompare(right.plate),
    );
}

/** Only an online truck is moving now; an old MOVING report of an offline truck is not motion. */
export function isMoving(truck: LiveTruck): boolean {
  return truck.online && truck.activity === 'MOVING';
}

export function truckMatches(truck: LiveTruck, filter: TruckFilter, search: string): boolean {
  const term = search.trim().toLocaleLowerCase();
  const found =
    !term ||
    [truck.plate, truck.vehicle, truck.driver, truck.group, truck.address].some((value) =>
      value?.toLocaleLowerCase().includes(term),
    );
  return (
    found &&
    (filter === 'all' ||
      (filter === 'online' && truck.online) ||
      (filter === 'moving' && isMoving(truck)) ||
      (filter === 'problems' && truck.problems > 0))
  );
}

export type TrailPoint = AdminLiveTrackQuery['fleetVehicleSamples']['items'][number];

function reportKey(point: TrailPoint): string {
  return `${point.deviceImei ?? ''}|${String(Date.parse(point.recordedAt))}`;
}

/** Adds newer reports to the trail; one device report never appears twice. */
export function mergeTrail(
  current: readonly TrailPoint[],
  incoming: readonly TrailPoint[],
): TrailPoint[] {
  const known = new Set(current.map(reportKey));
  return [...current, ...incoming.filter((point) => !known.has(reportKey(point)))].sort(
    (left, right) =>
      left.recordedAt.localeCompare(right.recordedAt) || left.id.localeCompare(right.id),
  );
}

/** The recorded report closest to a clicked point of the trail. */
export function nearestPoint(
  points: readonly TrailPoint[],
  target: MapCoordinates,
): TrailPoint | null {
  const scale = Math.cos((target.latitude * Math.PI) / 180);
  let nearest: TrailPoint | null = null;
  let best = Infinity;
  for (const point of points) {
    const position = mapCoordinates(point.latitude, point.longitude);
    if (position) {
      const distance =
        (position.latitude - target.latitude) ** 2 +
        ((position.longitude - target.longitude) * scale) ** 2;
      if (distance < best) {
        best = distance;
        nearest = point;
      }
    }
  }
  return nearest;
}

export type SpeedBand = 'normal' | 'over' | 'far';

export interface TrailLine {
  readonly band: SpeedBand;
  readonly path: readonly MapCoordinates[];
}

/** A step more than ten minutes long is a reporting gap, never a driven line. */
const maxStepMs = 10 * 60_000;

export function speedBand(speedKph: number | null | undefined, limitKph: number): SpeedBand {
  return speedKph === null || speedKph === undefined || speedKph <= limitKph
    ? 'normal'
    : speedKph <= limitKph + 10
      ? 'over'
      : 'far';
}

/**
 * Joins recorded positions only. A missing position, a device change or a reporting gap starts a
 * new line; consecutive steps in the same speed band share one line.
 */
export function trailLines(points: readonly TrailPoint[], limitKph: number): TrailLine[] {
  const lines: { band: SpeedBand; path: MapCoordinates[] }[] = [];
  let previous: { point: TrailPoint; position: MapCoordinates } | null = null;
  /** Whether the last line ends at the previous point and may continue. */
  let open = false;
  for (const point of points) {
    const position = mapCoordinates(point.latitude, point.longitude);
    if (!position) {
      previous = null;
      open = false;
      continue;
    }
    if (
      previous &&
      previous.point.deviceImei === point.deviceImei &&
      Date.parse(point.recordedAt) - Date.parse(previous.point.recordedAt) <= maxStepMs
    ) {
      const band = speedBand(Math.max(previous.point.speedKph ?? 0, point.speedKph ?? 0), limitKph);
      const last = open ? lines.at(-1) : undefined;
      if (last?.band === band) {
        last.path.push(position);
      } else {
        lines.push({ band, path: [previous.position, position] });
      }
      open = true;
    } else {
      open = false;
    }
    previous = { point, position };
  }
  return lines;
}

/** The start of a trail window; "today" starts at midnight in the Branch time zone. */
export function trailStart(window: TrailWindow, now: Date, timeZone: string): string {
  if (window === 'today') {
    const parts = isoToZonedParts(now.toISOString(), timeZone);
    if (parts) {
      return zonedWallTimeToIso({ ...parts, hour: 0, minute: 0 }, timeZone);
    }
  }
  const hours = window === 'hour' ? 1 : window === 'sixHours' ? 6 : 24;
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}
