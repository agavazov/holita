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
});
