import 'dotenv/config';
import { afterAll, beforeAll, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import pg from 'pg';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database.service.js';
import { StorefrontService } from '../src/storefront.service.js';

const legacyProductId = randomUUID();
const legacyShippingId = randomUUID();
const legacyPaymentId = randomUUID();
const fixedDiscountId = randomUUID();
const percentageDiscountId = randomUUID();
const legacyDraftId = randomUUID();
const legacyInvoicedId = randomUUID();
const legacyInvoiceId = randomUUID();
const tenantA = randomUUID();
const tenantB = randomUUID();
const branchA = randomUUID();
const branchB = randomUUID();
const branchForeign = randomUUID();
const publicA = randomUUID();
const publicB = randomUUID();
const suspended = randomUUID();
const tokens = {
  viewer: `holita-session.${'a'.repeat(43)}`,
  operator: `holita-session.${'b'.repeat(43)}`,
  administrator: `holita-session.${'c'.repeat(43)}`,
  foreign: `holita-session.${'d'.repeat(43)}`,
  platform: `holita-session.${'e'.repeat(43)}`,
};
const identities = new Map([
  [tokens.viewer, { tenantId: tenantA, role: 'VIEWER', platform: false }],
  [tokens.operator, { tenantId: tenantA, role: 'OPERATOR', platform: false }],
  [tokens.administrator, { tenantId: tenantA, role: 'ADMINISTRATOR', platform: false }],
  [tokens.foreign, { tenantId: tenantB, role: 'ADMINISTRATOR', platform: false }],
  [tokens.platform, { tenantId: tenantB, role: 'ADMINISTRATOR', platform: true }],
]);
const previous = {
  databaseUrl: process.env.COMMERCE_DATABASE_URL,
  token: process.env.CORE_INTERNAL_AUTH_TOKEN,
  verify: process.env.CORE_AUTH_VERIFY_URL,
  graphql: process.env.CORE_GRAPHQL_URL,
};
let connection: pg.Client | undefined;
let database: PrismaClient | undefined;
let core: Server | undefined;
let publicBranchLookupAvailable = true;
let app: INestApplication | undefined;
let schema = '';
let endpoint: string;
let publicEndpoint: string;

beforeAll(async () => {
  const configured = process.env.COMMERCE_TEST_DATABASE_URL;
  if (!configured) {
    throw new Error('COMMERCE_TEST_DATABASE_URL is required');
  }
  const url = new URL(configured);
  if (
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/holita_commerce_test' ||
    url.username !== 'holita_commerce_test'
  ) {
    throw new Error('The dedicated local holita_commerce_test database is required');
  }
  schema = `test_${randomUUID().replaceAll('-', '')}`;
  connection = new pg.Client({ connectionString: configured });
  await connection.connect();
  await connection.query(`CREATE SCHEMA ${pg.escapeIdentifier(schema)}`);
  await connection.query(`SET search_path TO ${pg.escapeIdentifier(schema)}`);
  const sql = await readFile(
    new URL('../prisma/migrations/20261119000000_baseline/migration.sql', import.meta.url),
    'utf8',
  );
  await connection.query(sql);
  await connection.query(
    await readFile(
      new URL(
        '../prisma/migrations/20261119010000_shopper_accounts/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await connection.query(
    await readFile(
      new URL('../prisma/migrations/20261121000000_brands/migration.sql', import.meta.url),
      'utf8',
    ),
  );
  await connection.query(
    await readFile(
      new URL('../prisma/migrations/20261122000000_categories/migration.sql', import.meta.url),
      'utf8',
    ),
  );
  await connection.query(
    await readFile(
      new URL('../prisma/migrations/20261122010000_options/migration.sql', import.meta.url),
      'utf8',
    ),
  );
  await connection.query(
    `INSERT INTO "product" ("id", "tenantId", "branchId", "name", "price", "status", "updatedAt")
     VALUES ($1, $2, $3, 'Local', 19.95, 'active', CURRENT_TIMESTAMP)`,
    [legacyProductId, tenantA, branchA],
  );
  await connection.query(
    await readFile(
      new URL(
        '../prisma/migrations/20261122020000_product_variants/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await connection.query(
    await readFile(
      new URL(
        '../prisma/migrations/20261122030000_product_descriptions/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await connection.query(
    await readFile(
      new URL('../prisma/migrations/20261122040000_product_images/migration.sql', import.meta.url),
      'utf8',
    ),
  );
  await connection.query(
    await readFile(
      new URL(
        '../prisma/migrations/20261122050000_product_collections/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  for (const migration of [
    '20261122060000_product_characteristics',
    '20261122070000_product_markers',
    '20261122080000_inventory_lookup',
    '20261122090000_shopper_cart',
    '20261122100000_checkout_methods',
    '20261122110000_order_placement',
    '20261122120000_shopper_order_history',
    '20261122130000_order_management',
    '20261122140000_order_invoices',
    '20261122150000_manual_order_refunds',
    '20261122160000_manual_orders',
    '20261122170000_order_line_stock_deductions',
    '20261122180000_customer_detail',
    '20261122190000_discounts',
    '20261122200000_invoice_discount',
    '20261122210000_shop_pages',
    '20261122220000_shop_blog',
    '20261122230000_shop_navigation',
    '20261123000000_shop_settings',
    '20261123010000_dashboard_customer_created_at',
  ]) {
    await connection.query(
      await readFile(
        new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url),
        'utf8',
      ),
    );
  }
  await connection.query(
    `INSERT INTO "paymentMethod" ("id", "tenantId", "branchId", "label", "instructions", "updatedAt")
     VALUES ($1, $2, $3, 'Legacy payment', 'Pay on arrival.', CURRENT_TIMESTAMP)`,
    [legacyPaymentId, tenantA, branchA],
  );
  await connection.query(
    `INSERT INTO "shippingMethod" ("id", "tenantId", "branchId", "label", "fixedFee", "updatedAt")
     VALUES ($1, $2, $3, 'Legacy delivery', 6.00, CURRENT_TIMESTAMP)`,
    [legacyShippingId, tenantA, branchA],
  );
  await connection.query(
    `INSERT INTO "discount" ("id", "tenantId", "branchId", "code", "type", "value", "minSubtotal", "updatedAt")
     VALUES ($1, $3, $4, 'LEGACY-FIXED', 'fixed', 5.00, 30.00, CURRENT_TIMESTAMP),
            ($2, $3, $4, 'LEGACY-PERCENTAGE', 'percentage', 10.00, 40.00, CURRENT_TIMESTAMP)`,
    [fixedDiscountId, percentageDiscountId, tenantA, branchA],
  );
  const legacyPlacedAt = new Date(Date.now() - 86_400_000);
  for (const [id, status, paymentStatus] of [
    [legacyDraftId, 'placed', 'unpaid'],
    [legacyInvoicedId, 'completed', 'paid'],
  ] as const) {
    await connection.query(
      `INSERT INTO "order" (
        "id", "tenantId", "branchId", "orderNumber", "status", "paymentStatus", "placedAt",
        "contactName", "contactEmail", "contactPhone", "shippingCountryCode", "shippingCity",
        "shippingPostalCode", "shippingLine1", "paymentMethodId", "paymentMethodLabel",
        "paymentInstructions", "shippingMethodId", "shippingMethodLabel", "currency",
        "subtotal", "discountCode", "discountAmount", "shippingFee", "total"
      ) VALUES ($1, $2, $3, 'H-' || $1::uuid::text, $4, $5, $8,
        'Legacy customer', 'legacy@example.test', '0888123456', 'BG', 'Sofia', '1000', '1 Test St',
        $6, 'Legacy payment', 'Pay on arrival.', $7, 'Legacy delivery', 'BGN',
        39.90, 'LEGACY-FIXED', 5.00, 6.00, 40.90)`,
      [
        id,
        tenantA,
        branchA,
        status,
        paymentStatus,
        legacyPaymentId,
        legacyShippingId,
        legacyPlacedAt,
      ],
    );
    await connection.query(
      `INSERT INTO "orderLine" (
        "id", "tenantId", "branchId", "orderId", "variantId", "sortOrder", "sku", "label", "quantity", "unitPrice"
      ) VALUES ($1, $2, $3, $4, $5, 0, 'LEGACY', 'Local', 2, 19.95)`,
      [randomUUID(), tenantA, branchA, id, legacyProductId],
    );
  }
  await connection.query(
    `INSERT INTO "invoice" (
      "id", "tenantId", "branchId", "orderId", "orderNumber", "number", "issueDate",
      "issuerName", "issuerCompanyId", "issuerAddress", "recipientName", "recipientAddress",
      "currency", "subtotal", "discountAmount", "shippingFee", "total"
    ) SELECT $1, "tenantId", "branchId", "id", "orderNumber", 'LEGACY-001', CURRENT_DATE,
      'Legacy issuer', '000000001', '1 Invoice St', "contactName", "shippingLine1",
      "currency", "subtotal", "discountAmount", "shippingFee", "total"
      FROM "order" WHERE "id" = $2 AND "tenantId" = $3 AND "branchId" = $4`,
    [legacyInvoiceId, legacyInvoicedId, tenantA, branchA],
  );
  await connection.query(
    `INSERT INTO "invoiceLine" (
      "id", "tenantId", "branchId", "invoiceId", "sortOrder", "description", "sku", "quantity", "unitPrice", "lineTotal"
    ) VALUES ($1, $2, $3, $4, 0, 'Local', 'LEGACY', 2, 19.95, 39.90)`,
    [randomUUID(), tenantA, branchA, legacyInvoiceId],
  );
  await connection.query(
    `INSERT INTO "orderRefund" ("id", "tenantId", "branchId", "orderId", "amount", "currency")
     VALUES ($1, $2, $3, $4, 2.50, 'BGN')`,
    [randomUUID(), tenantA, branchA, legacyInvoicedId],
  );
  await connection.query(
    await readFile(
      new URL(
        '../prisma/migrations/20261123020000_eur_shop_currency/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  url.searchParams.set('schema', schema);
  process.env.COMMERCE_DATABASE_URL = url.toString();
  const coreServer = createServer((request, response) => {
    const token = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
    const identity = identities.get(token);
    if (request.url === '/internal/auth/verify') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify(
          identity
            ? { ...identity, userId: tenantA, sessionId: branchA }
            : { authenticated: false },
        ),
      );
      return;
    }
    let body = '';
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on('end', () => {
      const value: unknown = JSON.parse(body);
      const id =
        typeof value === 'object' &&
        value !== null &&
        'variables' in value &&
        typeof value.variables === 'object' &&
        value.variables !== null &&
        'id' in value.variables
          ? value.variables.id
          : undefined;
      if (request.url === '/internal/branches/resolve') {
        if (!publicBranchLookupAvailable) {
          response.writeHead(503).end();
          return;
        }
        const branch =
          typeof value === 'object' && value !== null && 'id' in value ? value.id : null;
        const shop =
          branch === publicA || branch === publicB
            ? { id: branch, tenantId: tenantA, name: 'Shop' }
            : null;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ branch: shop }));
        return;
      }
      const allowed =
        identity &&
        !identity.platform &&
        ((identity.tenantId === tenantA && (id === branchA || id === branchB || id === publicA)) ||
          (identity.tenantId === tenantB && id === branchForeign));
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: { branch: allowed ? { id } : null } }));
    });
  });
  core = coreServer;
  await new Promise<void>((resolve) => coreServer.listen(0, '127.0.0.1', resolve));
  const address = coreServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Missing test Core address');
  }
  process.env.CORE_INTERNAL_AUTH_TOKEN = 'commerce-test-internal-token-at-least-32-characters';
  process.env.CORE_AUTH_VERIFY_URL = `http://127.0.0.1:${String(address.port)}/internal/auth/verify`;
  process.env.CORE_GRAPHQL_URL = `http://127.0.0.1:${String(address.port)}/graphql`;
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  database = module.get(DatabaseService).client;
  app = module.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  endpoint = `${await app.getUrl()}/graphql`;
  publicEndpoint = `${await app.getUrl()}/storefront/graphql`;
});

afterAll(async () => {
  await app?.close();
  if (connection) {
    await connection.query(`DROP SCHEMA ${pg.escapeIdentifier(schema)} CASCADE`);
    await connection.end();
  }
  if (core) {
    const server = core;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
  if (previous.databaseUrl === undefined) {
    delete process.env.COMMERCE_DATABASE_URL;
  } else {
    process.env.COMMERCE_DATABASE_URL = previous.databaseUrl;
  }
  if (previous.token === undefined) {
    delete process.env.CORE_INTERNAL_AUTH_TOKEN;
  } else {
    process.env.CORE_INTERNAL_AUTH_TOKEN = previous.token;
  }
  if (previous.verify === undefined) {
    delete process.env.CORE_AUTH_VERIFY_URL;
  } else {
    process.env.CORE_AUTH_VERIFY_URL = previous.verify;
  }
  if (previous.graphql === undefined) {
    delete process.env.CORE_GRAPHQL_URL;
  } else {
    process.env.CORE_GRAPHQL_URL = previous.graphql;
  }
});

async function query(
  token: string,
  branch: string,
  source: string,
  variables: Record<string, unknown> = {},
): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'x-branch-id': branch,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query: source, variables }),
  });
  return response.json();
}

