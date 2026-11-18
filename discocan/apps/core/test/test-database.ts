import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import { createPrismaClient } from '../src/database/client.js';
import { getTestDatabaseUrl } from './test-database-url.js';
import { tenantSeeds } from '../prisma/seed-data.js';

const migrations = new URL('../prisma/migrations/', import.meta.url);

// Applies the reviewed migration SQL in order inside the new schema. The Prisma CLI would start a
// child process and record a migration table for every test file without checking anything more.
async function applyMigrations(connection: pg.Client, schema: string) {
  const directories = (await readdir(migrations, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  await connection.query(`SET search_path TO ${pg.escapeIdentifier(schema)}`);
  for (const directory of directories) {
    await connection.query(
      await readFile(new URL(`${directory}/migration.sql`, migrations), 'utf8'),
    );
  }
}

export async function createTestDatabase() {
  const connectionString = getTestDatabaseUrl();
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const connection = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
  const client = createPrismaClient(connectionString, schema);
  let created = false;
  async function close() {
    try {
      await client.$disconnect();
    } finally {
      try {
        if (created) {
          await connection.query(`DROP SCHEMA ${pg.escapeIdentifier(schema)} CASCADE`);
          created = false;
        }
      } finally {
        await connection.end();
      }
    }
  }
  try {
    await connection.connect();
    await connection.query(`CREATE SCHEMA ${pg.escapeIdentifier(schema)}`);
    created = true;
    await applyMigrations(connection, schema);
    await client.tenant.createMany({ data: tenantSeeds, skipDuplicates: true });
    return { client, close };
  } catch (error) {
    await close();
    throw error;
  }
}
