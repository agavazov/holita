import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { seedFleet, vehicleSeeds } from '../prisma/seed-data.js';
import { createTestDatabase } from './test-database.js';

describe('RentalSofia Fleet seeds', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let close: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    database = await createTestDatabase();
    close = database.close;
  });
  afterAll(async () => {
    await close?.();
  });
  it('inserts sample records once without replacing edited records or assignments', async () => {
    expect(await seedFleet(database.client)).toEqual({ vehicles: 2, devices: 1 });
    const first = vehicleSeeds[0];
    if (!first) throw new Error('Missing vehicle seed');
    await database.client.vehicle.update({
      where: { id: first.id },
      data: { licensePlate: 'EDITED', notes: 'Preserve this' },
    });
    expect(await seedFleet(database.client)).toEqual({ vehicles: 0, devices: 0 });
    expect(await database.client.vehicle.findUnique({ where: { id: first.id } })).toMatchObject({
      licensePlate: 'EDITED',
      notes: 'Preserve this',
    });
    expect(await database.client.device.findMany()).toMatchObject([
      {
        tenantId: first.tenantId,
        branchId: first.branchId,
        vehicleId: first.id,
        imei: '001234567890123',
      },
    ]);
  });
});
