import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { CoreClient } from '../src/core/core.client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { EventsRepository } from '../src/events/events.repository.js';
import { SessionsRepository } from '../src/sessions/sessions.repository.js';
import { createTestDatabase } from './test-database.js';

const selection =
  'id storeId eventId title summary room startsAt endsAt position speakerIds speakers{id name active}';
const create = `mutation($eventId:ID!,$input:CreateReferenceSessionInput!){createReferenceSession(eventId:$eventId,input:$input){${selection}}}`;
const update = `mutation($eventId:ID!,$id:ID!,$input:UpdateReferenceSessionInput!){updateReferenceSession(eventId:$eventId,id:$id,input:$input){${selection}}}`;
const read = `query($eventId:ID!,$id:ID!){referenceSession(eventId:$eventId,id:$id){${selection}}}`;
const list = `query($eventId:ID!){referenceSessions(eventId:$eventId){${selection}}}`;
const reorder =
  'mutation($eventId:ID!,$ids:[ID!]!){reorderReferenceSessions(eventId:$eventId,ids:$ids){id position}}';
const remove =
  'mutation($eventId:ID!,$id:ID!){deleteReferenceSession(eventId:$eventId,id:$id){id}}';
const valid = {
  title: 'Opening',
  summary: 'Welcome',
  room: 'Main hall',
  startsAt: '2026-11-12T09:00:00.000Z',
  endsAt: '2026-11-12T10:00:00.000Z',
};

