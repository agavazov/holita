import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { issueDemoToken } from '../../auth/demo-auth.js';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { configurationParameterRequest, configurationWindow } from './configuration-input.js';
import { profileObservation, profileReadback } from './profile-response.js';
import { DeviceConfigurationService } from './device-configuration.service.js';
import { DeviceConfigurationModule } from './device-configuration.module.js';

const deviceId = '000123456789012';
const rawDefinition = '030D000000000000000100010000000000000000003C';
const requestInput = {
  carId: '41',
  expectedDeviceId: deviceId,
  parameterId: 781,
  reportingIntervalSeconds: 60,
  rawDefinition,
};
const window = {
  carId: '41',
  expectedDeviceId: deviceId,
  fromUtc: '2026-10-21T00:00:00.000Z',
  toUtc: '2026-10-21T00:01:00.000Z',
};
const target = { car_id: 41, project_id: 12, device_id: deviceId, car_number: 'TEST 41' };
function event(id: number, rawMessage: string) {
  return {
    message_id: id,
    car_id: 41,
    device_id: deviceId,
    eid: 33,
    edt: '2026-10-21 00:00:01',
    extra: rawMessage,
  };
}
function profile(raw = '19,0,416,0,1,1,1001,1F0157') {
  const value = profileObservation('5', window.fromUtc, raw);
  if (!value) {
    throw new Error('Expected a profile observation');
  }
  return value;
}
function url(value: Parameters<typeof fetch>[0]): URL {
  return value instanceof URL ? value : new URL(typeof value === 'string' ? value : value.url);
}

describe('one-definition parameter request validation', () => {
  it('accepts exactly one 22-byte definition with matching ID and interval', () => {
    expect(
      configurationParameterRequest({
        ...requestInput,
        rawDefinition: rawDefinition.toLowerCase(),
      }),
    ).toEqual(requestInput);
    expect(
      configurationParameterRequest({
        ...requestInput,
        reportingIntervalSeconds: 0,
        rawDefinition: rawDefinition.slice(0, 40) + '0000',
      }).reportingIntervalSeconds,
    ).toBe(0);
    expect(
      configurationParameterRequest({
        ...requestInput,
        reportingIntervalSeconds: 65000,
        rawDefinition: rawDefinition.slice(0, 40) + 'FDE8',
      }).reportingIntervalSeconds,
    ).toBe(65000);
  });
  it.each([
    { parameterId: 662 },
    { reportingIntervalSeconds: 30 },
    { reportingIntervalSeconds: -1 },
    { reportingIntervalSeconds: 65001 },
    { parameterId: 65536 },
    { parameterId: 1.5 },
    { rawDefinition: '01' + rawDefinition },
    { rawDefinition: rawDefinition + rawDefinition },
    { rawDefinition: rawDefinition.replace('D', 'Z') },
    { message: 'reset' },
    { operation: '01' },
    { carId: '../commands' },
    { expectedDeviceId: '' },
  ])('rejects mismatched or arbitrary request content', (change) => {
    expect(() => configurationParameterRequest({ ...requestInput, ...change })).toThrow('Invalid');
  });
  it.each(['0', '-1', '9007199254740992', '', null])(
    'rejects invalid observation watermarks',
    (afterMessageId) => {
      expect(() => configurationWindow({ ...window, afterMessageId })).toThrow('Invalid');
    },
  );
});

