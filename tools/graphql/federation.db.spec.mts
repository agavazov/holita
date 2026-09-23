import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createFederationFixture } from './federation-fixture.mjs';

const sofia = '10000000-0000-4000-8000-000000000001';
const plovdiv = '10000000-0000-4000-8000-000000000002';
const create =
  'mutation($input:CreateProductInput!){createProduct(input:$input){id storeId name sku status}}';
const product = 'query($id:ID!){product(id:$id){id storeId name sku status}}';
const update =
  'mutation($id:ID!,$input:UpdateProductInput!){updateProduct(id:$id,input:$input){id name storeId sku status}}';
const remove = 'mutation($id:ID!){deleteProduct(id:$id){id storeId}}';
const list = '{products{items{id storeId}total}}';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected a GraphQL object');
  return value;
}

function createdId(body: unknown): string {
  const id = record(record(record(body).data).createProduct).id;
  if (typeof id !== 'string') throw new Error('Expected a created product ID');
  return id;
}

describe('actual gateway, subgraphs and PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createFederationFixture>>;
  let cleanup: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    fixture = await createFederationFixture();
    cleanup = fixture.close;
  });
  beforeEach(() => {
    fixture.coreRequests.length = 0;
    fixture.productRequests.length = 0;
  });
  afterAll(async () => {
    await cleanup?.();
  });

  async function query(
    source: string,
    variables: Record<string, unknown> = {},
    storeId?: string,
    requestId: string = randomUUID(),
    url = fixture.url,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
        ...(storeId === undefined ? {} : { 'x-store-id': storeId }),
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    expect(response.headers.get('x-request-id')).toBe(requestId);
    const body: unknown = await response.json();
    return body;
  }

  it('discovers both seeded stores through the gateway without selecting a store', async () => {
    expect(await query('{stores{id name}}')).toEqual({
      data: {
        stores: [
          { id: plovdiv, name: 'holita Plovdiv' },
          { id: sofia, name: 'holita Sofia' },
        ],
      },
    });
    expect(fixture.productRequests).toHaveLength(0);
    expect(fixture.coreRequests).toHaveLength(1);
  });

  it('allows the configured admin origin and context headers through browser CORS', async () => {
    const response = await fetch(fixture.url, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:11081',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,x-store-id,x-request-id',
      },
      signal: AbortSignal.timeout(5000),
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:11081');
    expect(response.headers.get('access-control-allow-headers')).toContain('x-store-id');
    expect(response.headers.get('access-control-allow-headers')).toContain('x-request-id');
    expect(fixture.coreRequests).toHaveLength(0);
    expect(fixture.productRequests).toHaveLength(0);
  });

  it('rejects oversized baggage before forwarding to either subgraph', async () => {
    const response = await fetch(fixture.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', baggage: `key=${'x'.repeat(20 * 1024)}` },
      body: JSON.stringify({ query: '{ stores { id } }' }),
      signal: AbortSignal.timeout(5000),
    });
    await response.text();
    expect(response.status).toBe(431);
    expect(fixture.coreRequests).toHaveLength(0);
    expect(fixture.productRequests).toHaveLength(0);
  });

  it('creates products and resolves their real Store through federation', async () => {
    const sku = randomUUID();
    const id = createdId(
      await query(create, { input: { name: '  Federated notebook  ', sku } }, sofia),
    );
    fixture.coreRequests.length = 0;
    expect(
      await query(
        'query($id:ID!){product(id:$id){id name store{id name}}}',
        { id },
        sofia,
        'federated-request',
      ),
    ).toEqual({
      data: {
        product: { id, name: 'Federated notebook', store: { id: sofia, name: 'holita Sofia' } },
      },
    });
    expect(fixture.coreRequests).toHaveLength(1);
    expect(fixture.coreRequests[0]).toMatchObject({
      requestId: 'federated-request',
      storeId: sofia,
    });
    expect(fixture.coreRequests[0]?.body).toContain('_entities');
    expect(
      await query(create, { input: { name: 'Same SKU elsewhere', sku } }, plovdiv),
    ).toMatchObject({ data: { createProduct: { sku, storeId: plovdiv } } });
    expect(await query(create, { input: { name: 'Duplicate', sku } }, sofia)).toMatchObject({
      errors: [{ extensions: { code: 'CONFLICT' } }],
    });
  });

  it('enforces store scoping on reads and writes at the public endpoint', async () => {
    const id = createdId(
      await query(create, { input: { name: 'Scoped product', sku: randomUUID() } }, sofia),
    );
    fixture.coreRequests.length = 0;
    for (const source of [product, update, remove])
      expect(await query(source, { id, input: { name: 'Foreign edit' } }, plovdiv)).toMatchObject({
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    expect(
      await query(update, { id, input: { name: 'Owner edit', status: 'ACTIVE' } }, sofia),
    ).toMatchObject({ data: { updateProduct: { name: 'Owner edit', status: 'ACTIVE' } } });
    expect(await query(remove, { id }, sofia)).toEqual({
      data: { deleteProduct: { id, storeId: sofia } },
    });
    expect(await query(product, { id }, sofia)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(fixture.coreRequests).toHaveLength(0);
  });

  it('keeps unknown store semantics and rejects missing or malformed context', async () => {
    const unknown = randomUUID();
    expect(await query(list, {}, unknown)).toEqual({ data: { products: { items: [], total: 0 } } });
    expect(fixture.coreRequests).toHaveLength(0);
    for (const store of [undefined, 'invalid'])
      expect(await query(list, {}, store)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
    expect(
      await query(create, { input: { name: 'No store', sku: randomUUID() } }, unknown),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    expect(await query(list, {}, unknown)).toEqual({ data: { products: { items: [], total: 0 } } });
    expect(fixture.coreRequests).toHaveLength(1);
  });

  it('keeps concurrent request/store headers separate without validating stores in the gateway', async () => {
    await Promise.all(
      [sofia, plovdiv].map(async (storeId, index) => {
        const requestId = `concurrent-${String(index)}`;
        const result = record(record(await query(list, {}, storeId, requestId)).data);
        const items: unknown = record(result.products).items;
        if (!Array.isArray(items)) throw new Error('Expected product list');
        expect(items.length).toBeGreaterThan(0);
        expect(items.every((item: unknown) => record(item).storeId === storeId)).toBe(true);
        expect(fixture.productRequests).toContainEqual(
          expect.objectContaining({ requestId, storeId }),
        );
      }),
    );
    expect(fixture.coreRequests).toHaveLength(0);
  });

  it('reuses store validation for multiple creates in one products request', async () => {
    const sku = randomUUID();
    const source = `mutation($a:CreateProductInput!,$b:CreateProductInput!){a:createProduct(input:$a){id}b:createProduct(input:$b){id}}`;
    expect(
      await query(
        source,
        { a: { name: 'First', sku: `${sku}-1` }, b: { name: 'Second', sku: `${sku}-2` } },
        sofia,
        'create-batch',
        fixture.productsUrl,
      ),
    ).toMatchObject({ data: { a: { id: expect.any(String) }, b: { id: expect.any(String) } } });
    expect(fixture.coreRequests).toHaveLength(1);
    expect(fixture.coreRequests[0]).toMatchObject({ requestId: 'create-batch' });
  });

  it('keeps product-only CRUD independent of core and fails creation/federated Store without writing', async () => {
    const id = createdId(
      await query(create, { input: { name: 'Before outage', sku: randomUUID() } }, sofia),
    );
    await fixture.stopCore();
    try {
      fixture.coreRequests.length = 0;
      expect(await query(product, { id }, sofia)).toMatchObject({ data: { product: { id } } });
      expect(
        await query(update, { id, input: { name: 'Edited during outage' } }, sofia),
      ).toMatchObject({ data: { updateProduct: { name: 'Edited during outage' } } });
      const before = await query(list, {}, sofia);
      expect(fixture.coreRequests).toHaveLength(0);
      expect(
        await query(create, { input: { name: 'Must not persist', sku: randomUUID() } }, sofia),
      ).toMatchObject({ errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }] });
      expect(await query(list, {}, sofia)).toEqual(before);
      expect(
        await query('query($id:ID!){product(id:$id){store{name}}}', { id }, sofia),
      ).toMatchObject({ errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }] });
      expect(await query(remove, { id }, sofia)).toEqual({
        data: { deleteProduct: { id, storeId: sofia } },
      });
    } finally {
      await fixture.restartCore();
    }
  });
});
