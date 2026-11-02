import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { DeviceConfigurationService } from './device-configuration.service.js';
import { ruleObservation, ruleReadback, type RuleObservation } from './rule-response.js';

const deviceId = '000123456789012';
const target = { car_id: 41, project_id: 12, device_id: deviceId, car_number: 'TEST 41' };
const rawDefinition = '030D000000000000000100010000000000000000003C';
const parameterInput = {
  carId: '41',
  expectedDeviceId: deviceId,
  parameterId: 781,
  reportingIntervalSeconds: 60,
  rawDefinition,
};
const rawRule = '00010000000000010707021502CE0F0A';
const opaqueRule = '000253415342800101FE';
const ruleInput = { carId: '41', expectedDeviceId: deviceId, ruleId: 1, rawDefinition: rawRule };

function url(value: Parameters<typeof fetch>[0]): URL {
  return value instanceof URL ? value : new URL(typeof value === 'string' ? value : value.url);
}

function respond(value: unknown, status = 200) {
  return () => Promise.resolve(Response.json(value, { status }));
}

async function settle(action: () => Promise<unknown>) {
  try {
    return { value: await action() };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Unexpected' };
  }
}

function subjects() {
  const transport = new KarmaTransport();
  return { transport, service: new DeviceConfigurationService(transport) };
}

