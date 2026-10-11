import { describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { getTestDatabaseUrl } from './test-database-url.js';

// Replay the reviewed SQL only in a guarded dedicated database and a schema owned by this test.
describe('reference tenant migration', () => {
  it('preserves legacy records and puts tenantId physically after id', async () => {
    const connection = new pg.Client({
      connectionString: getTestDatabaseUrl(),
      connectionTimeoutMillis: 5000,
    });
    const schema = `test_${randomUUID().replaceAll('-', '')}`;
    let created = false;
    await connection.connect();
    try {
      await connection.query(`CREATE SCHEMA ${pg.escapeIdentifier(schema)}`);
      created = true;
      await connection.query(`SET search_path TO ${pg.escapeIdentifier(schema)}`);
      await connection.query(
        await readFile(
          new URL('../prisma/migrations/20261011000000_init/migration.sql', import.meta.url),
          'utf8',
        ),
      );
      const id = randomUUID(),
        timestamp = new Date('2026-01-01T00:00:00.000Z');
      const storeId = randomUUID(),
        deviceId = randomUUID();
      await connection.query(
        'INSERT INTO "Vehicle" ("id", "storeId", "licensePlate", "notes", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $5)',
        [id, storeId, 'OLD-TRUCK', 'Keep notes', timestamp],
      );
      await connection.query(
        'INSERT INTO "Device" ("id", "storeId", "imei", "vehicleId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $5)',
        [deviceId, storeId, '001234567890123', id, timestamp],
      );
      await connection.query(
        await readFile(
          new URL('../prisma/migrations/20261012000000_tenants/migration.sql', import.meta.url),
          'utf8',
        ),
      );
      const tenantId = '01000000-0000-4000-8000-000000000001';
      expect(
        (
          await connection.query(
            'SELECT "id", "tenantId", "createdAt", "updatedAt" FROM "Vehicle" WHERE "id" = $1',
            [id],
          )
        ).rows,
      ).toEqual([{ id, tenantId, createdAt: timestamp, updatedAt: timestamp }]);
      expect(
        (
          await connection.query(
            'SELECT "vehicleId", "imei", "tenantId" FROM "Device" WHERE "id" = $1',
            [deviceId],
          )
        ).rows,
      ).toEqual([{ vehicleId: id, imei: '001234567890123', tenantId }]);
      for (const table of ['Vehicle', 'Device']) {
        const columns = await connection.query<{ column_name: string }>(
          'SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position',
          [schema, table],
        );
        expect(columns.rows.slice(0, 2).map((row) => row.column_name)).toEqual(['id', 'tenantId']);
      }
    } finally {
      try {
        await connection.query('ROLLBACK');
        if (created) await connection.query(`DROP SCHEMA ${pg.escapeIdentifier(schema)} CASCADE`);
      } finally {
        await connection.end();
      }
    }
  });
});
