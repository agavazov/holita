import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { KarmaDeviceReadsClient } from './karma-device-reads.client.js';

describe('Fleet to Karma device-read transport', () => {
  const originalToken = process.env.KARMA_INTERNAL_TOKEN;
  const originalUrl = process.env.FLEET_KARMA_INTERNAL_URL;
  let upstream: jest.SpiedFunction<typeof fetch>;
  const client = new KarmaDeviceReadsClient();
  beforeEach(() => {
    process.env.KARMA_INTERNAL_TOKEN = 'unit-test-token-with-at-least-32-characters';
    delete process.env.FLEET_KARMA_INTERNAL_URL;
    upstream = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalToken === undefined) {
      delete process.env.KARMA_INTERNAL_TOKEN;
    } else {
      process.env.KARMA_INTERNAL_TOKEN = originalToken;
    }
    if (originalUrl === undefined) {
      delete process.env.FLEET_KARMA_INTERNAL_URL;
    } else {
      process.env.FLEET_KARMA_INTERNAL_URL = originalUrl;
    }
  });

  it('never replays a command submission after transport failure', async () => {
    // Every unplanned call fails, so a replay would show up as an extra call.
    upstream.mockRejectedValue(new Error('private upstream URL or token'));
    await expect(client.request('41', 'device')).rejects.toThrow(
      'Device configuration reading is unavailable',
    );
    expect(upstream).toHaveBeenCalledTimes(1);
    upstream.mockResolvedValueOnce(Response.json({ status: 'ACCEPTED', queueIds: ['15'] }));
    await client.requestProfile('41', 'opaque');
    const profileUrl = upstream.mock.calls[1]?.[0];
    expect(profileUrl instanceof URL ? profileUrl.pathname : profileUrl).toBe(
      '/internal/device-configuration/profile-request',
    );
    const definition = '030D0000000000000001000100000000000000000000';
    await expect(client.requestParameter('41', 'opaque', 781, 0, definition)).rejects.toMatchObject(
      { code: 'KARMA_UNAVAILABLE' },
    );
    expect(upstream).toHaveBeenCalledTimes(3);
    expect(upstream.mock.calls[2]?.[1]?.body).toBe(
      JSON.stringify({
        carId: '41',
        expectedDeviceId: 'opaque',
        parameterId: 781,
        reportingIntervalSeconds: 0,
        rawDefinition: definition,
      }),
    );
  });
});
