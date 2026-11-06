import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import type { Prisma } from '../src/generated/prisma/client.js';
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
      .useValue({
        requireBranch: jest.fn<CoreClient['requireBranch']>().mockResolvedValue(undefined),
      })
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
    scope: string = branchId,
    scopeTenant = tenantId,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(scopeTenant)}`,
        'x-branch-id': scope,
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

    // A MANUAL reading changes the odometer but neither the clock nor the activity.
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

    // Readings outside the clock, before or below the previous reading, or on other vehicles fail.
    const inactive = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'RETIRED', status: 'INACTIVE' },
    });
    const foreign = await database.client.vehicle.create({
      data: { tenantId, branchId: otherBranchId, licensePlate: 'FOREIGN' },
    });
    const before = await database.client.vehicleStatusSample.count({ where: { branchId } });
    const rejected: [string, Record<string, unknown>, string][] = [
      [
        'after the data clock',
        { vehicleId, odometerKm: 1100, recordedAt: minutes(0.001).toISOString() },
        'recordedAt',
      ],
      [
        'not after the previous reading',
        { vehicleId, odometerKm: 1100, recordedAt: minutes(-60).toISOString() },
        'recordedAt',
      ],
      [
        'below the previous reading',
        { vehicleId, odometerKm: 1049.9, recordedAt: minutes(-30).toISOString() },
        'odometerKm',
      ],
      [
        'negative odometer',
        { vehicleId, odometerKm: -1, recordedAt: minutes(-30).toISOString() },
        'odometerKm',
      ],
      [
        'date-time without an offset',
        { vehicleId, odometerKm: 1100, recordedAt: '2026-10-18T06:00:00' },
        'recordedAt',
      ],
      [
        'inactive vehicle',
        { vehicleId: inactive.id, odometerKm: 1, recordedAt: asOf.toISOString() },
        'vehicleId',
      ],
      [
        'vehicle of another Branch',
        { vehicleId: foreign.id, odometerKm: 1, recordedAt: asOf.toISOString() },
        'vehicleId',
      ],
    ];
    for (const [row, input, path] of rejected) {
      expect({ row, value: await query(record, { input }) }).toMatchObject({
        row,
        value: { errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path }] } }] },
      });
    }
    expect(await database.client.vehicleStatusSample.count({ where: { branchId } })).toBe(before);

    // The track contract preserves every returned sample, but geometry only uses recorded positions.
    const tracked = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'RECORDED TRACK' },
    });
    const trackRows = [
      [-400, imei, 42.69, true, 70],
      [-398, null, null, null, null],
      [-395, imei, 42.7, null, null],
      [-380, imei, 42.71, false, 0],
      [-320, imei, 42.72, false, 0],
      [-315, imei, null, false, 0],
      [-310, imei, 42.73, false, 0],
      [-309, '990601000000002', 42.74, false, 0],
      [-180, '990601000000002', 42.75, false, 0],
    ] as const;
    const samples = trackRows.map(
      ([minute, deviceImei, latitude, ignition, speedKph]) =>
        ({
          id: randomUUID(),
          tenantId,
          branchId,
          vehicleId: tracked.id,
          deviceImei,
          source: deviceImei === null ? 'MANUAL' : 'DEMO',
          recordedAt: minutes(minute),
          receivedAt: minutes(minute),
          latitude,
          longitude: latitude === null ? null : 23.32,
          ignition,
          speedKph,
          odometerKm: deviceImei === null ? 500 : null,
        }) satisfies Prisma.VehicleStatusSampleCreateManyInput,
    );
    await database.client.vehicleStatusSample.createMany({ data: samples });
    const series = `query($id:ID!,$from:DateTime!,$to:DateTime!){
      fleetVehicleSamples(vehicleId:$id,from:$from,to:$to){
        from to items{id} truncated
        track{asOf positionCount firstPositionAt lastPositionAt
          segments{sampleIds} gaps{from to reason thresholdSeconds}}
      }
    }`;
    const range = { from: minutes(-1439).toISOString(), to: minutes(1).toISOString() };
    expect(await query(series, { id: tracked.id, ...range })).toEqual({
      data: {
        fleetVehicleSamples: {
          ...range,
          items: samples.map(({ id }) => ({ id })),
          truncated: false,
          track: {
            asOf: asOf.toISOString(),
            positionCount: 7,
            firstPositionAt: minutes(-400).toISOString(),
            lastPositionAt: minutes(-180).toISOString(),
            segments: [
              { sampleIds: [samples[0]?.id, samples[2]?.id] },
              { sampleIds: [samples[3]?.id, samples[4]?.id] },
              { sampleIds: [samples[6]?.id] },
              { sampleIds: [samples[7]?.id] },
              { sampleIds: [samples[8]?.id] },
            ],
            gaps: [
              [-1439, -400, 'OUTSIDE_SAMPLES', null],
              [-395, -380, 'SAMPLE_GAP', 600],
              [-320, -310, 'POSITION_UNAVAILABLE', null],
              [-310, -309, 'DEVICE_CHANGED', null],
              [-309, -180, 'SAMPLE_GAP', 7200],
              [-180, 1, 'OUTSIDE_SAMPLES', null],
            ].map(([from, to, reason, thresholdSeconds]) => ({
              from: minutes(Number(from)).toISOString(),
              to: minutes(Number(to)).toISOString(),
              reason,
              thresholdSeconds,
            })),
          },
        },
      },
    });
    for (const [scopeBranch, scopeTenant] of [
      [otherBranchId, tenantId],
      [branchId, otherTenantId],
    ]) {
      expect(
        await query(series, { id: tracked.id, ...range }, scopeBranch, scopeTenant),
      ).toMatchObject({ errors: [{ message: 'Vehicle not found' }] });
    }

    // A busy 24-hour track retains the newest 2,000 positions and marks omitted coverage.
    const busy = await database.client.vehicle.create({
      data: { tenantId, branchId, licensePlate: 'BUSY TRACK' },
    });
    const busySamples = Array.from(
      { length: 2001 },
      (_, index) =>
        ({
          id: randomUUID(),
          tenantId,
          branchId,
          vehicleId: busy.id,
          deviceImei: imei,
          source: 'DEMO',
          recordedAt: new Date(asOf.getTime() - 3_600_000 + index * 1000),
          receivedAt: asOf,
          latitude: 42.69,
          longitude: 23.32,
        }) satisfies Prisma.VehicleStatusSampleCreateManyInput,
    );
    await database.client.vehicleStatusSample.createMany({ data: busySamples });
    const retained = busySamples.slice(1);
    expect(await query(series, { id: busy.id, ...range })).toMatchObject({
      data: {
        fleetVehicleSamples: {
          items: retained.map(({ id }) => ({ id })),
          truncated: true,
          track: {
            asOf: asOf.toISOString(),
            positionCount: 2000,
            firstPositionAt: retained[0]?.recordedAt.toISOString(),
            lastPositionAt: retained.at(-1)?.recordedAt.toISOString(),
            segments: [{ sampleIds: retained.map(({ id }) => id) }],
            gaps: [
              { from: range.from, to: retained[0]?.recordedAt.toISOString(), reason: 'TRUNCATED' },
              {
                from: retained.at(-1)?.recordedAt.toISOString(),
                to: range.to,
                reason: 'OUTSIDE_SAMPLES',
              },
            ],
          },
        },
      },
    });
    expect(await query(series, { id: manualOnly.id, ...range })).toMatchObject({
      data: {
        fleetVehicleSamples: {
          track: {
            positionCount: 0,
            firstPositionAt: null,
            lastPositionAt: null,
            segments: [],
            gaps: [{ ...range, reason: 'POSITION_UNAVAILABLE' }],
          },
        },
      },
    });
  });
});
