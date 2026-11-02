import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../app.module.js';
import { KarmaTransport } from '../integrations/karma/karma-transport.js';
import { issueDemoToken } from '../auth/demo-auth.js';

describe('karma-client GraphQL session boundary', () => {
  let app: INestApplication;
  let baseUrl: string;
  const transport = {
    read: jest.fn<KarmaTransport['read']>(),
    readCar: jest.fn<KarmaTransport['readCar']>(),
    readVersion: jest.fn<KarmaTransport['readVersion']>(),
    readReportTrips: jest.fn<KarmaTransport['readReportTrips']>(),
    readPositionEvents: jest.fn<KarmaTransport['readPositionEvents']>(),
    readDiagnosticEvents: jest.fn<KarmaTransport['readDiagnosticEvents']>(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(KarmaTransport)
      .useValue(transport)
      .compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  async function query(source: string, authorization?: string) {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
      body: JSON.stringify({ query: source }),
    });
    const body: unknown = await response.json();
    return body;
  }

  it('every Karma query requires a verified signed session before any upstream call and is shared by all signed tenants without Branch', async () => {
    const tenantA = '01000000-0000-4000-8000-000000000001';
    const tenantB = '01000000-0000-4000-8000-000000000002';
    const forged = issueDemoToken(tenantA).replace(tenantA, tenantB);
    for (const source of [
      '{karmaCars{id}}',
      '{karmaCar(id:"41"){id}}',
      '{karmaUsers{id}}',
      '{karmaRoles{id}}',
      '{karmaEdata(input:{carId:"41"}){hasMore}}',
      '{karmaTrips(input:{carId:"41"}){hasMore}}',
      '{karmaDailyReport(input:{carId:"41",day:"2026-01-15"}){state}}',
      '{karmaEvents(input:{carId:"41"}){hasMore}}',
      '{karmaDiagnosticHistory(input:{carId:"41"}){retrieval}}',
      '{karmaPositionSamples(input:{carId:"41",startMessageId:"100",stopMessageId:"102"}){retrieval}}',
      '{karmaDrivingProfile(input:{carId:"41",fromDate:"2026-01-01T00:00:00",toDate:"2026-01-08T00:00:00"}){carId}}',
      '{karmaLocation(carId:"41"){carId}}',
      '{karmaProjects{id}}',
      '{karmaTimeZones{id}}',
      '{karmaVersion{version}}',
    ]) {
      for (const [label, authorization] of [
        ['no authorization', undefined],
        ['invalid token', 'Bearer invalid'],
        ['forged signature', `Bearer ${forged}`],
      ] satisfies [string, string | undefined][]) {
        const row = `${source} with ${label}`;
        const body = await query(source, authorization);
        const upstreamCalls =
          transport.read.mock.calls.length +
          transport.readCar.mock.calls.length +
          transport.readVersion.mock.calls.length +
          transport.readReportTrips.mock.calls.length +
          transport.readPositionEvents.mock.calls.length +
          transport.readDiagnosticEvents.mock.calls.length;
        expect({ row, value: { body, upstreamCalls } }).toMatchObject({
          row,
          value: {
            body: { errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] },
            upstreamCalls: 0,
          },
        });
      }
    }
    transport.read.mockResolvedValue([
      { car_id: 41, device_id: '000123456789012', project_id: 12, car_number: 'TEST 41' },
    ]);
    for (const tenantId of [tenantA, tenantB]) {
      expect({
        row: tenantId,
        value: await query('{karmaCars{id}}', `Bearer ${issueDemoToken(tenantId)}`),
      }).toEqual({ row: tenantId, value: { data: { karmaCars: [{ id: '41' }] } } });
    }

    const car = {
      car_id: 41,
      device_id: '000123456789012',
      project_id: 12,
      car_number: 'TEST 41',
      time_zone: 8,
    };
    const trip = (id: number, changes: Record<string, unknown> = {}) => ({
      trip_id: id,
      car_id: 41,
      car_number: 'TEST 41',
      device_id: '000123456789012',
      trip_active: 0,
      start_date: '2026-01-15 08:00:00',
      stop_date: '2026-01-15 09:00:00',
      trip_distance: 10,
      trip_distance_night: 2,
      max_speed: 50,
      ...changes,
    });
    const metric = (value: number | null, availability = 'COMPLETE') => ({
      value: value === null ? null : expect.closeTo(value, 10),
      availability,
    });
    const fields = `carId day timeZone{id name} fromLocal toLocalExclusive fromUtc
      toUtcExclusive state retrieval reason selection pageRequests loadedTrips
      maxPages maxRows deadlineMs positionCoverage
      trips{id carId startDate stopDate tripDistance tripDistanceNight maxSpeed}
      ${['tripCount', 'totalDistance', 'nightDistance', 'dayDistance', 'maxSpeed']
        .map((name) => `${name}{value availability availableInputs requiredInputs unit}`)
        .join(' ')}`;
    const report = (day = '2026-01-15') =>
      `{karmaDailyReport(input:{carId:"41",day:${JSON.stringify(day)}}){${fields}}}`;
    const authorization = `Bearer ${issueDemoToken(tenantA)}`;
    const configure = (
      batches: (unknown[] | Error)[],
      zone = 'Europe/Sofia',
      newer: unknown[] = [],
    ) => {
      transport.readCar.mockResolvedValue([car]);
      transport.read.mockImplementation(() => Promise.resolve([{ zone_id: 8, zone_name: zone }]));
      let index = 0;
      transport.readReportTrips.mockReset().mockImplementation((params) => {
        if (params.has('from_id')) {
          return Promise.resolve(newer);
        }
        const batch = batches[index++] ?? [];
        if (!Array.isArray(batch)) {
          return Promise.reject(batch);
        }
        return Promise.resolve(batch);
      });
    };
    const batches = [[trip(200), trip(201)], [trip(100)], []];
    configure(batches);
    const shared = await query(report(), authorization);
    configure(batches);
    expect(await query(report(), `Bearer ${issueDemoToken(tenantB)}`)).toEqual(shared);
    expect(shared).toMatchObject({
      data: {
        karmaDailyReport: {
          carId: '41',
          day: '2026-01-15',
          timeZone: { id: 8, name: 'Europe/Sofia' },
          state: 'COMPLETE',
          retrieval: 'COMPLETE',
          reason: 'NONE',
          pageRequests: 4,
          loadedTrips: 3,
          trips: [
            { id: '200', carId: '41', tripDistance: 10, tripDistanceNight: 2, maxSpeed: 50 },
            { id: '201', carId: '41', tripDistance: 10, tripDistanceNight: 2, maxSpeed: 50 },
            { id: '100', carId: '41', tripDistance: 10, tripDistanceNight: 2, maxSpeed: 50 },
          ],
          maxPages: 4,
          maxRows: 1000,
          deadlineMs: 4000,
          selection: 'STARTED_IN_DAY',
          positionCoverage: 'NOT_ASSESSED',
          fromLocal: '2026-01-15T00:00:00',
          toLocalExclusive: '2026-01-16T00:00:00',
          fromUtc: '2026-01-14T22:00:00.000Z',
          toUtcExclusive: '2026-01-15T22:00:00.000Z',
          tripCount: { ...metric(3), availableInputs: 3, requiredInputs: 3, unit: 'COUNT' },
          totalDistance: { ...metric(30), unit: 'SOURCE_DISTANCE_UNCONFIRMED' },
          nightDistance: metric(6),
          dayDistance: metric(24),
          maxSpeed: { ...metric(50), unit: 'SOURCE_SPEED_UNCONFIRMED' },
        },
      },
    });
    expect(
      transport.readReportTrips.mock.calls.map(([params]) => Object.fromEntries(params)),
    ).toEqual([
      { car: '41', from_date: '2026-01-15 00:00:00', to_date: '2026-01-15 23:59:59' },
      {
        car: '41',
        from_date: '2026-01-15 00:00:00',
        to_date: '2026-01-15 23:59:59',
        from_id: '202',
      },
      { car: '41', from_date: '2026-01-15 00:00:00', to_date: '2026-01-15 23:59:59', to_id: '199' },
      { car: '41', from_date: '2026-01-15 00:00:00', to_date: '2026-01-15 23:59:59', to_id: '99' },
    ]);

    const cases: {
      name: string;
      batches: (unknown[] | Error)[];
      expected: Record<string, unknown>;
      day?: string;
      zone?: string;
      newer?: unknown[];
      requests?: number;
    }[] = [
      {
        name: 'source precision',
        batches: [
          [
            trip(100, {
              trip_distance: 12.3456789,
              trip_distance_night: 0.1234567,
              max_speed: 67.89123,
            }),
            trip(101, { trip_distance: 0.0000001, trip_distance_night: 0, max_speed: 0 }),
          ],
          [],
        ],
        expected: {
          state: 'COMPLETE',
          retrieval: 'COMPLETE',
          pageRequests: 3,
          trips: [
            {
              id: '100',
              tripDistance: 12.3456789,
              tripDistanceNight: 0.1234567,
              maxSpeed: 67.89123,
            },
            { id: '101', tripDistance: 0.0000001, tripDistanceNight: 0, maxSpeed: 0 },
          ],
          tripCount: metric(2),
          totalDistance: metric(12.345679),
          nightDistance: metric(0.1234567),
          dayDistance: metric(12.2222223),
          maxSpeed: metric(67.89123),
        },
      },
      {
        name: 'complete empty',
        batches: [[]],
        requests: 1,
        expected: {
          state: 'EMPTY',
          retrieval: 'COMPLETE',
          loadedTrips: 0,
          trips: [],
          tripCount: metric(0),
          totalDistance: metric(0),
          nightDistance: metric(0),
          dayDistance: metric(0),
          maxSpeed: metric(null, 'UNAVAILABLE'),
        },
      },
      {
        name: 'genuine zero values',
        batches: [
          [
            trip(100, {
              trip_distance: 0,
              trip_distance_night: 0,
              max_speed: 0,
            }),
          ],
          [],
        ],
        expected: {
          state: 'COMPLETE',
          totalDistance: metric(0),
          nightDistance: metric(0),
          dayDistance: metric(0),
          maxSpeed: metric(0),
          trips: [{ id: '100', tripDistance: 0, tripDistanceNight: 0, maxSpeed: 0 }],
        },
      },
      {
        name: 'distance missing on one trip',
        batches: [
          [
            trip(100),
            trip(101, {
              trip_distance: null,
            }),
          ],
          [],
        ],
        expected: {
          state: 'PARTIAL',
          retrieval: 'COMPLETE',
          totalDistance: {
            ...metric(10, 'PARTIAL'),
            availableInputs: 1,
            requiredInputs: 2,
          },
          nightDistance: metric(4),
          dayDistance: metric(null, 'UNAVAILABLE'),
          trips: [
            { id: '100', tripDistance: 10 },
            { id: '101', tripDistance: null },
          ],
        },
      },
      {
        name: 'night input missing',
        batches: [[trip(100, { trip_distance_night: null })], []],
        expected: {
          state: 'PARTIAL',
          totalDistance: metric(10),
          nightDistance: metric(null, 'UNAVAILABLE'),
          dayDistance: metric(null, 'UNAVAILABLE'),
        },
      },
      {
        name: 'speed input missing',
        batches: [[trip(100), trip(101, { max_speed: null })], []],
        expected: {
          state: 'PARTIAL',
          maxSpeed: { ...metric(50, 'PARTIAL'), availableInputs: 1, requiredInputs: 2 },
        },
      },
      {
        name: 'failure before any rows',
        batches: [new DOMException('timeout', 'TimeoutError')],
        requests: 1,
        expected: {
          state: 'UNAVAILABLE',
          retrieval: 'UNAVAILABLE',
          reason: 'UPSTREAM_FAILURE',
          tripCount: metric(null, 'UNAVAILABLE'),
          totalDistance: metric(null, 'UNAVAILABLE'),
          trips: [],
        },
      },
      {
        name: 'failure after loaded rows',
        batches: [[trip(100)], new DOMException('timeout', 'TimeoutError')],
        expected: {
          state: 'PARTIAL',
          retrieval: 'PARTIAL',
          reason: 'UPSTREAM_FAILURE',
          tripCount: metric(1, 'PARTIAL'),
          totalDistance: metric(10, 'PARTIAL'),
          nightDistance: metric(2, 'PARTIAL'),
          dayDistance: metric(8, 'PARTIAL'),
          maxSpeed: metric(50, 'PARTIAL'),
          trips: [{ id: '100', tripDistance: 10, tripDistanceNight: 2, maxSpeed: 50 }],
        },
      },
      ...[{ trip_active: 1 }, { stop_date: null }].map((changes) => ({
        name: `open trip ${JSON.stringify(changes)}`,
        batches: [[trip(100, changes)], []],
        expected: {
          state: 'PARTIAL',
          retrieval: 'COMPLETE',
          reason: 'OPEN_TRIPS',
          tripCount: metric(1),
          totalDistance: metric(10, 'PARTIAL'),
          nightDistance: metric(2, 'PARTIAL'),
          dayDistance: metric(8, 'PARTIAL'),
          maxSpeed: metric(50, 'PARTIAL'),
        },
      })),
      {
        name: 'whole trip belongs to its start day',
        batches: [
          [
            trip(100, {
              start_date: '2026-01-15 23:50:00',
              stop_date: '2026-01-16 01:00:00',
            }),
          ],
          [],
        ],
        expected: {
          state: 'COMPLETE',
          totalDistance: metric(10),
          tripCount: metric(1),
          trips: [{ id: '100', startDate: '2026-01-15 23:50:00', stopDate: '2026-01-16 01:00:00' }],
        },
      },
      ...[{ car_id: 42 }, { start_date: '2026-01-14 23:59:59' }].map((changes) => ({
        name: `incompatible source ${JSON.stringify(changes)}`,
        batches: [[trip(100, changes)]],
        expected: {
          state: 'UNAVAILABLE',
          retrieval: 'UNAVAILABLE',
          reason: 'INCOMPATIBLE_SOURCE',
          loadedTrips: 0,
          trips: [],
          totalDistance: metric(null, 'UNAVAILABLE'),
        },
        requests: 1,
      })),
      {
        name: 'newer source rows prevent a completion claim',
        batches: [[trip(100)]],
        newer: [trip(101)],
        requests: 2,
        expected: {
          state: 'PARTIAL',
          retrieval: 'PARTIAL',
          reason: 'SOURCE_BOUNDARY_NOT_PROVEN',
          loadedTrips: 1,
          pageRequests: 2,
          trips: [{ id: '100' }],
          tripCount: metric(1, 'PARTIAL'),
          totalDistance: metric(10, 'PARTIAL'),
        },
      },
      {
        name: 'source ignores the newer lower bound',
        batches: [[trip(100)]],
        newer: [trip(100)],
        requests: 2,
        expected: {
          state: 'PARTIAL',
          retrieval: 'PARTIAL',
          reason: 'INCOMPATIBLE_SOURCE',
          loadedTrips: 1,
          pageRequests: 2,
          trips: [{ id: '100' }],
          tripCount: metric(1, 'PARTIAL'),
        },
      },
      {
        name: 'bounded page retrieval',
        batches: [400, 300, 200, 100].map((id) => [trip(id)]),
        requests: 4,
        expected: {
          state: 'PARTIAL',
          retrieval: 'PARTIAL',
          reason: 'PAGE_LIMIT',
          loadedTrips: 3,
          pageRequests: 4,
          trips: [{ id: '400' }, { id: '300' }, { id: '200' }],
          tripCount: metric(3, 'PARTIAL'),
        },
      },
      {
        name: 'bounded row retrieval',
        batches: [Array.from({ length: 1001 }, (_, i) => trip(i + 1))],
        requests: 1,
        expected: {
          state: 'PARTIAL',
          retrieval: 'PARTIAL',
          reason: 'ROW_LIMIT',
          loadedTrips: 1000,
          pageRequests: 1,
          trips: Array.from({ length: 1000 }, (_, index) => ({ id: String(index + 2) })),
          tripCount: metric(1000, 'PARTIAL'),
        },
      },
      {
        name: 'exact row budget with explicit completion',
        batches: [Array.from({ length: 1000 }, (_, i) => trip(i + 1)), []],
        expected: {
          state: 'COMPLETE',
          retrieval: 'COMPLETE',
          reason: 'NONE',
          loadedTrips: 1000,
          pageRequests: 3,
          trips: Array.from({ length: 1000 }, (_, index) => ({ id: String(index + 1) })),
          tripCount: metric(1000),
        },
      },
      {
        name: 'unproven source timezone',
        zone: 'UTC+02:00',
        batches: [],
        requests: 0,
        expected: {
          state: 'UNSUPPORTED_PERIOD',
          retrieval: 'NOT_STARTED',
          reason: 'TIME_ZONE_NOT_PROVEN',
          pageRequests: 0,
          trips: [],
        },
      },
      {
        name: 'current source day is open',
        day: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/Sofia',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date()),
        batches: [],
        requests: 0,
        expected: {
          state: 'UNSUPPORTED_PERIOD',
          retrieval: 'NOT_STARTED',
          reason: 'OPEN_DAY',
          pageRequests: 0,
          trips: [],
        },
      },
      {
        name: 'spring DST calendar day',
        day: '2026-03-29',
        batches: [[]],
        requests: 1,
        expected: {
          state: 'EMPTY',
          fromUtc: '2026-03-28T22:00:00.000Z',
          toUtcExclusive: '2026-03-29T21:00:00.000Z',
        },
      },
      {
        name: 'autumn DST calendar day',
        day: '2026-10-25',
        batches: [[]],
        requests: 1,
        expected: {
          state: 'EMPTY',
          fromUtc: '2026-10-24T21:00:00.000Z',
          toUtcExclusive: '2026-10-25T22:00:00.000Z',
        },
      },
    ];
    for (const scenario of cases) {
      configure(scenario.batches, scenario.zone, scenario.newer);
      expect({
        row: scenario.name,
        body: await query(report(scenario.day), authorization),
      }).toMatchObject({
        row: scenario.name,
        body: { data: { karmaDailyReport: scenario.expected } },
      });
      expect(transport.readReportTrips).toHaveBeenCalledTimes(scenario.requests ?? 3);
    }
    for (const day of ['2026-02-29', '2026-1-15']) {
      configure([]);
      expect(await query(report(day), authorization)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
      expect(transport.readReportTrips).not.toHaveBeenCalled();
    }

    const positionEvent = (id: number, changes: Record<string, unknown> = {}) => ({
      message_id: id,
      car_id: 41,
      device_id: '000123456789012',
      eid: 0,
      edt: '2026-01-15 08:00:00',
      edt_tz: '2026-01-15 10:00:00',
      pdt: null,
      latitude: 0,
      longitude: 0,
      spd: 0,
      odo: 0,
      extra: null,
      ...changes,
    });
    const positions = (start = '100', stop = '102') =>
      `{karmaPositionSamples(input:{carId:"41",startMessageId:${JSON.stringify(start)},stopMessageId:${JSON.stringify(stop)}}){
        carId startMessageId stopMessageId retrieval reason sourceClock ordering positionCoverage
        startMessagePresent stopMessagePresent loadedRows maxRows deadlineMs duplicateIdsRemoved
        samples{instantUtc event{id carId edt edtTz pdt latitude longitude spd odo}}
      }}`;
    const positionCases: {
      name: string;
      rows: unknown[] | Error;
      expected: Record<string, unknown>;
      stop?: string;
      carMissing?: boolean;
    }[] = [
      {
        name: 'bounded source window, first duplicate, valid zero and stable UTC order',
        rows: [
          positionEvent(102, { edt: '2026-01-15 08:20:00', longitude: 181 }),
          positionEvent(100),
          positionEvent(101, { edt: '2026-01-15 08:10:00', latitude: null }),
          positionEvent(101, { edt: '2026-01-15 08:11:00', latitude: 1 }),
          positionEvent(99),
          positionEvent(103),
          positionEvent(101, { car_id: 42 }),
        ],
        expected: {
          retrieval: 'COMPLETE',
          reason: 'NONE',
          loadedRows: 3,
          startMessagePresent: true,
          stopMessagePresent: true,
          duplicateIdsRemoved: 1,
          ordering: 'UTC_THEN_MESSAGE_ID',
          samples: [
            {
              instantUtc: '2026-01-15T08:00:00.000Z',
              event: { id: '100', latitude: 0, longitude: 0, spd: 0 },
            },
            { instantUtc: '2026-01-15T08:10:00.000Z', event: { id: '101', latitude: null } },
            { instantUtc: '2026-01-15T08:20:00.000Z', event: { id: '102', longitude: 181 } },
          ],
        },
      },
      {
        name: 'missing boundary is a partial selection',
        rows: [positionEvent(100), positionEvent(101)],
        expected: {
          retrieval: 'PARTIAL',
          reason: 'BOUNDARIES_MISSING',
          loadedRows: 2,
          startMessagePresent: true,
          stopMessagePresent: false,
          samples: [{ event: { id: '100' } }, { event: { id: '101' } }],
        },
      },
      {
        name: 'empty provider batch is not full physical coverage',
        rows: [],
        expected: {
          retrieval: 'PARTIAL',
          reason: 'BOUNDARIES_MISSING',
          loadedRows: 0,
          startMessagePresent: false,
          stopMessagePresent: false,
          samples: [],
        },
      },
      {
        name: 'source time text survives without invented instants or ordering',
        rows: [
          positionEvent(102, { edt: 'not a timestamp', edt_tz: 'unconfirmed local clock' }),
          positionEvent(100),
        ],
        expected: {
          retrieval: 'COMPLETE',
          loadedRows: 2,
          ordering: 'SOURCE_ORDER',
          samples: [
            {
              instantUtc: null,
              event: { id: '102', edt: 'not a timestamp', edtTz: 'unconfirmed local clock' },
            },
            { instantUtc: '2026-01-15T08:00:00.000Z', event: { id: '100' } },
          ],
        },
      },
      {
        name: 'row budget remains partial',
        rows: Array.from({ length: 501 }, (_, index) => positionEvent(100 + index)),
        stop: '600',
        expected: {
          retrieval: 'PARTIAL',
          reason: 'ROW_LIMIT',
          loadedRows: 500,
          startMessagePresent: true,
          stopMessagePresent: false,
        },
      },
      {
        name: 'one failed read does not retry or become empty',
        rows: new DOMException('timeout', 'TimeoutError'),
        expected: {
          retrieval: 'UNAVAILABLE',
          reason: 'UPSTREAM_FAILURE',
          loadedRows: 0,
          samples: [],
        },
      },
      {
        name: 'invalid source remains unavailable',
        rows: ['invalid row'],
        expected: {
          retrieval: 'UNAVAILABLE',
          reason: 'INCOMPATIBLE_SOURCE',
          loadedRows: 0,
          samples: [],
        },
      },
      {
        name: 'missing car prevents the event read',
        rows: [],
        carMissing: true,
        expected: {
          retrieval: 'UNAVAILABLE',
          reason: 'CAR_NOT_FOUND',
          loadedRows: 0,
          samples: [],
        },
      },
    ];
    for (const scenario of positionCases) {
      transport.readCar.mockReset().mockResolvedValue(scenario.carMissing ? [] : [car]);
      const source = scenario.rows;
      transport.readPositionEvents
        .mockReset()
        .mockImplementation(() =>
          Array.isArray(source) ? Promise.resolve(source) : Promise.reject(source),
        );
      expect({
        row: scenario.name,
        body: await query(positions('100', scenario.stop), authorization),
      }).toMatchObject({
        row: scenario.name,
        body: {
          data: {
            karmaPositionSamples: {
              carId: '41',
              startMessageId: '100',
              stopMessageId: scenario.stop ?? '102',
              sourceClock: 'EDT_UTC',
              positionCoverage: 'NOT_ASSESSED',
              maxRows: 500,
              deadlineMs: 4000,
              ...scenario.expected,
            },
          },
        },
      });
      expect(transport.readPositionEvents).toHaveBeenCalledTimes(scenario.carMissing ? 0 : 1);
      if (!scenario.carMissing) {
        const [parameters, signal] = transport.readPositionEvents.mock.calls[0] ?? [];
        expect(parameters ? Object.fromEntries(parameters) : null).toEqual({
          car: '41',
          from_id: '99',
          to_id: String(Number(scenario.stop ?? '102') + 1),
          date_type: 'utc',
          'fields[]': 'pdt',
        });
        expect(signal).toBe(transport.readCar.mock.calls[0]?.[1]);
      }
    }
    for (const [start, stop] of [
      ['0', '102'],
      ['103', '102'],
    ]) {
      transport.readPositionEvents.mockReset();
      expect(await query(positions(start, stop), authorization)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
      expect(transport.readPositionEvents).not.toHaveBeenCalled();
    }

    const realDeviceId = '862129080367299';
    transport.readCar.mockResolvedValue([
      {
        car_id: 16595,
        device_id: realDeviceId,
        project_id: 12,
        car_number: 'CB1147TP',
      },
    ]);
    const diagnosticEvent = (id: number, extra: string, changes: Record<string, unknown> = {}) => ({
      message_id: id,
      car_id: 16595,
      device_id: realDeviceId,
      eid: 33,
      edt: '2026-10-29 12:54:06',
      extra,
      ...changes,
    });
    const diagnosticFields = `carId retrieval reason historyComplete scannedRows hasMore nextCursor
      items{instantUtc family reportCode decoding rawPayload payloadHex acknowledgement
        event{id carId deviceId eventId edt extra}
        faults{code spn fmi statusHex status rawHex}
        communication{communicationMask obdMask canError ignition extensionHex}}`;
    const diagnosticQuery = (extra = '') =>
      `{karmaDiagnosticHistory(input:{carId:"16595"${extra}}){${diagnosticFields}}}`;
    const firstRaw = '19,0,419,0,1,1,1001,21000010F30701000004DF0B01';
    const secondRaw = '19,0,419,0,1,1,1001,2100005CFE0F01';
    const sourceFaults = [
      diagnosticEvent(7177124308, firstRaw, { edt: '2026-10-28 18:54:31' }),
      diagnosticEvent(7179721665, secondRaw),
    ];
    transport.readDiagnosticEvents.mockResolvedValue([
      diagnosticEvent(7177124307, '19,0,154,0'),
      ...sourceFaults,
      diagnosticEvent(7179721666, '19,0,154,1'),
    ]);
    const realFaultResult = await query(
      diagnosticQuery(',fromMessageId:"7177124308",toMessageId:"7179721665"'),
      authorization,
    );
    expect(realFaultResult).toMatchObject({
      data: {
        karmaDiagnosticHistory: {
          retrieval: 'COMPLETE',
          reason: 'NONE',
          historyComplete: false,
          scannedRows: 2,
          items: [
            {
              instantUtc: '2026-10-29T12:54:06.000Z',
              family: 'EDATA_419',
              decoding: 'DECODED',
              rawPayload: secondRaw,
              event: { id: '7179721665', carId: '16595', deviceId: realDeviceId },
              faults: [
                { spn: 23806, fmi: 15, statusHex: '01', status: 'ADDED', rawHex: '00005CFE0F01' },
              ],
            },
            {
              instantUtc: '2026-10-28T18:54:31.000Z',
              rawPayload: firstRaw,
              event: { id: '7177124308' },
              faults: [
                { spn: 4339, fmi: 7, status: 'ADDED' },
                { spn: 1247, fmi: 11, status: 'ADDED' },
              ],
            },
          ],
        },
      },
    });
    expect(
      await query(
        diagnosticQuery(',fromMessageId:"7177124308",toMessageId:"7179721665"'),
        `Bearer ${issueDemoToken(tenantB)}`,
      ),
    ).toEqual(realFaultResult);
    const diagnosticParameters = transport.readDiagnosticEvents.mock.calls.at(-1)?.[0];
    expect(diagnosticParameters?.get('date_type')).toBe('utc');
    expect(diagnosticParameters?.getAll('event_type[]')).toEqual(['2', '33', '70']);
    expect(diagnosticParameters?.get('from_id')).toBe('7177124307');
    expect(diagnosticParameters?.get('to_id')).toBe('7179721666');
    const nextDiagnosticCursor = Buffer.from(
      JSON.stringify({ scope: JSON.stringify(['16595', 25, 100, 129]), before: 104 }),
    ).toString('base64url');
    transport.readDiagnosticEvents.mockReset().mockImplementation((parameters) => {
      const from = Number(parameters.get('from_id'));
      const to = Number(parameters.get('to_id'));
      return Promise.resolve(
        Array.from({ length: to - from + 1 }, (_, index) =>
          diagnosticEvent(from + index, secondRaw),
        ),
      );
    });
    expect(
      await query(
        diagnosticQuery(',pageSize:25,fromMessageId:"100",toMessageId:"129"'),
        authorization,
      ),
    ).toMatchObject({
      data: {
        karmaDiagnosticHistory: {
          hasMore: true,
          nextCursor: nextDiagnosticCursor,
          items: Array.from({ length: 25 }, (_, index) => ({ event: { id: String(129 - index) } })),
        },
      },
    });
    expect(
      await query(
        diagnosticQuery(
          `,pageSize:25,fromMessageId:"100",toMessageId:"129",cursor:${JSON.stringify(nextDiagnosticCursor)}`,
        ),
        authorization,
      ),
    ).toMatchObject({
      data: {
        karmaDiagnosticHistory: {
          hasMore: false,
          nextCursor: null,
          items: Array.from({ length: 5 }, (_, index) => ({ event: { id: String(104 - index) } })),
        },
      },
    });
    const diagnosticCases: {
      name: string;
      rows: unknown[] | Error;
      expected: Record<string, unknown>;
    }[] = [
      {
        name: 'NACK and positive ACK are distinct observations',
        rows: [diagnosticEvent(1, '19,0,154,0'), diagnosticEvent(2, '19,0,154,1')],
        expected: {
          items: [
            { family: 'SPECIAL_ACK', acknowledgement: 'POSITIVE_ACK', faults: [] },
            { family: 'SPECIAL_ACK', acknowledgement: 'NACK', faults: [] },
          ],
        },
      },
      {
        name: 'independent report families retain original bytes and only documented layouts decode',
        rows: [
          diagnosticEvent(1, '1,4', { eid: 2 }),
          diagnosticEvent(2, '2,P0351,C2222', { eid: 70 }),
          diagnosticEvent(3, '19,0,411,0,1,1,1001,01000001010001'),
          diagnosticEvent(4, '19,0,413,0,1,1,1001,19111101622202B33301'),
          diagnosticEvent(5, '19,0,418,0,1,1,1001,20503134383201'),
          diagnosticEvent(6, '19,0,419,0,1,1,1001,21000010F30702'),
          diagnosticEvent(7, '19,0,419,0,1,1,1001,21000010F3'),
        ],
        expected: {
          items: [
            {
              family: 'EDATA_419',
              decoding: 'MALFORMED',
              rawPayload: '19,0,419,0,1,1,1001,21000010F3',
              faults: [],
            },
            {
              family: 'EDATA_419',
              faults: [{ spn: 4339, fmi: 7, status: 'REMOVED', statusHex: '02' }],
            },
            { family: 'EDATA_418', decoding: 'OPAQUE', faults: [] },
            {
              family: 'EDATA_413',
              faults: [
                { code: 'P1111', status: 'ADDED' },
                { code: 'C2222', status: 'REMOVED' },
                { code: 'B3333', status: 'ADDED' },
              ],
            },
            {
              family: 'EDATA_411',
              communication: {
                communicationMask: 1,
                obdMask: 0,
                canError: 0,
                ignition: 1,
                extensionHex: '010001',
              },
              faults: [],
            },
            { family: 'OBD_E70', decoding: 'OPAQUE', rawPayload: '2,P0351,C2222', faults: [] },
            { family: 'TRACKER_E2', decoding: 'OPAQUE', rawPayload: '1,4', faults: [] },
          ],
        },
      },
      {
        name: 'numbered fault fragments retain independently valid records',
        rows: [
          diagnosticEvent(1, '19,0,419,0,0,1,1001,21000010F30701'),
          diagnosticEvent(2, '19,0,419,0,1,2,1001,21000004DF0B01'),
        ],
        expected: {
          items: [
            { decoding: 'DECODED', faults: [{ spn: 1247, fmi: 11, status: 'ADDED' }] },
            { decoding: 'DECODED', faults: [{ spn: 4339, fmi: 7, status: 'ADDED' }] },
          ],
        },
      },
      {
        name: 'type-only fault reports remain opaque rather than proving an empty logger',
        rows: [
          diagnosticEvent(1, '19,0,413,0,1,1,1001,19'),
          diagnosticEvent(2, '19,0,418,0,1,1,1001,20'),
          diagnosticEvent(3, '19,0,419,0,1,1,1001,21'),
        ],
        expected: {
          items: [
            { family: 'EDATA_419', decoding: 'OPAQUE', payloadHex: '21', faults: [] },
            { family: 'EDATA_418', decoding: 'OPAQUE', payloadHex: '20', faults: [] },
            { family: 'EDATA_413', decoding: 'OPAQUE', payloadHex: '19', faults: [] },
          ],
        },
      },
      {
        name: 'no report never proves a healthy ECU or complete history',
        rows: [],
        expected: {
          retrieval: 'COMPLETE',
          historyComplete: false,
          items: [],
          hasMore: false,
        },
      },
      {
        name: 'provider timeout remains unavailable',
        rows: new DOMException('timeout', 'TimeoutError'),
        expected: {
          retrieval: 'UNAVAILABLE',
          reason: 'UPSTREAM_FAILURE',
          historyComplete: false,
          items: [],
        },
      },
      {
        name: 'wrong account car is rejected',
        rows: [diagnosticEvent(1, secondRaw, { car_id: 42 })],
        expected: {
          retrieval: 'UNAVAILABLE',
          reason: 'INCOMPATIBLE_SOURCE',
          items: [],
        },
      },
    ];
    for (const scenario of diagnosticCases) {
      const rows = scenario.rows;
      transport.readDiagnosticEvents
        .mockReset()
        .mockImplementation(() =>
          Array.isArray(rows) ? Promise.resolve(rows) : Promise.reject(rows),
        );
      expect({
        row: scenario.name,
        body: await query(diagnosticQuery(), authorization),
      }).toMatchObject({
        row: scenario.name,
        body: { data: { karmaDiagnosticHistory: scenario.expected } },
      });
      expect(transport.readDiagnosticEvents).toHaveBeenCalledTimes(1);
    }
    transport.readDiagnosticEvents.mockReset();
    expect(
      await query(diagnosticQuery(',fromMessageId:"20",toMessageId:"10"'), authorization),
    ).toMatchObject({
      errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
    });
    expect(transport.readDiagnosticEvents).not.toHaveBeenCalled();
    const unsafeDiagnosticCursor = Buffer.from(
      JSON.stringify({
        scope: JSON.stringify(['16595', 50, 1, null]),
        before: Number.MAX_SAFE_INTEGER,
      }),
    ).toString('base64url');
    expect(
      await query(
        diagnosticQuery(`,cursor:${JSON.stringify(unsafeDiagnosticCursor)}`),
        authorization,
      ),
    ).toMatchObject({ errors: [{ extensions: { code: 'BAD_USER_INPUT' } }] });
    expect(transport.readDiagnosticEvents).not.toHaveBeenCalled();
  }, 15_000);
});