describe('Event Sessions with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let events: EventsRepository;
  let sessions: SessionsRepository;
  let url: string;
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(CoreClient)
      .useValue({ requireStore: () => Promise.resolve() })
      .compile();
    events = module.get(EventsRepository);
    sessions = module.get(SessionsRepository);
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/graphql`;
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await closeDatabase?.();
    }
  });
  async function query(source: string, variables: Record<string, unknown>, storeId: string) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-store-id': storeId },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10_000),
    });
    const body: unknown = await response.json();
    return body;
  }
  function parent(storeId: string = randomUUID()) {
    return database.client.event.create({
      data: {
        storeId,
        title: 'Forum',
        code: randomUUID(),
        format: 'ONLINE',
        meetingUrl: 'https://example.com/forum',
        startsAt: new Date('2026-11-12T08:00:00Z'),
        endsAt: new Date('2026-11-12T16:00:00Z'),
      },
    });
  }
  async function child(
    event: { id: string; storeId: string },
    patch: Record<string, unknown> = {},
  ) {
    const body = await query(
      create,
      { eventId: event.id, input: { ...valid, ...patch } },
      event.storeId,
    );
    expect(body).toHaveProperty('data.createReferenceSession.id');
    return database.client.session.findFirstOrThrow({
      where: { storeId: event.storeId, eventId: event.id },
      orderBy: { position: 'desc' },
    });
  }
  it('creates overlapping sessions, saves partial edits and clears optional fields and speakers', async () => {
    const event = await parent();
    const speaker = await database.client.speaker.create({
      data: { storeId: event.storeId, name: 'Alex' },
    });
    const first = await child(event, { title: ' Opening ', speakerIds: [speaker.id] });
    const second = await child(event, { title: 'Parallel' });
    expect(await query(list, { eventId: event.id }, event.storeId)).toMatchObject({
      data: {
        referenceSessions: [
          { id: first.id, title: 'Opening', position: 0, speakers: [{ name: 'Alex' }] },
          { id: second.id, position: 1 },
        ],
      },
    });
    expect(
      await query(
        update,
        { eventId: event.id, id: first.id, input: { title: 'Changed' } },
        event.storeId,
      ),
    ).toMatchObject({
      data: {
        updateReferenceSession: {
          title: 'Changed',
          summary: 'Welcome',
          room: 'Main hall',
          speakerIds: [speaker.id],
        },
      },
    });
    expect(
      await query(
        update,
        { eventId: event.id, id: first.id, input: { room: null, summary: null, speakerIds: [] } },
        event.storeId,
      ),
    ).toMatchObject({
      data: { updateReferenceSession: { room: null, summary: null, speakerIds: [] } },
    });
    expect(
      await database.client.sessionSpeaker.count({
        where: { storeId: event.storeId, sessionId: first.id },
      }),
    ).toBe(0);
    await query(remove, { eventId: event.id, id: first.id }, event.storeId);
    expect(await database.client.session.count({ where: { eventId: event.id } })).toBe(1);
    const entries = await database.client.eventHistory.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.operation)).toEqual([
      'SESSION_CREATED',
      'SESSION_CREATED',
      'SESSION_UPDATED',
      'SESSION_UPDATED',
      'SESSION_DELETED',
    ]);
    expect(entries.at(-1)?.subject).toBe('Changed');
  });
  it('rejects invalid scalar values, out-of-event times and event shrinkage with field errors', async () => {
    const event = await parent();
    for (const [patch, path] of [
      [{ title: ' ' }, 'title'],
      [{ endsAt: valid.startsAt }, 'endsAt'],
      [{ startsAt: '2026-11-12T07:00:00Z' }, 'startsAt'],
      [{ endsAt: '2026-11-12T17:00:00Z' }, 'endsAt'],
      [{ room: 'x'.repeat(121) }, 'room'],
      [{ summary: 'x'.repeat(2001) }, 'summary'],
      [{ speakerIds: null }, 'speakerIds'],
    ] as const)
      expect(
        await query(create, { eventId: event.id, input: { ...valid, ...patch } }, event.storeId),
      ).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path }] } }],
      });
    expect(await database.client.session.count({ where: { eventId: event.id } })).toBe(0);
    const row = await child(event);
    for (const input of [
      {},
      { title: null },
      { startsAt: null },
      { endsAt: null },
      { speakerIds: null },
    ])
      expect(
        await query(update, { eventId: event.id, id: row.id, input }, event.storeId),
      ).toHaveProperty('errors');
    const updateEvent =
      'mutation($id:ID!,$input:UpdateReferenceEventInput!){updateReferenceEvent(id:$id,input:$input){id}}';
    for (const [input, path] of [
      [{ startsAt: '2026-11-12T09:30:00Z' }, 'startsAt'],
      [{ endsAt: '2026-11-12T09:30:00Z' }, 'endsAt'],
    ] as const)
      expect(await query(updateEvent, { id: event.id, input }, event.storeId)).toMatchObject({
        errors: [{ extensions: { fieldErrors: [{ path }] } }],
      });
    expect(await database.client.session.findUnique({ where: { id: row.id } })).toEqual(row);
    expect(await database.client.event.findUnique({ where: { id: event.id } })).toEqual(event);
    expect(
      await query(
        updateEvent,
        {
          id: event.id,
          input: { title: 'Updated parent', startsAt: valid.startsAt, endsAt: valid.endsAt },
        },
        event.storeId,
      ),
    ).toHaveProperty('data.updateReferenceEvent.id');
  });
  it('enforces parent and store scope at the API and composite foreign keys', async () => {
    const event = await parent(),
      other = await parent(event.storeId),
      foreign = await parent();
    const row = await child(event);
    for (const [storeId, eventId] of [
      [foreign.storeId, event.id],
      [event.storeId, other.id],
    ]) {
      if (!storeId || !eventId) throw new Error('Missing fixture scope');
      for (const source of [read, update, remove])
        expect(
          await query(source, { eventId, id: row.id, input: { title: 'Wrong' } }, storeId),
        ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
      expect(await query(reorder, { eventId, ids: [row.id] }, storeId)).toHaveProperty('errors');
    }
    expect(await query(create, { eventId: foreign.id, input: valid }, event.storeId)).toMatchObject(
      { errors: [{ extensions: { code: 'NOT_FOUND' } }] },
    );
    expect(await query(list, { eventId: event.id }, foreign.storeId)).toHaveProperty('errors');
    await expect(
      database.client.session.create({
        data: { ...valid, storeId: foreign.storeId, eventId: event.id, position: 0 },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    const speaker = await database.client.speaker.create({
      data: { storeId: foreign.storeId, name: 'Foreign' },
    });
    await expect(
      database.client.sessionSpeaker.create({
        data: { storeId: event.storeId, sessionId: row.id, speakerId: speaker.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect(
      await query(
        update,
        { eventId: event.id, id: row.id, input: { speakerIds: [speaker.id] } },
        event.storeId,
      ),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'speakerIds' }] } }] });
  });
  it('retains inactive speakers, forbids new assignments and protects referenced speakers', async () => {
    const event = await parent();
    const speaker = await database.client.speaker.create({
      data: { storeId: event.storeId, name: 'Alex' },
    });
    const row = await child(event, { speakerIds: [speaker.id] });
    await database.client.speaker.update({ where: { id: speaker.id }, data: { active: false } });
    expect(
      await query(
        update,
        { eventId: event.id, id: row.id, input: { title: 'Keep', speakerIds: [speaker.id] } },
        event.storeId,
      ),
    ).toMatchObject({
      data: { updateReferenceSession: { speakers: [{ id: speaker.id, active: false }] } },
    });
    expect(
      await query(
        create,
        { eventId: event.id, input: { ...valid, speakerIds: [speaker.id] } },
        event.storeId,
      ),
    ).toHaveProperty('errors');
    const deleteSpeaker = 'mutation($id:ID!){deleteReferenceSpeaker(id:$id){id}}';
    expect(await query(deleteSpeaker, { id: speaker.id }, event.storeId)).toMatchObject({
      errors: [{ extensions: { code: 'CONFLICT' } }],
    });
    await query(remove, { eventId: event.id, id: row.id }, event.storeId);
    expect(await query(deleteSpeaker, { id: speaker.id }, event.storeId)).toHaveProperty(
      'data.deleteReferenceSpeaker.id',
    );
  });
  it('saves only complete permutations and rolls back a failure midway through reordering', async () => {
    const event = await parent();
    const first = await child(event),
      second = await child(event, { title: 'Second' });
    for (const ids of [
      [first.id],
      [first.id, first.id],
      [first.id, randomUUID()],
      [first.id, second.id, randomUUID()],
    ])
      expect(await query(reorder, { eventId: event.id, ids }, event.storeId)).toHaveProperty(
        'errors',
      );
    expect(
      await query(reorder, { eventId: event.id, ids: [second.id, first.id] }, event.storeId),
    ).toMatchObject({
      data: {
        reorderReferenceSessions: [
          { id: second.id, position: 0 },
          { id: first.id, position: 1 },
        ],
      },
    });
    const before = await sessions.list(event.storeId, event.id);
    await expect(
      events.withLockedEvent(event.storeId, event.id, async (_event, tx) =>
        sessions.reorder(tx, event.storeId, event.id, [first.id, second.id, randomUUID()]),
      ),
    ).rejects.toMatchObject({ code: 'P2025' });
    expect(await sessions.list(event.storeId, event.id)).toEqual(before);
  });
  it('serializes the 100-session limit and parent date changes against concurrent child writes', async () => {
    const full = await parent();
    await database.client.session.createMany({
      data: Array.from({ length: 99 }, (_, position) => ({
        ...valid,
        storeId: full.storeId,
        eventId: full.id,
        position,
      })),
    });
    const additions = await Promise.all(
      [1, 2].map(() => query(create, { eventId: full.id, input: valid }, full.storeId)),
    );
    expect(
      additions.filter(
        (body) => typeof body === 'object' && body !== null && 'data' in body && body.data !== null,
      ),
    ).toHaveLength(1);
    expect(additions).toContainEqual(
      expect.objectContaining({
        errors: [
          expect.objectContaining({ extensions: expect.objectContaining({ code: 'CONFLICT' }) }),
        ],
      }),
    );
    expect(await database.client.session.count({ where: { eventId: full.id } })).toBe(100);
    const event = await parent();
    const writes = await Promise.all([
      query(
        create,
        {
          eventId: event.id,
          input: { ...valid, startsAt: '2026-11-12T14:00:00Z', endsAt: '2026-11-12T15:00:00Z' },
        },
        event.storeId,
      ),
      query(
        'mutation($id:ID!){updateReferenceEvent(id:$id,input:{endsAt:"2026-11-12T12:00:00Z"}){id}}',
        { id: event.id },
        event.storeId,
      ),
    ]);
    expect(
      writes.filter((body) => typeof body === 'object' && body !== null && 'errors' in body),
    ).toHaveLength(1);
    const saved = await database.client.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(
      await database.client.session.count({
        where: { eventId: event.id, endsAt: { gt: saved.endsAt } },
      }),
    ).toBe(0);
  });
  it('hides soft-deleted parents and blocks every child write while preserving the program', async () => {
    const event = await parent(),
      row = await child(event);
    expect(
      await query(
        'mutation($id:ID!){deleteReferenceEvent(id:$id){id}}',
        { id: event.id },
        event.storeId,
      ),
    ).toHaveProperty('data.deleteReferenceEvent.id');
    for (const source of [read, list, create, update, remove, reorder])
      expect(
        await query(
          source,
          { eventId: event.id, id: row.id, input: valid, ids: [row.id] },
          event.storeId,
        ),
      ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    expect(await database.client.session.findUnique({ where: { id: row.id } })).toEqual(row);
  });
});
