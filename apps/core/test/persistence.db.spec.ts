import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import pg from 'pg';
import { seedStores, storeSeeds } from '../prisma/seed-data.js';
import { createTestDatabase } from './test-database.js';
import { getTestDatabaseUrl } from './test-database-url.js';

describe('core PostgreSQL persistence', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
  });
  afterAll(async () => {
    await closeDatabase?.();
  });

  it('applies migrations and persists generated IDs and timestamps', async () => {
    const store = await database.client.store.create({ data: { name: 'Custom store' } });
    expect(store.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.createdAt).toBeInstanceOf(Date);
    expect(store.updatedAt).toBeInstanceOf(Date);
    expect(await database.client.store.findUnique({ where: { id: store.id } })).toEqual(store);
  });

  it('seeds twice without overwriting edited stores or unrelated rows', async () => {
    expect((await seedStores(database.client)).count).toBe(2);
    const first = storeSeeds[0];
    if (!first) throw new Error('Missing store seed');
    await database.client.store.update({
      where: { id: first.id },
      data: { name: 'My edited store' },
    });
    const custom = await database.client.store.create({ data: { name: 'Preserve me' } });
    const before = await database.client.store.count();
    expect((await seedStores(database.client)).count).toBe(0);
    expect(await database.client.store.count()).toBe(before);
    expect(await database.client.store.findUnique({ where: { id: first.id } })).toMatchObject({
      name: 'My edited store',
    });
    expect(await database.client.store.findUnique({ where: { id: custom.id } })).toEqual(custom);
  });

  it('isolates another live test schema and drops only that schema on cleanup', async () => {
    const first = await database.client.store.create({ data: { name: 'First run' } });
    const other = await createTestDatabase();
    try {
      expect(await other.client.store.count()).toBe(0);
      await other.client.store.create({ data: { id: first.id, name: 'Independent run' } });
      expect(await database.client.store.findUnique({ where: { id: first.id } })).toEqual(first);
    } finally {
      await other.close();
    }
    expect(await database.client.store.findUnique({ where: { id: first.id } })).toEqual(first);
  });

  it.each(['holita_core', 'holita_products', 'holita_products_test'])(
    'cannot connect to %s using the core test role',
    async (name) => {
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
    },
  );
});
