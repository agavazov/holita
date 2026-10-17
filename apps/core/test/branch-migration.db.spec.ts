import { describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createTestDatabase } from './test-database.js';
import { getTestDatabaseUrl } from './test-database-url.js';

describe('Core Branch upgrade', () => {
  it('preserves existing shops/fleets, tenant relations and applied migration checksums', async () => {
    const tenantId = randomUUID();
    const id = randomUUID();
    const timestamp = new Date('2026-10-01T10:20:30.123Z');
    let history: { migration_name: string; checksum: string }[] = [];
    const database = await createTestDatabase({
      beforeBranchRename: async (connection) => {
        await connection.query(
          'INSERT INTO "Tenant" (id, name, "createdAt", "updatedAt") VALUES ($1, $2, $3, $3)',
          [tenantId, 'Existing tenant', timestamp],
        );
        await connection.query(
          'INSERT INTO "Store" (id, "tenantId", name, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $4)',
          [id, tenantId, 'Existing shop or fleet', timestamp],
        );
        history = (
          await connection.query<{ migration_name: string; checksum: string }>(
            'SELECT migration_name, checksum FROM "_prisma_migrations" ORDER BY migration_name',
          )
        ).rows;
      },
    });
    const connection = new pg.Client({ connectionString: getTestDatabaseUrl() });
    try {
      expect(await database.client.branch.findUniqueOrThrow({ where: { id, tenantId } })).toEqual({
        id,
        tenantId,
        name: 'Existing shop or fleet',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await expect(
        database.client.tenant.delete({ where: { id: tenantId } }),
      ).rejects.toMatchObject({
        code: 'P2003',
      });
      await connection.connect();
      const applied = await connection.query<{ migration_name: string; checksum: string }>(
        `SELECT migration_name, checksum FROM ${pg.escapeIdentifier(database.schema)}."_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`,
      );
      expect(applied.rows.slice(0, history.length)).toEqual(history);
      expect(applied.rows).toHaveLength(history.length + 1);
      const tables = await connection.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ('Store', 'Branch')",
        [database.schema],
      );
      expect(tables.rows).toEqual([{ table_name: 'Branch' }]);
    } finally {
      try {
        await connection.end();
      } finally {
        await database.close();
      }
    }
  });
});
