import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import type { UpdateFleetSettingsInput } from '../src/generated/graphql/types.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import { defaultFleetSettings } from '../src/modules/settings/settings-defaults.js';
import { createTestDatabase } from './test-database.js';

const tenantId = randomUUID();
const now = new Date('2026-10-17T21:30:00.000Z');
const fields = 'timeZone distanceUnit volumeUnit lowFuelPct notReportingHours speedLimitKph';
const read = `{fleetSettings{${fields}}}`;
const update = `mutation($input:UpdateFleetSettingsInput!){updateFleetSettings(input:$input){${fields}}}`;

describe('Fleet settings persistence and scoped calculation with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: INestApplication | undefined;
  let url = '';
  const requireBranch = jest.fn<CoreClient['requireBranch']>();
  beforeAll(async () => {
    database = await createTestDatabase();
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
  });
  beforeEach(() => {
    requireBranch.mockReset().mockResolvedValue(undefined);
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await database.close();
    }
  });
  async function query(
    source: string,
    variables: Record<string, unknown>,
    branchId: string,
    tenant = tenantId,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(tenant)}`,
        'x-branch-id': branchId,
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    return body;
  }

  it('uses saved thresholds and timezone for list/find state, clocks, service, documents and daily buckets', async () => {
    // Defaults need no write; a full replacement persists only in the verified Tenant/Branch.
    const savedBranch = randomUUID();
    expect(await query(read, {}, savedBranch)).toEqual({
      data: { fleetSettings: defaultFleetSettings() },
    });
    expect(await database.client.fleetSettings.count()).toBe(0);
    expect(requireBranch).not.toHaveBeenCalled();
    const input: UpdateFleetSettingsInput = {
      timeZone: 'Europe/Bucharest',
      distanceUnit: 'MI',
      volumeUnit: 'US_GALLON',
      lowFuelPct: 50,
      notReportingHours: 168,
      speedLimitKph: 130,
    };
    expect(await query(update, { input }, savedBranch)).toEqual({
      data: { updateFleetSettings: input },
    });
    expect(requireBranch).toHaveBeenCalledWith(
      savedBranch,
      expect.objectContaining({ tenantId, branchId: savedBranch }),
    );
    expect(await query(read, {}, savedBranch)).toEqual({ data: { fleetSettings: input } });
    expect(await query(read, {}, randomUUID())).toEqual({
      data: { fleetSettings: defaultFleetSettings() },
    });
    expect(await query(read, {}, savedBranch, randomUUID())).toEqual({
      data: { fleetSettings: defaultFleetSettings() },
    });
    const replacement = {
      ...defaultFleetSettings(),
      timeZone: 'Europe/Athens',
      lowFuelPct: 1,
      notReportingHours: 1,
      speedLimitKph: 30,
    };
    expect(await query(update, { input: replacement }, savedBranch)).toEqual({
      data: { updateFleetSettings: replacement },
    });
    expect(
      await database.client.fleetSettings.count({ where: { tenantId, branchId: savedBranch } }),
    ).toBe(1);

    // A Branch that Core rejects persists nothing.
    const rejectedBranch = randomUUID();
    requireBranch.mockRejectedValueOnce(new NotFoundException('Branch not found'));
    expect(await query(update, { input: defaultFleetSettings() }, rejectedBranch)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(
      await database.client.fleetSettings.count({ where: { tenantId, branchId: rejectedBranch } }),
    ).toBe(0);

    // The saved time zone and thresholds drive every derived value of the Branch together.
    const branchId = randomUUID();
    const scope = { tenantId, branchId };
    const vehicle = await database.client.vehicle.create({
      data: { ...scope, licensePlate: 'CONFIGURED', createdAt: new Date('2026-10-17T21:15:00Z') },
    });
    const clockVehicle = await database.client.vehicle.create({
      data: { ...scope, licensePlate: 'CLOCK' },
    });
    const device = await database.client.device.create({
      data: { ...scope, vehicleId: vehicle.id, imei: '000000000000061' },
    });
    const oldReport = new Date(now.getTime() - 2 * 3_600_000);
    await database.client.vehicleStatusSample.createMany({
      data: [
        {
          ...scope,
          vehicleId: vehicle.id,
          deviceImei: device.imei,
          source: 'DEMO',
          recordedAt: oldReport,
          receivedAt: oldReport,
          ignition: true,
          speedKph: 0,
          fuelLevelPct: 10,
        },
        {
          ...scope,
          vehicleId: clockVehicle.id,
          deviceImei: '000000000000062',
          source: 'DEMO',
          recordedAt: now,
          receivedAt: now,
        },
      ],
    });
    await database.client.trip.createMany({
      data: [
        {
          ...scope,
          vehicleId: vehicle.id,
          source: 'DEMO',
          startedAt: new Date('2026-10-17T20:30:00Z'),
          distanceKm: 5,
        },
        {
          ...scope,
          vehicleId: vehicle.id,
          source: 'DEMO',
          startedAt: new Date('2026-10-17T21:15:00Z'),
          distanceKm: 7,
        },
      ],
    });
    const task = await database.client.serviceTask.create({
      data: {
        ...scope,
        vehicleId: vehicle.id,
        serviceType: 'OIL_CHANGE',
        dueOn: new Date('2026-10-17T00:00:00Z'),
      },
    });
    const driver = await database.client.driver.create({
      data: {
        ...scope,
        firstName: 'Configured',
        lastName: 'Driver',
        licenseExpiresOn: new Date('2026-10-17T00:00:00Z'),
      },
    });
    const source = `query($vehicle:ID!,$device:ID!,$task:ID!,$driver:ID!){
      fleetDataClock{businessDate timeZone}
      fleetVehicle(id:$vehicle){state{activity fuelStatus}}
      fleetDevice(id:$device){status}
      fleetServiceTask(id:$task){urgency remainingDays}
      fleetDriver(id:$driver){documentStatus}
      fleetOverview{businessDate distanceTodayKm dailyDistance{date distanceKm}}
    }`;
    const variables = { vehicle: vehicle.id, device: device.id, task: task.id, driver: driver.id };
    expect(await query(source, variables, branchId)).toMatchObject({
      data: {
        fleetDataClock: { businessDate: '2026-10-18', timeZone: 'Europe/Sofia' },
        fleetVehicle: { state: { activity: 'IDLE', fuelStatus: 'LOW' } },
        fleetDevice: { status: 'ONLINE' },
        fleetServiceTask: { urgency: 'OVERDUE', remainingDays: -1 },
        fleetDriver: { documentStatus: 'EXPIRED' },
        fleetOverview: {
          businessDate: '2026-10-18',
          distanceTodayKm: 7,
          dailyDistance: expect.arrayContaining([
            { date: '2026-10-17', distanceKm: 5 },
            { date: '2026-10-18', distanceKm: 7 },
          ]),
        },
      },
    });
    const configured = {
      ...defaultFleetSettings(),
      timeZone: 'Europe/Belgrade',
      lowFuelPct: 5,
      notReportingHours: 1,
    };
    expect(await query(update, { input: configured }, branchId)).toEqual({
      data: { updateFleetSettings: configured },
    });
    expect(await query(source, variables, branchId)).toMatchObject({
      data: {
        fleetDataClock: { businessDate: '2026-10-17', timeZone: 'Europe/Belgrade' },
        fleetVehicle: { state: { activity: 'NOT_CONNECTED', fuelStatus: 'NORMAL' } },
        fleetDevice: { status: 'OFFLINE' },
        fleetServiceTask: { urgency: 'DUE_SOON', remainingDays: 0 },
        fleetDriver: { documentStatus: 'EXPIRING' },
        fleetOverview: {
          businessDate: '2026-10-17',
          distanceTodayKm: 12,
          dailyDistance: expect.arrayContaining([{ date: '2026-10-17', distanceKm: 12 }]),
        },
      },
    });
    expect(
      await query(
        `query($ids:[ID!]){
      fleetVehicles(ids:$ids,filter:{allOf:[{activities:[NOT_CONNECTED]},{createdOnFrom:"2026-10-17",createdOnTo:"2026-10-17"}]}){total items{state{activity fuelStatus}}}
      fleetVehicleSummary{notReporting lowFuel}
      fleetDevices(filter:{allOf:[{statuses:[OFFLINE]}]}){total}
      fleetDeviceSummary{offline online}
    }`,
        { ids: [vehicle.id] },
        branchId,
      ),
    ).toEqual({
      data: {
        fleetVehicles: {
          total: 1,
          items: [{ state: { activity: 'NOT_CONNECTED', fuelStatus: 'NORMAL' } }],
        },
        fleetVehicleSummary: { notReporting: 1, lowFuel: 0 },
        fleetDevices: { total: 1 },
        fleetDeviceSummary: { offline: 1, online: 0 },
      },
    });
  });
});
