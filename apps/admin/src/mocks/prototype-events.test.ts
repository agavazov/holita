import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { print } from 'graphql';
import { SetReferenceEventsStatusDocument } from '../generated/graphql/operations.js';
import {
  createDataProvider,
  eventsResource,
  sessionsResource,
  historyResource,
} from '../data/data-provider.js';
import type {
  CreateReferenceEventInput,
  ReferenceEventDetailsFragment,
  ReferenceSessionDetailsFragment,
} from '../generated/graphql/operations.js';
import { createPrototypeState, prototypeStorageKey } from './state.js';
import { createPrototypeHandlers } from './handlers.js';
import { eventDescription } from './event-validation.js';

class MemoryStorage {
  value: string | null = null;
  failWrites = false;
  getItem() {
    return this.value;
  }
  setItem(_key: string, value: string) {
    if (this.failWrites) throw new Error('Storage full');
    this.value = value;
  }
}
const storeA = '10000000-0000-4000-8000-000000000001',
  storeB = '10000000-0000-4000-8000-000000000002';
const endpoint = 'http://127.0.0.1/__prototype/events-test',
  server = setupServer(),
  provider = createDataProvider(endpoint);
let storage: MemoryStorage, state: ReturnType<typeof createPrototypeState>;
function input(patch: Partial<CreateReferenceEventInput> = {}): CreateReferenceEventInput {
  return {
    title: 'Prototype forum',
    code: 'PROTOTYPE',
    format: 'ONLINE',
    startsAt: '2026-11-12T08:00:00.123Z',
    endsAt: '2026-11-12T16:00:00.456Z',
    meetingUrl: 'https://example.com/forum',
    ...patch,
  };
}
function history(eventId: string) {
  return state.listEventHistory(storeA, { eventId, offset: 0, limit: 100 });
}
function sessionInput(title = 'Opening') {
  return { title, startsAt: '2026-11-12T09:00:00.000Z', endsAt: '2026-11-12T10:00:00.000Z' };
}
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

