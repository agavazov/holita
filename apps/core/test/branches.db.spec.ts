import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { hashPassword } from '../src/auth/password.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import type { UserRole } from '../src/generated/graphql/types.js';
import { createTestDatabase } from './test-database.js';
import { branchSeeds, seedBranches } from '../prisma/seed-data.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
const internalAuthToken = 'core-test-internal-auth-token-only-32-characters';

describe('Branches GraphQL with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;
  const previousInternalAuthToken = process.env['CORE_INTERNAL_AUTH_TOKEN'];

  beforeAll(async () => {
    process.env['CORE_INTERNAL_AUTH_TOKEN'] = internalAuthToken;
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
    if (previousInternalAuthToken === undefined) {
      delete process.env['CORE_INTERNAL_AUTH_TOKEN'];
    } else {
      process.env['CORE_INTERNAL_AUTH_TOKEN'] = previousInternalAuthToken;
    }
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

  async function accountQuery(
    source: string,
    variables: Record<string, unknown> = {},
    token?: string,
    identityHeaders: Record<string, string> = {},
  ): Promise<unknown> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
        ...identityHeaders,
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(5000),
    });
    return response.json();
  }

  async function signIn(email: string, password: string): Promise<string> {
    const body = await accountQuery(
      `mutation($email:String!,$password:String!){
        signIn(email:$email,password:$password){
          token expiresAt user{id email lastSignInAt tenant{id}} tenant{id}
        }
      }`,
      { email, password },
    );
    expect(body).toMatchObject({
      data: {
        signIn: {
          token: expect.any(String),
          expiresAt: expect.stringMatching(/Z$/),
          user: {
            email: email.trim().toLowerCase(),
            lastSignInAt: expect.stringMatching(/Z$/),
          },
        },
      },
    });
    if (body === null || typeof body !== 'object' || !('data' in body)) {
      throw new Error('Missing sign-in response');
    }
    const data = body.data;
    if (data === null || typeof data !== 'object' || !('signIn' in data)) {
      throw new Error('Missing sign-in payload');
    }
    const payload = data.signIn;
    if (
      payload === null ||
      typeof payload !== 'object' ||
      !('token' in payload) ||
      typeof payload.token !== 'string'
    ) {
      throw new Error('Missing session token');
    }
    return payload.token;
  }

  it('scopes Branches and users to verified Tenant sessions and rejects revoked sessions', async () => {
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

    const password = `Account-test-${randomUUID()}`;
    const passwordHash = await hashPassword(password);
    const owner = await database.client.user.create({
      data: {
        tenantId,
        name: 'First user',
        email: `first-${randomUUID()}@example.test`,
        passwordHash,
        role: 'ADMINISTRATOR',
      },
    });
    const foreignUser = await database.client.user.create({
      data: {
        tenantId: otherTenant.id,
        name: 'Other Tenant user',
        email: `foreign-${randomUUID()}@example.test`,
        passwordHash,
      },
    });
    const token = await signIn(`  ${owner.email.toUpperCase()}  `, password);
    const spoofedIdentity = { 'x-tenant-id': otherTenant.id, 'x-user-id': foreignUser.id };
    expect(
      await accountQuery('{me{id role tenant{id}} users{id}}', {}, token, spoofedIdentity),
    ).toEqual({
      data: {
        me: { id: owner.id, role: 'ADMINISTRATOR', tenant: { id: tenantId } },
        users: [{ id: owner.id }],
      },
    });
    for (const mutation of [
      'updateUser(id:$id,name:"Blocked",email:"blocked@example.test")',
      'deactivateUser(id:$id)',
      'reactivateUser(id:$id)',
    ]) {
      expect(
        await accountQuery(`mutation($id:ID!){${mutation}{id}}`, { id: foreignUser.id }, token),
      ).toMatchObject({ data: null, errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    }
    expect(await database.client.user.findUniqueOrThrow({ where: { id: foreignUser.id } })).toEqual(
      foreignUser,
    );
    expect(await accountQuery('{users{id}}', {}, issueDemoToken(tenantId))).toMatchObject({
      errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
    });

    const email = `colleague-${randomUUID()}@example.test`;
    expect(
      await accountQuery(
        `mutation($name:String!,$email:String!,$password:String!){
          createUser(name:$name,email:$email,password:$password){name email active role tenant{id}}
        }`,
        { name: 'Colleague', email: `  ${email.toUpperCase()}  `, password },
        token,
      ),
    ).toEqual({
      data: {
        createUser: {
          name: 'Colleague',
          email,
          active: true,
          role: 'VIEWER',
          tenant: { id: tenantId },
        },
      },
    });
    const colleague = await database.client.user.findUniqueOrThrow({ where: { email } });
    const colleagueToken = await signIn(email, password);
    const managedUser = await database.client.user.create({
      data: {
        tenantId,
        name: 'Managed user',
        email: `managed-${randomUUID()}@example.test`,
        passwordHash,
      },
    });
    const managedBranch = await database.client.branch.create({
      data: { tenantId, name: 'Managed branch' },
    });
    for (const role of ['VIEWER', 'OPERATOR', 'ENGINEER', 'ADMINISTRATOR'] satisfies UserRole[]) {
      expect(
        await accountQuery(
          'mutation($id:ID!,$email:String!,$role:UserRole){updateUser(id:$id,name:"Colleague",email:$email,role:$role){id role}}',
          { id: colleague.id, email, role },
          token,
        ),
      ).toEqual({ data: { updateUser: { id: colleague.id, role } } });
      expect(await accountQuery('{me{id role} branches{id}}', {}, colleagueToken)).toMatchObject({
        data: {
          me: { id: colleague.id, role },
          branches: expect.arrayContaining([{ id: managedBranch.id }]),
        },
      });
      expect(
        await accountQuery(
          'mutation($email:String!){updateProfile(name:"My profile",email:$email){id name role}}',
          { email },
          colleagueToken,
        ),
      ).toEqual({ data: { updateProfile: { id: colleague.id, name: 'My profile', role } } });
      for (const [operation, source, variables, expected] of [
        [
          'create user',
          'mutation($email:String!,$password:String!){createUser(name:"Created",email:$email,password:$password,role:ENGINEER){role}}',
          { email: `created-${randomUUID()}@example.test`, password },
          { createUser: { role: 'ENGINEER' } },
        ],
        [
          'update user',
          'mutation($id:ID!,$email:String!){updateUser(id:$id,name:"Managed",email:$email,role:OPERATOR){id role}}',
          { id: managedUser.id, email: managedUser.email },
          { updateUser: { id: managedUser.id, role: 'OPERATOR' } },
        ],
        [
          'deactivate user',
          'mutation($id:ID!){deactivateUser(id:$id){id active}}',
          { id: managedUser.id },
          { deactivateUser: { id: managedUser.id, active: false } },
        ],
        [
          'reactivate user',
          'mutation($id:ID!){reactivateUser(id:$id){id active}}',
          { id: managedUser.id },
          { reactivateUser: { id: managedUser.id, active: true } },
        ],
        [
          'rename Branch',
          'mutation($id:ID!){updateBranchName(id:$id,name:"Renamed branch"){id name}}',
          { id: managedBranch.id },
          { updateBranchName: { id: managedBranch.id, name: 'Renamed branch' } },
        ],
      ] satisfies [string, string, Record<string, unknown>, Record<string, unknown>][]) {
        const result = await accountQuery(source, variables, colleagueToken, {
          'x-branch-id': managedBranch.id,
        });
        expect({ role, operation, result }).toMatchObject({
          role,
          operation,
          result:
            role === 'ADMINISTRATOR'
              ? { data: expected }
              : { data: null, errors: [{ extensions: { code: 'FORBIDDEN' } }] },
        });
      }
      expect(
        await accountQuery(
          'mutation($id:ID!,$email:String!,$role:UserRole){updateUser(id:$id,name:"Self role change",email:$email,role:$role){id}}',
          { id: colleague.id, email, role: role === 'ADMINISTRATOR' ? 'VIEWER' : 'ADMINISTRATOR' },
          colleagueToken,
        ),
      ).toMatchObject({ data: null, errors: [{ extensions: { code: 'FORBIDDEN' } }] });
      expect(
        (await database.client.user.findUniqueOrThrow({ where: { id: colleague.id } })).role,
      ).toBe(role);
    }
    expect(
      await accountQuery(
        'mutation($id:ID!,$email:String!){updateUser(id:$id,name:"Updated first user",email:$email){id name}}',
        { id: owner.id, email: owner.email },
        colleagueToken,
      ),
    ).toEqual({ data: { updateUser: { id: owner.id, name: 'Updated first user' } } });
    expect(await accountQuery('{users{id}}', {}, colleagueToken)).toMatchObject({
      data: { users: expect.arrayContaining([{ id: owner.id }, { id: colleague.id }]) },
    });

    const verifyUrl = new URL('/internal/auth/verify', url);
    const verified = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'x-core-internal-token': internalAuthToken,
        ...spoofedIdentity,
      },
      signal: AbortSignal.timeout(5000),
    });
    expect(verified.status).toBe(200);
    const currentSession = await database.client.session.findFirstOrThrow({
      where: { tenantId, userId: owner.id, revokedAt: null },
    });
    expect(await verified.json()).toEqual({
      tenantId,
      userId: owner.id,
      sessionId: currentSession.id,
      role: 'ADMINISTRATOR',
    });
    for (const [internalToken, sessionToken, status] of [
      ['incorrect-internal-token', token, 401],
      [internalAuthToken, issueDemoToken(tenantId), 200],
      [internalAuthToken, 'invalid-session-token', 200],
    ] satisfies [string, string, number][]) {
      const rejected = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${sessionToken}`,
          'x-core-internal-token': internalToken,
        },
        signal: AbortSignal.timeout(5000),
      });
      expect(rejected.status).toBe(status);
      if (status === 200) {
        expect(await rejected.json()).toEqual({ authenticated: false });
      }
    }

    const otherSessionToken = await signIn(owner.email, password);
    const newPassword = `Changed-password-${randomUUID()}`;
    expect(
      await accountQuery(
        `mutation($current:String!,$next:String!){
          changePassword(currentPassword:$current,newPassword:$next)
        }`,
        { current: password, next: newPassword },
        token,
      ),
    ).toEqual({ data: { changePassword: true } });
    expect(await accountQuery('{me{id}}', {}, otherSessionToken)).toMatchObject({
      errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
    });
    expect(await accountQuery('{me{id}}', {}, token)).toEqual({ data: { me: { id: owner.id } } });
    const signedOutToken = await signIn(owner.email, newPassword);
    expect(await accountQuery('mutation{signOut}', {}, signedOutToken)).toEqual({
      data: { signOut: true },
    });
    const revokedVerification = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${signedOutToken}`,
        'x-core-internal-token': internalAuthToken,
      },
      signal: AbortSignal.timeout(5000),
    });
    expect(revokedVerification.status).toBe(200);
    expect(await revokedVerification.json()).toEqual({ authenticated: false });
    expect(await accountQuery('{me{id}}', {}, signedOutToken)).toMatchObject({
      errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
    });
    expect(
      await accountQuery(
        'mutation($id:ID!){deactivateUser(id:$id){id active}}',
        { id: colleague.id },
        token,
      ),
    ).toEqual({ data: { deactivateUser: { id: colleague.id, active: false } } });
    expect(await accountQuery('{me{id}}', {}, colleagueToken)).toMatchObject({
      errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
    });
    expect(
      await accountQuery(
        'mutation($id:ID!){reactivateUser(id:$id){id active}}',
        { id: colleague.id },
        token,
      ),
    ).toEqual({ data: { reactivateUser: { id: colleague.id, active: true } } });
    expect(await accountQuery('{me{id}}', {}, colleagueToken)).toMatchObject({
      errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
    });
    const reactivatedToken = await signIn(email, password);
    expect(await accountQuery('{me{id}}', {}, reactivatedToken)).toEqual({
      data: { me: { id: colleague.id } },
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
