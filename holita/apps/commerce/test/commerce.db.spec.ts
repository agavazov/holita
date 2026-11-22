import 'dotenv/config';
import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
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
        ((identity.tenantId === tenantA && (id === branchA || id === branchB)) ||
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
): Promise<unknown> {
  const response = await fetch(publicEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-branch-id': branch,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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
it('isolates shoppers and active catalogue by shop and hides suspended shops', async () => {
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
        variants: { create: storedVariant(name, '1.00', name !== 'No active variant') },
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
  expect(await storefront(publicB, mutation, { email: 'same@example.test' })).toMatchObject({
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
});
