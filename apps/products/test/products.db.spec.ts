import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { CoreClient } from '../src/core/core.client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestDatabase } from './test-database.js';

const create =
  'mutation($input:CreateProductInput!){createProduct(input:$input){id storeId name sku status createdAt updatedAt}}';
const read = 'query($id:ID!){product(id:$id){id name storeId sku status}}';
const update =
  'mutation($id:ID!,$input:UpdateProductInput!){updateProduct(id:$id,input:$input){id name storeId sku status}}';
const remove = 'mutation($id:ID!){deleteProduct(id:$id){id storeId}}';
const list =
  'query($offset:Int! = 0,$limit:Int! = 20,$search:String,$status:ProductStatus){products(offset:$offset,limit:$limit,search:$search,status:$status){items{id name storeId} total offset limit}}';

describe('Products GraphQL with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;
  const requireStore = jest.fn<CoreClient['requireStore']>().mockResolvedValue(undefined);
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client })
      .overrideProvider(CoreClient)
      .useValue({ requireStore })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/graphql`;
  });
  beforeEach(() => {
    requireStore.mockClear();
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await closeDatabase?.();
    }
  });

  async function query(source: string, variables: Record<string, unknown>, storeId?: string) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(storeId === undefined ? {} : { 'x-store-id': storeId }),
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(5000),
    });
    const body: unknown = await response.json();
    return body;
  }

  it('creates trimmed data with DRAFT default and rejects duplicate SKU in the same store', async () => {
    const storeId = randomUUID();
    expect(
      await query(create, { input: { name: '  Notebook  ', sku: '  NOTE  ' } }, storeId),
    ).toMatchObject({
      data: {
        createProduct: {
          storeId,
          name: 'Notebook',
          sku: 'NOTE',
          status: 'DRAFT',
          createdAt: expect.stringMatching(/Z$/),
        },
      },
    });
    expect(
      await query(create, { input: { name: 'Duplicate', sku: 'NOTE' } }, storeId),
    ).toMatchObject({ errors: [{ extensions: { code: 'CONFLICT' } }] });
    expect(
      await query(
        create,
        { input: { name: 'Other store', sku: 'NOTE', status: 'ACTIVE' } },
        randomUUID(),
      ),
    ).toMatchObject({ data: { createProduct: { status: 'ACTIVE', sku: 'NOTE' } } });
    expect(requireStore).toHaveBeenCalledTimes(3);
  });

  it('reads, updates and deletes only the active store product without calling core', async () => {
    const storeId = randomUUID();
    const product = await database.client.product.create({
      data: { storeId, name: 'Original', sku: 'CRUD' },
    });
    expect(await query(read, { id: product.id }, storeId)).toMatchObject({
      data: { product: { id: product.id, name: 'Original' } },
    });
    expect(
      await query(
        update,
        { id: product.id, input: { name: '  Changed  ', status: 'ACTIVE' } },
        storeId,
      ),
    ).toMatchObject({ data: { updateProduct: { name: 'Changed', status: 'ACTIVE' } } });
    expect(await query(remove, { id: product.id }, storeId)).toEqual({
      data: { deleteProduct: { id: product.id, storeId } },
    });
    expect(await query(read, { id: product.id }, storeId)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(requireStore).not.toHaveBeenCalled();
  });

  it('hides foreign IDs on read, update and delete without modifying their rows', async () => {
    const owner = randomUUID();
    const foreign = randomUUID();
    const product = await database.client.product.create({
      data: { storeId: owner, name: 'Private', sku: 'PRIVATE' },
    });
    for (const source of [read, update, remove]) {
      expect(
        await query(source, { id: product.id, input: { name: 'Wrong store' } }, foreign),
      ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    }
    expect(await query(list, {}, foreign)).toEqual({
      data: { products: { items: [], total: 0, offset: 0, limit: 20 } },
    });
    expect(
      await database.client.product.findUnique({ where: { id: product.id, storeId: owner } }),
    ).toEqual(product);
    expect(requireStore).not.toHaveBeenCalled();
  });

  it.each([undefined, 'malformed-store'])(
    'requires valid store context on every operation (%s)',
    async (storeId) => {
      const id = randomUUID();
      for (const source of [list, read, create, update, remove]) {
        expect(
          await query(source, { id, input: { name: 'Product', sku: 'CONTEXT' } }, storeId),
        ).toMatchObject({ errors: [{ extensions: { code: 'BAD_USER_INPUT' } }] });
      }
      expect(requireStore).not.toHaveBeenCalled();
    },
  );

  it('enforces scoped federation reference resolution and ignores spoofed representation fields', async () => {
    const storeId = randomUUID();
    const product = await database.client.product.create({
      data: { storeId, name: 'Real name', sku: 'ENTITY' },
    });
    const source =
      'query($refs:[_Any!]!){_entities(representations:$refs){...on Product{id name storeId}}}';
    const variables = {
      refs: [{ __typename: 'Product', id: product.id, storeId, name: 'Spoofed' }],
    };
    expect(await query(source, variables, storeId)).toEqual({
      data: { _entities: [{ id: product.id, storeId, name: 'Real name' }] },
    });
    expect(await query(source, variables, randomUUID())).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(await query(source, variables)).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
    });
    expect(requireStore).not.toHaveBeenCalled();
  });

  it('paginates by createdAt and ID descending within one store', async () => {
    const storeId = randomUUID();
    const ids = [randomUUID(), randomUUID(), randomUUID()].sort().reverse();
    for (const id of ids)
      await database.client.product.create({
        data: { id, storeId, name: id, sku: id, createdAt: new Date('2026-01-01T00:00:00Z') },
      });
    const selected = ids[1];
    expect(await query(list, { offset: 1, limit: 1 }, storeId)).toEqual({
      data: {
        products: {
          items: [{ id: selected, name: selected, storeId }],
          total: 3,
          offset: 1,
          limit: 1,
        },
      },
    });
    for (const variables of [{ limit: 0 }, { limit: 101 }, { offset: -1 }])
      expect(await query(list, variables, storeId)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
  });

  it('searches name or SKU case-insensitively within the active store with matching totals', async () => {
    const storeId = randomUUID();
    const foreignStoreId = randomUUID();
    const createdAt = new Date('2026-02-01T00:00:00Z');
    const matchingBoth = await database.client.product.create({
      data: {
        id: randomUUID(),
        storeId,
        name: 'Travel Notebook',
        sku: 'NOTE-TRAVEL',
        createdAt,
      },
    });
    const matchingSku = await database.client.product.create({
      data: { id: randomUUID(), storeId, name: 'Pen set', sku: 'BLUE-NOTE-2', createdAt },
    });
    await database.client.product.create({
      data: { storeId, name: 'Desk lamp', sku: 'LAMP-1', createdAt },
    });
    await database.client.product.create({
      data: { storeId: foreignStoreId, name: 'Foreign notebook', sku: 'NOTE-FOREIGN' },
    });

    const expectedIds = [matchingBoth.id, matchingSku.id].sort().reverse();
    expect(await query(list, { search: '  nOtE  ', limit: 1 }, storeId)).toEqual({
      data: {
        products: {
          items: [
            {
              id: expectedIds[0],
              name: expectedIds[0] === matchingBoth.id ? matchingBoth.name : matchingSku.name,
              storeId,
            },
          ],
          total: 2,
          offset: 0,
          limit: 1,
        },
      },
    });
    expect(await query(list, { search: 'travel' }, storeId)).toMatchObject({
      data: { products: { items: [{ id: matchingBoth.id }], total: 1 } },
    });
    expect(await query(list, { search: '   ' }, storeId)).toMatchObject({
      data: { products: { total: 3 } },
    });
    expect(await query(list, { search: 'note' }, foreignStoreId)).toMatchObject({
      data: { products: { items: [{ name: 'Foreign notebook' }], total: 1 } },
    });
    expect(requireStore).not.toHaveBeenCalled();
  });

  it('filters status with search, pagination, matching totals and store isolation', async () => {
    const storeId = randomUUID();
    const foreignStoreId = randomUUID();
    const createdAt = new Date('2026-02-02T00:00:00Z');
    const activeMatches = await Promise.all(
      ['ACTIVE-1', 'ACTIVE-2'].map((sku) =>
        database.client.product.create({
          data: { storeId, name: `Notebook ${sku}`, sku, status: 'ACTIVE', createdAt },
        }),
      ),
    );
    await database.client.product.create({
      data: { storeId, name: 'Notebook draft', sku: 'DRAFT-1', status: 'DRAFT', createdAt },
    });
    await database.client.product.create({
      data: { storeId, name: 'Active lamp', sku: 'LAMP-1', status: 'ACTIVE', createdAt },
    });
    await database.client.product.create({
      data: {
        storeId: foreignStoreId,
        name: 'Foreign notebook',
        sku: 'ACTIVE-FOREIGN',
        status: 'ACTIVE',
      },
    });

    const expectedIds = activeMatches
      .map(({ id }) => id)
      .sort()
      .reverse();
    expect(
      await query(list, { search: '  notebook ', status: 'ACTIVE', limit: 1 }, storeId),
    ).toEqual({
      data: {
        products: {
          items: [
            {
              id: expectedIds[0],
              name: activeMatches.find(({ id }) => id === expectedIds[0])?.name,
              storeId,
            },
          ],
          total: 2,
          offset: 0,
          limit: 1,
        },
      },
    });
    expect(await query(list, { search: '   ', status: 'DRAFT' }, storeId)).toMatchObject({
      data: { products: { items: [{ name: 'Notebook draft' }], total: 1 } },
    });
    expect(await query(list, { status: null }, storeId)).toMatchObject({
      data: { products: { total: 4 } },
    });
    expect(await query(list, { status: 'ACTIVE' }, foreignStoreId)).toMatchObject({
      data: { products: { items: [{ name: 'Foreign notebook' }], total: 1 } },
    });
    expect(await query(list, { status: 'ARCHIVED' }, storeId)).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
    });
    expect(requireStore).not.toHaveBeenCalled();
  });

  it('rejects blank, long, null and empty updates, invalid UUIDs and writable store IDs', async () => {
    const storeId = randomUUID();
    for (const input of [
      { name: ' ', sku: 'SKU' },
      { name: 'A'.repeat(201), sku: 'SKU' },
      { name: 'Valid', sku: 'S'.repeat(101) },
    ]) {
      expect(await query(create, { input }, storeId)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
    }
    for (const input of [{}, { name: null }, { sku: ' ' }, { status: null }])
      expect(await query(update, { id: randomUUID(), input }, storeId)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
    expect(await query(read, { id: 'invalid' }, storeId)).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
    });
    expect(
      await query(
        create,
        { input: { name: 'Wrong', sku: 'INPUT', storeId: randomUUID() } },
        storeId,
      ),
    ).toMatchObject({ errors: [{ extensions: { code: 'BAD_USER_INPUT' } }] });
    expect(requireStore).not.toHaveBeenCalled();
    expect(await database.client.product.count({ where: { storeId } })).toBe(0);
  });

  it('maps update SKU conflicts and retains the original row', async () => {
    const storeId = randomUUID();
    await database.client.product.create({ data: { storeId, name: 'First', sku: 'TAKEN' } });
    const second = await database.client.product.create({
      data: { storeId, name: 'Second', sku: 'FREE' },
    });
    expect(await query(update, { id: second.id, input: { sku: 'TAKEN' } }, storeId)).toMatchObject({
      errors: [{ extensions: { code: 'CONFLICT' } }],
    });
    expect(await database.client.product.findUnique({ where: { id: second.id, storeId } })).toEqual(
      second,
    );
  });

  it('persists full Unicode limits and rejects NUL input without writes', async () => {
    const storeId = randomUUID();
    const name = '😀'.repeat(200);
    const sku = '🛍'.repeat(100);
    expect(await query(create, { input: { name, sku } }, storeId)).toMatchObject({
      data: { createProduct: { name, sku, storeId } },
    });
    const row = await database.client.product.findFirstOrThrow({ where: { storeId } });
    requireStore.mockClear();
    for (const input of [
      { name: 'Bad\u0000name', sku: 'NUL' },
      { name: 'Name', sku: 'Bad\u0000sku' },
    ]) {
      expect(await query(create, { input }, storeId)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
      expect(await query(update, { id: row.id, input }, storeId)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
    }
    expect(requireStore).not.toHaveBeenCalled();
    expect(await database.client.product.findMany({ where: { storeId } })).toEqual([row]);
  });

  it('masks unexpected failures and includes a request ID without writing', async () => {
    const storeId = randomUUID();
    requireStore.mockRejectedValueOnce(new Error('private-diagnostic-sentinel'));
    const response = await query(
      create,
      { input: { name: 'Must not persist', sku: 'ERROR' } },
      storeId,
    );
    expect(response).toMatchObject({
      errors: [
        {
          message: 'Internal server error',
          extensions: { code: 'INTERNAL_SERVER_ERROR', requestId: expect.any(String) },
        },
      ],
    });
    expect(JSON.stringify(response)).not.toContain('private-diagnostic-sentinel');
    expect(await database.client.product.count({ where: { storeId } })).toBe(0);
  });
});
