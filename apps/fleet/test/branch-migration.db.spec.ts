import { describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createTestDatabase } from './test-database.js';
import { getTestDatabaseUrl } from './test-database-url.js';

describe('Fleet Branch upgrade', () => {
  it('preserves existing records, scoped constraints and applied migration checksums', async () => {
    const tenantId = randomUUID();
    const branchId = randomUUID();
    const vehicleId = randomUUID();
    const deviceId = randomUUID();
    const timestamp = new Date('2026-10-01T10:20:30.123Z');
    const imei = '001234567890123';
    let history: { migration_name: string; checksum: string }[] = [];
    const database = await createTestDatabase({
      beforeBranchRename: async (connection) => {
        await connection.query(
          'INSERT INTO "Vehicle" (id, "tenantId", "storeId", "licensePlate", notes, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $6)',
          [vehicleId, tenantId, branchId, 'CA1234AB', 'Existing notes', timestamp],
        );
        await connection.query(
          'INSERT INTO "Device" (id, "tenantId", "storeId", imei, "vehicleId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $6)',
          [deviceId, tenantId, branchId, imei, vehicleId, timestamp],
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
      // The master data migration adds columns; existing rows only receive the defaults.
      expect(
        await database.client.vehicle.findUniqueOrThrow({ where: { id: vehicleId } }),
      ).toMatchObject({
        id: vehicleId,
        tenantId,
        branchId,
        licensePlate: 'CA1234AB',
        notes: 'Existing notes',
        status: 'ACTIVE',
        fleetNumber: null,
        groupId: null,
        currentDriverId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      expect(
        await database.client.device.findUniqueOrThrow({ where: { id: deviceId } }),
      ).toMatchObject({
        id: deviceId,
        tenantId,
        branchId,
        imei,
        vehicleId,
        model: null,
        options: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await expect(
        database.client.device.create({ data: { tenantId, branchId, imei, vehicleId } }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await expect(
        database.client.device.update({
          where: { id: deviceId },
          data: { branchId: randomUUID() },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
      await expect(
        database.client.vehicle.delete({ where: { id: vehicleId } }),
      ).rejects.toMatchObject({ code: 'P2003' });
      await connection.connect();
      const applied = await connection.query<{ migration_name: string; checksum: string }>(
        `SELECT migration_name, checksum FROM ${pg.escapeIdentifier(database.schema)}."_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`,
      );
      expect(applied.rows.slice(0, history.length)).toEqual(history);
      expect(applied.rows.slice(history.length).map((row) => row.migration_name)).toEqual([
        '20261017010000_rename_store_to_branch',
        '20261018100000_fleet_master_data',
        '20261018110000_fleet_activity',
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
