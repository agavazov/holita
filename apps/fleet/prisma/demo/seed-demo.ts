import { Prisma, type PrismaClient } from '../../src/generated/prisma/client.js';
import { lockDriverStatus } from '../../src/modules/drivers/drivers.repository.js';
import { DEMO_SCOPE } from './catalog.js';
import { generateFleetDemo, type FleetDemoDataset } from './generate.js';
import { DEMO_CLOCK_SAMPLE_ID } from './ids.js';

// Bound activity batches while limiting repeated Prisma query compilation.
const ACTIVITY_BATCH_SIZE = 4000;

export interface FleetDemoInserted {
  groups: number;
  drivers: number;
  vehicles: number;
  devices: number;
  serviceTasks: number;
  trips: number;
  samples: number;
  events: number;
}
interface NaturalKeyRow {
  id: string;
  value: string | null | undefined;
}

function conflicts(
  table: string,
  column: string,
  expected: readonly NaturalKeyRow[],
  existing: readonly NaturalKeyRow[],
): string[] {
  const owners = new Map(
    expected.flatMap((row) => (row.value == null ? [] : [[row.value, row.id] as const])),
  );
  return existing.flatMap((row) => {
    const owner = row.value == null ? undefined : owners.get(row.value);
    return owner !== undefined && owner !== row.id
      ? [`${table}.${column} ${JSON.stringify(row.value)} is used by ${row.id}`]
      : [];
  });
}
const present = (value: string | null | undefined): value is string => typeof value === 'string';

async function guardNaturalKeys(
  transaction: Prisma.TransactionClient,
  data: FleetDemoDataset,
): Promise<void> {
  const [groups, employees, identities, numbers, vins, devices] = await Promise.all([
    transaction.vehicleGroup.findMany({
      where: { ...DEMO_SCOPE, name: { in: data.groups.map((row) => row.name) } },
      select: { id: true, name: true },
    }),
    transaction.driver.findMany({
      where: {
        ...DEMO_SCOPE,
        employeeNumber: { in: data.drivers.map((row) => row.employeeNumber).filter(present) },
      },
      select: { id: true, employeeNumber: true },
    }),
    transaction.driver.findMany({
      where: {
        ...DEMO_SCOPE,
        identificationKey: { in: data.drivers.map((row) => row.identificationKey).filter(present) },
      },
      select: { id: true, identificationKey: true },
    }),
    transaction.vehicle.findMany({
      where: {
        ...DEMO_SCOPE,
        fleetNumber: { in: data.vehicles.map((row) => row.fleetNumber).filter(present) },
      },
      select: { id: true, fleetNumber: true },
    }),
    transaction.vehicle.findMany({
      where: { ...DEMO_SCOPE, vin: { in: data.vehicles.map((row) => row.vin).filter(present) } },
      select: { id: true, vin: true },
    }),
    transaction.device.findMany({
      where: { ...DEMO_SCOPE, imei: { in: data.devices.map((row) => row.imei) } },
      select: { id: true, imei: true },
    }),
  ]);
  const failures = [
    ...conflicts(
      'VehicleGroup',
      'name',
      data.groups.map((row) => ({ id: row.id, value: row.name })),
      groups.map((row) => ({ id: row.id, value: row.name })),
    ),
    ...conflicts(
      'Driver',
      'employeeNumber',
      data.drivers.map((row) => ({ id: row.id, value: row.employeeNumber })),
      employees.map((row) => ({ id: row.id, value: row.employeeNumber })),
    ),
    ...conflicts(
      'Driver',
      'identificationKey',
      data.drivers.map((row) => ({ id: row.id, value: row.identificationKey })),
      identities.map((row) => ({ id: row.id, value: row.identificationKey })),
    ),
    ...conflicts(
      'Vehicle',
      'fleetNumber',
      data.vehicles.map((row) => ({ id: row.id, value: row.fleetNumber })),
      numbers.map((row) => ({ id: row.id, value: row.fleetNumber })),
    ),
    ...conflicts(
      'Vehicle',
      'vin',
      data.vehicles.map((row) => ({ id: row.id, value: row.vin })),
      vins.map((row) => ({ id: row.id, value: row.vin })),
    ),
    ...conflicts(
      'Device',
      'imei',
      data.devices.map((row) => ({ id: row.id, value: row.imei })),
      devices.map((row) => ({ id: row.id, value: row.imei })),
    ),
  ];
  if (failures.length) {
    throw new Error(`Demo seed conflict: ${failures.join('; ')}. Existing records were preserved.`);
  }
}

