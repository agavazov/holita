import 'dotenv/config';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import pg from 'pg';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database.service.js';

const legacyProductId = randomUUID();
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
  ]) {
    await connection.query(
      await readFile(
        new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url),
        'utf8',
      ),
    );
  }
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
  await database.customer.create({
    data: { tenantId: tenantA, branchId: branchA, name: 'Customer', email: 'Person@example.test' },
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
            fieldErrors: [{ path: 'variants.0.optionValueIds' }],
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
}, 15_000);

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

it('isolates shoppers, catalogue, carts, checkout and orders by shop', async () => {
  if (!database) {
    throw new Error('Missing database');
  }
  const visible = await database.brand.create({
    data: { tenantId: tenantA, branchId: publicA, name: 'Visible Brand', slug: 'visible' },
  });
  await database.brand.create({
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
  for (const [name, status] of [
    ['Visible', 'ACTIVE'],
    ['Draft', 'DRAFT'],
    ['Archived', 'ARCHIVED'],
    ['No active variant', 'ACTIVE'],
  ] as const) {
    await database.product.create({
      data: {
        tenantId: tenantA,
        branchId: publicA,
        name,
        variants: {
          create: {
            ...storedVariant(name, '1.00', name !== 'No active variant'),
            inventoryTracked: name === 'Visible',
            quantity: name === 'Visible' ? 2 : 0,
          },
        },
        status,
        brandId: visible.id,
        categoryId: category.id,
      },
    });
  }
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
        total: 1,
        items: [
          {
            name: 'Visible',
            price: '1.00',
            brand: { id: visible.id },
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
  expect(await storefront(publicB, '{catalogueBrands{id} catalogueCategories{id}}')).toEqual({
    data: { catalogueBrands: [], catalogueCategories: [] },
  });
  await database.brand.update({ where: { id: visible.id }, data: { status: 'HIDDEN' } });
  await database.category.update({ where: { id: parent.id }, data: { active: false } });
  expect(
    await storefront(
      publicA,
      '{catalogue{items{brand{id} category{id} categoryPath{id}}} catalogueCategories{id}}',
    ),
  ).toEqual({
    data: {
      catalogue: { items: [{ brand: null, category: null, categoryPath: [] }] },
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
  const readCart = '{cart{itemCount subtotal lines{id variantId name issue}}}';
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
    'mutation($input:CheckoutQuoteInput!){quoteCheckout(input:$input){cartId quoteRevision subtotal shippingFee total lines{id variantId unitPrice}}}';
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
        subtotal: '2.00',
        shippingFee: '6.00',
        total: '8.00',
        lines: [{ id: line.id, variantId: variant.id, unitPrice: '1.00' }],
      },
    },
  });

  const saveProduct =
    'mutation($id:ID!,$input:ProductInput!){updateProduct(id:$id,input:$input){variants{id}}}';
  const draft = {
    sku: variant.sku,
    price: '4.25',
    active: true,
    inventoryTracked: true,
    optionValueIds: [],
  };
  const saveVariants = (id?: string, price = draft.price) =>
    query(tokens.operator, publicA, saveProduct, {
      id: variant.productId,
      input: { name: 'Visible', status: 'ACTIVE', variants: [{ ...draft, id, price }] },
    });
  expect(await saveVariants(variant.id)).toEqual({
    data: { updateProduct: { variants: [{ id: variant.id }] } },
  });
  const repricedQuote = await quote();
  const currentReview = reviewedCart(repricedQuote);
  expect(repricedQuote).toEqual({
    data: {
      quoteCheckout: {
        cartId: accountCart.id,
        quoteRevision: expect.any(String),
        subtotal: '8.50',
        shippingFee: '6.00',
        total: '14.50',
        lines: [{ id: line.id, variantId: variant.id, unitPrice: '4.25' }],
      },
    },
  });

  const receiptFields =
    'id number placedAt status paymentStatus paymentMethodLabel paymentInstructions shippingMethodLabel shippingAddress{countryCode city postalCode line1} currency subtotal shippingFee total lines{sku label quantity unitPrice lineTotal}';
  const placeOperation = `mutation($input:PlaceOrderInput!){placeOrder(input:$input){${receiptFields}}}`;
  const receiptOperation = `query($orderId:ID!){orderConfirmation(orderId:$orderId){${receiptFields}}}`;
  const place = (review: typeof currentReview, bearer = token) =>
    storefront(publicA, placeOperation, { input: { ...quoteInput, ...review } }, bearer);
  const orderScope = { ...categoryScope, cartId: accountCart.id };
  const variantKey = { ...categoryScope, id: variant.id };
  const cartKey = { ...categoryScope, id: accountCart.id };
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
    currency: 'BGN',
    subtotal: '8.50',
    shippingFee: '6.00',
    total: '14.50',
    lines: [
      { sku: variant.sku, label: 'Visible', quantity: 2, unitPrice: '4.25', lineTotal: '8.50' },
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

  await database.paymentMethod.update({
    where: { ...categoryScope, id: quoteInput.paymentMethodId },
    data: { label: 'New payment method', instructions: 'Updated instructions.' },
  });
  await database.shippingMethod.update({
    where: { ...categoryScope, id: quoteInput.shippingMethodId },
    data: { label: 'New shipping method', fixedFee: '99.00' },
  });
  expect(await place(currentReview)).toEqual({ data: { placeOrder: receipt } });
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

  const adminOrders = `query($search:String,$status:OrderStatus){
    orders(search:$search,status:$status,limit:1){items{id number status} total offset limit}
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
  for (const [credential, branch] of [
    [tokens.operator, branchB],
    [tokens.foreign, branchForeign],
  ] as const) {
    expect(await query(credential, branch, adminOrders, { search })).toMatchObject({
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

  await database.productVariant.update({
    where: variantKey,
    data: { active: false, inventoryTracked: false },
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

  expect(await saveVariants(variant.id, '5.00')).toEqual({
    data: { updateProduct: { variants: [{ id: variant.id }] } },
  });
  expect(await saveVariants(undefined, '5.00')).toHaveProperty('data.updateProduct');
  const receiptVariables = { orderId: order.id };
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
  expect(
    await storefront(
      publicA,
      receiptOperation,
      { orderId: guestOrder.id },
      undefined,
      guestCheckoutToken,
    ),
  ).toMatchObject({ data: { orderConfirmation: { id: guestOrder.id, status: 'CANCELLED' } } });
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
  const replacement = await database.productVariant.findFirstOrThrow({
    where: {
      ...categoryScope,
      productId: variant.productId,
    },
  });
  expect(replacement.id).not.toBe(variant.id);
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
      where: { ...categoryScope, id: replacement.id },
      select: { quantity: true },
    }),
  ).toEqual({ quantity: replacement.quantity });
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
            currency: 'BGN',
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
        refundableAmount: '4.50',
        canRecordRefund: true,
        canRestockOnCompletion: true,
      },
    },
  });
  expect(
    await query(tokens.operator, publicA, recordRefund, {
      ...refundTarget,
      input: { amount: '4.50', restock: true },
    }),
  ).toMatchObject({
    data: { recordOrderRefund: { amount: '4.50', currency: 'BGN', reason: null, restock: true } },
  });
  expect(await query(tokens.viewer, publicA, readRefunds, refundTarget)).toMatchObject({
    data: {
      orderRefundSummary: {
        status: 'FULL',
        refundedAmount: '14.50',
        refundableAmount: '0.00',
        canRecordRefund: false,
        canRestockOnCompletion: false,
        refunds: [
          { amount: '4.50', restock: true },
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
    issueOrderInvoice(orderId:$orderId,input:$input){id orderId number issueDate recipientName subtotal shippingFee total lines{description sku quantity unitPrice lineTotal}}
  }`;
  const readInvoice = `query($orderId:ID!){
    orderInvoice(orderId:$orderId){id orderId number issueDate recipientName subtotal shippingFee total lines{description sku quantity unitPrice lineTotal}}
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
        subtotal: receipt.subtotal,
        shippingFee: receipt.shippingFee,
        total: receipt.total,
        lines: [{ description: expect.any(String), quantity: expect.any(Number) }],
      },
    },
  });
  const savedInvoice = await query(tokens.viewer, publicA, readInvoice, invoiceTarget);
  expect(savedInvoice).toMatchObject({
    data: { orderInvoice: { ...invoiceTarget, number: invoiceInput.number } },
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
  }
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
      data: { contactName: 'Changed order contact', total: '999.00' },
    }),
    database.orderLine.updateMany({
      where: { ...categoryScope, orderId: order.id },
      data: { label: 'Changed order line' },
    }),
  ]);
  expect(await query(tokens.viewer, publicA, readInvoice, invoiceTarget)).toEqual(savedInvoice);

  const createManual = `mutation($input:ManualOrderInput!){
    createManualOrder(input:$input){id total shippingFee customerId merchantNote canEditManualOrder}
  }`;
  const updateManual = `mutation($id:ID!,$input:ManualOrderUpdateInput!){
    updateManualOrder(id:$id,input:$input){id total shippingFee lines{id quantity unitPrice}}
  }`;
  const variantIdentity = { ...categoryScope, id: replacement.id };
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
  const manualEdit = (quantity: number) => ({
    id: manual.id,
    input: {
      contact,
      shippingAddress,
      customerId: order.customerId,
      lines: [{ lineId: manualLine.id, quantity }],
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
  for (const [inventoryTracked, quantity, stockDeductedQuantity, onHand] of [
    [false, 5, 3, 4],
    [false, 4, 3, 4],
    [true, 6, 5, 2],
    [true, 4, 4, 3],
  ] as const) {
    await database.productVariant.update({ where: variantIdentity, data: { inventoryTracked } });
    expect(await query(tokens.operator, publicA, updateManual, manualEdit(quantity))).toMatchObject(
      {
        data: { updateManualOrder: { lines: [{ id: manualLine.id, quantity }] } },
      },
    );
    expect(
      await database.orderLine.findUniqueOrThrow({
        where: { ...categoryScope, id: manualLine.id },
        select: { stockDeductedQuantity: true },
      }),
    ).toEqual({ stockDeductedQuantity });
    expect(
      await database.productVariant.findUniqueOrThrow({
        where: variantIdentity,
        select: { quantity: true },
      }),
    ).toEqual({ quantity: onHand });
  }
  expect(await query(tokens.operator, publicA, updateManual, manualEdit(1))).toMatchObject({
    data: { updateManualOrder: { total: '107.00', lines: [{ id: manualLine.id, quantity: 1 }] } },
  });
  expect(
    await database.productVariant.findUniqueOrThrow({
      where: variantIdentity,
      select: { quantity: true },
    }),
  ).toEqual({ quantity: 6 });
  await database.productVariant.update({
    where: variantIdentity,
    data: { inventoryTracked: false },
  });
  expect(await query(tokens.operator, publicA, updateManual, manualEdit(2))).toMatchObject({
    data: { updateManualOrder: { total: '115.00' } },
  });
  await query(tokens.operator, publicA, markPaid, { id: manual.id });
  expect(await query(tokens.operator, publicA, updateManual, manualEdit(2))).toHaveProperty(
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
      input: { amount: '115.00', restock: true },
    }),
  ).toMatchObject({ data: { recordOrderRefund: { restock: true } } });
  expect(
    await database.order.findUniqueOrThrow({
      where: { ...categoryScope, id: manual.id },
      select: { status: true },
    }),
  ).toEqual({ status: 'COMPLETED' });
  expect(
    await database.productVariant.findUniqueOrThrow({
      where: variantIdentity,
      select: { quantity: true },
    }),
  ).toEqual({ quantity: 7 });

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
}, 15_000);
