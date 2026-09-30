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
  'query($offset:Int! = 0,$limit:Int! = 20){products(offset:$offset,limit:$limit){items{id name storeId} total offset limit}}';

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

  it('combines literal search, SKU and status before counting and paginating within the store', async () => {
    const storeId = randomUUID();
    const foreign = randomUUID();
    await database.client.product.createMany({
      data: [
        { storeId, name: 'Notebook 100%_edition', sku: 'BOOK_A', status: 'ACTIVE' },
        { storeId, name: 'Notebook second', sku: 'BOOK_B', status: 'ACTIVE' },
        { storeId, name: 'Notebook draft', sku: 'BOOK_C', status: 'DRAFT' },
        { storeId: foreign, name: 'Notebook 100%_edition', sku: 'BOOK_A', status: 'ACTIVE' },
      ],
    });
    const filtered =
      'query($search:String,$sku:String,$status:ProductStatus,$offset:Int!=0,$limit:Int!=20){products(search:$search,sku:$sku,status:$status,offset:$offset,limit:$limit){items{name sku status storeId} total}}';
    expect(
      await query(
        filtered,
        { search: ' nOtEbOoK ', status: 'ACTIVE', limit: 1, offset: 1 },
        storeId,
      ),
    ).toMatchObject({ data: { products: { total: 2, items: [{ storeId, status: 'ACTIVE' }] } } });
    expect(
      await query(filtered, { search: '%_', sku: 'book_a', status: 'ACTIVE' }, storeId),
    ).toEqual({
      data: {
        products: {
          total: 1,
          items: [{ storeId, name: 'Notebook 100%_edition', sku: 'BOOK_A', status: 'ACTIVE' }],
        },
      },
    });
    expect(await query(filtered, { search: 'book_b' }, storeId)).toMatchObject({
      data: { products: { total: 1, items: [{ sku: 'BOOK_B' }] } },
    });
    expect(await query(filtered, { sku: 'BOOK_A', status: 'DRAFT' }, storeId)).toEqual({
      data: { products: { total: 0, items: [] } },
    });
    expect(await query(filtered, { search: 'x'.repeat(201) }, storeId)).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
    });
    expect(requireStore).not.toHaveBeenCalled();
  });

  it('sorts all filtered results before pagination with stable ties and store isolation', async () => {
    const storeId = randomUUID();
    const productIds: [string, string, string] = [randomUUID(), randomUUID(), randomUUID()];
    const [low, middle, high] = productIds.sort();
    await database.client.product.createMany({
      data: [
        { id: low, storeId, name: 'Sorting Alpha', sku: 'SORT_C', status: 'DRAFT' },
        { id: middle, storeId, name: 'Sorting Beta', sku: 'SORT_A', status: 'ACTIVE' },
        { id: high, storeId, name: 'Sorting Alpha', sku: 'SORT_B', status: 'ACTIVE' },
        { storeId, name: 'Unrelated', sku: 'OTHER', status: 'ACTIVE' },
        { storeId: randomUUID(), name: 'Sorting Alpha', sku: 'SORT_A', status: 'ACTIVE' },
      ],
    });
    const sorted =
      'query($sort:ProductSort,$offset:Int!=0,$limit:Int!=20,$status:ProductStatus){products(search:"sorting",sku:"SORT_",status:$status,sort:$sort,offset:$offset,limit:$limit){items{id}total}}';
    const cases = [
      { field: 'NAME', direction: 'ASC', ids: [high, low, middle] },
      { field: 'NAME', direction: 'DESC', ids: [middle, high, low] },
      { field: 'SKU', direction: 'ASC', ids: [middle, high, low] },
      { field: 'SKU', direction: 'DESC', ids: [low, high, middle] },
      { field: 'STATUS', direction: 'ASC', ids: [high, middle, low] },
      { field: 'STATUS', direction: 'DESC', ids: [low, high, middle] },
    ];
    for (const { field, direction, ids } of cases) {
      const sort = { field, direction };
      expect(await query(sorted, { sort }, storeId)).toEqual({
        data: { products: { items: ids.map((id) => ({ id })), total: 3 } },
      });
      expect(await query(sorted, { sort, offset: 1, limit: 1 }, storeId)).toEqual({
        data: { products: { items: [{ id: ids[1] }], total: 3 } },
      });
    }
    expect(
      await query(
        sorted,
        {
          sort: { field: 'NAME', direction: 'ASC' },
          status: 'ACTIVE',
          offset: 1,
          limit: 1,
        },
        storeId,
      ),
    ).toEqual({
      data: { products: { items: [{ id: middle }], total: 2 } },
    });
    expect(requireStore).not.toHaveBeenCalled();
  });

  it('rejects unsupported sort fields and directions at the GraphQL boundary', async () => {
    const source = 'query($sort:ProductSort){products(sort:$sort){total}}';
    for (const sort of [
      { field: 'STORE_ID', direction: 'ASC' },
      { field: 'NAME', direction: 'SIDEWAYS' },
      { field: null, direction: 'ASC' },
    ]) {
      expect(await query(source, { sort }, randomUUID())).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
    }
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
