import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import pg from 'pg';
import { productSeeds, seedProducts } from '../prisma/seed-data.js';
import { createTestDatabase } from './test-database.js';
import { getTestDatabaseUrl } from './test-database-url.js';

describe('products PostgreSQL persistence', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
  });
  afterAll(async () => {
    await closeDatabase?.();
  });

  it('persists defaults and updates a product within its store', async () => {
    const storeId = randomUUID();
    const product = await database.client.product.create({
      data: { storeId, name: 'Notebook', sku: 'BASIC' },
    });
    expect(product.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(product.status).toBe('DRAFT');
    expect(product.createdAt).toBeInstanceOf(Date);
    const updated = await database.client.product.update({
      where: { id: product.id, storeId },
      data: { status: 'ACTIVE', name: 'Updated notebook' },
    });
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(product.updatedAt.getTime());
    expect(await database.client.product.findFirst({ where: { id: product.id, storeId } })).toEqual(
      updated,
    );
  });

  it('rejects duplicate SKU in one store but allows the same SKU across stores', async () => {
    const storeId = randomUUID();
    const data = { storeId, name: 'Unique notebook', sku: 'SHARED' };
    await database.client.product.create({ data });
    await expect(database.client.product.create({ data })).rejects.toMatchObject({ code: 'P2002' });
    const other = await database.client.product.create({
      data: { ...data, storeId: randomUUID() },
    });
    expect(other.sku).toBe(data.sku);
    // SKU comparison is deliberately case-sensitive.
    await expect(
      database.client.product.create({ data: { ...data, sku: 'shared' } }),
    ).resolves.toMatchObject({ sku: 'shared' });
  });

  it('seeds twice without overwriting edits, unrelated products or SKU conflicts', async () => {
    const first = productSeeds[0];
    const second = productSeeds[1];
    if (!first || !second) throw new Error('Missing product seeds');
    const conflicting = await database.client.product.create({
      data: { storeId: first.storeId, sku: first.sku, name: 'User product owns SKU' },
    });
    expect((await seedProducts(database.client)).count).toBe(5);
    await database.client.product.update({
      where: { id: second.id, storeId: second.storeId },
      data: { name: 'My edited product' },
    });
    const before = await database.client.product.count({
      where: { storeId: { in: [...new Set(productSeeds.map((row) => row.storeId))] } },
    });
    expect((await seedProducts(database.client)).count).toBe(0);
    expect(
      await database.client.product.count({
        where: { storeId: { in: [...new Set(productSeeds.map((row) => row.storeId))] } },
      }),
    ).toBe(before);
    expect(
      await database.client.product.findFirst({
        where: { id: second.id, storeId: second.storeId },
      }),
    ).toMatchObject({ name: 'My edited product' });
    expect(
      await database.client.product.findFirst({
        where: { id: conflicting.id, storeId: conflicting.storeId },
      }),
    ).toEqual(conflicting);
    expect(
      await database.client.product.findMany({ where: { storeId: first.storeId } }),
    ).toHaveLength(3);
    expect(
      await database.client.product.findMany({
        where: { storeId: '10000000-0000-4000-8000-000000000002' },
      }),
    ).toHaveLength(3);
  });

  it('isolates simultaneous schemas even for identical product keys', async () => {
    const storeId = randomUUID();
    const first = await database.client.product.create({
      data: { storeId, sku: 'PARALLEL', name: 'First run' },
    });
    const other = await createTestDatabase();
    try {
      expect(await other.client.product.count({ where: { storeId } })).toBe(0);
      await other.client.product.create({
        data: { id: first.id, storeId, sku: first.sku, name: 'Other run' },
      });
      expect(await database.client.product.findFirst({ where: { id: first.id, storeId } })).toEqual(
        first,
      );
    } finally {
      await other.close();
    }
    expect(await database.client.product.findFirst({ where: { id: first.id, storeId } })).toEqual(
      first,
    );
  });

  it.each(['holita_products', 'holita_core', 'holita_core_test'])(
    'cannot connect to %s using the products test role',
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
