import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { DeviceConfigurationService } from './device-configuration.service.js';

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
    const upstream = jest.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = url(input).pathname;
      if (path === '/apiv2/login') {
        return Promise.resolve(Response.json({ session_id: 'fixture-session' }));
      }
      if (path === '/apiv2/cars/41') {
        return Promise.resolve(Response.json([{ ...target, device_id: reportedDeviceId }]));
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
    ] satisfies [string, () => Promise<unknown>, unknown][]) {
      upstream.mockClear();
      const outcome = await settle(send);
      expect({ row, value: { outcome, requests: requests() } }).toEqual({
        row,
        value: { outcome: expected, requests: [] },
      });
    }
  });
});
