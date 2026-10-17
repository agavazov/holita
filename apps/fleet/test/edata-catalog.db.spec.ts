import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { parseCatalog } from '../src/modules/edata-catalog/catalog-file.js';
import { importCatalog } from '../src/modules/edata-catalog/catalog.repository.js';
import { catalogFixture } from './edata-catalog.fixture.js';
import { createTestDatabase } from './test-database.js';

describe('shared versioned eData catalog persistence', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(async () => {
    await database.close();
  });

  it('previews without writes and imports the real v9.56 catalog exactly once', async () => {
    const catalog = parseCatalog(
      await readFile(
        new URL(
          '../../../docs/discocan/erm-resources/simple-edata-catalog/v9.56/catalog.json',
          import.meta.url,
        ),
      ),
    );
    expect((await importCatalog(database.client, catalog)).action).toBe('would_insert');
    expect(await database.client.edataCatalog.count()).toBe(0);
    const imported = await importCatalog(database.client, catalog, true);
    expect(imported.action).toBe('inserted');
    if (!imported.catalogId) throw new Error('Missing imported v9.56 catalog');
    expect(imported.counts).toMatchObject({ parameters: 5488, memberships: 3728, profiles: 2 });
    expect((await importCatalog(database.client, catalog, true)).action).toBe('verified');
    expect(await database.client.edataCatalog.count()).toBe(1);
    expect(
      await database.client.edataCatalogParameter.count({
        where: { catalogId: imported.catalogId, parameterId: 781 },
      }),
    ).toBeGreaterThan(3);
  });

  it('serializes concurrent imports, preserves prior versions and detects changed content', async () => {
    const catalog = catalogFixture();
    const results = await Promise.all([
      importCatalog(database.client, catalog, true),
      importCatalog(database.client, catalog, true),
    ]);
    expect(results.map((r) => r.action).sort()).toEqual(['inserted', 'verified']);
    expect(await database.client.edataCatalog.count()).toBe(2);
    await expect(
      importCatalog(database.client, { ...catalog, contentSha256: 'b'.repeat(64) }, true),
    ).rejects.toThrow('different content');
    expect(await database.client.edataCatalog.count()).toBe(2);
  });

  it('rolls back every inserted table when a late profile constraint fails', async () => {
    const catalog = catalogFixture();
    await expect(
      importCatalog(
        database.client,
        {
          ...catalog,
          sourceSha256: 'c'.repeat(64),
          profiles: catalog.profiles.map((p) => ({ ...p, categoryId: 999 })),
        },
        true,
      ),
    ).rejects.toThrow();
    expect(
      await database.client.edataCatalog.count({ where: { sourceSha256: 'c'.repeat(64) } }),
    ).toBe(0);
    expect(await database.client.edataCatalogSource.count()).toBe(5);
  });

  it('detects stored row corruption even when identity and stored hash are unchanged', async () => {
    const catalog = catalogFixture();
    const imported = await importCatalog(database.client, catalog);
    if (!imported.catalogId) throw new Error('Missing imported fixture');
    await database.client.edataCatalogParameter.update({
      where: { catalogId_key: { catalogId: imported.catalogId, key: 'monitor:0' } },
      data: { name: 'Corrupted' },
    });
    await expect(importCatalog(database.client, catalog)).rejects.toThrow('parameters differ');
  });
});