it('enforces tenant and Branch isolation and merchant roles through Core', async () => {
  if (!database) {
    throw new Error('Missing test database');
  }
  const settingsFields = 'displayName contactEmail contactPhone contactAddress';
  const readSettings = `{shopSettings{${settingsFields}}}`;
  const updateSettings = `mutation($input:ShopSettingsInput!){
    updateShopSettings(input:$input){${settingsFields}}
  }`;
  const emptySettings = {
    displayName: null,
    contactEmail: null,
    contactPhone: null,
    contactAddress: null,
  };
  const settings = {
    ...emptySettings,
    displayName: 'Моят магазин',
    contactEmail: 'shop@example.test',
  };
  expect(await query(tokens.operator, branchA, updateSettings, { input: settings })).toEqual({
    data: { updateShopSettings: settings },
  });
  for (const [token, message] of [
    [tokens.viewer, 'Your role does not permit this action'],
    [tokens.foreign, 'Branch is unavailable'],
  ]) {
    expect(
      await query(token, branchA, updateSettings, { input: { displayName: 'Друг магазин' } }),
    ).toMatchObject({ data: null, errors: [{ message }] });
  }
  expect(await query(tokens.viewer, branchA, readSettings)).toEqual({
    data: { shopSettings: settings },
  });
  for (const [token, branch] of [
    [tokens.operator, branchB],
    [tokens.foreign, branchForeign],
  ]) {
    expect(await query(token, branch, readSettings)).toEqual({
      data: { shopSettings: emptySettings },
    });
  }
  expect(
    await query(tokens.operator, branchA, updateSettings, {
      input: { displayName: '  ' },
    }),
  ).toEqual({ data: { updateShopSettings: emptySettings } });
  const pageInput = { slug: 'scoped-page', status: 'DRAFT', titleEn: 'Scoped page' };
  const createPage = 'mutation($input:ShopPageInput!){createShopPage(input:$input){slug}}';
  const updatePage =
    'mutation($id:ID!,$input:ShopPageInput!){updateShopPage(id:$id,input:$input){id}}';
  const readPage = 'query($id:ID!){shopPage(id:$id){id}}';
  for (const [token, branch] of [
    [tokens.operator, branchA],
    [tokens.operator, branchB],
    [tokens.foreign, branchForeign],
  ]) {
    expect(await query(token, branch, createPage, { input: pageInput })).toEqual({
      data: { createShopPage: { slug: pageInput.slug } },
    });
  }
  const page = await database.shopPage.findFirstOrThrow({
    where: { tenantId: tenantA, branchId: branchA, slug: pageInput.slug },
  });
  expect(
    await query(tokens.viewer, branchA, '{shopPages(search:"Scoped page"){items{id} total}}'),
  ).toEqual({ data: { shopPages: { items: [{ id: page.id }], total: 1 } } });
  const partialPage = await database.shopPage.create({
    data: {
      tenantId: tenantA,
      branchId: branchA,
      slug: 'early-scoped-page',
      titleEn: 'Earlier page',
    },
  });
  expect(
    await query(
      tokens.viewer,
      branchA,
      `{
      first: navigationDestinationChoices(type:PAGE,search:"scoped-page",limit:1){items{id} total}
      next: navigationDestinationChoices(type:PAGE,search:"scoped-page",limit:1,offset:1){items{id} total}
    }`,
    ),
  ).toEqual({
    data: {
      first: { items: [{ id: page.id }], total: 2 },
      next: { items: [{ id: partialPage.id }], total: 2 },
    },
  });
  expect(await query(tokens.operator, branchA, createPage, { input: pageInput })).toMatchObject({
    data: null,
    errors: [
      {
        extensions: {
          code: 'BAD_USER_INPUT',
          fieldErrors: [{ path: 'slug', code: 'DUPLICATE_VALUE' }],
        },
      },
    ],
  });
  expect(
    await query(tokens.viewer, branchA, updatePage, { id: page.id, input: pageInput }),
  ).toMatchObject({ data: null, errors: [{ message: 'Your role does not permit this action' }] });
  for (const [token, branch] of [
    [tokens.operator, branchB],
    [tokens.foreign, branchForeign],
  ]) {
    expect(await query(token, branch, readPage, { id: page.id })).toEqual({
      data: { shopPage: null },
    });
    expect(await query(token, branch, updatePage, { id: page.id, input: pageInput })).toMatchObject(
      { data: null, errors: [{ extensions: { code: 'NOT_FOUND' } }] },
    );
  }
  const createMenu =
    'mutation($input:CreateNavigationMenuInput!){createNavigationMenu(input:$input){id}}';
  const readMenu = 'query($id:ID!){navigationMenu(id:$id){id}}';
  const updateMenu =
    'mutation($id:ID!,$items:[NavigationMenuItemInput!]!){updateNavigationMenu(id:$id,items:$items){id}}';
  const menuInput = {
    placement: 'HEADER',
    items: [{ labelBg: 'Страница', destinationType: 'PAGE', destinationId: page.id }],
  };
  expect(await query(tokens.viewer, branchA, createMenu, { input: menuInput })).toMatchObject({
    data: null,
    errors: [{ message: 'Your role does not permit this action' }],
  });
  expect(await query(tokens.operator, branchA, createMenu, { input: menuInput })).toMatchObject({
    data: { createNavigationMenu: { id: expect.any(String) } },
  });
  const menu = await database.navigationMenu.findFirstOrThrow({
    where: { tenantId: tenantA, branchId: branchA, placement: 'HEADER' },
  });
  expect(await query(tokens.viewer, branchA, readMenu, { id: menu.id })).toEqual({
    data: { navigationMenu: { id: menu.id } },
  });
  for (const [token, branch] of [
    [tokens.operator, branchB],
    [tokens.foreign, branchForeign],
  ]) {
    expect(await query(token, branch, readMenu, { id: menu.id })).toEqual({
      data: { navigationMenu: null },
    });
    expect(await query(token, branch, updateMenu, { id: menu.id, items: [] })).toMatchObject({
      data: null,
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(await query(token, branch, createMenu, { input: menuInput })).toMatchObject({
      data: null,
      errors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'items0DestinationId', code: 'INVALID_DESTINATION' }],
          },
        },
      ],
    });
  }
  const blogScope = { tenantId: tenantA, branchId: branchA };
  const blogTags = await database.blogTag.createManyAndReturn({
    data: [
      blogScope,
      { tenantId: tenantA, branchId: branchB },
      { tenantId: tenantB, branchId: branchForeign },
    ].map((scope) => ({
      ...scope,
      slug: 'scoped-blog-tag',
      name: 'Scoped tag',
      normalizedName: 'scoped tag',
    })),
  });
  const localBlogTag = blogTags.find((tag) => tag.branchId === branchA);
  const otherShopBlogTag = blogTags.find((tag) => tag.branchId === branchB);
  const otherTenantBlogTag = blogTags.find((tag) => tag.branchId === branchForeign);
  if (!localBlogTag || !otherShopBlogTag || !otherTenantBlogTag) {
    throw new Error('Missing scoped blog tags');
  }
  expect(await query(tokens.viewer, branchA, '{blogTagChoices{id}}')).toEqual({
    data: { blogTagChoices: [{ id: localBlogTag.id }] },
  });
  const createArticle = 'mutation($input:BlogArticleInput!){createBlogArticle(input:$input){slug}}';
  const scopedArticle = { slug: 'scoped-article', status: 'DRAFT' };
  for (const [token, branch, tagId] of [
    [tokens.operator, branchA, localBlogTag.id],
    [tokens.operator, branchB, otherShopBlogTag.id],
    [tokens.foreign, branchForeign, otherTenantBlogTag.id],
  ]) {
    expect(
      await query(token, branch, createArticle, {
        input: { ...scopedArticle, tagIds: [tagId] },
      }),
    ).toEqual({ data: { createBlogArticle: { slug: scopedArticle.slug } } });
  }
  const localArticle = await database.blogArticle.findFirstOrThrow({
    where: { ...blogScope, slug: scopedArticle.slug },
  });
  const updateArticle =
    'mutation($id:ID!,$input:BlogArticleInput!){updateBlogArticle(id:$id,input:$input){id}}';
  for (const tagId of [otherShopBlogTag.id, otherTenantBlogTag.id]) {
    expect(
      await query(tokens.operator, branchA, updateArticle, {
        id: localArticle.id,
        input: { ...scopedArticle, tagIds: [tagId] },
      }),
    ).toMatchObject({
      data: null,
      errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'tagIds' }] } }],
    });
    await expect(
      database.blogArticleTag.create({
        data: { ...blogScope, articleId: localArticle.id, tagId },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  }
  expect(await query(tokens.viewer, branchA, '{blogArticles{total items{slug tags{id}}}}')).toEqual(
    {
      data: {
        blogArticles: {
          total: 1,
          items: [{ slug: scopedArticle.slug, tags: [{ id: localBlogTag.id }] }],
        },
      },
    },
  );
  const rows = await Promise.all([
    database.product.findUniqueOrThrow({ where: { id: legacyProductId } }),
    database.product.create({
      data: {
        tenantId: tenantA,
        branchId: branchB,
        name: 'Other shop',
        variants: { create: { ...storedVariant('OTHER-SHOP', '4.00'), inventoryTracked: true } },
      },
      include: { variants: true },
    }),
    database.product.create({
      data: {
        tenantId: tenantB,
        branchId: branchForeign,
        name: 'Other merchant',
        variants: {
          create: { ...storedVariant('OTHER-MERCHANT', '2.00'), inventoryTracked: true },
        },
      },
      include: { variants: true },
    }),
  ]);
  expect(
    await database.productVariant.findUnique({ where: { id: legacyProductId } }),
  ).toMatchObject({
    sku: `LEGACY-${legacyProductId}`,
    active: true,
    quantity: 0,
    inventoryTracked: false,
  });
  const legacyScope = { tenantId: tenantA, branchId: branchA };
  const legacyAmounts = {
    currency: 'BGN',
    subtotal: '39.90',
    discountAmount: '5.00',
    shippingFee: '6.00',
    total: '40.90',
    lines: [{ unitPrice: '19.95', lineTotal: '39.90' }],
  };
  const archived = await database.bgnToEurAmount.findMany({ where: legacyScope });
  expect(
    archived.map((row) => [row.recordId, row.amountBgn.toFixed(2), row.amountEur.toFixed(2)]),
  ).toEqual(
    expect.arrayContaining([
      [legacyProductId, '19.95', '10.20'],
      [legacyShippingId, '6.00', '3.07'],
      [fixedDiscountId, '5.00', '2.56'],
      [fixedDiscountId, '30.00', '15.34'],
      [percentageDiscountId, '40.00', '20.45'],
    ]),
  );
  expect(archived).toHaveLength(5);
  expect(rows[0].legacyPrice?.toFixed(2)).toBe('19.95');
  expect(
    await query(
      tokens.viewer,
      branchA,
      `query($product:ID!,$shipping:ID!,$fixed:ID!,$percent:ID!){
      product(id:$product){price}
      shippingMethod(id:$shipping){fixedFee}
      fixed:discount(id:$fixed){currency value minSubtotal}
      percent:discount(id:$percent){currency value minSubtotal}
    }`,
      {
        product: legacyProductId,
        shipping: legacyShippingId,
        fixed: fixedDiscountId,
        percent: percentageDiscountId,
      },
    ),
  ).toEqual({
    data: {
      product: { price: '10.20' },
      shippingMethod: { fixedFee: '3.07' },
      fixed: { currency: 'EUR', value: '2.56', minSubtotal: '15.34' },
      percent: { currency: 'EUR', value: '10.00', minSubtotal: '20.45' },
    },
  });
  const snapshotFields =
    'currency subtotal discountAmount shippingFee total lines{unitPrice lineTotal}';
  const readLegacy = `query($id:ID!){
    order(id:$id){${snapshotFields}}
    orderInvoice(orderId:$id){${snapshotFields}}
    orderRefundSummary(orderId:$id){refundableAmount refunds{amount currency}}
  }`;
  expect(await query(tokens.viewer, branchA, readLegacy, { id: legacyInvoicedId })).toEqual({
    data: {
      order: legacyAmounts,
      orderInvoice: legacyAmounts,
      orderRefundSummary: {
        refundableAmount: '38.40',
        refunds: [{ amount: '2.50', currency: 'BGN' }],
      },
    },
  });
  expect(await query(tokens.viewer, branchB, readLegacy, { id: legacyInvoicedId })).toEqual({
    data: { order: null, orderInvoice: null, orderRefundSummary: null },
  });
  const editLegacy = `mutation($id:ID!,$input:ManualOrderUpdateInput!){
    updateManualOrder(id:$id,input:$input){${snapshotFields} merchantNote}
  }`;
  const legacyContact = {
    contact: { name: 'Legacy customer', email: 'legacy@example.test', phone: '0888123456' },
    shippingAddress: { countryCode: 'BG', city: 'Sofia', postalCode: '1000', line1: '1 Test St' },
    merchantNote: 'Contact confirmed',
  };
  for (const amountChange of [
    { lines: [{ variantId: legacyProductId, quantity: 1 }] },
    { shippingMethodId: randomUUID() },
  ]) {
    expect(
      await query(tokens.operator, branchA, editLegacy, {
        id: legacyDraftId,
        input: { ...legacyContact, ...amountChange },
      }),
    ).toMatchObject({
      errors: [{ extensions: { fieldErrors: [{ code: 'MANUAL_ORDER_LEGACY_AMOUNTS_LOCKED' }] } }],
    });
  }
  expect(
    await query(tokens.operator, branchA, editLegacy, {
      id: legacyDraftId,
      input: legacyContact,
    }),
  ).toEqual({
    data: { updateManualOrder: { ...legacyAmounts, merchantNote: legacyContact.merchantNote } },
  });
  expect(
    await query(
      tokens.operator,
      branchA,
      `mutation($id:ID!,$input:IssueOrderInvoiceInput!){
    issueOrderInvoice(orderId:$id,input:$input){${snapshotFields}}
  }`,
      {
        id: legacyDraftId,
        input: {
          number: 'LEGACY-002',
          issueDate: '2026-11-23',
          issuerName: 'Issuer',
          issuerCompanyId: '000000001',
          issuerAddress: '1 Invoice St',
          recipientName: 'Legacy customer',
          recipientAddress: '1 Test St',
        },
      },
    ),
  ).toEqual({ data: { issueOrderInvoice: legacyAmounts } });

  for (const [method, type, fields] of [
    ['paymentMethod', 'PaymentMethod', { instructions: 'Pay in person.' }],
    ['shippingMethod', 'ShippingMethod', { fixedFee: '0' }],
  ] as const) {
    const create = `mutation($input:${type}Input!){create${type}(input:$input){id}}`;
    const update = `mutation($id:ID!,$input:${type}Input!){update${type}(id:$id,input:$input){id}}`;
    const detail = `query($id:ID!){${method}(id:$id){id enabled}}`;
    const list = `{${method}s{items{id} total}}`;
    const input = { label: 'Scoped method', enabled: false, sortOrder: 10, ...fields };
    const result = await query(tokens.operator, branchA, create, { input });
    const where = { tenantId: tenantA, branchId: branchA, label: input.label };
    const { id } =
      method === 'paymentMethod'
        ? await database.paymentMethod.findFirstOrThrow({ where })
        : await database.shippingMethod.findFirstOrThrow({ where });
    expect(result).toEqual({ data: { [`create${type}`]: { id } } });
    for (const [bearer, branch] of [
      [tokens.operator, branchB],
      [tokens.foreign, branchForeign],
    ] as const) {
      expect(await query(bearer, branch, list)).toEqual({
        data: { [`${method}s`]: { items: [], total: 0 } },
      });
      expect(await query(bearer, branch, detail, { id })).toEqual({ data: { [method]: null } });
      expect(
        await query(bearer, branch, update, { id, input: { ...input, enabled: true } }),
      ).toMatchObject({
        data: null,
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    }
    expect(await query(tokens.viewer, branchA, detail, { id })).toEqual({
      data: { [method]: { id, enabled: false } },
    });
    for (const [operation, variables] of [
      [create, { input }],
      [update, { id, input }],
    ] as const) {
      expect(await query(tokens.viewer, branchA, operation, variables)).toMatchObject({
        data: null,
        errors: expect.any(Array),
      });
    }
  }
  const customerScope = { tenantId: tenantA, branchId: branchA };
  const customer = await database.customer.create({
    data: { ...customerScope, name: 'Customer', email: 'Person@example.test' },
  });
  await expect(
    database.customer.create({
      data: {
        tenantId: tenantA,
        branchId: branchA,
        name: 'Duplicate',
        email: 'person@example.test',
      },
    }),
  ).rejects.toThrow();
  await expect(
    database.customer.create({
      data: {
        tenantId: tenantA,
        branchId: branchB,
        name: 'Other shop',
        email: 'person@example.test',
      },
    }),
  ).resolves.toBeDefined();
  const otherCustomer = await database.customer.create({
    data: { ...customerScope, name: 'Other customer', email: 'other@example.test' },
  });
  await database.customer.create({
    data: {
      tenantId: tenantB,
      branchId: branchA,
      name: 'Foreign customer',
      email: 'foreign@example.test',
    },
  });
  const dashboard =
    '{shopDashboard{period orderCount completedRevenue newCustomerCount outOfStockVariantCount currency recentOrders{id currency total}}}';
  const emptyDashboard = {
    period: 'DAYS_30',
    currency: 'EUR',
    orderCount: 0,
    completedRevenue: '0.00',
    newCustomerCount: 0,
    outOfStockVariantCount: 0,
    recentOrders: [],
  };
  for (const [token, branch, newCustomerCount, outOfStockVariantCount] of [
    [tokens.viewer, branchA, 2, 0],
    [tokens.viewer, branchB, 1, 1],
    [tokens.viewer, publicA, 0, 0],
    [tokens.foreign, branchForeign, 0, 1],
  ] as const) {
    expect(await query(token, branch, dashboard)).toEqual({
      data: {
        shopDashboard: {
          ...emptyDashboard,
          newCustomerCount,
          outOfStockVariantCount,
          ...(branch === branchA && {
            orderCount: 2,
            completedRevenue: '20.91',
            recentOrders: [legacyInvoicedId, legacyDraftId]
              .sort((a, b) => b.localeCompare(a))
              .map((id) => ({ id, currency: 'BGN', total: '40.90' })),
          }),
        },
      },
    });
  }
  expect(await query(tokens.foreign, branchA, dashboard)).toMatchObject({
    data: null,
    errors: [{ message: 'Branch is unavailable' }],
  });
  const contact = { name: 'Updated customer', phone: '+359 200 000' };
  const address = {
    recipient: 'Customer',
    line1: 'Street',
    city: 'Sofia',
    postalCode: '0100',
    countryCode: 'BG',
  };
  const customerDetail = `query($id:ID!){customer(id:$id){customer{id name phone} addresses{id}}}`;
  const updateContact = `mutation($id:ID!,$input:CustomerContactInput!){
    updateCustomerContact(id:$id,input:$input){id}
  }`;
  const createAddress = `mutation($customerId:ID!,$input:CustomerAddressInput!){
    createCustomerAddress(customerId:$customerId,input:$input){id}
  }`;
  const updateAddress = `mutation($customerId:ID!,$addressId:ID!,$input:CustomerAddressInput!){
    updateCustomerAddress(customerId:$customerId,addressId:$addressId,input:$input){id}
  }`;
  const target = { customerId: customer.id, input: address };
  expect(
    await query(tokens.operator, branchA, updateContact, {
      id: customer.id,
      input: contact,
    }),
  ).toEqual({ data: { updateCustomerContact: { id: customer.id } } });
  expect(await query(tokens.operator, branchA, createAddress, target)).toMatchObject({
    data: { createCustomerAddress: { id: expect.any(String) } },
  });
  const savedAddress = await database.customerAddress.findFirstOrThrow({
    where: { ...customerScope, customerId: customer.id },
  });
  const edits = [
    [updateContact, { id: customer.id, input: { name: 'Denied' } }],
    [createAddress, target],
    [
      updateAddress,
      { ...target, addressId: savedAddress.id, input: { ...address, city: 'Denied' } },
    ],
  ] as const;
  for (const [bearer, branch] of [
    [tokens.operator, branchB],
    [tokens.foreign, branchForeign],
  ] as const) {
    expect(await query(bearer, branch, customerDetail, { id: customer.id })).toEqual({
      data: { customer: null },
    });
    for (const [operation, variables] of edits) {
      expect(await query(bearer, branch, operation, variables)).toMatchObject({
        data: null,
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    }
  }
  for (const [operation, variables] of edits) {
    expect(await query(tokens.viewer, branchA, operation, variables)).toMatchObject({
      data: null,
      errors: expect.any(Array),
    });
  }
  expect(
    await query(tokens.operator, branchA, updateAddress, {
      ...target,
      customerId: otherCustomer.id,
      addressId: savedAddress.id,
    }),
  ).toMatchObject({
    data: null,
    errors: [{ extensions: { code: 'NOT_FOUND' } }],
  });
  expect(
    await database.customerAddress.findMany({
      where: { ...customerScope, customerId: customer.id },
    }),
  ).toEqual([savedAddress]);
  expect(await query(tokens.viewer, branchA, customerDetail, { id: customer.id })).toEqual({
    data: {
      customer: { customer: { id: customer.id, ...contact }, addresses: [{ id: savedAddress.id }] },
    },
  });
  await expect(
    database.customerAddress.create({
      data: { ...address, tenantId: tenantA, branchId: branchB, customerId: customer.id },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
  for (const [role, bearer, branch, expectedId, canWrite] of [
    ['viewer', tokens.viewer, branchA, rows[0].id, false],
    ['operator', tokens.operator, branchA, rows[0].id, true],
    ['administrator', tokens.administrator, branchB, rows[1].id, true],
    ['foreign', tokens.foreign, branchForeign, rows[2].id, true],
  ] as const) {
    const result = await query(
      bearer,
      branch,
      '{products{items{id name price} total offset limit} inventory{total items{productId}}}',
    );
    expect({ role, result }).toMatchObject({
      role,
      result: {
        data: {
          products: { total: 1, items: [{ id: expectedId }] },
          inventory: { total: 1, items: [{ productId: expectedId }] },
        },
      },
    });
    const write = await query(
      bearer,
      branch,
      'mutation{createProduct(input:{name:"Added",status:ACTIVE,variants:[{sku:"ADDED",price:"1.25",quantity:0,inventoryTracked:false,active:true,optionValueIds:[]}]}){name price}}',
    );
    expect({ role, write }).toMatchObject({
      role,
      write: canWrite
        ? { data: { createProduct: { name: 'Added', price: '1.25' } } }
        : { data: null, errors: expect.any(Array) },
    });
  }
  expect(await query(tokens.operator, branchForeign, '{products{total}}')).toMatchObject({
    data: null,
    errors: expect.any(Array),
  });
  expect(await query(tokens.platform, branchForeign, '{products{total}}')).toMatchObject({
    data: null,
    errors: expect.any(Array),
  });
  expect(
    await query(tokens.operator, branchA, 'query($id:ID!){product(id:$id){id}}', {
      id: rows[1].id,
    }),
  ).toEqual({ data: { product: null } });
  expect(
    await query(
      tokens.operator,
      branchA,
      'mutation($id:ID!){updateProduct(id:$id,input:{name:"No",status:DRAFT,variants:[{sku:"NO",price:"1.00",quantity:0,inventoryTracked:false,active:true,optionValueIds:[]}]}){id}}',
      { id: rows[2].id },
    ),
  ).toMatchObject({ data: null, errors: expect.any(Array) });
  const adjustQuantity =
    'mutation($id:ID!,$quantity:Int!){updateInventoryQuantity(id:$id,quantity:$quantity){quantity}}';
  for (const outside of [...rows[1].variants, ...rows[2].variants]) {
    expect(
      await query(tokens.viewer, branchA, 'query($id:ID!){inventoryVariant(id:$id){id}}', {
        id: outside.id,
      }),
    ).toEqual({ data: { inventoryVariant: null } });
    expect(
      await query(tokens.operator, branchA, adjustQuantity, { id: outside.id, quantity: 3 }),
    ).toMatchObject({ data: null, errors: [{ message: 'Variant not found' }] });
  }
  expect(
    await query(tokens.operator, branchA, adjustQuantity, { id: legacyProductId, quantity: 3 }),
  ).toMatchObject({
    data: null,
    errors: [{ extensions: { code: 'INVENTORY_TRACKING_REQUIRED' } }],
  });
  const imageScope = { tenantId: tenantA, branchId: branchA };
  await expect(
    database.productImage.create({
      data: {
        ...imageScope,
        productId: rows[1].id,
        storageKey: `${randomUUID()}.png`,
        sortOrder: 0,
      },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
  const outsideImage = await database.productImage.create({
    data: {
      tenantId: tenantA,
      branchId: branchB,
      productId: rows[1].id,
      storageKey: `${randomUUID()}.png`,
      sortOrder: 0,
    },
  });
  expect(
    await query(
      tokens.operator,
      branchA,
      'mutation($product:ID!,$image:ID!){updateProduct(id:$product,input:{name:"Local",status:ACTIVE,variants:[{sku:"LOCAL",price:"19.95",quantity:0,inventoryTracked:false,active:true,optionValueIds:[]}],images:[{id:$image}]}){id}}',
      { product: rows[0].id, image: outsideImage.id },
    ),
  ).toMatchObject({
    data: null,
    errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'image0Id' }] } }],
  });
  const client = database;
  const [local, otherShop, otherTenant] = await Promise.all(
    [
      { tenantId: tenantA, branchId: branchA },
      { tenantId: tenantA, branchId: branchB },
      { tenantId: tenantB, branchId: branchForeign },
    ].map((scope) =>
      client.brand.create({ data: { ...scope, name: 'Scoped Brand', slug: 'scoped-brand' } }),
    ),
  );
  if (!local || !otherShop || !otherTenant) {
    throw new Error('Missing scoped brands');
  }
  expect(await query(tokens.viewer, branchA, '{brands(search:"Scoped"){total items{id}}}')).toEqual(
    {
      data: { brands: { total: 1, items: [{ id: local.id }] } },
    },
  );
  const assign =
    'mutation($product:ID!,$brand:ID!){updateProduct(id:$product,input:{name:"Local",status:ACTIVE,variants:[{sku:"LOCAL",price:"19.95",quantity:0,inventoryTracked:false,active:true,optionValueIds:[]}],brandId:$brand}){brandId}}';
  for (const brand of [otherShop, otherTenant, local]) {
    const result = await query(tokens.operator, branchA, assign, {
      product: rows[0].id,
      brand: brand.id,
    });
    expect(result).toMatchObject(
      brand === local
        ? { data: { updateProduct: { brandId: local.id } } }
        : {
            data: null,
            errors: [
              { extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'brandId' }] } },
            ],
          },
    );
  }
  const remove = 'mutation($id:ID!){deleteBrand(id:$id)}';
  for (const [token, id] of [
    [tokens.viewer, local.id],
    [tokens.operator, otherShop.id],
    [tokens.operator, otherTenant.id],
  ]) {
    expect(await query(token, branchA, remove, { id })).toHaveProperty('errors');
  }
  expect(await query(tokens.operator, branchA, remove, { id: local.id })).toEqual({
    data: { deleteBrand: true },
  });
  expect(await database.product.findUnique({ where: { id: rows[0].id } })).toHaveProperty(
    'brandId',
    null,
  );

  const categories = await Promise.all(
    [
      { tenantId: tenantA, branchId: branchA },
      { tenantId: tenantA, branchId: branchB },
      { tenantId: tenantB, branchId: branchForeign },
    ].map((scope) =>
      client.category.create({
        data: { ...scope, name: 'Scoped Category', slug: 'scoped-category' },
      }),
    ),
  );
  const category = categories[0];
  if (!category) {
    throw new Error('Missing local category');
  }
  expect(await query(tokens.viewer, branchA, '{categories{id}}')).toEqual({
    data: { categories: [{ id: category.id }] },
  });
  const assignCategory =
    'mutation($product:ID!,$category:ID){updateProduct(id:$product,input:{name:"Local",status:ACTIVE,variants:[{sku:"LOCAL",price:"19.95",quantity:0,inventoryTracked:false,active:true,optionValueIds:[]}],categoryId:$category}){categoryId}}';
  const createSubcategory =
    'mutation($parent:ID!,$slug:String!){createCategory(input:{name:"Child",slug:$slug,parentId:$parent,sortOrder:0,active:true}){parentId}}';
  for (const candidate of categories) {
    expect(
      await query(tokens.operator, branchA, assignCategory, {
        product: rows[0].id,
        category: candidate.id,
      }),
    ).toMatchObject(
      candidate === category
        ? { data: { updateProduct: { categoryId: category.id } } }
        : {
            data: null,
            errors: [
              { extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'categoryId' }] } },
            ],
          },
    );
    expect(
      await query(tokens.operator, branchA, createSubcategory, {
        parent: candidate.id,
        slug: candidate === category ? 'child' : `child-${candidate.id}`,
      }),
    ).toMatchObject(
      candidate === category
        ? { data: { createCategory: { parentId: category.id } } }
        : {
            data: null,
            errors: [
              { extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'parentId' }] } },
            ],
          },
    );
  }
  const child = await client.category.findUniqueOrThrow({
    where: { tenantId_branchId_slug: { tenantId: tenantA, branchId: branchA, slug: 'child' } },
  });
  const moveCategory =
    'mutation($id:ID!,$parent:ID!){updateCategory(id:$id,input:{name:"Scoped Category",slug:"scoped-category",parentId:$parent,sortOrder:0,active:true}){id}}';
  expect(
    await query(tokens.operator, branchA, moveCategory, { id: category.id, parent: child.id }),
  ).toMatchObject({
    data: null,
    errors: [
      {
        extensions: {
          code: 'BAD_USER_INPUT',
          fieldErrors: [{ path: 'parentId', code: 'CATEGORY_CYCLE' }],
        },
      },
    ],
  });
  expect(
    await query(tokens.operator, branchA, assignCategory, {
      product: rows[0].id,
      category: child.id,
    }),
  ).toEqual({ data: { updateProduct: { categoryId: child.id } } });
  const deleteCategory = 'mutation($id:ID!){deleteCategory(id:$id)}';
  for (const id of [category.id, child.id]) {
    expect(await query(tokens.operator, branchA, deleteCategory, { id })).toMatchObject({
      data: null,
      errors: [{ extensions: { code: 'CONFLICT' } }],
    });
  }
  expect(
    await query(tokens.operator, branchA, assignCategory, { product: rows[0].id, category: null }),
  ).toEqual({ data: { updateProduct: { categoryId: null } } });
  expect(await query(tokens.operator, branchA, deleteCategory, { id: child.id })).toEqual({
    data: { deleteCategory: true },
  });

  const optionScope = { tenantId: tenantA, branchId: branchA };
  const scopedOption = await client.option.create({
    data: {
      ...optionScope,
      name: 'Scoped Option',
      values: {
        create: [
          { label: 'First', sortOrder: 0 },
          { label: 'Second', sortOrder: 1 },
        ],
      },
    },
    include: { values: { orderBy: { sortOrder: 'asc' } } },
  });
  const [first, second] = scopedOption.values;
  if (!first || !second) {
    throw new Error('Missing scoped option values');
  }
  const saveProduct =
    'mutation($input:ProductInput!){createProduct(input:$input){id name price variants{id sku price quantity inventoryTracked active optionValueIds}}}';
  const variant = {
    sku: 'COMBO-1',
    price: '8.95',
    quantity: 5,
    inventoryTracked: true,
    active: true,
    optionValueIds: [first.id],
  };
  const configured = {
    name: 'Configured',
    status: 'ACTIVE',
    variants: [
      variant,
      { ...variant, sku: 'COMBO-2', price: '7.95', active: false, optionValueIds: [second.id] },
    ],
  };
  const updateOption =
    'mutation($id:ID!,$values:[OptionValueInput!]!){updateOption(id:$id,input:{name:"Renamed",active:false,showInFilters:true,values:$values}){id name active showInFilters values{id label}}}';
  for (const scope of [
    { tenantId: tenantA, branchId: branchB },
    { tenantId: tenantB, branchId: branchForeign },
  ]) {
    const outside = await client.option.create({ data: { ...scope, name: scopedOption.name } });
    await expect(
      client.optionValue.create({
        data: { ...scope, optionId: scopedOption.id, label: 'Outside', sortOrder: 0 },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    const outsideValue = await client.optionValue.create({
      data: { ...scope, optionId: outside.id, label: 'Outside', sortOrder: 0 },
    });
    expect(
      await query(tokens.operator, branchA, saveProduct, {
        input: { ...configured, variants: [{ ...variant, optionValueIds: [outsideValue.id] }] },
      }),
    ).toMatchObject({
      errors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'variants0OptionValueIds', code: 'INVALID_OPTION_VALUES' }],
          },
        },
      ],
    });
    expect(
      await query(tokens.viewer, branchA, 'query($id:ID!){option(id:$id){id}}', { id: outside.id }),
    ).toEqual({ data: { option: null } });
    expect(
      await query(tokens.operator, branchA, updateOption, { id: outside.id, values: [] }),
    ).toHaveProperty('errors');
    expect(
      await query(tokens.operator, branchA, updateOption, {
        id: scopedOption.id,
        values: [{ id: outsideValue.id, label: 'Rejected' }],
      }),
    ).toMatchObject({
      data: null,
      errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'values.0.id' }] } }],
    });
  }
  expect(
    await query(tokens.viewer, branchA, '{options(search:"Scoped"){total items{id}}}'),
  ).toEqual({
    data: { options: { total: 1, items: [{ id: scopedOption.id }] } },
  });
  expect(await query(tokens.operator, branchA, saveProduct, { input: configured })).toMatchObject({
    data: { createProduct: { price: '8.95', variants: configured.variants } },
  });
  const [configuredVariant, alternative] = await client.productVariant.findMany({
    where: { ...optionScope, sku: { in: configured.variants.map(({ sku }) => sku) } },
    orderBy: { sortOrder: 'asc' },
  });
  if (!configuredVariant || !alternative) {
    throw new Error('Missing configured variants');
  }
  const stock = { id: configuredVariant.id, quantity: 3 };
  expect(await query(tokens.viewer, branchA, adjustQuantity, stock)).toHaveProperty('errors');
  expect(
    await query(tokens.operator, branchA, adjustQuantity, { id: stock.id, quantity: -1 }),
  ).toMatchObject({
    data: null,
    errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'quantity' }] } }],
  });
  expect(await query(tokens.operator, branchA, adjustQuantity, stock)).toEqual({
    data: { updateInventoryQuantity: { quantity: 3 } },
  });
  const updateConfigured =
    'mutation($id:ID!,$input:ProductInput!){updateProduct(id:$id,input:$input){variants{id quantity inventoryTracked}}}';
  const retainedVariants = configured.variants.map((draft) =>
    draft.sku === configuredVariant.sku
      ? { ...draft, id: configuredVariant.id }
      : { ...draft, id: alternative.id },
  );
  expect(
    await query(tokens.operator, branchA, updateConfigured, {
      id: configuredVariant.productId,
      input: { ...configured, variants: retainedVariants },
    }),
  ).toMatchObject({
    data: null,
    errors: [
      {
        extensions: {
          code: 'BAD_USER_INPUT',
          fieldErrors: [
            {
              path: 'variants.0.quantity',
              code: 'INVENTORY_QUANTITY_CONFLICT',
              message: 'Use Inventory to adjust quantities for tracked variants',
            },
          ],
        },
      },
    ],
  });
  expect(
    await query(tokens.operator, branchA, updateConfigured, {
      id: configuredVariant.productId,
      input: {
        ...configured,
        variants: retainedVariants.map((draft) =>
          draft.id === configuredVariant.id
            ? { ...draft, inventoryTracked: false, quantity: undefined }
            : draft,
        ),
      },
    }),
  ).toEqual({
    data: {
      updateProduct: {
        variants: [
          { id: configuredVariant.id, quantity: 3, inventoryTracked: false },
          { id: alternative.id, quantity: 5, inventoryTracked: true },
        ],
      },
    },
  });
  expect(
    await query(
      tokens.viewer,
      branchA,
      '{products(search:"Configured",sort:{field:PRICE,direction:DESC},filter:{statuses:[ACTIVE]}){total items{name price}}}',
    ),
  ).toEqual({ data: { products: { total: 1, items: [{ name: 'Configured', price: '8.95' }] } } });
  expect(
    await query(
      tokens.viewer,
      branchA,
      '{products(sort:{field:PRICE,direction:ASC},filter:{statuses:[ACTIVE]},offset:1,limit:2){total items{name price}}}',
    ),
  ).toEqual({
    data: {
      products: {
        total: 3,
        items: [
          { name: 'Configured', price: '8.95' },
          { name: 'Local', price: '19.95' },
        ],
      },
    },
  });
  expect(
    await query(tokens.operator, branchA, updateOption, { id: scopedOption.id, values: [] }),
  ).toMatchObject({ data: null, errors: [{ extensions: { code: 'CONFLICT' } }] });
  const foreignValue = await client.optionValue.findFirstOrThrow({
    where: { tenantId: tenantA, branchId: branchB },
  });
  await expect(
    client.productVariantValue.create({
      data: { ...optionScope, variantId: configuredVariant.id, optionValueId: foreignValue.id },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
  const values = [
    { id: second.id, label: 'Second renamed' },
    { id: first.id, label: 'First' },
  ];
  expect(
    await query(tokens.operator, branchA, updateOption, { id: scopedOption.id, values }),
  ).toEqual({
    data: {
      updateOption: {
        id: scopedOption.id,
        name: 'Renamed',
        active: false,
        showInFilters: true,
        values,
      },
    },
  });

  const [localMarkers, ...outsideMarkers] = await Promise.all(
    rows.map(async ({ tenantId, branchId, id: productId }) => {
      const scope = { tenantId, branchId };
      const badge = await client.productBadge.create({
        data: { ...scope, name: 'Scoped Badge', slug: 'scoped-badge' },
      });
      const tag = await client.productTag.create({
        data: { ...scope, name: 'Scoped Tag', normalizedName: 'scoped tag', slug: 'scoped-tag' },
      });
      return { scope, productId, badgeId: badge.id, tagId: tag.id };
    }),
  );
  if (!localMarkers) {
    throw new Error('Missing local product markers');
  }
  const { scope: markerScope, productId, badgeId, tagId } = localMarkers;
  const readMarkers = 'query($id:ID!){product(id:$id){name badges{id} tags{id}}}';
  const assignMarkers =
    'mutation($id:ID!,$input:ProductInput!){updateProduct(id:$id,input:$input){name badges{id} tags{id}}}';
  const productDraft = {
    name: 'Local',
    status: 'ACTIVE',
    variants: [
      {
        sku: 'LOCAL',
        price: '19.95',
        quantity: 0,
        inventoryTracked: false,
        active: true,
        optionValueIds: [],
      },
    ],
  };
  const expectedMarkers = { name: 'Local', badges: [{ id: badgeId }], tags: [{ id: tagId }] };
  expect(
    await query(
      tokens.viewer,
      branchA,
      '{productBadges(search:"scoped"){total items{id}} productBadgeChoices{id} productTags(search:"scoped"){id}}',
    ),
  ).toEqual({
    data: {
      productBadges: { total: 1, items: [{ id: badgeId }] },
      productBadgeChoices: [{ id: badgeId }],
      productTags: [{ id: tagId }],
    },
  });
  expect(await query(tokens.viewer, branchA, readMarkers, { id: productId })).toEqual({
    data: { product: { name: 'Local', badges: [], tags: [] } },
  });
  expect(
    await query(tokens.operator, branchA, assignMarkers, {
      id: productId,
      input: { ...productDraft, badgeIds: [badgeId, badgeId.toUpperCase()], tagIds: [tagId] },
    }),
  ).toEqual({ data: { updateProduct: expectedMarkers } });
  for (const outside of outsideMarkers) {
    for (const [field, value] of [
      ['badgeIds', outside.badgeId],
      ['tagIds', outside.tagId],
    ] as const) {
      expect(
        await query(tokens.operator, branchA, assignMarkers, {
          id: productId,
          input: { ...productDraft, name: 'Rejected', badgeIds: [], tagIds: [], [field]: [value] },
        }),
      ).toMatchObject({
        data: null,
        errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: field }] } }],
      });
      expect(await query(tokens.viewer, branchA, readMarkers, { id: productId })).toEqual({
        data: { product: expectedMarkers },
      });
    }
    for (const mismatched of [
      { ...markerScope, productId, badgeId: outside.badgeId, tagId: outside.tagId },
      { ...markerScope, productId: outside.productId, badgeId, tagId },
    ]) {
      const { badgeId: mismatchedBadgeId, tagId: mismatchedTagId, ...scope } = mismatched;
      await expect(
        client.productBadgeAssignment.create({ data: { ...scope, badgeId: mismatchedBadgeId } }),
      ).rejects.toMatchObject({ code: 'P2003' });
      await expect(
        client.productTagAssignment.create({ data: { ...scope, tagId: mismatchedTagId } }),
      ).rejects.toMatchObject({ code: 'P2003' });
    }
  }
  expect(
    await query(tokens.operator, branchA, assignMarkers, {
      id: productId,
      input: { ...productDraft, badgeIds: null },
    }),
  ).toEqual({ data: { updateProduct: expectedMarkers } });
  expect(
    await query(tokens.operator, branchA, assignMarkers, {
      id: productId,
      input: { ...productDraft, tagIds: [] },
    }),
  ).toEqual({ data: { updateProduct: { ...expectedMarkers, tags: [] } } });
}, 60_000);

