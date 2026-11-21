import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { config } from 'dotenv';
import pg from 'pg';

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
  const demoBrand = '32000000-0000-4000-8000-000000000001';
  const logoKey = '42000000-0000-4000-8000-000000000001.png';
  const client = new pg.Client({ connectionString: database });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const [id, name, slug, status, logo] of [
      [demoBrand, 'Northline Studio', 'northline-studio', 'active', logoKey],
      [
        '32000000-0000-4000-8000-000000000002',
        'Fieldwork Goods',
        'fieldwork-goods',
        'active',
        null,
      ],
      ['32000000-0000-4000-8000-000000000003', 'Quiet Hours', 'quiet-hours', 'hidden', null],
    ]) {
      const { rowCount } = await client.query(
        `INSERT INTO "brand" ("id", "tenantId", "branchId", "name", "slug", "status", "logoKey", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`,
        [id, tenantId, branchId, name, slug, status, logo],
      );
      if (rowCount && logo === logoKey) {
        const directory = join(imageRoot, tenantId, branchId);
        await mkdir(directory, { recursive: true });
        const image = await readFile(new URL('../config/demo/northline.png', import.meta.url));
        try {
          await writeFile(join(directory, logo), image, { flag: 'wx' });
        } catch (error: unknown) {
          if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
            throw error;
          }
        }
      }
    }
    await client.query(
      `INSERT INTO "product" ("id", "tenantId", "branchId", "brandId", "name", "price", "status", "updatedAt")
       SELECT $1, "tenantId", "branchId", "id", 'Everyday canvas tote', 24.00, 'active', CURRENT_TIMESTAMP
       FROM "brand" WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = $4
       ON CONFLICT DO NOTHING`,
      ['52000000-0000-4000-8000-000000000001', tenantId, branchId, demoBrand],
    );
    await client.query('COMMIT');
  } finally {
    await client.end();
  }
}