async function guardPrimaryScopes(
  transaction: Prisma.TransactionClient,
  data: FleetDemoDataset,
): Promise<void> {
  const outside = {
    OR: [{ tenantId: { not: DEMO_SCOPE.tenantId } }, { branchId: { not: DEMO_SCOPE.branchId } }],
  };
  const collisions = await Promise.all([
    transaction.vehicleGroup.findFirst({
      where: { ...outside, id: { in: data.groups.map((row) => row.id) } },
      select: { id: true },
    }),
    transaction.driver.findFirst({
      where: { ...outside, id: { in: data.drivers.map((row) => row.id) } },
      select: { id: true },
    }),
    transaction.vehicle.findFirst({
      where: { ...outside, id: { in: data.vehicles.map((row) => row.id) } },
      select: { id: true },
    }),
    transaction.device.findFirst({
      where: { ...outside, id: { in: data.devices.map((row) => row.id) } },
      select: { id: true },
    }),
    transaction.serviceTask.findFirst({
      where: { ...outside, id: { in: data.serviceTasks.map((row) => row.id) } },
      select: { id: true },
    }),
    transaction.trip.findFirst({
      where: { ...outside, id: { in: data.trips.map((row) => row.id) } },
      select: { id: true },
    }),
    transaction.vehicleStatusSample.findFirst({
      where: { ...outside, id: { in: data.samples.map((row) => row.id) } },
      select: { id: true },
    }),
    transaction.fleetEvent.findFirst({
      where: { ...outside, id: { in: data.events.map((row) => row.id) } },
      select: { id: true },
    }),
  ]);
  const ids = collisions.flatMap((row) => (row ? [row.id] : []));
  if (ids.length) {
    throw new Error(
      `Demo seed conflict: reserved IDs belong to another Tenant/Branch: ${ids.join(', ')}.`,
    );
  }
}

