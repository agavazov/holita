import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { setTimeout as delay } from 'node:timers/promises';
import {
  configurationFixtureDefinition,
  configurationFixtureGlobals,
  configurationFixtureImei,
  createFederationFixture,
} from './federation-fixture.mjs';

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
    const ermSource = `query($refs: [_Any!]!) {
      _entities(representations: $refs) { ... on FleetDevice {
        id
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
      } }
    }`;
    const unitId = '862129080366630';
    const { ermDeviceId } = fixture;
    const references = (id: string, imei: string) => ({
      refs: [{ __typename: 'FleetDevice', id, imei }],
    });
    const erm = await post(
      ermSource,
      { authorization: `Bearer ${token}`, 'x-branch-id': discordia },
      references(ermDeviceId, unitId),
      fixture.ermUrl,
    );
    expect(erm.body).toMatchObject({
      data: {
        _entities: [
          {
            id: ermDeviceId,
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
                  eventId: '01',
                  eventTime: '2026-11-02T12:00:00.000Z',
                  latitude: 42.6977,
                  longitude: 23.3219,
                  fields: { '#EID#': '01', extra: ['fixture'] },
                },
              ],
              hasMore: false,
            },
            ermFrames: {
              items: [
                {
                  direction: 'DEVICE',
                  command: '02',
                  reference: '125',
                  checksum: 'MISMATCH',
                  partial: false,
                },
                {
                  direction: 'DISCOCAN',
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
        ],
      },
    });
    expect(erm.body.errors).toBeUndefined();

    const pageFields = 'total offset limit cursor nextCursor hasMore';
    const eventFields =
      'id category severity latitude longitude en: name(language: EN) bg: name(language: BG)';
    const readingFields = 'value observedAt';
    const inspectionSource = `query($id: ID!) {
      fleetDevice(id: $id) {
        state {
          imei connected connectedSince lastReportAt alarmsLast24h
          latestPosition { ${eventFields} }
          latestEvent { ${eventFields} }
          externalVoltage { ${readingFields} }
          backupBatteryVoltage { ${readingFields} }
          signalQuality { ${readingFields} }
          firmwareVersion { ${readingFields} }
          health { expectedIntervalSeconds overdue lastCloseReason lastClosedAt }
          erm { mode recovery { id } }
        }
        events(input: {pageSize: 25, severities: [INFO], sort: {field: CODE}}) {
          ${pageFields}
          items { ${eventFields} code recordedAt speedKph erm { fields edata } }
        }
        messages(input: {pageSize: 25, direction: ASC}) {
          ${pageFields}
          items {
            id direction receivedAt displayText payloadHex partial erm { command reference checksum }
            acknowledgement { commandId commandRequestId resultCode receivedAt erm { commandReference replyReference } }
          }
        }
      }
    }`;
    const legacyInspection = `query($refs: [_Any!]!) {
      _entities(representations: $refs) { ... on FleetDevice {
        ermState {
          imei: unitId connected: online connectedSince lastReportAt: lastFrameAt alarmsLast24h
          latestPosition: lastPosition { ${eventFields} }
          latestEvent { ${eventFields} }
          externalVoltage: mainVoltage { ${readingFields} }
          backupBatteryVoltage: backupVoltage { ${readingFields} }
          signalQuality { ${readingFields} }
          firmwareVersion { ${readingFields} }
          health { expectedIntervalSeconds overdue lastCloseReason lastClosedAt }
          mode recovery { id }
        }
        ermEvents(input: {pageSize: 25, severities: [INFO], sort: {field: EVENT_TYPE}}) {
          ${pageFields}
          items { ${eventFields} code: eventId recordedAt: eventTime speedKph: speedKmh fields edata }
        }
        ermFrames(input: {pageSize: 25, direction: ASC}) {
          ${pageFields}
          items {
            id direction receivedAt displayText payloadHex: rawHex partial command reference checksum
            acknowledgement { commandId commandRequestId resultCode receivedAt commandReference replyReference }
          }
        }
      } }
    }`;
    const requestStart = fixture.ermRequests.length;
    const inspection = record(await query(inspectionSource, { id: ermDeviceId }));
    expect(inspection.errors).toBeUndefined();
    expect(fixture.ermRequests.slice(requestStart)).toEqual(
      Array.from({ length: 3 }, () =>
        expect.objectContaining({ authorization: `Bearer ${token}`, branchId: discordia }),
      ),
    );
    const inspected = record(record(inspection.data).fleetDevice);
    const legacy = await post(
      legacyInspection,
      { authorization: `Bearer ${token}`, 'x-branch-id': discordia },
      references(ermDeviceId, unitId),
      fixture.ermUrl,
    );
    expect(legacy.body.errors).toBeUndefined();
    const entitiesResult = record(legacy.body.data)._entities;
    const legacyDevice = record(Array.isArray(entitiesResult) ? entitiesResult[0] : undefined);
    const { mode, recovery, ...state } = record(legacyDevice.ermState);
    expect(inspected.state).toEqual({ ...state, erm: { mode, recovery } });
    expect(record(inspected.state).latestEvent).toMatchObject({
      en: 'Location report',
      bg: 'Отчет за местоположение',
    });
    const legacyEvents = record(legacyDevice.ermEvents);
    expect(legacyEvents.items).toHaveLength(1);
    const { fields, edata, ...event } = record(
      (Array.isArray(legacyEvents.items) ? legacyEvents.items : [])[0],
    );
    expect(inspected.events).toEqual({
      ...legacyEvents,
      items: [{ ...event, erm: { fields, edata } }],
    });
    const legacyFrames = record(legacyDevice.ermFrames);
    const frames: unknown[] = Array.isArray(legacyFrames.items) ? legacyFrames.items : [];
    expect(frames).toHaveLength(3);
    expect(record(frames[2]).acknowledgement).toMatchObject({
      commandId: '30000000-0000-4000-8000-000000000001',
      commandReference: '900000001',
      resultCode: '01',
    });
    expect(inspected.messages).toEqual({
      ...legacyFrames,
      items: frames.map((value) => {
        const { command, reference, checksum, acknowledgement, direction, ...frame } =
          record(value);
        const ack = acknowledgement === null ? null : record(acknowledgement);
        return {
          ...frame,
          direction: direction === 'DISCOCAN' ? 'SERVER' : direction,
          erm: { command, reference, checksum },
          acknowledgement: ack && {
            commandId: ack.commandId,
            commandRequestId: ack.commandRequestId,
            resultCode: ack.resultCode,
            receivedAt: ack.receivedAt,
            erm: { commandReference: ack.commandReference, replyReference: ack.replyReference },
          },
        };
      }),
    });
    const beforeDenied = fixture.ermRequests.length;
    expect(await query(inspectionSource, { id: ermDeviceId }, sandbox)).toMatchObject({
      data: null,
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(fixture.ermRequests).toHaveLength(beforeDenied);

    const added = record(
      await query('mutation {createFleetDevice(input:{imei:"862129080366632", type:ERM}){id}}'),
    );
    const unreportedId = record(record(added.data).createFleetDevice).id;
    const ids = [ermDeviceId, unreportedId];
    const batchStart = fixture.ermRequests.length;
    const listSource = `query($ids:[ID!]!, $show:Boolean!) {
      fleetDevices(ids:$ids) { items { id ...Inspection @include(if:$show) } }
    }
    fragment Inspection on FleetDevice { current: state { imei } }`;
    const skipped = record(await query(listSource, { ids, show: false }));
    expect(skipped.errors).toBeUndefined();
    expect(fixture.ermRequests).toHaveLength(batchStart);
    expect(await query(listSource, { ids, show: true })).toEqual({
      data: {
        fleetDevices: {
          items: expect.arrayContaining([
            { id: ermDeviceId, current: { imei: unitId } },
            { id: unreportedId, current: null },
          ]),
        },
      },
    });
    expect(fixture.ermRequests).toHaveLength(batchStart + 1);
    expect(fixture.ermRequests[batchStart]?.body).toContain('862129080366632');
    expect(
      await query(
        'query($refs:[_Any!]!){_entities(representations:$refs){...on FleetDevice{id state{imei}}}}',
        { refs: ids.map((id) => ({ __typename: 'FleetDevice', id })) },
        discordia,
        fixture.fleetUrl,
      ),
    ).toEqual({
      data: {
        _entities: [
          { id: ermDeviceId, state: { imei: unitId } },
          { id: unreportedId, state: null },
        ],
      },
    });
    expect(fixture.ermRequests).toHaveLength(batchStart + 2);
    for (const [headers, code] of [
      [{ authorization: `Bearer ${otherToken}` }, 'BAD_USER_INPUT'],
      [{ authorization: `Bearer ${otherToken}`, 'x-branch-id': discordia }, 'NOT_FOUND'],
    ] satisfies [Record<string, string>, string][]) {
      const denied = await post(inspectionSource, headers, { id: ermDeviceId });
      expect({
        data: denied.body.data,
        codes: errors(denied.body).map((error) => error.extensions.code),
      }).toEqual({ data: null, codes: [code] });
    }
    for (const source of [
      '{ermUnits{items{unitId}}}',
      '{fleetDevice(id:"device"){ermState{unitId} ermEvents{total} ermFrames{total} ermCommands{hasMore} ermParameterSnapshots{total} ermConfigurationChanges{id} ermConfigurationWritesEnabled ermCommandRequests{id}}}',
      '{ermCommandRequest(id:"request"){id} ermCommandRequests{total} ermCommandBatch(id:"batch"){id} ermConfigurationBatch(id:"batch"){id} ermParameterCatalog{total} ermDeviceActionCommands{action}}',
      'mutation{sendErmDeviceCommand(input:{deviceId:"device",action:READ_STATUS}){id}}',
      `{ermEvents(input:{unitId:"${unitId}"}){items{id}}}`,
      `{ermFrames(input:{unitId:"${unitId}"}){items{id}}}`,
      `{ermCommands(input:{unitId:"${unitId}"}){items{id}}}`,
    ]) {
      const removed = await post(source, {
        authorization: `Bearer ${token}`,
        'x-branch-id': discordia,
      });
      expect(removed.body.data).toBeUndefined();
      expect(errors(removed.body).map((error) => error.extensions.code)).toEqual(
        expect.arrayContaining(['GRAPHQL_VALIDATION_FAILED']),
      );
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
              ? { query: inspectionSource, variables: { id: ermDeviceId } }
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
    expect(
      await query(
        'mutation($device:ID!,$vehicle:ID!){updateFleetDevice(id:$device,input:{vehicleId:$vehicle}){state{imei}}}',
        { device: ermDeviceId, vehicle: id },
      ),
    ).toEqual({ data: { updateFleetDevice: { state: { imei: unitId } } } });
    expect(
      await query(
        `query($id:ID!) {
      fleetVehicle(id:$id) { devices { state { imei } } }
      fleetFaultMonitor { devices { state { imei } } }
    }`,
        { id },
      ),
    ).toMatchObject({
      data: {
        fleetVehicle: { devices: [{ state: { imei: unitId } }] },
        fleetFaultMonitor: expect.arrayContaining([{ devices: [{ state: { imei: unitId } }] }]),
      },
    });
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
          'query($id:ID!,$deviceId:ID!){fleetVehicle(id:$id){id branch{id}} fleetDevice(id:$deviceId){id state{imei}}}',
          sessionHeaders,
          { id, deviceId: ermDeviceId },
        )
      ).body,
    ).toEqual({
      data: {
        fleetVehicle: { id, branch: { id: discordia } },
        fleetDevice: { id: ermDeviceId, state: { imei: unitId } },
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
      [fixture.url, inspectionSource, { id: ermDeviceId }],
      [fixture.fleetUrl, entities, { refs: [{ __typename: 'FleetVehicle', id, tenantId }] }],
    ] satisfies [string, string, Record<string, unknown>][]) {
      const denied = await post(source, foreignHeaders, variables, target);
      expect(denied.body).toMatchObject({
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    }
    const queued = await post(
      'mutation($deviceId:ID!){sendDeviceCommand(input:{deviceId:$deviceId,action:READ_STATUS,intent:"Session audit fixture"}){id actorId status}}',
      sessionHeaders,
      { deviceId: ermDeviceId },
    );
    expect(queued.body).toEqual({
      data: {
        sendDeviceCommand: {
          id: expect.any(String),
          actorId: session.userId,
          status: 'QUEUED',
        },
      },
    });
    const requestId = record(record(queued.body.data).sendDeviceCommand).id;
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
      'mutation($deviceId:ID!,$requestId:ID!){cancelDeviceCommand(input:{deviceId:$deviceId,requestId:$requestId}){actorId status}}',
      sessionHeaders,
      { deviceId: ermDeviceId, requestId },
    );
    expect(cancelled.body).toEqual({
      data: { cancelDeviceCommand: { actorId: session.userId, status: 'CANCELLED' } },
    });
    const sendCommand = `mutation($deviceId: ID!) {
      sendDeviceCommand(input: {deviceId: $deviceId, action: READ_FAULTS, intent: "Generic fault fixture"}) {
        id deviceId deviceType imei action status actorId intent displayParameters { expiresInSeconds }
      }
    }`;
    const generic = await post(sendCommand, sessionHeaders, { deviceId: ermDeviceId });
    expect(generic.body).toEqual({
      data: {
        sendDeviceCommand: {
          id: expect.any(String),
          deviceId: ermDeviceId,
          deviceType: 'ERM',
          imei: unitId,
          action: 'READ_FAULTS',
          status: 'QUEUED',
          actorId: session.userId,
          intent: 'Generic fault fixture',
          displayParameters: { expiresInSeconds: 7200 },
        },
      },
    });
    const genericId = record(record(generic.body.data).sendDeviceCommand).id;
    expect(
      (
        await post(
          'query($id:ID!){ermCommandRequest(id:$id){deviceId action actorId intent status}}',
          sessionHeaders,
          { id: genericId },
          fixture.ermUrl,
        )
      ).body,
    ).toEqual({
      data: {
        ermCommandRequest: {
          deviceId: ermDeviceId,
          action: 'READ_EDATA_FAULTS',
          actorId: session.userId,
          intent: 'Generic fault fixture',
          status: 'QUEUED',
        },
      },
    });
    expect(
      (
        await post(
          `query($id:ID!, $deviceId:ID!) {
      fleetDeviceCommandRequest(id:$id) { id action }
      fleetDeviceCommandRequests(filter:{actions:[READ_FAULTS],deviceIds:[$deviceId]}) {
        total items { id action }
      }
      fleetDevice(id:$deviceId) { commandRequests { id action } commands { items { id erm { command reference } } hasMore } }
      fleetDeviceActionCatalog(deviceType:ERM) { action requiresParameters }
    }`,
          sessionHeaders,
          { id: genericId, deviceId: ermDeviceId },
        )
      ).body,
    ).toMatchObject({
      data: {
        fleetDeviceCommandRequest: { id: genericId, action: 'READ_FAULTS' },
        fleetDeviceCommandRequests: { total: 1, items: [{ id: genericId, action: 'READ_FAULTS' }] },
        fleetDevice: {
          commandRequests: expect.arrayContaining([{ id: genericId, action: 'READ_FAULTS' }]),
          commands: {
            items: [
              {
                id: '30000000-0000-4000-8000-000000000001',
                erm: { command: '03', reference: '900000001' },
              },
            ],
            hasMore: false,
          },
        },
        fleetDeviceActionCatalog: expect.arrayContaining([
          { action: 'READ_FAULTS', requiresParameters: false },
          { action: 'READ_PARAMETERS', requiresParameters: true },
        ]),
      },
    });
    expect(
      (
        await post(
          'mutation($deviceId:ID!,$id:ID!){cancelDeviceCommand(input:{deviceId:$deviceId,requestId:$id}){id status cancelledByActorId}}',
          sessionHeaders,
          { deviceId: ermDeviceId, id: genericId },
        )
      ).body,
    ).toEqual({
      data: {
        cancelDeviceCommand: {
          id: genericId,
          status: 'CANCELLED',
          cancelledByActorId: session.userId,
        },
      },
    });
    const viewer = await fixture.createUserSession(tenantId, 'viewer');
    const commandCalls = fixture.ermRequests.length;
    for (const [headers, code] of [
      [{ ...sessionHeaders, 'x-branch-id': sandbox }, 'NOT_FOUND'],
      [{ ...sessionHeaders, authorization: `Bearer ${viewer.token}` }, 'FORBIDDEN'],
    ] as const) {
      expect((await post(sendCommand, headers, { deviceId: ermDeviceId })).body).toMatchObject({
        errors: [{ extensions: { code } }],
      });
    }
    expect(fixture.ermRequests).toHaveLength(commandCalls);
    const configurationDevice = await post(
      'mutation($imei:String!){createFleetDevice(input:{imei:$imei,type:ERM}){id}}',
      sessionHeaders,
      { imei: configurationFixtureImei },
    );
    expect(configurationDevice.body.errors).toBeUndefined();
    const configurationId = record(record(configurationDevice.body.data).createFleetDevice).id;
    if (typeof configurationId !== 'string') {
      throw new Error('Missing configuration Device ID');
    }
    const configurationTarget = { id: configurationId };
    const startSnapshot = `mutation($id:ID!){
      startDeviceParameterSnapshot(input:{deviceId:$id}){id actorId imei intent}
    }`;
    const readMeasurement = `mutation($id:ID!){
      startDeviceMeasurementConfigurationChange(input:{deviceId:$id,operation:READ}){
        id actorId imei operation
      }
    }`;
    const writeSources = [
      'startDeviceParameterChange(input:{deviceId:$id,parameterId:"0774",value:"30"})',
      'startDeviceParametersChange(input:{deviceId:$id,parameters:[{parameterId:"0774",value:"30"}]})',
      'startDeviceConfigurationBatch(input:{deviceIds:[$id],parameters:[{parameterId:"0774",value:"30"}]})',
      'startDeviceMeasurementConfigurationChange(input:{deviceId:$id,operation:INTERVAL,parameterId:662,intervalSeconds:120})',
    ].map((field) => `mutation($id:ID!){${field}{id}}`);
    const beforeConfigurationCalls = fixture.ermRequests.length;
    for (const source of [startSnapshot, readMeasurement, ...writeSources]) {
      for (const [headers, code] of [
        [{ ...sessionHeaders, 'x-branch-id': sandbox }, 'NOT_FOUND'],
        [{ ...sessionHeaders, authorization: `Bearer ${viewer.token}` }, 'FORBIDDEN'],
      ] as const) {
        expect((await post(source, headers, configurationTarget)).body).toMatchObject({
          errors: [{ extensions: { code } }],
        });
      }
    }
    expect(fixture.ermRequests).toHaveLength(beforeConfigurationCalls);

    const tracker = await fixture.connectConfigurationDevice();
    try {
      async function waitForDevice(
        selection: string,
        ready: (device: Record<string, unknown>) => boolean,
      ) {
        const deadline = Date.now() + 15_000;
        let device: Record<string, unknown>;
        do {
          const response = await post(
            `query($id:ID!){fleetDevice(id:$id){${selection}}}`,
            sessionHeaders,
            configurationTarget,
          );
          expect(response.body.errors).toBeUndefined();
          device = record(record(response.body.data).fleetDevice);
          if (ready(device)) {
            return device;
          }
          await delay(50);
        } while (Date.now() < deadline);
        throw new Error(`Timed out waiting for configuration fixture: ${JSON.stringify(device)}`);
      }

      async function readErmDevice(selection: string) {
        const response = await post(
          `query($refs:[_Any!]!){_entities(representations:$refs){...on FleetDevice{ ${selection} }}}`,
          sessionHeaders,
          references(configurationTarget.id, configurationFixtureImei),
          fixture.ermUrl,
        );
        expect(response.body.errors).toBeUndefined();
        const entities = record(response.body.data)._entities;
        return record(Array.isArray(entities) ? entities[0] : undefined);
      }

      await waitForDevice(
        'state{connected}',
        (device) => isRecord(device.state) && device.state.connected === true,
      );
      const legacyStart = await post(
        'mutation($id:ID!){startErmParameterSnapshot(input:{deviceId:$id}){id actorId}}',
        sessionHeaders,
        configurationTarget,
        fixture.ermUrl,
      );
      expect(legacyStart.body).toMatchObject({
        data: { startErmParameterSnapshot: { id: expect.any(String), actorId: session.userId } },
      });
      const snapshotFields = 'id actorId intent status parameterCount readCount';
      const snapshotHistory = await waitForDevice('parameterSnapshots{items{status}}', (device) => {
        const items = record(device.parameterSnapshots).items;
        return (
          Array.isArray(items) && items.some((item: unknown) => record(item).status === 'COMPLETE')
        );
      });
      expect(record(snapshotHistory.parameterSnapshots).items).toEqual([{ status: 'COMPLETE' }]);
      tracker.setSnapshotValue('current');
      const snapshot = await post(startSnapshot, sessionHeaders, configurationTarget);
      expect(snapshot.body).toEqual({
        data: {
          startDeviceParameterSnapshot: {
            id: expect.any(String),
            actorId: session.userId,
            imei: configurationFixtureImei,
            intent: 'Read parameter snapshot',
          },
        },
      });
      const snapshotId = record(record(snapshot.body.data).startDeviceParameterSnapshot).id;
      const histories = await waitForDevice(
        `parameterSnapshots(input:{pageSize:25}) {
          total items { ${snapshotFields} changes { parameterId previousValue value erm { parameter } } }
        }`,
        (device) => {
          const items = record(device.parameterSnapshots).items;
          return (
            Array.isArray(items) &&
            items.some(
              (item: unknown) =>
                record(item).id === snapshotId && record(item).status === 'COMPLETE',
            )
          );
        },
      );
      const genericHistory = record(histories.parameterSnapshots);
      const legacySnapshots = await readErmDevice(`ermParameterSnapshots(input:{pageSize:25}) {
        total items { ${snapshotFields} changes { parameter previousValue value } }
      }`);
      const legacyHistory = record(legacySnapshots.ermParameterSnapshots);
      const genericItems = Array.isArray(genericHistory.items) ? genericHistory.items : [];
      const legacyItems = Array.isArray(legacyHistory.items) ? legacyHistory.items : [];
      expect(genericHistory.total).toBe(2);
      expect(genericHistory.total).toBe(legacyHistory.total);
      const { changes, ...snapshotAudit } = record(genericItems[0]);
      const { changes: legacyChanges, ...legacySnapshotAudit } = record(legacyItems[0]);
      expect(snapshotAudit).toMatchObject({ id: snapshotId, status: 'COMPLETE' });
      expect(snapshotAudit).toEqual(legacySnapshotAudit);
      expect(changes).toEqual(
        expect.arrayContaining([
          {
            parameterId: '0001',
            previousValue: 'previous',
            value: 'current',
            erm: { parameter: 1 },
          },
        ]),
      );
      expect(legacyChanges).toEqual(
        expect.arrayContaining([{ parameter: 1, previousValue: 'previous', value: 'current' }]),
      );

      const measurement = await post(readMeasurement, sessionHeaders, configurationTarget);
      expect(measurement.body).toEqual({
        data: {
          startDeviceMeasurementConfigurationChange: {
            id: expect.any(String),
            actorId: session.userId,
            imei: configurationFixtureImei,
            operation: 'READ_MEASUREMENT_CONFIGURATION',
          },
        },
      });
      const changeId = record(
        record(measurement.body.data).startDeviceMeasurementConfigurationChange,
      ).id;
      const configuration = await waitForDevice(
        `configurationWritesEnabled
        configurationChanges {
          id actorId status intent
          measurementConfiguration { configurationId definitions { parameterId intervalSeconds definitionHex } globalsHex profileId }
          erm { baseline steps stepDetails { name commandId transportCommand { id } } }
        }`,
        (device) => {
          const changes = device.configurationChanges;
          return (
            Array.isArray(changes) &&
            changes.some(
              (item: unknown) => record(item).id === changeId && record(item).status === 'READ',
            )
          );
        },
      );
      expect(configuration).toMatchObject({
        configurationWritesEnabled: false,
        configurationChanges: [
          {
            id: changeId,
            actorId: session.userId,
            status: 'READ',
            measurementConfiguration: {
              configurationId: '1001',
              definitions: [
                {
                  parameterId: 662,
                  intervalSeconds: 60,
                  definitionHex: configurationFixtureDefinition,
                },
              ],
              globalsHex: configurationFixtureGlobals,
              profileId: 7,
            },
          },
        ],
      });
      const currentChanges = Array.isArray(configuration.configurationChanges)
        ? configuration.configurationChanges
        : [];
      const {
        measurementConfiguration: measured,
        erm: evidence,
        ...audit
      } = record(currentChanges[0]);
      expect(measured).toBeDefined();
      const legacyConfiguration = await readErmDevice(`ermConfigurationWritesEnabled
        ermConfigurationChanges {
          id actorId status intent baseline steps stepDetails { name commandId transportCommand { id } }
        }`);
      expect(legacyConfiguration).toEqual({
        ermConfigurationWritesEnabled: false,
        ermConfigurationChanges: [{ ...audit, ...record(evidence) }],
      });
      expect(record(evidence).stepDetails).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'baseline',
            commandId: expect.any(String),
            transportCommand: { id: expect.any(String) },
          }),
        ]),
      );
      for (const source of writeSources) {
        const result = await post(source, sessionHeaders, configurationTarget);
        expect(result.body).toMatchObject({
          errors: [
            { message: 'ERM configuration writes are disabled', extensions: { code: 'FORBIDDEN' } },
          ],
        });
      }
      expect(new Set(tracker.receivedCommands)).toEqual(new Set(['45', '30']));
    } finally {
      await tracker.close();
    }

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
