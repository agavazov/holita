import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { CoreClient } from '../src/core/core.client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestDatabase } from './test-database.js';

import { seedReference, speakerSeeds, tagSeeds } from '../prisma/seed-data.js';
const create =
  'mutation($input:CreateReferenceEventInput!){createReferenceEvent(input:$input){id storeId code budget capacity featured startsAt endsAt registrationOpensOn registrationClosesOn venueId meetingUrl tagIds summary descriptionHtml}}';
const update =
  'mutation($id:ID!,$input:UpdateReferenceEventInput!){updateReferenceEvent(id:$id,input:$input){id title code budget summary descriptionHtml format venueId meetingUrl tagIds}}';
const read = 'query($id:ID!){referenceEvent(id:$id){id code}}';
const remove = 'mutation($id:ID!){deleteReferenceEvent(id:$id){id deletedAt tagIds}}';
const valid = {
  title: 'Forum',
  code: 'DEMO',
  format: 'ONLINE' as const,
  meetingUrl: 'https://example.com/meet',
  startsAt: '2026-11-01T22:30:00Z',
  endsAt: '2026-11-02T12:00:00Z',
};
describe('Event, Speaker and Tag GraphQL with PostgreSQL', () => {
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
      .useValue({ client: database.client, schema: database.schema })
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
        ...(storeId ? { 'x-store-id': storeId } : {}),
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(5000),
    });
    const body: unknown = await response.json();
    return body;
  }

  it('persists only sanitized descriptions, preserves omission, clears null and rolls back invalid content', async () => {
    const storeId = randomUUID();
    const html =
      '<h2>Welcome</h2><p><strong>Explore</strong> <a href="https://example.com">details</a></p>';
    expect(
      await query(
        create,
        { input: { ...valid, descriptionHtml: html + '<script>alert(1)</script>' } },
        storeId,
      ),
    ).toMatchObject({ data: { createReferenceEvent: { descriptionHtml: html } } });
    const row = await database.client.event.findFirstOrThrow({ where: { storeId } });
    expect(row.descriptionHtml).toBe(html);
    expect(await query(update, { id: row.id, input: { title: 'Changed' } }, storeId)).toMatchObject(
      { data: { updateReferenceEvent: { descriptionHtml: html } } },
    );
    expect(
      await query(
        update,
        { id: row.id, input: { title: 'Must not persist', descriptionHtml: '&'.repeat(22000) } },
        storeId,
      ),
    ).toMatchObject({
      errors: [
        { extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'descriptionHtml' }] } },
      ],
    });
    expect(await database.client.event.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({
      title: 'Changed',
      descriptionHtml: html,
    });
    expect(
      await query(
        update,
        { id: row.id, input: { descriptionHtml: '<p>Foreign</p>' } },
        randomUUID(),
      ),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    expect(
      await query(update, { id: row.id, input: { descriptionHtml: null } }, storeId),
    ).toMatchObject({ data: { updateReferenceEvent: { descriptionHtml: null } } });
    expect(
      (await database.client.event.findUniqueOrThrow({ where: { id: row.id } })).descriptionHtml,
    ).toBeNull();
  });
  it('preserves exact decimals, date-only values, omission, null and immutable codes', async () => {
    const storeId = randomUUID();
    expect(
      await query(
        create,
        {
          input: {
            ...valid,
            title: ' Forum ',
            code: ' DEMO ',
            budget: '9999999999.99',
            featured: true,
            capacity: 80,
            registrationOpensOn: '2026-10-01',
            registrationClosesOn: '2026-11-02',
          },
        },
        storeId,
      ),
    ).toMatchObject({
      data: {
        createReferenceEvent: {
          code: 'DEMO',
          budget: '9999999999.99',
          featured: true,
          capacity: 80,
          registrationClosesOn: '2026-11-02',
          startsAt: valid.startsAt.replace('Z', '.000Z'),
        },
      },
    });
    const row = await database.client.event.findFirstOrThrow({ where: { storeId } });
    requireStore.mockClear();
    expect(
      await query(update, { id: row.id, input: { summary: 'Changed' } }, storeId),
    ).toMatchObject({
      data: {
        updateReferenceEvent: {
          title: 'Forum',
          code: 'DEMO',
          budget: '9999999999.99',
          summary: 'Changed',
        },
      },
    });
    expect(
      await query(update, { id: row.id, input: { budget: null, summary: null } }, storeId),
    ).toMatchObject({ data: { updateReferenceEvent: { budget: null, summary: null } } });
    expect(await query(update, { id: row.id, input: { code: 'NEW' } }, storeId)).toHaveProperty(
      'errors',
    );
    expect(requireStore).not.toHaveBeenCalled();
  });
  it('returns field errors and never writes invalid schedules, decimals or required nulls', async () => {
    const storeId = randomUUID();
    for (const [patch, path] of [
      [{ endsAt: valid.startsAt }, 'endsAt'],
      [{ budget: '1.001' }, 'budget'],
      [{ budget: '-1' }, 'budget'],
      [{ budget: '10000000000' }, 'budget'],
      [{ registrationOpensOn: '2026-02-30' }, 'registrationOpensOn'],
      [{ registrationOpensOn: '2026-10-01' }, 'registrationClosesOn'],
      [
        { registrationOpensOn: '2026-11-03', registrationClosesOn: '2026-11-03' },
        'registrationClosesOn',
      ],
      [{ meetingUrl: 'javascript:alert(1)' }, 'meetingUrl'],
      [{ capacity: 0 }, 'capacity'],
    ] as const)
      expect(await query(create, { input: { ...valid, ...patch } }, storeId)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path }] } }],
      });
    expect(await database.client.event.count({ where: { storeId } })).toBe(0);
    await query(create, { input: valid }, storeId);
    const row = await database.client.event.findFirstOrThrow({ where: { storeId } });
    for (const input of [
      {},
      { title: null },
      { status: null },
      { format: null },
      { startsAt: null },
      { endsAt: null },
      { featured: null },
      { tagIds: null },
    ])
      expect(await query(update, { id: row.id, input }, storeId)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
    expect(await database.client.event.findUnique({ where: { id: row.id } })).toEqual(row);
  });
  it('keeps relations in one store, retains inactive selections and prevents referenced deletion', async () => {
    const storeId = randomUUID(),
      foreign = randomUUID();
    const venue = await database.client.venue.create({
      data: { storeId, name: 'Hall', city: 'Sofia', countryCode: 'BG' },
    });
    const tag = await database.client.tag.create({
      data: { storeId, name: 'Culture', color: '#315ed0' },
    });
    const input = { ...valid, format: 'HYBRID', venueId: venue.id, tagIds: [tag.id] };
    for (const [patch, path] of [
      [{ venueId: venue.id, format: 'IN_PERSON' }, 'venueId'],
      [{ tagIds: [tag.id] }, 'tagIds'],
    ] as const)
      expect(await query(create, { input: { ...valid, ...patch } }, foreign)).toMatchObject({
        errors: [{ extensions: { fieldErrors: [{ path }] } }],
      });
    expect(await query(create, { input }, storeId)).toMatchObject({
      data: { createReferenceEvent: { venueId: venue.id, tagIds: [tag.id] } },
    });
    const row = await database.client.event.findFirstOrThrow({ where: { storeId } });
    await database.client.venue.update({ where: { id: venue.id }, data: { active: false } });
    await database.client.tag.update({ where: { id: tag.id }, data: { active: false } });
    expect(
      await query(update, { id: row.id, input: { title: 'Retained' } }, storeId),
    ).toMatchObject({ data: { updateReferenceEvent: { tagIds: [tag.id], venueId: venue.id } } });
    expect(await query(create, { input: { ...input, code: 'ANOTHER' } }, storeId)).toHaveProperty(
      'errors',
    );
    for (const [entity, id] of [
      ['Venue', venue.id],
      ['Tag', tag.id],
    ] as const)
      expect(
        await query(`mutation($id:ID!){deleteReference${entity}(id:$id){id}}`, { id }, storeId),
      ).toMatchObject({ errors: [{ extensions: { code: 'CONFLICT' } }] });
    expect(
      await query(update, { id: row.id, input: { format: 'ONLINE', tagIds: [] } }, storeId),
    ).toMatchObject({ data: { updateReferenceEvent: { venueId: null, tagIds: [] } } });
    expect(
      await query(update, { id: row.id, input: { tagIds: [tag.id] } }, storeId),
    ).toHaveProperty('errors');
    await expect(
      database.client.eventTag.create({
        data: { storeId: foreign, eventId: row.id, tagId: tag.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      database.client.event.create({
        data: {
          storeId: foreign,
          title: 'Bypass',
          code: 'BYPASS',
          format: 'IN_PERSON',
          venueId: venue.id,
          startsAt: new Date(valid.startsAt),
          endsAt: new Date(valid.endsAt),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  it('clears incompatible format fields and removes an Event from ordinary reads while reserving its code', async () => {
    const storeId = randomUUID();
    const venue = await database.client.venue.create({
      data: { storeId, name: 'Hall', city: 'Sofia', countryCode: 'BG' },
    });
    await query(
      create,
      { input: { ...valid, format: 'IN_PERSON', venueId: venue.id, meetingUrl: 'ignored' } },
      storeId,
    );
    const row = await database.client.event.findFirstOrThrow({ where: { storeId } });
    expect(row.meetingUrl).toBeNull();
    expect(
      await query(
        update,
        { id: row.id, input: { format: 'ONLINE', meetingUrl: valid.meetingUrl } },
        storeId,
      ),
    ).toMatchObject({ data: { updateReferenceEvent: { venueId: null } } });
    expect(await query(remove, { id: row.id }, storeId)).toMatchObject({
      data: { deleteReferenceEvent: { id: row.id, deletedAt: expect.any(String) } },
    });
    expect(await query(read, { id: row.id }, storeId)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(await query('{referenceEvents{total}}', {}, storeId)).toEqual({
      data: { referenceEvents: { total: 0 } },
    });
    expect(await query(create, { input: valid }, storeId)).toMatchObject({
      errors: [{ extensions: { fieldErrors: [{ path: 'code' }] } }],
    });
    expect(await query(create, { input: valid }, randomUUID())).toHaveProperty(
      'data.createReferenceEvent.id',
    );
  });
  it('scopes all CRUD, list and federation lookups for every new entity', async () => {
    const storeId = randomUUID(),
      foreign = randomUUID();
    for (const [entity, input, patch] of [
      ['Event', valid, { title: 'Wrong' }],
      ['Speaker', { name: 'Alex', email: 'alex@example.com' }, { name: 'Wrong' }],
      ['Tag', { name: 'Demo', color: '#315ed0' }, { name: 'Wrong' }],
    ] as const) {
      expect(
        await query(
          `mutation($input:CreateReference${entity}Input!){createReference${entity}(input:$input){id}}`,
          { input },
          storeId,
        ),
      ).toHaveProperty(`data.createReference${entity}.id`);
      const row =
        entity === 'Event'
          ? await database.client.event.findFirstOrThrow({ where: { storeId } })
          : entity === 'Speaker'
            ? await database.client.speaker.findFirstOrThrow({ where: { storeId } })
            : await database.client.tag.findFirstOrThrow({ where: { storeId } });
      for (const source of [
        `query($id:ID!){reference${entity}(id:$id){id}}`,
        `mutation($id:ID!,$input:UpdateReference${entity}Input!){updateReference${entity}(id:$id,input:$input){id}}`,
        `mutation($id:ID!){deleteReference${entity}(id:$id){id}}`,
      ])
        expect(await query(source, { id: row.id, input: patch }, foreign)).toMatchObject({
          errors: [{ extensions: { code: 'NOT_FOUND' } }],
        });
      expect(await query(`{reference${entity}s{total}}`, {}, foreign)).toEqual({
        data: { [`reference${entity}s`]: { total: 0 } },
      });
      expect(
        await query(
          `query($refs:[_Any!]!){_entities(representations:$refs){...on Reference${entity}{id storeId}}}`,
          { refs: [{ __typename: `Reference${entity}`, id: row.id }] },
          foreign,
        ),
      ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    }
  });
  it('searches and paginates active choices and resolves only bounded selected IDs including inactive rows', async () => {
    const storeId = randomUUID();
    const records = await database.client.tag.createManyAndReturn({
      data: Array.from({ length: 23 }, (_, index) => ({
        storeId,
        name: `Topic ${String(index).padStart(2, '0')}`,
        color: '#315ed0',
        active: index !== 22,
      })),
    });
    const inactive = records.find((row) => !row.active);
    if (!inactive) throw new Error('Missing fixture');
    const source =
      'query($offset:Int,$limit:Int,$search:String,$active:Boolean,$ids:[ID!]){referenceTags(offset:$offset,limit:$limit,search:$search,active:$active,ids:$ids){items{id name active}total}}';
    expect(
      await query(source, { offset: 20, limit: 20, search: 'topic', active: true }, storeId),
    ).toMatchObject({ data: { referenceTags: { total: 22, items: expect.any(Array) } } });
    expect(await query(source, { ids: [inactive.id] }, storeId)).toMatchObject({
      data: { referenceTags: { total: 1, items: [{ id: inactive.id, active: false }] } },
    });
    expect(await query(source, { ids: [inactive.id] }, randomUUID())).toMatchObject({
      data: { referenceTags: { total: 0, items: [] } },
    });
    for (const ids of [Array.from({ length: 101 }, () => randomUUID()), [inactive.id, inactive.id]])
      expect(await query(source, { ids }, storeId)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
  });
  it('treats punctuation literally in Venue, Speaker and Tag autocomplete searches', async () => {
    const storeId = randomUUID();
    const rows = ['100%_match', 'Other'].map((name) => ({ storeId, name }));
    await database.client.venue.createMany({
      data: rows.map((row) => ({ ...row, city: 'Sofia', countryCode: 'BG' })),
    });
    await database.client.speaker.createMany({ data: rows });
    await database.client.tag.createMany({
      data: rows.map((row) => ({ ...row, color: '#1677ff' })),
    });
    for (const field of ['referenceVenues', 'referenceSpeakers', 'referenceTags'])
      expect(
        await query(
          `query($search:String){${field}(search:$search){total items{name}}}`,
          { search: '%_' },
          storeId,
        ),
      ).toMatchObject({
        data: { [field]: { total: 1, items: [{ name: '100%_match' }] } },
      });
  });
  it('validates supporting fields, allows nullable edits, and enforces tag name uniqueness per store', async () => {
    const storeId = randomUUID();
    const speakerCreate =
      'mutation($input:CreateReferenceSpeakerInput!){createReferenceSpeaker(input:$input){id name email shortBio active}}';
    expect(
      await query(speakerCreate, { input: { name: 'Alex', email: 'bad' } }, storeId),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'email' }] } }] });
    await query(
      speakerCreate,
      { input: { name: ' Alex ', email: 'alex@example.com', shortBio: 'Bio', active: false } },
      storeId,
    );
    const speaker = await database.client.speaker.findFirstOrThrow({ where: { storeId } });
    expect(
      await query(
        'mutation($id:ID!){updateReferenceSpeaker(id:$id,input:{email:null,shortBio:null}){name email shortBio active}}',
        { id: speaker.id },
        storeId,
      ),
    ).toEqual({
      data: {
        updateReferenceSpeaker: { name: 'Alex', email: null, shortBio: null, active: false },
      },
    });
    const tagCreate =
      'mutation($input:CreateReferenceTagInput!){createReferenceTag(input:$input){id name color}}';
    expect(
      await query(tagCreate, { input: { name: 'Tag', color: 'red' } }, storeId),
    ).toHaveProperty('errors');
    const input = { name: ' Tag ', color: '#AABBCC' };
    expect(await query(tagCreate, { input }, storeId)).toMatchObject({
      data: { createReferenceTag: { name: 'Tag', color: '#aabbcc' } },
    });
    expect(await query(tagCreate, { input }, storeId)).toMatchObject({
      errors: [{ extensions: { fieldErrors: [{ path: 'name' }] } }],
    });
    expect(await query(tagCreate, { input }, randomUUID())).toHaveProperty(
      'data.createReferenceTag.id',
    );
    expect(
      await query(
        'mutation($id:ID!){deleteReferenceSpeaker(id:$id){id}}',
        { id: speaker.id },
        storeId,
      ),
    ).toHaveProperty('data.deleteReferenceSpeaker.id');
  });
  it.each(['Speaker', 'Tag'])(
    'sorts %s lookups before pagination with stable ties and scoped filters',
    async (entity) => {
      const storeId = randomUUID();
      const [low, middle, high] = [randomUUID(), randomUUID(), randomUUID()].sort();
      if (!low || !middle || !high) throw new Error('Missing fixture IDs');
      const rows = [
        { id: low, storeId, name: 'Order Alpha', active: true, createdAt: new Date('2026-01-01') },
        {
          id: middle,
          storeId,
          name: 'Order Beta',
          active: false,
          createdAt: new Date('2026-01-01'),
        },
        { id: high, storeId, name: 'Order Gamma', active: true, createdAt: new Date('2026-01-02') },
        {
          id: randomUUID(),
          storeId,
          name: 'Other',
          active: true,
          createdAt: new Date('2026-01-03'),
        },
        {
          id: randomUUID(),
          storeId: randomUUID(),
          name: 'Order Foreign',
          active: true,
          createdAt: new Date('2026-01-03'),
        },
      ];
      if (entity === 'Speaker') {
        await database.client.speaker.createMany({
          data: rows.map((row, index) => ({
            ...row,
            email: ['z@example.com', 'a@example.com'][index] ?? null,
          })),
        });
      } else {
        await database.client.tag.createMany({
          data: rows.map((row, index) => ({ ...row, color: index === 1 ? '#111111' : '#bbbbbb' })),
        });
      }
      const fieldName = `reference${entity}s`;
      const source = `query($sort:Reference${entity}Sort,$active:Boolean,$ids:[ID!],$offset:Int!=0,$limit:Int!=20){${fieldName}(search:"order",active:$active,ids:$ids,sort:$sort,offset:$offset,limit:$limit){items{id}total}}`;
      const orderings = [
        { field: 'NAME', asc: [low, middle, high], desc: [high, middle, low] },
        { field: 'ACTIVE', asc: [high, low, middle], desc: [middle, high, low] },
        { field: 'CREATED_AT', asc: [middle, low, high], desc: [high, middle, low] },
        entity === 'Speaker'
          ? { field: 'EMAIL', asc: [middle, low, high], desc: [low, middle, high] }
          : { field: 'COLOR', asc: [middle, high, low], desc: [high, low, middle] },
      ];
      for (const { field, asc, desc } of orderings) {
        for (const [direction, expected] of [
          ['ASC', asc],
          ['DESC', desc],
        ] as const) {
          expect(await query(source, { sort: { field, direction } }, storeId)).toEqual({
            data: { [fieldName]: { items: expected.map((id) => ({ id })), total: 3 } },
          });
          expect(
            await query(source, { sort: { field, direction }, offset: 1, limit: 1 }, storeId),
          ).toEqual({ data: { [fieldName]: { items: [{ id: expected[1] }], total: 3 } } });
        }
      }
      expect(await query(source, {}, storeId)).toEqual({
        data: { [fieldName]: { items: [high, middle, low].map((id) => ({ id })), total: 3 } },
      });
      expect(
        await query(source, { sort: { field: 'NAME', direction: 'ASC' }, active: false }, storeId),
      ).toEqual({ data: { [fieldName]: { items: [{ id: middle }], total: 1 } } });
      expect(
        await query(source, { sort: { field: 'NAME', direction: 'ASC' }, ids: [high] }, storeId),
      ).toEqual({ data: { [fieldName]: { items: [{ id: high }], total: 1 } } });
      for (const sort of [
        { field: 'STORE_ID' },
        { field: 'NAME', direction: 'SIDEWAYS' },
        { field: null },
      ]) {
        expect(await query(source, { sort }, storeId)).toMatchObject({
          errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
        });
      }
      expect(requireStore).not.toHaveBeenCalled();
    },
  );
  it('inserts missing demonstration fixtures without overwriting edited rows', async () => {
    await seedReference(database.client);
    const speaker = speakerSeeds[0],
      tag = tagSeeds[0];
    if (!speaker || !tag) throw new Error('Missing fixtures');
    await database.client.speaker.update({
      where: { id: speaker.id },
      data: { name: 'Edited speaker' },
    });
    await database.client.tag.update({ where: { id: tag.id }, data: { color: '#ffffff' } });
    await database.client.event.update({
      where: { id: '60000000-0000-4000-8000-000000000001' },
      data: { title: 'Edited forum' },
    });
    await seedReference(database.client);
    expect(
      (await database.client.speaker.findUniqueOrThrow({ where: { id: speaker.id } })).name,
    ).toBe('Edited speaker');
    expect((await database.client.tag.findUniqueOrThrow({ where: { id: tag.id } })).color).toBe(
      '#ffffff',
    );
    expect(
      (
        await database.client.event.findUniqueOrThrow({
          where: { id: '60000000-0000-4000-8000-000000000001' },
        })
      ).title,
    ).toBe('Edited forum');
  });
  it('combines filters with AND, alternatives with OR, and returns scoped relation labels', async () => {
    const storeId = randomUUID(),
      foreign = randomUUID();
    const venue = await database.client.venue.create({
      data: { storeId, name: 'Inactive hall', city: 'Sofia', countryCode: 'BG', active: false },
    });
    const tags = await Promise.all(
      ['Culture', 'Workshop'].map((name) =>
        database.client.tag.create({ data: { storeId, name, color: '#315ed0', active: false } }),
      ),
    );
    const rows = await Promise.all(
      ['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((status, index) =>
        database.client.event.create({
          data: {
            ...valid,
            storeId,
            id: randomUUID(),
            code: `CODE-${String(index)}`,
            title: index === 1 ? 'Other title' : 'Forum',
            status:
              status === 'DRAFT' ? 'DRAFT' : status === 'PUBLISHED' ? 'PUBLISHED' : 'ARCHIVED',
            format: index === 1 ? 'HYBRID' : 'IN_PERSON',
            venueId: venue.id,
            featured: false,
            capacity: 50 + index,
            tags: { create: [{ tagId: tags[index % 2]?.id ?? '' }] },
          },
        }),
      ),
    );
    await database.client.event.create({
      data: { ...valid, storeId: foreign, code: 'CODE-foreign' },
    });
    await database.client.event.create({
      data: { ...valid, storeId, code: 'CODE-deleted', deletedAt: new Date() },
    });
    const filter = {
      search: ' coDe- ',
      statuses: ['DRAFT', 'PUBLISHED'],
      formats: ['IN_PERSON', 'HYBRID'],
      venueIds: [venue.id],
      tagIds: tags.map((tag) => tag.id),
      featured: false,
      capacityMin: 50,
      capacityMax: 51,
    };
    const source =
      'query($filter:ReferenceEventFilter){referenceEvents(filter:$filter){total items{id venue{id name active} tags{id name active}}}}';
    const response = await query(source, { filter }, storeId);
    expect(response).toMatchObject({
      data: {
        referenceEvents: {
          total: 2,
          items: expect.arrayContaining(
            rows.slice(0, 2).map((row) => ({
              id: row.id,
              venue: { id: venue.id, name: venue.name, active: false },
              tags: expect.arrayContaining([
                { id: expect.any(String), name: expect.any(String), active: false },
              ]),
            })),
          ),
        },
      },
    });
    expect(await query(source, { filter: { ...filter, featured: true } }, storeId)).toMatchObject({
      data: { referenceEvents: { total: 0, items: [] } },
    });
    expect(
      await query(
        source,
        { filter: { venueIds: [venue.id], tagIds: tags.map((tag) => tag.id) } },
        foreign,
      ),
    ).toMatchObject({ data: { referenceEvents: { total: 0, items: [] } } });
    expect(requireStore).not.toHaveBeenCalled();
  });

  it('sorts numeric values and nulls consistently with an ID tie-breaker across pages', async () => {
    const storeId = randomUUID();
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()].sort();
    const data = [
      {
        title: 'Alpha',
        budget: '2',
        capacity: 20,
        status: 'DRAFT' as const,
        startsAt: '2026-11-01T10:00:00Z',
        createdAt: '2026-09-01T10:00:00Z',
      },
      {
        title: 'Alpha',
        budget: '2',
        capacity: 20,
        status: 'DRAFT' as const,
        startsAt: '2026-11-01T10:00:00Z',
        createdAt: '2026-09-01T10:00:00Z',
      },
      {
        title: 'Beta',
        budget: '10',
        capacity: 100,
        status: 'PUBLISHED' as const,
        startsAt: '2026-11-01T11:00:00Z',
        createdAt: '2026-09-02T10:00:00Z',
      },
      {
        title: 'Gamma',
        budget: null,
        capacity: null,
        status: 'ARCHIVED' as const,
        startsAt: '2026-11-01T12:00:00Z',
        createdAt: '2026-09-03T10:00:00Z',
      },
    ];
    await database.client.event.createMany({
      data: ids.map((id, index) => ({
        ...valid,
        ...data[index],
        storeId,
        id,
        code: `SORT-${String(index)}`,
      })),
    });
    const source =
      'query($sort:ReferenceEventSort,$offset:Int!,$limit:Int!){referenceEvents(sort:$sort,offset:$offset,limit:$limit){total offset limit items{id}}}';
    for (const field of ['TITLE', 'STARTS_AT', 'STATUS', 'CAPACITY', 'BUDGET', 'CREATED_AT']) {
      for (const direction of ['ASC', 'DESC']) {
        const expected =
          direction === 'ASC'
            ? ids
            : field === 'CAPACITY' || field === 'BUDGET'
              ? [ids[2], ids[0], ids[1], ids[3]]
              : [ids[3], ids[2], ids[0], ids[1]];
        for (const offset of [0, 2])
          expect(
            await query(source, { sort: { field, direction }, offset, limit: 2 }, storeId),
          ).toMatchObject({
            data: {
              referenceEvents: {
                total: 4,
                offset,
                limit: 2,
                items: expected.slice(offset, offset + 2).map((id) => ({ id })),
              },
            },
          });
      }
    }
    expect(await query('query{referenceEvents{items{id}}}', {}, storeId)).toMatchObject({
      data: { referenceEvents: { items: ids.map((id) => ({ id })) } },
    });
  });

  it('uses inclusive start and exclusive end boundaries and treats search punctuation literally', async () => {
    const storeId = randomUUID();
    // Europe/Sofia 29 March 2026 lasts 23 hours because clocks move forward.
    const starts = [
      '2026-03-28T21:59:59.999Z',
      '2026-03-28T22:00:00.000Z',
      '2026-03-29T20:59:59.999Z',
      '2026-03-29T21:00:00.000Z',
    ];
    await database.client.event.createMany({
      data: starts.map((startsAt, index) => ({
        ...valid,
        storeId,
        code: `BOUNDARY-${String(index)}`,
        title: index === 1 ? '100%_match' : 'Other',
        startsAt,
      })),
    });
    const source =
      'query($filter:ReferenceEventFilter){referenceEvents(filter:$filter){total items{code}}}';
    expect(
      await query(
        source,
        { filter: { startsAtFrom: starts[1], startsAtBefore: starts[3] } },
        storeId,
      ),
    ).toMatchObject({
      data: {
        referenceEvents: { total: 2, items: [{ code: 'BOUNDARY-1' }, { code: 'BOUNDARY-2' }] },
      },
    });
    expect(await query(source, { filter: { search: '%_' } }, storeId)).toMatchObject({
      data: { referenceEvents: { total: 1, items: [{ code: 'BOUNDARY-1' }] } },
    });
  });

  it('rejects invalid list ranges, IDs and unsupported sort fields', async () => {
    const storeId = randomUUID();
    const source =
      'query($filter:ReferenceEventFilter,$sort:ReferenceEventSort){referenceEvents(filter:$filter,sort:$sort){total}}';
    for (const [filter, path] of [
      [{ capacityMin: 0 }, 'capacityMin'],
      [{ capacityMin: 50, capacityMax: 10 }, 'capacityMax'],
      [
        { startsAtFrom: '2026-11-01T12:00:00Z', startsAtBefore: '2026-11-01T12:00:00Z' },
        'startsAtBefore',
      ],
      [{ venueIds: ['wrong'] }, 'venueIds'],
      [{ tagIds: Array.from({ length: 101 }, () => randomUUID()) }, 'tagIds'],
      [{ search: 'x'.repeat(201) }, 'search'],
    ] as const)
      expect(await query(source, { filter }, storeId)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path }] } }],
      });
    expect(await query(source, { sort: { field: 'storeId' } }, storeId)).toHaveProperty('errors');
  });
});
