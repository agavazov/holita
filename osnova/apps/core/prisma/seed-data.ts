import type { PrismaClient } from '../src/generated/prisma/client.js';

export interface CoreSeedData {
  tenants: { id: string; name: string }[];
  branches: { id: string; tenantId: string; name: string }[];
}
export async function seedBranches(client: PrismaClient, data: CoreSeedData) {
  await client.tenant.createMany({ data: data.tenants, skipDuplicates: true });
  return client.branch.createMany({ data: data.branches, skipDuplicates: true });
}
