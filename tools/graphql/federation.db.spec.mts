import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { setTimeout as delay } from 'node:timers/promises';
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

function errors(body: Record<string, unknown>) {
  return Array.isArray(body.errors)
    ? body.errors.map((value: unknown) => {
        const error = record(value);
        return { message: error.message, extensions: record(error.extensions) };
      })
    : [];
}

describe('Fleet through the actual federation boundary', () => {
  let token: string;
  let fixture: Awaited<ReturnType<typeof createFederationFixture>>;
  let cleanup: (() => Promise<void>) | undefined;
  let disposed = false;
  beforeAll(async () => {
    fixture = await createFederationFixture();
    if (disposed) {
      await fixture.close();
      return;
    }
    cleanup = fixture.close;
    token = fixture.demoSession.token;
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
  async function post(
    source: string,
    headers: Record<string, string>,
    variables: Record<string, unknown> = {},
    url = fixture.url,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    return { status: response.status, body: record(body) };
  }
  it('Router serves signed Branch discovery and Vehicle→Branch federation and denies a foreign Branch', async () => {
    const session = { authorization: `Bearer ${token}`, 'x-request-id': 'router-federation' };
    const scoped = { ...session, 'x-branch-id': discordia };
    const tenants = await post('{tenants{id name}}', {});
    expect({ row: 'public tenants', value: tenants.body.data }).toEqual({
      row: 'public tenants',
      value: {
        tenants: expect.arrayContaining([
          expect.objectContaining({ id: '01000000-0000-4000-8000-000000000001' }),
        ]),
      },
    });
    const discovery = await post('{branches{id name}}', session);
    expect({ row: 'signed discovery without Branch', value: discovery.body }).toEqual({
      row: 'signed discovery without Branch',
      value: {
        data: {
          branches: [
            { id: discordia, name: 'Discordia' },
            { id: sandbox, name: 'Sandbox' },
          ],
        },
      },
    });
    const anonymous = await post('{branches{id}}', {});
    expect({
      row: 'discovery without session',
      value: errors(anonymous.body).map((error) => error.extensions.code),
    }).toEqual({ row: 'discovery without session', value: ['UNAUTHENTICATED'] });
    const created = await post(
      'mutation{createFleetVehicle(input:{licensePlate:"ROUTER TEST"}){id}}',
      scoped,
    );
    const id = record(record(created.body.data).createFleetVehicle).id;
    if (typeof id !== 'string') {
      throw new Error('Missing created Vehicle');
    }
    const coreBefore = fixture.coreRequests.length;
    const fleetBefore = fixture.fleetRequests.length;
    const vehicle = 'query($id:ID!){fleetVehicle(id:$id){id licensePlate branch{id name}}}';
    const federated = await post(vehicle, scoped, { id });
    const core = fixture.coreRequests.slice(coreBefore);
    const fleet = fixture.fleetRequests.slice(fleetBefore);
    expect({
      row: 'Vehicle Branch through Core',
      value: {
        body: federated.body,
        forwarded: [...core, ...fleet].every(
          (request) =>
            request.requestId === 'router-federation' &&
            request.branchId === discordia &&
            request.authorization === `Bearer ${token}`,
        ),
        coreEntities: core.some((request) => request.body.includes('_entities')),
        fleetReached: fleet.length > 0,
      },
    }).toEqual({
      row: 'Vehicle Branch through Core',
      value: {
        body: {
          data: {
            fleetVehicle: {
              id,
              licensePlate: 'ROUTER TEST',
              branch: { id: discordia, name: 'Discordia' },
            },
          },
        },
        forwarded: true,
        coreEntities: true,
        fleetReached: true,
      },
    });
    for (const [row, headers, code] of [
      ['Sandbox selected', { ...scoped, 'x-branch-id': sandbox }, 'NOT_FOUND'],
      ['empty Branch header', { ...scoped, 'x-branch-id': '' }, 'BAD_USER_INPUT'],
      ['invalid session', { ...scoped, authorization: 'Bearer invalid' }, 'UNAUTHENTICATED'],
    ] satisfies [string, Record<string, string>, string][]) {
      const denied = await post(vehicle, headers, { id });
      expect({
        row,
        value: { data: denied.body.data, codes: errors(denied.body).map((e) => e.extensions.code) },
      }).toEqual({ row, value: { data: null, codes: [code] } });
    }
    const unscoped = await post('{fleetVehicles{total}}', session);
    expect({
      row: 'Fleet list without Branch',
      value: errors(unscoped.body).map((error) => error.extensions.code),
    }).toEqual({ row: 'Fleet list without Branch', value: ['BAD_USER_INPUT'] });
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
    const ermSource = `query($id: ID!) {
      fleetDevice(id: $id) {
        id
        imei
        ermState {
          unitId online mode lastFrameAt
          latestEvent { eventId latitude longitude speedKmh engineOn mainVoltage backupVoltage }
          mainVoltage { value observedAt }
          backupVoltage { value observedAt }
          signalQuality { value observedAt }
          firmwareVersion { value observedAt }
          health {
            lastFrameAgeSeconds expectedIntervalSeconds overdue lastCloseReason lastClosedAt
            upstreamClosesLast24h karmaRoutingWritesLast24h
            latestKarmaRoutingWrite { command receivedAt }
          }
        }
        ermEvents(input: {pageSize: 25}) {
          items { unitId eventId eventTime positionTime latitude longitude speedKmh heading odometer engineOn mainVoltage backupVoltage fields }
          hasMore
        }
        ermFrames(input: {pageSize: 25}) {
          items { direction command reference checksum partial displayText }
          hasMore
        }
        ermCommands(input: {pageSize: 25}) {
          items { unitId reference command fields status resultCode responseText }
          hasMore
        }
        ermParameterSnapshots(input: {pageSize: 25}) {
          items { id status values { parameter title value } }
          hasMore
        }
      }
    }`;
    const unitId = '862129080366630';
    const { ermDeviceId } = fixture;
    const erm = await post(
      ermSource,
      { authorization: `Bearer ${token}`, 'x-branch-id': discordia },
      { id: ermDeviceId },
    );
    expect(erm.body).toMatchObject({
      data: {
        fleetDevice: {
          id: ermDeviceId,
          imei: unitId,
          ermState: {
            unitId,
            online: false,
            mode: null,
            latestEvent: { latitude: 42.6977, longitude: 23.3219 },
            mainVoltage: { value: 24.5, observedAt: '2026-11-02T12:00:00.000Z' },
            backupVoltage: { value: 4.1, observedAt: '2026-11-02T12:00:00.000Z' },
            signalQuality: null,
            firmwareVersion: null,
            health: {
              lastFrameAgeSeconds: expect.any(Number),
              expectedIntervalSeconds: 300,
              overdue: true,
              lastCloseReason: null,
              lastClosedAt: '2026-11-02T12:00:00.000Z',
              upstreamClosesLast24h: 0,
              karmaRoutingWritesLast24h: 0,
              latestKarmaRoutingWrite: null,
            },
          },
          ermEvents: {
            items: [
              {
                unitId,
                eventId: '1',
                eventTime: '2026-11-02T12:00:00.000Z',
                latitude: 42.6977,
                longitude: 23.3219,
                fields: { '#EID#': '1', extra: ['fixture'] },
              },
            ],
            hasMore: false,
          },
          ermFrames: {
            items: [
              {
                direction: 'HOLITA',
                command: '03',
                reference: '900000001',
                checksum: 'OK',
                partial: false,
              },
              {
                direction: 'DEVICE',
                command: '06',
                reference: '123',
                checksum: 'OK',
                partial: false,
                displayText: '$SLU862129080366630,06,123,fixture\\x10',
              },
            ],
            hasMore: false,
          },
          ermParameterSnapshots: { items: [], hasMore: false },
          ermCommands: {
            items: [
              {
                unitId,
                reference: '900000001',
                command: '03',
                fields: ['0774'],
                status: 'ANSWERED',
                resultCode: '01',
              },
            ],
            hasMore: false,
          },
        },
      },
    });
    expect(erm.body.errors).toBeUndefined();
    for (const [headers, code] of [
      [{ authorization: `Bearer ${otherToken}` }, 'BAD_USER_INPUT'],
      [{ authorization: `Bearer ${otherToken}`, 'x-branch-id': discordia }, 'NOT_FOUND'],
    ] satisfies [Record<string, string>, string][]) {
      const denied = await post(ermSource, headers, { id: ermDeviceId });
      expect({
        data: denied.body.data,
        codes: errors(denied.body).map((error) => error.extensions.code),
      }).toEqual({ data: null, codes: [code] });
    }
    for (const source of [
      '{ermUnits{items{unitId}}}',
      `{ermEvents(input:{unitId:"${unitId}"}){items{id}}}`,
      `{ermFrames(input:{unitId:"${unitId}"}){items{id}}}`,
      `{ermCommands(input:{unitId:"${unitId}"}){items{id}}}`,
    ]) {
      const removed = await post(source, {
        authorization: `Bearer ${token}`,
        'x-branch-id': discordia,
      });
      expect(removed.body.data).toBeUndefined();
      expect(errors(removed.body)).toEqual([
        expect.objectContaining({
          extensions: expect.objectContaining({ code: 'GRAPHQL_VALIDATION_FAILED' }),
        }),
      ]);
    }
    const ermEntities =
      'query($refs:[_Any!]!){_entities(representations:$refs){...on FleetDevice{ermState{unitId}}}}';
    for (const target of [fixture.url, fixture.ermUrl]) {
      for (const authorization of [undefined, 'Bearer invalid']) {
        const response = await fetch(target, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-branch-id': discordia,
            'x-tenant-id': '01000000-0000-4000-8000-000000000001',
            ...(authorization ? { authorization } : {}),
          },
          body: JSON.stringify(
            target === fixture.url
              ? { query: ermSource, variables: { id: ermDeviceId } }
              : {
                  query: ermEntities,
                  variables: {
                    refs: [{ __typename: 'FleetDevice', id: ermDeviceId, imei: unitId }],
                  },
                },
          ),
        });
        expect(await response.json()).toMatchObject({
          errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
        });
      }
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

    const tenantId = '01000000-0000-4000-8000-000000000001';
    const otherTenantId = '01000000-0000-4000-8000-000000000002';
    const session = await fixture.createUserSession(tenantId);
    const otherSession = await fixture.createUserSession(otherTenantId);
    const sessionHeaders = {
      authorization: `bearer ${session.token}`,
      'x-branch-id': discordia,
    };
    expect(
      (
        await post(
          'query($id:ID!,$deviceId:ID!){fleetVehicle(id:$id){id branch{id}} fleetDevice(id:$deviceId){id ermState{unitId}}}',
          sessionHeaders,
          { id, deviceId: ermDeviceId },
        )
      ).body,
    ).toEqual({
      data: {
        fleetVehicle: { id, branch: { id: discordia } },
        fleetDevice: { id: ermDeviceId, ermState: { unitId } },
      },
    });
    const foreignHeaders = {
      authorization: `Bearer ${otherSession.token}`,
      'x-branch-id': discordia,
      'x-tenant-id': tenantId,
      'x-user-id': session.userId,
    };
    const otherUnitId = '862129080366631';
    const otherDevice = await post(
      'mutation($imei:String!){createFleetDevice(input:{imei:$imei}){id}}',
      {
        authorization: `Bearer ${otherSession.token}`,
        'x-branch-id': '10000000-0000-4000-8000-000000000003',
      },
      { imei: otherUnitId },
    );
    expect(otherDevice.body.errors).toBeUndefined();
    const otherDeviceId = record(record(otherDevice.body.data).createFleetDevice).id;
    if (typeof otherDeviceId !== 'string') {
      throw new Error('Missing other Tenant Device ID');
    }
    const ownReference = { __typename: 'FleetDevice', id: ermDeviceId, imei: unitId };
    const otherReference = { __typename: 'FleetDevice', id: otherDeviceId, imei: otherUnitId };
    const ownState = { ermState: { unitId } };
    for (const [row, headers, refs, expected] of [
      ['owned Device', sessionHeaders, [ownReference], [ownState]],
      ['foreign Tenant', foreignHeaders, [ownReference], [null]],
      ['foreign Branch', { ...sessionHeaders, 'x-branch-id': sandbox }, [ownReference], [null]],
      [
        'missing Device',
        sessionHeaders,
        [{ ...ownReference, id: '00000000-0000-4000-8000-000000000001' }],
        [null],
      ],
      ['mismatched IMEI', sessionHeaders, [{ ...ownReference, imei: otherUnitId }], [null]],
      ['mixed Tenant batch', sessionHeaders, [ownReference, otherReference], [ownState, null]],
    ] satisfies [string, Record<string, string>, Record<string, string>[], unknown[]][]) {
      const direct = await post(ermEntities, headers, { refs }, fixture.ermUrl);
      expect({ row, body: direct.body }).toEqual({ row, body: { data: { _entities: expected } } });
    }
    for (const [target, source, variables] of [
      [fixture.url, 'query($id:ID!){fleetVehicle(id:$id){id}}', { id }],
      [fixture.url, ermSource, { id: ermDeviceId }],
      [fixture.fleetUrl, entities, { refs: [{ __typename: 'FleetVehicle', id, tenantId }] }],
    ] satisfies [string, string, Record<string, unknown>][]) {
      const denied = await post(source, foreignHeaders, variables, target);
      expect(denied.body).toMatchObject({
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    }
    const queued = await post(
      'mutation($deviceId:ID!){sendErmDeviceCommand(input:{deviceId:$deviceId,action:READ_STATUS,intent:"Session audit fixture"}){id actorId status}}',
      sessionHeaders,
      { deviceId: ermDeviceId },
    );
    expect(queued.body).toEqual({
      data: {
        sendErmDeviceCommand: {
          id: expect.any(String),
          actorId: session.userId,
          status: 'QUEUED',
        },
      },
    });
    const requestId = record(record(queued.body.data).sendErmDeviceCommand).id;
    for (const [headers, expected] of [
      [sessionHeaders, { id: requestId, actorId: session.userId }],
      [foreignHeaders, null],
    ] satisfies [Record<string, string>, unknown][]) {
      const persisted = await post(
        'query($id:ID!){ermCommandRequest(id:$id){id actorId}}',
        headers,
        { id: requestId },
        fixture.ermUrl,
      );
      expect(persisted.body).toEqual({ data: { ermCommandRequest: expected } });
    }
    const cancelled = await post(
      'mutation($deviceId:ID!,$requestId:ID!){cancelErmDeviceCommand(input:{deviceId:$deviceId,requestId:$requestId}){actorId status}}',
      sessionHeaders,
      { deviceId: ermDeviceId, requestId },
    );
    expect(cancelled.body).toEqual({
      data: { cancelErmDeviceCommand: { actorId: session.userId, status: 'CANCELLED' } },
    });
    expect((await post('mutation{signOut}', sessionHeaders)).body).toEqual({
      data: { signOut: true },
    });
    // The successful verification cache is bounded to five seconds in each subgraph.
    await delay(5100);
    for (const [target, source, variables] of [
      [fixture.url, '{fleetVehicles{total}}', {}],
      [fixture.fleetUrl, '{fleetVehicles{total}}', {}],
      [
        fixture.ermUrl,
        ermEntities,
        { refs: [{ __typename: 'FleetDevice', id: ermDeviceId, imei: unitId }] },
      ],
    ] satisfies [string, string, Record<string, unknown>][]) {
      const denied = await post(source, sessionHeaders, variables, target);
      expect(denied.body).toMatchObject({
        errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
      });
    }
    await query('mutation($id:ID!){deleteFleetVehicle(id:$id){id}}', { id });
  });
  it('preserves real public business messages, field validation and request IDs', async () => {
    const headers = {
      authorization: `Bearer ${token}`,
      'x-branch-id': discordia,
      'x-request-id': 'router-business-errors',
    };
    const created = await post(
      'mutation{createFleetVehicle(input:{licensePlate:"ROUTER CONFLICT"}){id}}',
      headers,
    );
    expect(created.body.errors).toBeUndefined();
    const vehicleId = record(record(created.body.data).createFleetVehicle).id;
    if (typeof vehicleId !== 'string') {
      throw new Error('Missing conflict-test Vehicle');
    }
    expect(
      (
        await post(
          'mutation($id:ID!){createFleetDevice(input:{imei:"000123456789019",vehicleId:$id}){id}}',
          headers,
          { id: vehicleId },
        )
      ).body.errors,
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
        'Vehicle has devices or history; deactivate it instead.',
        headers,
      ],
    ] satisfies [string, string, string, Record<string, string>][]) {
      const actual = await post(source, selectedHeaders);
      expect({ row: code, value: { status: actual.status, errors: errors(actual.body) } }).toEqual({
        row: code,
        value: {
          status: 200,
          errors: [
            {
              message,
              extensions: {
                code,
                requestId: 'router-business-errors',
                ...(code === 'BAD_USER_INPUT'
                  ? { fieldErrors: [{ path: 'licensePlate', message, code: 'REQUIRED' }] }
                  : {}),
              },
            },
          ],
        },
      });
    }
  });
  it('Router redacts internal subgraph errors, keeps only code/requestId/fieldErrors and bounds fieldErrors', async () => {
    const secret = 'private-subgraph-diagnostic-marker';
    const requestId = 'router-error-filter';
    function injected(code: string | null, message: string) {
      return {
        status: 200,
        body: JSON.stringify({
          data: null,
          errors: [
            {
              message,
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
      };
    }
    const internal = [
      {
        message: 'Internal server error',
        extensions: { code: 'INTERNAL_SERVER_ERROR', requestId },
      },
    ];
    const unavailable = [
      {
        message: 'A required service is unavailable; try again later',
        extensions: { code: 'SERVICE_UNAVAILABLE', requestId },
      },
    ];
    const fieldErrors: unknown[] = [
      { path: 'licensePlate', message: 'Required', secret },
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
      { path: 'name', message: 'Future reason', code: 'FUTURE_REASON_2' },
      { path: 'name', message: 'Longest reason', code: 'A'.repeat(64) },
      ...['', 'a', 'A-B', '1_A', 'A'.repeat(65), null, 42].map((code) => ({
        path: 'name',
        message: 'Invalid reason',
        code,
      })),
      ...Array.from({ length: 12 }, (_, index) => ({
        path: `field${String(index)}`,
        message: 'Valid',
      })),
    ];
    const publicFieldErrors = [
      { path: 'licensePlate', message: 'Required' },
      { path: 'notes', message: 'б'.repeat(300) },
      { path: 'notes', message: '😀'.repeat(150) },
      { path: 'notes', message: '' },
      { path: 'name', message: 'Future reason', code: 'FUTURE_REASON_2' },
      { path: 'name', message: 'Longest reason', code: 'A'.repeat(64) },
      ...Array.from({ length: 7 }, () => ({ path: 'name', message: 'Invalid reason' })),
      ...Array.from({ length: 9 }, (_, index) => ({
        path: `field${String(index)}`,
        message: 'Valid',
      })),
    ];
    try {
      for (const [row, response, expected] of [
        ['unknown code', injected('UNKNOWN_CODE', secret), internal],
        ['null code', injected(null, secret), internal],
        [
          'public code',
          injected('NOT_FOUND', 'Public diagnostic'),
          [{ message: 'Public diagnostic', extensions: { code: 'NOT_FOUND', requestId } }],
        ],
        [
          'bounded fieldErrors',
          {
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
          },
          [
            {
              message: 'Invalid input',
              extensions: { code: 'BAD_USER_INPUT', requestId, fieldErrors: publicFieldErrors },
            },
          ],
        ],
        ['non-JSON upstream', { status: 200, body: 'private non-JSON response' }, unavailable],
        [
          'HTTP 503 upstream',
          { status: 503, body: JSON.stringify({ message: 'private failure' }) },
          unavailable,
        ],
      ] satisfies [string, { status: number; body: string }, unknown[]][]) {
        fixture.setCoreResponse(response);
        const actual = await post('{tenants{id}}', { 'x-request-id': requestId });
        expect({
          row,
          value: {
            status: actual.status,
            errors: errors(actual.body),
            leaked: /private|untrusted-id/.test(JSON.stringify(actual.body)),
          },
        }).toEqual({ row, value: { status: 200, errors: expected, leaked: false } });
      }
      expect(fixture.logs().gateway).not.toContain(secret);
    } finally {
      fixture.setCoreResponse(undefined);
    }
  });
});
