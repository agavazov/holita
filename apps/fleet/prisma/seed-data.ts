import type { PrismaClient } from '../src/generated/prisma/client.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
const branchId = '10000000-0000-4000-8000-000000000001';
export const vehicleSeeds = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    tenantId,
    branchId,
    licensePlate: 'CA1234AB',
    notes: 'RentalSofia demo truck',
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    tenantId,
    branchId,
    licensePlate: 'CA5678AB',
    notes: null,
  },
];
export const deviceSeeds = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    tenantId,
    branchId,
    imei: '001234567890123',
    vehicleId: '20000000-0000-4000-8000-000000000001',
  },
];
export async function seedFleet(client: PrismaClient) {
  return client.$transaction(async (transaction) => {
    const vehicles = await transaction.vehicle.createMany({
      data: vehicleSeeds,
      skipDuplicates: true,
    });
    const devices = await transaction.device.createMany({
      data: deviceSeeds,
      skipDuplicates: true,
    });
    return { vehicles: vehicles.count, devices: devices.count };
  });
}
