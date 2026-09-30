import { describe, expect, it } from 'vitest';
import { ListStoresDocument } from '../generated/graphql/operations.js';

import type {
  CreateProductInput,
  ProductDetailsFragment,
} from '../generated/graphql/operations.js';
import {
  deferredResponse,
  mockGraphQL,
  product,
  venue,
  event,
  session,
  result,
  storeA,
  storeB,
  stores,
} from '../test/graphql-fixture.js';
import {
  createDataProvider,
  productsResource,
  venuesResource,
  eventsResource,
  speakersResource,
  tagsResource,
  sessionsResource,
  mediaResource,
} from './data-provider.js';

const url = 'http://127.0.0.1:11080/graphql';

describe('Refine GraphQL mapping', () => {
  it.each([
    ['name', 'NAME'],
    ['sku', 'SKU'],
    ['status', 'STATUS'],
  ])(
    'maps Product %s sorting with filters, pagination and captured store context',
    async (field, apiField) => {
      const transport = mockGraphQL(() =>
        result({ products: { items: [], total: 0, offset: 10, limit: 10 } }),
      );
      const provider = createDataProvider(url);
      for (const order of ['asc', 'desc'] as const) {
        await provider.getList({
          resource: productsResource(storeA),
          pagination: { currentPage: 2, pageSize: 10 },
          sorters: [{ field, order }],
          filters: [
            { field: 'search', operator: 'contains', value: 'Note' },
            { field: 'sku', operator: 'contains', value: 'SKU_%' },
            { field: 'status', operator: 'eq', value: 'ACTIVE' },
          ],
        });
        expect(transport.calls.at(-1)).toMatchObject({
          storeId: storeA,
          variables: {
            offset: 10,
            limit: 10,
            search: 'Note',
            sku: 'SKU_%',
            status: 'ACTIVE',
            sort: { field: apiField, direction: order === 'asc' ? 'ASC' : 'DESC' },
          },
        });
      }
    },
  );
  it('maps Venue CRUD and pagination through the same scoped provider', async () => {
    const row = venue();
    const transport = mockGraphQL((call) => {
      switch (call.operation) {
        case 'ListReferenceVenues':
          return result({ referenceVenues: { items: [row], total: 21, offset: 20, limit: 10 } });
        case 'GetReferenceVenue':
          return result({ referenceVenue: row });
        case 'CreateReferenceVenue':
          return result({ createReferenceVenue: row });
        case 'UpdateReferenceVenue':
          return result({ updateReferenceVenue: row });
        case 'DeleteReferenceVenue':
          return result({ deleteReferenceVenue: row });
        default:
          throw new Error('Unexpected operation');
      }
    });
    const provider = createDataProvider(url);
    const resource = venuesResource(storeA);
    expect(
      await provider.getList({ resource, pagination: { currentPage: 3, pageSize: 10 } }),
    ).toEqual({ data: [row], total: 21 });
    expect((await provider.getOne({ resource, id: row.id })).data).toEqual(row);
    const variables = {
      name: row.name,
      city: row.city,
      countryCode: row.countryCode,
      active: false,
    };
    expect((await provider.create({ resource, variables })).data).toEqual(row);
    await provider.update({ resource, id: row.id, variables: { address: null } });
    await provider.deleteOne({ resource, id: row.id });
    expect(transport.calls.map((call) => call.variables)).toEqual([
      { offset: 20, limit: 10 },
      { id: row.id },
      { input: variables },
      { id: row.id, input: { address: null } },
      { id: row.id },
    ]);
    expect(transport.calls.every((call) => call.storeId === storeA)).toBe(true);
    await expect(provider.getList({ resource: venuesResource('invalid') })).rejects.toThrow(
      'Select a valid store',
    );
    expect(transport.calls).toHaveLength(5);
  });

  it('maps Venue filters and sortable columns while retaining scoped lookup IDs', async () => {
    const row = venue();
    const transport = mockGraphQL(() => result({ referenceVenues: { items: [row], total: 1 } }));
    const provider = createDataProvider(url);
    for (const [field, apiField] of Object.entries({
      name: 'NAME',
      city: 'CITY',
      countryCode: 'COUNTRY_CODE',
      capacity: 'CAPACITY',
      active: 'ACTIVE',
    })) {
      for (const order of ['asc', 'desc'] as const) {
        await provider.getList({
          resource: venuesResource(storeA),
          pagination: { currentPage: 2, pageSize: 10 },
          filters: [
            { field: 'search', operator: 'contains', value: 'Hall' },
            { field: 'active', operator: 'eq', value: false },
            { field: 'ids', operator: 'in', value: [row.id] },
          ],
          sorters: [{ field, order }],
        });
        expect(transport.calls.at(-1)).toMatchObject({
          storeId: storeA,
          variables: {
            offset: 10,
            limit: 10,
            search: 'Hall',
            active: false,
            ids: [row.id],
            sort: { field: apiField, direction: order.toUpperCase() },
          },
        });
      }
    }
  });
  it.each(['Speaker', 'Tag'])(
    'maps %s sorting with combined scoped lookup filters',
    async (entity) => {
      const row = venue();
      const transport = mockGraphQL(() =>
        result({ [`reference${entity}s`]: { items: [row], total: 1 } }),
      );
      const provider = createDataProvider(url);
      for (const field of ['name', 'active', entity === 'Speaker' ? 'email' : 'color']) {
        for (const order of ['asc', 'desc'] as const) {
          await provider.getList({
            resource: `stores/${storeA}/reference/${entity.toLowerCase()}s`,
            pagination: { currentPage: 2, pageSize: 10 },
            filters: [
              { field: 'search', operator: 'contains', value: 'Lookup' },
              { field: 'active', operator: 'eq', value: false },
              { field: 'ids', operator: 'in', value: [row.id] },
            ],
            sorters: [{ field, order }],
          });
          expect(transport.calls.at(-1)).toMatchObject({
            storeId: storeA,
            variables: {
              offset: 10,
              limit: 10,
              search: 'Lookup',
              active: false,
              ids: [row.id],
              sort: { field: field.toUpperCase(), direction: order.toUpperCase() },
            },
          });
        }
      }
    },
  );
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

describe('Reference contracts in the provider', () => {
  it('maps Events, Speakers and Tags with exact mutation values and bounded selected-ID filters', async () => {
    const row = event();
    const transport = mockGraphQL((call) => {
      const root = call.operation.slice(0, 1).toLowerCase() + call.operation.slice(1);
      if (call.operation.startsWith('List'))
        return result({
          [call.operation.replace('ListReference', 'reference')]: { items: [row], total: 1 },
        });
      if (call.operation.startsWith('Get'))
        return result({ [call.operation.replace('GetReference', 'reference')]: row });
      return result({ [root]: row });
    });
    const provider = createDataProvider(url);
    for (const resource of [
      eventsResource(storeA),
      speakersResource(storeA),
      tagsResource(storeA),
    ]) {
      expect((await provider.getList({ resource })).data).toEqual([row]);
      expect((await provider.getOne({ resource, id: row.id })).data).toEqual(row);
      expect(
        (
          await provider.create({
            resource,
            variables: { title: 'Exact', budget: '9999999999.99' },
          })
        ).data,
      ).toEqual(row);
      await provider.update({ resource, id: row.id, variables: { budget: null } });
      await provider.deleteOne({ resource, id: row.id });
    }
    await provider.getList({
      resource: venuesResource(storeA),
      pagination: { currentPage: 2, pageSize: 20 },
      filters: [
        { field: 'search', operator: 'contains', value: 'hall' },
        { field: 'active', operator: 'eq', value: true },
      ],
    });
    expect(transport.calls.at(-1)?.variables).toEqual({
      offset: 20,
      limit: 20,
      search: 'hall',
      active: true,
    });
    await provider.getList({
      resource: tagsResource(storeA),
      pagination: { pageSize: 100 },
      filters: [{ field: 'ids', operator: 'in', value: [row.id] }],
    });
    expect(transport.calls.at(-1)?.variables).toEqual({ offset: 0, limit: 100, ids: [row.id] });
    expect(
      transport.calls.find((call) => call.operation === 'CreateReferenceEvent')?.variables,
    ).toEqual({ input: { title: 'Exact', budget: '9999999999.99' } });
    expect(transport.calls.every((call) => call.storeId === storeA)).toBe(true);
  });
  it('retains only safe public field errors alongside the request ID', async () => {
    const transport = mockGraphQL(() =>
      Response.json({
        errors: [
          {
            message: 'Code already exists.',
            extensions: {
              fieldErrors: [
                { path: 'code', message: 'Choose another code.', private: 'hidden' },
                { path: '../secret', message: 'hidden' },
                { path: 'name', message: 42 },
              ],
              stack: 'hidden',
            },
          },
        ],
      }),
    );
    const request = createDataProvider(url).create({
      resource: eventsResource(storeA),
      variables: {},
    });
    await expect(request).rejects.toHaveProperty('requestId');
    await expect(request).rejects.toMatchObject({
      message: 'Code already exists.',
      requestId: transport.calls[0]?.requestId,
      fieldErrors: [{ path: 'code', message: 'Choose another code.' }],
    });
  });
});

it('scopes Session CRUD and explicit reorder to the resource parent and captures concurrent store headers', async () => {
  const row = session();
  const transport = mockGraphQL((call) => {
    if (call.operation === 'ListReferenceSessions') return result({ referenceSessions: [row] });
    if (call.operation === 'GetReferenceSession') return result({ referenceSession: row });
    if (call.operation === 'ReorderReferenceSessions')
      return result({ reorderReferenceSessions: [row] });
    return result({ [call.operation.charAt(0).toLowerCase() + call.operation.slice(1)]: row });
  });
  const provider = createDataProvider(url),
    resource = sessionsResource(storeA, row.eventId);
  expect(await provider.getList({ resource })).toEqual({ data: [row], total: 1 });
  await provider.getOne({ resource, id: row.id });
  await provider.create({ resource, variables: { title: 'Session' } });
  await provider.update({ resource, id: row.id, variables: { summary: null } });
  await provider.deleteOne({ resource, id: row.id });
  if (!provider.custom) throw new Error('Missing reorder provider');
  expect(
    await provider.custom({
      url: resource,
      method: 'post',
      payload: { ids: [row.id], eventId: 'untrusted-parent' },
      meta: { gqlMutation: ListStoresDocument },
    }),
  ).toEqual({ data: { items: [row] } });
  expect(transport.calls.map((call) => call.variables)).toEqual([
    { eventId: row.eventId },
    { eventId: row.eventId, id: row.id },
    { eventId: row.eventId, input: { title: 'Session' } },
    { eventId: row.eventId, id: row.id, input: { summary: null } },
    { eventId: row.eventId, id: row.id },
    { eventId: row.eventId, ids: [row.id] },
  ]);
  expect(transport.calls.every((call) => call.storeId === storeA)).toBe(true);
  await Promise.all(
    [storeA, storeB].map((store) =>
      provider.getList({ resource: sessionsResource(store, row.eventId) }),
    ),
  );
  expect(transport.calls.slice(-2).map((call) => call.storeId)).toEqual([storeA, storeB]);
  await expect(provider.getList({ resource: sessionsResource(storeA, 'invalid') })).rejects.toThrow(
    'Select a valid store',
  );
  expect(transport.calls).toHaveLength(8);
});

describe('Gallery provider', () => {
  it('captures store and event for gallery metadata and only sends intent/finalize JSON through GraphQL', async () => {
    const transport = mockGraphQL((call) => {
      if (call.operation === 'ListReferenceEventMedia') return result({ referenceEventMedia: [] });
      if (call.operation === 'CreateReferenceUploadIntent')
        return result({
          createReferenceUploadIntent: {
            uploadId: 'upload',
            fileKey: 'key',
            uploadUrl: 'https://storage.example/upload',
            method: 'PUT',
            headers: [],
            expiresAt: '2026-11-01T10:00:00Z',
          },
        });
      if (call.operation === 'FinalizeReferenceUpload')
        return result({ finalizeReferenceUpload: { id: 'image' } });
      if (call.operation === 'SetReferenceEventCover')
        return result({ setReferenceEventCover: [] });
      if (call.operation === 'ReorderReferenceEventMedia')
        return result({ reorderReferenceEventMedia: [] });
      if (call.operation === 'UpdateReferenceEventMedia')
        return result({ updateReferenceEventMedia: { id: 'image', altText: 'Hall' } });
      return result({ deleteReferenceEventMedia: 'image' });
    });
    const provider = createDataProvider(url),
      resource = mediaResource(storeA, event().id);
    expect(await provider.getList({ resource })).toEqual({ data: [], total: 0 });
    if (!provider.custom) throw new Error('Missing custom provider');
    const input = { originalName: 'photo.png', contentType: 'image/png', byteSize: 123 };
    await provider.custom({ url: resource, method: 'post', payload: { action: 'intent', input } });
    await provider.custom({
      url: resource,
      method: 'post',
      payload: { action: 'finalize', uploadId: 'upload' },
    });
    await provider.custom({
      url: resource,
      method: 'post',
      payload: { action: 'cover', id: 'image' },
    });
    await provider.custom({
      url: resource,
      method: 'post',
      payload: { action: 'reorder', ids: ['image'] },
    });
    await provider.update({ resource, id: 'image', variables: { altText: 'Hall' } });
    await provider.deleteOne({ resource, id: 'image' });
    expect(transport.calls.map((call) => call.variables)).toEqual([
      { eventId: event().id },
      { eventId: event().id, input },
      { uploadId: 'upload' },
      { eventId: event().id, id: 'image' },
      { eventId: event().id, ids: ['image'] },
      { eventId: event().id, id: 'image', input: { altText: 'Hall' } },
      { eventId: event().id, id: 'image' },
    ]);
    expect(transport.calls.every((call) => call.storeId === storeA)).toBe(true);
    await expect(
      provider.custom({
        url: mediaResource('invalid', event().id),
        method: 'post',
        payload: { action: 'cover', id: 'image' },
      }),
    ).rejects.toThrow('Select a valid store');
    expect(() =>
      provider.custom?.({
        url: resource,
        method: 'post',
        payload: { action: 'intent', input: new Blob() },
      }),
    ).toThrow('valid gallery action');
    expect(transport.calls).toHaveLength(7);
  });
});

describe('Event lifecycle mapping', () => {
  it('keeps Trash, history and bulk requests scoped to their captured store', async () => {
    const row = event();
    const transport = mockGraphQL((call) => {
      switch (call.operation) {
        case 'GetReferenceEvent':
          return result({ referenceEvent: row });
        case 'ListReferenceEventHistory':
          return result({ referenceEventHistory: { items: [], total: 22, offset: 20, limit: 20 } });
        case 'SetReferenceEventsStatus':
          return result({ setReferenceEventsStatus: { ids: [row.id], count: 1 } });
        case 'TrashReferenceEvents':
          return result({ trashReferenceEvents: { ids: [row.id], count: 1 } });
        case 'RestoreReferenceEvents':
          return result({ restoreReferenceEvents: { ids: [row.id], count: 1 } });
        default:
          throw new Error('Unexpected operation');
      }
    });
    const provider = createDataProvider(url),
      resource = eventsResource(storeA);
    await provider.getOne({ resource, id: row.id, meta: { includeDeleted: true } });
    expect(
      await provider.getList({
        resource: `${resource}/${row.id}/history`,
        pagination: { currentPage: 2, pageSize: 20 },
      }),
    ).toEqual({ data: [], total: 22 });
    for (const action of ['status', 'trash', 'restore']) {
      expect(
        await provider.custom?.({
          url: resource,
          method: 'post',
          payload: {
            action,
            ids: [row.id],
            ...(action === 'status' ? { status: 'PUBLISHED' } : {}),
          },
        }),
      ).toEqual({ data: { ids: [row.id], count: 1 } });
    }
    expect(transport.calls.map((call) => call.variables)).toEqual([
      { id: row.id, includeDeleted: true },
      { eventId: row.id, offset: 20, limit: 20 },
      { ids: [row.id], status: 'PUBLISHED' },
      { ids: [row.id] },
      { ids: [row.id] },
    ]);
    expect(transport.calls.every((call) => call.storeId === storeA)).toBe(true);
  });
});
