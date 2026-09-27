import 'dotenv/config';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import { createPrismaClient } from '../src/database/client.js';
import { getTestDatabaseUrl } from './test-database-url.js';

const execute = promisify(execFile);

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
    const migrationUrl = new URL(connectionString);
    migrationUrl.searchParams.set('schema', schema);
    await execute(
      process.execPath,
      [
        fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url)),
        'migrate',
        'deploy',
      ],
      {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        env: { ...process.env, REFERENCE_DATABASE_URL: migrationUrl.toString() },
        timeout: 30000,
      },
    );
    return { client, schema, close };
  } catch (error) {
    await close();
    throw error;
  }
}
