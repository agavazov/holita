import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import pg from 'pg';
import { seedBranches, branchSeeds, rentalSofiaId } from '../prisma/seed-data.js';
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
    const branch = await database.client.branch.create({
      data: { tenantId: rentalSofiaId, name: 'Custom branch' },
    });
    expect(branch.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(branch.createdAt).toBeInstanceOf(Date);
    expect(branch.updatedAt).toBeInstanceOf(Date);
    expect(await database.client.branch.findUnique({ where: { id: branch.id } })).toEqual(branch);
  });

  it('seeds twice without overwriting edited branches or unrelated rows', async () => {
    expect((await seedBranches(database.client)).count).toBe(2);
    expect(
      await database.client.branch.findMany({
        where: { id: { in: branchSeeds.map((branch) => branch.id) } },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
    ).toEqual([{ name: 'Discordia' }, { name: 'Sandbox' }]);
    const first = branchSeeds[0];
    if (!first) {
      throw new Error('Missing branch seed');
    }
    await database.client.branch.update({
      where: { id: first.id },
      data: { tenantId: rentalSofiaId, name: 'My edited branch' },
    });
    const custom = await database.client.branch.create({
      data: { tenantId: rentalSofiaId, name: 'Preserve me' },
    });
    const before = await database.client.branch.count();
    expect((await seedBranches(database.client)).count).toBe(0);
    expect(await database.client.branch.count()).toBe(before);
    expect(await database.client.branch.findUnique({ where: { id: first.id } })).toMatchObject({
      name: 'My edited branch',
    });
    expect(await database.client.branch.findUnique({ where: { id: custom.id } })).toEqual(custom);
  });

  it('isolates another live test schema and drops only that schema on cleanup', async () => {
    const first = await database.client.branch.create({
      data: { tenantId: rentalSofiaId, name: 'First run' },
    });
    const other = await createTestDatabase();
    try {
      expect(await other.client.branch.count()).toBe(0);
      await other.client.branch.create({
        data: { tenantId: rentalSofiaId, id: first.id, name: 'Independent run' },
      });
      expect(await database.client.branch.findUnique({ where: { id: first.id } })).toEqual(first);
    } finally {
      await other.close();
    }
    expect(await database.client.branch.findUnique({ where: { id: first.id } })).toEqual(first);
  });

  it.each(['holita_core', 'holita_fleet', 'holita_fleet_test'])(
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
