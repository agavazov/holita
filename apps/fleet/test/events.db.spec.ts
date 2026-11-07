import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { issueDemoToken } from '../src/auth/demo-auth.js';
import { FleetClock } from '../src/clock/fleet-clock.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { CoreClient } from '../src/integrations/core/core.client.js';
import {
  ErmDashboardClient,
  type ErmProblemEvidence,
} from '../src/integrations/erm/erm-dashboard.client.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import type { RequestContext } from '../src/graphql/request-context.js';
import { NotificationsService } from '../src/modules/notifications/notifications.service.js';
import { NotificationSourcesRepository } from '../src/modules/notifications/notification-sources.repository.js';
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
  const ermEvidence: ErmProblemEvidence[] = [];
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
      .overrideProvider(ErmDashboardClient)
      .useValue({
        telemetry: (imeis: readonly string[]) =>
          Promise.resolve({
            asOf: now,
            units: imeis.map((imei) => ({
              imei,
              connected: true,
              reporting: false,
              lastFrameAt: hours(-2),
              expectedIntervalSeconds: 300,
            })),
          }),
        problems: (
          scope: { tenantId: string; branchId: string },
          imeis: readonly string[],
          period: { from: Date; to: Date },
          page: { offset: number; limit: number },
        ) => {
          const rows =
            scope.tenantId === tenantId && scope.branchId === branchId
              ? ermEvidence.filter(
                  (row) =>
                    imeis.includes(row.imei) &&
                    row.occurredAt >= period.from &&
                    row.occurredAt < period.to,
                )
              : [];
          return Promise.resolve({
            asOf: now,
            totalCount: rows.length,
            hasMore: page.offset + page.limit < rows.length,
            items: rows.slice(page.offset, page.offset + page.limit),
            counts: [],
          });
        },
      })
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

    // The combined feed exhausts Fleet and ERM pages, deduplicates imported evidence and keeps
    // unresolved alerts independent of the evidence period. Only real alerts carry actions.
    const device = await database.client.device.create({
      data: { tenantId, branchId, vehicleId: van, imei: '862129080254620' },
    });
    await database.client.fleetEvent.createMany({
      data: Array.from({ length: 101 }, (): Prisma.FleetEventCreateManyInput => ({
        tenantId,
        branchId,
        vehicleId: van,
        source: 'DEMO',
        occurredAt: hours(-100),
        kind: 'LOW_FUEL',
        severity: 'WARNING',
        alertStatus: 'OPEN',
      })),
    });
    const imported = await database.client.fleetEvent.create({
      data: {
        tenantId,
        branchId,
        vehicleId: van,
        deviceImei: device.imei,
        source: 'ERM',
        occurredAt: hours(-0.25),
        kind: 'CAN_ERROR',
        severity: 'WARNING',
        details: 'eData 411 reported the CAN error flag.',
      },
    });
    ermEvidence.push({
      sourceKind: 'DIAGNOSTIC',
      sourceId: '901',
      imei: device.imei,
      deviceId: null,
      severity: 'WARNING',
      occurredAt: hours(-0.25),
      state: 'RECORDED',
      code: 'EDATA_411',
      details: 'CAN error flag recorded',
      eventTime: hours(-0.25),
      eventId: null,
      diagnostics: [{ kind: 'CAN_ERROR', troubleCode: null, status: null }],
    });
    for (let index = 0; index < 501; index++) {
      ermEvidence.push({
        sourceKind: 'ALARM',
        sourceId: String(1000 + index),
        imei: device.imei,
        deviceId: null,
        severity: 'WARNING',
        occurredAt: hours(-1),
        state: 'RECORDED',
        code: 'ALARM',
        details: null,
        eventTime: hours(-1),
        eventId: '10',
        diagnostics: [],
      });
    }
    const commandId = randomUUID();
    ermEvidence.push({
      sourceKind: 'COMMAND',
      sourceId: commandId,
      imei: device.imei,
      deviceId: device.id,
      severity: 'WARNING',
      occurredAt: hours(-1),
      state: 'UNCERTAIN',
      code: 'TIMEOUT',
      details: null,
      eventTime: null,
      eventId: null,
      diagnostics: [],
    });
    const problems = `query($filter:FleetProblemFilter,$offset:Int!){
      fleetProblems(filter:$filter,offset:$offset,limit:1){
        total offset limit items{sourceKind sourceId state requiringAttention alertId fleetEventId ermEventId commandRequestId deviceId}
        counts{total requiringAttention recorded bySource{sourceKind total requiringAttention recorded}}
      }
    }`;
    expect(await query(problems, { offset: 0 })).toMatchObject({
      data: {
        fleetProblems: {
          total: 608,
          counts: {
            total: 608,
            requiringAttention: 106,
            recorded: 502,
            bySource: [
              { sourceKind: 'FLEET_ALERT', total: 104, requiringAttention: 104, recorded: 0 },
              { sourceKind: 'DIAGNOSTIC', total: 1, requiringAttention: 0, recorded: 1 },
              { sourceKind: 'ALARM', total: 501, requiringAttention: 0, recorded: 501 },
              { sourceKind: 'REPORTING_GAP', total: 1, requiringAttention: 1, recorded: 0 },
              { sourceKind: 'COMMAND', total: 1, requiringAttention: 1, recorded: 0 },
            ],
          },
        },
      },
    });
    expect(
      await query(problems, { offset: 0, filter: { sourceKinds: ['DIAGNOSTIC'] } }),
    ).toMatchObject({
      data: {
        fleetProblems: {
          total: 1,
          items: [
            {
              sourceKind: 'DIAGNOSTIC',
              sourceId: '901',
              state: 'RECORDED',
              requiringAttention: false,
              alertId: null,
              fleetEventId: imported.id,
              ermEventId: '901',
              commandRequestId: null,
              deviceId: device.id,
            },
          ],
        },
      },
    });
    expect(
      await query(problems, { offset: 500, filter: { sourceKinds: ['ALARM'] } }),
    ).toMatchObject({
      data: { fleetProblems: { total: 501, offset: 500, items: [{ sourceKind: 'ALARM' }] } },
    });
    expect(
      await query(problems, { offset: 0, filter: { sourceKinds: ['COMMAND'] } }),
    ).toMatchObject({
      data: {
        fleetProblems: {
          total: 1,
          items: [
            {
              state: 'UNCERTAIN',
              requiringAttention: true,
              alertId: null,
              commandRequestId: commandId,
            },
          ],
        },
      },
    });
    expect(await query(problems, { offset: 0 }, otherBranchId)).toMatchObject({
      data: { fleetProblems: { total: 1, counts: { total: 1, recorded: 0 } } },
    });
    expect(
      await query(problems, { offset: 0, filter: { deviceIds: [device.id] } }, otherBranchId),
    ).toMatchObject({ data: { fleetProblems: { total: 0, items: [] } } });

    const reports: {
      report: number;
      sourceId: string;
      at: Date;
      raw?: boolean;
      diagnostics: ErmProblemEvidence['diagnostics'];
    }[] = [
      { report: 417, sourceId: '902', at: hours(-0.2), diagnostics: [] },
      {
        report: 413,
        sourceId: '903',
        at: hours(-0.15),
        diagnostics: [
          { kind: 'DIAGNOSTIC_TROUBLE_CODE', troubleCode: 'P0100', status: 'ADDED' },
          { kind: 'DIAGNOSTIC_TROUBLE_CODE', troubleCode: 'P0200', status: 'DELETED' },
        ],
      },
      {
        report: 418,
        sourceId: '904',
        at: hours(-0.1),
        diagnostics: [
          { kind: 'DIAGNOSTIC_TROUBLE_CODE', troubleCode: 'C1234', status: 'ADDED' },
          { kind: 'DIAGNOSTIC_TROUBLE_CODE', troubleCode: 'P1234', status: 'DELETED' },
        ],
      },
      {
        report: 419,
        sourceId: '905',
        at: hours(-0.05),
        diagnostics: [
          {
            kind: 'DIAGNOSTIC_TROUBLE_CODE',
            troubleCode: 'SPN 4294967295 FMI 31',
            status: 'ADDED',
          },
          { kind: 'DIAGNOSTIC_TROUBLE_CODE', troubleCode: 'SPN 1247 FMI 11', status: 'DELETED' },
          { kind: 'DIAGNOSTIC_TROUBLE_CODE', troubleCode: 'SPN 4339 FMI 7', status: 'ADDED' },
          {
            kind: 'DIAGNOSTIC_TROUBLE_CODE',
            troubleCode: 'SPN 4294967295 FMI 31',
            status: 'ADDED',
          },
        ],
      },
      {
        report: 419,
        sourceId: '906',
        at: hours(-0.025),
        raw: false,
        diagnostics: [
          {
            kind: 'DIAGNOSTIC_TROUBLE_CODE',
            troubleCode: 'SPN 4294967295 FMI 31',
            status: 'DELETED',
          },
          { kind: 'DIAGNOSTIC_TROUBLE_CODE', troubleCode: 'SPN 4339 FMI 7', status: 'DELETED' },
        ],
      },
      { report: 417, sourceId: '907', at: hours(-0.075), diagnostics: [] },
    ];
    const expectedReports: Record<string, unknown>[] = [];
    const expectedFallback: Record<string, unknown>[] = [];
    for (const report of reports) {
      const diagnostics =
        report.report === 417
          ? [{ kind: 'CAN_DISCONNECTED' as const, troubleCode: null, status: null }]
          : report.diagnostics;
      const storedIds: string[] = [];
      for (const [index, diagnostic] of diagnostics.entries()) {
        const faultCode = /^SPN (\d+) FMI (\d+)$/.exec(diagnostic.troubleCode ?? '');
        const stored = await database.client.fleetEvent.create({
          data: {
            tenantId,
            branchId,
            vehicleId: van,
            deviceImei: device.imei,
            source: 'ERM',
            sourceEventId: BigInt(report.sourceId),
            receivedAt: asOf,
            occurredAt: report.at,
            kind: diagnostic.kind,
            troubleCode: diagnostic.troubleCode,
            severity: diagnostic.status === 'DELETED' ? 'INFO' : 'WARNING',
            diagnosticReport: report.report,
            diagnosticStatus:
              diagnostic.status === 'ADDED' ? 1 : diagnostic.status === 'DELETED' ? 2 : null,
            diagnosticSpn: faultCode ? BigInt(Number(faultCode[1])) : null,
            diagnosticFmi: faultCode ? Number(faultCode[2]) : null,
            diagnosticIndex: index,
          },
        });
        storedIds.push(stored.id);
      }
      if (report.raw !== false) {
        ermEvidence.push({
          sourceKind: 'DIAGNOSTIC',
          sourceId: report.sourceId,
          imei: device.imei,
          deviceId: null,
          severity: 'WARNING',
          occurredAt: report.at,
          state: 'RECORDED',
          code: report.report === 417 ? 'CAN_DISCONNECTED' : `EDATA_${String(report.report)}`,
          details: null,
          eventTime: report.at,
          eventId: '33',
          diagnostics: report.diagnostics,
        });
      }
      const expectedDiagnostics = diagnostics.map((diagnostic) => {
        const faultCode = /^SPN (\d+) FMI (\d+)$/.exec(diagnostic.troubleCode ?? '');
        const repeatedFault =
          diagnostic.troubleCode === 'SPN 4294967295 FMI 31' ||
          diagnostic.troubleCode === 'SPN 4339 FMI 7';
        return {
          ...diagnostic,
          report: report.report,
          spn: faultCode ? Number(faultCode[1]) : null,
          fmi: faultCode ? Number(faultCode[2]) : null,
          systemKey:
            diagnostic.troubleCode === 'SPN 4339 FMI 7'
              ? 'AFTERTREATMENT'
              : diagnostic.troubleCode === 'SPN 1247 FMI 11'
                ? 'ENGINE'
                : 'OTHER',
          descriptionKey:
            diagnostic.troubleCode === 'SPN 4339 FMI 7'
              ? 'faults.spn.scrFeedbackControl'
              : diagnostic.troubleCode === 'SPN 1247 FMI 11'
                ? 'faults.spn.enginePower'
                : null,
          catalogVersion: '2026-11-08.1',
          firstObservedAt:
            report.report === 417
              ? hours(-0.2).toISOString()
              : repeatedFault
                ? hours(-0.05).toISOString()
                : report.at.toISOString(),
          lastObservedAt:
            report.report === 417
              ? hours(-0.075).toISOString()
              : repeatedFault
                ? hours(-0.025).toISOString()
                : report.at.toISOString(),
          occurredAt: report.at.toISOString(),
          receivedAt: asOf.toISOString(),
        };
      });
      const expected = {
        sourceKind: 'DIAGNOSTIC',
        state: 'RECORDED',
        requiringAttention: false,
        alertId: null,
        ermEventId: report.sourceId,
        diagnostics: expectedDiagnostics,
      };
      expectedReports.unshift({
        ...expected,
        sourceId: report.raw === false ? `fleet:${String(storedIds[0])}` : report.sourceId,
      });
      expectedFallback.unshift({ ...expected, sourceId: `fleet:${String(storedIds[0])}` });
    }
    // Matching codes outside this Tenant/Branch never widen the observation bounds.
    for (const [scopeTenant, scopeBranch] of [
      [tenantId, otherBranchId],
      [randomUUID(), branchId],
    ] as const) {
      const vehicle = await database.client.vehicle.create({
        data: { tenantId: scopeTenant, branchId: scopeBranch, licensePlate: 'CB 1006 AX' },
      });
      await database.client.fleetEvent.create({
        data: {
          tenantId: scopeTenant,
          branchId: scopeBranch,
          vehicleId: vehicle.id,
          deviceImei: device.imei,
          source: 'ERM',
          sourceEventId: 908n,
          occurredAt: hours(-0.3),
          kind: 'DIAGNOSTIC_TROUBLE_CODE',
          severity: 'WARNING',
          diagnosticReport: 419,
          diagnosticSpn: 4339n,
          diagnosticFmi: 7,
          troubleCode: 'SPN 4339 FMI 7',
        },
      });
    }
    const diagnosticProblems = `query($from:DateTime,$to:DateTime) {
      fleetProblems(filter:{sourceKinds:[DIAGNOSTIC],occurredFrom:$from,occurredTo:$to},limit:100){
        total items{sourceKind sourceId state requiringAttention alertId ermEventId
          diagnostics{kind troubleCode status report spn fmi systemKey descriptionKey catalogVersion
            firstObservedAt lastObservedAt occurredAt receivedAt}}
      }
    }`;
    const canError = {
      sourceId: '901',
      diagnostics: [
        expect.objectContaining({
          kind: 'CAN_ERROR',
          troubleCode: null,
          status: null,
          report: 411,
          systemKey: 'OTHER',
          descriptionKey: null,
          catalogVersion: '2026-11-08.1',
          firstObservedAt: hours(-0.25).toISOString(),
          lastObservedAt: hours(-0.25).toISOString(),
        }),
      ],
    };
    expect(await query(diagnosticProblems, {})).toMatchObject({
      data: {
        fleetProblems: {
          total: 7,
          items: expect.arrayContaining(
            [...expectedReports, canError].map((row) => expect.objectContaining(row)),
          ),
        },
      },
    });
    expect(await query(diagnosticProblems, {}, otherBranchId)).toMatchObject({
      data: {
        fleetProblems: {
          total: 1,
          items: [
            {
              diagnostics: [
                {
                  spn: 4339,
                  systemKey: 'AFTERTREATMENT',
                  firstObservedAt: hours(-0.3).toISOString(),
                  lastObservedAt: hours(-0.3).toISOString(),
                },
              ],
            },
          ],
        },
      },
    });
    // The bounds describe only the requested evidence period, including when status changes.
    expect(
      await query(diagnosticProblems, {
        from: hours(-0.04).toISOString(),
        to: hours(0).toISOString(),
      }),
    ).toMatchObject({
      data: {
        fleetProblems: {
          total: 1,
          items: [
            {
              diagnostics: [
                {
                  spn: 4294967295,
                  status: 'DELETED',
                  firstObservedAt: hours(-0.025).toISOString(),
                  lastObservedAt: hours(-0.025).toISOString(),
                },
                {
                  spn: 4339,
                  status: 'DELETED',
                  firstObservedAt: hours(-0.025).toISOString(),
                  lastObservedAt: hours(-0.025).toISOString(),
                },
              ],
            },
          ],
        },
      },
    });
    // The imported report keeps every fault and its receipt time when raw ERM history is absent.
    for (const report of reports) {
      const index = ermEvidence.findIndex((row) => row.sourceId === report.sourceId);
      if (index >= 0) {
        ermEvidence.splice(index, 1);
      }
    }
    expect(await query(diagnosticProblems, {})).toMatchObject({
      data: {
        fleetProblems: {
          total: 7,
          items: expect.arrayContaining(
            [...expectedFallback, canError].map((row) => expect.objectContaining(row)),
          ),
        },
      },
    });
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
    const projectedTransitions = ['ACKNOWLEDGED', 'RESOLVED', 'REOPENED'];
    const projected = await database.client.fleetNotification.findMany({
      where: {
        tenantId,
        branchId,
        alertId: id,
        sourceKind: 'FLEET_ALERT',
        sourceKey: {
          in: projectedTransitions.map((value) => `${id}:${value}:${now.toISOString()}`),
        },
      },
    });
    expect(projected).toHaveLength(3);
    for (const value of projectedTransitions) {
      expect(projected).toContainEqual(
        expect.objectContaining({
          tenantId,
          branchId,
          sourceKind: 'FLEET_ALERT',
          sourceKey: `${id}:${value}:${now.toISOString()}`,
          alertId: id,
          vehicleId: van,
          occurredAt: now,
          wordingKey: 'fleet.alert.transition',
          parameters: {
            eventKind: 'SPEEDING',
            alertStatus: value === 'REOPENED' ? 'OPEN' : value,
            transition: value,
            troubleCode: null,
          },
        }),
      );
    }

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

    // Notification receipts belong to one verified user and the complete Tenant/Branch scope.
    const feedBranch = randomUUID();
    const feedUser = randomUUID();
    const anotherUser = randomUUID();
    const feedScope = { tenantId, branchId: feedBranch };
    const notificationData: Prisma.FleetNotificationCreateManyInput = {
      ...feedScope,
      sourceKind: 'FLEET_ALERT',
      sourceKey: `alert:${id}:OPEN`,
      category: 'ALERT',
      severity: 'WARNING',
      occurredAt: hours(-1),
      createdAt: now,
      wordingKey: 'fleet.alert.transition',
      parameters: { eventKind: 'SPEEDING', alertStatus: 'OPEN', transition: 'OPEN' },
      vehicleId: van,
      alertId: id,
    };
    const first = await database.client.fleetNotification.create({ data: notificationData });
    const second = await database.client.fleetNotification.create({
      data: {
        ...notificationData,
        sourceKind: 'COMMAND',
        sourceKey: 'command:notification-fixture:ACKNOWLEDGED',
        category: 'COMMAND',
        occurredAt: now,
        wordingKey: 'notification.commandOutcome',
        parameters: { commandKind: 'READ_STATUS', commandStatus: 'ACKNOWLEDGED' },
        alertId: null,
        commandRequestId: randomUUID(),
      },
    });
    const foreignNotifications: string[] = [];
    for (const foreignScope of [
      { tenantId: randomUUID(), branchId: feedBranch },
      { tenantId, branchId: randomUUID() },
    ]) {
      const foreign = await database.client.fleetNotification.create({
        data: { ...notificationData, ...foreignScope },
      });
      foreignNotifications.push(foreign.id);
    }
    expect(
      await database.client.fleetNotification.createMany({
        data: notificationData,
        skipDuplicates: true,
      }),
    ).toEqual({ count: 0 });

    const notificationQuery = `query($filter:FleetNotificationFilter){
      notifications(limit:1,filter:$filter){
        total unreadCount offset limit items{id occurredAt createdAt readAt category}
      }
    }`;
    expect(await query(notificationQuery, {}, feedBranch)).toEqual({
      data: {
        notifications: {
          total: 2,
          unreadCount: 2,
          offset: 0,
          limit: 1,
          items: [
            {
              id: second.id,
              occurredAt: now.toISOString(),
              createdAt: now.toISOString(),
              readAt: null,
              category: 'COMMAND',
            },
          ],
        },
      },
    });
    expect(
      await query(notificationQuery, { filter: { categories: ['ALERT'] } }, feedBranch),
    ).toMatchObject({
      data: { notifications: { total: 1, unreadCount: 2, items: [{ id: first.id }] } },
    });
    for (const mutation of [
      'mutation($id:ID!){markNotificationRead(id:$id){id}}',
      'mutation{markAllNotificationsRead}',
    ]) {
      expect(await query(mutation, { id: first.id }, feedBranch)).toMatchObject({
        errors: [
          {
            message: 'Sign in with a user account to mark notifications as read.',
            extensions: { code: 'BAD_USER_INPUT' },
          },
        ],
      });
    }
    if (!app) {
      throw new Error('Missing test application');
    }
    const notifications = app.get(NotificationsService);
    const userContext: RequestContext = {
      ...feedScope,
      userId: feedUser,
      sessionId: randomUUID(),
      requestId: randomUUID(),
      authorization: undefined,
      branchChecks: new Map(),
    };
    const unreadArgs = { offset: 0, limit: 100, filter: { readState: 'UNREAD' } } as const;
    for (const notificationId of foreignNotifications) {
      await expect(notifications.markRead(userContext, notificationId)).rejects.toThrow(
        'Notification not found',
      );
    }
    for (let repeat = 0; repeat < 2; repeat++) {
      expect(await notifications.markRead(userContext, first.id)).toMatchObject({
        id: first.id,
        readAt: now,
      });
    }
    expect(await notifications.list(userContext, unreadArgs)).toMatchObject({
      total: 1,
      unreadCount: 1,
      items: [{ id: second.id }],
    });
    expect(
      await notifications.list({ ...userContext, userId: anotherUser }, unreadArgs),
    ).toMatchObject({ total: 2, unreadCount: 2 });
    expect(await notifications.markAllRead(userContext)).toBe(1);
    expect(await notifications.markAllRead(userContext)).toBe(0);
    expect(await notifications.list(userContext, unreadArgs)).toMatchObject({
      total: 0,
      unreadCount: 0,
      items: [],
    });
    expect(await database.client.fleetNotificationReceipt.findMany()).toEqual(
      expect.arrayContaining([
        { ...feedScope, notificationId: first.id, userId: feedUser, readAt: now },
        { ...feedScope, notificationId: second.id, userId: feedUser, readAt: now },
      ]),
    );
    expect(
      await database.client.fleetNotificationReceipt.count({
        where: { notificationId: { in: foreignNotifications } },
      }),
    ).toBe(0);
    expect(
      await database.client.fleetNotificationReceipt.count({
        where: { ...feedScope, userId: feedUser },
      }),
    ).toBe(2);

    // Cleanup uses feed creation time and the Branch preference, never historical occurrence.
    await database.client.fleetSettings.create({
      data: { ...feedScope, notificationRetentionDays: 1 },
    });
    await database.client.fleetNotification.update({
      where: { id: first.id, ...feedScope },
      data: { createdAt: new Date(now.getTime() - 2 * 86_400_000) },
    });
    await database.client.fleetNotification.update({
      where: { id: second.id, ...feedScope },
      data: { occurredAt: new Date(now.getTime() - 30 * 86_400_000) },
    });
    expect(await app.get(NotificationSourcesRepository).cleanup(now)).toBe(1);
    expect(
      await database.client.fleetNotification.findMany({ where: feedScope, select: { id: true } }),
    ).toEqual([{ id: second.id }]);
    expect(await database.client.fleetNotificationReceipt.findMany({ where: feedScope })).toEqual([
      { ...feedScope, notificationId: second.id, userId: feedUser, readAt: now },
    ]);
    expect(await database.client.fleetEvent.findUniqueOrThrow({ where: { id } })).toMatchObject({
      id,
      alertStatus: 'OPEN',
    });

    // Initial projection starts inside the default retention window and deduplicates reruns.
    const initialScope = { tenantId, branchId: randomUUID() };
    const initialVehicle = await database.client.vehicle.create({
      data: { ...initialScope, licensePlate: 'CB NF0' },
    });
    const initialEvents: string[] = [];
    for (const ageDays of [8, 1]) {
      const initialEvent = await database.client.fleetEvent.create({
        data: {
          ...initialScope,
          vehicleId: initialVehicle.id,
          source: 'DEMO',
          occurredAt: new Date(now.getTime() - ageDays * 86_400_000),
          kind: 'LOW_FUEL',
          severity: 'WARNING',
          alertStatus: 'OPEN',
        },
      });
      initialEvents.push(initialEvent.id);
    }
    for (let repeat = 0; repeat < 2; repeat++) {
      await app.get(NotificationSourcesRepository).projectAlerts(now);
      expect(
        await database.client.fleetNotification.findMany({
          where: initialScope,
          select: { alertId: true },
        }),
      ).toEqual([{ alertId: initialEvents[1] }]);
    }
    expect(await database.client.fleetEvent.count({ where: initialScope })).toBe(2);
  });
});
