import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { issueDemoToken } from '../../auth/demo-auth.js';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { configurationObservation, configurationReadback } from './configuration-response.js';
import { configurationWindow } from './configuration-input.js';
import { DeviceConfigurationModule } from './device-configuration.module.js';
import { DeviceConfigurationService } from './device-configuration.service.js';

const deviceId = '000123456789012';
const target = { car_id: 41, project_id: 12, device_id: deviceId, car_number: 'TEST 41' };
const definition = '0296000000000000000000000000000000000000001E';
const unknownDefinition = 'FFFF1234567808010001000100000000000000000000';
const window = {
  carId: '41',
  expectedDeviceId: deviceId,
  fromUtc: '2026-10-20T10:00:00.000Z',
  toUtc: '2026-10-20T10:01:00.000Z',
};
function event(messageId: number, raw = `19,0,401,0,1,1,1001,07${definition}`) {
  return {
    message_id: messageId,
    car_id: 41,
    device_id: deviceId,
    eid: 33,
    edt: '2026-10-20 10:00:01',
    extra: raw,
  };
}
function observation(raw: string, messageId = '1') {
  const result = configurationObservation(messageId, '2026-10-20T10:00:01.000Z', raw);
  if (!result) {
    throw new Error('Expected configuration fragment');
  }
  return result;
}

describe('eData parameter definition readback', () => {
  it('preserves unknown 22-byte definitions, zero intervals and decoding bytes', () => {
    const result = observation(
      `19,0,401,0,1,1,1001,07${unknownDefinition.toLowerCase()}${definition}`,
    );
    expect(result.parameters).toEqual([
      { parameterId: 65535, reportingIntervalSeconds: 0, rawDefinition: unknownDefinition },
      { parameterId: 662, reportingIntervalSeconds: 30, rawDefinition: definition },
    ]);
    expect(configurationReadback([result], true)).toMatchObject({
      status: 'COMPLETE',
      configurationId: '1001',
    });
  });

  it('assembles out-of-order multipart readbacks and identical retransmissions', () => {
    const first = observation(`19,0,401,0,0,1,1001,07${definition}`);
    const last = observation(`19,0,401,0,1,2,1001,07${unknownDefinition}`, '2');
    expect(configurationReadback([last, first, first], true)).toEqual({
      status: 'COMPLETE',
      configurationId: '1001',
      parameters: [...first.parameters, ...last.parameters],
    });
  });

  it('distinguishes empty definitions, missing fragments and incomplete scan coverage', () => {
    expect(configurationReadback([], true).status).toBe('ABSENT');
    expect(configurationReadback([observation('19,0,401,0,1,1,1001,07')], true)).toEqual({
      status: 'COMPLETE',
      configurationId: '1001',
      parameters: [],
    });
    expect(
      configurationReadback([observation(`19,0,401,0,1,2,1001,07${definition}`)], true).status,
    ).toBe('INCOMPLETE');
    expect(
      configurationReadback([observation(`19,0,401,0,0,1,1001,07${definition}`)], true).status,
    ).toBe('INCOMPLETE');
    expect(
      configurationReadback([observation(`19,0,401,0,1,1,1001,07${definition}`)], false).status,
    ).toBe('INCOMPLETE');
  });

  it.each([
    [`19,0,401,0,0,1,1001,07${definition}`, `19,0,401,0,1,2,1002,07${unknownDefinition}`],
    [`19,0,401,0,1,1,1001,07${definition}`, `19,0,401,0,1,2,1001,07${unknownDefinition}`],
    [`19,0,401,0,0,1,1001,07${definition}`, `19,0,401,0,1,1,1001,07${unknownDefinition}`],
    [`19,0,401,0,0,1,1001,07${definition}`, `19,0,401,0,1,2,1001,07${definition}`],
    [`19,0,401,0,1,1,1001,07${definition}`, `19,0,401,0,0,2,1001,07${unknownDefinition}`],
  ])(
    'rejects conflicting configuration, numbering, final markers or parameter IDs',
    (first, last) => {
      expect(configurationReadback([observation(first), observation(last, '2')], true).status).toBe(
        'CONFLICT',
      );
    },
  );

  it.each([
    '19,0,401,0,1,1,1001,0700',
    '19,0,401,1,1,1,1001,07',
    '19,0,401,0,1,0,1001,07',
    '19,0,401,0,1,1,65536,07',
    `19,0,401,0,1,1,1001,07${definition}ZZ`,
  ])('rejects malformed known responses', (raw) => {
    expect(() => observation(raw)).toThrow('unavailable');
  });

  it('does not treat an unrelated diagnostic or unverified ACK as a readback', () => {
    expect(
      configurationObservation('1', window.fromUtc, '19,0,411,0,1,1,1001,00000000'),
    ).toBeNull();
    expect(configurationObservation('1', window.fromUtc, '19,0,154,1')).toBeNull();
  });
});

