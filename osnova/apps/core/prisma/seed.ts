import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createPrismaClient } from '../src/database/client.js';
import { seedBranches, type CoreSeedData } from './seed-data.js';

function isSeedData(value: unknown): value is CoreSeedData {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('tenants' in value) ||
    !('branches' in value) ||
    !Array.isArray(value.tenants) ||
    !Array.isArray(value.branches)
  ) {
    return false;
  }
  return (
    value.tenants.every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        typeof item.id === 'string' &&
        'name' in item &&
        typeof item.name === 'string',
    ) &&
    value.branches.every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        typeof item.id === 'string' &&
        'tenantId' in item &&
        typeof item.tenantId === 'string' &&
        'name' in item &&
        typeof item.name === 'string',
    )
  );
}
const path = process.env.CORE_SEED_FILE;
if (!path) {
  throw new Error('CORE_SEED_FILE is required');
}
const data: unknown = JSON.parse(await readFile(path, 'utf8'));
if (!isSeedData(data)) {
  throw new Error('CORE_SEED_FILE contains invalid seed data');
}
const client = createPrismaClient();
try {
  const result = await seedBranches(client, data);
  console.info(`core: inserted ${String(result.count)} seed rows; existing rows preserved`);
} finally {
  await client.$disconnect();
}
