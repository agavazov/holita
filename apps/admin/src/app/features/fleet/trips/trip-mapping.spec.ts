import type { AdminTripDetailsFragment } from '../../../../generated/graphql/operations';
import { tripKpis, tripRow } from './trip-mapping';
const trip: AdminTripDetailsFragment = {
  id: '70000000-0000-4000-8000-000000000001',
  branchId: '10000000-0000-4000-8000-000000000001',
  vehicleId: '20000000-0000-4000-8000-000000000001',
  vehicle: { id: '20000000-0000-4000-8000-000000000001', licensePlate: 'CB 1001 AX' },
  driverId: null,
  driver: null,
  startedAt: '2026-10-18T05:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  startAddress: null,
  endAddress: null,
  distanceKm: null,
  maxSpeedKph: null,
  fuelUsedL: null,
  drivingScore: null,
  inProgress: false,
  drivingEvents: [],
};
describe('Trip mappings', () => {
  it('preserves missing end/telemetry and the backend in-progress classification', () => {
    expect(tripRow(trip, 'en')).toMatchObject({
      endedAt: null,
      durationMin: null,
      distanceKm: null,
      score: null,
      inProgress: false,
      driverName: null,
      events: [],
    });
    expect(
      tripRow({ ...trip, durationSeconds: 0, distanceKm: 0, fuelUsedL: 0, drivingScore: 0 }, 'en'),
    ).toMatchObject({ durationMin: 0, distanceKm: 0, fuelUsedL: 0, score: 0 });
  });
  it('projects every real event with its ID, localization and severity rather than placeholder events', () => {
    const row = tripRow(
      {
        ...trip,
        durationSeconds: 90,
        drivingEvents: [
          {
            id: 'event-a',
            occurredAt: trip.startedAt,
            kind: 'HARSH_BRAKING',
            severity: 'CRITICAL',
            details: 'Brake event.',
          },
          {
            id: 'event-b',
            occurredAt: trip.startedAt,
            kind: 'SHARP_TURN',
            severity: 'WARNING',
            details: null,
          },
        ],
      },
      'bg',
    );
    expect(row.durationMin).toBe(1.5);
    expect(row.events).toEqual([
      {
        id: 'event-a',
        at: trip.startedAt,
        kind: 'Рязко спиране',
        detail: 'Brake event.',
        tone: 'danger',
      },
      { id: 'event-b', at: trip.startedAt, kind: 'Остър завой', detail: '', tone: 'warn' },
    ]);
  });
  it('uses the whole-Branch server arithmetic mean without weighting or rounding it', () => {
    expect(
      tripKpis({
        totalTrips: 2,
        distanceKm: 100,
        totalDurationSeconds: 90,
        averageDrivingScore: 50.25,
        totalManeuverEvents: 3,
      }),
    ).toEqual({ trips: 2, distanceKm: 100, drivingMin: 1.5, averageScore: 50.25, events: 3 });
  });
});
