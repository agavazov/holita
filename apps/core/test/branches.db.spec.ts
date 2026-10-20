import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestDatabase } from './test-database.js';
import { branchSeeds, seedBranches } from '../prisma/seed-data.js';

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
    selectedBranchId?: string,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${issueDemoToken(scopeTenantId)}`,
        'content-type': 'application/json',
        'x-request-id': 'core-test-request',
        ...(selectedBranchId === undefined ? {} : { 'x-branch-id': selectedBranchId }),
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

  it('renames the selected Branch durably without changing IDs or allowing seeds to overwrite it', async () => {
    await seedBranches(database.client);
    const [seed] = branchSeeds;
    if (!seed) {
      throw new Error('Missing stable Branch seed.');
    }
    const before = await database.client.branch.findUniqueOrThrow({
      where: { id: seed.id, tenantId },
    });
    const name = '🚚'.repeat(80);
    expect(
      await query(
        'mutation($id:ID!,$name:String!){updateBranchName(id:$id,name:$name){id name}}',
        { id: seed.id.toUpperCase(), name: `  ${name}  ` },
        tenantId,
        seed.id.toUpperCase(),
      ),
    ).toEqual({ data: { updateBranchName: { id: seed.id, name } } });
    await seedBranches(database.client);
    const after = await database.client.branch.findUniqueOrThrow({
      where: { id: seed.id, tenantId },
    });
    expect(after).toMatchObject({ id: before.id, tenantId, name, createdAt: before.createdAt });
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
    expect(await query('{branches{id name}}')).toMatchObject({
      data: { branches: expect.arrayContaining([{ id: seed.id, name }]) },
    });
    expect(
      await query(
        'query($refs:[_Any!]!){_entities(representations:$refs){...on Branch{id name}}}',
        {
          refs: [{ __typename: 'Branch', id: seed.id, name: 'Stale name' }],
        },
      ),
    ).toEqual({ data: { _entities: [{ id: seed.id, name }] } });
  });

  it('rejects invalid names without writing and exposes the supported name field error', async () => {
    const branch = await database.client.branch.create({ data: { tenantId, name: 'Preserved' } });
    const mutation =
      'mutation($id:ID!,$name:String!){updateBranchName(id:$id,name:$name){id name}}';
    for (const name of ['', ' \t ', 'x'.repeat(81), '🚚'.repeat(81), 'Fleet\u0000name']) {
      expect(await query(mutation, { id: branch.id, name }, tenantId, branch.id)).toMatchObject({
        data: null,
        errors: [
          {
            extensions: {
              code: 'BAD_USER_INPUT',
              requestId: 'core-test-request',
              fieldErrors: [{ path: 'name', message: 'Use 1 to 80 supported characters.' }],
            },
          },
        ],
      });
    }
    expect(await database.client.branch.findUnique({ where: { id: branch.id, tenantId } })).toEqual(
      branch,
    );
  });

  it('requires selected context and cannot rename a missing or foreign Branch', async () => {
    const branch = await database.client.branch.create({ data: { tenantId, name: 'Own Branch' } });
    const otherTenant = await database.client.tenant.create({
      data: { name: `Rename tenant ${randomUUID()}` },
    });
    const foreign = await database.client.branch.create({
      data: { tenantId: otherTenant.id, name: 'Foreign Branch' },
    });
    const mutation =
      'mutation($id:ID!,$name:String!){updateBranchName(id:$id,name:$name){id name}}';
    for (const selected of [undefined, 'invalid', foreign.id]) {
      expect(
        await query(mutation, { id: branch.id, name: 'Blocked' }, tenantId, selected),
      ).toMatchObject({ data: null, errors: [{ extensions: { code: 'BAD_USER_INPUT' } }] });
    }
    for (const id of [randomUUID(), foreign.id]) {
      expect(await query(mutation, { id, name: 'Blocked' }, tenantId, id)).toMatchObject({
        data: null,
        errors: [{ message: 'Branch not found', extensions: { code: 'NOT_FOUND' } }],
      });
    }
    const unauthenticated = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-branch-id': branch.id,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({ query: mutation, variables: { id: branch.id, name: 'Blocked' } }),
      signal: AbortSignal.timeout(5000),
    });
    expect(await unauthenticated.json()).toMatchObject({
      data: null,
      errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
    });
    expect(await database.client.branch.findUnique({ where: { id: branch.id, tenantId } })).toEqual(
      branch,
    );
    expect(
      await database.client.branch.findUnique({
        where: { id: foreign.id, tenantId: otherTenant.id },
      }),
    ).toEqual(foreign);
  });
});
