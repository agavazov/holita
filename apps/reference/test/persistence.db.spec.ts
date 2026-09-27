import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import pg from 'pg';
import { seedVenues, venueSeeds } from '../prisma/seed-data.js';
import { createTestDatabase } from './test-database.js';
import { getTestDatabaseUrl } from './test-database-url.js';

describe('Reference PostgreSQL persistence', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
  });
  afterAll(async () => {
    await closeDatabase?.();
  });

  it('migrates defaults and preserves user edits on repeated seeds', async () => {
    expect((await seedVenues(database.client)).count).toBe(3);
    const first = venueSeeds[0];
    if (!first) throw new Error('Missing venue seed');
    const edited = await database.client.venue.update({
      where: { id: first.id, storeId: first.storeId },
      data: { name: 'User venue' },
    });
    expect(edited.active).toBe(true);
    expect(edited.createdAt).toBeInstanceOf(Date);
    expect((await seedVenues(database.client)).count).toBe(0);
    expect(
      await database.client.venue.findUnique({ where: { id: first.id, storeId: first.storeId } }),
    ).toEqual(edited);
  });
  it('isolates concurrent schemas and supports nullable fields', async () => {
    const row = await database.client.venue.create({
      data: { storeId: randomUUID(), name: 'Local', city: 'Sofia', countryCode: 'BG' },
    });
    expect(row.capacity).toBeNull();
    const other = await createTestDatabase();
    try {
      expect(await other.client.venue.count()).toBe(0);
      await other.client.venue.create({ data: { ...row, name: 'Other run' } });
      expect(
        await database.client.venue.findUnique({ where: { id: row.id, storeId: row.storeId } }),
      ).toEqual(row);
    } finally {
      await other.close();
    }
  });
  it.each([
    'holita_reference',
    'holita_core',
    'holita_core_test',
    'holita_products',
    'holita_products_test',
  ])('refuses the Reference test role access to %s', async (name) => {
    const url = new URL(getTestDatabaseUrl());
    url.pathname = `/${name}`;
    const connection = new pg.Client({
      connectionString: url.toString(),
      connectionTimeoutMillis: 5000,
    });
    try {
      await expect(connection.connect()).rejects.toMatchObject({ code: '42501' });
    } finally {
      await connection.end();
    }
  });
});