describe('bounded identity-checked configuration provider reads', () => {
  let client: KarmaTransport;
  let service: DeviceConfigurationService;
  let targetRead: jest.SpiedFunction<KarmaTransport['readConfigurationTarget']>;
  beforeEach(() => {
    client = new KarmaTransport();
    service = new DeviceConfigurationService(client);
    targetRead = jest.spyOn(client, 'readConfigurationTarget').mockResolvedValue([target]);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rechecks device identity before submitting the fixed read request', async () => {
    const submit = jest
      .spyOn(client, 'requestConfiguration')
      .mockResolvedValue({ status: 'ACCEPTED', queueIds: ['9'] });
    await expect(service.request({ carId: '41', expectedDeviceId: 'changed' })).rejects.toThrow(
      'changed',
    );
    expect(submit).not.toHaveBeenCalled();
    await expect(service.request({ carId: '41', expectedDeviceId: deviceId })).resolves.toEqual({
      status: 'ACCEPTED',
      queueIds: ['9'],
    });
    expect(submit).toHaveBeenCalledWith('41', expect.any(AbortSignal));
  });

  it('refuses arbitrary commands, paths and missing identities before upstream access', async () => {
    const read = jest.spyOn(client, 'readConfigurationEvents');
    await expect(
      service.request({ carId: '../login', expectedDeviceId: deviceId }),
    ).rejects.toThrow('Invalid');
    await expect(
      service.request({ carId: '41', expectedDeviceId: deviceId, message: 'reset' }),
    ).rejects.toThrow('Invalid');
    await expect(service.observations({ ...window, expectedDeviceId: undefined })).rejects.toThrow(
      'Invalid',
    );
    expect(targetRead).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('reads all bounded event pages through an empty terminal page and preserves complete snapshots', async () => {
    const read = jest
      .spyOn(client, 'readConfigurationEvents')
      .mockResolvedValueOnce([event(5, `19,0,401,0,1,2,1001,07${unknownDefinition}`)])
      .mockResolvedValueOnce([event(3, `19,0,401,0,0,1,1001,07${definition}`)])
      .mockResolvedValueOnce([]);
    const result = await service.observations(window);
    expect(result.coverageComplete).toBe(true);
    expect(result.readback).toMatchObject({
      status: 'COMPLETE',
      parameters: [{ parameterId: 662 }, { parameterId: 65535 }],
    });
    expect(read.mock.calls.map(([params]) => params.get('to_id'))).toEqual([null, '4', '2']);
    expect(read.mock.calls.every(([params]) => params.getAll('event_type[]').join() === '33')).toBe(
      true,
    );
    expect(new Set(read.mock.calls.map(([, signal]) => signal)).size).toBe(1);
  });

  it('allows the background scan to finish after the public four-second budget while sharing one deadline', async () => {
    jest.useFakeTimers();
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => {
        controller.abort();
      }, milliseconds);
      return controller.signal;
    });
    function delayed<T>(value: T, signal: AbortSignal): Promise<T> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', abort);
          resolve(value);
        }, 3000);
        function abort() {
          clearTimeout(timer);
          reject(new Error('Shared observation deadline expired'));
        }
        if (signal.aborted) {
          abort();
        } else {
          signal.addEventListener('abort', abort, { once: true });
        }
      });
    }
    targetRead.mockImplementation((_id, signal) => delayed([target], signal));
    const read = jest
      .spyOn(client, 'readConfigurationEvents')
      .mockImplementationOnce((_parameters, signal) => delayed([event(5)], signal))
      .mockImplementationOnce((_parameters, signal) => delayed([], signal));
    try {
      const result = service.observations(window);
      const completed = expect(result).resolves.toMatchObject({
        coverageComplete: true,
        readback: { status: 'COMPLETE' },
      });
      await jest.advanceTimersByTimeAsync(9000);
      await completed;
      expect(timeout).toHaveBeenCalledTimes(1);
      expect(timeout).toHaveBeenCalledWith(20000);
      expect(read.mock.calls.every(([, signal]) => signal === targetRead.mock.calls[0]?.[1])).toBe(
        true,
      );
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('expires the cumulative observation budget rather than granting every page a new timeout', async () => {
    jest.useFakeTimers();
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => {
        controller.abort();
      }, milliseconds);
      return controller.signal;
    });
    function delayed<T>(value: T, signal: AbortSignal): Promise<T> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', abort);
          resolve(value);
        }, 6000);
        function abort() {
          clearTimeout(timer);
          reject(new Error('Shared observation deadline expired'));
        }
        if (signal.aborted) {
          abort();
        } else {
          signal.addEventListener('abort', abort, { once: true });
        }
      });
    }
    targetRead.mockImplementation((_id, signal) => delayed([target], signal));
    const read = jest
      .spyOn(client, 'readConfigurationEvents')
      .mockImplementationOnce((_parameters, signal) => delayed([event(5)], signal))
      .mockImplementationOnce((_parameters, signal) => delayed([event(3)], signal))
      .mockImplementationOnce((_parameters, signal) => delayed([], signal));
    try {
      const rejected = expect(service.observations(window)).rejects.toThrow(
        'Shared observation deadline expired',
      );
      await jest.advanceTimersByTimeAsync(20000);
      await rejected;
      expect(timeout).toHaveBeenCalledTimes(1);
      expect(timeout).toHaveBeenCalledWith(20000);
      expect(read).toHaveBeenCalledTimes(3);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('retains the short target and device-request budgets', async () => {
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    jest
      .spyOn(client, 'requestConfiguration')
      .mockResolvedValue({ status: 'ACCEPTED', queueIds: ['9'] });
    await service.target({ carId: '41' });
    await service.request({ carId: '41', expectedDeviceId: deviceId });
    expect(timeout.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([4000, 4000]);
  });

  it('does not claim coverage or complete readback after reaching the four-page budget', async () => {
    const read = jest.spyOn(client, 'readConfigurationEvents');
    for (const id of [9, 7, 5, 3]) {
      read.mockResolvedValueOnce([event(id)]);
    }
    const result = await service.observations(window);
    expect(result.coverageComplete).toBe(false);
    expect(result.readback.status).toBe('INCOMPLETE');
    expect(read).toHaveBeenCalledTimes(4);
  });

  it.each([
    { device_id: 'different' },
    { car_id: 42 },
    { eid: 34 },
    { edt: '2026-10-20 09:59:59' },
    { edt: '2026-02-30 10:00:01' },
    { extra: {} },
    { message_id: 0 },
  ])('rejects ignored target/time/event filters or malformed rows', async (change) => {
    jest.spyOn(client, 'readConfigurationEvents').mockResolvedValue([{ ...event(1), ...change }]);
    await expect(service.observations(window)).rejects.toThrow('unavailable');
  });

  it('rejects an ignored descending pagination bound instead of looping', async () => {
    jest.spyOn(client, 'readConfigurationEvents').mockResolvedValue([event(3)]);
    await expect(service.observations(window)).rejects.toThrow('unavailable');
  });

  it('bounds observation payloads and does not complete a truncated response', async () => {
    jest
      .spyOn(client, 'readConfigurationEvents')
      .mockResolvedValueOnce(Array.from({ length: 65 }, (_, index) => event(index + 1)));
    const result = await service.observations(window);
    expect(result.observations).toHaveLength(64);
    expect(result.coverageComplete).toBe(false);
    expect(result.readback.status).toBe('INCOMPLETE');
  });

  it('bounds total returned definitions even across large response fragments', async () => {
    jest
      .spyOn(client, 'readConfigurationEvents')
      .mockResolvedValueOnce(
        Array.from({ length: 20 }, (_, index) =>
          event(index + 1, `19,0,401,0,1,1,1001,07${definition.repeat(100)}`),
        ),
      );
    const result = await service.observations(window);
    expect(result.observations.reduce((count, row) => count + row.parameters.length, 0)).toBe(1000);
    expect(result.coverageComplete).toBe(false);
    expect(result.readback.status).toBe('INCOMPLETE');
  });

  it('bounds the requested time window and validates actual UTC calendar dates', () => {
    expect(() => configurationWindow({ ...window, fromUtc: '2026-02-30T10:00:00.000Z' })).toThrow(
      'Invalid',
    );
    expect(() => configurationWindow({ ...window, toUtc: '2026-10-22T10:00:00.000Z' })).toThrow(
      'Invalid',
    );
    expect(() =>
      configurationWindow({ ...window, fromUtc: window.toUtc, toUtc: window.fromUtc }),
    ).toThrow('Invalid');
  });
});

