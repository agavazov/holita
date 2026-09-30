import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { CoreClient } from '../src/core/core.client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestDatabase } from './test-database.js';

const create =
  'mutation($input:CreateReferenceVenueInput!){createReferenceVenue(input:$input){id storeId name city countryCode active capacity address description}}';
const read = 'query($id:ID!){referenceVenue(id:$id){id name storeId}}';
const update =
  'mutation($id:ID!,$input:UpdateReferenceVenueInput!){updateReferenceVenue(id:$id,input:$input){id name storeId capacity address}}';
const remove = 'mutation($id:ID!){deleteReferenceVenue(id:$id){id}}';
const list =
  'query($offset:Int! = 0,$limit:Int! = 20){referenceVenues(offset:$offset,limit:$limit){items{id storeId} total}}';

describe('Venue GraphQL with PostgreSQL', () => {
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
  it('creates normalized fields and applies explicit-null updates without a core call', async () => {
    const storeId = randomUUID();
    expect(
      await query(
        create,
        {
          input: {
            name: '  Hall  ',
            city: ' Sofia ',
            countryCode: 'bg',
            capacity: 50,
            address: ' First street ',
          },
        },
        storeId,
      ),
    ).toMatchObject({
      data: {
        createReferenceVenue: {
          name: 'Hall',
          city: 'Sofia',
          countryCode: 'BG',
          active: true,
          capacity: 50,
          address: 'First street',
        },
      },
    });
    expect(requireStore).toHaveBeenCalledTimes(1);
    const row = await database.client.venue.findFirstOrThrow({ where: { storeId } });
    requireStore.mockClear();
    expect(
      await query(update, { id: row.id, input: { capacity: null, address: null } }, storeId),
    ).toMatchObject({
      data: { updateReferenceVenue: { name: 'Hall', capacity: null, address: null } },
    });
    expect(await query(remove, { id: row.id }, storeId)).toEqual({
      data: { deleteReferenceVenue: { id: row.id } },
    });
    expect(requireStore).not.toHaveBeenCalled();
  });
  it('hides foreign IDs in CRUD and federation representations', async () => {
    const storeId = randomUUID();
    const row = await database.client.venue.create({
      data: { storeId, name: 'Owner venue', city: 'Sofia', countryCode: 'BG' },
    });
    const foreign = randomUUID();
    for (const source of [read, update, remove])
      expect(await query(source, { id: row.id, input: { name: 'Wrong' } }, foreign)).toMatchObject({
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    const entity =
      'query($refs:[_Any!]!){_entities(representations:$refs){...on ReferenceVenue{id name storeId}}}';
    const variables = {
      refs: [{ __typename: 'ReferenceVenue', id: row.id, name: 'Spoofed', storeId: foreign }],
    };
    expect(await query(entity, variables, storeId)).toEqual({
      data: { _entities: [{ id: row.id, name: row.name, storeId }] },
    });
    expect(await query(entity, variables, foreign)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(await database.client.venue.findUnique({ where: { id: row.id, storeId } })).toEqual(row);
  });
  it('requires context and rejects invalid or reassigned fields without writes', async () => {
    const valid = { name: 'Venue', city: 'City', countryCode: 'BG' };
    for (const storeId of [undefined, 'bad'])
      for (const source of [list, read, create, update, remove])
        expect(await query(source, { id: randomUUID(), input: valid }, storeId)).toMatchObject({
          errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
        });
    const storeId = randomUUID();
    for (const input of [
      { ...valid, capacity: 0 },
      { ...valid, city: 'Bad\u0000' },
      { ...valid, storeId },
      { ...valid, name: 'x'.repeat(201) },
    ])
      expect(await query(create, { input }, storeId)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
    for (const input of [{}, { name: null }, { active: null }])
      expect(await query(update, { id: randomUUID(), input }, storeId)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
    expect(await database.client.venue.count({ where: { storeId } })).toBe(0);
    expect(requireStore).not.toHaveBeenCalled();
  });
  it('paginates only the selected store with a stable tie breaker', async () => {
    const storeId = randomUUID();
    const ids = [randomUUID(), randomUUID(), randomUUID()].sort().reverse();
    for (const id of ids)
      await database.client.venue.create({
        data: {
          id,
          storeId,
          name: 'Same',
          city: 'Sofia',
          countryCode: 'BG',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      });
    expect(await query(list, { offset: 1, limit: 1 }, storeId)).toEqual({
      data: { referenceVenues: { items: [{ id: ids[1], storeId }], total: 3 } },
    });
    expect(await query(list, {}, randomUUID())).toEqual({
      data: { referenceVenues: { items: [], total: 0 } },
    });
  });
  it('sorts filtered venues before pagination with stable ties, nulls last and store isolation', async () => {
    const storeId = randomUUID();
    const ids: [string, string, string, string] = [
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
    ];
    const [low, middle, high, top] = ids.sort();
    await database.client.venue.createMany({
      data: [
        {
          id: low,
          storeId,
          name: 'Order Alpha',
          city: 'Sofia',
          countryCode: 'BG',
          capacity: 100,
          active: true,
          createdAt: new Date('2026-01-01'),
        },
        {
          id: middle,
          storeId,
          name: 'Order Beta',
          city: 'Athens',
          countryCode: 'GR',
          capacity: 25,
          active: false,
          createdAt: new Date('2026-01-01'),
        },
        {
          id: high,
          storeId,
          name: 'Order Alpha',
          city: 'Sofia',
          countryCode: 'BG',
          capacity: 100,
          active: true,
          createdAt: new Date('2026-01-02'),
        },
        {
          id: top,
          storeId,
          name: 'Order Gamma',
          city: 'Varna',
          countryCode: 'BG',
          capacity: null,
          active: false,
          createdAt: new Date('2026-01-03'),
        },
        { storeId, name: 'Other', city: 'Sofia', countryCode: 'BG' },
        { storeId: randomUUID(), name: 'Order Foreign', city: 'Sofia', countryCode: 'BG' },
      ],
    });
    const sorted =
      'query($sort:ReferenceVenueSort,$active:Boolean,$offset:Int!=0,$limit:Int!=20){referenceVenues(search:"order",active:$active,sort:$sort,offset:$offset,limit:$limit){items{id}total}}';
    for (const { field, asc, desc } of [
      { field: 'NAME', asc: [high, low, middle, top], desc: [top, middle, high, low] },
      { field: 'CITY', asc: [middle, high, low, top], desc: [top, high, low, middle] },
      { field: 'COUNTRY_CODE', asc: [top, high, low, middle], desc: [middle, top, high, low] },
      { field: 'CAPACITY', asc: [middle, high, low, top], desc: [high, low, middle, top] },
      { field: 'ACTIVE', asc: [high, low, top, middle], desc: [top, middle, high, low] },
      { field: 'CREATED_AT', asc: [middle, low, high, top], desc: [top, high, middle, low] },
    ]) {
      for (const [direction, expected] of [
        ['ASC', asc],
        ['DESC', desc],
      ] as const) {
        expect(await query(sorted, { sort: { field, direction } }, storeId)).toEqual({
          data: { referenceVenues: { items: expected.map((id) => ({ id })), total: 4 } },
        });
        expect(
          await query(sorted, { sort: { field, direction }, offset: 1, limit: 2 }, storeId),
        ).toEqual({
          data: {
            referenceVenues: { items: expected.slice(1, 3).map((id) => ({ id })), total: 4 },
          },
        });
      }
    }
    expect(
      await query(
        sorted,
        { sort: { field: 'NAME', direction: 'ASC' }, active: true, offset: 1, limit: 1 },
        storeId,
      ),
    ).toEqual({
      data: { referenceVenues: { items: [{ id: low }], total: 2 } },
    });
    expect(
      await query(sorted, { sort: { field: 'NAME', direction: 'ASC' }, active: false }, storeId),
    ).toEqual({
      data: { referenceVenues: { items: [{ id: middle }, { id: top }], total: 2 } },
    });
    expect(requireStore).not.toHaveBeenCalled();
  });

  it('treats lookup punctuation literally and rejects unsupported sorting', async () => {
    const storeId = randomUUID();
    const row = await database.client.venue.create({
      data: { storeId, name: 'Hall 100%_edition', city: 'Sofia', countryCode: 'BG' },
    });
    await database.client.venue.create({
      data: { storeId, name: 'Hall normal', city: 'Sofia', countryCode: 'BG' },
    });
    const source =
      'query($search:String,$sort:ReferenceVenueSort){referenceVenues(search:$search,sort:$sort){items{id}total}}';
    expect(await query(source, { search: '%_' }, storeId)).toEqual({
      data: { referenceVenues: { items: [{ id: row.id }], total: 1 } },
    });
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
  });

  it('refuses to delete a venue referenced by an event', async () => {
    const storeId = randomUUID();
    const row = await database.client.venue.create({
      data: { storeId, name: 'Used venue', city: 'Sofia', countryCode: 'BG' },
    });
    await database.client.event.create({
      data: {
        storeId,
        venueId: row.id,
        title: 'Existing event',
        code: 'USED',
        format: 'IN_PERSON',
        startsAt: new Date('2026-10-01T09:00:00Z'),
        endsAt: new Date('2026-10-01T10:00:00Z'),
      },
    });
    expect(await query(remove, { id: row.id }, storeId)).toMatchObject({
      errors: [
        {
          message: 'Venue is still referenced by another record.',
          extensions: { code: 'CONFLICT' },
        },
      ],
    });
    expect(await database.client.venue.findUnique({ where: { id: row.id, storeId } })).toEqual(row);
    expect(requireStore).not.toHaveBeenCalled();
  });
});
