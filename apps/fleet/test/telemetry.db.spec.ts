import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { createTestDatabase } from './test-database.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
const otherTenantId = randomUUID();
// Data clock of branch 1; the business clock is 30 minutes later.
const asOf = new Date('2026-10-18T06:30:00.000Z');
const now = new Date('2026-10-18T07:00:00.000Z');
const minutes = (value: number) => new Date(asOf.getTime() + value * 60_000);
const imei = '990601000000001';

describe('Telemetry, data clock and odometer readings with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;
  const requireBranch = jest.fn<CoreClient['requireBranch']>().mockResolvedValue(undefined);
  const branchId = randomUUID(),
    otherBranchId = randomUUID();
  let vehicleId: string;
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(CoreClient)
      .useValue({ requireBranch })
      .overrideProvider(FleetClock)
      .useValue({ now: () => now })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/graphql`;
    // Branch 1 vehicle: odometer only on the older sample, latest sample parked without it.
    const vehicle = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'CB 1043 AX' },
    });
    vehicleId = vehicle.id;
    await database.client.device.create({ data: { tenantId, branchId, vehicleId, imei } });
    await database.client.vehicleStatusSample.createMany({
      data: [
        {
          tenantId,
          branchId,
          vehicleId,
          deviceImei: imei,
          source: 'DEMO',
          recordedAt: minutes(-120),
          receivedAt: minutes(-120),
          ignition: true,
          speedKph: 70,
          odometerKm: 1000,
          fuelLevelPct: 60,
        },
        {
          tenantId,
          branchId,
          vehicleId,
          deviceImei: imei,
          source: 'DEMO',
          recordedAt: asOf,
          receivedAt: asOf,
          ignition: false,
          speedKph: 0,
          latitude: 42.69,
          longitude: 23.32,
          address: 'бул. „Христо Ботев“ 1, Пловдив',
          fuelLevelPct: 50,
        },
      ],
    });
    // Later device samples of another Branch and another Tenant never move this data clock.
    for (const [scopeTenant, scopeBranch, at] of [
      [tenantId, otherBranchId, minutes(60)],
      [otherTenantId, branchId, minutes(120)],
    ] as const) {
      const other = await database.client.vehicle.create({
        data: { tenantId: scopeTenant, branchId: scopeBranch, licensePlate: 'ELSEWHERE' },
      });
      await database.client.vehicleStatusSample.create({
        data: {
          tenantId: scopeTenant,
          branchId: scopeBranch,
          vehicleId: other.id,
          deviceImei: imei,
          source: 'DEMO',
          recordedAt: at,
          receivedAt: at,
        },
      });
    }
  });
  beforeEach(() => {
    requireBranch.mockClear();
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await closeDatabase?.();
    }
  });
  async function query(
    source: string,
    variables: Record<string, unknown> = {},
    scopeBranch = branchId,
    scopeTenant = tenantId,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(scopeTenant)}`,
        'x-branch-id': scopeBranch,
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    return body;
  }
  const clock = '{fleetDataClock{asOf businessDate timeZone}}';
  const state =
    'query($id:ID!){fleetVehicle(id:$id){state{activity lastReportedAt fuelLevelPct fuelStatus address odometerKm odometerRecordedAt odometerSource}}}';
  const record =
    'mutation($input:RecordFleetOdometerReadingInput!){recordFleetOdometerReading(input:$input){id vehicleId deviceImei source recordedAt receivedAt odometerKm speedKph}}';

  it('derives the data clock from device samples of the scoped Branch only', async () => {
    expect(await query(clock)).toEqual({
      data: {
        fleetDataClock: {
          asOf: asOf.toISOString(),
          businessDate: '2026-10-18',
          timeZone: 'Europe/Sofia',
        },
      },
    });
    expect(await query(clock, {}, otherBranchId)).toMatchObject({
      data: { fleetDataClock: { asOf: minutes(60).toISOString() } },
    });
    expect(await query(clock, {}, randomUUID())).toMatchObject({
      data: { fleetDataClock: { asOf: null, businessDate: '2026-10-18' } },
    });
    // A MANUAL row later than every device sample (inserted directly) is ignored.
    const manualOnly = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'MANUAL ONLY' },
    });
    await database.client.vehicleStatusSample.create({
      data: {
        tenantId,
        branchId,
        vehicleId: manualOnly.id,
        source: 'MANUAL',
        recordedAt: minutes(25),
        receivedAt: minutes(25),
        odometerKm: 5,
      },
    });
    expect(await query(clock)).toMatchObject({
      data: { fleetDataClock: { asOf: asOf.toISOString() } },
    });
    expect(await query(state, { id: manualOnly.id })).toMatchObject({
      data: {
        fleetVehicle: {
          state: { activity: 'NO_DEVICE', odometerKm: 5, odometerSource: 'MANUAL' },
        },
      },
    });
  });

  it('records a MANUAL reading that changes the odometer but neither the clock nor the activity', async () => {
    expect(await query(state, { id: vehicleId })).toEqual({
      data: {
        fleetVehicle: {
          state: {
            activity: 'PARKED',
            lastReportedAt: asOf.toISOString(),
            fuelLevelPct: 50,
            fuelStatus: 'NORMAL',
            address: 'бул. „Христо Ботев“ 1, Пловдив',
            odometerKm: 1000,
            odometerRecordedAt: minutes(-120).toISOString(),
            odometerSource: 'DEMO',
          },
        },
      },
    });
    expect(
      await query(record, {
        input: { vehicleId, odometerKm: 1050.04, recordedAt: '2026-10-18T08:30:00+03:00' },
      }),
    ).toMatchObject({
      data: {
        recordFleetOdometerReading: {
          vehicleId,
          deviceImei: null,
          source: 'MANUAL',
          recordedAt: minutes(-60).toISOString(),
          receivedAt: now.toISOString(),
          odometerKm: 1050,
          speedKph: null,
        },
      },
    });
    expect(requireBranch).toHaveBeenCalledTimes(1);
    expect(await query(clock)).toMatchObject({
      data: { fleetDataClock: { asOf: asOf.toISOString() } },
    });
    expect(await query(state, { id: vehicleId })).toMatchObject({
      data: {
        fleetVehicle: {
          state: {
            activity: 'PARKED',
            lastReportedAt: asOf.toISOString(),
            odometerKm: 1050,
            odometerRecordedAt: minutes(-60).toISOString(),
            odometerSource: 'MANUAL',
          },
        },
      },
    });
  });

  it('rejects readings outside the clock, before the previous reading, lower, or on other vehicles', async () => {
    const inactive = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'RETIRED', status: 'INACTIVE' },
    });
    const foreign = await database.client.vehicle.create({
      data: { tenantId, branchId: otherBranchId, licensePlate: 'FOREIGN' },
    });
    const before = await database.client.vehicleStatusSample.count({ where: { branchId } });
    for (const [input, path] of [
      [{ vehicleId, odometerKm: 1100, recordedAt: minutes(0.001).toISOString() }, 'recordedAt'],
      [{ vehicleId, odometerKm: 1100, recordedAt: minutes(-60).toISOString() }, 'recordedAt'],
      [{ vehicleId, odometerKm: 1049.9, recordedAt: minutes(-30).toISOString() }, 'odometerKm'],
      [{ vehicleId, odometerKm: -1, recordedAt: minutes(-30).toISOString() }, 'odometerKm'],
      [{ vehicleId, odometerKm: 1100, recordedAt: '2026-10-18T06:00:00' }, 'recordedAt'],
      [{ vehicleId: inactive.id, odometerKm: 1, recordedAt: asOf.toISOString() }, 'vehicleId'],
      [{ vehicleId: foreign.id, odometerKm: 1, recordedAt: asOf.toISOString() }, 'vehicleId'],
    ] satisfies [Record<string, unknown>, string][])
      expect(await query(record, { input })).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path }] } }],
      });
    expect(await database.client.vehicleStatusSample.count({ where: { branchId } })).toBe(before);
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('returns ascending samples of any source in a half-open window of at most seven days', async () => {
    const series =
      'query($vehicleId:ID!,$from:DateTime!,$to:DateTime!){fleetVehicleSamples(vehicleId:$vehicleId,from:$from,to:$to){vehicleId from to truncated items{source recordedAt odometerKm}}}';
    expect(
      await query(series, {
        vehicleId,
        from: minutes(-120).toISOString(),
        to: asOf.toISOString(),
      }),
    ).toEqual({
      data: {
        fleetVehicleSamples: {
          vehicleId,
          from: minutes(-120).toISOString(),
          to: asOf.toISOString(),
          truncated: false,
          items: [
            { source: 'DEMO', recordedAt: minutes(-120).toISOString(), odometerKm: 1000 },
            { source: 'MANUAL', recordedAt: minutes(-60).toISOString(), odometerKm: 1050 },
          ],
        },
      },
    });
    expect(
      await query(series, {
        vehicleId,
        from: '2026-10-11T06:30:00Z',
        to: '2026-10-18T06:30:00.001Z',
      }),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'to' }] } }] });
    expect(
      await query(
        series,
        { vehicleId, from: minutes(-120).toISOString(), to: asOf.toISOString() },
        otherBranchId,
      ),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
  });

  it('caps a series at the newest 2,000 samples', async () => {
    const busy = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'BUSY' },
    });
    const start = new Date('2026-10-15T00:00:00.000Z');
    await database.client.vehicleStatusSample.createMany({
      data: Array.from({ length: 2005 }, (_, index) => ({
        tenantId,
        branchId,
        vehicleId: busy.id,
        deviceImei: '990601000000002',
        source: 'DEMO' as const,
        recordedAt: new Date(start.getTime() + index * 60_000),
        receivedAt: start,
      })),
    });
    const body = await query(
      'query($vehicleId:ID!,$from:DateTime!,$to:DateTime!){fleetVehicleSamples(vehicleId:$vehicleId,from:$from,to:$to){truncated items{recordedAt}}}',
      { vehicleId: busy.id, from: start.toISOString(), to: '2026-10-17T00:00:00Z' },
    );
    expect(body).toMatchObject({ data: { fleetVehicleSamples: { truncated: true } } });
    const items = JSON.stringify(body).match(/"recordedAt":"[^"]+"/g) ?? [];
    expect(items).toHaveLength(2000);
    expect(items[0]).toBe(`"recordedAt":"${new Date(start.getTime() + 5 * 60_000).toISOString()}"`);
    expect(items.at(-1)).toBe(
      `"recordedAt":"${new Date(start.getTime() + 2004 * 60_000).toISOString()}"`,
    );
  });
});
