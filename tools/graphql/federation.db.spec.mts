import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { createFederationFixture } from './federation-fixture.mjs';

const discordia = '10000000-0000-4000-8000-000000000001';
const sandbox = '10000000-0000-4000-8000-000000000002';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Expected a GraphQL object');
  }
  return value;
}

describe('Fleet through the actual federation boundary', () => {
  let token: string;
  let fixture: Awaited<ReturnType<typeof createFederationFixture>>;
  let cleanup: (() => Promise<void>) | undefined;
  let disposed = false;
  beforeAll(async () => {
    fixture = await createFederationFixture({
      deviceOperations: true,
      deviceConfigurationWrites: true,
    });
    if (disposed) {
      await fixture.close();
      return;
    }
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
    if (typeof value !== 'string') {
      throw new Error('Missing demo session token');
    }
    token = value;
  }, 180_000);
  afterAll(async () => {
    disposed = true;
    await cleanup?.();
  });
  async function query(
    source: string,
    variables: Record<string, unknown> = {},
    branchId = discordia,
    url = fixture.url,
    sessionToken = token,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sessionToken}`,
        'x-branch-id': branchId,
        'x-request-id': 'fleet-integration',
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    return body;
  }
  it('serves complete Karma users and role descriptions with shared signed access and sanitized failures', async () => {
    const source =
      '{karmaUsers{id userName active expireDate roleId firstName lastName timeZoneId email projectId projectIds} karmaRoles{id description}}';
    const first = record(record(await query(source)).data);
    expect(first.karmaUsers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '71',
          active: 0,
          expireDate: null,
          timeZoneId: 0,
          projectIds: ['12', '0'],
          firstName: '<b>Fixture name</b>',
        }),
      ]),
    );
    expect(Array.isArray(first.karmaUsers) && first.karmaUsers.length).toBe(120);
    expect(first.karmaRoles).toEqual(expect.arrayContaining([{ id: '40', description: 'Viewer' }]));
    const login = record(
      record(
        record(
          await query(
            'mutation{demoLogin(tenantId:"01000000-0000-4000-8000-000000000002"){token}}',
          ),
        ).data,
      ).demoLogin,
    );
    if (typeof login.token !== 'string') {
      throw new Error('Missing second tenant session');
    }
    expect(record(record(await query(source, {}, sandbox, fixture.url, login.token)).data)).toEqual(
      first,
    );
    const before = fixture.karma.requests.length;
    expect(record(await query(source, {}, sandbox, fixture.url, 'invalid')).errors).toBeDefined();
    expect(fixture.karma.requests).toHaveLength(before);
    fixture.karma.expire();
    expect(record(record(await query(source)).data)).toEqual(first);
    fixture.karma.setFailed(true);
    try {
      expect(record(await query(source)).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Karma is unavailable; try again later' }),
        ]),
      );
    } finally {
      fixture.karma.setFailed(false);
    }
    fixture.karma.setAccountsEmpty(true);
    try {
      expect(await query(source)).toMatchObject({ data: { karmaUsers: [], karmaRoles: [] } });
    } finally {
      fixture.karma.setAccountsEmpty(false);
    }
  });
  it('serves Karma trip/event cursor histories and a nullable period profile through signed Gateway access', async () => {
    const source =
      'query($trips:KarmaTripsInput!,$events:KarmaEventsInput!,$profile:KarmaDrivingProfileInput!){karmaTrips(input:$trips){cursor nextCursor hasMore items{id stopDate tripDistance}} karmaEvents(input:$events){cursor nextCursor hasMore items{id eventId extra spd}} karmaDrivingProfile(input:$profile){carId deviceId categories{name score weight}}}';
    const variables = {
      trips: { carId: '41' },
      events: { carId: '41' },
      profile: { carId: '41', fromDate: '2026-01-01T00:00:00', toDate: '2026-01-08T00:00:00' },
    };
    const first = record(record(await query(source, variables, '')).data),
      trips = record(first.karmaTrips),
      events = record(first.karmaEvents);
    expect(trips).toMatchObject({
      hasMore: true,
      items: expect.arrayContaining([{ id: '4000000120', stopDate: null, tripDistance: 0 }]),
    });
    expect(events).toMatchObject({
      hasMore: true,
      items: expect.arrayContaining([
        { id: '3000000600', eventId: '0', extra: '<b>Fixture event text</b>', spd: 0 },
      ]),
    });
    expect(record(first.karmaDrivingProfile).categories).toHaveLength(9);
    const next = record(
      record(
        await query(
          source,
          {
            ...variables,
            trips: { carId: '41', cursor: trips.nextCursor },
            events: { carId: '41', cursor: events.nextCursor },
          },
          sandbox,
        ),
      ).data,
    );
    expect(record(next.karmaTrips).items).toEqual(
      expect.arrayContaining([
        { id: '4000000070', stopDate: '2026-01-01 01:09:00', tripDistance: 0 },
      ]),
    );
    expect(record(next.karmaEvents).items).toEqual(
      expect.arrayContaining([
        { id: '3000000550', eventId: '0', extra: '<b>Fixture event text</b>', spd: 0 },
      ]),
    );
    const login = await query(
      'mutation {demoLogin(tenantId:"01000000-0000-4000-8000-000000000002"){token}}',
    );
    const otherToken = record(record(record(login).data).demoLogin).token;
    if (typeof otherToken !== 'string') {
      throw new Error('Missing token');
    }
    expect(record(await query(source, variables, sandbox, fixture.url, otherToken)).data).toEqual(
      first,
    );
    const before = fixture.karma.requests.length;
    expect(record(await query(source, variables, '', fixture.url, 'invalid')).errors).toBeDefined();
    expect(fixture.karma.requests).toHaveLength(before);
    expect(
      record(await query(source, { ...variables, events: { carId: '../login' } })).errors,
    ).toBeDefined();
    fixture.karma.setHistoryEmpty(true);
    try {
      expect(record(await query(source, variables)).data).toMatchObject({
        karmaTrips: { items: [], hasMore: false },
        karmaEvents: { items: [], hasMore: false },
        karmaDrivingProfile: null,
      });
    } finally {
      fixture.karma.setHistoryEmpty(false);
    }
  });
  it('shares Karma cars across authenticated tenants and Branches, rejects anonymous access and renews the upstream session', async () => {
    const source = '{karmaCars{id carNumber deviceId projectId carYear}}';
    const first = await query(source);
    expect(first).toMatchObject({
      data: {
        karmaCars: [
          {
            id: '41',
            carNumber: 'KARMA TEST 41',
            deviceId: '000123456789012',
            projectId: '12',
            carYear: '2020',
          },
        ],
      },
    });
    expect(await query(source, {}, sandbox)).toEqual(first);
    const login = await query(
      'mutation {demoLogin(tenantId:"01000000-0000-4000-8000-000000000002"){token}}',
    );
    const otherToken = record(record(record(login).data).demoLogin).token;
    if (typeof otherToken !== 'string') {
      throw new Error('Missing other tenant token');
    }
    expect(await query(source, {}, '', fixture.url, otherToken)).toEqual(first);
    const reads = fixture.karma.requests.length;
    expect(await query(source, {}, '', fixture.url, '')).toMatchObject({
      errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
    });
    expect(fixture.karma.requests).toHaveLength(reads);
    const loginsBeforeExpiry = fixture.karma.requests.filter((request) =>
      request.path.endsWith('/login'),
    ).length;
    fixture.karma.expire();
    expect(await query(source, {}, '')).toEqual(first);
    expect(
      fixture.karma.requests.filter((request) => request.path.endsWith('/login')),
    ).toHaveLength(loginsBeforeExpiry + 1);
  });

  it('keeps Fleet usable while Karma is unavailable and recovers the cars list', async () => {
    fixture.karma.setFailed(true);
    try {
      expect(await query('{karmaCars{id}}')).toMatchObject({
        errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }],
      });
      expect(await query('{fleetVehicles{total}}')).toMatchObject({
        data: { fleetVehicles: { total: expect.any(Number) } },
      });
    } finally {
      fixture.karma.setFailed(false);
    }
    expect(await query('{karmaCars{id}}')).toMatchObject({ data: { karmaCars: [{ id: '41' }] } });
  });

  it('reads Karma truck details, handles missing/invalid IDs and authenticates before upstream access', async () => {
    const source = 'query($id:ID!){karmaCar(id:$id){id deviceId subType timeZoneId driverCount}}';
    expect(await query(source, { id: '41' }, '')).toMatchObject({
      data: {
        karmaCar: {
          id: '41',
          deviceId: '000123456789012',
          subType: 'Trailer',
          timeZoneId: 8,
          driverCount: 0,
        },
      },
    });
    const reads = fixture.karma.requests.length;
    expect(await query(source, { id: '41' }, '', fixture.url, '')).toMatchObject({
      errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
    });
    expect(await query(source, { id: '../login' }, '')).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
    });
    expect(fixture.karma.requests).toHaveLength(reads);
    expect(await query(source, { id: '999' }, '')).toMatchObject({ data: { karmaCar: null } });
    fixture.karma.expire();
    expect(await query(source, { id: '41' }, sandbox)).toMatchObject({
      data: { karmaCar: { id: '41' } },
    });
  });
  it('reads Karma location and references across tenants/Branches with authorization and session renewal', async () => {
    const source =
      '{karmaLocation(carId:"41"){carId deviceId messageId eventId latitude longitude spd extra} karmaProjects{id name} karmaTimeZones{id name} karmaVersion{version}}';
    for (const branch of ['', sandbox]) {
      expect(await query(source, {}, branch)).toMatchObject({
        data: {
          karmaLocation: {
            carId: '41',
            deviceId: '000123456789012',
            messageId: '3000000600',
            eventId: '0',
            latitude: 0,
            longitude: 0,
            spd: 0,
            extra: '<b>Fixture plain text</b>',
          },
          karmaProjects: [{ id: '12', name: 'Fixture project' }],
          karmaVersion: { version: '2.26.1.1' },
        },
      });
    }
    const first = await query(source, {}, '');
    const login = await query(
      'mutation {demoLogin(tenantId:"01000000-0000-4000-8000-000000000002"){token}}',
    );
    const otherToken = record(record(record(login).data).demoLogin).token;
    if (typeof otherToken !== 'string') {
      throw new Error('Missing other tenant token');
    }
    expect(await query(source, {}, '', fixture.url, otherToken)).toEqual(first);
    const reads = fixture.karma.requests.length;
    for (const session of ['', 'invalid']) {
      expect(await query(source, {}, '', fixture.url, session)).toMatchObject({
        errors: expect.arrayContaining([
          expect.objectContaining({
            extensions: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
          }),
        ]),
      });
    }
    expect(fixture.karma.requests).toHaveLength(reads);
    expect(await query('{karmaLocation(carId:"../login"){carId}}', {}, '')).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
    });
    expect(fixture.karma.requests).toHaveLength(reads);
    expect(await query('{karmaLocation(carId:"999"){carId}}', {}, '')).toMatchObject({
      data: { karmaLocation: null },
    });
    fixture.karma.expire();
    expect(await query('{karmaLocation(carId:"41"){carId}}', {}, '')).toMatchObject({
      data: { karmaLocation: { carId: '41' } },
    });
    fixture.karma.setLocationCoordinates(null, null);
    try {
      expect(await query('{karmaLocation(carId:"41"){latitude longitude}}', {}, '')).toMatchObject({
        data: { karmaLocation: { latitude: null, longitude: null } },
      });
    } finally {
      fixture.karma.setLocationCoordinates(0, 0);
    }
  });

  it('pages global Karma eData through Gateway with UTC/parameter filters and authorization', async () => {
    const source =
      'query($input:KarmaEdataInput!){karmaEdata(input:$input){hasMore nextCursor items{id carId deviceId spd parameters{id value description}}}}';
    const first = await query(source, { input: { carId: '41' } }, '');
    const page = record(record(record(first).data).karmaEdata);
    expect(page).toMatchObject({
      hasMore: true,
      items: expect.arrayContaining([
        {
          id: '3000000600',
          carId: '41',
          deviceId: '000123456789012',
          spd: 0,
          parameters: [
            { id: '99999', value: 0, description: 'Unlisted fixture parameter' },
            { id: '1', value: 850, description: 'Engine RPM [rpm]' },
          ],
        },
      ]),
    });
    expect(page.items).toHaveLength(50);
    expect(await query(source, { input: { carId: '41' } }, sandbox)).toEqual(first);
    const reads = fixture.karma.requests.length;
    expect(await query(source, { input: { carId: '41' } }, '', fixture.url, '')).toMatchObject({
      errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
    });
    expect(await query(source, { input: { carId: '41', pageSize: 500 } }, '')).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
    });
    expect(fixture.karma.requests).toHaveLength(reads);
    fixture.karma.expire();
    expect(
      await query(source, { input: { carId: '41', cursor: page.nextCursor } }, ''),
    ).toMatchObject({
      data: {
        karmaEdata: {
          items: expect.arrayContaining([expect.objectContaining({ id: '3000000550' })]),
        },
      },
    });
    expect(
      await query(
        source,
        {
          input: {
            carId: '41',
            fromDate: '2026-01-01T00:00:00Z',
            toDate: '2026-01-01T00:00:00Z',
            parameterIds: ['99999'],
          },
        },
        '',
      ),
    ).toEqual({
      data: {
        karmaEdata: {
          hasMore: false,
          nextCursor: null,
          items: [
            {
              id: '3000000001',
              carId: '41',
              deviceId: '000123456789012',
              spd: 0,
              parameters: [{ id: '99999', value: 0, description: 'Unlisted fixture parameter' }],
            },
          ],
        },
      },
    });
    expect(await query(source, { input: { carId: '999' } }, '')).toMatchObject({
      errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }],
    });
  });
  it('runs Vehicles CRUD through Gateway with Core branch resolution and foreign-ID isolation', async () => {
    const created = await query(
      'mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id branchId licensePlate notes branch{id name}}}',
      { input: { licensePlate: ' CA1234AB ', notes: ' First\nSecond ' } },
    );
    expect(created).toMatchObject({
      data: {
        createFleetVehicle: {
          branchId: discordia,
          licensePlate: 'CA1234AB',
          notes: 'First\nSecond',
          branch: { id: discordia, name: 'Discordia' },
        },
      },
    });
    const id = record(record(record(created).data).createFleetVehicle).id;
    if (typeof id !== 'string') {
      throw new Error('Missing Vehicle ID');
    }
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
    if (typeof vehicleId !== 'string') {
      throw new Error('Missing truck ID');
    }
    const created = await query(
      'mutation($input:CreateFleetDeviceInput!){createFleetDevice(input:$input){id imei vehicle{__typename id licensePlate} branch{id name}}}',
      {
        input: { imei: '001234567890123', vehicleId },
      },
    );
    expect(created).toMatchObject({
      data: {
        createFleetDevice: {
          imei: '001234567890123',
          vehicle: { __typename: 'FleetVehicleRef', id: vehicleId, licensePlate: 'DEVICE-TRUCK' },
          branch: { id: discordia, name: 'Discordia' },
        },
      },
    });
    const id = record(record(record(created).data).createFleetDevice).id;
    if (typeof id !== 'string') {
      throw new Error('Missing device ID');
    }
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
  it('discovers branches without selecting a branch and rejects missing business scope', async () => {
    expect(await query('{branches{id name}}')).toEqual({
      data: {
        branches: [
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
        'access-control-request-headers': 'content-type,x-branch-id,x-request-id',
      },
      signal: AbortSignal.timeout(5000),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:11000');
    expect(response.headers.get('access-control-allow-headers')).toContain('x-branch-id');
    fixture.coreRequests.length = 0;
    fixture.fleetRequests.length = 0;
    const rejected = await fetch(fixture.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', baggage: `key=${'x'.repeat(20 * 1024)}` },
      body: JSON.stringify({ query: '{ branches { id } }' }),
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
    if (typeof id !== 'string') {
      throw new Error('Missing Vehicle ID');
    }
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
      expect(await query('{branches{id}}')).toHaveProperty('data.branches');
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
    expect(fixture.fleetRequests.map((request) => request.branchId).sort()).toEqual([
      discordia,
      sandbox,
    ]);
  });
  it('keeps scoped CRUD available without Core and fails creation and federated Branch', async () => {
    const created = await query(
      'mutation {createFleetVehicle(input:{licensePlate:"OFFLINE"}){id}}',
    );
    const id = record(record(record(created).data).createFleetVehicle).id;
    if (typeof id !== 'string') {
      throw new Error('Missing Vehicle ID');
    }
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
        await query('query($id:ID!){fleetVehicle(id:$id){branch{id name}}}', { id }),
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
    if (typeof otherToken !== 'string') {
      throw new Error('Missing second tenant session');
    }
    expect(await query('{branches{id name}}', {}, discordia, fixture.url, otherToken)).toEqual({
      data: {
        branches: [{ id: '10000000-0000-4000-8000-000000000003', name: 'Isolation branch' }],
      },
    });
    const created = await query(
      'mutation {createFleetVehicle(input:{licensePlate:"TENANT-PRIVATE"}){id}}',
    );
    const id = record(record(record(created).data).createFleetVehicle).id;
    if (typeof id !== 'string') {
      throw new Error('Missing tenant Vehicle ID');
    }
    for (const source of [
      'query($id:ID!){fleetVehicle(id:$id){id}}',
      'mutation($id:ID!){updateFleetVehicle(id:$id,input:{notes:"Spoofed"}){id}}',
      'mutation($id:ID!){deleteFleetVehicle(id:$id){id}}',
    ]) {
      expect(await query(source, { id }, discordia, fixture.url, otherToken)).toMatchObject({
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    }
    expect(
      await query(
        'mutation {createFleetVehicle(input:{licensePlate:"WRONG-BRANCH"}){id}}',
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
            'x-branch-id': discordia,
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
  it('manages drivers and vehicle groups through Gateway with Core creation checks and sanitized field errors', async () => {
    fixture.coreRequests.length = 0;
    const driver = await query(
      'mutation($input:CreateFleetDriverInput!){createFleetDriver(input:$input){id firstName employeeNumber licenseExpiresOn documentStatus vehicles{id}}}',
      {
        input: {
          firstName: 'Георги',
          lastName: 'Иванов',
          employeeNumber: 'GW-001',
          licenseExpiresOn: '2030-01-31',
        },
      },
    );
    expect(driver).toMatchObject({
      data: {
        createFleetDriver: {
          firstName: 'Георги',
          employeeNumber: 'GW-001',
          licenseExpiresOn: '2030-01-31',
          documentStatus: 'VALID',
          vehicles: [],
        },
      },
    });
    const driverId = record(record(record(driver).data).createFleetDriver).id;
    const group = await query(
      'mutation($input:CreateFleetVehicleGroupInput!){createFleetVehicleGroup(input:$input){id name colorToken vehicleCount}}',
      { input: { name: 'Gateway group', colorToken: 'C4' } },
    );
    expect(group).toMatchObject({
      data: {
        createFleetVehicleGroup: { name: 'Gateway group', colorToken: 'C4', vehicleCount: 0 },
      },
    });
    const groupId = record(record(record(group).data).createFleetVehicleGroup).id;
    expect(fixture.coreRequests).toHaveLength(2);
    const vehicle = await query(
      'mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id status group{id name colorToken} currentDriver{id firstName lastName} deviceCount branch{name}}}',
      {
        input: {
          licensePlate: 'CB 1001 AX',
          fleetNumber: 'GW-01',
          groupId,
          currentDriverId: driverId,
        },
      },
    );
    expect(vehicle).toMatchObject({
      data: {
        createFleetVehicle: {
          status: 'ACTIVE',
          group: { id: groupId, name: 'Gateway group', colorToken: 'C4' },
          currentDriver: { id: driverId, firstName: 'Георги', lastName: 'Иванов' },
          deviceCount: 0,
          branch: { name: 'Discordia' },
        },
      },
    });
    const vehicleId = record(record(record(vehicle).data).createFleetVehicle).id;
    expect(
      await query('mutation($input:CreateFleetDriverInput!){createFleetDriver(input:$input){id}}', {
        input: { firstName: 'Second', lastName: 'Driver', employeeNumber: 'GW-001' },
      }),
    ).toMatchObject({
      errors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [
              {
                path: 'employeeNumber',
                message: 'Employee number is already used in this branch.',
              },
            ],
          },
        },
      ],
    });
    expect(
      await query('mutation($input:CreateFleetDriverInput!){createFleetDriver(input:$input){id}}', {
        input: { firstName: 'Second', lastName: 'Driver', licenseExpiresOn: '2026-02-30' },
      }),
    ).toMatchObject({
      errors: [
        { extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'licenseExpiresOn' }] } },
      ],
    });
    expect(
      await query(
        '{fleetDrivers(filter:{hasVehicle:true}){items{id vehicles{id licensePlate}}total} fleetVehicleGroups{items{name vehicleCount}total ungroupedVehicleCount}}',
      ),
    ).toMatchObject({
      data: {
        fleetDrivers: {
          items: [{ id: driverId, vehicles: [{ id: vehicleId, licensePlate: 'CB 1001 AX' }] }],
          total: 1,
        },
        fleetVehicleGroups: { items: [{ name: 'Gateway group', vehicleCount: 1 }], total: 1 },
      },
    });
    expect(
      await query(
        '{fleetDrivers{total} fleetVehicleGroups{total ungroupedVehicleCount} fleetVehicles(filter:{hasGroup:true}){total}}',
        {},
        sandbox,
      ),
    ).toEqual({
      data: {
        fleetDrivers: { total: 0 },
        fleetVehicleGroups: { total: 0, ungroupedVehicleCount: 0 },
        fleetVehicles: { total: 0 },
      },
    });
    for (const source of [
      'query($id:ID!){fleetDriver(id:$id){id}}',
      'mutation($id:ID!){deleteFleetDriver(id:$id){id}}',
    ]) {
      expect(await query(source, { id: driverId }, sandbox)).toMatchObject({
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    }
    expect(
      await query('mutation($id:ID!){deleteFleetVehicleGroup(id:$id){id}}', { id: groupId }),
    ).toMatchObject({
      errors: [
        {
          message: 'Vehicle group still contains vehicles; move them first.',
          extensions: { code: 'CONFLICT' },
        },
      ],
    });
    expect(
      await query('mutation($id:ID!){deactivateFleetVehicle(id:$id){status currentDriver{id}}}', {
        id: vehicleId,
      }),
    ).toEqual({ data: { deactivateFleetVehicle: { status: 'INACTIVE', currentDriver: null } } });
    expect(
      await query('mutation($id:ID!){deleteFleetVehicle(id:$id){id}}', { id: vehicleId }),
    ).toEqual({ data: { deleteFleetVehicle: { id: vehicleId } } });
    expect(
      await query('mutation($id:ID!){deleteFleetVehicleGroup(id:$id){id}}', { id: groupId }),
    ).toEqual({ data: { deleteFleetVehicleGroup: { id: groupId } } });
    expect(
      await query('mutation($id:ID!){deleteFleetDriver(id:$id){id}}', { id: driverId }),
    ).toEqual({ data: { deleteFleetDriver: { id: driverId } } });
  });
  it('records odometer readings and runs the alert workflow through Gateway', async () => {
    const created = await query(
      'mutation {createFleetVehicle(input:{licensePlate:"CB 1004 AX"}){id}}',
    );
    const vehicleId = record(record(record(created).data).createFleetVehicle).id;
    if (typeof vehicleId !== 'string') {
      throw new Error('Missing vehicle ID');
    }
    // A vehicle without an installed device is NO_DEVICE whatever its samples say.
    expect(
      await query(
        'mutation($vehicleId:ID!){createFleetDevice(input:{imei:"990601000000004",vehicleId:$vehicleId}){imei}}',
        { vehicleId },
      ),
    ).toEqual({ data: { createFleetDevice: { imei: '990601000000004' } } });
    // No API creates device samples or events, so the spec inserts them into the per-run schema.
    const asOf = new Date(Math.floor(Date.now() / 1000) * 1000 - 10 * 60_000);
    const alertId = randomUUID();
    const connection = new pg.Client({ connectionString: fixture.fleetDatabaseUrl });
    await connection.connect();
    try {
      const schema = pg.escapeIdentifier(fixture.fleetSchema);
      const scope = ['01000000-0000-4000-8000-000000000001', discordia, vehicleId];
      await connection.query(
        `INSERT INTO ${schema}."VehicleStatusSample" ("id", "tenantId", "branchId", "vehicleId", "deviceImei", "source", "recordedAt", "receivedAt", "ignition", "speedKph") VALUES ($1, $2, $3, $4, '990601000000004', 'DEMO', $5, $5, false, 0)`,
        [randomUUID(), ...scope, asOf],
      );
      await connection.query(
        `INSERT INTO ${schema}."FleetEvent" ("id", "tenantId", "branchId", "vehicleId", "source", "occurredAt", "kind", "severity", "troubleCode", "alertStatus", "updatedAt") VALUES ($1, $2, $3, $4, 'DEMO', $5, 'DIAGNOSTIC_TROUBLE_CODE', 'CRITICAL', 'P0299', 'OPEN', $5)`,
        [alertId, ...scope, new Date(asOf.getTime() - 5 * 60_000)],
      );
    } finally {
      await connection.end();
    }
    expect(await query('{fleetDataClock{asOf timeZone}}')).toEqual({
      data: { fleetDataClock: { asOf: asOf.toISOString(), timeZone: 'Europe/Sofia' } },
    });
    const recordedAt = new Date(asOf.getTime() - 30 * 60_000).toISOString();
    fixture.coreRequests.length = 0;
    expect(
      await query(
        'mutation($input:RecordFleetOdometerReadingInput!){recordFleetOdometerReading(input:$input){source deviceImei recordedAt odometerKm}}',
        { input: { vehicleId, odometerKm: 120_000.04, recordedAt } },
      ),
    ).toEqual({
      data: {
        recordFleetOdometerReading: {
          source: 'MANUAL',
          deviceImei: null,
          recordedAt,
          odometerKm: 120_000,
        },
      },
    });
    expect(fixture.coreRequests).toHaveLength(1);
    expect(
      await query(
        'mutation($input:RecordFleetOdometerReadingInput!){recordFleetOdometerReading(input:$input){id}}',
        { input: { vehicleId, odometerKm: 119_999, recordedAt: asOf.toISOString() } },
      ),
    ).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'odometerKm' }] } }],
    });
    expect(
      await query(
        'query($id:ID!){fleetVehicle(id:$id){openAlertCount state{activity lastReportedAt odometerKm odometerSource}}}',
        { id: vehicleId },
      ),
    ).toEqual({
      data: {
        fleetVehicle: {
          openAlertCount: 1,
          state: {
            activity: 'PARKED',
            lastReportedAt: asOf.toISOString(),
            odometerKm: 120_000,
            odometerSource: 'MANUAL',
          },
        },
      },
    });
    const acknowledge =
      'mutation($id:ID!){acknowledgeFleetAlert(id:$id,input:{expectedStatus:OPEN,remark:"Проверено"}){alertStatus remark vehicle{licensePlate}}}';
    expect(await query(acknowledge, { id: alertId })).toEqual({
      data: {
        acknowledgeFleetAlert: {
          alertStatus: 'ACKNOWLEDGED',
          remark: 'Проверено',
          vehicle: { licensePlate: 'CB 1004 AX' },
        },
      },
    });
    expect(await query(acknowledge, { id: alertId })).toMatchObject({
      errors: [{ extensions: { code: 'CONFLICT' } }],
    });
    for (const search of [null, 'p0299', 'CB 1004', 'missing']) {
      const counts = record(
        record(
          await query(
            'query($search:String){fleetAlertCounts(search:$search){open openCritical acknowledged resolved}}',
            { search },
          ),
        ).data,
      ).fleetAlertCounts;
      const events = record(
        record(
          await query(
            'query($search:String){fleetEvents(search:$search,filter:{actionable:true}){total}}',
            { search },
          ),
        ).data,
      ).fleetEvents;
      const values = record(counts);
      expect(record(events).total).toBe(
        Number(values.open) + Number(values.acknowledged) + Number(values.resolved),
      );
      expect(values).toEqual(
        search === 'missing'
          ? { open: 0, openCritical: 0, acknowledged: 0, resolved: 0 }
          : { open: 0, openCritical: 0, acknowledged: 1, resolved: 0 },
      );
    }
    expect(
      await query(
        '{fleetAlertCounts{open openCritical acknowledged resolved} fleetEvents{total} fleetDataClock{asOf}}',
        {},
        sandbox,
      ),
    ).toEqual({
      data: {
        fleetAlertCounts: { open: 0, openCritical: 0, acknowledged: 0, resolved: 0 },
        fleetEvents: { total: 0 },
        fleetDataClock: { asOf: null },
      },
    });
  });
  it('persists complete General preferences through Gateway only in the verified Tenant and selected Branch', async () => {
    const fields = 'timeZone distanceUnit volumeUnit lowFuelPct notReportingHours speedLimitKph';
    const read = `{fleetSettings{${fields}}}`;
    const update = `mutation($input:UpdateFleetSettingsInput!){updateFleetSettings(input:$input){${fields}}}`;
    const defaults = {
      timeZone: 'Europe/Sofia',
      distanceUnit: 'KM',
      volumeUnit: 'LITRE',
      lowFuelPct: 12,
      notReportingHours: 48,
      speedLimitKph: 90,
    };
    expect(await query(read)).toEqual({ data: { fleetSettings: defaults } });
    expect(await query(read, {}, sandbox)).toEqual({ data: { fleetSettings: defaults } });
    const input = {
      timeZone: 'Europe/Belgrade',
      distanceUnit: 'MI',
      volumeUnit: 'US_GALLON',
      lowFuelPct: 18,
      notReportingHours: 24,
      speedLimitKph: 100,
    };
    expect(await query(update, { input })).toEqual({ data: { updateFleetSettings: input } });
    expect(await query(read)).toEqual({ data: { fleetSettings: input } });
    expect(await query(read, {}, sandbox)).toEqual({ data: { fleetSettings: defaults } });
    const login = await query(
      'mutation{demoLogin(tenantId:"01000000-0000-4000-8000-000000000002"){token}}',
    );
    const otherToken = record(record(record(login).data).demoLogin).token;
    if (typeof otherToken !== 'string') {
      throw new Error('Missing second tenant session');
    }
    expect(await query(read, {}, discordia, fixture.url, otherToken)).toEqual({
      data: { fleetSettings: defaults },
    });
    expect(
      await query(update, { input: defaults }, discordia, fixture.url, otherToken),
    ).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(await query(update, { input: { ...input, lowFuelPct: 0 } })).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path: 'lowFuelPct' }] } }],
    });
    expect(await query(read)).toEqual({ data: { fleetSettings: input } });
    const connection = new pg.Client({ connectionString: fixture.fleetDatabaseUrl });
    await connection.connect();
    try {
      const rows = await connection.query<{ tenantId: string; branchId: string }>(
        `SELECT "tenantId"::text, "branchId"::text FROM ${pg.escapeIdentifier(fixture.fleetSchema)}."FleetSettings"`,
      );
      expect(rows.rows).toEqual([
        { tenantId: '01000000-0000-4000-8000-000000000001', branchId: discordia },
      ]);
    } finally {
      await connection.end();
    }
  });

  it('renames the selected Core Branch through Gateway and rejects a mismatched selection or foreign Tenant', async () => {
    const rename = 'mutation($id:ID!,$name:String!){updateBranchName(id:$id,name:$name){id name}}';
    expect(await query(rename, { id: discordia, name: '  Gateway renamed fleet  ' })).toEqual({
      data: { updateBranchName: { id: discordia, name: 'Gateway renamed fleet' } },
    });
    const read = 'query($id:ID!){branch(id:$id){id name} branches{id name}}';
    expect(await query(read, { id: discordia })).toEqual({
      data: {
        branch: { id: discordia, name: 'Gateway renamed fleet' },
        branches: [
          { id: discordia, name: 'Gateway renamed fleet' },
          { id: sandbox, name: 'Sandbox' },
        ],
      },
    });
    expect(
      await query(rename, { id: discordia, name: 'Wrong selected Branch' }, sandbox),
    ).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
    });
    const login = await query(
      'mutation{demoLogin(tenantId:"01000000-0000-4000-8000-000000000002"){token}}',
    );
    const otherToken = record(record(record(login).data).demoLogin).token;
    if (typeof otherToken !== 'string') {
      throw new Error('Missing second tenant session');
    }
    expect(
      await query(
        rename,
        { id: discordia, name: 'Wrong Tenant' },
        discordia,
        fixture.url,
        otherToken,
      ),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    expect(await query('query($id:ID!){branch(id:$id){id name}}', { id: discordia })).toEqual({
      data: { branch: { id: discordia, name: 'Gateway renamed fleet' } },
    });
    expect(
      await query('query($id:ID!){branch(id:$id){id name}}', { id: sandbox }, sandbox),
    ).toEqual({
      data: { branch: { id: sandbox, name: 'Sandbox' } },
    });
  });

  it('persists a queued device configuration read across a Fleet restart and completes through the real scheduler', async () => {
    const created = await query('mutation{createFleetDevice(input:{imei:"000123456789012"}){id}}');
    const deviceId = record(record(record(created).data).createFleetDevice).id;
    if (typeof deviceId !== 'string') {
      throw new Error('Missing device ID');
    }
    const login = await query(
      'mutation{demoLogin(tenantId:"01000000-0000-4000-8000-000000000002"){token}}',
    );
    const otherToken = record(record(record(login).data).demoLogin).token;
    if (typeof otherToken !== 'string') {
      throw new Error('Missing second tenant session');
    }
    const request =
      'mutation($input:RequestFleetDeviceConfigurationReadInput!){requestFleetDeviceConfigurationRead(input:$input){id deviceId status queueIds configuration{configurationId}}}';
    const input = { deviceId, karmaCarId: '41', expectedKarmaDeviceId: '000123456789012' };
    const providerReads = fixture.karma.requests.length;
    for (const [branchId, sessionToken] of [
      [sandbox, token],
      [discordia, otherToken],
    ]) {
      expect(await query(request, { input }, branchId, fixture.url, sessionToken)).toMatchObject({
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    }
    expect(fixture.karma.requests).toHaveLength(providerReads);
    for (const authorization of [undefined, `Bearer ${token}`]) {
      const response = await fetch(
        new URL('/internal/device-configuration/request', fixture.karmaClientUrl),
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(authorization ? { authorization } : {}),
          },
          body: JSON.stringify({ carId: '41', expectedDeviceId: '000123456789012' }),
          signal: AbortSignal.timeout(5000),
        },
      );
      await response.text();
      expect(response.status).toBe(401);
    }
    expect(fixture.karma.configurationCommands).toEqual([]);
    const requestedAt = Date.now();
    const queued = record(
      record(record(await query(request, { input })).data).requestFleetDeviceConfigurationRead,
    );
    expect(Date.now() - requestedAt).toBeLessThan(5000);
    expect(queued).toMatchObject({ deviceId, status: 'QUEUED', queueIds: [], configuration: null });
    const id = queued.id;
    if (typeof id !== 'string') {
      throw new Error('Missing operation ID');
    }
    const read =
      'query($id:ID!){fleetDeviceOperation(id:$id){id deviceId status queueIds observationCount coverageComplete configuration{configurationId parameters{parameterId intervalSeconds definitionHex}} errorCode}}';
    async function operation() {
      return record(record(record(await query(read, { id })).data).fleetDeviceOperation);
    }
    async function waitForStatus(status: string, until: number) {
      let latest: Record<string, unknown> = {};
      while (Date.now() < until) {
        latest = await operation();
        if (latest.status === status) {
          return latest;
        }
        await delay(200);
      }
      throw new Error(
        `Device operation did not reach ${status}; last status ${String(latest.status)}`,
      );
    }
    await waitForStatus('WAITING', Date.now() + 20_000);
    expect(fixture.karma.configurationCommands).toEqual(['30,1,19,0,19,301,0,1,1,0702BC']);
    expect(await operation()).toMatchObject({
      id,
      status: 'WAITING',
      queueIds: ['9001'],
      configuration: null,
    });
    for (const [branchId, sessionToken] of [
      [sandbox, token],
      [discordia, otherToken],
    ]) {
      expect(await query(read, { id }, branchId, fixture.url, sessionToken)).toEqual({
        data: { fleetDeviceOperation: null },
      });
      expect(
        await query(
          'query($deviceId:ID!){fleetDeviceOperations(deviceId:$deviceId){id}}',
          { deviceId },
          branchId,
          fixture.url,
          sessionToken,
        ),
      ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    }
    await fixture.restartFleet();
    expect(await operation()).toMatchObject({
      id,
      deviceId,
      status: 'WAITING',
      queueIds: ['9001'],
      configuration: null,
    });
    fixture.karma.completeConfigurationRead();
    const completed = await waitForStatus('COMPLETE', Date.now() + 35_000);
    expect(completed).toMatchObject({
      id,
      deviceId,
      status: 'COMPLETE',
      queueIds: ['9001'],
      observationCount: 2,
      coverageComplete: true,
      errorCode: null,
      configuration: {
        configurationId: '1001',
        parameters: [
          {
            parameterId: 662,
            intervalSeconds: 30,
            definitionHex: '0296000000000000000000000000000000000000001E',
          },
          {
            parameterId: 153,
            intervalSeconds: 0,
            definitionHex: '00990000000000000000000000000000000000000000',
          },
        ],
      },
    });
    expect(fixture.karma.configurationCommands).toHaveLength(1);
    expect(await operation()).toEqual(completed);
  }, 60_000);

  it('adds a parameter through an uncertain write and restart, then preserves unknown definitions during an interval update', async () => {
    const unknownDefinition = [
      'FDE8',
      '12345678',
      '10',
      '20',
      '0003',
      '0007',
      'FFFB',
      'A5A5',
      '1234',
      '02',
      'E0',
      '000A',
    ].join('');
    fixture.karma.setConfigurationDefinitions([
      '0296000000000000000000000000000000000000001E',
      '00990000000000000000000000000000000000000000',
      unknownDefinition,
    ]);
    fixture.karma.setConfigurationAutomaticResponses(true);
    const listed = record(
      record(await query('{fleetDevices(search:"000123456789012"){items{id}}}')).data,
    ).fleetDevices;
    const items = record(listed).items;
    if (!Array.isArray(items)) {
      throw new Error('Missing device list');
    }
    const existing: unknown = items[0];
    const created = existing
      ? record(existing)
      : record(
          record(
            record(await query('mutation{createFleetDevice(input:{imei:"000123456789012"}){id}}'))
              .data,
          ).createFleetDevice,
        );
    const deviceId = created.id;
    if (typeof deviceId !== 'string') {
      throw new Error('Missing device ID');
    }
    const target = { deviceId, karmaCarId: '41', expectedKarmaDeviceId: '000123456789012' };
    const operationQuery = `query($id:ID!){fleetDeviceOperation(id:$id){
      id deviceId status kind phase baselineOperationId parameterId intervalSeconds
      writeDispatchedAt writeUncertain errorCode configuration{configurationId parameters{parameterId intervalSeconds definitionHex}}
    }}`;
    async function operation(id: string) {
      return record(record(record(await query(operationQuery, { id })).data).fleetDeviceOperation);
    }
    async function waitFor(
      id: string,
      predicate: (row: Record<string, unknown>) => boolean,
      timeout: number,
    ) {
      const until = Date.now() + timeout;
      let latest: Record<string, unknown> = {};
      while (Date.now() < until) {
        latest = await operation(id);
        if (predicate(latest)) {
          return latest;
        }
        if (['FAILED', 'TIMED_OUT'].includes(String(latest.status))) {
          throw new Error(`Device change failed: ${String(latest.errorCode)}`);
        }
        await delay(200);
      }
      throw new Error(
        `Device change did not settle: ${String(latest.status)}/${String(latest.phase)}/${String(latest.errorCode)}`,
      );
    }
    async function waitForCommand(command: string, previous: number) {
      const until = Date.now() + 35_000;
      while (Date.now() < until) {
        if (
          fixture.karma.configurationCommands.filter((value) => value === command).length > previous
        ) {
          return;
        }
        await delay(100);
      }
      throw new Error('Expected fixed device command was not submitted');
    }
    function operationId(body: unknown, field: string) {
      const id = record(record(record(body).data)[field]).id;
      if (typeof id !== 'string') {
        throw new Error('Missing saved operation');
      }
      return id;
    }
    const baselineId = operationId(
      await query(
        'mutation($input:RequestFleetDeviceConfigurationReadInput!){requestFleetDeviceConfigurationRead(input:$input){id}}',
        { input: target },
      ),
      'requestFleetDeviceConfigurationRead',
    );
    await waitFor(baselineId, (row) => row.status === 'COMPLETE', 45_000);
    const presets = record(
      record(await query('{fleetDeviceParameterPresets{catalogId parameterId profileIds}}')).data,
    ).fleetDeviceParameterPresets;
    if (!Array.isArray(presets)) {
      throw new Error('Missing catalog choices');
    }
    const preset = presets
      .map((value: unknown) => record(value))
      .find((value) => value.parameterId === 781);
    if (!preset || typeof preset.catalogId !== 'string') {
      throw new Error('Missing catalog-backed battery preset');
    }
    const addInput = {
      ...target,
      baselineOperationId: baselineId,
      catalogId: preset.catalogId,
      parameterId: 781,
      intervalSeconds: 60,
    };
    const addition =
      'mutation($input:RequestFleetDeviceParameterAdditionInput!){requestFleetDeviceParameterAddition(input:$input){id status}}';
    const beforeForeign = fixture.karma.configurationCommands.length;
    expect(await query(addition, { input: addInput }, sandbox)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(fixture.karma.configurationCommands).toHaveLength(beforeForeign);
    const profileCommand = '30,1,19,0,19,301,0,1,1,1F';
    const readCommand = '30,1,19,0,19,301,0,1,1,0702BC';
    const previousProfile = fixture.karma.configurationCommands.filter(
      (value) => value === profileCommand,
    ).length;
    const previousRead = fixture.karma.configurationCommands.filter(
      (value) => value === readCommand,
    ).length;
    fixture.karma.setConfigurationReadsHeld(true);
    fixture.karma.setConfigurationWriteUncertain(true);
    const additionId = operationId(
      await query(addition, { input: addInput }),
      'requestFleetDeviceParameterAddition',
    );
    await waitForCommand(profileCommand, previousProfile);
    fixture.karma.setConfigurationReadsHeld(false);
    fixture.karma.setConfigurationReadsHeld(true);
    await waitForCommand(readCommand, previousRead);
    fixture.karma.completeConfigurationRead();
    await waitFor(
      additionId,
      (row) => row.phase === 'VERIFY_PARAMETERS' && row.writeUncertain === true,
      60_000,
    );
    await fixture.restartFleet();
    expect(await operation(additionId)).toMatchObject({
      kind: 'ADD_PARAMETER',
      writeUncertain: true,
      parameterId: 781,
      intervalSeconds: 60,
    });
    fixture.karma.setConfigurationReadsHeld(false);
    const added = await waitFor(additionId, (row) => row.status === 'COMPLETE', 45_000);
    expect(added).toMatchObject({
      kind: 'ADD_PARAMETER',
      baselineOperationId: baselineId,
      writeUncertain: true,
      configuration: {
        parameters: expect.arrayContaining([
          { parameterId: 65000, intervalSeconds: 10, definitionHex: unknownDefinition },
          {
            parameterId: 781,
            intervalSeconds: 60,
            definitionHex: '030D000000000000000000000000000000000000003C',
          },
        ]),
      },
    });
    const writes = () =>
      fixture.karma.configurationCommands.filter((value) =>
        value.startsWith('30,1,19,0,19,301,0,1,1,02'),
      );
    expect(writes()).toEqual([
      '30,1,19,0,19,301,0,1,1,02030D000000000000000100010000000000000000003C',
    ]);
    fixture.karma.setConfigurationWriteUncertain(false);
    const updateId = operationId(
      await query(
        'mutation($input:RequestFleetDeviceParameterIntervalUpdateInput!){requestFleetDeviceParameterIntervalUpdate(input:$input){id}}',
        {
          input: {
            ...target,
            baselineOperationId: additionId,
            parameterId: 65000,
            intervalSeconds: 0,
          },
        },
      ),
      'requestFleetDeviceParameterIntervalUpdate',
    );
    const updated = await waitFor(updateId, (row) => row.status === 'COMPLETE', 90_000);
    expect(updated).toMatchObject({
      kind: 'UPDATE_INTERVAL',
      baselineOperationId: additionId,
      parameterId: 65000,
      intervalSeconds: 0,
      configuration: {
        parameters: expect.arrayContaining([
          {
            parameterId: 65000,
            intervalSeconds: 0,
            definitionHex: unknownDefinition.slice(0, 40) + '0000',
          },
          {
            parameterId: 781,
            intervalSeconds: 60,
            definitionHex: '030D000000000000000000000000000000000000003C',
          },
          {
            parameterId: 662,
            intervalSeconds: 30,
            definitionHex: '0296000000000000000000000000000000000000001E',
          },
          {
            parameterId: 153,
            intervalSeconds: 0,
            definitionHex: '00990000000000000000000000000000000000000000',
          },
        ]),
      },
    });
    expect(writes()).toHaveLength(2);
    expect(writes()[1]).toBe('30,1,19,0,19,301,0,1,1,02' + unknownDefinition.slice(0, 40) + '0000');
    expect(await query(operationQuery, { id: updateId }, sandbox)).toEqual({
      data: { fleetDeviceOperation: null },
    });
  }, 240_000);
});
