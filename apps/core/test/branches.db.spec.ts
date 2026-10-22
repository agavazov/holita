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

  it('renames only the selected Branch of the session tenant; invalid, foreign or mismatched renames write nothing', async () => {
    await seedBranches(database.client);
    const [seed] = branchSeeds;
    if (!seed) {
      throw new Error('Missing stable Branch seed.');
    }
    const before = await database.client.branch.findUniqueOrThrow({
      where: { id: seed.id, tenantId },
    });
    const otherTenant = await database.client.tenant.create({
      data: { name: `Rename tenant ${randomUUID()}` },
    });
    const foreign = await database.client.branch.create({
      data: { tenantId: otherTenant.id, name: 'Foreign Branch' },
    });
    const mutation =
      'mutation($id:ID!,$name:String!){updateBranchName(id:$id,name:$name){id name}}';
    const message = 'Use 1 to 80 supported characters.';
    function nameError(code: string) {
      return {
        message,
        extensions: {
          code: 'BAD_USER_INPUT',
          requestId: 'core-test-request',
          fieldErrors: [{ path: 'name', message, code }],
        },
      };
    }
    const unknownId = randomUUID();
    for (const [row, id, selected, name, error] of [
      ['empty name', seed.id, seed.id, '', nameError('REQUIRED')],
      ['whitespace name', seed.id, seed.id, ' \t ', nameError('REQUIRED')],
      ['81 characters', seed.id, seed.id, 'x'.repeat(81), nameError('TOO_LONG')],
      ['81 emoji', seed.id, seed.id, '🚚'.repeat(81), nameError('TOO_LONG')],
      ['NUL character', seed.id, seed.id, 'Fleet\u0000name', nameError('INVALID_FORMAT')],
      [
        'missing selected Branch',
        seed.id,
        undefined,
        'Blocked',
        { extensions: { code: 'BAD_USER_INPUT' } },
      ],
      [
        'invalid selected Branch',
        seed.id,
        'invalid',
        'Blocked',
        { extensions: { code: 'BAD_USER_INPUT' } },
      ],
      [
        'foreign selected Branch',
        seed.id,
        foreign.id,
        'Blocked',
        { extensions: { code: 'BAD_USER_INPUT' } },
      ],
      [
        'unknown Branch',
        unknownId,
        unknownId,
        'Blocked',
        { message: 'Branch not found', extensions: { code: 'NOT_FOUND' } },
      ],
      [
        'foreign Branch',
        foreign.id,
        foreign.id,
        'Blocked',
        { message: 'Branch not found', extensions: { code: 'NOT_FOUND' } },
      ],
    ] satisfies [string, string, string | undefined, string, Record<string, unknown>][]) {
      expect({
        row,
        value: await query(mutation, { id, name }, tenantId, selected),
      }).toMatchObject({ row, value: { data: null, errors: [error] } });
    }
    const unauthenticated = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-branch-id': seed.id,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({ query: mutation, variables: { id: seed.id, name: 'Blocked' } }),
      signal: AbortSignal.timeout(5000),
    });
    expect(await unauthenticated.json()).toMatchObject({
      data: null,
      errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
    });
    expect(await database.client.branch.findUnique({ where: { id: seed.id, tenantId } })).toEqual(
      before,
    );
    expect(
      await database.client.branch.findUnique({
        where: { id: foreign.id, tenantId: otherTenant.id },
      }),
    ).toEqual(foreign);

    const name = '🚚'.repeat(80);
    expect(
      await query(
        mutation,
        { id: seed.id.toUpperCase(), name: `  ${name}  ` },
        tenantId,
        seed.id.toUpperCase(),
      ),
    ).toEqual({ data: { updateBranchName: { id: seed.id, name } } });
    expect((await seedBranches(database.client)).count).toBe(0);
    expect(
      await database.client.branch.findUniqueOrThrow({ where: { id: seed.id, tenantId } }),
    ).toMatchObject({ id: before.id, tenantId, name, createdAt: before.createdAt });
    expect(
      await query(
        'query($refs:[_Any!]!){_entities(representations:$refs){...on Branch{id name}}}',
        {
          refs: [{ __typename: 'Branch', id: seed.id, name: 'Stale name' }],
        },
      ),
    ).toEqual({ data: { _entities: [{ id: seed.id, name }] } });
  });
});
