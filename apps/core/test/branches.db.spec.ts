import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestDatabase } from './test-database.js';

const tenantId = '01000000-0000-4000-8000-000000000001';

describe('Branches GraphQL with PostgreSQL', () => {
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

  async function query(
    source: string,
    variables: Record<string, unknown> = {},
    scopeTenantId = tenantId,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${issueDemoToken(scopeTenantId)}`,
        'content-type': 'application/json',
        'x-request-id': 'core-test-request',
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(5000),
    });
    expect(response.headers.get('x-request-id')).toBe('core-test-request');
    const body: unknown = await response.json();
    return body;
  }

  it('lists branches without selected branch context in deterministic order', async () => {
    const z = await database.client.branch.create({ data: { tenantId, name: 'Z branch' } });
    const a = await database.client.branch.create({ data: { tenantId, name: 'A branch' } });
    expect(await query('{ branches { id name } }')).toEqual({
      data: {
        branches: [
          { id: a.id, name: a.name },
          { id: z.id, name: z.name },
        ],
      },
    });
  });
  it('looks up a real branch and returns null for an unknown UUID', async () => {
    const branch = await database.client.branch.create({ data: { tenantId, name: 'Lookup' } });
    expect(await query('query($id:ID!){branch(id:$id){id name}}', { id: branch.id })).toEqual({
      data: { branch: { id: branch.id, name: branch.name } },
    });
    expect(await query('query($id:ID!){branch(id:$id){id}}', { id: randomUUID() })).toEqual({
      data: { branch: null },
    });
  });
  it('validates UUIDs and resolves actual federation references', async () => {
    const branch = await database.client.branch.create({ data: { tenantId, name: 'Federated' } });
    expect(await query('query($id:ID!){branch(id:$id){id}}', { id: 'invalid' })).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
    });
    expect(
      await query(
        'query($refs:[_Any!]!){_entities(representations:$refs){...on Branch{id name}}}',
        {
          refs: [{ __typename: 'Branch', id: branch.id, name: 'Spoofed' }],
        },
      ),
    ).toEqual({ data: { _entities: [{ id: branch.id, name: branch.name }] } });
  });
  it('scopes discovery, direct lookup and federation references to the session tenant', async () => {
    const otherTenant = await database.client.tenant.create({ data: { name: 'Test tenant' } });
    const foreign = await database.client.branch.create({
      data: { tenantId: otherTenant.id, name: 'Foreign branch' },
    });
    expect(await query('{branches{id name}}', {}, otherTenant.id)).toEqual({
      data: { branches: [{ id: foreign.id, name: foreign.name }] },
    });
    expect(await query('query($id:ID!){branch(id:$id){id}}', { id: foreign.id })).toEqual({
      data: { branch: null },
    });
    expect(
      await query('query($refs:[_Any!]!){_entities(representations:$refs){...on Branch{id}}}', {
        refs: [{ __typename: 'Branch', id: foreign.id, tenantId }],
      }),
    ).toEqual({ data: { _entities: [null] } });
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({ query: '{branches{id}}' }),
    });
    expect(await response.json()).toMatchObject({
      errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
    });
  });
});