describe('fixed eData device command transport', () => {
  const previous = process.env;

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = previous;
  });

  it('device commands recheck the target, send one fixed packet once and report UNCERTAIN without replay or leakage', async () => {
    process.env = {
      ...previous,
      KARMA_API_URL: 'https://karma.test/apiv2/',
      KARMA_USER: 'fixture-user',
      KARMA_PASSWORD: 'fixture-password',
    };
    let reportedDeviceId = deviceId;
    let submission = respond([12]);
    let eventRows: unknown[] = [];
    let olderDiagnosticRows: unknown[] = [];
    let queueState: number | null = 1;
    const upstream = jest.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = url(input).pathname;
      if (path === '/apiv2/login') {
        return Promise.resolve(Response.json({ session_id: 'fixture-session' }));
      }
      if (path === '/apiv2/cars/41') {
        return Promise.resolve(Response.json([{ ...target, device_id: reportedDeviceId }]));
      }
      if (path === '/apiv2/events') {
        return Promise.resolve(
          Response.json(url(input).searchParams.has('to_id') ? olderDiagnosticRows : eventRows),
        );
      }
      if (path === '/apiv2/queue/12') {
        return Promise.resolve(Response.json({ '12': { state_id: queueState } }));
      }
      return submission();
    });
    function requests() {
      return upstream.mock.calls.map(([input, init]) => {
        const requested = url(input);
        return requested.pathname === '/apiv2/commands'
          ? {
              path: requested.pathname,
              method: init?.method,
              search: requested.search,
              body: init?.body,
            }
          : { path: requested.pathname };
      });
    }
    const uncertain = { value: { status: 'UNCERTAIN', queueIds: [] } };
    const outcomes = [
      ['accepted', respond([12]), { value: { status: 'ACCEPTED', queueIds: ['12'] } }],
      [
        'HTTP 401',
        () => Promise.resolve(new Response('private provider error', { status: 401 })),
        uncertain,
      ],
      [
        'HTTP 500',
        () => Promise.resolve(new Response('private provider error', { status: 500 })),
        uncertain,
      ],
      ['Not logged in result', respond({ error: 'Not logged in' }), uncertain],
      ['empty result', respond([]), uncertain],
      ['zero queue ID', respond([0]), uncertain],
      ['repeated queue ID', respond([1, 1]), uncertain],
      [
        'lost response',
        () => Promise.reject(new Error('https://private.test/?karma_sid=private-session')),
        uncertain,
      ],
    ] satisfies [string, () => Promise<Response>, unknown][];
    for (const [kind, payload, send] of [
      ['read', '0702BC', (service) => service.request({ carId: '41', expectedDeviceId: deviceId })],
      [
        'profile',
        '1F',
        (service) => service.requestProfile({ carId: '41', expectedDeviceId: deviceId }),
      ],
      ['parameter', `02${rawDefinition}`, (service) => service.requestParameter(parameterInput)],
      [
        'rules',
        '0802BC',
        (service) => service.requestRules({ carId: '41', expectedDeviceId: deviceId }),
      ],
      ['rule', `04${rawRule}`, (service) => service.requestRule(ruleInput)],
      [
        'fault logger read',
        '19',
        (service) =>
          service.requestDiagnostic({
            carId: '41',
            expectedDeviceId: deviceId,
            kind: 'READ_FAULT_LOGGER',
          }),
      ],
    ] satisfies [string, string, (service: DeviceConfigurationService) => Promise<unknown>][]) {
      const packet = {
        path: '/apiv2/commands',
        method: 'POST',
        search: '',
        body: JSON.stringify({
          car_id: ['41'],
          message: `30,1,19,0,19,301,0,1,1,${payload}`,
          karma_sid: 'fixture-session',
        }),
      };
      for (const [result, response, expected] of outcomes) {
        const row = `${kind} ${result}`;
        submission = response;
        upstream.mockClear();
        const outcome = await settle(() => send(subjects().service));
        expect({ row, value: { outcome, requests: requests() } }).toEqual({
          row,
          value: {
            outcome: expected,
            requests: [{ path: '/apiv2/login' }, { path: '/apiv2/cars/41' }, packet],
          },
        });
      }
      const changedRow = `${kind} after the target device changed`;
      reportedDeviceId = '000999999999999';
      upstream.mockClear();
      const changed = await settle(() => send(subjects().service));
      reportedDeviceId = deviceId;
      expect({ row: changedRow, value: { outcome: changed, requests: requests() } }).toEqual({
        row: changedRow,
        value: {
          outcome: { error: 'Karma target device has changed' },
          requests: [{ path: '/apiv2/login' }, { path: '/apiv2/cars/41' }],
        },
      });
    }
    submission = respond([12]);
    upstream.mockClear();
    expect(
      await subjects().service.requestDiagnostic({
        carId: '41',
        expectedDeviceId: deviceId,
        kind: 'READ_COMMUNICATION_DIAGNOSTICS',
      }),
    ).toEqual({ status: 'ACCEPTED', queueIds: ['12'] });
    expect(requests().at(-1)).toEqual({
      path: '/apiv2/commands',
      method: 'POST',
      search: '',
      body: JSON.stringify({
        car_id: ['41'],
        message: '30,1,19,0,19,306,0,1,1,',
        karma_sid: 'fixture-session',
      }),
    });
    for (const state of [0, 2, null, 4]) {
      queueState = state;
      upstream.mockClear();
      expect(
        await subjects().service.requestDiagnostic({
          carId: '41',
          expectedDeviceId: deviceId,
          kind: 'READ_FAULT_LOGGER',
          existingQueueIds: ['12'],
        }),
      ).toEqual({ status: 'PENDING', queueIds: ['12'] });
      expect(requests()).toEqual([
        { path: '/apiv2/login' },
        { path: '/apiv2/cars/41' },
        { path: '/apiv2/queue/12' },
      ]);
    }
    for (const state of [1, 3]) {
      queueState = state;
      upstream.mockClear();
      expect(
        await subjects().service.requestDiagnostic({
          carId: '41',
          expectedDeviceId: deviceId,
          kind: 'READ_FAULT_LOGGER',
          existingQueueIds: ['12'],
        }),
      ).toEqual({ status: 'ACCEPTED', queueIds: ['12'] });
      expect(requests().filter((request) => request.path === '/apiv2/commands')).toHaveLength(1);
    }
    queueState = 1;
    const { transport, service } = subjects();
    const invalid = { error: 'Invalid device configuration request' };
    const unavailable = { error: 'Karma is unavailable; try again later' };
    for (const [row, send, expected] of [
      [
        'path car ID',
        () => service.request({ carId: '../commands', expectedDeviceId: deviceId }),
        invalid,
      ],
      [
        'arbitrary message field',
        () => service.request({ carId: '41', expectedDeviceId: deviceId, message: 'reset' }),
        invalid,
      ],
      [
        'diagnostic command is a fixed allowed kind',
        () =>
          service.requestDiagnostic({
            carId: '41',
            expectedDeviceId: deviceId,
            kind: 'CLEAR_FAULTS',
          }),
        invalid,
      ],
      [
        'two definitions',
        () =>
          service.requestParameter({
            ...parameterInput,
            rawDefinition: rawDefinition + rawDefinition,
          }),
        invalid,
      ],
      [
        'replace prefix',
        () => service.requestParameter({ ...parameterInput, rawDefinition: `01${rawDefinition}` }),
        invalid,
      ],
      [
        'mismatched parameter ID',
        () => service.requestParameter({ ...parameterInput, parameterId: 662 }),
        invalid,
      ],
      [
        'mismatched interval',
        () => service.requestParameter({ ...parameterInput, reportingIntervalSeconds: 30 }),
        invalid,
      ],
      [
        'two definitions at the transport',
        () =>
          transport.requestParameter(
            '41',
            rawDefinition + rawDefinition,
            AbortSignal.timeout(4000),
          ),
        unavailable,
      ],
      [
        'replace prefix at the transport',
        () => transport.requestParameter('41', `01${rawDefinition}`, AbortSignal.timeout(4000)),
        unavailable,
      ],
      [
        'two rule definitions',
        () => service.requestRule({ ...ruleInput, rawDefinition: rawRule + rawRule }),
        invalid,
      ],
      [
        'rule replace-all prefix',
        () => service.requestRule({ ...ruleInput, rawDefinition: `03${rawRule}` }),
        invalid,
      ],
      ['mismatched rule ID', () => service.requestRule({ ...ruleInput, ruleId: 2 }), invalid],
      [
        'unknown rule expression cannot be submitted',
        () => service.requestRule({ ...ruleInput, ruleId: 2, rawDefinition: opaqueRule }),
        invalid,
      ],
      [
        'two rules at the transport',
        () => transport.requestRule('41', rawRule + rawRule, AbortSignal.timeout(4000)),
        unavailable,
      ],
      [
        'opaque rule at the transport',
        () => transport.requestRule('41', opaqueRule, AbortSignal.timeout(4000)),
        unavailable,
      ],
    ] satisfies [string, () => Promise<unknown>, unknown][]) {
      upstream.mockClear();
      const outcome = await settle(send);
      expect({ row, value: { outcome, requests: requests() } }).toEqual({
        row,
        value: { outcome: expected, requests: [] },
      });
    }
    const eventTimeUtc = '2026-01-01T00:00:00.000Z';
    const first = ruleObservation('1', eventTimeUtc, `19,0,402,0,0,1,1001,08${rawRule}`);
    const last = ruleObservation('2', eventTimeUtc, `19,0,402,0,1,2,1001,08${opaqueRule}`);
    const empty = ruleObservation('1', eventTimeUtc, '19,0,402,0,1,1,1001,08');
    if (!first || !last || !empty) {
      throw new Error('Missing rule fixture observations');
    }
    const complete = {
      status: 'COMPLETE',
      configurationId: '1001',
      rules: [
        { ruleId: 1, rawDefinition: rawRule },
        { ruleId: 2, rawDefinition: opaqueRule },
      ],
    };
    expect(ruleReadback([last, first], true)).toEqual(complete);
    expect(ruleReadback([], true).status).toBe('ABSENT');
    for (const [row, observations, coverage, expected] of [
      ['missing first fragment', [last], true, 'INCOMPLETE'],
      ['incomplete scan', [first, last], false, 'INCOMPLETE'],
      ['configuration mismatch', [first, { ...last, configurationId: '1002' }], true, 'CONFLICT'],
      ['duplicate rule ID', [first, { ...last, rules: first.rules }], true, 'CONFLICT'],
      [
        'different duplicate fragment',
        [first, { ...first, rules: last.rules }, last],
        true,
        'CONFLICT',
      ],
      ['multiple final fragments', [{ ...first, lastMessage: true }, last], true, 'CONFLICT'],
    ] satisfies [string, RuleObservation[], boolean, string][]) {
      expect({ row, status: ruleReadback(observations, coverage).status }).toEqual({
        row,
        status: expected,
      });
    }
    for (const message of [
      `19,0,402,0,1,1,1001,08${rawRule.slice(0, -2)}`,
      `19,0,402,0,1,1,1001,08${rawRule}0`,
      `19,0,402,0,1,1,1001,08${rawRule}00`,
      `19,0,402,0,1,1,1001,08000100000000000181${'FE'.repeat(129)}`,
      `19,0,402,0,1,1,65536,08${rawRule}`,
    ]) {
      expect(() => ruleObservation('1', eventTimeUtc, message)).toThrow(
        'Karma rule observations are unavailable',
      );
    }
    expect(ruleObservation('1', eventTimeUtc, `19,0,404,0,1,1,1001,13${rawRule}`)).toBeNull();
    expect(ruleReadback([empty], true)).toEqual({
      status: 'COMPLETE',
      configurationId: '1001',
      rules: [],
    });
    eventRows = [first, last].map((item) => ({
      message_id: Number(item.messageId),
      car_id: 41,
      device_id: deviceId,
      eid: 33,
      edt: '2026-01-01 00:00:00',
      extra: item.rawMessage,
    }));
    const window = {
      carId: '41',
      expectedDeviceId: deviceId,
      fromUtc: eventTimeUtc,
      toUtc: eventTimeUtc,
    };
    expect(await service.ruleObservations(window)).toEqual({
      coverageComplete: true,
      readback: complete,
      observations: [last, first],
    });
    expect(await service.ruleObservations({ ...window, afterMessageId: '1' })).toEqual({
      coverageComplete: true,
      readback: { status: 'INCOMPLETE', configurationId: '1001', rules: [] },
      observations: [last],
    });
    for (const read of [
      (value: typeof window) => service.observations(value),
      (value: typeof window) => service.ruleObservations(value),
    ]) {
      const event = {
        message_id: 3,
        car_id: 41,
        device_id: deviceId,
        eid: 33,
        edt: '2026-01-01 00:00:00',
        extra: '19,0,154,0',
      };
      eventRows = [event];
      expect(await read(window)).toMatchObject({
        coverageComplete: true,
        readback: { status: 'ABSENT', configurationId: null },
        observations: [],
        terminalResponse: {
          messageId: '3',
          eventTimeUtc,
          rawMessage: '19,0,154,0',
        },
      });
      eventRows = [{ ...event, extra: '19,0,154,1' }];
      expect(await read(window)).not.toHaveProperty('terminalResponse');
    }
    eventRows = [
      {
        message_id: 3,
        car_id: 41,
        device_id: deviceId,
        eid: 33,
        edt: '2026-01-01 00:00:00',
        extra: '19,0,154,0',
      },
      {
        message_id: 4,
        car_id: 41,
        device_id: deviceId,
        eid: 33,
        edt: '2026-01-01 00:00:00',
        extra: `19,0,402,0,1,1,1001,08${rawRule}`,
      },
    ];
    expect(await service.ruleObservations(window)).toMatchObject({
      readback: { status: 'COMPLETE', rules: [{ ruleId: 1, rawDefinition: rawRule }] },
      terminalResponse: { rawMessage: '19,0,154,0' },
    });
    const realFault = '19,0,419,0,1,1,1001,21000010F30701000004DF0B01';
    const communication = '19,0,411,0,1,1,1001,01000001010001';
    eventRows = ['19,0,154,0', '19,0,154,1', communication, realFault].map((extra, index) => ({
      message_id: index + 3,
      car_id: 41,
      device_id: deviceId,
      eid: 33,
      edt: '2026-01-01 00:00:00',
      extra,
    }));
    eventRows.unshift({
      message_id: 2,
      car_id: 41,
      device_id: deviceId,
      eid: 33,
      edt: '2025-12-31 23:59:59',
      extra: realFault,
    });
    expect(await service.diagnosticObservations({ ...window, queueIds: ['12'] })).toEqual({
      coverageComplete: true,
      queue: [{ id: '12', state: 1 }],
      observations: [
        {
          messageId: '6',
          eventTimeUtc,
          rawMessage: realFault,
          family: 'FAULT_REPORT',
          acknowledgement: null,
        },
        {
          messageId: '5',
          eventTimeUtc,
          rawMessage: communication,
          family: 'COMMUNICATION_DIAGNOSTICS',
          acknowledgement: null,
        },
        {
          messageId: '4',
          eventTimeUtc,
          rawMessage: '19,0,154,1',
          family: 'SPECIAL_ACK',
          acknowledgement: 'POSITIVE_ACK',
        },
        {
          messageId: '3',
          eventTimeUtc,
          rawMessage: '19,0,154,0',
          family: 'SPECIAL_ACK',
          acknowledgement: 'NACK',
        },
      ],
    });
    upstream.mockClear();
    expect(await service.diagnosticWatermark({ carId: '41', expectedDeviceId: deviceId })).toEqual({
      afterMessageId: '6',
    });
    const watermarkEventRequest = upstream.mock.calls.find(
      ([input]) => url(input).pathname === '/apiv2/events',
    );
    expect(
      watermarkEventRequest ? Object.fromEntries(url(watermarkEventRequest[0]).searchParams) : null,
    ).toEqual({
      car: '41',
      date_type: 'utc',
      'event_type[]': '33',
      karma_sid: 'fixture-session',
    });
    upstream.mockClear();
    expect(
      await service.diagnosticObservations({ ...window, queueIds: ['12'], afterMessageId: '3' }),
    ).toMatchObject({
      coverageComplete: true,
      observations: [{ messageId: '6' }, { messageId: '5' }, { messageId: '4' }],
    });
    const diagnosticEventRequests = upstream.mock.calls.filter(
      ([input]) => url(input).pathname === '/apiv2/events',
    );
    for (const [input] of diagnosticEventRequests) {
      const parameters = url(input).searchParams;
      expect(parameters.has('from_date') || parameters.has('to_date')).toBe(false);
      expect(parameters.get('from_id')).toBe('3');
    }
    const diagnosticRow = (messageId: number, extra: string) => ({
      message_id: messageId,
      car_id: 41,
      device_id: deviceId,
      eid: 33,
      edt: '2026-01-01 00:00:00',
      extra,
    });
    const unresolvedFault = diagnosticRow(4, '19,0,419,0,0,1,1001,21');
    eventRows = [
      unresolvedFault,
      diagnosticRow(5, '19,0,419,0,1,2,1001,21000010F30701'),
      diagnosticRow(6, '19,0,418,0,1,1,1001,20'),
    ];
    olderDiagnosticRows = [
      diagnosticRow(2, '19,0,154,0'),
      diagnosticRow(3, '19,0,413,0,1,1,1001,19'),
      unresolvedFault,
    ];
    expect(
      await service.diagnosticObservations({ ...window, queueIds: [], afterMessageId: '2' }),
    ).toMatchObject({
      coverageComplete: true,
      observations: [
        { messageId: '6', family: 'UNRESOLVED_FAULT_REPORT' },
        { messageId: '5', family: 'FAULT_REPORT' },
        { messageId: '4', family: 'UNRESOLVED_FAULT_REPORT' },
        { messageId: '3', family: 'UNRESOLVED_FAULT_REPORT' },
      ],
    });
  });
});
