import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { getDatabaseUrl } from './connection.js';

export function createPrismaClient(
  connectionString = getDatabaseUrl(),
  schema = new URL(connectionString).searchParams.get('schema') ?? 'public',
): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000, max: 5 }, { schema }),
  });
}
