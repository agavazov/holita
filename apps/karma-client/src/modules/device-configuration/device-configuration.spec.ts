import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { issueDemoToken } from '../../auth/demo-auth.js';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { DeviceConfigurationModule } from './device-configuration.module.js';

const deviceId = '000123456789012';
const target = { car_id: 41, project_id: 12, device_id: deviceId, car_number: 'TEST 41' };

describe('internal machine authentication', () => {
  const previous = process.env;
  afterEach(() => {
    process.env = previous;
    jest.restoreAllMocks();
  });

  it('internal device-configuration routes require the machine secret before validation or provider access', async () => {
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
    async function post(route: string, authorization: string | undefined, body: unknown) {
      const response = await fetch(`${base}/internal/device-configuration/${route}`, {
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
      for (const route of [
        'target',
        'request',
        'profile-request',
        'parameter-request',
        'observations',
        'profile-observations',
      ]) {
        for (const [label, authorization] of [
          ['no authorization', undefined],
          ['wrong secret', 'Bearer wrong'],
          [
            'browser demo session',
            `Bearer ${issueDemoToken('01000000-0000-4000-8000-000000000001')}`,
          ],
        ] satisfies [string, string | undefined][]) {
          const row = `${route} with ${label}`;
          const { status } = await post(route, authorization, { carId: '../login' });
          expect({ row, value: status }).toEqual({ row, value: 401 });
        }
      }
      expect(read).not.toHaveBeenCalled();
      expect(await post('target', `Bearer ${internalToken}`, { carId: '41' })).toEqual({
        status: 200,
        data: { carId: '41', deviceId, carNumber: 'TEST 41' },
      });
      delete process.env.KARMA_INTERNAL_TOKEN;
      expect((await post('target', 'Bearer wrong', { carId: '41' })).status).toBe(503);
      expect(read).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
});