function storedVariant(sku: string, price: string, active = true) {
  return {
    sku,
    price,
    active,
    combinationKey: createHash('sha256').update('').digest('hex'),
    sortOrder: 0,
  };
}

async function storefront(
  branch: string,
  source: string,
  variables: Record<string, unknown> = {},
  token?: string,
  guestCartToken?: string,
): Promise<unknown> {
  const response = await fetch(publicEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-branch-id': branch,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(guestCartToken ? { 'x-cart-token': guestCartToken } : {}),
    },
    body: JSON.stringify({ query: source, variables }),
  });
  return response.json();
}
function registeredToken(value: unknown): string {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('data' in value) ||
    typeof value.data !== 'object' ||
    value.data === null ||
    !('registerShopper' in value.data) ||
    typeof value.data.registerShopper !== 'object' ||
    value.data.registerShopper === null ||
    !('token' in value.data.registerShopper) ||
    typeof value.data.registerShopper.token !== 'string'
  ) {
    throw new Error('Registration failed');
  }
  return value.data.registerShopper.token;
}
function reviewedCart(value: unknown): { cartId: string; quoteRevision: string } {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('data' in value) ||
    typeof value.data !== 'object' ||
    value.data === null ||
    !('quoteCheckout' in value.data) ||
    typeof value.data.quoteCheckout !== 'object' ||
    value.data.quoteCheckout === null ||
    !('cartId' in value.data.quoteCheckout) ||
    typeof value.data.quoteCheckout.cartId !== 'string' ||
    !('quoteRevision' in value.data.quoteCheckout) ||
    typeof value.data.quoteCheckout.quoteRevision !== 'string'
  ) {
    throw new Error('Checkout quote failed');
  }
  const { cartId, quoteRevision } = value.data.quoteCheckout;
  return { cartId, quoteRevision };
}

