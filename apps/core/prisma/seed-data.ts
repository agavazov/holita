import type { PrismaClient } from '../src/generated/prisma/client.js';

export const rentalSofiaId = '01000000-0000-4000-8000-000000000001';
export const tenantSeeds = [{ id: rentalSofiaId, name: 'RentalSofia' }];

export const storeSeeds = [
  { id: '10000000-0000-4000-8000-000000000001', tenantId: rentalSofiaId, name: 'Discordia' },
  { id: '10000000-0000-4000-8000-000000000002', tenantId: rentalSofiaId, name: 'Sandbox' },
];

export async function seedStores(client: PrismaClient) {
  await client.tenant.createMany({ data: tenantSeeds, skipDuplicates: true });
  return client.store.createMany({ data: storeSeeds, skipDuplicates: true });
}
