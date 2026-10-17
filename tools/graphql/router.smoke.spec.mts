import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { createFederationFixture } from './federation-fixture.mjs';

const tenant = '01000000-0000-4000-8000-000000000001';
const otherTenant = '01000000-0000-4000-8000-000000000002';
const discordia = '10000000-0000-4000-8000-000000000001';
const sandbox = '10000000-0000-4000-8000-000000000002';
const origin = 'http://127.0.0.1:11009';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Expected a GraphQL object');
  }
  return value;
}

describe('Apollo Router with the local supergraph and real subgraphs', () => {
  let fixture: Awaited<ReturnType<typeof createFederationFixture>>;
  let closeFixture: (() => Promise<void>) | undefined;
  let url: string;
  let healthUrl: string;
  let token: string;

  beforeAll(async () => {
    fixture = await createFederationFixture({ adminOrigin: origin });
    closeFixture = fixture.close;
    url = fixture.url;
    healthUrl = fixture.healthUrl;
    token = await login(tenant);
  });

  afterAll(async () => {
    await closeFixture?.();
  });

  async function query(
    source: string,
    variables: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) {
    const result = await request({ query: source, variables }, headers);
    expect(result.status).toBe(200);
    return result.body;
  }

  async function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const result: unknown = await response.json();
    return { status: response.status, headers: response.headers, body: record(result) };
  }

  function errors(body: Record<string, unknown>) {
    if (!Array.isArray(body.errors) || body.errors.length === 0) throw new Error('Expected errors');
    return body.errors.map((value: unknown) => {
      const error = record(value);
      return { message: error.message, extensions: record(error.extensions) };
    });
  }

  async function login(tenantId: string) {
    const result = await query('mutation($id:ID!){demoLogin(tenantId:$id){token}}', {
      id: tenantId,
    });
    expect(result.errors).toBeUndefined();
    const value = record(record(result.data).demoLogin).token;
    if (typeof value !== 'string') throw new Error('Missing demo session token');
    return value;
  }

  it('serves public tenants and signed Branch discovery without a Branch header', async () => {
    const tenants = await query('{tenants{id name}}');
    expect(record(tenants.data).tenants).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: tenant })]),
    );
    const headers = { authorization: `Bearer ${token}`, 'x-request-id': 'router-branches' };
    const branches = await query('{branches{id name}}', {}, headers);
    expect(record(branches.data).branches).toEqual([
      { id: discordia, name: 'Discordia' },
      { id: sandbox, name: 'Sandbox' },
    ]);
    expect((await query('{branches{id}}')).errors).toBeDefined();
  });

  it('resolves Vehicle Branch names through Core and forwards scope and request IDs to both subgraphs', async () => {
    const headers = {
      authorization: `Bearer ${token}`,
      'x-branch-id': discordia,
      'x-request-id': 'router-federation',
    };
    const created = await query(
      'mutation{createFleetVehicle(input:{licensePlate:"ROUTER TEST"}){id}}',
      {},
      headers,
    );
    expect(created.errors).toBeUndefined();
    const id = record(record(created.data).createFleetVehicle).id;
    if (typeof id !== 'string') throw new Error('Missing created Vehicle');
    const coreBefore = fixture.coreRequests.length;
    const fleetBefore = fixture.fleetRequests.length;
    const source = 'query($id:ID!){fleetVehicle(id:$id){id licensePlate branch{id name}}}';
    const result = await query(source, { id }, headers);
    expect(result).toEqual({
      data: {
        fleetVehicle: {
          id,
          licensePlate: 'ROUTER TEST',
          branch: { id: discordia, name: 'Discordia' },
        },
      },
    });
    for (const requests of [
      fixture.coreRequests.slice(coreBefore),
      fixture.fleetRequests.slice(fleetBefore),
    ]) {
      expect(requests.length).toBeGreaterThan(0);
      for (const request of requests) {
        expect(request).toMatchObject({ requestId: 'router-federation', branchId: discordia });
      }
    }
    expect(
      fixture.coreRequests.slice(coreBefore).some((request) => request.body.includes('_entities')),
    ).toBe(true);
    for (const invalidHeaders of [
      { ...headers, 'x-branch-id': sandbox },
      { ...headers, 'x-branch-id': '' },
      { ...headers, authorization: 'Bearer invalid' },
      { ...headers, authorization: `Bearer ${await login(otherTenant)}` },
    ]) {
      const denied = await query(source, { id }, invalidHeaders);
      expect(denied.errors).toBeDefined();
      expect(denied.data).toBeNull();
    }
  });

  it('routes Karma reads for signed tenants independently of Branch and blocks anonymous upstream access', async () => {
    const source = '{karmaCars{id carNumber deviceId}}';
    const first = await query(source, {}, { authorization: `Bearer ${token}` });
    expect(first).toEqual({
      data: {
        karmaCars: [{ id: '41', carNumber: 'KARMA TEST 41', deviceId: '000123456789012' }],
      },
    });
    expect(
      await query(
        source,
        {},
        { authorization: `Bearer ${await login(otherTenant)}`, 'x-branch-id': sandbox },
      ),
    ).toEqual(first);
    const reads = fixture.karma.requests.length;
    expect((await query(source)).errors).toBeDefined();
    expect(fixture.karma.requests).toHaveLength(reads);
  });

  it('allows the configured admin preflight and denies an unrelated origin', async () => {
    const response = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type,x-branch-id,x-request-id',
      },
      signal: AbortSignal.timeout(3000),
    });
    expect(response.ok).toBe(true);
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    expect(response.headers.get('access-control-allow-headers')?.split(/,\s*/)).toEqual(
      expect.arrayContaining(['authorization', 'content-type', 'x-branch-id', 'x-request-id']),
    );
    const denied = await fetch(url, {
      method: 'OPTIONS',
      headers: { origin: 'https://unrelated.example', 'access-control-request-method': 'POST' },
      signal: AbortSignal.timeout(3000),
    });
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    const health = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
    const body: unknown = await health.json();
    expect(body).toEqual({ status: 'UP' });
  });

  it.each([undefined, '', 'bad id', 'one,two', 'x'.repeat(101), 'x'.repeat(100), 'AZaz09._:-'])(
    'normalizes request ID %j once and shares it across subgraphs and the response',
    async (supplied) => {
      const coreBefore = fixture.coreRequests.length;
      const fleetBefore = fixture.fleetRequests.length;
      const result = await request(
        { query: '{branches{id} fleetVehicles{total}}' },
        {
          authorization: `Bearer ${token}`,
          'x-branch-id': discordia,
          ...(supplied === undefined ? {} : { 'x-request-id': supplied }),
        },
      );
      expect(result.status).toBe(200);
      expect(result.body.errors).toBeUndefined();
      const id = result.headers.get('x-request-id');
      if (supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied)) expect(id).toBe(supplied);
      else
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      for (const observed of [
        fixture.coreRequests.slice(coreBefore),
        fixture.fleetRequests.slice(fleetBefore),
      ]) {
        expect(observed.length).toBeGreaterThan(0);
        expect(observed.every((entry) => entry.requestId === id)).toBe(true);
      }
    },
  );

  it('keeps generated request IDs separate for concurrent error responses', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => request({ query: '{branches{id}}' })),
    );
    const ids = results.map((result) => result.headers.get('x-request-id'));
    expect(new Set(ids).size).toBe(8);
    for (const result of results) {
      expect(errors(result.body)[0]?.extensions).toEqual({
        code: 'UNAUTHENTICATED',
        requestId: result.headers.get('x-request-id'),
      });
    }
  });

  it('preserves real public business messages, field validation and request IDs', async () => {
    const headers = {
      authorization: `Bearer ${token}`,
      'x-branch-id': discordia,
      'x-request-id': 'router-business-errors',
    };
    const create = 'mutation{createFleetVehicle(input:{licensePlate:"ROUTER CONFLICT"}){id}}';
    const created = await query(create, {}, headers);
    expect(created.errors).toBeUndefined();
    const vehicleId = record(record(created.data).createFleetVehicle).id;
    if (typeof vehicleId !== 'string') throw new Error('Missing conflict-test Vehicle');
    expect(
      (
        await query(
          'mutation($id:ID!){createFleetDevice(input:{imei:"000123456789019",vehicleId:$id}){id}}',
          { id: vehicleId },
          headers,
        )
      ).errors,
    ).toBeUndefined();
    for (const [source, code, message, selectedHeaders] of [
      [
        '{branches{id}}',
        'UNAUTHENTICATED',
        'Sign in to a tenant first',
        { 'x-request-id': 'router-business-errors' },
      ],
      [
        'mutation{createFleetVehicle(input:{licensePlate:""}){id}}',
        'BAD_USER_INPUT',
        'Use 1 to 32 supported characters.',
        headers,
      ],
      [
        '{fleetVehicle(id:"00000000-0000-4000-8000-000000000000"){id}}',
        'NOT_FOUND',
        'Vehicle not found',
        headers,
      ],
      [
        `mutation{deleteFleetVehicle(id:"${vehicleId}"){id}}`,
        'CONFLICT',
        'Vehicle is still referenced by another record.',
        headers,
      ],
    ] satisfies [string, string, string, Record<string, string>][]) {
      const actual = await query(source, {}, selectedHeaders);
      expect(errors(actual)).toEqual([
        {
          message,
          extensions: {
            code,
            requestId: 'router-business-errors',
            ...(code === 'BAD_USER_INPUT'
              ? { fieldErrors: [{ path: 'licensePlate', message }] }
              : {}),
          },
        },
      ]);
    }
  });

  it('preserves public codes while removing unexpected extensions and internal messages', async () => {
    const secret = 'private-subgraph-diagnostic-marker';
    const headers = { 'x-request-id': 'router-error-filter' };
    try {
      for (const code of [
        'BAD_USER_INPUT',
        'UNAUTHENTICATED',
        'NOT_FOUND',
        'CONFLICT',
        'SERVICE_UNAVAILABLE',
        'GRAPHQL_PARSE_FAILED',
        'GRAPHQL_VALIDATION_FAILED',
        'BAD_REQUEST',
        'INTERNAL_SERVER_ERROR',
        'UNKNOWN_CODE',
        null,
      ]) {
        fixture.setCoreResponse({
          status: 200,
          body: JSON.stringify({
            data: null,
            errors: [
              {
                message: ['INTERNAL_SERVER_ERROR', 'UNKNOWN_CODE', null].includes(code)
                  ? secret
                  : 'Public diagnostic',
                path: ['tenants'],
                extensions: {
                  code,
                  requestId: 'untrusted-id',
                  stacktrace: [secret],
                  serviceName: secret,
                  exception: { secret },
                },
              },
            ],
          }),
        });
        const actual = await query('{tenants{id}}', {}, headers);
        const internal = ['INTERNAL_SERVER_ERROR', 'UNKNOWN_CODE', null].includes(code);
        expect(errors(actual)).toEqual([
          {
            message: internal ? 'Internal server error' : 'Public diagnostic',
            extensions: {
              code: internal ? 'INTERNAL_SERVER_ERROR' : code,
              requestId: 'router-error-filter',
              ...(code === 'BAD_USER_INPUT' ? { fieldErrors: [] } : {}),
            },
          },
        ]);
        expect(JSON.stringify(actual)).not.toContain(secret);
        expect(JSON.stringify(actual)).not.toContain('untrusted-id');
      }
      expect(fixture.logs().gateway).not.toContain(secret);
    } finally {
      fixture.setCoreResponse(undefined);
    }
  });

  it('filters fieldErrors using the first-30, ASCII path and UTF-16 message limits', async () => {
    const entries: unknown[] = [
      { path: 'licensePlate', message: 'Required', secret: 'drop-me' },
      { path: 'notes', message: 'б'.repeat(300) },
      { path: 'notes', message: '😀'.repeat(150) },
      { path: 'notes', message: '😀'.repeat(151) },
      { path: 'notes', message: 'x'.repeat(301) },
      { path: 'notes', message: '' },
      { path: 'input.notes', message: 'Nested' },
      { path: '0notes', message: 'Numeric' },
      { path: 'поле', message: 'Unicode' },
      { path: 'notes', message: 123 },
      null,
      'invalid',
      ...Array.from({ length: 25 }, (_, index) => ({
        path: `field${String(index)}`,
        message: 'Valid',
      })),
    ];
    try {
      for (const fieldErrors of [entries, null, {}, 'invalid']) {
        fixture.setCoreResponse({
          status: 200,
          body: JSON.stringify({
            data: null,
            errors: [
              {
                message: 'Invalid input',
                path: ['tenants'],
                extensions: { code: 'BAD_USER_INPUT', fieldErrors },
              },
            ],
          }),
        });
        const headers = { 'x-request-id': 'router-field-errors' };
        const actual = await query('{tenants{id}}', {}, headers);
        expect(errors(actual)).toEqual([
          {
            message: 'Invalid input',
            extensions: {
              code: 'BAD_USER_INPUT',
              requestId: 'router-field-errors',
              fieldErrors:
                fieldErrors === entries
                  ? [
                      { path: 'licensePlate', message: 'Required' },
                      { path: 'notes', message: 'б'.repeat(300) },
                      { path: 'notes', message: '😀'.repeat(150) },
                      { path: 'notes', message: '' },
                      ...Array.from({ length: 18 }, (_, index) => ({
                        path: `field${String(index)}`,
                        message: 'Valid',
                      })),
                    ]
                  : [],
            },
          },
        ]);
      }
    } finally {
      fixture.setCoreResponse(undefined);
    }
  });

  it.each([
    { name: 'syntax', source: '{tenants{id}', code: 'PARSING_ERROR' },
    {
      name: 'schema validation',
      source: '{tenants{unknownField}}',
      code: 'GRAPHQL_VALIDATION_FAILED',
    },
  ])('keeps early $name failures native without calling subgraphs', async ({ source, code }) => {
    const coreBefore = fixture.coreRequests.length;
    const fleetBefore = fixture.fleetRequests.length;
    const karmaBefore = fixture.karma.requests.length;
    const result = await request(
      { query: source },
      { origin, 'x-request-id': 'router-early-error' },
    );
    expect(result.status).toBe(400);
    expect(result.headers.get('access-control-allow-origin')).toBe(origin);
    expect(result.headers.get('x-request-id')).toBeNull();
    expect(result.body.data).toBeUndefined();
    for (const error of errors(result.body)) {
      expect(error.message).toEqual(expect.any(String));
      expect(error.extensions.code).toBe(code);
      expect(error.extensions.requestId).toBeUndefined();
      expect(error.extensions.fieldErrors).toBeUndefined();
    }
    expect(fixture.coreRequests).toHaveLength(coreBefore);
    expect(fixture.fleetRequests).toHaveLength(fleetBefore);
    expect(fixture.karma.requests).toHaveLength(karmaBefore);
  });

  it('reports invalid variables as HTTP 400 BAD_USER_INPUT with the response request ID', async () => {
    const body = {
      query: 'query($limit:Int!){fleetVehicles(limit:$limit){total}}',
      variables: { limit: 'invalid' },
    };
    const headers = { 'x-request-id': 'router-variables' };
    const result = await request(body, headers);
    expect(result.status).toBe(400);
    expect(result.headers.get('x-request-id')).toBe('router-variables');
    expect(errors(result.body)[0]?.extensions).toEqual({
      code: 'BAD_USER_INPUT',
      requestId: 'router-variables',
      fieldErrors: [],
    });
  });

  it('sanitizes malformed and failing upstream HTTP responses', async () => {
    try {
      for (const response of [
        { status: 200, body: 'private non-JSON response' },
        { status: 503, body: JSON.stringify({ message: 'private failure' }) },
      ]) {
        fixture.setCoreResponse(response);
        const result = await request(
          { query: '{tenants{id}}' },
          { 'x-request-id': 'router-upstream' },
        );
        expect(result.status).toBe(200);
        expect(errors(result.body)).toEqual([
          {
            message: 'A required service is unavailable; try again later',
            extensions: { code: 'SERVICE_UNAVAILABLE', requestId: 'router-upstream' },
          },
        ]);
      }
    } finally {
      fixture.setCoreResponse(undefined);
    }
  });

  it('bounds a stalled real Karma subgraph at five seconds and recovers after it resumes', async () => {
    fixture.pauseKarmaClient();
    try {
      const started = performance.now();
      const result = await request(
        { query: '{karmaCars{id}}' },
        { authorization: `Bearer ${token}`, 'x-request-id': 'router-timeout' },
      );
      const elapsed = performance.now() - started;
      expect(elapsed).toBeGreaterThanOrEqual(4500);
      expect(elapsed).toBeLessThan(9000);
      expect(result.status).toBe(200);
      expect(result.headers.get('x-request-id')).toBe('router-timeout');
      expect(errors(result.body)).toEqual([
        {
          message: 'A required service is unavailable; try again later',
          extensions: { code: 'SERVICE_UNAVAILABLE', requestId: 'router-timeout' },
        },
      ]);
    } finally {
      fixture.resumeKarmaClient();
    }
    expect(await query('{karmaCars{id}}', {}, { authorization: `Bearer ${token}` })).toEqual({
      data: { karmaCars: [{ id: '41' }] },
    });
  });
});
