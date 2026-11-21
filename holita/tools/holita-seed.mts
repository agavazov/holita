import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { config } from 'dotenv';
import pg from 'pg';
import { demoCatalogue, demoCategories } from './demo-catalogue.mjs';

config({
  path: ['holita/config/commerce.env', 'holita/config/core.env', 'holita/config/seed-accounts.env'],
  quiet: true,
  override: true,
});
const value = process.env.CORE_DATABASE_URL;
if (!value) {
  throw new Error('Holita Core database configuration is missing');
}
const url = new URL(value);
if (
  url.hostname !== '127.0.0.1' ||
  url.pathname !== '/holita_core' ||
  url.username !== 'holita_core' ||
  url.search ||
  url.hash
) {
  throw new Error('Seed only the dedicated local Holita Core database');
}
const result = spawnSync('npm', ['run', 'db:seed', '--workspace', '@osnova/core'], {
  stdio: 'inherit',
  env: { ...process.env, CORE_SEED_FILE: resolve('holita/config/core-seed.json') },
});
process.exitCode = result.status ?? 1;
if (result.status === 0) {
  await seedCatalogue();
}

async function seedCatalogue(): Promise<void> {
  const database = process.env.COMMERCE_DATABASE_URL;
  const imageRoot = process.env.HOLITA_COMMERCE_IMAGE_DIR;
  if (!database || !imageRoot || !isAbsolute(imageRoot)) {
    throw new Error('Configure the local Holita Commerce database and absolute image directory');
  }
  const commerce = new URL(database);
  if (
    commerce.hostname !== '127.0.0.1' ||
    commerce.pathname !== '/holita_commerce' ||
    commerce.username !== 'holita_commerce' ||
    commerce.search ||
    commerce.hash
  ) {
    throw new Error('Seed only the dedicated local Holita Commerce database');
  }
  const tenantId = '02000000-0000-4000-8000-000000000002';
  const branchId = '12000000-0000-4000-8000-000000000001';
  const directory = join(imageRoot, tenantId, branchId);
  const client = new pg.Client({ connectionString: database });
  let brandsInserted = 0;
  let categoriesInserted = 0;
  let productsInserted = 0;
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const [id, name, slug, parent, sortOrder] of demoCategories) {
      const category = await client.query(
        `INSERT INTO "category" ("id", "tenantId", "branchId", "name", "slug", "parentId", "sortOrder")
         SELECT $1, $2, $3, $4, $5, $6, $7
         WHERE $6::uuid IS NULL OR EXISTS (
           SELECT 1 FROM "category" WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = $6
         )
         ON CONFLICT DO NOTHING`,
        [
          fixtureId('62', id),
          tenantId,
          branchId,
          name,
          slug,
          parent === null ? null : fixtureId('62', parent),
          sortOrder,
        ],
      );
      categoriesInserted += category.rowCount ?? 0;
    }
    for (const brand of demoCatalogue) {
      const brandId = fixtureId('32', brand.id);
      const logoKey = `${fixtureId('42', brand.id)}.png`;
      const { rowCount } = await client.query(
        `INSERT INTO "brand" ("id", "tenantId", "branchId", "name", "slug", "status", "logoKey", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, 'active', $6, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`,
        [brandId, tenantId, branchId, brand.name, brand.slug, logoKey],
      );
      if (rowCount) {
        await mkdir(directory, { recursive: true });
        const image = await readFile(new URL(`../config/demo/${brand.slug}.png`, import.meta.url));
        try {
          await writeFile(join(directory, logoKey), image, { flag: 'wx' });
        } catch (error: unknown) {
          if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
            throw error;
          }
        }
        brandsInserted += rowCount;
      }
      for (const [id, name, price, status = 'active', category] of brand.products) {
        const product = await client.query(
          `INSERT INTO "product" ("id", "tenantId", "branchId", "brandId", "name", "price", "status", "categoryId", "updatedAt")
           SELECT $1, "tenantId", "branchId", "id", $5, $6, $7, $8, CURRENT_TIMESTAMP
           FROM "brand" WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = $4
           AND ($8::uuid IS NULL OR EXISTS (
             SELECT 1 FROM "category" WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = $8
           ))
           ON CONFLICT DO NOTHING`,
          [
            fixtureId('52', id),
            tenantId,
            branchId,
            brandId,
            name,
            price,
            status,
            category === undefined ? null : fixtureId('62', category),
          ],
        );
        productsInserted += product.rowCount ?? 0;
      }
    }
    await client.query('COMMIT');
    console.log(
      `Demo catalogue inserted ${String(brandsInserted)} brands, ${String(categoriesInserted)} categories and ${String(productsInserted)} products.`,
    );
  } finally {
    await client.end();
  }
}

function fixtureId(prefix: string, id: number): string {
  return `${prefix}000000-0000-4000-8000-${String(id).padStart(12, '0')}`;
}
