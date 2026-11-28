import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, resolve } from 'node:path';
import { config } from 'dotenv';
import pg from 'pg';
import {
  demoBadges,
  demoBankTransfer,
  demoBlogArticles,
  demoBlogTags,
  demoCatalogue,
  demoCategories,
  demoCharacteristicGroups,
  demoCollections,
  demoCustomerDetail,
  demoCustomers,
  demoDashboardCustomer,
  demoDashboardOrders,
  demoDiscounts,
  demoInvoice,
  demoInvoicedManualOrder,
  demoManualOrder,
  demoManualOrderInvoice,
  demoNavigationMenus,
  demoOptions,
  demoOrders,
  demoPages,
  demoPaymentMethod,
  demoPickupShipping,
  demoProductCovers,
  demoProductImages,
  demoRefund,
  demoReturnCase,
  demoSaturdayShipping,
  demoSeparateBillingOrder,
  demoShippingMethod,
  demoShopSettings,
  demoShopper,
  demoTags,
  type DemoShopperOrder,
  type DemoVariant,
} from './demo-catalogue.mjs';

const demoHistoricalOrderMoney = { currency: 'EUR', shippingFee: '6.00' } as const;

config({
  path: [
    'holita/config/commerce.env',
    'holita/config/core.env',
    'holita/config/sales.env',
    'holita/config/seed-accounts.env',
  ],
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
  await seedLeads(url);
}

async function seedLeads(core: URL): Promise<void> {
  const sales = URL.parse(process.env.SALES_DATABASE_URL ?? '');
  if (
    !sales ||
    sales.protocol !== 'postgresql:' ||
    sales.hostname !== '127.0.0.1' ||
    sales.pathname !== '/holita_sales' ||
    sales.username !== 'holita_sales' ||
    sales.search ||
    sales.hash
  ) {
    throw new Error('Seed only the dedicated local Holita Sales database');
  }
  const email = process.env.HOLITA_SALES_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error('Configure the Holita Sales seed account');
  }
  const coreClient = new pg.Client({ connectionString: core.toString() });
  await coreClient.connect();
  let creator: { id: string; tenantId: string } | undefined;
  try {
    const account = await coreClient.query<{ id: string; tenantId: string }>(
      `SELECT u."id", u."tenantId"
       FROM "user" u JOIN "tenant" t ON t."id" = u."tenantId"
       WHERE u."email" = $1 AND u."role" = 'sales' AND t."kind" = 'platform'`,
      [email],
    );
    creator = account.rows[0];
  } finally {
    await coreClient.end();
  }
  if (!creator) {
    throw new Error('The Core platform Sales seed account is missing');
  }

  const client = new pg.Client({ connectionString: sales.toString() });
  await client.connect();
  const firstLead = 'b2000000-0000-4000-8000-000000000001';
  const secondLead = 'b2000000-0000-4000-8000-000000000002';
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `INSERT INTO "lead" ("id", "tenantId", "displayName", "websiteUrl", "sourceName",
                           "createdByUserId", "updatedAt")
       VALUES ($1, $2, NULL, $3, NULL, $4, CURRENT_TIMESTAMP),
              ($5, $2, $6, NULL, $7, $4, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING`,
      [
        firstLead,
        creator.tenantId,
        'https://rilska-hartiya.example',
        creator.id,
        secondLead,
        'Ателие „Бяла глина“',
        'Препоръка',
      ],
    );
    const contacts = await client.query(
      `INSERT INTO "leadContact" ("id", "tenantId", "leadId", "name", "phone", "email",
                                  "role", "isPrimary", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'owner', NOT EXISTS (
                 SELECT 1 FROM "leadContact" WHERE "tenantId" = $2 AND "leadId" = $3 AND "isPrimary"
               ), CURRENT_TIMESTAMP),
              ($7, $2, $3, $8, NULL, $9, 'technical', false, CURRENT_TIMESTAMP),
              ($10, $2, $11, NULL, NULL, $12, 'unknown', false, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING`,
      [
        'b3000000-0000-4000-8000-000000000001',
        creator.tenantId,
        firstLead,
        'Ива Стоянова',
        '+12025550101',
        'owner@rilska-hartiya.example',
        'b3000000-0000-4000-8000-000000000002',
        'Борис Илиев',
        'tech@rilska-hartiya.example',
        'b3000000-0000-4000-8000-000000000003',
        secondLead,
        'hello@byala-glina.example',
      ],
    );
    await client.query('COMMIT');
    console.log(`Holita Sales prospects inserted: ${String(rowCount)}`);
    console.log(`Holita Sales contacts inserted: ${String(contacts.rowCount)}`);
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
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
  let discountsInserted = 0;
  let pagesInserted = 0;
  let blogTagsInserted = 0;
  let blogArticlesInserted = 0;
  const saveGallery = async (productId: string, photos: (typeof demoProductImages)[number]) => {
    const productDirectory = join(directory, 'products');
    await mkdir(productDirectory, { recursive: true });
    for (const [sortOrder, [number, file, altText]] of photos.entries()) {
      const imageId = fixtureId('93', number);
      const key = `${imageId}${extname(file)}`;
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
  };
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const [id, name, values, showInListing = false] of demoOptions) {
      const optionId = fixtureId('72', id);
      const { rowCount } = await client.query(
        `INSERT INTO "option" ("id", "tenantId", "branchId", "name", "active", "showInFilters", "showInListing")
         VALUES ($1, $2, $3, $4, true, true, $5) ON CONFLICT DO NOTHING`,
        [optionId, tenantId, branchId, name, showInListing],
      );
      if (rowCount) {
        optionsInserted += rowCount;
        for (const [sortOrder, [valueId, label, swatchColor]] of values.entries()) {
          await client.query(
            `INSERT INTO "optionValue" ("id", "tenantId", "branchId", "optionId", "label", "sortOrder", "swatchColor")
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              fixtureId('82', valueId),
              tenantId,
              branchId,
              optionId,
              label,
              sortOrder,
              swatchColor ?? null,
            ],
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
        const variants: readonly DemoVariant[] = configuredVariants ?? [
          [`DEMO-${String(id)}`, price, 0],
        ];
        const valueIds = [
          ...new Set(
            variants.flatMap(([, , , values = []]) =>
              values.map((value) => fixtureId('82', value)),
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
        if (variants.some(([, , , , , purchase]) => purchase)) {
          const gallery = demoProductImages[id];
          if (!gallery) {
            throw new Error(`Missing demo gallery for product ${String(id)}`);
          }
          await saveGallery(productId, gallery);
        }
        for (const [
          sortOrder,
          [sku, variantPrice, quantity, values = [], inventoryTracked, purchase],
        ] of variants.entries()) {
          const variantId = fixtureId('92', id * 10 + sortOrder);
          const optionValueIds = values.map((value) => fixtureId('82', value)).sort();
          const key = createHash('sha256').update(optionValueIds.join(',')).digest('hex');
          await client.query(
            `INSERT INTO "productVariant" ("id", "tenantId", "branchId", "productId", "sku", "price",
                "quantity", "inventoryTracked", "combinationKey", "sortOrder", "minimumQuantity", "imageId", "barcode")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              variantId,
              tenantId,
              branchId,
              productId,
              sku,
              variantPrice,
              quantity,
              inventoryTracked ?? !!configuredVariants,
              key,
              sortOrder,
              purchase?.minimumQuantity ?? 1,
              purchase ? fixtureId('93', purchase.imageId) : null,
              purchase?.barcode ?? null,
            ],
          );
          for (const optionValueId of optionValueIds) {
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
      const categoryId = group.categoryId ? fixtureId('62', group.categoryId) : null;
      const { rowCount } = await client.query(
        `INSERT INTO "characteristicGroup" ("id", "tenantId", "branchId", "name", "sortOrder")
         SELECT $1, $2, $3, $4, $5 WHERE $6::uuid IS NULL OR EXISTS (
           SELECT 1 FROM "category" WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = $6
         ) ON CONFLICT DO NOTHING`,
        [groupId, tenantId, branchId, group.name, group.sortOrder, categoryId],
      );
      if (rowCount) {
        characteristicGroupsInserted += rowCount;
        if (categoryId) {
          await client.query(
            `INSERT INTO "characteristicGroupCategory" ("tenantId", "branchId", "groupId", "categoryId")
             VALUES ($1, $2, $3, $4)`,
            [tenantId, branchId, groupId, categoryId],
          );
        }
        for (const characteristic of group.characteristics) {
          const characteristicId = fixtureId('94', characteristic.id);
          await client.query(
            `INSERT INTO "characteristic" ("id", "tenantId", "branchId", "groupId", "name", "sortOrder", "kind")
             VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
            [
              characteristicId,
              tenantId,
              branchId,
              groupId,
              characteristic.name,
              characteristic.sortOrder,
              characteristic.kind ?? 'text',
            ],
          );
          for (const [id, name] of characteristic.choices ?? []) {
            await client.query(
              `INSERT INTO "characteristicChoice" ("id", "tenantId", "branchId", "characteristicId", "name")
               VALUES ($1, $2, $3, $4, $5)`,
              [fixtureId('95', id), tenantId, branchId, characteristicId, name],
            );
          }
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
        for (const [product, characteristic, choice] of group.choiceAssignments ?? []) {
          await client.query(
            `INSERT INTO "productCharacteristicChoice" ("tenantId", "branchId", "productId", "characteristicId", "choiceId")
             SELECT $1, $2, $3, $4, $5 WHERE EXISTS (
               SELECT 1 FROM "product" WHERE "tenantId" = $1 AND "branchId" = $2 AND "id" = $3
                 AND ($6::uuid IS NULL OR "categoryId" = $6)
             ) ON CONFLICT DO NOTHING`,
            [
              tenantId,
              branchId,
              fixtureId('52', product),
              fixtureId('94', characteristic),
              fixtureId('95', choice),
              categoryId,
            ],
          );
        }
      }
    }
    for (const [id, photos] of Object.entries({ ...demoProductImages, ...demoProductCovers })) {
      const productId = fixtureId('52', Number(id));
      // Leave galleries cleared by a merchant empty.
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
        await saveGallery(productId, photos);
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
    for (const page of demoPages) {
      const { rowCount } = await client.query(
        `INSERT INTO "shopPage" ("id", "tenantId", "branchId", "slug", "status",
                                 "titleBg", "bodyBg", "titleEn", "bodyEn", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`,
        [
          fixtureId('c3', page.id),
          tenantId,
          branchId,
          page.slug,
          page.status,
          page.titleBg,
          page.bodyBg,
          page.titleEn,
          page.bodyEn,
        ],
      );
      pagesInserted += rowCount ?? 0;
    }
    for (const tag of demoBlogTags) {
      const { rowCount } = await client.query(
        `INSERT INTO "blogTag" ("id", "tenantId", "branchId", "name", "normalizedName", "slug", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`,
        [fixtureId('db', tag.id), tenantId, branchId, tag.name, tag.name.toLowerCase(), tag.slug],
      );
      blogTagsInserted += rowCount ?? 0;
    }
    for (const article of demoBlogArticles) {
      const articleId = fixtureId('e3', article.id);
      const { rowCount } = await client.query(
        `INSERT INTO "blogArticle" ("id", "tenantId", "branchId", "slug", "status", "publishedAt",
                                    "titleBg", "bodyBg", "titleEn", "bodyEn", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`,
        [
          articleId,
          tenantId,
          branchId,
          article.slug,
          article.status,
          article.publishedAt,
          article.titleBg,
          article.bodyBg,
          article.titleEn,
          article.bodyEn,
        ],
      );
      if (rowCount) {
        blogArticlesInserted += rowCount;
        await client.query(
          `INSERT INTO "blogArticleTag" ("tenantId", "branchId", "articleId", "tagId")
           SELECT "tenantId", "branchId", $1, "id" FROM "blogTag"
           WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = ANY($4::uuid[])
           ON CONFLICT DO NOTHING`,
          [articleId, tenantId, branchId, article.tagIds.map((id) => fixtureId('db', id))],
        );
      }
    }
    const navigationMenusInserted = await seedNavigationMenus(client, tenantId, branchId);
    const { rowCount: shopSettingsInserted } = await client.query(
      `INSERT INTO "shopSettings" ("tenantId", "branchId", "displayName",
                                   "contactEmail", "contactPhone", "contactAddress", "basicHome")
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT ("tenantId", "branchId") DO NOTHING`,
      [
        tenantId,
        branchId,
        demoShopSettings.displayName,
        demoShopSettings.contactEmail,
        demoShopSettings.contactPhone,
        demoShopSettings.contactAddress,
        demoShopSettings.basicHome,
      ],
    );
    await seedShopperCart(client, tenantId, branchId);
    for (const [id, method, sortOrder] of [
      [1, demoPaymentMethod, 0],
      [2, demoBankTransfer, 10],
    ] as const) {
      await client.query(
        `INSERT INTO "paymentMethod" ("id", "tenantId", "branchId", "label", "instructions", "enabled", "sortOrder", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, true, $6, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`,
        [fixtureId('d3', id), tenantId, branchId, method.label, method.instructions, sortOrder],
      );
    }
    for (const [id, method, enabled, sortOrder] of [
      [1, demoShippingMethod, true, 0],
      [2, demoSaturdayShipping, false, 10],
      [3, demoPickupShipping, true, 20],
    ] as const) {
      await client.query(
        `INSERT INTO "shippingMethod" ("id", "tenantId", "branchId", "label", "fixedFee", "enabled", "sortOrder", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`,
        [
          fixtureId('d4', id),
          tenantId,
          branchId,
          method.label,
          method.fixedFee,
          enabled,
          sortOrder,
        ],
      );
    }
    for (const { id, code, value, minSubtotal, endsAt } of demoDiscounts) {
      const { rowCount } = await client.query(
        `INSERT INTO "discount" ("id", "tenantId", "branchId", "code", "type", "value", "enabled", "minSubtotal", "endsAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'percentage', $5, true, $6, $7, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`,
        [fixtureId('da', id), tenantId, branchId, code, value, minSubtotal, endsAt],
      );
      discountsInserted += rowCount ?? 0;
    }
    for (const order of demoOrders) {
      await seedShopperOrder(
        client,
        tenantId,
        branchId,
        demoShopper,
        order,
        demoHistoricalOrderMoney,
      );
    }
    await client.query(
      `WITH "newCase" AS (
         INSERT INTO "orderReturnCase" ("id", "tenantId", "branchId", "orderId", "reason", "requestedAt")
         SELECT $1, "tenantId", "branchId", "orderId", $6, $7 FROM "orderLine"
         WHERE "tenantId" = $2 AND "branchId" = $3 AND "orderId" = $4 AND "id" = $5 AND "quantity" >= $8
         ON CONFLICT ("id") DO NOTHING
         RETURNING "id", "tenantId", "branchId", "orderId"
       )
       INSERT INTO "orderReturnLine" ("tenantId", "branchId", "orderId", "returnCaseId", "orderLineId", "quantity")
       SELECT "tenantId", "branchId", "orderId", "id", $5, $8 FROM "newCase"`,
      [
        fixtureId('df', demoReturnCase.id),
        tenantId,
        branchId,
        fixtureId('d5', demoReturnCase.order),
        fixtureId('d6', demoReturnCase.orderLine),
        demoReturnCase.reason,
        demoReturnCase.requestedAt,
        demoReturnCase.quantity,
      ],
    );
    await seedShopperOrder(client, tenantId, branchId, demoShopper, demoSeparateBillingOrder, {
      currency: 'EUR',
      shippingFee: demoShippingMethod.fixedFee,
    });
    for (const order of [demoManualOrder, demoInvoicedManualOrder]) {
      await seedManualOrder(client, tenantId, branchId, order);
    }
    for (const invoice of [demoInvoice, demoManualOrderInvoice]) {
      await seedOrderInvoice(client, tenantId, branchId, invoice);
    }
    await seedCustomerDetail(client, tenantId, branchId);
    await seedCustomers(client, tenantId, branchId);
    await seedDashboard(client, tenantId, branchId);
    await client.query('COMMIT');
    console.log(
      `Demo catalogue inserted ${String(brandsInserted)} brands, ${String(categoriesInserted)} categories, ${String(optionsInserted)} options, ${String(productsInserted)} products, ${String(collectionsInserted)} collections, ${String(characteristicGroupsInserted)} characteristic groups and ${String(imagesInserted)} product images.`,
    );
    console.log(
      `Demo product markers inserted ${String(badgesInserted)} badges, ${String(tagsInserted)} tags and ${String(markerAssignmentsInserted)} assignments.`,
    );
    console.log(`Demo discounts inserted ${String(discountsInserted)} codes.`);
    console.log(`Demo content inserted ${String(pagesInserted)} pages.`);
    console.log(
      `Demo blog inserted ${String(blogTagsInserted)} tags and ${String(blogArticlesInserted)} articles.`,
    );
    console.log(`Demo navigation inserted ${String(navigationMenusInserted)} menus.`);
    console.log(`Demo shop settings inserted ${String(shopSettingsInserted ?? 0)} rows.`);
  } finally {
    await client.end();
  }
}

async function seedNavigationMenus(client: pg.Client, tenantId: string, branchId: string) {
  let inserted = 0;
  for (const menu of demoNavigationMenus) {
    const menuId = fixtureId('f3', menu.id);
    const categoryIds = menu.links.flatMap((link) =>
      link.type === 'category' ? [fixtureId('62', link.target)] : [],
    );
    const pageIds = menu.links.flatMap((link) =>
      link.type === 'page' ? [fixtureId('c3', link.target)] : [],
    );
    const { rowCount } = await client.query(
      `INSERT INTO "navigationMenu" ("id", "tenantId", "branchId", "placement", "updatedAt")
       SELECT $1, $2, $3, $4, CURRENT_TIMESTAMP
       WHERE (SELECT count(*) FROM "category"
              WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = ANY($5::uuid[])) = cardinality($5::uuid[])
         AND (SELECT count(*) FROM "shopPage"
              WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = ANY($6::uuid[])) = cardinality($6::uuid[])
       ON CONFLICT DO NOTHING`,
      [menuId, tenantId, branchId, menu.placement, categoryIds, pageIds],
    );
    if (rowCount) {
      inserted += rowCount;
      for (const [sortOrder, link] of menu.links.entries()) {
        await client.query(
          `INSERT INTO "navigationMenuItem" ("id", "tenantId", "branchId", "menuId", "sortOrder",
                                            "labelBg", "labelEn", "destinationType", "categoryId", "pageId")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
          [
            fixtureId('f4', link.id),
            tenantId,
            branchId,
            menuId,
            sortOrder,
            link.labelBg,
            link.labelEn,
            link.type,
            link.type === 'category' ? fixtureId('62', link.target) : null,
            link.type === 'page' ? fixtureId('c3', link.target) : null,
          ],
        );
      }
    }
  }
  return inserted;
}

async function seedShopperCart(client: pg.Client, tenantId: string, branchId: string) {
  // The Core seed builds the shared auth package before this import.
  const { hashPassword, validatePassword } = await import('@osnova/auth');
  const { email, name, cartSkus } = demoShopper;
  const password = process.env.HOLITA_DEMO_SHOPPER_PASSWORD;
  if (!password) {
    throw new Error('Configure HOLITA_DEMO_SHOPPER_PASSWORD in holita/config/seed-accounts.env');
  }
  await client.query(
    `INSERT INTO "customer" ("id", "tenantId", "branchId", "email", "name", "passwordHash", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`,
    [
      fixtureId('d2', 1),
      tenantId,
      branchId,
      email,
      name,
      await hashPassword(validatePassword(password)),
    ],
  );

  const { rows: variants } = await client.query<{ id: string }>(
    `SELECT v."id" FROM "productVariant" v
     JOIN "product" p ON p."tenantId" = v."tenantId" AND p."branchId" = v."branchId"
       AND p."id" = v."productId"
     WHERE v."tenantId" = $1 AND v."branchId" = $2 AND v."sku" = ANY($3::text[])
       AND v."active" AND p."status" = 'active' AND (NOT v."inventoryTracked" OR v."quantity" > 0)
     ORDER BY v."sku"`,
    [tenantId, branchId, cartSkus],
  );
  if (variants.length !== cartSkus.length) {
    return;
  }
  const cartId = fixtureId('e2', 1);
  const cart = await client.query(
    `INSERT INTO "cart" ("id", "tenantId", "branchId", "customerId", "updatedAt")
     SELECT $1, "tenantId", "branchId", "id", CURRENT_TIMESTAMP FROM "customer"
     WHERE "tenantId" = $2 AND "branchId" = $3 AND lower("email") = $4
     ON CONFLICT DO NOTHING`,
    [cartId, tenantId, branchId, email],
  );
  if (cart.rowCount) {
    for (const [index, variant] of variants.entries()) {
      await client.query(
        `INSERT INTO "cartLine" ("id", "tenantId", "branchId", "cartId", "variantId", "quantity")
         VALUES ($1, $2, $3, $4, $5, 1)`,
        [fixtureId('f2', index + 1), tenantId, branchId, cartId, variant.id],
      );
    }
  }
}

async function seedCustomerDetail(client: pg.Client, tenantId: string, branchId: string) {
  const fixture = demoCustomerDetail;
  const customerId = fixtureId('d2', fixture.id);
  const inserted = await client.query(
    `INSERT INTO "customer" ("id", "tenantId", "branchId", "name", "email", "phone", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`,
    [customerId, tenantId, branchId, fixture.name, fixture.email, fixture.phone],
  );
  const { id, recipient, line1, city, postalCode, countryCode } = fixture.address;
  if (inserted.rowCount) {
    await client.query(
      `INSERT INTO "customerAddress" ("id", "tenantId", "branchId", "customerId", "recipient", "line1",
        "city", "postalCode", "countryCode", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`,
      [
        fixtureId('da', id),
        tenantId,
        branchId,
        customerId,
        recipient,
        line1,
        city,
        postalCode,
        countryCode,
      ],
    );
  }
  await seedShopperOrder(
    client,
    tenantId,
    branchId,
    { name: fixture.name, email: fixture.email, customerId },
    { ...fixture.order, phone: fixture.phone, city, postalCode, address: line1 },
    demoHistoricalOrderMoney,
  );
}

async function seedCustomers(client: pg.Client, tenantId: string, branchId: string) {
  // Keep the listing fixtures outside the demo dashboard's reporting window.
  const createdAt = '2026-10-01T09:00:00Z';
  for (const [id, name, emailName] of demoCustomers) {
    await client.query(
      `INSERT INTO "customer" ("id", "tenantId", "branchId", "name", "email", "phone", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7) ON CONFLICT DO NOTHING`,
      [
        fixtureId('d2', id),
        tenantId,
        branchId,
        name,
        `${emailName}@demo.holita.test`,
        `+359 2 555 02${String(id).padStart(2, '0')}`,
        createdAt,
      ],
    );
  }
}

async function seedDashboard(client: pg.Client, tenantId: string, branchId: string) {
  const { rows } = await client.query<{ daysAgo: number; noon: Date }>(
    `SELECT days AS "daysAgo",
       (date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia') -
        days * INTERVAL '1 day' + INTERVAL '12 hours') AT TIME ZONE 'Europe/Sofia' AS noon
     FROM unnest($1::integer[]) AS offsets(days)`,
    [demoDashboardOrders.map(({ daysAgo }) => daysAgo)],
  );
  const noons = new Map(rows.map(({ daysAgo, noon }) => [daysAgo, noon]));
  const customer = demoDashboardCustomer;
  const customerId = fixtureId('d2', customer.id);
  const customerNoon = noons.get(customer.daysAgo);
  if (!customerNoon) {
    throw new Error('Missing demo dashboard customer date');
  }
  await client.query(
    `INSERT INTO "customer" ("id", "tenantId", "branchId", "name", "email", "phone", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`,
    [
      customerId,
      tenantId,
      branchId,
      customer.name,
      customer.email,
      customer.phone,
      new Date(customerNoon.getTime() - 3_600_000),
    ],
  );
  for (const { id, lineId, daysAgo, quantity, status, subtotal, total } of demoDashboardOrders) {
    const noon = noons.get(daysAgo);
    if (!noon) {
      throw new Error('Missing demo dashboard order date');
    }
    const placedAt = noon.toISOString();
    const contact =
      daysAgo <= customer.daysAgo
        ? { ...customer, customerId }
        : { name: 'Виктория Илиева', email: 'viktoria-127@example.test', guest: true };
    const fulfillment = [
      ['placed', 'confirmed'],
      ['confirmed', 'processing'],
      ['processing', 'shipped'],
      ['shipped', 'completed'],
    ] as const;
    const order: DemoShopperOrder = {
      id,
      status,
      subtotal,
      total,
      placedAt,
      paidAt: null,
      statusChanges:
        status === 'completed'
          ? fulfillment.map(([from, to], index) => [
              from,
              to,
              new Date(noon.getTime() + (index + 1) * 3_600_000).toISOString(),
            ])
          : [],
      phone: customer.phone,
      city: 'София',
      postalCode: '1000',
      address: 'ул. „Шипка“ 27',
      lines: [{ ...demoManualOrder.line, id: lineId, quantity, unitPrice: '27.05' }],
    };
    await seedShopperOrder(client, tenantId, branchId, contact, order, {
      currency: 'EUR',
      shippingFee: demoShippingMethod.fixedFee,
    });
  }
}

async function seedShopperOrder(
  client: pg.Client,
  tenantId: string,
  branchId: string,
  contact: {
    readonly name: string;
    readonly email: string;
    readonly customerId?: string;
    readonly guest?: boolean;
  },
  fixture: DemoShopperOrder,
  money: { readonly currency: 'EUR'; readonly shippingFee: string },
) {
  const {
    id,
    status,
    placedAt,
    paidAt,
    statusChanges,
    phone,
    city,
    postalCode,
    address,
    billingAddress,
    shopperNote,
    subtotal,
    total,
    lines,
  } = fixture;
  const cartId = fixtureId('e2', id + 1);
  const orderId = fixtureId('d5', id);
  const variantIds = lines.map(({ variant }) => fixtureId('92', variant));
  const guestTokenHash = contact.guest ? randomBytes(32).toString('hex') : null;
  const {
    rows: [cart],
  } = await client.query<{ customerId: string | null }>(
    `INSERT INTO "cart" ("id", "tenantId", "branchId", "customerId", "guestTokenHash", "createdAt", "updatedAt", "consumedAt")
     SELECT $1, $2, $3, owner."id", $8, $5, $5, $5
     FROM (
       SELECT "id" FROM "customer"
       WHERE "tenantId" = $2 AND "branchId" = $3 AND lower("email") = $4
         AND ($7::uuid IS NULL OR "id" = $7) AND $8::text IS NULL
       UNION ALL SELECT NULL::uuid WHERE $8::text IS NOT NULL
     ) AS owner
     WHERE (SELECT COUNT(*) FROM "productVariant"
         WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = ANY($6::uuid[])
           AND NOT "inventoryTracked"
       ) = cardinality($6::uuid[])
     ON CONFLICT DO NOTHING RETURNING "customerId"`,
    [
      cartId,
      tenantId,
      branchId,
      contact.email,
      placedAt,
      variantIds,
      contact.customerId ?? null,
      guestTokenHash,
    ],
  );
  if (!cart) {
    return;
  }
  const order = await client.query(
    `INSERT INTO "order" ("id", "tenantId", "branchId", "cartId", "customerId", "orderNumber",
       "status", "paymentStatus", "placedAt", "paidAt", "contactName", "contactEmail", "contactPhone",
       "shippingCountryCode", "shippingCity", "shippingPostalCode", "shippingLine1",
       "paymentMethodLabel", "paymentInstructions", "shippingMethodLabel", "currency", "subtotal", "shippingFee", "total",
       "billingName", "billingPhone", "billingCountryCode", "billingCity", "billingPostalCode", "billingLine1", "billingLine2", "shopperNote")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'BG', $14, $15, $16, $17, $18, $19,
       $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31) ON CONFLICT DO NOTHING`,
    [
      orderId,
      tenantId,
      branchId,
      cartId,
      cart.customerId,
      `H-${orderId}`,
      status,
      paidAt ? 'paid' : 'unpaid',
      placedAt,
      paidAt,
      contact.name,
      contact.email,
      phone,
      city,
      postalCode,
      address,
      demoPaymentMethod.label,
      demoPaymentMethod.instructions,
      demoShippingMethod.label,
      money.currency,
      subtotal,
      money.shippingFee,
      total,
      billingAddress?.name ?? null,
      billingAddress?.phone ?? null,
      billingAddress?.countryCode ?? null,
      billingAddress?.city ?? null,
      billingAddress?.postalCode ?? null,
      billingAddress?.line1 ?? null,
      billingAddress?.line2 ?? null,
      shopperNote ?? null,
    ],
  );
  if (order.rowCount) {
    for (const [fromStatus, toStatus, occurredAt] of statusChanges) {
      await client.query(
        `INSERT INTO "orderStatusChange" ("tenantId", "branchId", "orderId", "fromStatus", "toStatus", "occurredAt")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, branchId, orderId, fromStatus, toStatus, occurredAt],
      );
    }
    for (const [sortOrder, line] of lines.entries()) {
      const variantId = fixtureId('92', line.variant);
      await client.query(
        `INSERT INTO "cartLine" ("id", "tenantId", "branchId", "cartId", "variantId", "quantity", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
        [
          fixtureId('f2', line.id + 2),
          tenantId,
          branchId,
          cartId,
          variantId,
          line.quantity,
          placedAt,
        ],
      );
      await client.query(
        `INSERT INTO "orderLine" ("id", "tenantId", "branchId", "orderId", "variantId", "sortOrder",
           "sku", "label", "quantity", "unitPrice", "stockDeductedQuantity")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0) ON CONFLICT DO NOTHING`,
        [
          fixtureId('d6', line.id),
          tenantId,
          branchId,
          orderId,
          variantId,
          sortOrder,
          line.sku,
          line.label,
          line.quantity,
          line.unitPrice,
        ],
      );
    }
    if (id === demoRefund.order) {
      await client.query(
        `INSERT INTO "orderRefund" ("id", "tenantId", "branchId", "orderId", "amount", "currency", "reason", "createdAt")
         SELECT $1, "tenantId", "branchId", "id", $5, "currency", $6, $7
         FROM "order" WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = $4
         ON CONFLICT DO NOTHING`,
        [
          fixtureId('d9', 1),
          tenantId,
          branchId,
          orderId,
          demoRefund.amount,
          demoRefund.reason,
          demoRefund.createdAt,
        ],
      );
    }
  }
}

async function seedManualOrder(
  client: pg.Client,
  tenantId: string,
  branchId: string,
  fixture: typeof demoManualOrder,
) {
  const orderId = fixtureId('d5', fixture.id);
  const variantId = fixtureId('92', fixture.line.variant);
  const inserted = await client.query(
    `INSERT INTO "order" ("id", "tenantId", "branchId", "orderNumber", "placedAt",
       "contactName", "contactEmail", "contactPhone", "shippingCountryCode", "shippingCity",
       "shippingPostalCode", "shippingLine1", "merchantNote", "paymentMethodId", "paymentMethodLabel",
       "paymentInstructions", "shippingMethodId", "shippingMethodLabel", "currency",
       "subtotal", "shippingFee", "total")
     SELECT $1, $2, $3, $4, $5, $6, $7, $8, 'BG', $9, $10, $11, $12, p."id", $13, $14,
       s."id", $15, $16, $17::numeric * $18::integer, $19::numeric,
       $17::numeric * $18::integer + $19::numeric
     FROM "productVariant" v
     JOIN "paymentMethod" p ON p."tenantId" = v."tenantId" AND p."branchId" = v."branchId"
     JOIN "shippingMethod" s ON s."tenantId" = v."tenantId" AND s."branchId" = v."branchId"
     WHERE v."tenantId" = $2 AND v."branchId" = $3 AND v."id" = $20 AND NOT v."inventoryTracked"
       AND p."id" = $21 AND s."id" = $22
     ON CONFLICT DO NOTHING`,
    [
      orderId,
      tenantId,
      branchId,
      `H-${orderId}`,
      fixture.placedAt,
      fixture.contactName,
      fixture.contactEmail,
      fixture.phone,
      fixture.city,
      fixture.postalCode,
      fixture.address,
      fixture.merchantNote,
      demoPaymentMethod.label,
      demoPaymentMethod.instructions,
      demoShippingMethod.label,
      demoHistoricalOrderMoney.currency,
      fixture.line.unitPrice,
      fixture.line.quantity,
      demoHistoricalOrderMoney.shippingFee,
      variantId,
      fixtureId('d3', 1),
      fixtureId('d4', 1),
    ],
  );
  if (inserted.rowCount) {
    await client.query(
      `INSERT INTO "orderLine" ("id", "tenantId", "branchId", "orderId", "variantId", "sortOrder",
         "sku", "label", "quantity", "unitPrice", "stockDeductedQuantity")
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, $9, 0) ON CONFLICT DO NOTHING`,
      [
        fixtureId('d6', fixture.line.id),
        tenantId,
        branchId,
        orderId,
        variantId,
        fixture.line.sku,
        fixture.line.label,
        fixture.line.quantity,
        fixture.line.unitPrice,
      ],
    );
  }
}

async function seedOrderInvoice(
  client: pg.Client,
  tenantId: string,
  branchId: string,
  fixture: typeof demoInvoice,
) {
  const invoiceId = fixtureId('d7', fixture.id);
  const orderId = fixtureId('d5', fixture.order);
  const invoice = await client.query(
    `INSERT INTO "invoice" ("id", "tenantId", "branchId", "orderId", "orderNumber", "number", "issueDate",
       "issuerName", "issuerCompanyId", "issuerAddress", "issuerVatNumber",
       "recipientName", "recipientAddress", "recipientEmail", "recipientPhone", "currency", "subtotal",
       "discountAmount", "shippingFee", "total")
     SELECT $1, "tenantId", "branchId", "id", "orderNumber", $5, $6, $7, $8, $9, $10,
       "contactName", concat_ws(chr(10), "shippingLine1", "shippingLine2",
         "shippingPostalCode" || ' ' || "shippingCity", "shippingCountryCode"),
       "contactEmail", "contactPhone", "currency", "subtotal", "discountAmount", "shippingFee", "total"
     FROM "order" WHERE "tenantId" = $2 AND "branchId" = $3 AND "id" = $4
     ON CONFLICT DO NOTHING`,
    [
      invoiceId,
      tenantId,
      branchId,
      orderId,
      fixture.number,
      fixture.issueDate,
      fixture.issuerName,
      fixture.issuerCompanyId,
      fixture.issuerAddress,
      fixture.issuerVatNumber,
    ],
  );
  if (invoice.rowCount) {
    await client.query(
      `INSERT INTO "invoiceLine" ("id", "tenantId", "branchId", "invoiceId", "sortOrder",
         "description", "sku", "quantity", "unitPrice", "lineTotal")
       SELECT ('d8000000-0000-4000-8000-' || lpad(("sortOrder" + $5::integer)::text, 12, '0'))::uuid,
         "tenantId", "branchId", $1, "sortOrder", "label", "sku", "quantity", "unitPrice", "unitPrice" * "quantity"
       FROM "orderLine" WHERE "tenantId" = $2 AND "branchId" = $3 AND "orderId" = $4`,
      [invoiceId, tenantId, branchId, orderId, fixture.firstLineId],
    );
  }
}

function fixtureId(prefix: string, id: number): string {
  return `${prefix}000000-0000-4000-8000-${String(id).padStart(12, '0')}`;
}
