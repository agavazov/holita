import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createFederationFixture } from './federation-fixture.mjs';

const discordia = '10000000-0000-4000-8000-000000000001';
const sandbox = '10000000-0000-4000-8000-000000000002';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected a GraphQL object');
  return value;
}

describe('Fleet through the actual federation boundary', () => {
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
    storeId = discordia,
    url = fixture.url,
    sessionToken = token,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sessionToken}`,
        'x-store-id': storeId,
        'x-request-id': 'fleet-integration',
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    return body;
  }
  it('runs Vehicles CRUD through Gateway with Core store resolution and foreign-ID isolation', async () => {
    const created = await query(
      'mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id storeId licensePlate notes store{id name}}}',
      { input: { licensePlate: ' CA1234AB ', notes: ' First\nSecond ' } },
    );
    expect(created).toMatchObject({
      data: {
        createFleetVehicle: {
          storeId: discordia,
          licensePlate: 'CA1234AB',
          notes: 'First\nSecond',
          store: { id: discordia, name: 'Discordia' },
        },
      },
    });
    const id = record(record(record(created).data).createFleetVehicle).id;
    if (typeof id !== 'string') throw new Error('Missing Vehicle ID');
    expect(await query('query($id:ID!){fleetVehicle(id:$id){id}}', { id }, sandbox)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(
      await query(
        'mutation($id:ID!){updateFleetVehicle(id:$id,input:{notes:null}){licensePlate notes}}',
        { id },
      ),
    ).toEqual({ data: { updateFleetVehicle: { licensePlate: 'CA1234AB', notes: null } } });
    expect(await query('{fleetVehicles(search:"ca1234"){items{licensePlate}total}}')).toEqual({
      data: { fleetVehicles: { items: [{ licensePlate: 'CA1234AB' }], total: 1 } },
    });
    expect(
      await query('mutation($id:ID!){deleteFleetVehicle(id:$id){id}}', { id }, sandbox),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    expect(await query('mutation($id:ID!){deleteFleetVehicle(id:$id){id}}', { id })).toEqual({
      data: { deleteFleetVehicle: { id } },
    });
    expect(await query('{fleetVehicles{total}}')).toEqual({
      data: { fleetVehicles: { total: 0 } },
    });
  });
  it('runs Devices through Gateway with truck relations, Core resolution and scoped IMEI', async () => {
    const createdTruck = await query(
      'mutation {createFleetVehicle(input:{licensePlate:"DEVICE-TRUCK"}){id}}',
    );
    const vehicleId = record(record(record(createdTruck).data).createFleetVehicle).id;
    if (typeof vehicleId !== 'string') throw new Error('Missing truck ID');
    const created = await query(
      'mutation($input:CreateFleetDeviceInput!){createFleetDevice(input:$input){id imei vehicle{licensePlate store{id}} store{id name}}}',
      {
        input: { imei: '001234567890123', vehicleId },
      },
    );
    expect(created).toMatchObject({
      data: {
        createFleetDevice: {
          imei: '001234567890123',
          vehicle: { licensePlate: 'DEVICE-TRUCK', store: { id: discordia } },
          store: { id: discordia, name: 'Discordia' },
        },
      },
    });
    const id = record(record(record(created).data).createFleetDevice).id;
    if (typeof id !== 'string') throw new Error('Missing device ID');
    expect(await query('query($id:ID!){fleetDevice(id:$id){imei}}', { id }, sandbox)).toMatchObject(
      { errors: [{ extensions: { code: 'NOT_FOUND' } }] },
    );
    expect(
      await query(
        'mutation($input:CreateFleetDeviceInput!){createFleetDevice(input:$input){id}}',
        { input: { imei: '001234567890124', vehicleId } },
        sandbox,
      ),
    ).toHaveProperty('errors');
    expect(
      await query('mutation($id:ID!){deleteFleetVehicle(id:$id){id}}', { id: vehicleId }),
    ).toMatchObject({ errors: [{ extensions: { code: 'CONFLICT' } }] });
    expect(
      await query(
        'mutation($id:ID!){updateFleetDevice(id:$id,input:{imei:"001234567890125"}){imei}}',
        { id },
      ),
    ).toEqual({ data: { updateFleetDevice: { imei: '001234567890125' } } });
    expect(await query('{fleetDevices(search:"001234"){items{imei}total}}')).toEqual({
      data: { fleetDevices: { items: [{ imei: '001234567890125' }], total: 1 } },
    });
    expect(await query('mutation($id:ID!){deleteFleetDevice(id:$id){id}}', { id })).toEqual({
      data: { deleteFleetDevice: { id } },
    });
    expect(
      await query('mutation($id:ID!){deleteFleetVehicle(id:$id){id}}', { id: vehicleId }),
    ).toEqual({ data: { deleteFleetVehicle: { id: vehicleId } } });
  });
  it('discovers stores without selecting a store and rejects missing business scope', async () => {
    expect(await query('{stores{id name}}')).toEqual({
      data: {
        stores: [
          { id: discordia, name: 'Discordia' },
          { id: sandbox, name: 'Sandbox' },
        ],
      },
    });
    expect(await query('{fleetVehicles{total}}', {}, '')).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
    });
    expect(await query('{fleetDevices{total}}', {}, 'invalid')).toHaveProperty('errors');
    expect(await query('{fleetVehicles{total}}', {}, randomUUID())).toEqual({
      data: { fleetVehicles: { total: 0 } },
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
    fixture.fleetRequests.length = 0;
    const rejected = await fetch(fixture.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', baggage: `key=${'x'.repeat(20 * 1024)}` },
      body: JSON.stringify({ query: '{ stores { id } }' }),
      signal: AbortSignal.timeout(5000),
    });
    await rejected.text();
    expect(rejected.status).toBe(431);
    expect(fixture.coreRequests).toHaveLength(0);
    expect(fixture.fleetRequests).toHaveLength(0);
  });
  it('gates Fleet operations and entities while keeping health and discovery usable', async () => {
    const created = await query('mutation {createFleetVehicle(input:{licensePlate:"GATED"}){id}}');
    const id = record(record(record(created).data).createFleetVehicle).id;
    if (typeof id !== 'string') throw new Error('Missing Vehicle ID');
    await fixture.setFleetEnabled(false);
    try {
      expect(await query('{fleetVehicles{total}}')).toMatchObject({
        errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }],
      });
      expect(
        await query('mutation {createFleetVehicle(input:{licensePlate:"BLOCKED"}){id}}'),
      ).toHaveProperty('errors');
      expect(
        await query(
          'query($refs:[_Any!]!){_entities(representations:$refs){...on FleetVehicle{id}}}',
          { refs: [{ __typename: 'FleetVehicle', id }] },
          discordia,
          fixture.fleetUrl,
        ),
      ).toHaveProperty('errors');
      expect(await query('{stores{id}}')).toHaveProperty('data.stores');
      expect((await fetch(new URL('/health', fixture.fleetUrl))).ok).toBe(true);
    } finally {
      await fixture.setFleetEnabled(true);
    }
    expect(await query('query($id:ID!){fleetVehicle(id:$id){licensePlate}}', { id })).toEqual({
      data: { fleetVehicle: { licensePlate: 'GATED' } },
    });
    await query('mutation($id:ID!){deleteFleetVehicle(id:$id){id}}', { id });
  });
  it('checks creation against Core once per request and scopes concurrent transport headers', async () => {
    fixture.coreRequests.length = 0;
    expect(
      await query(
        'mutation {a:createFleetVehicle(input:{licensePlate:"A1"}){id} b:createFleetVehicle(input:{licensePlate:"A2"}){id}}',
      ),
    ).toHaveProperty('data');
    expect(fixture.coreRequests).toHaveLength(1);
    expect(
      await query(
        'mutation {createFleetVehicle(input:{licensePlate:"UNKNOWN"}){id}}',
        {},
        randomUUID(),
      ),
    ).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    fixture.fleetRequests.length = 0;
    await Promise.all([
      query('{fleetVehicles{total}}', {}, discordia),
      query('{fleetVehicles{total}}', {}, sandbox),
    ]);
    expect(fixture.fleetRequests.map((request) => request.storeId).sort()).toEqual([
      discordia,
      sandbox,
    ]);
  });
  it('keeps scoped CRUD available without Core and fails creation and federated Store', async () => {
    const created = await query(
      'mutation {createFleetVehicle(input:{licensePlate:"OFFLINE"}){id}}',
    );
    const id = record(record(record(created).data).createFleetVehicle).id;
    if (typeof id !== 'string') throw new Error('Missing Vehicle ID');
    await fixture.stopCore();
    try {
      expect(await query('query($id:ID!){fleetVehicle(id:$id){licensePlate}}', { id })).toEqual({
        data: { fleetVehicle: { licensePlate: 'OFFLINE' } },
      });
      expect(
        await query(
          'mutation($id:ID!){updateFleetVehicle(id:$id,input:{notes:"Changed"}){notes}}',
          { id },
        ),
      ).toEqual({
        data: { updateFleetVehicle: { notes: 'Changed' } },
      });
      expect(
        await query('mutation {createFleetVehicle(input:{licensePlate:"FAIL"}){id}}'),
      ).toHaveProperty('errors');
      expect(
        await query('query($id:ID!){fleetVehicle(id:$id){store{id name}}}', { id }),
      ).toHaveProperty('errors');
      expect(await query('mutation($id:ID!){deleteFleetVehicle(id:$id){id}}', { id })).toEqual({
        data: { deleteFleetVehicle: { id } },
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
    expect(await query('{stores{id name}}', {}, discordia, fixture.url, otherToken)).toEqual({
      data: { stores: [{ id: '10000000-0000-4000-8000-000000000003', name: 'Isolation store' }] },
    });
    const created = await query(
      'mutation {createFleetVehicle(input:{licensePlate:"TENANT-PRIVATE"}){id}}',
    );
    const id = record(record(record(created).data).createFleetVehicle).id;
    if (typeof id !== 'string') throw new Error('Missing tenant Vehicle ID');
    for (const source of [
      'query($id:ID!){fleetVehicle(id:$id){id}}',
      'mutation($id:ID!){updateFleetVehicle(id:$id,input:{notes:"Spoofed"}){id}}',
      'mutation($id:ID!){deleteFleetVehicle(id:$id){id}}',
    ])
      expect(await query(source, { id }, discordia, fixture.url, otherToken)).toMatchObject({
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    expect(
      await query(
        'mutation {createFleetVehicle(input:{licensePlate:"WRONG-STORE"}){id}}',
        {},
        discordia,
        fixture.url,
        otherToken,
      ),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    const entities =
      'query($refs:[_Any!]!){_entities(representations:$refs){...on FleetVehicle{id}}}';
    expect(
      await query(
        entities,
        {
          refs: [
            {
              __typename: 'FleetVehicle',
              id,
              tenantId: '01000000-0000-4000-8000-000000000002',
            },
          ],
        },
        discordia,
        fixture.fleetUrl,
        otherToken,
      ),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    for (const target of [fixture.url, fixture.fleetUrl]) {
      for (const authorization of [
        undefined,
        `Bearer ${token.replace('000000000001', '000000000002')}`,
      ]) {
        const response = await fetch(target, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-store-id': discordia,
            'x-tenant-id': '01000000-0000-4000-8000-000000000001',
            ...(authorization ? { authorization } : {}),
          },
          body: JSON.stringify({ query: '{fleetVehicles{total}}' }),
        });
        expect(await response.json()).toMatchObject({
          errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
        });
      }
    }
    await query('mutation($id:ID!){deleteFleetVehicle(id:$id){id}}', { id });
  });
});