describe('Prototype Events and Sessions through the shared provider', () => {
  it('accepts GraphQL singleton coercion for the generated bulk-ID variable', async () => {
    const event = state.createEvent(storeA, input());
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-store-id': storeA },
      body: JSON.stringify({
        query: print(SetReferenceEventsStatusDocument),
        variables: { ids: event.id, status: 'PUBLISHED' },
      }),
    });
    const result: unknown = await response.json();
    expect(result).toEqual({ data: { setReferenceEventsStatus: { ids: [event.id], count: 1 } } });
    expect(state.getEvent(storeA, event.id).status).toBe('PUBLISHED');
  });
  it('uses generated operations for CRUD, History and lifecycle with persisted relations', async () => {
    const resource = eventsResource(storeA),
      event = (
        await provider.create<ReferenceEventDetailsFragment>({
          resource,
          variables: input({ budget: '1234.5' }),
        })
      ).data;
    expect(event).toMatchObject({
      storeId: storeA,
      budget: '1234.50',
      status: 'DRAFT',
      startsAt: '2026-11-12T08:00:00.123Z',
    });
    await provider.update({ resource, id: event.id, variables: { title: 'Updated forum' } });
    expect((await provider.getOne({ resource, id: event.id })).data).toMatchObject({
      title: 'Updated forum',
    });
    expect(
      (
        await provider.getList({
          resource,
          filters: [{ field: 'search', operator: 'contains', value: 'Updated forum' }],
        })
      ).total,
    ).toBe(1);
    if (!provider.custom) throw new Error('Expected provider custom actions.');
    await provider.custom({
      url: resource,
      method: 'post',
      payload: { action: 'status', ids: [event.id], status: 'PUBLISHED' },
    });
    await provider.deleteOne({ resource, id: event.id });
    await expect(provider.getOne({ resource, id: event.id })).rejects.toThrow('Event not found');
    const trashed = (
      await provider.getOne<ReferenceEventDetailsFragment>({
        resource,
        id: event.id,
        meta: { includeDeleted: true },
      })
    ).data;
    expect(trashed.status).toBe('PUBLISHED');
    expect(typeof trashed.deletedAt).toBe('string');
    await provider.custom({
      url: resource,
      method: 'post',
      payload: { action: 'restore', ids: [event.id] },
    });
    await provider.custom({
      url: resource,
      method: 'post',
      payload: { action: 'trash', ids: [event.id] },
    });
    const audit = await provider.getList({
      resource: historyResource(storeA, event.id),
      pagination: { pageSize: 100 },
    });
    expect(audit.total).toBe(6);
    server.resetHandlers(...createPrototypeHandlers(endpoint, createPrototypeState(storage)));
    expect(
      (await provider.getOne({ resource, id: event.id, meta: { includeDeleted: true } })).data,
    ).toMatchObject({ title: 'Updated forum', status: 'PUBLISHED' });
  });
  it('handles all Session operations with the captured store and parent', async () => {
    const event = state.createEvent(storeA, input()),
      resource = sessionsResource(storeA, event.id);
    const first = (
      await provider.create<ReferenceSessionDetailsFragment>({
        resource,
        variables: sessionInput(),
      })
    ).data;
    const second = (
      await provider.create<ReferenceSessionDetailsFragment>({
        resource,
        variables: sessionInput('Workshop'),
      })
    ).data;
    await provider.update({ resource, id: first.id, variables: { room: 'Main room' } });
    expect((await provider.getOne({ resource, id: first.id })).data).toMatchObject({
      room: 'Main room',
    });
    if (!provider.custom) throw new Error('Expected ordering.');
    await provider.custom({
      url: resource,
      method: 'post',
      payload: { ids: [second.id, first.id] },
    });
    expect((await provider.getList({ resource })).data.map((row) => row.id)).toEqual([
      second.id,
      first.id,
    ]);
    await expect(
      provider.getOne({ resource: sessionsResource(storeB, event.id), id: first.id }),
    ).rejects.toThrow('Session not found');
    await provider.deleteOne({ resource, id: first.id });
    expect((await provider.getList({ resource })).total).toBe(1);
    expect(history(event.id).items.map((row) => row.operation)).toEqual(
      expect.arrayContaining([
        'SESSION_CREATED',
        'SESSION_UPDATED',
        'SESSION_DELETED',
        'SESSIONS_REORDERED',
      ]),
    );
  });
});
describe('Concrete mock domain rules and atomic persistence', () => {
  it('reports invalid capacity filters against their own fields without writing data', () => {
    const before = storage.value;
    for (const [filter, path] of [
      [{ capacityMin: 0 }, 'capacityMin'],
      [{ capacityMax: 0 }, 'capacityMax'],
    ] as const) {
      let error: unknown;
      try {
        state.listEvents(storeA, { offset: 0, limit: 20, filter });
      } catch (failure) {
        error = failure;
      }
      expect(error).toMatchObject({
        fieldErrors: [{ path, message: 'Enter a positive whole number up to 2147483647.' }],
      });
    }
    expect(storage.value).toBe(before);
  });
  it('retains omitted fields, clears nullable fields, normalizes money and enforces formats', () => {
    const venue = state.listVenues(storeA, { offset: 0, limit: 100, active: true }).items[0];
    if (!venue) throw new Error('Expected venue.');
    const event = state.createEvent(
      storeA,
      input({
        format: 'HYBRID',
        venueId: venue.id,
        budget: '1.2',
        capacity: 20,
        summary: 'Summary',
        registrationOpensOn: '2026-11-01',
        registrationClosesOn: '2026-11-12',
      }),
    );
    const updated = state.updateEvent(storeA, event.id, { summary: null, capacity: null });
    expect(updated).toMatchObject({
      summary: null,
      capacity: null,
      budget: '1.20',
      venueId: venue.id,
    });
    expect(state.updateEvent(storeA, event.id, { format: 'ONLINE' })).toMatchObject({
      venueId: null,
      meetingUrl: 'https://example.com/forum',
    });
    expect(
      state.updateEvent(storeA, event.id, { format: 'IN_PERSON', venueId: venue.id }),
    ).toMatchObject({ meetingUrl: null });
    expect(() => state.updateEvent(storeA, event.id, { title: null })).toThrow();
    expect(() => state.updateEvent(storeA, event.id, {})).toThrow('at least one');
  });
  it.each([
    { budget: '1.234' },
    { budget: '10000000000' },
    { capacity: 0 },
    { endsAt: '2026-11-12T08:00:00.123Z' },
    { registrationOpensOn: '2026-02-30', registrationClosesOn: '2026-11-01' },
    { registrationOpensOn: '2026-11-01' },
    { registrationOpensOn: '2026-11-13', registrationClosesOn: '2026-11-13' },
    { meetingUrl: 'javascript:alert(1)' },
  ])('rejects invalid Event input without saving data or history: %j', (patch) => {
    const before = storage.value;
    expect(() => state.createEvent(storeA, input(patch))).toThrow();
    expect(storage.value).toBe(before);
  });
  it('checks code uniqueness including Trash while allowing the same code in another store', () => {
    const event = state.createEvent(storeA, input());
    state.deleteEvent(storeA, event.id);
    expect(() => state.createEvent(storeA, input())).toThrow('Code is already used');
    expect(state.createEvent(storeB, input()).storeId).toBe(storeB);
  });
  it('checks active store relations, preserves existing inactive links and resolves renamed labels', () => {
    const venue = state.createVenue(storeA, { name: 'Venue', city: 'Sofia', countryCode: 'BG' }),
      tag = state.createTag(storeA, { name: 'Topic', color: '#123456' });
    const event = state.createEvent(
      storeA,
      input({ format: 'IN_PERSON', venueId: venue.id, tagIds: [tag.id] }),
    );
    state.updateVenue(storeA, venue.id, { name: 'Renamed venue', active: false });
    state.updateTag(storeA, tag.id, { name: 'Renamed topic', active: false });
    expect(state.updateEvent(storeA, event.id, { title: 'Adjusted' })).toMatchObject({
      venue: { name: 'Renamed venue', active: false },
      tags: [{ name: 'Renamed topic', active: false }],
    });
    expect(() =>
      state.createEvent(
        storeA,
        input({ code: 'INACTIVE', format: 'IN_PERSON', venueId: venue.id }),
      ),
    ).toThrow('active venue');
    expect(() => state.createEvent(storeA, input({ code: 'INACTIVE', tagIds: [tag.id] }))).toThrow(
      'active tags',
    );
    expect(() => state.createEvent(storeB, input({ tagIds: [tag.id] }))).toThrow('active tags');
    expect(() =>
      state.createEvent(storeB, input({ format: 'IN_PERSON', venueId: venue.id })),
    ).toThrow('active venue');
    state.deleteEvent(storeA, event.id);
    expect(() => state.deleteVenue(storeA, venue.id)).toThrow('still referenced');
    expect(() => state.deleteTag(storeA, tag.id)).toThrow('still referenced');
    state.restoreEvents(storeA, [event.id]);
    state.updateEvent(storeA, event.id, {
      format: 'ONLINE',
      meetingUrl: 'https://example.com',
      tagIds: [],
    });
    expect(state.deleteVenue(storeA, venue.id).id).toBe(venue.id);
    expect(state.deleteTag(storeA, tag.id).id).toBe(tag.id);
  });
  it('combines filters, literal search, half-open dates and sorting before pagination', () => {
    const event = state.createEvent(
      storeA,
      input({ title: 'Literal_%', status: 'PUBLISHED', capacity: 80, featured: true }),
    );
    const args = {
      offset: 0,
      limit: 1,
      filter: {
        search: '_%',
        statuses: ['PUBLISHED' as const],
        formats: ['ONLINE' as const],
        featured: true,
        startsAtFrom: event.startsAt,
        startsAtBefore: event.endsAt,
        capacityMin: 80,
        capacityMax: 80,
      },
    };
    expect(state.listEvents(storeA, args)).toMatchObject({ total: 1, items: [{ id: event.id }] });
    expect(
      state.listEvents(storeA, {
        ...args,
        filter: { ...args.filter, startsAtBefore: event.startsAt, startsAtFrom: null },
      }).total,
    ).toBe(0);
    const all = state.listEvents(storeA, {
      offset: 0,
      limit: 100,
      sort: { field: 'STATUS', direction: 'ASC' },
    });
    expect(all.items.map((row) => row.status)).toEqual(
      [...all.items.map((row) => row.status)].sort(
        (a, b) =>
          ['DRAFT', 'PUBLISHED', 'ARCHIVED'].indexOf(a) -
          ['DRAFT', 'PUBLISHED', 'ARCHIVED'].indexOf(b),
      ),
    );
    expect(
      state.listEvents(storeA, { offset: 5, limit: 5, sort: { field: 'STATUS', direction: 'ASC' } })
        .items,
    ).toEqual(all.items.slice(5, 10));
    for (const field of ['CAPACITY', 'BUDGET'] as const)
      for (const direction of ['ASC', 'DESC'] as const) {
        const rows = state.listEvents(storeA, {
          offset: 0,
          limit: 100,
          sort: { field, direction },
        }).items;
        const values = rows.map((row) => (field === 'CAPACITY' ? row.capacity : row.budget)),
          firstNull = values.findIndex((value) => value == null);
        expect(values.slice(firstNull).every((value) => value == null)).toBe(true);
      }
  });
  it('makes bulk lifecycle actions atomic, preserves children and excludes Trash by default', () => {
    const a = state.createEvent(storeA, input()),
      b = state.createEvent(storeA, input({ code: 'SECOND' })),
      session = state.createSession(storeA, a.id, sessionInput());
    state.setEventsStatus(storeA, [a.id, b.id], 'PUBLISHED');
    state.trashEvents(storeA, [a.id]);
    const before = storage.value;
    expect(() => state.trashEvents(storeA, [a.id, b.id])).toThrow('selection changed');
    expect(() => state.restoreEvents(storeA, [a.id, b.id])).toThrow('selection changed');
    expect(() => state.setEventsStatus(storeA, [a.id, b.id], 'DRAFT')).toThrow('selection changed');
    expect(() => state.trashEvents(storeB, [b.id])).toThrow('not found');
    expect(storage.value).toBe(before);
    expect(() => state.getEvent(storeA, a.id)).toThrow('Event not found');
    expect(() => state.listSessions(storeA, a.id)).toThrow('Event not found');
    expect(() => state.updateSession(storeA, a.id, session.id, { title: 'Wrong' })).toThrow();
    expect(
      state
        .listEvents(storeA, {
          offset: 0,
          limit: 100,
          filter: { trashed: true, search: 'Prototype forum' },
        })
        .items.some((row) => row.id === a.id),
    ).toBe(true);
    expect(
      history(a.id).items.some((row) => row.operation === 'TRASHED' && !row.changes.length),
    ).toBe(true);
    state.restoreEvents(storeA, [a.id]);
    expect(state.listSessions(storeA, a.id)[0]?.id).toBe(session.id);
    expect(state.getEvent(storeA, a.id).status).toBe('PUBLISHED');
  });
  it('keeps sessions within the parent and prevents Event dates excluding existing sessions', () => {
    const event = state.createEvent(storeA, input()),
      session = state.createSession(storeA, event.id, sessionInput());
    const before = storage.value;
    expect(() =>
      state.createSession(storeA, event.id, {
        ...sessionInput(),
        startsAt: '2026-11-12T07:00:00Z',
      }),
    ).toThrow('start within');
    expect(() =>
      state.updateSession(storeA, event.id, session.id, { endsAt: '2026-11-12T17:00:00Z' }),
    ).toThrow('end within');
    expect(() => state.updateEvent(storeA, event.id, { startsAt: '2026-11-12T09:30:00Z' })).toThrow(
      'include all existing',
    );
    expect(() => state.updateEvent(storeA, event.id, { endsAt: '2026-11-12T09:30:00Z' })).toThrow(
      'include all existing',
    );
    expect(() =>
      state.getSession(storeA, '60000000-0000-4000-8000-000000000001', session.id),
    ).toThrow('Session not found');
    expect(() => state.createSession(storeB, event.id, sessionInput())).toThrow(
      'One or more events were not found',
    );
    expect(storage.value).toBe(before);
  });
  it('uses actual speaker links for deletion and permits existing inactive assignments', () => {
    const event = state.createEvent(storeA, input()),
      speaker = state.createSpeaker(storeA, { name: 'Speaker' });
    const session = state.createSession(storeA, event.id, {
      ...sessionInput(),
      speakerIds: [speaker.id],
    });
    state.updateSpeaker(storeA, speaker.id, { name: 'Renamed speaker', active: false });
    expect(
      state.updateSession(storeA, event.id, session.id, { room: 'A' }).speakers[0],
    ).toMatchObject({ name: 'Renamed speaker', active: false });
    expect(() =>
      state.createSession(storeA, event.id, { ...sessionInput(), speakerIds: [speaker.id] }),
    ).toThrow('active speakers');
    expect(() => state.deleteSpeaker(storeA, speaker.id)).toThrow('still referenced');
    state.deleteEvent(storeA, event.id);
    expect(() => state.deleteSpeaker(storeA, speaker.id)).toThrow('still referenced');
    state.restoreEvents(storeA, [event.id]);
    state.deleteSession(storeA, event.id, session.id);
    expect(state.deleteSpeaker(storeA, speaker.id).id).toBe(speaker.id);
  });
  it('rejects stale orders and duplicate IDs, persists complete permutations and skips no-op history', () => {
    const event = state.createEvent(storeA, input()),
      a = state.createSession(storeA, event.id, sessionInput()),
      b = state.createSession(storeA, event.id, sessionInput('Workshop'));
    const before = storage.value;
    expect(() => state.reorderSessions(storeA, event.id, [a.id])).toThrow('session list changed');
    expect(() => state.reorderSessions(storeA, event.id, [a.id, a.id])).toThrow('repeat');
    expect(storage.value).toBe(before);
    state.reorderSessions(storeA, event.id, [b.id, a.id]);
    const count = history(event.id).total;
    state.reorderSessions(storeA, event.id, [b.id, a.id]);
    state.updateSession(storeA, event.id, a.id, { title: a.title });
    state.updateEvent(storeA, event.id, { title: event.title });
    state.setEventsStatus(storeA, [event.id], 'DRAFT');
    expect(history(event.id).total).toBe(count);
    state = createPrototypeState(storage);
    expect(state.listSessions(storeA, event.id).map((row) => [row.id, row.position])).toEqual([
      [b.id, 0],
      [a.id, 1],
    ]);
  });
  it('enforces the 100-session limit without changing the last saved snapshot', () => {
    const event = state.createEvent(storeA, input());
    for (let i = 0; i < 100; i++)
      state.createSession(storeA, event.id, sessionInput(`Session ${String(i)}`));
    const before = storage.value;
    expect(() => state.createSession(storeA, event.id, sessionInput())).toThrow('at most 100');
    expect(storage.value).toBe(before);
  });
  it('bounds history excerpts, pages newest first, and denies foreign-store history', () => {
    const event = state.createEvent(storeA, input());
    state.updateEvent(storeA, event.id, { descriptionHtml: `<p>${'x'.repeat(700)}</p>` });
    for (let i = 0; i < 22; i++)
      state.updateEvent(storeA, event.id, { title: `Title ${String(i)}` });
    const all = history(event.id);
    expect(all.total).toBe(24);
    expect(all.items.every((row) => row.actor === 'Anonymous')).toBe(true);
    expect(
      all.items.find((row) => row.changes.some((change) => change.field === 'descriptionHtml'))
        ?.changes[0]?.after,
    ).toHaveLength(501);
    expect(
      state.listEventHistory(storeA, { eventId: event.id, offset: 20, limit: 20 }).items,
    ).toEqual(all.items.slice(20));
    expect(() =>
      state.listEventHistory(storeB, { eventId: event.id, offset: 0, limit: 20 }),
    ).toThrow('Event not found');
  });
  it('does not persist partial Event, Session or History writes if browser storage fails', () => {
    const event = state.createEvent(storeA, input()),
      session = state.createSession(storeA, event.id, sessionInput()),
      before = storage.value;
    storage.failWrites = true;
    for (const write of [
      () => state.createEvent(storeA, input({ code: 'SECOND' })),
      () => state.updateEvent(storeA, event.id, { title: 'Failed' }),
      () => state.deleteEvent(storeA, event.id),
      () => state.updateSession(storeA, event.id, session.id, { room: 'Failed' }),
      () => state.deleteSession(storeA, event.id, session.id),
    ]) {
      expect(write).toThrow('could not be saved');
      expect(storage.value).toBe(before);
    }
    storage.failWrites = false;
    state = createPrototypeState(storage);
    expect(state.getEvent(storeA, event.id).title).toBe(event.title);
    expect(state.getSession(storeA, event.id, session.id).room).toBeNull();
    expect(history(event.id).total).toBe(2);
  });
  it('resets all stores, events, sessions and history together', () => {
    const original = storage.value,
      event = state.createEvent(storeA, input());
    state.createSession(storeA, event.id, sessionInput());
    state.createEvent(storeB, input());
    state.reset();
    expect(storage.value).toBe(original);
    expect(() => createPrototypeState(storage).getEvent(storeA, event.id)).toThrow(
      'Event not found',
    );
  });
  it('replaces version 2 data and snapshots with broken store-scoped relationships', () => {
    const event = state.listEvents(storeA, { offset: 0, limit: 1 }).items[0];
    if (!event) throw new Error('Expected fixture.');
    const original = storage.value;
    storage.setItem(prototypeStorageKey, JSON.stringify({ version: 2 }));
    createPrototypeState(storage);
    expect(storage.value).toBe(original);
    const raw: unknown = JSON.parse(storage.value ?? 'null');
    if (
      typeof raw !== 'object' ||
      raw === null ||
      !('sessions' in raw) ||
      !Array.isArray(raw.sessions)
    )
      throw new Error('Expected snapshot.');
    raw.sessions.push({
      ...state.listSessions(storeA, event.id)[0],
      id: crypto.randomUUID(),
      storeId: storeB,
      position: 50,
    });
    storage.setItem(prototypeStorageKey, JSON.stringify(raw));
    createPrototypeState(storage);
    expect(storage.value).toBe(original);
  });
  it('sanitizes rich text on write, permits safe formatting and enforces UTF-8 bounds', () => {
    expect(
      eventDescription(
        '<p onclick="evil()"><b>Bold</b><i>Italic</i><script>evil()</script><img src="x"><a href="https://user:pass@example.com">Bad link</a><a href="https://example.com">Good link</a></p>',
      ),
    ).toBe(
      '<p><strong>Bold</strong><em>Italic</em><a>Bad link</a><a href="https://example.com">Good link</a></p>',
    );
    expect(eventDescription('<p><br></p>')).toBeNull();
    expect(() => eventDescription('\0')).toThrow('NUL');
    expect(() => eventDescription(`<p>${'🙂'.repeat(26000)}</p>`)).toThrow('100 KiB');
    const event = state.createEvent(
      storeA,
      input({ descriptionHtml: '<h2>Title</h2><ol start="2"><li>Item</li></ol>' }),
    );
    expect(createPrototypeState(storage).getEvent(storeA, event.id).descriptionHtml).toBe(
      event.descriptionHtml,
    );
  });
});
