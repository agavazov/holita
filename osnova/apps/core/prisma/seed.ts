import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createPrismaClient } from '../src/database/client.js';
import { seedAccounts, seedBranches, type CoreSeedData } from './seed-data.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isSeedData(value: unknown): value is CoreSeedData {
  if (!isRecord(value) || !Array.isArray(value.tenants) || !Array.isArray(value.branches)) {
    return false;
  }
  const tenants = value.tenants.every(
    (item: unknown) =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      (item.kind === undefined || item.kind === 'CUSTOMER' || item.kind === 'PLATFORM'),
  );
  const branches = value.branches.every(
    (item: unknown) =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.tenantId === 'string' &&
      typeof item.name === 'string',
  );
  const users =
    value.users === undefined ||
    (Array.isArray(value.users) &&
      value.users.every(
        (item: unknown) =>
          isRecord(item) &&
          typeof item.id === 'string' &&
          typeof item.tenantId === 'string' &&
          typeof item.name === 'string' &&
          typeof item.emailEnv === 'string' &&
          typeof item.passwordEnv === 'string' &&
          (item.role === 'ADMINISTRATOR' || item.role === 'OPERATOR' || item.role === 'SALES'),
      ));
  return tenants && branches && users;
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
  await seedAccounts(client, data);
  console.info(`core: inserted ${String(result.count)} seed rows; existing rows preserved`);
} finally {
  await client.$disconnect();
}