async function verifyPublicShopCache(service: StorefrontService): Promise<void> {
  const resolveShop = (branchId: string) => service.shop({ branchId, authorization: undefined });
  const startedAt = performance.now();
  const clock = jest.spyOn(performance, 'now').mockReturnValue(startedAt);
  const shop = { id: publicA, tenantId: tenantA, name: 'Shop' };
  const missingShop = randomUUID();
  const unavailable = 'Shop verification is unavailable';

  try {
    expect(await resolveShop(publicA)).toEqual(shop);
    publicBranchLookupAvailable = false;
    expect(await resolveShop(publicA.toUpperCase())).toEqual(shop);

    publicBranchLookupAvailable = true;
    for (let index = 1; index < 1024; index += 1) {
      await resolveShop(randomUUID());
    }
    expect(await resolveShop(missingShop)).toBeNull();
    publicBranchLookupAvailable = false;
    expect(await resolveShop(missingShop)).toBeNull();
    await expect(resolveShop(publicA)).rejects.toThrow(unavailable);

    publicBranchLookupAvailable = true;
    expect(await resolveShop(publicA)).toEqual(shop);
    publicBranchLookupAvailable = false;
    clock.mockReturnValue(startedAt + 4999);
    expect(await resolveShop(publicA)).toEqual(shop);
    clock.mockReturnValue(startedAt + 5000);
    await expect(resolveShop(publicA)).rejects.toThrow(unavailable);
    await expect(resolveShop(missingShop)).rejects.toThrow(unavailable);
  } finally {
    publicBranchLookupAvailable = true;
    clock.mockRestore();
  }
}

