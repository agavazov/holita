import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { CoreClient } from '../src/core/core.client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { EventHistoryRepository } from '../src/events/event-history.repository.js';
import { createTestDatabase } from './test-database.js';

const valid = {
  title: 'Lifecycle forum',
  code: 'LIFECYCLE',
  format: 'ONLINE',
  meetingUrl: 'https://example.com/meet',
  startsAt: '2026-11-01T10:00:00Z',
  endsAt: '2026-11-01T18:00:00Z',
};
const create =
  'mutation($input:CreateReferenceEventInput!){createReferenceEvent(input:$input){id}}';
const update =
  'mutation($id:ID!,$input:UpdateReferenceEventInput!){updateReferenceEvent(id:$id,input:$input){id}}';
const trash = 'mutation($ids:[ID!]!){trashReferenceEvents(ids:$ids){ids count}}';
const restore = 'mutation($ids:[ID!]!){restoreReferenceEvents(ids:$ids){ids count}}';
const publish =
  'mutation($ids:[ID!]!){setReferenceEventsStatus(ids:$ids,status:PUBLISHED){ids count}}';
const history =
  'query($eventId:ID!,$offset:Int,$limit:Int){referenceEventHistory(eventId:$eventId,offset:$offset,limit:$limit){total offset limit items{id operation actor changes{field before after}}}}';