/** Inserts missing fixtures only. Existing edits, assignments, service transitions and alerts survive. */
export async function seedFleetDemo(
  client: PrismaClient,
  { anchor, schema }: { anchor: Date; schema: string },
): Promise<FleetDemoInserted> {
  const data = generateFleetDemo({ anchor });
  const clock = data.samples.find((sample) => sample.id === DEMO_CLOCK_SAMPLE_ID);
  if (!clock) {
    throw new Error('Fleet demo dataset has no Branch clock sample.');
  }
  const inserted = await client.$transaction(
    async (transaction) => {
      // First runs must agree on one anchor before any master or activity insert can start.
      const lockScope = `holita:fleet-demo:${schema}:${DEMO_SCOPE.tenantId}:${DEMO_SCOPE.branchId}`;
      await transaction.$queryRaw(Prisma.sql`
        SELECT 1::int AS "locked" FROM pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended(${lockScope}::text, 0::bigint))`);
      await guardPrimaryScopes(transaction, data);
      const existingClock = await transaction.vehicleStatusSample.findUnique({
        where: { ...DEMO_SCOPE, id: DEMO_CLOCK_SAMPLE_ID },
        select: { recordedAt: true },
      });
      if (existingClock && existingClock.recordedAt.getTime() !== anchor.getTime()) {
        throw new Error(
          `Fleet demo already uses anchor ${existingClock.recordedAt.toISOString()}; rerun with that same --as-of instant.`,
        );
      }
      const clockCollision = await transaction.vehicleStatusSample.findFirst({
        where: {
          ...DEMO_SCOPE,
          vehicleId: clock.vehicleId,
          deviceImei: clock.deviceImei ?? null,
          recordedAt: clock.recordedAt,
          id: { not: DEMO_CLOCK_SAMPLE_ID },
        },
        select: { id: true },
      });
      if (clockCollision) {
        throw new Error(
          `Demo seed conflict: the reserved Branch clock sample is already represented by ${clockCollision.id}.`,
        );
      }
      await guardNaturalKeys(transaction, data);
      const existingVehicles = await transaction.vehicle.findMany({
        where: { ...DEMO_SCOPE, id: { in: data.vehicles.map((row) => row.id) } },
        select: { id: true },
      });
      const existingIds = new Set(existingVehicles.map((row) => row.id));
      const groups = await transaction.vehicleGroup.createMany({
        data: data.groups,
        skipDuplicates: true,
      });
      const drivers = await transaction.driver.createMany({
        data: data.drivers,
        skipDuplicates: true,
      });
      const assignedDrivers = [
        ...new Set(
          data.vehicles
            .filter((row) => !existingIds.has(row.id))
            .map((row) => row.currentDriverId)
            .filter(present),
        ),
      ].sort();
      for (const id of assignedDrivers) {
        if ((await lockDriverStatus(transaction, schema, DEMO_SCOPE, id)) === 'INACTIVE') {
          throw new Error(
            `Demo seed conflict: Driver ${id} is inactive; missing vehicles will not be assigned to it.`,
          );
        }
      }
      const vehicles = await transaction.vehicle.createMany({
        data: data.vehicles,
        skipDuplicates: true,
      });
      const devices = await transaction.device.createMany({
        data: data.devices,
        skipDuplicates: true,
      });
      const serviceTasks = await transaction.serviceTask.createMany({
        data: data.serviceTasks,
        skipDuplicates: true,
      });
      // The real latest sample is atomic with master inserts, so interrupted runs retain their anchor.
      const samples = await transaction.vehicleStatusSample.createMany({
        data: [clock],
        skipDuplicates: true,
      });
      return {
        groups: groups.count,
        drivers: drivers.count,
        vehicles: vehicles.count,
        devices: devices.count,
        serviceTasks: serviceTasks.count,
        samples: samples.count,
        trips: 0,
        events: 0,
      };
    },
    { isolationLevel: 'ReadCommitted', timeout: 30_000 },
  );
  // Repeated runs need not compile inserts for unchanged activity; partial runs still fill gaps.
  for (let offset = 0; offset < data.trips.length; offset += ACTIVITY_BATCH_SIZE) {
    const batch = data.trips.slice(offset, offset + ACTIVITY_BATCH_SIZE);
    const existing = await client.trip.findMany({
      where: { ...DEMO_SCOPE, id: { in: batch.map((row) => row.id) } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    const missing = batch.filter((row) => !existingIds.has(row.id));
    if (missing.length) {
      inserted.trips += (
        await client.trip.createMany({ data: missing, skipDuplicates: true })
      ).count;
    }
  }
  for (let offset = 0; offset < data.samples.length; offset += ACTIVITY_BATCH_SIZE) {
    const batch = data.samples.slice(offset, offset + ACTIVITY_BATCH_SIZE);
    const existing = await client.vehicleStatusSample.findMany({
      where: { ...DEMO_SCOPE, id: { in: batch.map((row) => row.id) } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    const missing = batch.filter((row) => !existingIds.has(row.id));
    if (missing.length) {
      inserted.samples += (
        await client.vehicleStatusSample.createMany({ data: missing, skipDuplicates: true })
      ).count;
    }
  }
  for (let offset = 0; offset < data.events.length; offset += ACTIVITY_BATCH_SIZE) {
    const batch = data.events.slice(offset, offset + ACTIVITY_BATCH_SIZE);
    const existing = await client.fleetEvent.findMany({
      where: { ...DEMO_SCOPE, id: { in: batch.map((row) => row.id) } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    const missing = batch.filter((row) => !existingIds.has(row.id));
    if (missing.length) {
      inserted.events += (
        await client.fleetEvent.createMany({
          data: missing,
          skipDuplicates: true,
        })
      ).count;
    }
  }
  return inserted;
}
