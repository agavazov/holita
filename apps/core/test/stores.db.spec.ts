import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestDatabase } from './test-database.js';

describe('Stores GraphQL with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client })
      .compile();
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

  async function query(source: string, variables: Record<string, unknown> = {}) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'core-test-request' },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(5000),
    });
    expect(response.headers.get('x-request-id')).toBe('core-test-request');
    const body: unknown = await response.json();
    return body;
  }

  it('lists stores without selected store context in deterministic order', async () => {
    const z = await database.client.store.create({ data: { name: 'Z store' } });
    const a = await database.client.store.create({ data: { name: 'A store' } });
    expect(await query('{ stores { id name } }')).toEqual({
      data: {
        stores: [
          { id: a.id, name: a.name },
          { id: z.id, name: z.name },
        ],
      },
    });
  });
  it('looks up a real store and returns null for an unknown UUID', async () => {
    const store = await database.client.store.create({ data: { name: 'Lookup' } });
    expect(await query('query($id:ID!){store(id:$id){id name}}', { id: store.id })).toEqual({
      data: { store: { id: store.id, name: store.name } },
    });
    expect(await query('query($id:ID!){store(id:$id){id}}', { id: randomUUID() })).toEqual({
      data: { store: null },
    });
  });
  it('validates UUIDs and resolves actual federation references', async () => {
    const store = await database.client.store.create({ data: { name: 'Federated' } });
    expect(await query('query($id:ID!){store(id:$id){id}}', { id: 'invalid' })).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
    });
    expect(
      await query('query($refs:[_Any!]!){_entities(representations:$refs){...on Store{id name}}}', {
        refs: [{ __typename: 'Store', id: store.id, name: 'Spoofed' }],
      }),
    ).toEqual({ data: { _entities: [{ id: store.id, name: store.name }] } });
  });
});
