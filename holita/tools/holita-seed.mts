import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { config } from 'dotenv';
import pg from 'pg';
import {
  demoBadges,
  demoCatalogue,
  demoCategories,
  demoCharacteristicGroups,
  demoCollections,
  demoOptions,
  demoProductImages,
  demoTags,
} from './demo-catalogue.mjs';

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
  let optionsInserted = 0;
  let productsInserted = 0;
  let collectionsInserted = 0;
  let imagesInserted = 0;
  let characteristicGroupsInserted = 0;
  let badgesInserted = 0;
  let tagsInserted = 0;
  let markerAssignmentsInserted = 0;
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const [id, name, values] of demoOptions) {
      const optionId = fixtureId('72', id);
      const { rowCount } = await client.query(
        `INSERT INTO "option" ("id", "tenantId", "branchId", "name", "active", "showInFilters")
         VALUES ($1, $2, $3, $4, true, true) ON CONFLICT DO NOTHING`,
        [optionId, tenantId, branchId, name],
      );
      if (rowCount) {
        optionsInserted += rowCount;
        for (const [sortOrder, [valueId, label]] of values.entries()) {
          await client.query(
            `INSERT INTO "optionValue" ("id", "tenantId", "branchId", "optionId", "label", "sortOrder")
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [fixtureId('82', valueId), tenantId, branchId, optionId, label, sortOrder],
          );
        }
      }
    }
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
      for (const [
        id,
        name,
        price,
        status = 'active',
        category,
        configuredVariants,
        descriptions,
      ] of brand.products) {
        const productId = fixtureId('52', id);
        const variants = configuredVariants ?? [
          [`DEMO-${String(id)}`, price, 0, undefined] as const,
        ];
        const valueIds = [
          ...new Set(
            variants.flatMap(([, , , colour]) =>
              colour === undefined ? [] : [fixtureId('82', colour)],
            ),
          ),
        ];
        const product = await client.query(
          `INSERT INTO "product" ("id", "tenantId", "branchId", "brandId", "name", "status", "categoryId",
                                  "descriptionBg", "descriptionEn", "updatedAt")
           SELECT $1, "tenantId", "branchId", "id", $5, $6, $7, $9, $10, CURRENT_TIMESTAMP
           FROM "brand" WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = $4
           AND ($7::uuid IS NULL OR EXISTS (
             SELECT 1 FROM "category" WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = $7
           ))
           AND (SELECT COUNT(*) FROM "optionValue"
             WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = ANY($8::uuid[])
           ) = cardinality($8::uuid[])
           ON CONFLICT DO NOTHING`,
          [
            productId,
            tenantId,
            branchId,
            brandId,
            name,
            status,
            category === undefined ? null : fixtureId('62', category),
            valueIds,
            descriptions?.bg ?? null,
            descriptions?.en ?? null,
          ],
        );
        if (!product.rowCount) {
          continue;
        }
        productsInserted += product.rowCount;
        for (const [sortOrder, [sku, variantPrice, quantity, colour]] of variants.entries()) {
          const variantId = fixtureId('92', id * 10 + sortOrder);
          const optionValueId = colour === undefined ? null : fixtureId('82', colour);
          const key = createHash('sha256')
            .update(optionValueId ?? '')
            .digest('hex');
          await client.query(
            `INSERT INTO "productVariant" ("id", "tenantId", "branchId", "productId", "sku", "price",
                "quantity", "inventoryTracked", "combinationKey", "sortOrder")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              variantId,
              tenantId,
              branchId,
              productId,
              sku,
              variantPrice,
              quantity,
              !!configuredVariants,
              key,
              sortOrder,
            ],
          );
          if (optionValueId) {
            await client.query(
              `INSERT INTO "productVariantValue" ("tenantId", "branchId", "variantId", "optionValueId")
               VALUES ($1, $2, $3, $4)`,
              [tenantId, branchId, variantId, optionValueId],
            );
          }
        }
      }
    }
    for (const collection of demoCollections) {
      const collectionId = fixtureId('a2', collection.id);
      const categoryId =
        collection.mode === 'category' ? fixtureId('62', collection.categoryId) : null;
      const productIds =
        collection.mode === 'manual' ? collection.productIds.map((id) => fixtureId('52', id)) : [];
      const { rowCount } = await client.query(
        `INSERT INTO "productCollection" ("id", "tenantId", "branchId", "name", "slug", "mode", "categoryId")
         SELECT $1, $2, $3, $4, $5, $6, $7
         WHERE ($7::uuid IS NULL OR EXISTS (
           SELECT 1 FROM "category" WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = $7
         ))
         AND (SELECT COUNT(*) FROM "product"
           WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = ANY($8::uuid[])
         ) = cardinality($8::uuid[])
         ON CONFLICT DO NOTHING`,
        [
          collectionId,
          tenantId,
          branchId,
          collection.name,
          collection.slug,
          collection.mode,
          categoryId,
          productIds,
        ],
      );
      if (rowCount) {
        collectionsInserted += rowCount;
        for (const [sortOrder, productId] of productIds.entries()) {
          await client.query(
            `INSERT INTO "productCollectionItem" ("tenantId", "branchId", "collectionId", "productId", "sortOrder")
             VALUES ($1, $2, $3, $4, $5)`,
            [tenantId, branchId, collectionId, productId, sortOrder],
          );
        }
      }
    }
    for (const group of demoCharacteristicGroups) {
      const groupId = fixtureId('93', group.id);
      const { rowCount } = await client.query(
        `INSERT INTO "characteristicGroup" ("id", "tenantId", "branchId", "name", "sortOrder")
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [groupId, tenantId, branchId, group.name, group.sortOrder],
      );
      if (rowCount) {
        characteristicGroupsInserted += rowCount;
        for (const characteristic of group.characteristics) {
          await client.query(
            `INSERT INTO "characteristic" ("id", "tenantId", "branchId", "groupId", "name", "sortOrder")
             VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
            [
              fixtureId('94', characteristic.id),
              tenantId,
              branchId,
              groupId,
              characteristic.name,
              characteristic.sortOrder,
            ],
          );
        }
        for (const [product, characteristic, value] of group.values) {
          await client.query(
            `INSERT INTO "productCharacteristicValue" ("tenantId", "branchId", "productId", "characteristicId", "value")
             SELECT $1, $2, $3, $4, $5 WHERE EXISTS (
               SELECT 1 FROM "product" WHERE "tenantId" = $1 AND "branchId" = $2 AND "id" = $3
             )
             ON CONFLICT DO NOTHING`,
            [tenantId, branchId, fixtureId('52', product), fixtureId('94', characteristic), value],
          );
        }
      }
    }
    for (const [id, photos] of Object.entries(demoProductImages)) {
      const productId = fixtureId('52', Number(id));
      // Backfill untouched demo products without restoring a merchant's cleared gallery.
      const available = await client.query(
        `SELECT 1 FROM "product" p
         WHERE p."tenantId" = $1 AND p."branchId" = $2 AND p."id" = $3
           AND p."createdAt" = p."updatedAt"
           AND NOT EXISTS (
             SELECT 1 FROM "productImage" i
             WHERE i."tenantId" = $1 AND i."branchId" = $2 AND i."productId" = $3
           )
         FOR UPDATE OF p`,
        [tenantId, branchId, productId],
      );
      if (available.rowCount) {
        const productDirectory = join(directory, 'products');
        await mkdir(productDirectory, { recursive: true });
        for (const [sortOrder, [number, file, altText]] of photos.entries()) {
          const imageId = fixtureId('93', number);
          const key = `${imageId}.png`;
          await client.query(
            `INSERT INTO "productImage" ("id", "tenantId", "branchId", "productId", "storageKey", "altText", "sortOrder")
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [imageId, tenantId, branchId, productId, key, altText, sortOrder],
          );
          const bytes = await readFile(new URL(`../config/demo/${file}`, import.meta.url));
          try {
            await writeFile(join(productDirectory, key), bytes, { flag: 'wx' });
          } catch (error: unknown) {
            if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
              throw error;
            }
          }
          imagesInserted++;
        }
      }
    }
    for (const badge of demoBadges) {
      const badgeId = fixtureId('b2', badge.id);
      const { rowCount } = await client.query(
        `INSERT INTO "productBadge" ("id", "tenantId", "branchId", "name", "slug", "color")
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [badgeId, tenantId, branchId, badge.name, badge.slug, badge.color],
      );
      if (rowCount) {
        badgesInserted += rowCount;
        const assignments = await client.query(
          `INSERT INTO "productBadgeAssignment" ("tenantId", "branchId", "productId", "badgeId")
           SELECT p."tenantId", p."branchId", p."id", b."id"
           FROM "product" p
           JOIN "productBadge" b ON b."tenantId" = p."tenantId" AND b."branchId" = p."branchId"
           WHERE p."tenantId" = $1 AND p."branchId" = $2
             AND p."id" = ANY($3::uuid[]) AND b."id" = $4
           ON CONFLICT DO NOTHING`,
          [tenantId, branchId, badge.productIds.map((id) => fixtureId('52', id)), badgeId],
        );
        markerAssignmentsInserted += assignments.rowCount ?? 0;
      }
    }
    for (const tag of demoTags) {
      const tagId = fixtureId('c2', tag.id);
      const { rowCount } = await client.query(
        `INSERT INTO "productTag" ("id", "tenantId", "branchId", "name", "normalizedName", "slug")
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [tagId, tenantId, branchId, tag.name, tag.name.toLowerCase(), tag.slug],
      );
      if (rowCount) {
        tagsInserted += rowCount;
        const assignments = await client.query(
          `INSERT INTO "productTagAssignment" ("tenantId", "branchId", "productId", "tagId")
           SELECT p."tenantId", p."branchId", p."id", t."id"
           FROM "product" p
           JOIN "productTag" t ON t."tenantId" = p."tenantId" AND t."branchId" = p."branchId"
           WHERE p."tenantId" = $1 AND p."branchId" = $2
             AND p."id" = ANY($3::uuid[]) AND t."id" = $4
           ON CONFLICT DO NOTHING`,
          [tenantId, branchId, tag.productIds.map((id) => fixtureId('52', id)), tagId],
        );
        markerAssignmentsInserted += assignments.rowCount ?? 0;
      }
    }
    await client.query('COMMIT');
    console.log(
      `Demo catalogue inserted ${String(brandsInserted)} brands, ${String(categoriesInserted)} categories, ${String(optionsInserted)} options, ${String(productsInserted)} products, ${String(collectionsInserted)} collections, ${String(characteristicGroupsInserted)} characteristic groups and ${String(imagesInserted)} product images.`,
    );
    console.log(
      `Demo product markers inserted ${String(badgesInserted)} badges, ${String(tagsInserted)} tags and ${String(markerAssignmentsInserted)} assignments.`,
    );
  } finally {
    await client.end();
  }
}

function fixtureId(prefix: string, id: number): string {
  return `${prefix}000000-0000-4000-8000-${String(id).padStart(12, '0')}`;
}
