import type { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import type { FleetEventKind } from '../../src/generated/prisma/enums.js';
import { DEMO_SCOPE } from './catalog.js';
import { demoId } from './ids.js';
import { DAY_MS, HOUR_MS } from './time.js';

const SLOT_MS = 1.5 * DAY_MS;
const scorecardAddress = 'Synthetic driver scorecard demonstration';
const demoDriverNotes = [
  'Synthetic demonstration person; not an employee record.',
  'Измислен шофьор за демонстрация на автопарка.',
];
const maneuvers: readonly FleetEventKind[] = [
  'HARSH_ACCELERATION',
  'HARSH_BRAKING',
  'SPEED_BUMP',
  'OVERTAKING',
  'ROUNDABOUT',
  'LANE_CHANGE',
  'SHARP_TURN',
  'OFF_ROAD',
  'SPEEDING',
];

/** Adds scored DEMO trips only for explicitly fictional drivers with existing assignments. */
export function seedDriverScorecards(client: PrismaClient) {
  return client.$transaction(async (transaction) => {
    const clock = await transaction.vehicleStatusSample.aggregate({
      where: { ...DEMO_SCOPE, deviceImei: { not: null } },
      _max: { recordedAt: true },
    });
    const anchor = clock._max.recordedAt;
    if (!anchor) {
      throw new Error('Fleet demo scorecards require an existing Branch data clock.');
    }
    const drivers = await transaction.driver.findMany({
      where: { ...DEMO_SCOPE, status: 'ACTIVE', notes: { in: demoDriverNotes } },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    const vehicles = await transaction.vehicle.findMany({
      where: { ...DEMO_SCOPE, currentDriverId: { in: drivers.map((driver) => driver.id) } },
      orderBy: { id: 'asc' },
      select: { id: true, currentDriverId: true },
    });
    // The scorecard follows the moving data clock, so a later run adds the trips after the newest one.
    const latest = await transaction.trip.groupBy({
      by: ['driverId'],
      where: {
        ...DEMO_SCOPE,
        source: 'DEMO',
        startAddress: scorecardAddress,
        driverId: { in: drivers.map((driver) => driver.id) },
      },
      _max: { startedAt: true },
    });
    const newest = anchor.getTime() - 0.5 * DAY_MS;
    const trips: Prisma.TripCreateManyInput[] = [];
    const events: Prisma.FleetEventCreateManyInput[] = [];
    let driverCount = 0;
    for (const [profile, driver] of drivers.entries()) {
      const vehicle = vehicles.find((row) => row.currentDriverId === driver.id);
      if (!vehicle) {
        continue;
      }
      driverCount++;
      const previous = latest.find((row) => row.driverId === driver.id)?._max.startedAt;
      // Sixty completed trips cover the 7-, 30- and 90-day scorecard windows.
      const starts = previous
        ? Array.from(
            { length: Math.max(0, Math.floor((newest - previous.getTime()) / SLOT_MS)) },
            (_, index) => previous.getTime() + (index + 1) * SLOT_MS,
          )
        : Array.from({ length: 60 }, (_, index) => newest - index * SLOT_MS);
      for (const start of starts) {
        const startedAt = new Date(start);
        const tripId = demoId('trip', `driver-scorecard:${driver.id}:${startedAt.toISOString()}`);
        const ordinal = Math.floor(start / SLOT_MS) % 60;
        const distanceKm = 65 + ((ordinal * 37 + profile * 19) % 280);
        const drivingScore = 62 + ((profile * 7) % 25) + Math.floor((59 - ordinal) / 10);
        trips.push({
          id: tripId,
          ...DEMO_SCOPE,
          vehicleId: vehicle.id,
          driverId: driver.id,
          source: 'DEMO',
          startedAt,
          endedAt: new Date(startedAt.getTime() + 5 * HOUR_MS),
          startAddress: scorecardAddress,
          endAddress: scorecardAddress,
          distanceKm,
          idleSeconds: 90 + ((ordinal * 43 + profile * 17) % 900),
          maxSpeedKph: 75 + ((ordinal + profile) % 20),
          drivingScore,
          ecoScore: 60 + ((profile * 11) % 31) + Math.floor((59 - ordinal) / 15),
          createdAt: anchor,
        });
        const count = drivingScore < 75 ? 3 + (ordinal % 3) : 1 + (ordinal % 2);
        for (let event = 0; event < count; event++) {
          const kind = maneuvers[(ordinal + profile + event) % maneuvers.length];
          if (!kind) {
            throw new Error('Fleet demo scorecard maneuver is missing.');
          }
          events.push({
            id: demoId('event', `${tripId}:scorecard:${String(event)}`),
            ...DEMO_SCOPE,
            vehicleId: vehicle.id,
            driverId: driver.id,
            tripId,
            source: 'DEMO',
            occurredAt: new Date(startedAt.getTime() + (event + 1) * 30 * 60_000),
            kind,
            severity: 'INFO',
            intensity: 1 + ((ordinal + event) % 3),
            details: 'Synthetic driver scorecard demonstration; not device-reported telemetry.',
            createdAt: anchor,
            updatedAt: anchor,
          });
        }
      }
    }
    const insertedTrips = await transaction.trip.createMany({ data: trips, skipDuplicates: true });
    const insertedEvents = await transaction.fleetEvent.createMany({
      data: events,
      skipDuplicates: true,
    });
    return {
      drivers: driverCount,
      trips: insertedTrips.count,
      events: insertedEvents.count,
      anchor,
    };
  });
}
