import { describe, expect, it } from '@jest/globals';
import pg from 'pg';
import { createTestDatabase } from './test-database.js';
import { getTestDatabaseUrl } from './test-database-url.js';

describe('fleet initial database migration', () => {
  it('preserves tenant and branch column order through catalog, Branch, master data and activity migrations', async () => {
    const database = await createTestDatabase();
    const connection = new pg.Client({ connectionString: getTestDatabaseUrl() });
    try {
      await connection.connect();
      for (const table of [
        'Vehicle',
        'Device',
        'Driver',
        'VehicleGroup',
        'VehicleStatusSample',
        'Trip',
        'FleetEvent',
        'ServiceTask',
        'FleetSettings',
      ]) {
        const columns = await connection.query<{ column_name: string; is_nullable: string }>(
          'SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position',
          [database.schema, table],
        );
        expect(columns.rows.slice(0, 3)).toEqual([
          { column_name: 'id', is_nullable: 'NO' },
          { column_name: 'tenantId', is_nullable: 'NO' },
          { column_name: 'branchId', is_nullable: 'NO' },
        ]);
      }
      const migrations = await connection.query<{ migration_name: string }>(
        `SELECT migration_name FROM ${pg.escapeIdentifier(database.schema)}."_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`,
      );
      expect(migrations.rows).toEqual([
        { migration_name: '20261011000000_init' },
        { migration_name: '20261017000000_edata_catalog' },
        { migration_name: '20261017010000_rename_store_to_branch' },
        { migration_name: '20261018100000_fleet_master_data' },
        { migration_name: '20261018110000_fleet_activity' },
        { migration_name: '20261020110000_device_stock' },
        { migration_name: '20261020220000_fleet_settings' },
      ]);
    } finally {
      try {
        await connection.end();
      } finally {
        await database.close();
      }
    }
  });
});
