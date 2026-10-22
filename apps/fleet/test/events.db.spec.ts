import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { createTestDatabase } from './test-database.js';

const tenantId = '01000000-0000-4000-8000-000000000001';
const asOf = new Date('2026-10-18T06:30:00.000Z');
const now = new Date('2026-10-18T07:00:00.000Z');
const hours = (value: number) => new Date(asOf.getTime() + value * 3_600_000);

type EventKey = 'speeding' | 'trouble' | 'idling' | 'crash' | 'ignition' | 'braking';

describe('Events and alert workflow with PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let url: string;
  const branchId = randomUUID(),
    otherBranchId = randomUUID();
  const events = new Map<EventKey, string>();
  let van: string, truck: string, driver: string, tripId: string, foreignAlert: string;
  function event(key: EventKey): string {
    const id = events.get(key);
    if (!id) {
      throw new Error(`Missing event ${key}`);
    }
    return id;
  }
  beforeAll(async () => {
    database = await createTestDatabase();
    closeDatabase = database.close;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(CoreClient)
      .useValue({ requireBranch: jest.fn<CoreClient['requireBranch']>() })
      .overrideProvider(FleetClock)
      .useValue({ now: () => now })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/graphql`;
    const client = database.client;
    van = (
      await client.vehicle.create({
        data: { tenantId, branchId, licensePlate: 'CB 1028 AX', fleetNumber: 'Б-02' },
      })
    ).id;
    truck = (
      await client.vehicle.create({ data: { tenantId, branchId, licensePlate: 'CB 1004 AX' } })
    ).id;
    driver = (
      await client.driver.create({
        data: { tenantId, branchId, firstName: 'Петър', lastName: 'Петров' },
      })
    ).id;
    tripId = (
      await client.trip.create({
        data: { tenantId, branchId, vehicleId: van, source: 'DEMO', startedAt: hours(-4) },
      })
    ).id;
    const rows: [EventKey, Omit<Prisma.FleetEventUncheckedCreateInput, 'tenantId' | 'branchId'>][] =
      [
        [
          'speeding',
          {
            vehicleId: van,
            tripId,
            driverId: driver,
            source: 'DEMO',
            occurredAt: hours(-1),
            kind: 'SPEEDING',
            severity: 'WARNING',
            intensity: 3,
            address: 'АМ „Тракия“ км 42',
            measuredValue: 128,
            thresholdValue: 90,
            alertStatus: 'OPEN',
          },
        ],
        [
          'trouble',
          {
            vehicleId: truck,
            source: 'DEMO',
            occurredAt: hours(-5),
            kind: 'DIAGNOSTIC_TROUBLE_CODE',
            severity: 'CRITICAL',
            troubleCode: 'P0299',
            alertStatus: 'OPEN',
          },
        ],
        [
          'idling',
          {
            vehicleId: van,
            source: 'DEMO',
            occurredAt: hours(-48),
            kind: 'IDLING',
            severity: 'WARNING',
            alertStatus: 'ACKNOWLEDGED',
            acknowledgedAt: hours(-47.9),
          },
        ],
        [
          'crash',
          {
            vehicleId: truck,
            source: 'DEMO',
            occurredAt: hours(-216),
            kind: 'CRASH_DETECTED',
            severity: 'CRITICAL',
            alertStatus: 'RESOLVED',
            acknowledgedAt: hours(-215.9),
            resolvedAt: hours(-213),
            remark: 'Проверено',
          },
        ],
        [
          'ignition',
          {
            vehicleId: van,
            tripId,
            source: 'DEMO',
            occurredAt: hours(-3),
            kind: 'IGNITION_ON',
            severity: 'INFO',
          },
        ],
        [
          'braking',
          {
            vehicleId: van,
            tripId,
            driverId: driver,
            source: 'DEMO',
            occurredAt: hours(-2.9),
            kind: 'HARSH_BRAKING',
            severity: 'INFO',
            intensity: 2,
          },
        ],
      ];
    for (const [key, data] of rows) {
      events.set(
        key,
        (await client.fleetEvent.create({ data: { ...data, tenantId, branchId } })).id,
      );
    }
    // Alerts of another Branch and another Tenant never appear or count.
    for (const [scopeTenant, scopeBranch] of [
      [tenantId, otherBranchId],
      [randomUUID(), branchId],
    ] as const) {
      const vehicle = await client.vehicle.create({
        data: { tenantId: scopeTenant, branchId: scopeBranch, licensePlate: 'CB 1004 AX' },
      });
      foreignAlert = (
        await client.fleetEvent.create({
          data: {
            tenantId: scopeTenant,
            branchId: scopeBranch,
            vehicleId: vehicle.id,
            source: 'DEMO',
            occurredAt: hours(-1),
            kind: 'CRASH_DETECTED',
            severity: 'CRITICAL',
            troubleCode: 'P0299',
            alertStatus: 'OPEN',
          },
        })
      ).id;
    }
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await closeDatabase?.();
    }
  });
  async function query(source: string, variables: Record<string, unknown>, scope = branchId) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issueDemoToken(tenantId)}`,
        'x-branch-id': scope,
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    return body;
  }
  const list =
    'query($search:String,$filter:FleetEventFilter,$sort:FleetEventSort){fleetEvents(search:$search,filter:$filter,sort:$sort,limit:100){items{id}total}}';
  function page(keys: EventKey[]) {
    return {
      data: { fleetEvents: { items: keys.map((key) => ({ id: event(key) })), total: keys.length } },
    };
  }
  async function listed(variables: Record<string, unknown>) {
    const body = await query(list, variables);
    expect(body).not.toHaveProperty('errors');
    return body;
  }

  it('events list and alert counts agree', async () => {
    const pages: [string, Record<string, unknown>, EventKey[]][] = [
      ['newest first', {}, ['speeding', 'braking', 'ignition', 'trouble', 'idling', 'crash']],
      [
        'severity descending',
        { sort: { field: 'SEVERITY', direction: 'DESC' } },
        ['trouble', 'crash', 'speeding', 'idling', 'braking', 'ignition'],
      ],
      [
        'severity ascending',
        { sort: { field: 'SEVERITY', direction: 'ASC' } },
        ['braking', 'ignition', 'speeding', 'idling', 'trouble', 'crash'],
      ],
      ['actionable', { filter: { actionable: true } }, ['speeding', 'trouble', 'idling', 'crash']],
      ['informational', { filter: { actionable: false } }, ['braking', 'ignition']],
      [
        'alert statuses',
        { filter: { alertStatuses: ['OPEN', 'RESOLVED'] } },
        ['speeding', 'trouble', 'crash'],
      ],
      ['fleet number and driver search', { search: 'б-02 петър' }, ['speeding', 'braking']],
      ['kind label search', { search: 'harsh braking' }, ['braking']],
      [
        'repeated severities',
        { filter: { allOf: [{ severities: ['WARNING'] }, { severities: ['CRITICAL'] }] } },
        [],
      ],
      [
        'exclusions keep informational rows',
        {
          filter: {
            allOf: [{ excludedVehicleIds: [truck] }, { excludedAlertStatuses: ['ACKNOWLEDGED'] }],
          },
        },
        ['speeding', 'braking', 'ignition'],
      ],
      [
        'driver exclusion keeps rows without a driver',
        { filter: { allOf: [{ excludedDriverIds: [driver] }] } },
        ['ignition', 'trouble', 'idling', 'crash'],
      ],
      [
        'alert status order puts informational rows last',
        {
          filter: { allOf: [{ excludedKinds: ['SPEEDING', 'HARSH_BRAKING'] }] },
          sort: { field: 'ALERT_STATUS', direction: 'ASC' },
        },
        ['trouble', 'idling', 'crash', 'ignition'],
      ],
    ];
    for (const [row, variables, keys] of pages) {
      expect({ row, value: await listed(variables) }).toEqual({ row, value: page(keys) });
    }
    expect(
      await query(
        'query{fleetEvents(sort:{field:ALERT_STATUS,direction:DESC},offset:1,limit:2){items{id}total offset limit}}',
        {},
      ),
    ).toEqual({
      data: {
        fleetEvents: {
          items: [{ id: event('idling') }, { id: event('speeding') }],
          total: 6,
          offset: 1,
          limit: 2,
        },
      },
    });
    expect(
      await query(
        'query($id:ID!){fleetEvent(id:$id){vehicle{licensePlate} driver{lastName} tripId measurementUnit measuredValue alertStatus}}',
        { id: event('speeding') },
      ),
    ).toEqual({
      data: {
        fleetEvent: {
          vehicle: { licensePlate: 'CB 1028 AX' },
          driver: { lastName: 'Петров' },
          tripId,
          measurementUnit: 'KPH',
          measuredValue: 128,
          alertStatus: 'OPEN',
        },
      },
    });

    // Alert counts equal the list totals per status for the same search and filter.
    const counts =
      'query($search:String,$filter:FleetEventFilter){fleetAlertCounts(search:$search,filter:$filter){open openCritical acknowledged resolved}}';
    async function totals(search: string | null, filter: Record<string, unknown>) {
      const result: Record<string, number> = {};
      for (const [key, status] of [
        ['open', 'OPEN'],
        ['acknowledged', 'ACKNOWLEDGED'],
        ['resolved', 'RESOLVED'],
      ] as const) {
        const body = await query(list, {
          search,
          filter: { ...filter, actionable: null, alertStatuses: [status] },
        });
        const total = /"total":(\d+)/.exec(JSON.stringify(body))?.[1];
        result[key] = Number(total);
      }
      return result;
    }
    expect(await query(counts, {})).toEqual({
      data: { fleetAlertCounts: { open: 2, openCritical: 1, acknowledged: 1, resolved: 1 } },
    });
    for (const [search, filter] of [
      [null, {}],
      ['CB 1004', {}],
      ['петров', {}],
      [null, { vehicleIds: [van] }],
      [null, { severities: ['CRITICAL'], actionable: false, alertStatuses: ['RESOLVED'] }],
    ] satisfies [string | null, Record<string, unknown>][]) {
      expect({ search, filter, value: await query(counts, { search, filter }) }).toMatchObject({
        search,
        filter,
        value: { data: { fleetAlertCounts: await totals(search, filter) } },
      });
    }
    expect(await query(counts, { search: 'CB 1004' })).toEqual({
      data: { fleetAlertCounts: { open: 1, openCritical: 1, acknowledged: 0, resolved: 1 } },
    });
    expect(
      await query(counts, {
        filter: {
          allOf: [
            { excludedAlertStatuses: ['RESOLVED'] },
            { actionable: false, alertStatuses: ['OPEN'] },
            { vehicleIds: [truck] },
          ],
        },
      }),
    ).toEqual({
      data: { fleetAlertCounts: { open: 1, openCritical: 1, acknowledged: 0, resolved: 1 } },
    });
    expect(await query(counts, {}, randomUUID())).toEqual({
      data: { fleetAlertCounts: { open: 0, openCritical: 0, acknowledged: 0, resolved: 0 } },
    });

    // Maneuver counts per kind and intensity for a trip, zero rows included.
    const maneuvers = await query(
      'query($filter:FleetEventFilter!){fleetManeuverCounts(filter:$filter){kind intensity1 intensity2 intensity3 intensityUnknown total}}',
      { filter: { tripIds: [tripId] } },
    );
    expect(maneuvers).toMatchObject({
      data: {
        fleetManeuverCounts: expect.arrayContaining([
          {
            kind: 'HARSH_BRAKING',
            intensity1: 0,
            intensity2: 1,
            intensity3: 0,
            intensityUnknown: 0,
            total: 1,
          },
        ]),
      },
    });
    expect(JSON.stringify(maneuvers).match(/"kind"/g)).toHaveLength(9);
  });

  const transition = (name: string) =>
    `mutation($id:ID!,$input:FleetAlertTransitionInput!){${name}(id:$id,input:$input){id alertStatus acknowledgedAt resolvedAt remark}}`;

  it('persists transitions with optimistic concurrency', async () => {
    const id = event('speeding');
    expect(
      await query(transition('acknowledgeFleetAlert'), {
        id,
        input: { expectedStatus: 'OPEN', remark: ' Разговор с водача ' },
      }),
    ).toEqual({
      data: {
        acknowledgeFleetAlert: {
          id,
          alertStatus: 'ACKNOWLEDGED',
          acknowledgedAt: now.toISOString(),
          resolvedAt: null,
          remark: 'Разговор с водача',
        },
      },
    });
    expect(
      await query(transition('acknowledgeFleetAlert'), { id, input: { expectedStatus: 'OPEN' } }),
    ).toMatchObject({
      errors: [
        {
          message: 'The alert changed after it was loaded; reload it.',
          extensions: { code: 'CONFLICT' },
        },
      ],
    });
    expect(
      await query(transition('resolveFleetAlert'), {
        id,
        input: { expectedStatus: 'ACKNOWLEDGED' },
      }),
    ).toMatchObject({
      data: {
        resolveFleetAlert: {
          alertStatus: 'RESOLVED',
          acknowledgedAt: now.toISOString(),
          resolvedAt: now.toISOString(),
          remark: 'Разговор с водача',
        },
      },
    });
    expect(
      await query(transition('reopenFleetAlert'), {
        id,
        input: { expectedStatus: 'RESOLVED', remark: null },
      }),
    ).toMatchObject({
      data: {
        reopenFleetAlert: {
          alertStatus: 'OPEN',
          acknowledgedAt: null,
          resolvedAt: null,
          remark: null,
        },
      },
    });
    expect(await database.client.fleetEvent.findUniqueOrThrow({ where: { id } })).toMatchObject({
      alertStatus: 'OPEN',
      acknowledgedAt: null,
      resolvedAt: null,
      remark: null,
    });

    // Informational and foreign events are missing alerts.
    for (const [row, missing, scope] of [
      ['informational event', event('ignition'), branchId],
      ['alert of another Tenant', foreignAlert, branchId],
      ['alert from another Branch', event('idling'), otherBranchId],
    ] as const) {
      expect({
        row,
        value: await query(
          transition('resolveFleetAlert'),
          { id: missing, input: { expectedStatus: 'OPEN' } },
          scope,
        ),
      }).toMatchObject({
        row,
        value: { errors: [{ message: 'Alert not found', extensions: { code: 'NOT_FOUND' } }] },
      });
    }
    expect(
      await database.client.fleetEvent.findUniqueOrThrow({ where: { id: event('idling') } }),
    ).toMatchObject({ alertStatus: 'ACKNOWLEDGED' });

    // A batch settles each ID independently.
    const added = randomUUID();
    await database.client.fleetEvent.create({
      data: {
        id: added,
        tenantId,
        branchId,
        vehicleId: van,
        source: 'DEMO',
        occurredAt: now,
        kind: 'LOW_FUEL',
        severity: 'WARNING',
        alertStatus: 'OPEN',
      },
    });
    expect(
      await query(
        'mutation($ids:[ID!]!,$input:FleetAlertTransitionInput!){acknowledgeFleetAlerts(ids:$ids,input:$input){succeededIds failures{id code message}}}',
        {
          ids: [added, event('idling'), foreignAlert, event('ignition')],
          input: { expectedStatus: 'OPEN' },
        },
      ),
    ).toEqual({
      data: {
        acknowledgeFleetAlerts: {
          succeededIds: [added],
          failures: [
            {
              id: event('idling'),
              code: 'CONFLICT',
              message: 'The alert changed after it was loaded; reload it.',
            },
            { id: foreignAlert, code: 'NOT_FOUND', message: 'Alert not found' },
            { id: event('ignition'), code: 'NOT_FOUND', message: 'Alert not found' },
          ],
        },
      },
    });
    expect(
      await database.client.fleetEvent.findUniqueOrThrow({ where: { id: foreignAlert } }),
    ).toMatchObject({ alertStatus: 'OPEN' });
  });
});