describe('separate vehicle-profile response parsing', () => {
  it('decodes the exact 416/1F profile response and preserves its original envelope', () => {
    expect(profile()).toMatchObject({
      profileId: 343,
      configurationId: '1001',
      messageNumber: 1,
      lastMessage: true,
      rawMessage: '19,0,416,0,1,1,1001,1F0157',
    });
    expect(profileReadback([profile(), profile()], true)).toEqual({
      status: 'COMPLETE',
      profileId: 343,
    });
    expect(profileReadback([], true)).toEqual({ status: 'ABSENT', profileId: null });
  });
  it('requires complete single-message profile evidence and complete scan coverage', () => {
    expect(profileReadback([profile()], false)).toEqual({ status: 'INCOMPLETE', profileId: null });
    expect(profileReadback([profile('19,0,416,0,0,1,1001,1F0157')], true).status).toBe(
      'INCOMPLETE',
    );
    expect(profileReadback([profile('19,0,416,0,1,2,1001,1F0157')], true).status).toBe(
      'INCOMPLETE',
    );
  });
  it.each(['19,0,416,0,1,1,1001,1F01AE', '19,0,416,0,1,1,1002,1F0157'])(
    'rejects conflicting profile or configuration observations',
    (different) => {
      expect(profileReadback([profile(), profile(different)], true).status).toBe('CONFLICT');
    },
  );
  it.each([
    '19,0,416,1,1,1,1001,1F0157',
    '19,0,416,0,1,1,1001,1F015700',
    '19,0,416,0,1,0,1001,1F0157',
    '19,0,416,0,1,1,65536,1F0157',
  ])('rejects malformed profile envelopes', (raw) => {
    expect(() => profile(raw)).toThrow('unavailable');
  });
  it('does not interpret parameter definitions or ACKs as profile evidence', () => {
    expect(
      profileObservation('5', window.fromUtc, `19,0,401,0,1,1,1001,07${rawDefinition}`),
    ).toBeNull();
    expect(profileObservation('5', window.fromUtc, '19,0,154,1')).toBeNull();
  });
});

