import type { PrismaClient } from '../src/generated/prisma/client.js';

export const storeSeeds = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'holita Sofia' },
  { id: '10000000-0000-4000-8000-000000000002', name: 'holita Plovdiv' },
];

export function seedStores(client: PrismaClient) {
  return client.store.createMany({ data: storeSeeds, skipDuplicates: true });
}
