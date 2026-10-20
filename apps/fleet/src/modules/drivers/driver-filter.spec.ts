import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FleetDriverCondition } from '../../generated/graphql/types.js';
import { driverConditions } from './driver-filter.js';

describe('Driver conditions', () => {
  it('normalizes assigned vehicle IDs and preserves contradictory independent conditions', () => {
    const id = randomUUID();
    expect(
      driverConditions([
        { statuses: ['ACTIVE'], vehicleIds: [id.toUpperCase()], scoreFrom: 0, scoreTo: 100 },
        {
          excludedStatuses: ['ACTIVE'],
          excludedVehicleIds: [id],
          hasVehicle: false,
          hasScore: false,
        },
        { licenseExpiresOnFrom: '2026-10-18', licenseExpiresOnTo: '2026-10-18' },
      ]),
    ).toEqual([
      expect.objectContaining({
        statuses: ['ACTIVE'],
        vehicleIds: [id],
        scoreFrom: 0,
        scoreTo: 100,
      }),
      expect.objectContaining({
        excludedStatuses: ['ACTIVE'],
        excludedVehicleIds: [id],
        hasVehicle: false,
        hasScore: false,
      }),
      expect.objectContaining({
        licenseExpiresOnFrom: '2026-10-18',
        licenseExpiresOnTo: '2026-10-18',
      }),
    ]);
  });

  it('accepts exact limits without inventing filters for absent conditions', () => {
    expect(driverConditions(undefined)).toBeUndefined();
    expect(driverConditions(null)).toBeUndefined();
    expect(driverConditions([])).toEqual([]);
    expect(
      driverConditions(Array.from({ length: 50 }, () => ({ tripCountAbove: 0 }))),
    ).toHaveLength(50);
    expect(
      driverConditions([
        {
          scoreAbove: 0,
          scoreBelow: 100,
          distanceKmFrom: 0,
          distanceKmTo: 10_000_000,
          tripCountBelow: 2_147_483_647,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        scoreAbove: 0,
        scoreBelow: 100,
        distanceKmFrom: 0,
        distanceKmTo: 10_000_000,
        tripCountBelow: 2_147_483_647,
      }),
    ]);
  });

  it('rejects invalid input before it could widen a list query', () => {
    const invalid: FleetDriverCondition[] = [
      { scoreFrom: 80, scoreTo: 70 },
      { scoreAbove: -1 },
      { scoreBelow: 101 },
      { distanceKmFrom: 100, distanceKmTo: 10 },
      { distanceKmAbove: -1 },
      { distanceKmBelow: 10_000_001 },
      { tripCountAbove: 1.5 },
      { tripCountBelow: -1 },
      { licenseExpiresOnBefore: '2026-02-30' },
      { licenseExpiresOnFrom: '2026-11-01', licenseExpiresOnTo: '2026-10-18' },
      { tachographCardExpiresOnAfter: 'not-a-date' },
      { vehicleIds: [] },
      { excludedVehicleIds: ['vehicle'] },
      { excludedStatuses: [] },
    ];
    for (const condition of invalid) {
      expect(() => driverConditions([condition])).toThrow(BadRequestException);
    }
    expect(() => driverConditions(Array.from({ length: 51 }, () => ({})))).toThrow(
      BadRequestException,
    );
    const malformed: FleetDriverCondition = {};
    Reflect.set(malformed, 'hasScore', 'yes');
    expect(() => driverConditions([malformed])).toThrow(BadRequestException);
  });
});