describe('identity-checked fixed profile and parameter provider actions', () => {
  let client: KarmaTransport;
  let service: DeviceConfigurationService;
  beforeEach(() => {
    client = new KarmaTransport();
    service = new DeviceConfigurationService(client);
    jest.spyOn(client, 'readConfigurationTarget').mockResolvedValue([target]);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rechecks target identity before either submission and captures only one definition', async () => {
    const profileSend = jest
      .spyOn(client, 'requestProfile')
      .mockResolvedValue({ status: 'ACCEPTED', queueIds: ['5'] });
    const parameterSend = jest
      .spyOn(client, 'requestParameter')
      .mockResolvedValue({ status: 'ACCEPTED', queueIds: ['6'] });
    await expect(
      service.requestProfile({ carId: '41', expectedDeviceId: 'different' }),
    ).rejects.toThrow('changed');
    await expect(
      service.requestParameter({ ...requestInput, expectedDeviceId: 'different' }),
    ).rejects.toThrow('changed');
    expect(profileSend).not.toHaveBeenCalled();
    expect(parameterSend).not.toHaveBeenCalled();
    await expect(
      service.requestProfile({ carId: '41', expectedDeviceId: deviceId }),
    ).resolves.toMatchObject({ queueIds: ['5'] });
    await expect(service.requestParameter(requestInput)).resolves.toMatchObject({
      queueIds: ['6'],
    });
    expect(profileSend).toHaveBeenCalledWith('41', expect.any(AbortSignal));
    expect(parameterSend).toHaveBeenCalledWith('41', rawDefinition, expect.any(AbortSignal));
  });

  it('filters old parameter configuration fragments before assembly', async () => {
    const read = jest
      .spyOn(client, 'readConfigurationEvents')
      .mockResolvedValueOnce([
        event(3, '19,0,401,0,1,1,999,0700'),
        event(5, `19,0,401,0,1,1,1001,07${rawDefinition}`),
      ]);
    const result = await service.observations({ ...window, afterMessageId: '3' });
    expect(result).toMatchObject({
      coverageComplete: true,
      readback: { status: 'COMPLETE', configurationId: '1001' },
      observations: [{ messageId: '5' }],
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('keeps profile evidence separate, applies its watermark and uses a bounded event scan', async () => {
    const read = jest
      .spyOn(client, 'readConfigurationEvents')
      .mockResolvedValueOnce([
        event(3, '19,0,416,0,1,1,999,1F0002'),
        event(4, `19,0,401,0,1,1,1001,07${rawDefinition}`),
        event(5, '19,0,416,0,1,1,1001,1F0157'),
      ]);
    const result = await service.profileObservations({ ...window, afterMessageId: '3' });
    expect(result).toMatchObject({
      coverageComplete: true,
      readback: { status: 'COMPLETE', profileId: 343 },
      observations: [{ messageId: '5' }],
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0]?.[0].getAll('event_type[]')).toEqual(['33']);
  });

  it('still validates target identity before profile observations', async () => {
    const read = jest.spyOn(client, 'readConfigurationEvents');
    await expect(
      service.profileObservations({ ...window, expectedDeviceId: 'different' }),
    ).rejects.toThrow('changed');
    expect(read).not.toHaveBeenCalled();
  });
});

describe('single-attempt profile and one-parameter transport', () => {
  const previous = process.env;
  let upstream: jest.SpiedFunction<typeof fetch>;
  let client: KarmaTransport;
  beforeEach(() => {
    process.env = {
      ...previous,
      KARMA_API_URL: 'https://karma.test/apiv2/',
      KARMA_USER: 'fixture-user',
      KARMA_PASSWORD: 'fixture-password',
    };
    upstream = jest.spyOn(globalThis, 'fetch');
    client = new KarmaTransport();
  });
  afterEach(() => {
    process.env = previous;
    jest.restoreAllMocks();
  });
  it.each(['profile', 'parameter'] as const)(
    'constructs the fixed %s packet without accepting an arbitrary command',
    async (kind) => {
      upstream
        .mockResolvedValueOnce(Response.json({ session_id: 'fixture-session' }))
        .mockResolvedValueOnce(Response.json([9]));
      const signal = AbortSignal.timeout(4000);
      await expect(
        kind === 'profile'
          ? client.requestProfile('41', signal)
          : client.requestParameter('41', rawDefinition, signal),
      ).resolves.toEqual({ status: 'ACCEPTED', queueIds: ['9'] });
      const call = upstream.mock.calls[1];
      if (!call) {
        throw new Error('Missing provider submission');
      }
      expect(url(call[0]).pathname).toBe('/apiv2/commands');
      expect(call[1]?.body).toBe(
        JSON.stringify({
          car_id: ['41'],
          message: '30,1,19,0,19,301,0,1,1,' + (kind === 'profile' ? '1F' : '02' + rawDefinition),
          karma_sid: 'fixture-session',
        }),
      );
      expect(upstream).toHaveBeenCalledTimes(2);
    },
  );
  it.each(['profile', 'parameter'] as const)(
    'does not replay the %s submission after a rejected session',
    async (kind) => {
      upstream
        .mockResolvedValueOnce(Response.json({ session_id: 'fixture-session' }))
        .mockResolvedValueOnce(new Response('private', { status: 401 }));
      const signal = AbortSignal.timeout(4000);
      await expect(
        kind === 'profile'
          ? client.requestProfile('41', signal)
          : client.requestParameter('41', rawDefinition, signal),
      ).resolves.toEqual({ status: 'UNCERTAIN', queueIds: [] });
      expect(upstream).toHaveBeenCalledTimes(2);
    },
  );
  it('retains an ambiguous parameter submission without leaking the network error or replaying', async () => {
    upstream
      .mockResolvedValueOnce(Response.json({ session_id: 'fixture-session' }))
      .mockRejectedValueOnce(new Error('private URL with session'));
    await expect(
      client.requestParameter('41', rawDefinition, AbortSignal.timeout(4000)),
    ).resolves.toEqual({ status: 'UNCERTAIN', queueIds: [] });
    expect(upstream).toHaveBeenCalledTimes(2);
  });
  it('rejects multiple definitions or replace-prefixed payloads before transport', () => {
    expect(() =>
      client.requestParameter('41', rawDefinition + rawDefinition, AbortSignal.timeout(4000)),
    ).toThrow('unavailable');
    expect(() =>
      client.requestParameter('41', '01' + rawDefinition, AbortSignal.timeout(4000)),
    ).toThrow('unavailable');
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe('machine authentication for configuration write routes', () => {
  const previous = process.env;
  afterEach(() => {
    process.env = previous;
    jest.restoreAllMocks();
  });
  it('rejects absent or browser session authorization before any provider action', async () => {
    process.env = {
      ...previous,
      KARMA_INTERNAL_TOKEN: 'fixture-internal-secret-with-32-characters',
    };
    const client = new KarmaTransport();
    const targetRead = jest.spyOn(client, 'readConfigurationTarget');
    const module = await Test.createTestingModule({ imports: [DeviceConfigurationModule] })
      .overrideProvider(KarmaTransport)
      .useValue(client)
      .compile();
    const app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    try {
      for (const action of ['profile-request', 'parameter-request', 'profile-observations']) {
        for (const authorization of [
          undefined,
          `Bearer ${issueDemoToken('01000000-0000-4000-8000-000000000001')}`,
        ]) {
          const response = await fetch(`${base}/internal/device-configuration/${action}`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(authorization ? { authorization } : {}),
            },
            body: JSON.stringify(requestInput),
          });
          await response.text();
          expect(response.status).toBe(401);
        }
      }
      expect(targetRead).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