describe('Event lifecycle and atomic history with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: INestApplication | undefined;
  let closeDatabase: (() => Promise<void>) | undefined;
  let url: string;
  let audit: EventHistoryRepository;
  const requireStore = jest.fn<CoreClient['requireStore']>().mockResolvedValue(undefined);
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(CoreClient)
      .useValue({ requireStore })
      .compile();
    audit = module.get(EventHistoryRepository);
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
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    return body;
  }
  async function event(storeId: string, code = 'LIFECYCLE') {
    expect(await query(create, { input: { ...valid, code } }, storeId)).toHaveProperty(
      'data.createReferenceEvent.id',
    );
    return database.client.event.findUniqueOrThrow({ where: { storeId_code: { storeId, code } } });
  }
  it('restores status, code and children while normal and federation reads hide Trash', async () => {
    const storeId = randomUUID(),
      row = await event(storeId);
    const tag = await database.client.tag.create({
      data: { storeId, name: 'Topic', color: '#123456' },
    });
    await database.client.eventTag.create({ data: { storeId, eventId: row.id, tagId: tag.id } });
    const session = await database.client.session.create({
      data: {
        storeId,
        eventId: row.id,
        title: 'Talk',
        position: 0,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
      },
    });
    expect(await query(publish, { ids: [row.id] }, storeId)).toHaveProperty(
      'data.setReferenceEventsStatus.count',
      1,
    );
    expect(await query(trash, { ids: [row.id] }, storeId)).toHaveProperty(
      'data.trashReferenceEvents.count',
      1,
    );
    expect(await query('{referenceEvents{total}}', {}, storeId)).toHaveProperty(
      'data.referenceEvents.total',
      0,
    );
    expect(
      await query('{referenceEvents(filter:{trashed:true}){total}}', {}, storeId),
    ).toHaveProperty('data.referenceEvents.total', 1);
    expect(
      await query('query($id:ID!){referenceEvent(id:$id){id}}', { id: row.id }, storeId),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    expect(
      await query(
        'query($id:ID!){referenceEvent(id:$id,includeDeleted:true){id status deletedAt}}',
        { id: row.id },
        storeId,
      ),
    ).toMatchObject({
      data: { referenceEvent: { id: row.id, status: 'PUBLISHED', deletedAt: expect.any(String) } },
    });
    expect(
      await query(
        'query($refs:[_Any!]!){_entities(representations:$refs){...on ReferenceEvent{id}}}',
        { refs: [{ __typename: 'ReferenceEvent', id: row.id }] },
        storeId,
      ),
    ).toHaveProperty('errors');
    expect(
      await query(update, { id: row.id, input: { title: 'Blocked' } }, storeId),
    ).toHaveProperty('errors');
    expect(
      await query(
        'query($eventId:ID!){referenceSessions(eventId:$eventId){id}}',
        { eventId: row.id },
        storeId,
      ),
    ).toHaveProperty('errors');
    expect(await query(create, { input: valid }, storeId)).toHaveProperty('errors');
    requireStore.mockClear();
    expect(
      await query(
        'mutation($id:ID!){restoreReferenceEvent(id:$id){id deletedAt status tagIds}}',
        { id: row.id },
        storeId,
      ),
    ).toMatchObject({
      data: {
        restoreReferenceEvent: {
          id: row.id,
          deletedAt: null,
          status: 'PUBLISHED',
          tagIds: [tag.id],
        },
      },
    });
    expect(await database.client.session.findUnique({ where: { id: session.id } })).not.toBeNull();
    expect(requireStore).not.toHaveBeenCalled();
    expect(await query(history, { eventId: row.id }, storeId)).toMatchObject({
      data: {
        referenceEventHistory: {
          total: 4,
          items: expect.arrayContaining([
            { id: expect.any(String), operation: 'RESTORED', actor: 'Anonymous', changes: [] },
          ]),
        },
      },
    });
  });
  it('rejects invalid, foreign and mixed-state batches without partial writes or history', async () => {
    const storeId = randomUUID(),
      a = await event(storeId, 'A'),
      b = await event(storeId, 'B'),
      foreign = await event(randomUUID());
    for (const ids of [
      [],
      [a.id, a.id],
      [a.id, 'bad'],
      Array.from({ length: 101 }, () => randomUUID()),
      [a.id, randomUUID()],
      [a.id, foreign.id],
    ]) {
      expect(await query(publish, { ids }, storeId)).toHaveProperty('errors');
      expect((await database.client.event.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(
        'DRAFT',
      );
    }
    await query(trash, { ids: [b.id] }, storeId);
    for (const source of [publish, trash, restore])
      expect(await query(source, { ids: [a.id, b.id] }, storeId)).toHaveProperty('errors');
    expect(await database.client.eventHistory.count({ where: { storeId } })).toBe(3);
    expect(await query(history, { eventId: a.id }, foreign.storeId)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(await query(restore, { ids: [b.id] }, foreign.storeId)).toHaveProperty('errors');
    expect(
      await query(
        'query($id:ID!){referenceEvent(id:$id,includeDeleted:true){id}}',
        { id: b.id },
        foreign.storeId,
      ),
    ).toHaveProperty('errors');
    await expect(
      database.client.eventHistory.create({
        data: { storeId: foreign.storeId, eventId: a.id, operation: 'UPDATED', changes: [] },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  it('rolls back all updates and already-written history if recording the batch fails', async () => {
    const storeId = randomUUID(),
      a = await event(storeId, 'A'),
      b = await event(storeId, 'B');
    const original = audit.recordMany.bind(audit);
    const failure = jest.spyOn(audit, 'recordMany').mockImplementationOnce(async (...args) => {
      await original(...args);
      throw new Error('Test audit failure');
    });
    try {
      expect(await query(publish, { ids: [a.id, b.id] }, storeId)).toHaveProperty('errors');
    } finally {
      failure.mockRestore();
    }
    expect(await database.client.event.count({ where: { storeId, status: 'DRAFT' } })).toBe(2);
    expect(await database.client.eventHistory.count({ where: { storeId } })).toBe(2);
  });
  it('handles 100 selected events atomically, skips unchanged statuses and serializes restore', async () => {
    const storeId = randomUUID();
    const rows = await database.client.event.createManyAndReturn({
      data: Array.from({ length: 100 }, (_, index) => ({
        ...valid,
        format: 'ONLINE',
        storeId,
        code: `BULK-${String(index)}`,
      })),
    });
    const ids = rows.map((row) => row.id);
    expect(await query(publish, { ids }, storeId)).toHaveProperty(
      'data.setReferenceEventsStatus.count',
      100,
    );
    expect(
      await database.client.eventHistory.count({ where: { storeId, operation: 'UPDATED' } }),
    ).toBe(100);
    await query(publish, { ids }, storeId);
    expect(await database.client.eventHistory.count({ where: { storeId } })).toBe(100);
    expect(await query(trash, { ids }, storeId)).toHaveProperty(
      'data.trashReferenceEvents.count',
      100,
    );
    const results = await Promise.all([
      query(restore, { ids }, storeId),
      query(restore, { ids: [...ids].reverse() }, storeId),
    ]);
    expect(
      results.filter(
        (result) => typeof result === 'object' && result !== null && 'errors' in result,
      ),
    ).toHaveLength(1);
    expect(
      await database.client.event.count({
        where: { storeId, deletedAt: null, status: 'PUBLISHED' },
      }),
    ).toBe(100);
    expect(
      await database.client.eventHistory.count({ where: { storeId, operation: 'RESTORED' } }),
    ).toBe(100);
  });
  it('records actual bounded changes, ignores no-ops and invalid edits, and paginates consistently', async () => {
    const storeId = randomUUID(),
      row = await event(storeId);
    await query(update, { id: row.id, input: { title: valid.title } }, storeId);
    await query(update, { id: row.id, input: { title: null } }, storeId);
    expect(await database.client.eventHistory.count({ where: { eventId: row.id } })).toBe(1);
    const first = `<p>${'x'.repeat(600)}a</p>`,
      second = `<p>${'x'.repeat(600)}b</p>`;
    await query(update, { id: row.id, input: { descriptionHtml: first } }, storeId);
    await query(update, { id: row.id, input: { descriptionHtml: second } }, storeId);
    const page = await audit.list(storeId, row.id, 0, 2);
    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(2);
    for (const entry of page.items) {
      expect(entry.operation).toBe('UPDATED');
      expect(entry.changes[0]?.after).toHaveLength(501);
    }
    expect(await query(history, { eventId: row.id, offset: 2, limit: 2 }, storeId)).toMatchObject({
      data: {
        referenceEventHistory: { total: 3, offset: 2, limit: 2, items: [{ operation: 'CREATED' }] },
      },
    });
  });
});
