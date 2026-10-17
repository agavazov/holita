import 'dotenv/config';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import { createPrismaClient } from '../src/database/client.js';
import { getTestDatabaseUrl } from './test-database-url.js';
import { tenantSeeds } from '../prisma/seed-data.js';

const execute = promisify(execFile);

export async function createTestDatabase(
  options: {
    beforeBranchRename?: (connection: pg.Client) => Promise<void>;
  } = {},
) {
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
    const prismaCli = fileURLToPath(
      new URL('../../../node_modules/prisma/build/index.js', import.meta.url),
    );
    const migrationOptions = {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { ...process.env, CORE_DATABASE_URL: migrationUrl.toString() },
      timeout: 30000,
    };
    if (options.beforeBranchRename) {
      // Build the legacy schema from unchanged SQL, then baseline its original checksums.
      await connection.query(`SET search_path TO ${pg.escapeIdentifier(schema)}`);
      for (const migration of ['20261011000000_init']) {
        await connection.query(
          await readFile(
            new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url),
            'utf8',
          ),
        );
        await execute(
          process.execPath,
          [prismaCli, 'migrate', 'resolve', '--applied', migration],
          migrationOptions,
        );
      }
      await options.beforeBranchRename(connection);
    }
    await execute(process.execPath, [prismaCli, 'migrate', 'deploy'], migrationOptions);
    await client.tenant.createMany({ data: tenantSeeds, skipDuplicates: true });
    return { client, schema, close };
  } catch (error) {
    await close();
    throw error;
  }
}
