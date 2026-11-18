import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { getDatabaseUrl } from './connection.js';

export function createPrismaClient(
  connectionString = getDatabaseUrl(),
  schema = new URL(connectionString).searchParams.get('schema') ?? 'public',
): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg(
      // JIT compilation took about 6 s of the 9 s device-state query on 2026-11-18.
      { connectionString, connectionTimeoutMillis: 5000, max: 5, options: '-c jit=off' },
      { schema },
    ),
  });
}
