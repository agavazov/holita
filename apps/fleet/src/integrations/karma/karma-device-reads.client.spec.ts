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
    const rule = '00010000000000010707021502CE0F0A';
    await expect(client.requestRule('41', 'opaque', 1, rule)).rejects.toMatchObject({
      code: 'KARMA_UNAVAILABLE',
    });
    expect(upstream).toHaveBeenCalledTimes(4);
    expect(upstream.mock.calls[3]?.[1]?.body).toBe(
      JSON.stringify({ carId: '41', expectedDeviceId: 'opaque', ruleId: 1, rawDefinition: rule }),
    );
    upstream.mockResolvedValueOnce(Response.json({ status: 'ACCEPTED', queueIds: ['16'] }));
    await client.requestRules('41', 'opaque');
    const rulesUrl = upstream.mock.calls[4]?.[0];
    expect(rulesUrl instanceof URL ? rulesUrl.pathname : rulesUrl).toBe(
      '/internal/device-configuration/rules-request',
    );
    const opaque = { ruleId: 2, rawDefinition: '000200000000800101FF' };
    upstream.mockResolvedValueOnce(
      Response.json({
        coverageComplete: true,
        readback: { status: 'COMPLETE', configurationId: '8', rules: [opaque] },
        observations: [
          {
            messageId: '17',
            eventTimeUtc: '2026-10-25T10:00:00.000Z',
            rawMessage: `19,0,402,0,1,1,8,08${opaque.rawDefinition}`,
            configurationId: '8',
            messageNumber: 1,
            lastMessage: true,
            rules: [opaque],
          },
        ],
      }),
    );
    expect(
      await client.rulesObservations(
        '41',
        'opaque',
        new Date('2026-10-25T10:00:00.000Z'),
        new Date('2026-10-25T10:01:00.000Z'),
        '16',
      ),
    ).toMatchObject({
      readback: { status: 'COMPLETE', rules: [opaque] },
      observations: [{ rules: [opaque] }],
    });
    const terminalResponse = {
      messageId: '18',
      eventTimeUtc: '2026-10-25T10:00:00.000Z',
      rawMessage: '19,0,154,0',
    };
    for (const read of [
      () => client.observations('41', 'opaque', new Date(), new Date()),
      () => client.rulesObservations('41', 'opaque', new Date(), new Date()),
    ]) {
      for (const [terminal, valid] of [
        [terminalResponse, true],
        [{ ...terminalResponse, messageId: '0' }, false],
        [{ ...terminalResponse, eventTimeUtc: 'invalid' }, false],
        [{ ...terminalResponse, rawMessage: '19,0,154,1' }, false],
      ] satisfies [unknown, boolean][]) {
        upstream.mockResolvedValueOnce(
          Response.json({
            coverageComplete: true,
            readback: { status: 'ABSENT', configurationId: null, rules: [], parameters: [] },
            observations: [],
            terminalResponse: terminal,
          }),
        );
        if (valid) {
          expect(await read()).toMatchObject({ terminalResponse });
        } else {
          await expect(read()).rejects.toMatchObject({ code: 'INVALID_READBACK' });
        }
      }
    }
  });
});
