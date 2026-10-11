import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createFederationFixture } from './federation-fixture.mjs';

const sofia = '10000000-0000-4000-8000-000000000001';
const plovdiv = '10000000-0000-4000-8000-000000000002';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected a GraphQL object');
  return value;
}

describe('Reference through the actual federation boundary', () => {
  let token: string;
  let fixture: Awaited<ReturnType<typeof createFederationFixture>>;
  let cleanup: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    fixture = await createFederationFixture();
    cleanup = fixture.close;
    const response = await fetch(fixture.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'mutation {demoLogin(tenantId:"01000000-0000-4000-8000-000000000001"){token}}',
      }),
    });
    const body: unknown = await response.json();
    const value = record(record(record(body).data).demoLogin).token;
    if (typeof value !== 'string') throw new Error('Missing demo session token');
    token = value;
  });
  afterAll(async () => {
    await cleanup?.();
  });
  async function query(
    source: string,
    variables: Record<string, unknown> = {},
    storeId = sofia,
    url = fixture.url,
    sessionToken = token,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sessionToken}`,
        'x-store-id': storeId,
        'x-request-id': 'reference-integration',
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    return body;
  }
  it('runs Vehicles CRUD through Gateway with Core store resolution and foreign-ID isolation', async () => {
    const created = await query(
      'mutation($input:CreateReferenceVehicleInput!){createReferenceVehicle(input:$input){id storeId licensePlate notes store{id name}}}',
      { input: { licensePlate: ' CA1234AB ', notes: ' First\nSecond ' } },
    );
    expect(created).toMatchObject({
      data: {
        createReferenceVehicle: {
          storeId: sofia,
          licensePlate: 'CA1234AB',
          notes: 'First\nSecond',
          store: { id: sofia, name: 'holita Sofia' },
        },
      },
    });
    const id = record(record(record(created).data).createReferenceVehicle).id;
    if (typeof id !== 'string') throw new Error('Missing Vehicle ID');
    expect(
      await query('query($id:ID!){referenceVehicle(id:$id){id}}', { id }, plovdiv),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    expect(
      await query(
        'mutation($id:ID!){updateReferenceVehicle(id:$id,input:{notes:null}){licensePlate notes}}',
        { id },
      ),
    ).toEqual({ data: { updateReferenceVehicle: { licensePlate: 'CA1234AB', notes: null } } });
    expect(await query('{referenceVehicles(search:"ca1234"){items{licensePlate}total}}')).toEqual({
      data: { referenceVehicles: { items: [{ licensePlate: 'CA1234AB' }], total: 1 } },
    });
    expect(
      await query('mutation($id:ID!){deleteReferenceVehicle(id:$id){id}}', { id }, plovdiv),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    expect(await query('mutation($id:ID!){deleteReferenceVehicle(id:$id){id}}', { id })).toEqual({
      data: { deleteReferenceVehicle: { id } },
    });
    expect(await query('{referenceVehicles{total}}')).toEqual({
      data: { referenceVehicles: { total: 0 } },
    });
  });
  it('runs Devices through Gateway with truck relations, Core resolution and scoped IMEI', async () => {
    const createdTruck = await query(
      'mutation {createReferenceVehicle(input:{licensePlate:"DEVICE-TRUCK"}){id}}',
    );
    const vehicleId = record(record(record(createdTruck).data).createReferenceVehicle).id;
    if (typeof vehicleId !== 'string') throw new Error('Missing truck ID');
    const created = await query(
      'mutation($input:CreateReferenceDeviceInput!){createReferenceDevice(input:$input){id imei vehicle{licensePlate store{id}} store{id name}}}',
      {
        input: { imei: '001234567890123', vehicleId },
      },
    );
    expect(created).toMatchObject({
      data: {
        createReferenceDevice: {
          imei: '001234567890123',
          vehicle: { licensePlate: 'DEVICE-TRUCK', store: { id: sofia } },
          store: { id: sofia, name: 'holita Sofia' },
        },
      },
    });
    const id = record(record(record(created).data).createReferenceDevice).id;
    if (typeof id !== 'string') throw new Error('Missing device ID');
    expect(
      await query('query($id:ID!){referenceDevice(id:$id){imei}}', { id }, plovdiv),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    expect(
      await query(
        'mutation($input:CreateReferenceDeviceInput!){createReferenceDevice(input:$input){id}}',
        { input: { imei: '001234567890124', vehicleId } },
        plovdiv,
      ),
    ).toHaveProperty('errors');
    expect(
      await query('mutation($id:ID!){deleteReferenceVehicle(id:$id){id}}', { id: vehicleId }),
    ).toMatchObject({ errors: [{ extensions: { code: 'CONFLICT' } }] });
    expect(
      await query(
        'mutation($id:ID!){updateReferenceDevice(id:$id,input:{imei:"001234567890125"}){imei}}',
        { id },
      ),
    ).toEqual({ data: { updateReferenceDevice: { imei: '001234567890125' } } });
    expect(await query('{referenceDevices(search:"001234"){items{imei}total}}')).toEqual({
      data: { referenceDevices: { items: [{ imei: '001234567890125' }], total: 1 } },
    });
    expect(await query('mutation($id:ID!){deleteReferenceDevice(id:$id){id}}', { id })).toEqual({
      data: { deleteReferenceDevice: { id } },
    });
    expect(
      await query('mutation($id:ID!){deleteReferenceVehicle(id:$id){id}}', { id: vehicleId }),
    ).toEqual({ data: { deleteReferenceVehicle: { id: vehicleId } } });
  });
  it('discovers stores without selecting a store and rejects missing business scope', async () => {
    expect(await query('{stores{id name}}')).toEqual({
      data: {
        stores: [
          { id: plovdiv, name: 'holita Plovdiv' },
          { id: sofia, name: 'holita Sofia' },
        ],
      },
    });
    expect(await query('{referenceVehicles{total}}', {}, '')).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
    });
    expect(await query('{referenceDevices{total}}', {}, 'invalid')).toHaveProperty('errors');
    expect(await query('{referenceVehicles{total}}', {}, randomUUID())).toEqual({
      data: { referenceVehicles: { total: 0 } },
    });
  });
  it('allows admin CORS and rejects oversized baggage before reaching subgraphs', async () => {
    const response = await fetch(fixture.url, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:11000',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,x-store-id,x-request-id',
      },
      signal: AbortSignal.timeout(5000),
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:11000');
    expect(response.headers.get('access-control-allow-headers')).toContain('x-store-id');
    fixture.coreRequests.length = 0;
    fixture.referenceRequests.length = 0;
    const rejected = await fetch(fixture.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', baggage: `key=${'x'.repeat(20 * 1024)}` },
      body: JSON.stringify({ query: '{ stores { id } }' }),
      signal: AbortSignal.timeout(5000),
    });
    await rejected.text();
    expect(rejected.status).toBe(431);
    expect(fixture.coreRequests).toHaveLength(0);
    expect(fixture.referenceRequests).toHaveLength(0);
  });
  it('gates Reference operations and entities while keeping health and discovery usable', async () => {
    const created = await query(
      'mutation {createReferenceVehicle(input:{licensePlate:"GATED"}){id}}',
    );
    const id = record(record(record(created).data).createReferenceVehicle).id;
    if (typeof id !== 'string') throw new Error('Missing Vehicle ID');
    await fixture.setReferenceEnabled(false);
    try {
      expect(await query('{referenceVehicles{total}}')).toMatchObject({
        errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }],
      });
      expect(
        await query('mutation {createReferenceVehicle(input:{licensePlate:"BLOCKED"}){id}}'),
      ).toHaveProperty('errors');
      expect(
        await query(
          'query($refs:[_Any!]!){_entities(representations:$refs){...on ReferenceVehicle{id}}}',
          { refs: [{ __typename: 'ReferenceVehicle', id }] },
          sofia,
          fixture.referenceUrl,
        ),
      ).toHaveProperty('errors');
      expect(await query('{stores{id}}')).toHaveProperty('data.stores');
      expect((await fetch(new URL('/health', fixture.referenceUrl))).ok).toBe(true);
    } finally {
      await fixture.setReferenceEnabled(true);
    }
    expect(await query('query($id:ID!){referenceVehicle(id:$id){licensePlate}}', { id })).toEqual({
      data: { referenceVehicle: { licensePlate: 'GATED' } },
    });
    await query('mutation($id:ID!){deleteReferenceVehicle(id:$id){id}}', { id });
  });
  it('checks creation against Core once per request and scopes concurrent transport headers', async () => {
    fixture.coreRequests.length = 0;
    expect(
      await query(
        'mutation {a:createReferenceVehicle(input:{licensePlate:"A1"}){id} b:createReferenceVehicle(input:{licensePlate:"A2"}){id}}',
      ),
    ).toHaveProperty('data');
    expect(fixture.coreRequests).toHaveLength(1);
    expect(
      await query(
        'mutation {createReferenceVehicle(input:{licensePlate:"UNKNOWN"}){id}}',
        {},
        randomUUID(),
      ),
    ).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    fixture.referenceRequests.length = 0;
    await Promise.all([
      query('{referenceVehicles{total}}', {}, sofia),
      query('{referenceVehicles{total}}', {}, plovdiv),
    ]);
    expect(fixture.referenceRequests.map((request) => request.storeId).sort()).toEqual([
      sofia,
      plovdiv,
    ]);
  });
  it('keeps scoped CRUD available without Core and fails creation and federated Store', async () => {
    const created = await query(
      'mutation {createReferenceVehicle(input:{licensePlate:"OFFLINE"}){id}}',
    );
    const id = record(record(record(created).data).createReferenceVehicle).id;
    if (typeof id !== 'string') throw new Error('Missing Vehicle ID');
    await fixture.stopCore();
    try {
      expect(await query('query($id:ID!){referenceVehicle(id:$id){licensePlate}}', { id })).toEqual(
        {
          data: { referenceVehicle: { licensePlate: 'OFFLINE' } },
        },
      );
      expect(
        await query(
          'mutation($id:ID!){updateReferenceVehicle(id:$id,input:{notes:"Changed"}){notes}}',
          { id },
        ),
      ).toEqual({
        data: { updateReferenceVehicle: { notes: 'Changed' } },
      });
      expect(
        await query('mutation {createReferenceVehicle(input:{licensePlate:"FAIL"}){id}}'),
      ).toHaveProperty('errors');
      expect(
        await query('query($id:ID!){referenceVehicle(id:$id){store{id name}}}', { id }),
      ).toHaveProperty('errors');
      expect(await query('mutation($id:ID!){deleteReferenceVehicle(id:$id){id}}', { id })).toEqual({
        data: { deleteReferenceVehicle: { id } },
      });
    } finally {
      await fixture.restartCore();
    }
  });
  it('requires verified sessions and isolates tenants through Gateway and direct federation entities', async () => {
    const publicRequest = await fetch(fixture.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{tenants{name}}' }),
    });
    expect(await publicRequest.json()).toMatchObject({
      data: {
        tenants: expect.arrayContaining([{ name: 'RentalSofia' }, { name: 'Isolation tenant' }]),
      },
    });
    const login = await query(
      'mutation {demoLogin(tenantId:"01000000-0000-4000-8000-000000000002"){token}}',
    );
    const otherToken = record(record(record(login).data).demoLogin).token;
    if (typeof otherToken !== 'string') throw new Error('Missing second tenant session');
    expect(await query('{stores{id name}}', {}, sofia, fixture.url, otherToken)).toEqual({
      data: { stores: [{ id: '10000000-0000-4000-8000-000000000003', name: 'Isolation store' }] },
    });
    const created = await query(
      'mutation {createReferenceVehicle(input:{licensePlate:"TENANT-PRIVATE"}){id}}',
    );
    const id = record(record(record(created).data).createReferenceVehicle).id;
    if (typeof id !== 'string') throw new Error('Missing tenant Vehicle ID');
    for (const source of [
      'query($id:ID!){referenceVehicle(id:$id){id}}',
      'mutation($id:ID!){updateReferenceVehicle(id:$id,input:{notes:"Spoofed"}){id}}',
      'mutation($id:ID!){deleteReferenceVehicle(id:$id){id}}',
    ])
      expect(await query(source, { id }, sofia, fixture.url, otherToken)).toMatchObject({
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    expect(
      await query(
        'mutation {createReferenceVehicle(input:{licensePlate:"WRONG-STORE"}){id}}',
        {},
        sofia,
        fixture.url,
        otherToken,
      ),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    const entities =
      'query($refs:[_Any!]!){_entities(representations:$refs){...on ReferenceVehicle{id}}}';
    expect(
      await query(
        entities,
        {
          refs: [
            {
              __typename: 'ReferenceVehicle',
              id,
              tenantId: '01000000-0000-4000-8000-000000000002',
            },
          ],
        },
        sofia,
        fixture.referenceUrl,
        otherToken,
      ),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    for (const target of [fixture.url, fixture.referenceUrl]) {
      for (const authorization of [
        undefined,
        `Bearer ${token.replace('000000000001', '000000000002')}`,
      ]) {
        const response = await fetch(target, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-store-id': sofia,
            'x-tenant-id': '01000000-0000-4000-8000-000000000001',
            ...(authorization ? { authorization } : {}),
          },
          body: JSON.stringify({ query: '{referenceVehicles{total}}' }),
        });
        expect(await response.json()).toMatchObject({
          errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
        });
      }
    }
    await query('mutation($id:ID!){deleteReferenceVehicle(id:$id){id}}', { id });
  });
});