it('isolates shoppers, catalogue, carts, checkout and orders by shop', async () => {
  if (!database || !app) {
    throw new Error('Missing database');
  }
  await verifyPublicShopCache(app.get(StorefrontService));
  const publishedPage = { slug: 'published-page', titleBg: 'За нас', bodyBg: 'Нашият магазин.' };
  const readPublicPage = 'query($slug:String!){shopPage(slug:$slug){slug titleBg bodyBg}}';
  await database.shopPage.createMany({
    data: [
      { tenantId: tenantA, branchId: publicA, ...publishedPage, status: 'PUBLISHED' },
      { tenantId: tenantA, branchId: publicB, ...publishedPage, status: 'DRAFT' },
      {
        tenantId: tenantB,
        branchId: publicA,
        ...publishedPage,
        slug: 'foreign-page',
        status: 'PUBLISHED',
      },
    ],
  });
  expect(await storefront(publicA, readPublicPage, { slug: publishedPage.slug })).toEqual({
    data: { shopPage: publishedPage },
  });
  expect(await storefront(publicB, readPublicPage, { slug: publishedPage.slug })).toEqual({
    data: { shopPage: null },
  });
  expect(await storefront(publicA, readPublicPage, { slug: 'foreign-page' })).toEqual({
    data: { shopPage: null },
  });
  const blogScope = { tenantId: tenantA, branchId: publicA };
  const tag = await database.blogTag.create({
    data: { ...blogScope, name: 'Грижа', normalizedName: 'грижа', slug: 'care' },
  });
  const draftTag = await database.blogTag.create({
    data: { ...blogScope, name: 'Бележки', normalizedName: 'бележки', slug: 'notes' },
  });
  const article = await database.blogArticle.create({
    data: {
      ...blogScope,
      slug: 'tagged',
      status: 'PUBLISHED',
      titleBg: 'Грижа за съдовете',
      bodyBg: 'Почистете съдовете.',
      titleEn: 'Incomplete translation',
      publishedAt: new Date('2026-11-17T12:00:00Z'),
    },
  });
  const draftArticle = await database.blogArticle.create({
    data: { ...blogScope, slug: 'draft-only' },
  });
  await database.blogArticle.createMany({
    data: [
      {
        ...blogScope,
        slug: 'untagged',
        status: 'PUBLISHED',
        titleEn: 'Untitled cookware notes',
        bodyEn: 'Wash after use.',
        publishedAt: new Date('2026-11-20T12:00:00Z'),
      },
      {
        tenantId: tenantB,
        branchId: publicA,
        slug: 'foreign-article',
        status: 'PUBLISHED',
        titleBg: 'Друг магазин',
        bodyBg: 'Друг магазин.',
        publishedAt: new Date('2026-11-20T12:00:00Z'),
      },
    ],
  });
  await database.blogArticleTag.createMany({
    data: [
      { ...blogScope, articleId: article.id, tagId: tag.id },
      { ...blogScope, articleId: draftArticle.id, tagId: draftTag.id },
    ],
  });
  const readBlog =
    '{all:blogArticles{items{slug} total} filtered:blogArticles(tagSlug:"care"){items{slug titleEn} total} draftFilter:blogArticles(tagSlug:"notes"){items{slug} total} blogArticle(slug:"draft-only"){slug} blogTags{slug}}';
  expect(await storefront(publicA, readBlog)).toEqual({
    data: {
      all: { items: [{ slug: 'untagged' }, { slug: 'tagged' }], total: 2 },
      filtered: { items: [{ slug: 'tagged', titleEn: null }], total: 1 },
      draftFilter: { items: [], total: 0 },
      blogArticle: null,
      blogTags: [{ slug: 'care' }],
    },
  });
  expect(await storefront(publicB, '{blogArticle(slug:"tagged"){slug} blogTags{slug}}')).toEqual({
    data: { blogArticle: null, blogTags: [] },
  });
  const updateArticle =
    'mutation($id:ID!,$input:BlogArticleInput!){updateBlogArticle(id:$id,input:$input){publishedAt}}';
  const input = {
    slug: article.slug,
    titleBg: article.titleBg,
    bodyBg: article.bodyBg,
    tagIds: [tag.id],
  };
  for (const [status, publishedAt] of [
    ['PUBLISHED', '2026-11-17T12:00:00.000Z'],
    ['DRAFT', null],
    ['PUBLISHED', expect.any(String)],
  ] as const) {
    expect(
      await query(tokens.operator, publicA, updateArticle, {
        id: article.id,
        input: { ...input, status },
      }),
    ).toEqual({ data: { updateBlogArticle: { publishedAt } } });
  }
  const republished = await database.blogArticle.findUniqueOrThrow({
    where: { ...blogScope, id: article.id },
  });
  expect(republished.publishedAt).not.toEqual(article.publishedAt);
  const visible = await database.brand.create({
    data: { tenantId: tenantA, branchId: publicA, name: 'Visible Brand', slug: 'visible' },
  });
  const hidden = await database.brand.create({
    data: {
      tenantId: tenantA,
      branchId: publicA,
      name: 'Hidden Brand',
      slug: 'hidden',
      status: 'HIDDEN',
    },
  });
  const categoryScope = { tenantId: tenantA, branchId: publicA };
  const parent = await database.category.create({
    data: { ...categoryScope, name: 'Parent', slug: 'parent' },
  });
  const category = await database.category.create({
    data: { ...categoryScope, name: 'Child', slug: 'child', parentId: parent.id },
  });
  const createMenu =
    'mutation($input:CreateNavigationMenuInput!){createNavigationMenu(input:$input){id}}';
  expect(
    await query(tokens.operator, publicA, createMenu, {
      input: {
        placement: 'HEADER',
        items: [
          { labelBg: 'Категория', destinationType: 'CATEGORY', destinationId: category.id },
          { labelBg: 'Блог', destinationType: 'BLOG' },
        ],
      },
    }),
  ).toMatchObject({ data: { createNavigationMenu: { id: expect.any(String) } } });
  const foreignScope = { tenantId: tenantB, branchId: publicA };
  const foreignMenu = await database.navigationMenu.create({
    data: { ...foreignScope, placement: 'FOOTER' },
  });
  await database.navigationMenuItem.create({
    data: {
      ...foreignScope,
      menuId: foreignMenu.id,
      sortOrder: 0,
      labelBg: 'Чужд блог',
      destinationType: 'BLOG',
    },
  });
  const readNavigation = '{shopNavigation{header{href} footer{href}}}';
  const blogLink = { href: '/s/' + publicA + '/blog' };
  expect(await storefront(publicA, readNavigation)).toEqual({
    data: {
      shopNavigation: {
        header: [{ href: '/s/' + publicA + '/categories/child' }, blogLink],
        footer: [],
      },
    },
  });
  expect(await storefront(publicB, readNavigation)).toEqual({
    data: { shopNavigation: { header: [], footer: [] } },
  });
  const red = { id: randomUUID(), label: 'Red', sortOrder: 0 };
  const blue = { id: randomUUID(), label: 'Blue', sortOrder: 1 };
  const matte = { id: randomUUID(), label: 'Matte', sortOrder: 0 };
  await database.option.create({
    data: {
      ...categoryScope,
      name: 'Color',
      showInFilters: true,
      values: { create: [red, blue] },
    },
  });
  await database.option.create({
    data: { ...categoryScope, name: 'Finish', values: { create: matte } },
  });
  for (const [name, status, brandId, optionValueId] of [
    ['Visible', 'ACTIVE', visible.id, red.id],
    ['Visible bowl', 'ACTIVE', hidden.id, matte.id],
    ['Draft', 'DRAFT', visible.id],
    ['Archived', 'ARCHIVED', visible.id, blue.id],
    ['No active variant', 'ACTIVE', visible.id, blue.id],
  ] as const) {
    const tracked = name === 'Visible';
    await database.product.create({
      data: {
        tenantId: tenantA,
        branchId: publicA,
        name,
        variants: {
          create: {
            ...storedVariant(name, '1.00', name !== 'No active variant'),
            inventoryTracked: tracked,
            quantity: tracked ? 2 : 0,
            ...(optionValueId && {
              combinationKey: createHash('sha256').update(optionValueId).digest('hex'),
              values: { create: { optionValueId } },
            }),
          },
        },
        status,
        brandId,
        categoryId: category.id,
      },
    });
  }
  await database.product.create({
    data: {
      ...foreignScope,
      name: 'Visible foreign bowl',
      status: 'ACTIVE',
      variants: { create: storedVariant('FOREIGN-BOWL', '1.00') },
    },
  });
  const mutation =
    'mutation($email:String!){registerShopper(name:"Person",email:$email,password:"temporary-password"){token shopper{email}}}';
  const token = registeredToken(
    await storefront(publicA, mutation, { email: 'same@example.test' }),
  );
  expect(token).toMatch(/^holita-shopper\.[A-Za-z0-9_-]{43}$/);
  const foreignShopRegistration = await storefront(publicB, mutation, {
    email: 'same@example.test',
  });
  const foreignShopBearer = registeredToken(foreignShopRegistration);
  expect(foreignShopRegistration).toMatchObject({
    data: { registerShopper: { shopper: { email: 'same@example.test' } } },
  });
  for (const [branch, expected] of [
    [publicA, { name: 'Person' }],
    [publicB, null],
  ] as const) {
    expect(await storefront(branch, '{shopperMe{name}}', {}, token)).toMatchObject({
      data: { shopperMe: expected },
    });
  }
  expect(
    await storefront(
      publicA,
      '{catalogue{total items{name price brand{id} category{id} categoryPath{id}}} catalogueBrands{id} catalogueCategories{id parentId}}',
    ),
  ).toEqual({
    data: {
      catalogue: {
        total: 2,
        items: [
          {
            name: 'Visible',
            price: '1.00',
            brand: { id: visible.id },
            category: { id: category.id },
            categoryPath: [{ id: parent.id }, { id: category.id }],
          },
          {
            name: 'Visible bowl',
            price: '1.00',
            brand: null,
            category: { id: category.id },
            categoryPath: [{ id: parent.id }, { id: category.id }],
          },
        ],
      },
      catalogueBrands: [{ id: visible.id }],
      catalogueCategories: [
        { id: parent.id, parentId: null },
        { id: category.id, parentId: parent.id },
      ],
    },
  });
  const browse = `query($search:String!, $offset:Int!, $sort:CatalogueSort = NAME_ASC) {
    catalogue(offset:$offset, limit:1, sort:$sort, filter:{search:$search}) {
      items{name} total offset facets{brands{id} options{name values{id}}}
    }
  }`;
  const facets = {
    brands: [{ id: visible.id }],
    options: [{ name: 'Color', values: [{ id: red.id }] }],
  };
  for (const [search, offset, total, names] of [
    ['Visible', 0, 2, ['Visible']],
    ['Visible', 0, 2, ['Visible']],
    ['Visible', 1, 2, ['Visible bowl']],
    ['Visible', 2, 2, []],
    ['bowl', 0, 1, ['Visible bowl']],
    ['missing', 0, 0, []],
  ] as const) {
    expect(await storefront(publicA, browse, { search, offset })).toEqual({
      data: { catalogue: { items: names.map((name) => ({ name })), total, offset, facets } },
    });
  }
  expect(await storefront(publicB, browse, { search: 'Visible', offset: 0 })).toEqual({
    data: { catalogue: { items: [], total: 0, offset: 0, facets: { brands: [], options: [] } } },
  });
  const sameCreationTime = new Date('2026-11-22T12:00:00Z');
  await database.product.updateMany({
    where: { ...categoryScope, name: { in: ['Visible', 'Visible bowl'] } },
    data: { createdAt: sameCreationTime },
  });
  const newest = await database.product.findMany({
    where: { ...categoryScope, name: { in: ['Visible', 'Visible bowl'] } },
    orderBy: { id: 'desc' },
    select: { name: true },
  });
  for (const [offset, item] of newest.entries()) {
    expect(
      await storefront(publicA, browse, { search: 'Visible', offset, sort: 'NEWEST' }),
    ).toEqual({
      data: { catalogue: { items: [item], total: 2, offset, facets } },
    });
  }
  expect(await storefront(publicB, '{catalogueBrands{id} catalogueCategories{id}}')).toEqual({
    data: { catalogueBrands: [], catalogueCategories: [] },
  });
  await database.brand.update({ where: { id: visible.id }, data: { status: 'HIDDEN' } });
  await database.category.update({ where: { id: parent.id }, data: { active: false } });
  expect(await storefront(publicA, readNavigation)).toEqual({
    data: { shopNavigation: { header: [blogLink], footer: [] } },
  });
  expect(
    await storefront(
      publicA,
      '{catalogue{items{brand{id} category{id} categoryPath{id}} facets{brands{id} options{name values{id}}}} catalogueCategories{id}}',
    ),
  ).toEqual({
    data: {
      catalogue: {
        items: [
          { brand: null, category: null, categoryPath: [] },
          { brand: null, category: null, categoryPath: [] },
        ],
        facets: { brands: [], options: facets.options },
      },
      catalogueCategories: [],
    },
  });
  expect(await storefront(suspended, '{shop{id}}')).toEqual({ data: { shop: null } });
  expect(await storefront(suspended, '{catalogue{total}}')).toMatchObject({
    data: null,
    errors: expect.any(Array),
  });
  expect(await storefront(publicA, '{products{total}}')).toHaveProperty('errors');

  const variant = await database.productVariant.findFirstOrThrow({
    where: { ...categoryScope, sku: 'Visible' },
  });
  const readCart = '{cart{itemCount subtotal lines{id variantId name optionLabels issue}}}';
  const cart = () => storefront(publicA, readCart, {}, token);
  expect(await cart()).toEqual({ data: { cart: { itemCount: 0, subtotal: '0.00', lines: [] } } });
  const add =
    'mutation($id:ID!,$quantity:Int!){addCartLine(variantId:$id,quantity:$quantity){guestCartToken cart{itemCount subtotal}}}';
  expect(await storefront(publicA, add, { id: variant.id, quantity: 2 }, token)).toEqual({
    data: { addCartLine: { guestCartToken: null, cart: { itemCount: 2, subtotal: '2.00' } } },
  });
  const accountCart = await database.cart.findFirstOrThrow({
    where: { ...categoryScope, customerId: { not: null } },
  });
  const line = await database.cartLine.findFirstOrThrow({
    where: { ...categoryScope, cartId: accountCart.id },
  });
  const foreignOwner = registeredToken(
    await storefront(publicA, mutation, { email: 'other@example.test' }),
  );
  const remove = 'mutation($id:ID!){removeCartLine(lineId:$id){itemCount}}';
  for (const [branch, bearer, operation] of [
    [publicB, token, readCart],
    [publicA, tokens.operator, readCart],
    [publicA, foreignOwner, remove],
    [publicA, undefined, remove],
  ] as const) {
    expect(
      await storefront(branch, operation, operation === remove ? { id: line.id } : {}, bearer),
    ).toHaveProperty('errors');
  }

  const guestToken = randomBytes(32).toString('base64url');
  await database.cart.create({
    data: {
      ...categoryScope,
      guestTokenHash: createHash('sha256').update(guestToken).digest('hex'),
    },
  });
  expect(
    await storefront(publicA, add, { id: variant.id, quantity: 1 }, undefined, guestToken),
  ).toEqual({
    data: { addCartLine: { guestCartToken: null, cart: { itemCount: 1, subtotal: '1.00' } } },
  });
  expect(await storefront(publicB, readCart, {}, undefined, guestToken)).toMatchObject({
    errors: [
      {
        extensions: {
          code: 'NOT_FOUND',
          fieldErrors: [{ path: 'cart', code: 'CART_NOT_FOUND', message: 'Cart not found' }],
        },
      },
    ],
  });
  expect(await storefront(publicA, remove, { id: line.id }, undefined, guestToken)).toHaveProperty(
    'errors',
  );
  expect(
    await storefront(
      publicA,
      'mutation{signInShopper(email:"same@example.test",password:"temporary-password"){cartMergeIssues{name quantity reason}}}',
      {},
      undefined,
      guestToken,
    ),
  ).toEqual({
    data: {
      signInShopper: {
        cartMergeIssues: [{ name: 'Visible', quantity: 1, reason: 'INSUFFICIENT_STOCK' }],
      },
    },
  });
  expect(await storefront(publicA, readCart, {}, undefined, guestToken)).toHaveProperty('errors');

  const methodIds = {
    paymentMethodId: { available: randomUUID(), foreign: randomUUID(), disabled: randomUUID() },
    shippingMethodId: { available: randomUUID(), foreign: randomUUID(), disabled: randomUUID() },
  };
  for (const [key, branchId, enabled] of [
    ['available', publicA, true],
    ['foreign', publicB, true],
    ['disabled', publicA, false],
  ] as const) {
    const scope = { tenantId: tenantA, branchId, enabled };
    await database.paymentMethod.create({
      data: {
        ...scope,
        id: methodIds.paymentMethodId[key],
        label: 'Cash on Delivery',
        instructions: 'Pay on arrival.',
      },
    });
    await database.shippingMethod.create({
      data: {
        ...scope,
        id: methodIds.shippingMethodId[key],
        label: 'Home Delivery',
        fixedFee: '6.00',
      },
    });
  }
  const quoteInput = {
    contact: { name: 'Person', email: 'same@example.test', phone: '0888123456' },
    shippingAddress: { countryCode: 'BG', city: 'Sofia', postalCode: '1000', line1: '1 Demo St' },
    paymentMethodId: methodIds.paymentMethodId.available,
    shippingMethodId: methodIds.shippingMethodId.available,
  };
  const quoteOperation =
    'mutation($input:CheckoutQuoteInput!){quoteCheckout(input:$input){cartId quoteRevision currency subtotal discountCode discountAmount shippingFee total lines{id variantId unitPrice}}}';
  const quote = (input = quoteInput) => storefront(publicA, quoteOperation, { input }, token);
  for (const path of ['paymentMethodId', 'shippingMethodId'] as const) {
    for (const key of ['foreign', 'disabled'] as const) {
      expect(await quote({ ...quoteInput, [path]: methodIds[path][key] })).toMatchObject({
        data: null,
        errors: [
          {
            extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code: 'INVALID_METHOD' }] },
          },
        ],
      });
    }
  }
  const initialQuote = await quote();
  const firstReview = reviewedCart(initialQuote);
  expect(initialQuote).toEqual({
    data: {
      quoteCheckout: {
        cartId: accountCart.id,
        quoteRevision: expect.any(String),
        currency: 'EUR',
        subtotal: '2.00',
        discountCode: null,
        discountAmount: '0.00',
        shippingFee: '6.00',
        total: '8.00',
        lines: [{ id: line.id, variantId: variant.id, unitPrice: '1.00' }],
      },
    },
  });

  const createDiscount =
    'mutation($input:DiscountInput!){createDiscount(input:$input){id code redeemedCount}}';
  const updateDiscount =
    'mutation($id:ID!,$input:DiscountInput!){updateDiscount(id:$id,input:$input){code redeemedCount}}';
  const applyDiscount =
    'mutation($code:String!){applyCartDiscount(code:$code){discount{code amount issue} discountedSubtotal}}';
  const promoError = (code: string) => ({
    data: null,
    errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'code', code }] } }],
  });
  const discountInput = {
    code: ' before-15 ',
    type: 'PERCENTAGE',
    value: '15.00',
    enabled: true,
    minSubtotal: '3.00',
    usageLimit: 1,
  };
  expect(
    await query(tokens.viewer, publicA, createDiscount, { input: discountInput }),
  ).toHaveProperty('errors');
  expect(
    await query(tokens.operator, publicA, createDiscount, { input: discountInput }),
  ).toMatchObject({
    data: { createDiscount: { code: 'BEFORE-15', redeemedCount: 0 } },
  });
  const discount = await database.discount.findUniqueOrThrow({
    where: { tenantId_branchId_code: { ...categoryScope, code: 'BEFORE-15' } },
  });
  expect(
    await query(tokens.operator, publicA, createDiscount, {
      input: { ...discountInput, code: discount.code },
    }),
  ).toMatchObject(promoError('DUPLICATE_VALUE'));
  for (const [credential, branch] of [
    [tokens.operator, branchB],
    [tokens.foreign, branchForeign],
  ] as const) {
    expect(
      await query(credential, branch, 'query($id:ID!){discount(id:$id){id} discounts{total}}', {
        id: discount.id,
      }),
    ).toEqual({ data: { discount: null, discounts: { total: 0 } } });
    expect(
      await query(credential, branch, updateDiscount, { id: discount.id, input: discountInput }),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
  }
  await database.discount.create({
    data: {
      ...categoryScope,
      code: 'PAST',
      type: 'PERCENTAGE',
      value: '10.00',
      enabled: true,
      endsAt: new Date(0),
    },
  });
  for (const [code, error] of [
    [discount.code, 'PROMO_MINIMUM_NOT_MET'],
    ['PAST', 'PROMO_EXPIRED'],
  ] as const) {
    expect(await storefront(publicA, applyDiscount, { code }, token)).toMatchObject(
      promoError(error),
    );
  }
  const otherShopVariant = await database.product.create({
    data: {
      tenantId: tenantA,
      branchId: publicB,
      name: 'Other shop item',
      status: 'ACTIVE',
      variants: { create: storedVariant('SHOP-ITEM', '10.00') },
    },
    select: { variants: { select: { id: true } } },
  });
  const otherVariant = otherShopVariant.variants[0];
  if (!otherVariant) {
    throw new Error('Missing other shop variant');
  }
  expect(
    await storefront(publicB, add, { id: otherVariant.id, quantity: 1 }, foreignShopBearer),
  ).toHaveProperty('data.addCartLine.cart');
  expect(
    await storefront(publicB, applyDiscount, { code: discount.code }, foreignShopBearer),
  ).toMatchObject(promoError('PROMO_INVALID'));
  expect(
    await storefront(publicA, applyDiscount, { code: discount.code }, foreignOwner),
  ).toHaveProperty('errors');

  const saveProduct =
    'mutation($id:ID!,$input:ProductInput!){updateProduct(id:$id,input:$input){variants{id quantity optionValueIds}}}';
  const simple = await database.productVariant.findFirstOrThrow({
    where: { ...categoryScope, sku: 'Draft' },
  });
  const simpleDraft = {
    id: simple.id,
    sku: simple.sku,
    price: '1.00',
    inventoryTracked: false,
    optionValueIds: [],
  };
  const configureSimple = (active: boolean) =>
    query(tokens.operator, publicA, saveProduct, {
      id: simple.productId,
      input: {
        name: 'Draft',
        status: 'DRAFT',
        variants: [
          { ...simpleDraft, active },
          {
            sku: 'Draft-Blue',
            price: '1.50',
            inventoryTracked: false,
            active: true,
            optionValueIds: [blue.id],
          },
        ],
      },
    });
  expect(await configureSimple(false)).toEqual({
    data: {
      updateProduct: {
        variants: [
          { id: simple.id, quantity: simple.quantity, optionValueIds: [] },
          { id: expect.any(String), quantity: 0, optionValueIds: [blue.id] },
        ],
      },
    },
  });
  expect(await configureSimple(true)).toMatchObject({
    errors: [
      {
        extensions: {
          fieldErrors: [{ path: 'variants1OptionValueIds', code: 'MISMATCHED_OPTIONS' }],
        },
      },
    ],
  });
  const redDraft = {
    id: variant.id,
    sku: variant.sku,
    price: '4.25',
    active: true,
    inventoryTracked: true,
    optionValueIds: [red.id],
  };
  const saveVariants = (
    variants: (Omit<typeof redDraft, 'id'> & { id?: string; quantity?: number })[],
  ) =>
    query(tokens.operator, publicA, saveProduct, {
      id: variant.productId,
      input: { name: 'Visible', status: 'ACTIVE', variants },
    });
  expect(await saveVariants([{ ...redDraft, optionValueIds: [blue.id] }])).toMatchObject({
    data: null,
    errors: [
      {
        extensions: {
          code: 'BAD_USER_INPUT',
          fieldErrors: [{ path: 'variants0OptionValueIds', code: 'VARIANT_COMBINATION_IMMUTABLE' }],
        },
      },
    ],
  });
  expect(await cart()).toMatchObject({
    data: {
      cart: { lines: [{ id: line.id, variantId: variant.id, optionLabels: ['Red'], issue: null }] },
    },
  });
  expect(await saveVariants([redDraft])).toEqual({
    data: {
      updateProduct: { variants: [{ id: variant.id, quantity: 2, optionValueIds: [red.id] }] },
    },
  });
  expect(await storefront(publicA, applyDiscount, { code: discountInput.code }, token)).toEqual({
    data: {
      applyCartDiscount: {
        discount: { code: discount.code, amount: '1.28', issue: null },
        discountedSubtotal: '7.22',
      },
    },
  });
  const repricedQuote = await quote();
  const currentReview = reviewedCart(repricedQuote);
  expect(repricedQuote).toEqual({
    data: {
      quoteCheckout: {
        cartId: accountCart.id,
        quoteRevision: expect.any(String),
        currency: 'EUR',
        subtotal: '8.50',
        discountCode: discount.code,
        discountAmount: '1.28',
        shippingFee: '6.00',
        total: '13.22',
        lines: [{ id: line.id, variantId: variant.id, unitPrice: '4.25' }],
      },
    },
  });

  const receiptFields =
    'id number placedAt status paymentStatus paymentMethodLabel paymentInstructions shippingMethodLabel shippingAddress{countryCode city postalCode line1} currency subtotal discountCode discountAmount shippingFee total lines{sku label quantity unitPrice lineTotal}';
  const placeOperation = `mutation($input:PlaceOrderInput!){placeOrder(input:$input){${receiptFields}}}`;
  const receiptOperation = `query($orderId:ID!){orderConfirmation(orderId:$orderId){${receiptFields}}}`;
  const place = (review: typeof currentReview, bearer = token) =>
    storefront(publicA, placeOperation, { input: { ...quoteInput, ...review } }, bearer);
  const orderScope = { ...categoryScope, cartId: accountCart.id };
  const variantKey = { ...categoryScope, id: variant.id };
  const cartKey = { ...categoryScope, id: accountCart.id };
  const discountKey = { ...categoryScope, id: discount.id };
  for (const [review, quantity, code] of [
    [firstReview, 2, 'CHECKOUT_QUOTE_CHANGED'],
    [currentReview, 1, 'CHECKOUT_STOCK_CHANGED'],
  ] as const) {
    await database.productVariant.update({ where: variantKey, data: { quantity } });
    expect(await place(review)).toMatchObject({
      data: null,
      errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'cart', code }] } }],
    });
    expect(await database.order.count({ where: orderScope })).toBe(0);
    expect(
      await database.discount.findUniqueOrThrow({
        where: discountKey,
        select: { redeemedCount: true },
      }),
    ).toEqual({ redeemedCount: 0 });
    expect(
      await database.cart.findUniqueOrThrow({ where: cartKey, select: { consumedAt: true } }),
    ).toEqual({ consumedAt: null });
    expect(
      await database.productVariant.findUniqueOrThrow({
        where: variantKey,
        select: { quantity: true },
      }),
    ).toEqual({ quantity });
  }

  await database.productVariant.update({ where: variantKey, data: { quantity: 3 } });
  const editDiscount = (input: object) =>
    query(tokens.operator, publicA, updateDiscount, {
      id: discount.id,
      input: { ...discountInput, ...input },
    });
  expect(await editDiscount({ endsAt: '2000-01-01T00:00:00.000Z' })).toHaveProperty(
    'data.updateDiscount',
  );
  expect(await quote()).toMatchObject(promoError('PROMO_EXPIRED'));
  expect(await place(currentReview)).toMatchObject(promoError('PROMO_EXPIRED'));
  expect(await editDiscount({ code: 'AFTER-15' })).toHaveProperty(
    'data.updateDiscount.code',
    'AFTER-15',
  );
  expect(await quote()).toHaveProperty('data.quoteCheckout.discountCode', 'AFTER-15');
  expect(await place(currentReview)).toMatchObject({
    errors: [{ extensions: { fieldErrors: [{ code: 'CHECKOUT_QUOTE_CHANGED' }] } }],
  });
  expect(await editDiscount({})).toHaveProperty('data.updateDiscount.redeemedCount', 0);
  const placed = await place(currentReview);
  const order = await database.order.findFirstOrThrow({ where: orderScope });
  const receipt = {
    id: order.id,
    number: order.orderNumber,
    placedAt: order.placedAt.toISOString(),
    status: 'PLACED',
    paymentStatus: 'UNPAID',
    paymentMethodLabel: 'Cash on Delivery',
    paymentInstructions: 'Pay on arrival.',
    shippingMethodLabel: 'Home Delivery',
    shippingAddress: quoteInput.shippingAddress,
    currency: 'EUR',
    subtotal: '8.50',
    discountCode: discount.code,
    discountAmount: '1.28',
    shippingFee: '6.00',
    total: '13.22',
    lines: [
      {
        sku: variant.sku,
        label: 'Visible · Red',
        quantity: 2,
        unitPrice: '4.25',
        lineTotal: '8.50',
      },
    ],
  };
  expect(placed).toEqual({ data: { placeOrder: receipt } });
  expect(order.customerId).toBe(accountCart.customerId);
  expect(await cart()).toEqual({ data: { cart: { itemCount: 0, subtotal: '0.00', lines: [] } } });
  expect(await storefront(publicA, add, { id: variant.id, quantity: 1 }, token)).toMatchObject({
    data: { addCartLine: { cart: { itemCount: 1 } } },
  });
  const newCart = await database.cart.findFirstOrThrow({
    where: { ...categoryScope, customerId: accountCart.customerId, consumedAt: null },
  });
  expect(newCart.id).not.toBe(accountCart.id);
  const newLine = await database.cartLine.findFirstOrThrow({
    where: { ...categoryScope, cartId: newCart.id },
  });
  expect(await storefront(publicA, applyDiscount, { code: discount.code }, token)).toMatchObject(
    promoError('PROMO_EXHAUSTED'),
  );

  await database.paymentMethod.update({
    where: { ...categoryScope, id: quoteInput.paymentMethodId },
    data: { label: 'New payment method', instructions: 'Updated instructions.' },
  });
  await database.shippingMethod.update({
    where: { ...categoryScope, id: quoteInput.shippingMethodId },
    data: { label: 'New shipping method', fixedFee: '99.00' },
  });
  expect(await place(currentReview)).toEqual({ data: { placeOrder: receipt } });
  expect(
    await database.discount.findUniqueOrThrow({
      where: discountKey,
      select: { redeemedCount: true },
    }),
  ).toEqual({ redeemedCount: 1 });
  expect(await place(currentReview, foreignOwner)).toHaveProperty('errors');
  expect(await database.order.count({ where: orderScope })).toBe(1);
  expect(
    await database.productVariant.findUniqueOrThrow({
      where: variantKey,
      select: { quantity: true },
    }),
  ).toEqual({ quantity: 1 });

  const guestCheckoutToken = randomBytes(32).toString('base64url');
  await database.cart.create({
    data: {
      ...categoryScope,
      guestTokenHash: createHash('sha256').update(guestCheckoutToken).digest('hex'),
    },
  });
  expect(
    await storefront(publicA, add, { id: variant.id, quantity: 1 }, undefined, guestCheckoutToken),
  ).toMatchObject({ data: { addCartLine: { cart: { itemCount: 1 } } } });
  const guestReview = reviewedCart(
    await storefront(publicA, quoteOperation, { input: quoteInput }, undefined, guestCheckoutToken),
  );
  expect(
    await storefront(
      publicA,
      placeOperation,
      { input: { ...quoteInput, ...guestReview } },
      undefined,
      guestCheckoutToken,
    ),
  ).toHaveProperty('data.placeOrder.id');
  const guestOrder = await database.order.findFirstOrThrow({
    where: { ...categoryScope, cartId: guestReview.cartId, customerId: null },
  });

  const adminOrders = `query($search:String,$status:OrderStatus,$customerId:ID){
    orders(search:$search,status:$status,customerId:$customerId,limit:1){
      items{id number status} total offset limit
    }
  }`;
  const adminDetail = `query($id:ID!){order(id:$id){id status paymentStatus}}`;
  const updateOrder = `mutation($id:ID!,$status:OrderStatus!){
    updateOrderStatus(id:$id,status:$status){id status paymentStatus statusChanges{fromStatus toStatus}}
  }`;
  const markPaid = `mutation($id:ID!){markOrderPaid(id:$id){id paymentStatus paidAt}}`;
  const operatorTarget = { id: order.id };
  const search = `${order.orderNumber.toUpperCase()} SAME@EXAMPLE.TEST`;
  expect(await query(tokens.viewer, publicA, adminOrders, { search, status: 'PLACED' })).toEqual({
    data: {
      orders: {
        items: [{ id: order.id, number: order.orderNumber, status: 'PLACED' }],
        total: 1,
        offset: 0,
        limit: 1,
      },
    },
  });
  expect(guestOrder.contactEmail).toBe(order.contactEmail);
  expect(
    await query(tokens.viewer, publicA, adminOrders, { customerId: order.customerId }),
  ).toEqual({
    data: {
      orders: {
        items: [{ id: order.id, number: order.orderNumber, status: 'PLACED' }],
        total: 1,
        offset: 0,
        limit: 1,
      },
    },
  });
  for (const [credential, branch] of [
    [tokens.operator, branchB],
    [tokens.foreign, branchForeign],
  ] as const) {
    expect(
      await query(credential, branch, adminOrders, { customerId: order.customerId }),
    ).toMatchObject({
      data: { orders: { items: [], total: 0 } },
    });
    expect(await query(credential, branch, adminDetail, operatorTarget)).toEqual({
      data: { order: null },
    });
    expect(
      await query(credential, branch, updateOrder, { ...operatorTarget, status: 'CONFIRMED' }),
    ).toHaveProperty('errors');
    expect(await query(credential, branch, markPaid, operatorTarget)).toHaveProperty('errors');
  }
  expect(await query(tokens.viewer, publicA, adminDetail, operatorTarget)).toEqual({
    data: { order: { ...operatorTarget, status: 'PLACED', paymentStatus: 'UNPAID' } },
  });
  expect(
    await query(tokens.viewer, publicA, updateOrder, { ...operatorTarget, status: 'CONFIRMED' }),
  ).toHaveProperty('errors');
  expect(await query(tokens.viewer, publicA, markPaid, operatorTarget)).toHaveProperty('errors');
  expect(
    await query(tokens.operator, publicA, updateOrder, { ...operatorTarget, status: 'SHIPPED' }),
  ).toMatchObject({
    errors: [
      { extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ code: 'ORDER_STATUS_REJECTED' }] } },
    ],
  });

  const blueDraft = {
    sku: 'Visible-Blue',
    price: '5.00',
    active: true,
    inventoryTracked: true,
    optionValueIds: [blue.id],
  };
  expect(
    await saveVariants([
      { ...redDraft, active: false, inventoryTracked: false },
      { ...blueDraft, quantity: 5 },
    ]),
  ).toEqual({
    data: {
      updateProduct: {
        variants: [
          { id: variant.id, quantity: 0, optionValueIds: [red.id] },
          { id: expect.any(String), quantity: 5, optionValueIds: [blue.id] },
        ],
      },
    },
  });
  const replacement = await database.productVariant.findFirstOrThrow({
    where: { ...categoryScope, productId: variant.productId, sku: blueDraft.sku },
  });
  const savedBlue = { ...blueDraft, id: replacement.id };
  expect(replacement.id).not.toBe(variant.id);
  expect(await saveVariants([{ ...redDraft, optionValueIds: [blue.id] }, savedBlue])).toMatchObject(
    {
      data: null,
      errors: [
        {
          extensions: {
            fieldErrors: [
              { path: 'variants0OptionValueIds', code: 'VARIANT_COMBINATION_IMMUTABLE' },
            ],
          },
        },
      ],
    },
  );
  expect(await cart()).toMatchObject({
    data: {
      cart: {
        lines: [{ id: newLine.id, variantId: null, optionLabels: [], issue: 'UNAVAILABLE' }],
      },
    },
  });
  expect(
    await database.productVariant.findUniqueOrThrow({
      where: variantKey,
      select: { quantity: true },
    }),
  ).toEqual({ quantity: 0 });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    expect(
      await query(tokens.operator, publicA, updateOrder, {
        id: guestOrder.id,
        status: 'CANCELLED',
      }),
    ).toEqual({
      data: {
        updateOrderStatus: {
          id: guestOrder.id,
          status: 'CANCELLED',
          paymentStatus: 'UNPAID',
          statusChanges: [{ fromStatus: 'PLACED', toStatus: 'CANCELLED' }],
        },
      },
    });
    expect(
      await database.productVariant.findUniqueOrThrow({
        where: variantKey,
        select: { quantity: true },
      }),
    ).toEqual({ quantity: 1 });
  }
  expect(await query(tokens.operator, publicA, markPaid, { id: guestOrder.id })).toMatchObject({
    errors: [
      { extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ code: 'ORDER_PAYMENT_REJECTED' }] } },
    ],
  });

  expect(await saveVariants([{ ...redDraft, price: '5.00' }, savedBlue])).toEqual({
    data: {
      updateProduct: {
        variants: [
          { id: variant.id, quantity: 1, optionValueIds: [red.id] },
          { id: replacement.id, quantity: 5, optionValueIds: [blue.id] },
        ],
      },
    },
  });
  expect(await saveVariants([savedBlue])).toMatchObject({
    errors: [
      {
        extensions: {
          code: 'BAD_USER_INPUT',
          fieldErrors: [{ path: 'variants', code: 'VARIANT_HAS_OUTSTANDING_DEDUCTIONS' }],
        },
      },
    ],
  });
  const receiptVariables = { orderId: order.id };
  const expiredConsumption = new Date(Date.now() - 25 * 60 * 60 * 1000);
  await database.cart.update({ where: cartKey, data: { consumedAt: expiredConsumption } });
  expect(await place(currentReview)).toEqual({ data: { placeOrder: receipt } });
  expect(await storefront(publicA, receiptOperation, receiptVariables, token)).toEqual({
    data: { orderConfirmation: receipt },
  });
  for (const [branch, bearer] of [
    [publicA, undefined],
    [publicA, foreignOwner],
    [publicB, foreignShopBearer],
  ] as const) {
    expect(await storefront(branch, receiptOperation, receiptVariables, bearer)).toEqual({
      data: { orderConfirmation: null },
    });
  }

  const readOrders =
    'query($offset:Int! = 0,$limit:Int! = 20){shopperOrders(offset:$offset,limit:$limit){items{id number placedAt status paymentStatus paymentMethodLabel shippingMethodLabel currency total} total offset limit}}';
  const readOrder = `query($id:ID!){shopperOrder(id:$id){${receiptFields}}}`;
  const orderSummary = {
    id: receipt.id,
    number: receipt.number,
    placedAt: receipt.placedAt,
    status: receipt.status,
    paymentStatus: receipt.paymentStatus,
    paymentMethodLabel: receipt.paymentMethodLabel,
    shippingMethodLabel: receipt.shippingMethodLabel,
    currency: receipt.currency,
    total: receipt.total,
  };
  for (const [offset, items] of [
    [0, [orderSummary]],
    [1, []],
  ] as const) {
    expect(await storefront(publicA, readOrders, { offset, limit: 1 }, token)).toEqual({
      data: { shopperOrders: { items, total: 1, offset, limit: 1 } },
    });
  }
  expect(await storefront(publicA, readOrder, { id: order.id.toUpperCase() }, token)).toEqual({
    data: { shopperOrder: receipt },
  });
  for (const id of [guestOrder.id, randomUUID(), 'invalid']) {
    expect(await storefront(publicA, readOrder, { id }, token)).toEqual({
      data: { shopperOrder: null },
    });
  }
  const guestReceiptFields = { id: guestOrder.id, status: 'CANCELLED' };
  const guestReceiptReads = [
    [receiptOperation, { orderId: guestOrder.id }, 'orderConfirmation'],
    [
      'query($cartId:ID!){guestOrderConfirmation(cartId:$cartId){id status}}',
      { cartId: guestReview.cartId },
      'guestOrderConfirmation',
    ],
  ] as const;
  const retryGuestPlacement = (branch: string, cartToken: string) =>
    storefront(
      branch,
      placeOperation,
      { input: { ...quoteInput, ...guestReview } },
      undefined,
      cartToken,
    );
  for (const [operation, variables, field] of guestReceiptReads) {
    expect(
      await storefront(publicA, operation, variables, undefined, guestCheckoutToken),
    ).toMatchObject({ data: { [field]: guestReceiptFields } });
  }
  expect(await retryGuestPlacement(publicA, guestCheckoutToken)).toMatchObject({
    data: { placeOrder: guestReceiptFields },
  });
  for (const [branch, cartToken, expired] of [
    [publicA, randomBytes(32).toString('base64url'), false],
    [publicB, guestCheckoutToken, false],
    [publicA, guestCheckoutToken, true],
  ] as const) {
    if (expired) {
      await database.cart.update({
        where: { ...categoryScope, id: guestReview.cartId },
        data: { consumedAt: expiredConsumption },
      });
    }
    for (const [operation, variables, field] of guestReceiptReads) {
      expect(await storefront(branch, operation, variables, undefined, cartToken)).toEqual({
        data: { [field]: null },
      });
    }
    expect(await retryGuestPlacement(branch, cartToken)).toMatchObject({
      data: null,
      errors: [{ extensions: { fieldErrors: [{ path: 'cart', code: 'CART_NOT_FOUND' }] } }],
    });
  }
  expect(
    await database.order.count({ where: { ...categoryScope, cartId: guestReview.cartId } }),
  ).toBe(1);
  for (const [branch, bearer] of [
    [publicA, foreignOwner],
    [publicB, foreignShopBearer],
  ] as const) {
    expect(await storefront(branch, readOrders, {}, bearer)).toEqual({
      data: { shopperOrders: { items: [], total: 0, offset: 0, limit: 20 } },
    });
    expect(await storefront(branch, readOrder, { id: order.id }, bearer)).toEqual({
      data: { shopperOrder: null },
    });
  }
  const paidOrder = await query(tokens.operator, publicA, markPaid, operatorTarget);
  expect(paidOrder).toMatchObject({
    data: {
      markOrderPaid: { ...operatorTarget, paymentStatus: 'PAID', paidAt: expect.any(String) },
    },
  });
  expect(await query(tokens.operator, publicA, markPaid, operatorTarget)).toEqual(paidOrder);
  expect(
    await query(tokens.operator, publicA, updateOrder, { ...operatorTarget, status: 'CANCELLED' }),
  ).toMatchObject({ data: { updateOrderStatus: { status: 'CANCELLED', paymentStatus: 'PAID' } } });
  expect(
    await database.productVariant.findUniqueOrThrow({
      where: variantKey,
      select: { quantity: true },
    }),
  ).toEqual({ quantity: 3 });
  expect(await saveVariants([savedBlue])).toEqual({
    data: {
      updateProduct: { variants: [{ id: replacement.id, quantity: 5, optionValueIds: [blue.id] }] },
    },
  });
  expect(await cart()).toMatchObject({
    data: {
      cart: {
        subtotal: '0.00',
        lines: [{ id: newLine.id, variantId: null, name: null, issue: 'UNAVAILABLE' }],
      },
    },
  });
  expect(await storefront(publicA, remove, { id: newLine.id }, token)).toEqual({
    data: { removeCartLine: { itemCount: 0 } },
  });
  expect(await storefront(publicA, readOrder, operatorTarget, token)).toEqual({
    data: { shopperOrder: { ...receipt, status: 'CANCELLED', paymentStatus: 'PAID' } },
  });
  const readRefunds = `query($orderId:ID!){
    orderRefundSummary(orderId:$orderId){
      status refundedAmount refundableAmount canRecordRefund canRestockOnCompletion
      refunds{id amount currency reason restock createdAt}
    }
  }`;
  const recordRefund = `mutation($orderId:ID!,$input:RecordOrderRefundInput!){
    recordOrderRefund(orderId:$orderId,input:$input){id amount currency reason restock}
  }`;
  const refundTarget = { orderId: randomUUID() };
  const refundPaidAt = new Date();
  const refundCart = await database.cart.create({
    data: { ...categoryScope, customerId: order.customerId, consumedAt: refundPaidAt },
  });
  await database.order.create({
    data: {
      ...order,
      id: refundTarget.orderId,
      cartId: refundCart.id,
      orderNumber: `H-${refundTarget.orderId}`,
      status: 'PLACED',
      paymentStatus: 'PAID',
      paidAt: refundPaidAt,
    },
  });
  const refundVariantKey = { ...categoryScope, id: replacement.id };
  await database.productVariant.update({
    where: refundVariantKey,
    data: { inventoryTracked: true, quantity: 3 },
  });
  await database.orderLine.create({
    data: {
      ...categoryScope,
      ...refundTarget,
      variantId: replacement.id,
      sortOrder: 0,
      sku: replacement.sku,
      label: 'Tracked product',
      quantity: 2,
      unitPrice: '4.25',
      stockDeductedQuantity: 2,
    },
  });
  expect(
    await query(tokens.operator, publicA, updateOrder, {
      id: refundTarget.orderId,
      status: 'CANCELLED',
    }),
  ).toMatchObject({
    data: { updateOrderStatus: { status: 'CANCELLED', paymentStatus: 'PAID' } },
  });
  expect(
    await database.productVariant.findUniqueOrThrow({
      where: refundVariantKey,
      select: { quantity: true },
    }),
  ).toEqual({ quantity: 5 });
  const partialRefund = {
    ...refundTarget,
    input: { amount: '10.00', reason: ' Returned externally ' },
  };
  expect(await query(tokens.viewer, publicA, readRefunds, { orderId: guestOrder.id })).toEqual({
    data: {
      orderRefundSummary: {
        status: 'NONE',
        refundedAmount: '0.00',
        refundableAmount: '0.00',
        canRecordRefund: false,
        canRestockOnCompletion: false,
        refunds: [],
      },
    },
  });
  expect(
    await query(tokens.operator, publicA, recordRefund, {
      ...partialRefund,
      orderId: guestOrder.id,
    }),
  ).toMatchObject({
    errors: [{ extensions: { fieldErrors: [{ path: 'amount', code: 'REFUND_INELIGIBLE' }] } }],
  });
  for (const [credential, branch] of [
    [tokens.operator, branchB],
    [tokens.foreign, branchForeign],
  ] as const) {
    expect(await query(credential, branch, readRefunds, refundTarget)).toEqual({
      data: { orderRefundSummary: null },
    });
    expect(await query(credential, branch, recordRefund, partialRefund)).toMatchObject({
      errors: [{ message: 'Order not found' }],
    });
  }
  expect(await query(tokens.viewer, publicA, recordRefund, partialRefund)).toHaveProperty('errors');
  expect(
    await query(tokens.operator, publicA, recordRefund, {
      ...partialRefund,
      input: { amount: '1.001' },
    }),
  ).toMatchObject({
    errors: [{ extensions: { fieldErrors: [{ code: 'REFUND_AMOUNT_INVALID' }] } }],
  });
  expect(
    await query(tokens.operator, publicA, recordRefund, {
      ...partialRefund,
      input: { amount: '10.00', restock: true },
    }),
  ).toMatchObject({
    errors: [{ extensions: { fieldErrors: [{ code: 'REFUND_RESTOCK_UNAVAILABLE' }] } }],
  });

  const competing = await Promise.all([
    query(tokens.operator, publicA, recordRefund, partialRefund),
    query(tokens.operator, publicA, recordRefund, partialRefund),
  ]);
  expect(competing).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        data: {
          recordOrderRefund: {
            id: expect.any(String),
            amount: '10.00',
            currency: 'EUR',
            restock: false,
            reason: 'Returned externally',
          },
        },
      }),
      expect.objectContaining({
        errors: [
          expect.objectContaining({
            extensions: expect.objectContaining({
              fieldErrors: [expect.objectContaining({ code: 'REFUND_EXCEEDS_BALANCE' })],
            }),
          }),
        ],
      }),
    ]),
  );
  expect(await query(tokens.viewer, publicA, readRefunds, refundTarget)).toMatchObject({
    data: {
      orderRefundSummary: {
        status: 'PARTIAL',
        refundedAmount: '10.00',
        refundableAmount: '3.22',
        canRecordRefund: true,
        canRestockOnCompletion: true,
      },
    },
  });
  expect(
    await query(tokens.operator, publicA, recordRefund, {
      ...refundTarget,
      input: { amount: '3.22', restock: true },
    }),
  ).toMatchObject({
    data: { recordOrderRefund: { amount: '3.22', currency: 'EUR', reason: null, restock: true } },
  });
  expect(await query(tokens.viewer, publicA, readRefunds, refundTarget)).toMatchObject({
    data: {
      orderRefundSummary: {
        status: 'FULL',
        refundedAmount: receipt.total,
        refundableAmount: '0.00',
        canRecordRefund: false,
        canRestockOnCompletion: false,
        refunds: [
          { amount: '3.22', restock: true },
          { amount: '10.00', restock: false },
        ],
      },
    },
  });
  expect(
    await database.productVariant.findUniqueOrThrow({
      where: refundVariantKey,
      select: { quantity: true },
    }),
  ).toEqual({ quantity: 5 });
  expect(
    await query(tokens.operator, publicA, markPaid, { id: refundTarget.orderId }),
  ).toMatchObject({
    data: {
      markOrderPaid: {
        id: refundTarget.orderId,
        paymentStatus: 'PAID',
        paidAt: refundPaidAt.toISOString(),
      },
    },
  });

  const issueInvoice = `mutation($orderId:ID!,$input:IssueOrderInvoiceInput!){
    issueOrderInvoice(orderId:$orderId,input:$input){id orderId number issueDate recipientName currency subtotal discountAmount shippingFee total lines{description sku quantity unitPrice lineTotal}}
  }`;
  const readInvoice = `query($orderId:ID!){
    orderInvoice(orderId:$orderId){id orderId number issueDate recipientName currency subtotal discountAmount shippingFee total lines{description sku quantity unitPrice lineTotal}}
  }`;
  const readInvoices = `query($offset:Int! = 0,$limit:Int! = 20,$search:String,$filter:InvoiceFilter){
    invoices(offset:$offset,limit:$limit,search:$search,filter:$filter){
      items{orderId number issueDate recipientName currency total} total offset limit
    }
  }`;
  const invoiceInput = {
    number: 'TEST-0001',
    issueDate: '2026-11-22',
    issuerName: 'Invoice issuer',
    issuerCompanyId: '000000001',
    issuerAddress: '1 Invoice Street',
    recipientName: order.contactName,
    recipientAddress: order.shippingLine1,
  };
  const invoiceTarget = { orderId: order.id };
  const invoicePdf = new URL(`/documents/invoices/${order.id}/pdf`, endpoint);
  const issuance = { ...invoiceTarget, input: invoiceInput };
  expect(await query(tokens.viewer, publicA, issueInvoice, issuance)).toHaveProperty('errors');
  const issued = await query(tokens.operator, publicA, issueInvoice, issuance);
  expect(issued).toMatchObject({
    data: {
      issueOrderInvoice: {
        ...invoiceTarget,
        number: invoiceInput.number,
        issueDate: invoiceInput.issueDate,
        recipientName: order.contactName,
        currency: receipt.currency,
        subtotal: receipt.subtotal,
        discountAmount: receipt.discountAmount,
        shippingFee: receipt.shippingFee,
        total: receipt.total,
        lines: [{ description: expect.any(String), quantity: expect.any(Number) }],
      },
    },
  });
  const savedInvoice = await query(tokens.viewer, publicA, readInvoice, invoiceTarget);
  expect(savedInvoice).toMatchObject({
    data: {
      orderInvoice: {
        ...invoiceTarget,
        number: invoiceInput.number,
        discountAmount: receipt.discountAmount,
      },
    },
  });
  for (const [credential, branch] of [
    [tokens.operator, branchB],
    [tokens.foreign, branchForeign],
  ] as const) {
    expect(await query(credential, branch, readInvoice, invoiceTarget)).toEqual({
      data: { orderInvoice: null },
    });
    expect(await query(credential, branch, issueInvoice, issuance)).toMatchObject({
      errors: [{ message: 'Order not found' }],
    });
    expect(await query(credential, branch, readInvoices)).toEqual({
      data: { invoices: { items: [], total: 0, offset: 0, limit: 20 } },
    });
    const response = await fetch(invoicePdf, {
      headers: { authorization: `Bearer ${credential}`, 'x-branch-id': branch },
    });
    expect(response.status).toBe(404);
  }
  const unauthenticatedPdf = await fetch(invoicePdf, { headers: { 'x-branch-id': publicA } });
  expect(unauthenticatedPdf.status).toBe(401);
  expect(await query(tokens.operator, publicA, issueInvoice, issuance)).toMatchObject({
    errors: [{ extensions: { code: 'CONFLICT' } }],
  });
  expect(
    await query(tokens.operator, publicA, issueInvoice, { ...issuance, orderId: guestOrder.id }),
  ).toMatchObject({
    errors: [
      {
        extensions: {
          code: 'BAD_USER_INPUT',
          fieldErrors: [{ path: 'number', code: 'INVOICE_NUMBER_USED' }],
        },
      },
    ],
  });
  await database.$transaction([
    database.order.update({
      where: { ...categoryScope, id: order.id },
      data: { contactName: 'Changed order contact', discountAmount: '0.00', total: '999.00' },
    }),
    database.orderLine.updateMany({
      where: { ...categoryScope, orderId: order.id },
      data: { label: 'Changed order line' },
    }),
  ]);
  expect(await query(tokens.viewer, publicA, readInvoice, invoiceTarget)).toEqual(savedInvoice);
  const savedInvoiceListItem = {
    ...invoiceTarget,
    number: invoiceInput.number,
    issueDate: invoiceInput.issueDate,
    recipientName: invoiceInput.recipientName,
    currency: receipt.currency,
    total: receipt.total,
  };
  const issueDate = { issueDateFrom: invoiceInput.issueDate, issueDateTo: invoiceInput.issueDate };
  for (const [search, filter, offset, total, items] of [
    [invoiceInput.number.toLowerCase(), issueDate, 0, 1, [savedInvoiceListItem]],
    [invoiceInput.recipientName, issueDate, 0, 1, [savedInvoiceListItem]],
    [invoiceInput.number, issueDate, 1, 1, []],
    [invoiceInput.number, { issueDateFrom: '2026-11-23' }, 0, 0, []],
    ['Changed order contact', issueDate, 0, 0, []],
  ] as const) {
    expect(
      await query(tokens.viewer, publicA, readInvoices, { search, filter, offset, limit: 1 }),
    ).toEqual({ data: { invoices: { items, total, offset, limit: 1 } } });
  }

  const createManual = `mutation($input:ManualOrderInput!){
    createManualOrder(input:$input){id currency total shippingFee customerId merchantNote canEditManualOrder}
  }`;
  const updateManual = `mutation($id:ID!,$input:ManualOrderUpdateInput!){
    updateManualOrder(id:$id,input:$input){id total shippingFee merchantNote canEditManualOrder lines{id quantity unitPrice}}
  }`;
  const variantIdentity = { ...categoryScope, id: replacement.id };
  const readManualStock = () =>
    database.productVariant.findUniqueOrThrow({
      where: variantIdentity,
      select: { quantity: true },
    });
  await database.productVariant.update({
    where: variantIdentity,
    data: { active: true, inventoryTracked: true, price: '8.00', quantity: 7 },
  });
  const { contact, shippingAddress, paymentMethodId, shippingMethodId } = quoteInput;
  const manualInput = {
    contact,
    shippingAddress,
    paymentMethodId,
    shippingMethodId,
    merchantNote: 'Private note',
    lines: [{ variantId: replacement.id, quantity: 2 }],
  };
  expect(await query(tokens.viewer, publicA, createManual, { input: manualInput })).toHaveProperty(
    'errors',
  );
  expect(
    await query(tokens.operator, branchB, createManual, { input: manualInput }),
  ).toHaveProperty('errors');

  const created = await query(tokens.operator, publicA, createManual, { input: manualInput });
  expect(created).toMatchObject({
    data: {
      createManualOrder: {
        currency: 'EUR',
        customerId: null,
        merchantNote: 'Private note',
        total: '115.00',
        canEditManualOrder: true,
      },
    },
  });
  const manual = await database.order.findFirstOrThrow({
    where: { ...categoryScope, cartId: null, merchantNote: 'Private note' },
    include: { lines: true },
  });
  const [manualLine] = manual.lines;
  const manualEdit = (
    quantity: number,
    line: { lineId: string } | { variantId: string } = { lineId: manualLine.id },
  ) => ({
    id: manual.id,
    input: {
      contact,
      shippingAddress,
      customerId: order.customerId,
      lines: [{ ...line, quantity }],
    },
  });
  expect(
    await storefront(
      publicA,
      receiptOperation,
      { orderId: manual.id },
      undefined,
      guestCheckoutToken,
    ),
  ).toEqual({ data: { orderConfirmation: null } });
  expect(await query(tokens.operator, branchB, updateManual, manualEdit(3))).toMatchObject({
    errors: [{ message: 'Order not found' }],
  });
  await database.shippingMethod.update({
    where: { ...categoryScope, id: shippingMethodId },
    data: { enabled: false, fixedFee: '12.00' },
  });
  await database.productVariant.update({ where: variantIdentity, data: { price: '9.00' } });
  expect(await query(tokens.operator, publicA, updateManual, manualEdit(3))).toMatchObject({
    data: {
      updateManualOrder: {
        total: '123.00',
        shippingFee: '99.00',
        lines: [{ id: manualLine.id, quantity: 3, unitPrice: '8.00' }],
      },
    },
  });
  expect(await query(tokens.operator, publicA, updateManual, manualEdit(8))).toMatchObject({
    errors: [
      { extensions: { fieldErrors: [{ path: 'lines0Quantity', code: 'ORDER_STOCK_SHORT' }] } },
    ],
  });
  expect(await storefront(publicA, readOrder, { id: manual.id }, token)).toMatchObject({
    data: { shopperOrder: { total: '123.00', lines: [{ quantity: 3, unitPrice: '8.00' }] } },
  });
  expect(await storefront(publicA, readOrder, { id: manual.id }, foreignOwner)).toEqual({
    data: { shopperOrder: null },
  });
  await database.productVariant.update({
    where: variantIdentity,
    data: { inventoryTracked: false },
  });
  expect(await readManualStock()).toEqual({ quantity: 4 });
  const readded = await query(
    tokens.operator,
    publicA,
    updateManual,
    manualEdit(3, { variantId: replacement.id }),
  );
  const readdedLine = await database.orderLine.findFirstOrThrow({
    where: { ...categoryScope, orderId: manual.id, variantId: replacement.id },
    select: { id: true, stockDeductedQuantity: true },
  });
  expect(readdedLine.id).not.toBe(manualLine.id);
  expect(readdedLine.stockDeductedQuantity).toBe(3);
  expect(readded).toMatchObject({
    data: {
      updateManualOrder: {
        total: '126.00',
        shippingFee: '99.00',
        lines: [{ id: readdedLine.id, quantity: 3, unitPrice: '9.00' }],
      },
    },
  });
  expect(await readManualStock()).toEqual({ quantity: 4 });

  const lineReference = { lineId: readdedLine.id };
  for (const [inventoryTracked, quantity, stockDeductedQuantity, onHand] of [
    [false, 5, 3, 4],
    [false, 4, 3, 4],
    [true, 6, 5, 2],
    [true, 4, 4, 3],
  ] as const) {
    await database.productVariant.update({ where: variantIdentity, data: { inventoryTracked } });
    expect(
      await query(tokens.operator, publicA, updateManual, manualEdit(quantity, lineReference)),
    ).toMatchObject({
      data: { updateManualOrder: { lines: [{ id: readdedLine.id, quantity }] } },
    });
    expect(
      await database.orderLine.findUniqueOrThrow({
        where: { ...categoryScope, id: readdedLine.id },
        select: { stockDeductedQuantity: true },
      }),
    ).toEqual({ stockDeductedQuantity });
    expect(await readManualStock()).toEqual({ quantity: onHand });
  }
  const reduction = manualEdit(1, lineReference);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    expect(await query(tokens.operator, publicA, updateManual, reduction)).toMatchObject({
      data: {
        updateManualOrder: { total: '108.00', lines: [{ id: readdedLine.id, quantity: 1 }] },
      },
    });
    expect(await readManualStock()).toEqual({ quantity: 6 });
  }
  await database.productVariant.update({
    where: variantIdentity,
    data: { inventoryTracked: false },
  });
  const untrackedIncrease = manualEdit(2, lineReference);
  expect(await query(tokens.operator, publicA, updateManual, untrackedIncrease)).toMatchObject({
    data: { updateManualOrder: { total: '117.00' } },
  });
  expect(await readManualStock()).toEqual({ quantity: 6 });

  const manualShipping = await database.shippingMethod.create({
    data: { ...categoryScope, label: 'Manual-order delivery', fixedFee: '6.00', enabled: true },
  });
  await database.shippingMethod.update({
    where: { ...categoryScope, id: shippingMethodId },
    data: { enabled: true },
  });
  const manualTarget = { id: manual.id };
  const manualAmounts = { subtotal: '18.00', shippingFee: '6.00', total: '24.00' };
  expect(
    await query(tokens.operator, publicA, updateManual, {
      ...manualTarget,
      input: { contact, shippingAddress, shippingMethodId: manualShipping.id },
    }),
  ).toMatchObject({ data: { updateManualOrder: { shippingFee: '6.00', total: '24.00' } } });
  const manualInvoiceTarget = { orderId: manual.id };
  expect(
    await query(tokens.operator, publicA, issueInvoice, {
      ...manualInvoiceTarget,
      input: { ...invoiceInput, number: 'TEST-0002' },
    }),
  ).toMatchObject({
    data: {
      issueOrderInvoice: {
        ...manualAmounts,
        currency: 'EUR',
        lines: [{ quantity: 2, unitPrice: '9.00', lineTotal: '18.00' }],
      },
    },
  });
  const savedManualInvoice = await query(tokens.viewer, publicA, readInvoice, manualInvoiceTarget);
  const readStoredManual = () =>
    database.order.findUniqueOrThrow({
      where: { ...categoryScope, ...manualTarget },
      include: { lines: true },
    });
  const invoicedManual = await readStoredManual();
  await database.productVariant.update({
    where: variantIdentity,
    data: { inventoryTracked: true },
  });
  for (const changes of [
    { lines: manualEdit(3, lineReference).input.lines },
    { shippingMethodId },
  ]) {
    expect(
      await query(tokens.operator, publicA, updateManual, {
        ...manualTarget,
        input: { contact, shippingAddress, ...changes },
      }),
    ).toMatchObject({
      data: null,
      errors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'order', code: 'MANUAL_ORDER_AMOUNTS_LOCKED' }],
          },
        },
      ],
    });
  }
  expect(await readStoredManual()).toEqual(invoicedManual);
  expect(await readManualStock()).toEqual({ quantity: 6 });
  const merchantNote = 'Updated note after invoicing';
  expect(
    await query(tokens.operator, publicA, updateManual, {
      ...manualTarget,
      input: { contact, shippingAddress, merchantNote },
    }),
  ).toMatchObject({ data: { updateManualOrder: { merchantNote, canEditManualOrder: true } } });
  expect(await readStoredManual()).toEqual({ ...invoicedManual, merchantNote });
  expect(await query(tokens.viewer, publicA, readInvoice, manualInvoiceTarget)).toEqual(
    savedManualInvoice,
  );

  await query(tokens.operator, publicA, markPaid, { id: manual.id });
  expect(await query(tokens.operator, publicA, updateManual, untrackedIncrease)).toHaveProperty(
    'errors',
  );
  for (const status of ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED']) {
    expect(
      await query(tokens.operator, publicA, updateOrder, { id: manual.id, status }),
    ).toMatchObject({ data: { updateOrderStatus: { status } } });
  }
  expect(
    await query(tokens.operator, publicA, recordRefund, {
      orderId: manual.id,
      input: { amount: manualAmounts.total, restock: true },
    }),
  ).toMatchObject({ data: { recordOrderRefund: { restock: true } } });
  expect(
    await database.order.findUniqueOrThrow({
      where: { ...categoryScope, id: manual.id },
      select: { status: true },
    }),
  ).toEqual({ status: 'COMPLETED' });
  expect(await readManualStock()).toEqual({ quantity: 7 });

  const oneUse = await database.discount.create({
    data: {
      ...categoryScope,
      code: 'LAST-USE',
      type: 'FIXED',
      value: '10.00',
      enabled: true,
      usageLimit: 1,
    },
  });
  const lastUseShipping = await database.shippingMethod.create({
    data: { ...categoryScope, label: 'Last-use delivery', fixedFee: '6.00', enabled: true },
  });
  const lastUseQuote = { ...quoteInput, shippingMethodId: lastUseShipping.id };
  const competingCarts: { token: string; review: ReturnType<typeof reviewedCart> }[] = [];
  for (const sku of ['LAST-USE-A', 'LAST-USE-B']) {
    // Separate products take different catalogue locks before contending for the discount.
    const product = await database.product.create({
      data: {
        ...categoryScope,
        name: sku,
        status: 'ACTIVE',
        variants: { create: storedVariant(sku, '5.00') },
      },
      include: { variants: true },
    });
    const [guestVariant] = product.variants;
    if (!guestVariant) {
      throw new Error('Missing competing cart variant');
    }
    const guestCredential = randomBytes(32).toString('base64url');
    await database.cart.create({
      data: {
        ...categoryScope,
        guestTokenHash: createHash('sha256').update(guestCredential).digest('hex'),
      },
    });
    expect(
      await storefront(
        publicA,
        add,
        { id: guestVariant.id, quantity: 1 },
        undefined,
        guestCredential,
      ),
    ).toHaveProperty('data.addCartLine.cart');
    expect(
      await storefront(publicA, applyDiscount, { code: oneUse.code }, undefined, guestCredential),
    ).toHaveProperty('data.applyCartDiscount.discountedSubtotal', '0.00');
    const review = reviewedCart(
      await storefront(
        publicA,
        quoteOperation,
        { input: lastUseQuote },
        undefined,
        guestCredential,
      ),
    );
    competingCarts.push({ token: guestCredential, review });
  }
  const placedTogether = await Promise.all(
    competingCarts.map(({ review, token: guestCredential }) =>
      storefront(
        publicA,
        placeOperation,
        { input: { ...lastUseQuote, ...review } },
        undefined,
        guestCredential,
      ),
    ),
  );
  expect(placedTogether).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        data: null,
        errors: [
          expect.objectContaining({
            extensions: expect.objectContaining({
              code: 'BAD_USER_INPUT',
              fieldErrors: [expect.objectContaining({ path: 'code', code: 'PROMO_EXHAUSTED' })],
            }),
          }),
        ],
      }),
      expect.objectContaining({
        data: { placeOrder: expect.objectContaining({ discountAmount: '5.00', total: '6.00' }) },
      }),
    ]),
  );
  expect(
    await database.discount.findUniqueOrThrow({
      where: { ...categoryScope, id: oneUse.id },
      select: { redeemedCount: true },
    }),
  ).toEqual({ redeemedCount: 1 });

  await database.shopperSession.update({
    where: { ...categoryScope, tokenHash: createHash('sha256').update(token).digest('hex') },
    data: { expiresAt: new Date(0) },
  });
  for (const [branch, bearer, cartToken] of [
    [publicA, undefined, undefined],
    [publicA, undefined, guestCheckoutToken],
    [publicA, foreignShopBearer, undefined],
    [publicA, tokens.operator, undefined],
    [publicA, 'invalid', undefined],
    [publicA, token, undefined],
  ] as const) {
    for (const [operation, variables] of [
      [readOrders, {}],
      [readOrder, { id: order.id }],
    ] as const) {
      expect(await storefront(branch, operation, variables, bearer, cartToken)).toMatchObject({
        errors: [{ message: 'Sign in to this shop to view your orders' }],
      });
    }
  }
}, 60_000);
