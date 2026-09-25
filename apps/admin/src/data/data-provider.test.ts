import { describe, expect, it } from 'vitest';

import type {
  CreateProductInput,
  ProductDetailsFragment,
} from '../generated/graphql/operations.js';
import {
  deferredResponse,
  mockGraphQL,
  product,
  result,
  storeA,
  storeB,
  stores,
} from '../test/graphql-fixture.js';
import { createDataProvider, productsResource } from './data-provider.js';

const url = 'http://127.0.0.1:11080/graphql';

describe('Refine GraphQL mapping', () => {
  it('lists stores without context and maps bounded product pagination', async () => {
    const transport = mockGraphQL((call) =>
      call.operation === 'ListStores'
        ? result({ stores })
        : result({ products: { items: [product()], total: 25, offset: 20, limit: 10 } }),
    );
    const provider = createDataProvider(url);
    expect((await provider.getList({ resource: 'stores' })).total).toBe(2);
    expect(transport.calls[0]?.storeId).toBeNull();
    const products = await provider.getList<ProductDetailsFragment>({
      resource: productsResource(storeA),
      pagination: { currentPage: 3, pageSize: 10 },
    });
    expect(products).toEqual({ data: [product()], total: 25 });
    expect(transport.calls[1]).toMatchObject({
      operation: 'ListProducts',
      storeId: storeA,
      variables: { offset: 20, limit: 10 },
    });
    expect(transport.calls[1]?.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('maps product search and status filters without changing pagination', async () => {
    const transport = mockGraphQL(() =>
      result({ products: { items: [], total: 0, offset: 10, limit: 10 } }),
    );
    const provider = createDataProvider(url);
    await provider.getList({
      resource: productsResource(storeA),
      pagination: { currentPage: 2, pageSize: 10 },
      filters: [
        { field: 'search', operator: 'contains', value: '  notebook  ' },
        { field: 'status', operator: 'eq', value: 'ACTIVE' },
      ],
    });
    await provider.getList({
      resource: productsResource(storeA),
      filters: [
        { field: 'search', operator: 'contains', value: '   ' },
        { field: 'status', operator: 'eq', value: 'ALL' },
      ],
    });
    expect(transport.calls.map((call) => call.variables)).toEqual([
      { offset: 10, limit: 10, search: 'notebook', status: 'ACTIVE' },
      { offset: 0, limit: 20 },
    ]);
  });

  it('captures separate headers for concurrent identical operations in different stores', async () => {
    const delayed = deferredResponse();
    const transport = mockGraphQL((call) =>
      call.storeId === storeA
        ? delayed.promise
        : result({
            products: {
              items: [product(storeB, 'Plovdiv notebook')],
              total: 1,
              offset: 0,
              limit: 20,
            },
          }),
    );
    const provider = createDataProvider(url);
    const first = provider.getList({ resource: productsResource(storeA) });
    const second = await provider.getList({ resource: productsResource(storeB) });
    delayed.resolve(result({ products: { items: [product()], total: 1, offset: 0, limit: 20 } }));
    await expect(first).resolves.toMatchObject({ data: [product()] });
    expect(second.data).toEqual([product(storeB, 'Plovdiv notebook')]);
    expect(transport.calls.map((call) => call.storeId)).toEqual([storeA, storeB]);
    expect(new Set(transport.calls.map((call) => call.requestId)).size).toBe(2);
  });

  it('uses generated CRUD operations with schema-shaped variables', async () => {
    const row = product();
    const transport = mockGraphQL((call) => {
      switch (call.operation) {
        case 'GetProduct':
          return result({ product: { ...row, store: stores[0] } });
        case 'CreateProduct':
          return result({ createProduct: row });
        case 'UpdateProduct':
          return result({ updateProduct: row });
        case 'DeleteProduct':
          return result({ deleteProduct: { id: row.id, storeId: row.storeId } });
        default:
          throw new Error('Unexpected operation.');
      }
    });
    const provider = createDataProvider(url);
    const resource = productsResource(storeA);
    const variables: CreateProductInput = { name: row.name, sku: row.sku, status: row.status };
    await provider.getOne({ resource, id: row.id });
    await provider.create({ resource, variables });
    await provider.update({ resource, id: row.id, variables });
    await provider.deleteOne({ resource, id: row.id });
    expect(transport.calls.map((call) => call.variables)).toEqual([
      { id: row.id },
      { input: variables },
      { id: row.id, input: variables },
      { id: row.id },
    ]);
    expect(transport.calls.every((call) => call.storeId === storeA)).toBe(true);
  });

  it('rejects missing or malformed product scope before fetching', async () => {
    const transport = mockGraphQL(() => result({}));
    const provider = createDataProvider(url);
    await expect(provider.getList({ resource: 'products' })).rejects.toThrow(
      'Select a valid store',
    );
    await expect(provider.getList({ resource: productsResource('bad') })).rejects.toThrow(
      'Select a valid store',
    );
    expect(transport.fetch).not.toHaveBeenCalled();
  });

  it('surfaces GraphQL failures on HTTP 200 and hides raw network diagnostics', async () => {
    const transport = mockGraphQL(() =>
      Response.json({
        errors: [
          { message: 'SKU already exists in this store.', extensions: { code: 'CONFLICT' } },
        ],
      }),
    );
    const provider = createDataProvider(url);
    await expect(provider.getList({ resource: productsResource(storeA) })).rejects.toMatchObject({
      message: 'SKU already exists in this store.',
    });
    transport.fetch.mockRejectedValueOnce(new Error('private-network-sentinel'));
    await expect(provider.getList({ resource: productsResource(storeA) })).rejects.toMatchObject({
      message: 'Could not reach the gateway. Please try again.',
    });
  });
});
