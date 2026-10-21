import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { integer, rowsOf } from '../src/database/sql.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { seedFleet, vehicleSeeds } from '../prisma/seed-data.js';
import { DEMO_BRANCH_ID, DEMO_SCOPE } from '../prisma/demo/catalog.js';
import { generateFleetDemo } from '../prisma/demo/generate.js';
import { DEMO_CLOCK_SAMPLE_ID, demoId, masterId } from '../prisma/demo/ids.js';
import { seedFleetDemo, type FleetDemoInserted } from '../prisma/demo/seed-demo.js';
import { DEMO_ANCHOR, DAY_MS } from '../prisma/demo/time.js';
import { createTestDatabase } from './test-database.js';
import { afterLockedDriverChange } from './driver-row-lock.js';

const anchor = new Date(DEMO_ANCHOR);

describe('Insert-only rich Fleet demo seed with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  const data = generateFleetDemo({ anchor });
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
  });
  afterAll(async () => {
    await closeDatabase?.();
  });

  it('inserts the deterministic dataset once and preserves edited masters and processed alerts/services', async () => {
    const client = database.client;
    await seedFleet(client);
    const options = { anchor, schema: database.schema };
    const expected = {
      groups: data.groups.length,
      drivers: data.drivers.length,
      vehicles: data.vehicles.length,
      devices: data.devices.length,
      serviceTasks: data.serviceTasks.length,
      trips: data.trips.length,
      samples: data.samples.length,
      events: data.events.length,
    };
    expect(await seedFleetDemo(client, options)).toEqual(expected);
    expect(await client.vehicle.count({ where: DEMO_SCOPE })).toBe(data.vehicles.length + 2);
    expect(await client.device.count({ where: DEMO_SCOPE })).toBe(data.devices.length + 1);
    expect(await client.device.count({ where: { ...DEMO_SCOPE, vehicleId: null } })).toBe(4);
    expect(
      await client.vehicleStatusSample.findUniqueOrThrow({
        where: { ...DEMO_SCOPE, id: DEMO_CLOCK_SAMPLE_ID },
        select: { recordedAt: true, deviceImei: true },
      }),
    ).toEqual({ recordedAt: anchor, deviceImei: expect.any(String) });
    const latest = await client.vehicleStatusSample.aggregate({
      where: { ...DEMO_SCOPE, deviceImei: { not: null } },
      _max: { recordedAt: true },
    });
    expect(latest._max.recordedAt).toEqual(anchor);
    const sandbox = {
      tenantId: DEMO_SCOPE.tenantId,
      branchId: '10000000-0000-4000-8000-000000000002',
    };
    expect(
      await Promise.all([
        client.vehicleGroup.count({ where: sandbox }),
        client.driver.count({ where: sandbox }),
        client.vehicle.count({ where: sandbox }),
        client.device.count({ where: sandbox }),
        client.serviceTask.count({ where: sandbox }),
        client.trip.count({ where: sandbox }),
        client.vehicleStatusSample.count({ where: sandbox }),
        client.fleetEvent.count({ where: sandbox }),
      ]),
    ).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    const legacy = vehicleSeeds[0];
    if (!legacy) {
      throw new Error('Missing minimal Fleet seed.');
    }
    await client.vehicle.update({
      where: { ...DEMO_SCOPE, id: legacy.id },
      data: { licensePlate: 'USER LEGACY', notes: 'Keep minimal edits.' },
    });
    await client.vehicleGroup.update({
      where: { ...DEMO_SCOPE, id: masterId('group', 1) },
      data: { name: 'User group name' },
    });
    await client.driver.update({
      where: { ...DEMO_SCOPE, id: masterId('driver', 1) },
      data: { employeeNumber: 'USER-E1', notes: 'Keep driver edits.' },
    });
    await client.vehicle.update({
      where: { ...DEMO_SCOPE, id: masterId('vehicle', 1) },
      data: { licensePlate: 'USER VEHICLE', currentDriverId: null, notes: 'Keep vehicle edits.' },
    });
    await client.device.update({
      where: { ...DEMO_SCOPE, id: masterId('device', 1) },
      data: { vehicleId: null, notes: 'Keep device in stock.' },
    });
    const eventId = demoId('event', 'storyline:a');
    await client.fleetEvent.update({
      where: { ...DEMO_SCOPE, id: eventId },
      data: {
        alertStatus: 'ACKNOWLEDGED',
        acknowledgedAt: anchor,
        remark: 'Reviewed by operator.',
      },
    });
    const taskId = demoId('service', '3:planned');
    await client.serviceTask.update({
      where: { ...DEMO_SCOPE, id: taskId },
      data: { status: 'DONE', completedOn: new Date('2026-10-18T00:00:00Z'), costCents: 0 },
    });
    expect(await seedFleet(client)).toEqual({ vehicles: 0, devices: 0 });
    expect(await seedFleetDemo(client, options)).toEqual({
      groups: 0,
      drivers: 0,
      vehicles: 0,
      devices: 0,
      serviceTasks: 0,
      trips: 0,
      samples: 0,
      events: 0,
    });
    expect(
      await client.vehicle.findUniqueOrThrow({ where: { ...DEMO_SCOPE, id: legacy.id } }),
    ).toMatchObject({ licensePlate: 'USER LEGACY', notes: 'Keep minimal edits.' });
    expect(
      await client.vehicle.findUniqueOrThrow({
        where: { ...DEMO_SCOPE, id: masterId('vehicle', 1) },
      }),
    ).toMatchObject({
      licensePlate: 'USER VEHICLE',
      currentDriverId: null,
      notes: 'Keep vehicle edits.',
    });
    expect(
      await client.driver.findUniqueOrThrow({
        where: { ...DEMO_SCOPE, id: masterId('driver', 1) },
      }),
    ).toMatchObject({ employeeNumber: 'USER-E1', notes: 'Keep driver edits.' });
    expect(
      await client.device.findUniqueOrThrow({
        where: { ...DEMO_SCOPE, id: masterId('device', 1) },
      }),
    ).toMatchObject({ vehicleId: null, notes: 'Keep device in stock.' });
    expect(
      await client.fleetEvent.findUniqueOrThrow({ where: { ...DEMO_SCOPE, id: eventId } }),
    ).toMatchObject({ alertStatus: 'ACKNOWLEDGED', remark: 'Reviewed by operator.' });
    expect(
      await client.serviceTask.findUniqueOrThrow({ where: { ...DEMO_SCOPE, id: taskId } }),
    ).toMatchObject({ status: 'DONE', costCents: 0 });
    const missingTrip = data.trips.find(
      (row) =>
        row.endedAt == null && data.events.filter((event) => event.tripId === row.id).length === 1,
    );
    const missingSample = data.samples.find((row) => row.id !== DEMO_CLOCK_SAMPLE_ID);
    const missingEvent =
      missingTrip && data.events.find((row) => row.tripId === missingTrip.id && row.id !== eventId);
    if (!missingTrip || !missingSample || !missingEvent) {
      throw new Error('Missing activity rows for the partial demo seed regression.');
    }
    await client.fleetEvent.deleteMany({ where: { ...DEMO_SCOPE, id: missingEvent.id } });
    await Promise.all([
      client.trip.deleteMany({ where: { ...DEMO_SCOPE, id: missingTrip.id } }),
      client.vehicleStatusSample.deleteMany({ where: { ...DEMO_SCOPE, id: missingSample.id } }),
    ]);
    expect(await seedFleetDemo(client, options)).toEqual({
      groups: 0,
      drivers: 0,
      vehicles: 0,
      devices: 0,
      serviceTasks: 0,
      trips: 1,
      samples: 1,
      events: 1,
    });
    expect(
      await Promise.all([
        client.trip.findUniqueOrThrow({
          where: { ...DEMO_SCOPE, id: missingTrip.id },
          select: { id: true },
        }),
        client.vehicleStatusSample.findUniqueOrThrow({
          where: { ...DEMO_SCOPE, id: missingSample.id },
          select: { id: true },
        }),
        client.fleetEvent.findUniqueOrThrow({
          where: { ...DEMO_SCOPE, id: missingEvent.id },
          select: { id: true },
        }),
      ]),
    ).toEqual([{ id: missingTrip.id }, { id: missingSample.id }, { id: missingEvent.id }]);
    expect(
      await client.fleetEvent.findUniqueOrThrow({ where: { ...DEMO_SCOPE, id: eventId } }),
    ).toMatchObject({ alertStatus: 'ACKNOWLEDGED', remark: 'Reviewed by operator.' });
    await expect(
      seedFleetDemo(client, {
        anchor: new Date(anchor.getTime() + DAY_MS),
        schema: database.schema,
      }),
    ).rejects.toThrow('already uses anchor');
    expect(
      await client.vehicleStatusSample.aggregate({ where: DEMO_SCOPE, _max: { recordedAt: true } }),
    ).toEqual({ _max: { recordedAt: anchor } });
  });

  it('rejects a concurrent first run with another anchor without mixing activity or changing the first clock', async () => {
    const isolated = await createTestDatabase();
    const submitted: Promise<FleetDemoInserted>[] = [];
    try {
      const driver = data.drivers.find((row) => row.id === masterId('driver', 1));
      if (!driver) {
        throw new Error('Missing Driver to coordinate the seed regression.');
      }
      await isolated.client.driver.create({ data: driver });
      const outcomes = await afterLockedDriverChange(
        isolated,
        DEMO_SCOPE,
        driver.id,
        () => Promise.resolve(),
        async () => {
          const first = seedFleetDemo(isolated.client, { anchor, schema: isolated.schema });
          submitted.push(first);
          void first.catch(() => undefined);
          // Both implementations wait here before inserting the clock. Start the competing
          // run only after the first reaches this row, so the anchor winner is deterministic.
          let waiting = false;
          for (let attempt = 0; attempt < 250; attempt++) {
            const blocked: unknown = await isolated.client.$queryRaw(Prisma.sql`
              SELECT count(*)::int AS "waiting" FROM pg_stat_activity
              WHERE "wait_event_type"='Lock' AND position(${isolated.schema}::text in "query") > 0
                AND "query" LIKE '%FOR NO KEY UPDATE%'`);
            if (rowsOf(blocked, (row) => integer(row, 'waiting')).some((count) => count > 0)) {
              waiting = true;
              break;
            }
            await delay(20);
          }
          if (!waiting) {
            throw new Error('The first demo run did not reach the held Driver row.');
          }
          const second = seedFleetDemo(isolated.client, {
            anchor: new Date(anchor.getTime() + DAY_MS),
            schema: isolated.schema,
          });
          submitted.push(second);
          return Promise.allSettled([first, second]);
        },
        2,
      );
      const [first, second] = outcomes;
      expect(first).toMatchObject({ status: 'fulfilled' });
      expect(second).toMatchObject({ status: 'rejected' });
      const failure: unknown = second.status === 'rejected' ? second.reason : undefined;
      expect(failure).toBeInstanceOf(Error);
      if (!(failure instanceof Error)) {
        throw new Error('The conflicting demo run did not return an error.');
      }
      expect(failure.message).toContain('already uses anchor');
      expect(failure.message).toContain(anchor.toISOString());
      expect(
        await Promise.all([
          isolated.client.vehicleGroup.count({ where: DEMO_SCOPE }),
          isolated.client.driver.count({ where: DEMO_SCOPE }),
          isolated.client.vehicle.count({ where: DEMO_SCOPE }),
          isolated.client.device.count({ where: DEMO_SCOPE }),
          isolated.client.serviceTask.count({ where: DEMO_SCOPE }),
          isolated.client.trip.count({ where: DEMO_SCOPE }),
          isolated.client.vehicleStatusSample.count({ where: DEMO_SCOPE }),
          isolated.client.fleetEvent.count({ where: DEMO_SCOPE }),
        ]),
      ).toEqual([
        data.groups.length,
        data.drivers.length,
        data.vehicles.length,
        data.devices.length,
        data.serviceTasks.length,
        data.trips.length,
        data.samples.length,
        data.events.length,
      ]);
      expect(
        await isolated.client.vehicleStatusSample.findUniqueOrThrow({
          where: { ...DEMO_SCOPE, id: DEMO_CLOCK_SAMPLE_ID },
          select: { recordedAt: true },
        }),
      ).toEqual({ recordedAt: anchor });
      expect(
        await isolated.client.vehicleStatusSample.aggregate({
          where: DEMO_SCOPE,
          _max: { recordedAt: true },
        }),
      ).toEqual({ _max: { recordedAt: anchor } });
    } finally {
      await Promise.allSettled(submitted);
      await isolated.close();
    }
  });

  it('reports every natural-key collision before rich inserts and rejects foreign reserved IDs', async () => {
    const isolated = await createTestDatabase();
    try {
      const client = isolated.client;
      const firstGroup = data.groups[0],
        firstDriver = data.drivers.find((row) => row.employeeNumber && row.identificationKey);
      const firstVehicle = data.vehicles.find((row) => row.fleetNumber && row.vin),
        firstDevice = data.devices[0];
      if (!firstGroup || !firstDriver || !firstVehicle || !firstDevice) {
        throw new Error('Missing collision fixture.');
      }
      await client.vehicleGroup.create({ data: { ...DEMO_SCOPE, name: firstGroup.name } });
      await client.driver.create({
        data: {
          ...DEMO_SCOPE,
          firstName: 'User',
          lastName: 'Driver',
          employeeNumber: firstDriver.employeeNumber ?? null,
          identificationKey: firstDriver.identificationKey ?? null,
        },
      });
      await client.vehicle.create({
        data: {
          ...DEMO_SCOPE,
          licensePlate: 'USER',
          fleetNumber: firstVehicle.fleetNumber ?? null,
          vin: firstVehicle.vin ?? null,
        },
      });
      await client.device.create({ data: { ...DEMO_SCOPE, imei: firstDevice.imei } });
      const conflict = seedFleetDemo(client, { anchor, schema: isolated.schema });
      await expect(conflict).rejects.toThrow(
        /VehicleGroup.name.*Driver.employeeNumber.*Driver.identificationKey.*Vehicle.fleetNumber.*Vehicle.vin.*Device.imei/,
      );
      expect(await client.vehicleGroup.count({ where: DEMO_SCOPE })).toBe(1);
      expect(await client.driver.count({ where: DEMO_SCOPE })).toBe(1);
      expect(await client.vehicle.count({ where: DEMO_SCOPE })).toBe(1);
      expect(await client.device.count({ where: DEMO_SCOPE })).toBe(1);
      expect(await client.trip.count({ where: DEMO_SCOPE })).toBe(0);
      expect(await client.vehicleStatusSample.count({ where: DEMO_SCOPE })).toBe(0);
      const foreign = { tenantId: randomUUID(), branchId: DEMO_BRANCH_ID };
      await client.vehicle.create({
        data: { id: masterId('vehicle', 46), ...foreign, licensePlate: 'FOREIGN RESERVED' },
      });
      await expect(seedFleetDemo(client, { anchor, schema: isolated.schema })).rejects.toThrow(
        'reserved IDs belong to another Tenant/Branch',
      );
      expect(
        await client.vehicle.findUniqueOrThrow({
          where: { ...foreign, id: masterId('vehicle', 46) },
        }),
      ).toMatchObject({ licensePlate: 'FOREIGN RESERVED', ...foreign });
    } finally {
      await isolated.close();
    }
  });
});
