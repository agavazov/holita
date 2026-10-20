import { beforeAll, describe, expect, it } from '@jest/globals';
import { createHash } from 'node:crypto';
import { DEMO_SCOPE } from '../prisma/demo/catalog.js';
import { demoOptions } from '../prisma/demo/config.js';
import { generateFleetDemo, type FleetDemoDataset } from '../prisma/demo/generate.js';
import { DEMO_CLOCK_SAMPLE_ID, demoId, masterId } from '../prisma/demo/ids.js';
import { DEMO_ANCHOR, DAY_MS, addDays, sofiaDate, sofiaInstant } from '../prisma/demo/time.js';

const anchor = new Date(DEMO_ANCHOR);
const databaseUrl = 'postgresql://holita_fleet:local@127.0.0.1:11084/holita_fleet';
const environment = {
  nodeEnv: 'development',
  databaseUrl,
  coreUrl: 'http://127.0.0.1:11011/graphql',
};
const epoch = (value: Date | string): number =>
  typeof value === 'string' ? Date.parse(value) : value.getTime();

describe('Fleet rich demo generation', () => {
  let data: FleetDemoDataset;
  beforeAll(() => {
    data = generateFleetDemo({ anchor });
  });

  it('is deterministic, scoped, ID-stable and independent of process time', () => {
    const digest = (value: FleetDemoDataset) =>
      createHash('sha256').update(JSON.stringify(value)).digest('hex');
    expect(digest(generateFleetDemo({ anchor }))).toBe(digest(data));
    expect(demoId('event', 'a')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    for (const rows of [
      data.groups,
      data.drivers,
      data.vehicles,
      data.devices,
      data.serviceTasks,
      data.trips,
      data.samples,
      data.events,
    ]) {
      expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
      expect(rows.map((row) => row.id)).toEqual(
        rows.map((row) => row.id).sort((left, right) => left.localeCompare(right)),
      );
      expect(
        rows.every(
          (row) => row.tenantId === DEMO_SCOPE.tenantId && row.branchId === DEMO_SCOPE.branchId,
        ),
      ).toBe(true);
    }
  });

  it('includes adopted master-data edge states and four real unassigned stock devices', () => {
    expect(data.groups).toHaveLength(5);
    expect(data.drivers).toHaveLength(36);
    expect(data.vehicles).toHaveLength(46);
    expect(data.devices).toHaveLength(48);
    expect(data.devices.filter((row) => row.vehicleId == null)).toHaveLength(4);
    expect(data.devices.filter((row) => row.vehicleId != null)).toHaveLength(44);
    expect(data.vehicles.filter((row) => row.groupId === masterId('group', 5))).toEqual([]);
    expect(data.vehicles.filter((row) => row.status === 'INACTIVE')).toHaveLength(3);
    expect(data.drivers.filter((row) => row.status === 'ACTIVE')).toHaveLength(30);
    expect(
      Array.from(data.vehicles.find((row) => row.id === masterId('vehicle', 33))?.notes ?? ''),
    ).toHaveLength(2000);
    expect(data.devices.some((row) => row.imei.startsWith('00'))).toBe(true);
    expect(
      data.drivers.some((row) => row.employeeNumber == null && row.licenseExpiresOn == null),
    ).toBe(true);
    expect(new Set(data.serviceTasks.map((row) => row.status))).toEqual(
      new Set(['PLANNED', 'DONE', 'CANCELLED']),
    );
    expect(
      data.serviceTasks.filter((row) => row.status === 'DONE' && row.costCents === 0),
    ).toHaveLength(3);
  });

  it('keeps 31-day activity and at least 15 days of sample coverage at or before the fixed clock', () => {
    const clock = data.samples.find((row) => row.id === DEMO_CLOCK_SAMPLE_ID);
    expect(clock?.recordedAt).toEqual(anchor);
    expect(clock?.source).toBe('DEMO');
    expect(data.samples.every((row) => epoch(row.recordedAt) <= anchor.getTime())).toBe(true);
    expect(Math.min(...data.samples.map((row) => epoch(row.recordedAt)))).toBeLessThanOrEqual(
      anchor.getTime() - 15 * DAY_MS,
    );
    expect(data.trips.every((row) => epoch(row.startedAt) <= anchor.getTime())).toBe(true);
    expect(data.events.every((row) => epoch(row.occurredAt) <= anchor.getTime())).toBe(true);
    expect(data.trips.some((row) => row.distanceKm === 0)).toBe(true);
    expect(data.trips.some((row) => row.distanceKm === 1120)).toBe(true);
    expect(data.samples.some((row) => row.latitude === 0 && row.longitude === 0)).toBe(true);
    expect(
      data.events.filter((row) => row.severity === 'CRITICAL' && row.alertStatus === 'OPEN'),
    ).toHaveLength(4);
    const poolTrips = data.trips.filter((row) => row.driverId === masterId('driver', 33));
    expect(poolTrips).toHaveLength(3);
    expect(poolTrips.every((row) => row.drivingScore != null)).toBe(true);
  });

  it('resolves Sofia calendar instants across daylight-saving changes', () => {
    expect(sofiaDate(anchor)).toBe('2026-10-18');
    expect(sofiaInstant('2026-10-18', 9 * 60 + 30)).toEqual(anchor);
    expect(sofiaInstant('2026-10-26', 9 * 60 + 30).toISOString()).toBe('2026-10-26T07:30:00.000Z');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
});

describe('Fleet demo CLI guard', () => {
  const now = anchor.getTime() + DAY_MS;
  it('accepts explicit local development and isolated dedicated-test targets', () => {
    expect(demoOptions([], environment, now).anchor).toEqual(anchor);
    const testSchema = `test_${'a'.repeat(32)}`;
    expect(
      demoOptions(
        ['--as-of', DEMO_ANCHOR],
        {
          ...environment,
          nodeEnv: 'test',
          databaseUrl: `postgresql://holita_fleet_test:local@localhost:11084/holita_fleet_test?schema=${testSchema}`,
        },
        now,
      ).schema,
    ).toBe(testSchema);
  });
  it.each([
    { ...environment, nodeEnv: 'production' },
    { ...environment, databaseUrl: databaseUrl.replace('127.0.0.1', 'db.example.com') },
    { ...environment, databaseUrl: databaseUrl + '?schema=other' },
    { ...environment, databaseUrl: databaseUrl + '?options=-csearch_path=other' },
    { ...environment, databaseUrl: databaseUrl.replace('/holita_fleet', '/holita_core') },
    { ...environment, databaseUrl: databaseUrl.replace('holita_fleet:local', 'admin:private') },
    { ...environment, coreUrl: 'http://core.example.com/graphql' },
  ])('rejects unsafe environment configuration without echoing it', (unsafe) => {
    expect(() => demoOptions([], unsafe, now)).toThrow(/^Fleet demo seed/);
  });
  it('rejects future, normalized-invalid and unknown anchor arguments', () => {
    expect(() => demoOptions([], environment, anchor.getTime() - 1)).toThrow('before its anchor');
    expect(() => demoOptions(['--as-of=2026-02-30T00:00:00.000Z'], environment, now)).toThrow(
      'valid UTC',
    );
    expect(() => demoOptions(['--tenant-id=foreign'], environment, now)).toThrow('accepts only');
  });
});
