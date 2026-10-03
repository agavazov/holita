import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import {
  createDataProvider,
  productsResource,
  venuesResource,
  speakersResource,
  tagsResource,
} from '../data/data-provider.js';
import type {
  ReferenceTagDetailsFragment,
  ProductDetailsFragment,
  ReferenceVenueDetailsFragment,
  ReferenceSpeakerDetailsFragment,
} from '../generated/graphql/operations.js';
import { graphqlEndpoint, readDataSource } from '../config.js';
import { createPrototypeHandlers } from './handlers.js';
import { prototypeStores } from './fixtures.js';
import { createPrototypeState, prototypeStorageKey } from './state.js';

class MemoryStorage {
  private values = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('Storage full');
    this.values.set(key, value);
  }
}

const endpoint = 'http://127.0.0.1/__prototype/graphql';
const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const server = setupServer();
let storage: MemoryStorage;
let state: ReturnType<typeof createPrototypeState>;
const provider = createDataProvider(endpoint);

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterAll(() => {
  server.close();
});
beforeEach(() => {
  storage = new MemoryStorage();
  state = createPrototypeState(storage);
  server.resetHandlers(...createPrototypeHandlers(endpoint, state));
});

describe('Prototype through the real Refine GraphQL provider', () => {
  it('discovers stores and persists normalized CRUD across a fresh state instance', async () => {
    expect((await provider.getList({ resource: 'stores' })).data).toEqual(
      [...prototypeStores].sort((a, b) => a.name.localeCompare(b.name)),
    );
    const resource = tagsResource(storeA);
    const created = (
      await provider.create<ReferenceTagDetailsFragment>({
        resource,
        variables: { name: '  New workshop  ', color: ' #ABCDEF ' },
      })
    ).data;
    expect(created).toMatchObject({
      storeId: storeA,
      name: 'New workshop',
      color: '#abcdef',
      active: true,
    });
    const updated = (
      await provider.update({ resource, id: created.id, variables: { active: false } })
    ).data;
    server.resetHandlers(...createPrototypeHandlers(endpoint, createPrototypeState(storage)));
    expect((await provider.getOne({ resource, id: created.id })).data).toEqual(updated);
    await provider.deleteOne({ resource, id: created.id });
    await expect(provider.getOne({ resource, id: created.id })).rejects.toThrow('Tag not found');
  });

  it('applies filters and sorting before pagination and retains the full filtered count', async () => {
    const resource = tagsResource(storeA);
    const all = await provider.getList<ReferenceTagDetailsFragment>({
      resource,
      pagination: { pageSize: 100 },
      sorters: [{ field: 'name', order: 'asc' }],
      filters: [{ field: 'active', operator: 'eq', value: true }],
    });
    const page = await provider.getList({
      resource,
      pagination: { currentPage: 2, pageSize: 5 },
      sorters: [{ field: 'name', order: 'asc' }],
      filters: [{ field: 'active', operator: 'eq', value: true }],
    });
    expect(all.total).toBeGreaterThan(10);
    expect(page).toEqual({ data: all.data.slice(5, 10), total: all.total });
    expect(all.data.every((tag) => tag.active)).toBe(true);
    expect(all.data.map((tag) => tag.name)).toEqual(
      all.data.map((tag) => tag.name).sort((a, b) => a.localeCompare(b)),
    );
    await provider.create({ resource, variables: { name: 'Literal_%', color: '#315ed0' } });
    expect(
      (
        await provider.getList({
          resource,
          filters: [{ field: 'search', operator: 'contains', value: '_%' }],
        })
      ).total,
    ).toBe(1);
    const first = all.data[0];
    if (!first) throw new Error('Expected active fixture tags.');
    expect(state.listTags(storeA, { offset: 0, limit: 20, ids: first.id }).items).toEqual([first]);
  });

  it('keeps records, concurrent mutations and uniqueness scoped to the captured store', async () => {
    const [a, b] = await Promise.all(
      [storeA, storeB].map((storeId) =>
        provider.create<ReferenceTagDetailsFragment>({
          resource: tagsResource(storeId),
          variables: { name: 'Shared name', color: '#315ed0' },
        }),
      ),
    );
    if (!a || !b) throw new Error('Expected two successful creates.');
    expect(a.data.storeId).toBe(storeA);
    expect(b.data.storeId).toBe(storeB);
    await expect(
      provider.create({
        resource: tagsResource(storeA),
        variables: { name: 'Shared name', color: '#315ed0' },
      }),
    ).rejects.toMatchObject({
      fieldErrors: [{ path: 'name', message: 'Name is already used in this store.' }],
    });
    for (const operation of [
      () => provider.getOne({ resource: tagsResource(storeB), id: a.data.id }),
      () =>
        provider.update({
          resource: tagsResource(storeB),
          id: a.data.id,
          variables: { name: 'Wrong store' },
        }),
      () => provider.deleteOne({ resource: tagsResource(storeB), id: a.data.id }),
    ])
      await expect(operation()).rejects.toThrow('Tag not found');
    expect((await provider.getOne({ resource: tagsResource(storeA), id: a.data.id })).data).toEqual(
      a.data,
    );
    const missingStore = tagsResource('10000000-0000-4000-8000-000000000099');
    expect((await provider.getList({ resource: missingStore })).total).toBe(0);
    await expect(
      provider.create({ resource: missingStore, variables: { name: 'Missing', color: '#315ed0' } }),
    ).rejects.toThrow('Store not found');
  });

  it('validates Tag search length before Unicode case folding and uses shared lookup errors', async () => {
    const resource = tagsResource(storeA);
    const response = await provider.getList({
      resource,
      filters: [{ field: 'search', operator: 'contains', value: 'İ'.repeat(200) }],
    });
    expect(response).toEqual({ data: [], total: 0 });
    expect(() => state.listTags(storeA, { offset: 0, limit: 20, search: 'İ'.repeat(201) })).toThrow(
      'Use 1 to 200 supported characters.',
    );
    const tag = state.listTags(storeA, { offset: 0, limit: 1 }).items[0];
    if (!tag) throw new Error('Expected a Tag fixture.');
    expect(() => state.listTags(storeA, { offset: 0, limit: 20, ids: [tag.id, tag.id] })).toThrow(
      'Do not repeat record IDs.',
    );
  });

  it('rejects invalid partial updates and referenced deletion without changing persisted data', async () => {
    const id = state.listEvents(storeA, { offset: 0, limit: 1 }).items[0]?.tagIds[0];
    if (!id) throw new Error('Expected a referenced fixture tag.');
    const original = storage.getItem(prototypeStorageKey);
    await expect(
      provider.update({ resource: tagsResource(storeA), id, variables: { name: null } }),
    ).rejects.toMatchObject({
      fieldErrors: [{ path: 'name', message: 'Use 1 to 100 supported characters.' }],
    });
    await expect(
      provider.update({ resource: tagsResource(storeA), id, variables: {} }),
    ).rejects.toThrow('Provide at least one tag field');
    await expect(provider.deleteOne({ resource: tagsResource(storeA), id })).rejects.toThrow(
      'still referenced',
    );
    expect(storage.getItem(prototypeStorageKey)).toBe(original);
  });

  it('reports failed storage writes and leaves previous data intact', async () => {
    const previous = storage.getItem(prototypeStorageKey);
    storage.failWrites = true;
    await expect(
      provider.create({
        resource: tagsResource(storeA),
        variables: { name: 'Unsaved tag', color: '#315ed0' },
      }),
    ).rejects.toThrow('could not be saved');
    expect(() => {
      state.reset();
    }).toThrow('could not be saved');
    expect(storage.getItem(prototypeStorageKey)).toBe(previous);
    expect(state.listTags(storeA, { offset: 0, limit: 20, search: 'Unsaved tag' }).total).toBe(0);
  });

  it('resets saved changes for both stores to the versioned fixtures', () => {
    const original = [storeA, storeB].map((id) => state.listTags(id, { offset: 0, limit: 100 }));
    state.createTag(storeA, { name: 'Added', color: '#315ed0' });
    const first = state.listTags(storeB, { offset: 0, limit: 20 }).items[0];
    if (!first) throw new Error('Expected Plovdiv fixture tags.');
    state.updateTag(storeB, first.id, { name: 'Edited' });
    state.reset();
    expect(
      [storeA, storeB].map((id) =>
        createPrototypeState(storage).listTags(id, { offset: 0, limit: 100 }),
      ),
    ).toEqual(original);
  });

  it.each(['invalid JSON', '{"version":0,"tags":[]}', '{"version":1,"tags":[{}]}'])(
    'replaces invalid or obsolete browser data: %s',
    (raw) => {
      storage.setItem(prototypeStorageKey, raw);
      expect(createPrototypeState(storage).listTags(storeA, { offset: 0, limit: 20 }).total).toBe(
        24,
      );
    },
  );

  it('refuses missing store context and operations that lack a mock', async () => {
    const result = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'query ListReferenceTags { referenceTags { total items { id } } }',
      }),
    });
    expect(await result.json()).toMatchObject({ errors: [{ message: 'Use a valid UUID.' }] });
    const unsupported = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-store-id': storeA },
      body: JSON.stringify({
        query: 'query UnsupportedPrototypeResource { unsupportedPrototypeResource }',
      }),
    });
    expect(await unsupported.json()).toMatchObject({
      errors: [{ message: 'This operation is unavailable in Prototype.' }],
    });
  });

  it('selects a local mock endpoint independently of real gateway configuration', () => {
    expect(readDataSource(undefined)).toBe('graphql');
    expect(readDataSource('mock')).toBe('mock');
    expect(() => readDataSource('typo')).toThrow('mock or graphql');
    expect(graphqlEndpoint('mock', 'https://real.example/graphql')).toBe(
      `${window.location.origin}/__prototype/graphql`,
    );
    expect(graphqlEndpoint('graphql', 'https://real.example/graphql')).toBe(
      'https://real.example/graphql',
    );
  });

  const resources = [
    {
      label: 'Products',
      resource: productsResource,
      input: { name: '  New product  ', sku: '  NEW-SKU  ' },
      expected: { name: 'New product', sku: 'NEW-SKU', status: 'DRAFT' },
      update: { name: 'Updated product' },
      missing: 'Product not found',
    },
    {
      label: 'Venues',
      resource: venuesResource,
      input: {
        name: '  New venue  ',
        city: ' Sofia ',
        countryCode: ' bg ',
        description: '  ',
        capacity: 120,
      },
      expected: {
        name: 'New venue',
        city: 'Sofia',
        countryCode: 'BG',
        description: null,
        address: null,
        active: true,
        capacity: 120,
      },
      update: { name: 'Updated venue' },
      missing: 'Venue not found',
    },
    {
      label: 'Speakers',
      resource: speakersResource,
      input: { name: '  New speaker  ', email: ' person@example.com ', shortBio: '  ' },
      expected: { name: 'New speaker', email: 'person@example.com', shortBio: null, active: true },
      update: { name: 'Updated speaker' },
      missing: 'Speaker not found',
    },
  ];
  type Record =
    ProductDetailsFragment | ReferenceVenueDetailsFragment | ReferenceSpeakerDetailsFragment;

  it.each(resources)(
    '$label shares generated CRUD contracts, persistence and store scope',
    async ({ resource, input, expected, update, missing }) => {
      const first = (
        await provider.create<Record>({ resource: resource(storeA), variables: input })
      ).data;
      expect(first).toMatchObject({ ...expected, storeId: storeA });
      const second = (
        await provider.create<Record>({ resource: resource(storeB), variables: input })
      ).data;
      expect(second.storeId).toBe(storeB);
      await expect(
        provider.create({ resource: resource(storeA), variables: input }),
      ).rejects.toThrow('already');
      for (const call of [
        () => provider.getOne({ resource: resource(storeB), id: first.id }),
        () => provider.update({ resource: resource(storeB), id: first.id, variables: update }),
        () => provider.deleteOne({ resource: resource(storeB), id: first.id }),
      ])
        await expect(call()).rejects.toThrow(missing);
      const saved = (
        await provider.update<Record>({
          resource: resource(storeA),
          id: first.id,
          variables: update,
        })
      ).data;
      server.resetHandlers(...createPrototypeHandlers(endpoint, createPrototypeState(storage)));
      expect(
        (await provider.getOne({ resource: resource(storeA), id: first.id })).data,
      ).toMatchObject(saved);
      await provider.deleteOne({ resource: resource(storeA), id: first.id });
      await expect(provider.getOne({ resource: resource(storeA), id: first.id })).rejects.toThrow(
        missing,
      );
      expect(
        (await provider.getOne({ resource: resource(storeB), id: second.id })).data,
      ).toMatchObject(second);
    },
  );

  it('Products supports literal name/SKU filters, display-label sorting and case-sensitive uniqueness', async () => {
    const resource = productsResource(storeA);
    await provider.create({
      resource,
      variables: { name: 'Literal_%', sku: 'Mixed_%', status: 'ACTIVE' },
    });
    await provider.create({ resource, variables: { name: 'Different case', sku: 'mixed_%' } });
    const page = await provider.getList<ProductDetailsFragment>({
      resource,
      filters: [
        { field: 'search', operator: 'contains', value: '_%' },
        { field: 'sku', operator: 'contains', value: 'mixed' },
        { field: 'status', operator: 'eq', value: 'ACTIVE' },
      ],
    });
    expect(page.total).toBe(1);
    expect(page.data[0]?.name).toBe('Literal_%');
    const all = await provider.getList<ProductDetailsFragment>({
      resource,
      pagination: { pageSize: 100 },
      sorters: [{ field: 'status', order: 'asc' }],
    });
    expect(all.data[0]?.status).toBe('ACTIVE');
    expect(all.data.at(-1)?.status).toBe('DRAFT');
    const paged = await provider.getList({
      resource,
      pagination: { currentPage: 2, pageSize: 5 },
      sorters: [{ field: 'status', order: 'asc' }],
    });
    expect(paged).toEqual({ data: all.data.slice(5, 10), total: all.total });
    const id = all.data[0]?.id;
    if (!id) throw new Error('Expected Product fixture.');
    expect((await provider.getOne({ resource, id })).data).toMatchObject({
      store: { id: storeA, name: 'holita Sofia' },
    });
  });

  it.each([
    { label: 'Venues', resource: venuesResource, field: 'capacity' },
    { label: 'Speakers', resource: speakersResource, field: 'email' },
  ])(
    '$label sorts null values last in both directions before slicing pages',
    async ({ resource, field }) => {
      for (const order of ['asc', 'desc'] as const) {
        const all = await provider.getList<
          ReferenceVenueDetailsFragment | ReferenceSpeakerDetailsFragment
        >({
          resource: resource(storeA),
          pagination: { pageSize: 100 },
          sorters: [{ field, order }],
        });
        const values = all.data.map((row) => ('capacity' in row ? row.capacity : row.email));
        const firstNull = values.indexOf(null);
        expect(firstNull).toBeGreaterThan(0);
        expect(values.slice(firstNull).every((value) => value === null)).toBe(true);
        const paged = await provider.getList({
          resource: resource(storeA),
          pagination: { currentPage: 2, pageSize: 5 },
          sorters: [{ field, order }],
        });
        expect(paged).toEqual({ data: all.data.slice(5, 10), total: all.total });
      }
      const filtered = await provider.getList<
        ReferenceVenueDetailsFragment | ReferenceSpeakerDetailsFragment
      >({
        resource: resource(storeA),
        filters: [
          {
            field: 'search',
            operator: 'contains',
            value: field === 'email' ? 'Elena' : 'Conference',
          },
          { field: 'active', operator: 'eq', value: true },
        ],
      });
      expect(filtered.total).toBe(1);
      const row = filtered.data[0];
      if (!row) throw new Error('Expected filtered fixture.');
      const args = { offset: 0, limit: 20, ids: row.id };
      expect(
        field === 'email'
          ? state.listSpeakers(storeA, args).items
          : state.listVenues(storeA, args).items,
      ).toEqual([row]);
    },
  );

  it('optional lookup fields distinguish omitted updates from explicit null and reject invalid writes atomically', () => {
    const venue = state.createVenue(storeA, {
      name: 'Nullable venue',
      city: 'Sofia',
      countryCode: 'BG',
      description: 'Description',
      address: 'Address',
      capacity: 120,
    });
    state.updateVenue(storeA, venue.id, { active: false });
    expect(state.getVenue(storeA, venue.id)).toMatchObject({
      description: 'Description',
      address: 'Address',
      capacity: 120,
    });
    state.updateVenue(storeA, venue.id, { description: null, address: null, capacity: null });
    expect(state.getVenue(storeA, venue.id)).toMatchObject({
      description: null,
      address: null,
      capacity: null,
    });
    const speaker = state.createSpeaker(storeA, {
      name: 'Nullable speaker',
      email: 'person@example.com',
      shortBio: 'Biography',
    });
    state.updateSpeaker(storeA, speaker.id, { active: false });
    expect(state.getSpeaker(storeA, speaker.id)).toMatchObject({
      email: 'person@example.com',
      shortBio: 'Biography',
    });
    state.updateSpeaker(storeA, speaker.id, { email: null, shortBio: null });
    expect(state.getSpeaker(storeA, speaker.id)).toMatchObject({ email: null, shortBio: null });
    const before = storage.getItem(prototypeStorageKey);
    for (const call of [
      () => state.updateVenue(storeA, venue.id, { name: null }),
      () => state.updateVenue(storeA, venue.id, { countryCode: 'BGR' }),
      () => state.updateVenue(storeA, venue.id, { capacity: 0 }),
      () => state.updateSpeaker(storeA, speaker.id, { email: 'person@bad_domain.com' }),
      () => state.updateSpeaker(storeA, speaker.id, { active: null }),
      () => state.updateSpeaker(storeA, speaker.id, {}),
    ])
      expect(call).toThrow();
    expect(storage.getItem(prototypeStorageKey)).toBe(before);
  });

  it('preserves referenced lookup rows and successfully deleted rows across a fresh snapshot', async () => {
    const event = state.listEvents(storeA, { offset: 0, limit: 1 }).items[0];
    if (!event) throw new Error('Expected fixture event.');
    for (const { resource, id } of [
      { resource: venuesResource, id: event.venueId },
      { resource: speakersResource, id: state.listSessions(storeA, event.id)[0]?.speakerIds[0] },
    ]) {
      if (!id) throw new Error('Expected referenced fixture.');
      await expect(provider.deleteOne({ resource: resource(storeA), id })).rejects.toThrow(
        'still referenced',
      );
    }
    const first = state.listVenues(storeA, { offset: 0, limit: 20 }).items[0];
    if (!first) throw new Error('Expected deletable venue.');
    state.deleteVenue(storeA, first.id);
    const fresh = createPrototypeState(storage);
    expect(() => fresh.getVenue(storeA, first.id)).toThrow('Venue not found');
    expect(fresh.listVenues(storeA, { offset: 0, limit: 100 }).total).toBe(23);
  });

  it('resets every mock resource and rejects failed new-resource writes without losing other collections', () => {
    const original = storage.getItem(prototypeStorageKey);
    state.createProduct(storeA, { name: 'New product', sku: 'NEW' });
    state.createVenue(storeB, { name: 'New venue', city: 'Plovdiv', countryCode: 'BG' });
    state.createSpeaker(storeA, { name: 'New speaker' });
    state.createTag(storeB, { name: 'New tag', color: '#123456' });
    state.reset();
    expect(storage.getItem(prototypeStorageKey)).toBe(original);
    storage.failWrites = true;
    for (const call of [
      () => state.createProduct(storeA, { name: 'Unsaved', sku: 'UNSAVED' }),
      () => state.createVenue(storeA, { name: 'Unsaved', city: 'Sofia', countryCode: 'BG' }),
      () => state.createSpeaker(storeA, { name: 'Unsaved' }),
    ])
      expect(call).toThrow('could not be saved');
    expect(storage.getItem(prototypeStorageKey)).toBe(original);
  });

  it('replaces a corrupt current snapshot and a valid obsolete Tags-only snapshot', () => {
    state.createTag(storeA, { name: 'Older edit', color: '#123456' });
    const raw = storage.getItem(prototypeStorageKey);
    if (!raw) throw new Error('Expected saved snapshot.');
    storage.setItem(prototypeStorageKey, raw.replace('"capacity":null', '"capacity":-1'));
    expect(createPrototypeState(storage).listTags(storeA, { offset: 0, limit: 100 }).total).toBe(
      24,
    );
    storage.setItem(prototypeStorageKey, JSON.stringify({ version: 1, tags: [] }));
    expect(createPrototypeState(storage).listProducts(storeA, {}).total).toBe(24);
  });
});
