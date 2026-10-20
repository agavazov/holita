import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FleetTripCondition } from '../../generated/graphql/types.js';
import { tripConditions } from './trip-filter.js';

describe('Trip conditions', () => {
  it('normalizes independent periods and IDs without merging repeated conditions', () => {
    const vehicleId = randomUUID();
    const driverId = randomUUID();
    const conditions = tripConditions([
      {
        startedFrom: '2026-10-18T00:00:00+03:00',
        startedTo: '2026-10-19T00:00:00+03:00',
        vehicleIds: [vehicleId.toUpperCase()],
        excludedDriverIds: [driverId.toUpperCase()],
      },
      { excludedVehicleIds: [vehicleId], hasDriver: false, hasEvents: false },
    ]);
    expect(conditions).toEqual([
      expect.objectContaining({
        startedFrom: new Date('2026-10-17T21:00:00Z'),
        startedTo: new Date('2026-10-18T21:00:00Z'),
        vehicleIds: [vehicleId],
        excludedDriverIds: [driverId],
      }),
      expect.objectContaining({
        excludedVehicleIds: [vehicleId],
        hasDriver: false,
        hasEvents: false,
      }),
    ]);
  });

  it('accepts inclusive distance boundaries and score thresholds including zero', () => {
    expect(
      tripConditions([
        {
          distanceKmFrom: 0,
          distanceKmTo: 5000,
          distanceKmAbove: 0,
          distanceKmBelow: 5000,
          drivingScoreAbove: 0,
          drivingScoreBelow: 100,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        distanceKmFrom: 0,
        distanceKmTo: 5000,
        distanceKmAbove: 0,
        distanceKmBelow: 5000,
        drivingScoreAbove: 0,
        drivingScoreBelow: 100,
      }),
    ]);
    expect(tripConditions(undefined)).toBeUndefined();
    expect(tripConditions(null)).toBeUndefined();
    expect(tripConditions([])).toEqual([]);
    expect(tripConditions(Array.from({ length: 50 }, () => ({ hasEvents: true })))).toHaveLength(
      50,
    );
  });

  it('rejects invalid conditions rather than dropping them and broadening the query', () => {
    const invalidConditions: FleetTripCondition[] = [
      { distanceKmAbove: -0.001 },
      { distanceKmBelow: 5000.001 },
      { distanceKmFrom: 2, distanceKmTo: 1 },
      { distanceKmTo: Number.POSITIVE_INFINITY },
      { drivingScoreAbove: -1 },
      { drivingScoreBelow: 100.01 },
      { vehicleIds: [] },
      { excludedVehicleIds: ['vehicle'] },
      { excludedDriverIds: [] },
      { startedFrom: '2026-10-18' },
      { startedFrom: '2026-10-18T00:00:00Z', startedTo: '2026-10-18T00:00:00Z' },
    ];
    for (const condition of invalidConditions) {
      expect(() => tripConditions([condition])).toThrow(BadRequestException);
    }
    expect(() => tripConditions(Array.from({ length: 51 }, () => ({ hasEvents: true })))).toThrow(
      BadRequestException,
    );
    const malformed: FleetTripCondition = {};
    Reflect.set(malformed, 'hasEvents', 'yes');
    expect(() => tripConditions([malformed])).toThrow(BadRequestException);
  });
});