describe('internal machine authentication', () => {
  const previous = process.env;
  afterEach(() => {
    process.env = previous;
    jest.restoreAllMocks();
  });

  it('requires the machine secret and authenticates before validation/provider access', async () => {
    const internalToken = 'fixture-internal-secret-with-32-characters';
    process.env = {
      ...previous,
      KARMA_INTERNAL_TOKEN: internalToken,
    };
    const client = new KarmaTransport();
    const read = jest.spyOn(client, 'readConfigurationTarget').mockResolvedValue([target]);
    const module = await Test.createTestingModule({ imports: [DeviceConfigurationModule] })
      .overrideProvider(KarmaTransport)
      .useValue(client)
      .compile();
    const app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    async function post(authorization: string | undefined, body: unknown) {
      const response = await fetch(`${base}/internal/device-configuration/target`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(authorization ? { authorization } : {}),
        },
        body: JSON.stringify(body),
      });
      const data: unknown = await response.json();
      return { status: response.status, data };
    }
    try {
      for (const authorization of [
        undefined,
        'Bearer wrong',
        `Bearer ${issueDemoToken('01000000-0000-4000-8000-000000000001')}`,
      ]) {
        expect((await post(authorization, { carId: '../login' })).status).toBe(401);
      }
      expect(read).not.toHaveBeenCalled();
      expect(await post(`Bearer ${internalToken}`, { carId: '41' })).toEqual({
        status: 200,
        data: { carId: '41', deviceId, carNumber: 'TEST 41' },
      });
      delete process.env.KARMA_INTERNAL_TOKEN;
      expect((await post('Bearer wrong', { carId: '41' })).status).toBe(503);
      expect(read).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
});
