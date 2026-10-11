import { createPrototypeState, prototypeStorageKey, type PrototypeState } from './state';
import type { PrototypeSnapshot } from './snapshot';
import {
  initialEvents,
  initialSessions,
  initialHistory,
  initialProducts,
  initialVenues,
  initialSpeakers,
  initialTags,
} from './fixtures';
import { initialMedia } from './media-fixtures';
function initialSnapshot(): PrototypeSnapshot {
  return {
    version: 3,
    products: initialProducts(),
    venues: initialVenues(),
    speakers: initialSpeakers(),
    tags: initialTags(),
    vehicles: [],
    events: initialEvents(),
    sessions: initialSessions(initialEvents()),
    history: initialHistory(initialEvents()),
    media: initialMedia(initialEvents()),
  };
}

class MemoryStorage {
  private readonly values = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('Storage full');
    this.values.set(key, value);
  }
}
const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const page = { offset: 0, limit: 100 };
let storage: MemoryStorage;
let state: PrototypeState;
beforeEach(() => {
  storage = new MemoryStorage();
  state = createPrototypeState(storage);
});

describe('Angular Prototype basic persistence', () => {
  it('discovers stable stores and retains normalized CRUD after startup/reload', () => {
    expect(state.listStores().map((row) => row.name)).toEqual(['holita Plovdiv', 'holita Sofia']);
    const product = state.createProduct(storeA, {
      name: ' Notebook ',
      sku: ' NOTE ',
      status: 'ACTIVE',
    });
    const venue = state.createVenue(storeA, {
      name: ' Hall ',
      city: ' Sofia ',
      countryCode: 'bg',
      capacity: 42,
    });
    const speaker = state.createSpeaker(storeA, {
      name: ' Speaker ',
      email: ' speaker@example.com ',
    });
    const tag = state.createTag(storeA, { name: ' Label ', color: ' #ABCDEF ' });
    state.updateProduct(storeA, product.id, { name: 'Updated' });
    state.updateVenue(storeA, venue.id, { address: ' Street ', description: null });
    state.updateSpeaker(storeA, speaker.id, { shortBio: ' Biography ', email: null });
    state.updateTag(storeA, tag.id, { active: false });
    const reloaded = createPrototypeState(storage);
    expect(reloaded.getProduct(storeA, product.id)).toMatchObject({ name: 'Updated', sku: 'NOTE' });
    expect(reloaded.getVenue(storeA, venue.id)).toMatchObject({
      name: 'Hall',
      countryCode: 'BG',
      address: 'Street',
      description: null,
    });
    expect(reloaded.getSpeaker(storeA, speaker.id)).toMatchObject({
      name: 'Speaker',
      email: null,
      shortBio: 'Biography',
    });
    expect(reloaded.getTag(storeA, tag.id)).toMatchObject({
      name: 'Label',
      color: '#abcdef',
      active: false,
    });
    reloaded.deleteProduct(storeA, product.id);
    reloaded.deleteVenue(storeA, venue.id);
    reloaded.deleteSpeaker(storeA, speaker.id);
    reloaded.deleteTag(storeA, tag.id);
    expect(reloaded.listProducts(storeA, { search: 'Updated' }).total).toBe(0);
    expect(
      reloaded
        .listVenues(storeA, { ...page, search: 'Hall' })
        .items.some((row) => row.id === venue.id),
    ).toBe(false);
    expect(() => reloaded.getSpeaker(storeA, speaker.id)).toThrow('Speaker not found');
    expect(() => reloaded.getTag(storeA, tag.id)).toThrow('Tag not found');
  });

  it('applies filters and stable sorting before pagination, retaining total counts', () => {
    const all = state.listTags(storeA, {
      ...page,
      active: true,
      sort: { field: 'NAME', direction: 'ASC' },
    });
    const next = state.listTags(storeA, {
      offset: 5,
      limit: 5,
      active: true,
      sort: { field: 'NAME', direction: 'ASC' },
    });
    expect(next.items).toEqual(all.items.slice(5, 10));
    expect(next.total).toBe(all.total);
    state.createTag(storeA, { name: 'Literal_%', color: '#315ed0' });
    expect(state.listTags(storeA, { ...page, search: '_%' }).total).toBe(1);
    expect(
      state.listProducts(storeA, { search: 'linen', sku: 'TOTE', status: 'DRAFT' }).total,
    ).toBe(1);
    for (const direction of ['ASC', 'DESC'] as const) {
      const venues = state.listVenues(storeA, {
        ...page,
        sort: { field: 'CAPACITY', direction },
      }).items;
      const firstNull = venues.findIndex((row) => row.capacity === null);
      expect(firstNull).toBeGreaterThan(0);
      expect(venues.slice(firstNull).every((row) => row.capacity === null)).toBe(true);
      const speakers = state.listSpeakers(storeA, {
        ...page,
        sort: { field: 'EMAIL', direction },
      }).items;
      const nullEmail = speakers.findIndex((row) => row.email === null);
      expect(speakers.slice(nullEmail).every((row) => row.email === null)).toBe(true);
    }
    const a = state.createTag(storeA, { name: 'Tie A', color: '#315ed0' });
    const b = state.createTag(storeA, { name: 'Tie B', color: '#315ed0' });
    expect(
      state
        .listTags(storeA, {
          ...page,
          ids: [a.id, b.id],
          sort: { field: 'COLOR', direction: 'ASC' },
        })
        .items.map((row) => row.id),
    ).toEqual([a.id, b.id].sort((a, b) => b.localeCompare(a)));
  });

  it('scopes identity and uniqueness across A → B → A', () => {
    const a = state.createTag(storeA, { name: 'Shared', color: '#315ed0' });
    const b = state.createTag(storeB, { name: 'Shared', color: '#315ed0' });
    expect(() => state.createTag(storeA, { name: 'Shared', color: '#315ed0' })).toThrow(
      'already used',
    );
    for (const operation of [
      () => state.getTag(storeB, a.id),
      () => state.updateTag(storeB, a.id, { name: 'Wrong' }),
      () => state.deleteTag(storeB, a.id),
    ])
      expect(operation).toThrow('Tag not found');
    expect(state.getTag(storeB, b.id).storeId).toBe(storeB);
    expect(state.getTag(storeA, a.id)).toEqual(a);
    expect(state.listTags('10000000-0000-4000-8000-000000000099', page).total).toBe(0);
    expect(() =>
      state.createTag('10000000-0000-4000-8000-000000000099', {
        name: 'Missing',
        color: '#315ed0',
      }),
    ).toThrow('Store not found');
  });

  it('preserves omitted fields, clears nullable fields and rejects invalid updates without writes', () => {
    const venue = state.createVenue(storeA, {
      name: 'Nullable',
      city: 'Sofia',
      countryCode: 'BG',
      address: 'Street',
      capacity: 100,
    });
    expect(state.updateVenue(storeA, venue.id, { description: 'Description' })).toMatchObject({
      address: 'Street',
      capacity: 100,
    });
    expect(
      state.updateVenue(storeA, venue.id, { description: null, address: null, capacity: null }),
    ).toMatchObject({ description: null, address: null, capacity: null });
    const previous = storage.getItem(prototypeStorageKey);
    expect(() => state.updateVenue(storeA, venue.id, { name: null })).toThrow(
      'supported characters',
    );
    expect(() => state.updateVenue(storeA, venue.id, {})).toThrow('at least one');
    expect(() => state.createSpeaker(storeA, { name: 'Bad email', email: 'invalid' })).toThrow(
      'valid email',
    );
    expect(() => state.createTag(storeA, { name: 'Bad color', color: 'red' })).toThrow('six-digit');
    expect(() =>
      state.createVenue(storeA, {
        name: 'Bad capacity',
        city: 'Sofia',
        countryCode: 'BG',
        capacity: 0,
      }),
    ).toThrow('positive');
    expect(storage.getItem(prototypeStorageKey)).toBe(previous);
    expect(() => state.listTags(storeA, { ...page, search: 'İ'.repeat(201) })).toThrow(
      'supported characters',
    );
    expect(state.listTags(storeA, { ...page, search: 'İ'.repeat(200) }).total).toBe(0);
    expect(() => state.listVenues(storeA, { ...page, limit: 101 })).toThrow('limit');
  });

  it('protects lookup references retained by active and trashed Events/Sessions', () => {
    const event = initialEvents()[0];
    if (!event?.venueId || !event.tagIds[0]) throw new Error('Missing references');
    expect(() => state.deleteVenue(storeA, event.venueId)).toThrow('still referenced');
    expect(() => state.deleteTag(storeA, event.tagIds[0])).toThrow('still referenced');
    expect(() => state.deleteSpeaker(storeA, '50000000-0000-4000-8000-000000000001')).toThrow(
      'still referenced',
    );
    const snapshot: PrototypeSnapshot = initialSnapshot();
    snapshot.events = snapshot.events.filter((row) => row.deletedAt !== null);
    snapshot.sessions = snapshot.sessions.filter((row) =>
      snapshot.events.some((event) => event.id === row.eventId),
    );
    snapshot.history = snapshot.history.filter((row) =>
      snapshot.events.some((event) => event.id === row.eventId),
    );
    snapshot.media = snapshot.media.filter((row) =>
      snapshot.events.some((event) => event.id === row.eventId),
    );
    storage.setItem(prototypeStorageKey, JSON.stringify(snapshot));
    expect(() => state.deleteVenue(storeA, event.venueId)).toThrow('still referenced');
    expect(() => state.deleteTag(storeA, event.tagIds[0])).toThrow('still referenced');
    expect(() => state.deleteSpeaker(storeA, '50000000-0000-4000-8000-000000000001')).toThrow(
      'still referenced',
    );
  });

  it('reports storage write/Reset failures without losing saved data', () => {
    const previous = storage.getItem(prototypeStorageKey);
    storage.failWrites = true;
    expect(() => state.createTag(storeA, { name: 'Unsaved', color: '#315ed0' })).toThrow(
      'could not be saved',
    );
    expect(() => {
      state.reset();
    }).toThrow('could not be saved');
    expect(storage.getItem(prototypeStorageKey)).toBe(previous);
    expect(state.listTags(storeA, { ...page, search: 'Unsaved' }).total).toBe(0);
  });
  it('reports inaccessible storage during startup', () => {
    expect(() =>
      createPrototypeState({
        getItem: () => {
          throw new Error('Denied');
        },
        setItem: () => {},
      }),
    ).toThrow('requires browser storage');
  });
  it('restores fixtures for both stores after Reset', () => {
    const previous = storage.getItem(prototypeStorageKey);
    state.createTag(storeA, { name: 'Added A', color: '#315ed0' });
    state.createProduct(storeB, { name: 'Added B', sku: 'NEW' });
    state.reset();
    expect(storage.getItem(prototypeStorageKey)).toBe(previous);
  });
  it.each(['invalid', '{"version":0}', '{"version":1,"tags":[{}]}'])(
    'discards obsolete or invalid snapshots: %s',
    (raw) => {
      storage.setItem(prototypeStorageKey, raw);
      expect(createPrototypeState(storage).listTags(storeA, page).total).toBe(24);
    },
  );
  it('discards corrupt identity and cross-store relation snapshots', () => {
    const snapshot: PrototypeSnapshot = initialSnapshot();
    snapshot.events[0]?.tagIds.push('40000000-0000-4000-8000-000000000101');
    storage.setItem(prototypeStorageKey, JSON.stringify(snapshot));
    expect(createPrototypeState(storage).listTags(storeA, page).total).toBe(24);
    expect(storage.getItem(prototypeStorageKey)).not.toBe(JSON.stringify(snapshot));
  });
});
