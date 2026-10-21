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

  it('uses one fixed internal endpoint and a machine token, preserving opaque target identity', async () => {
    upstream.mockResolvedValue(Response.json({ carId: '41', deviceId: '000-opaque' }));
    await expect(client.target('41')).resolves.toEqual({ carId: '41', deviceId: '000-opaque' });
    const call = upstream.mock.calls[0];
    const url = call?.[0];
    expect(url instanceof URL ? url.href : url).toBe(
      'http://127.0.0.1:11014/internal/device-configuration/target',
    );
    expect(call?.[1]).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { authorization: 'Bearer unit-test-token-with-at-least-32-characters' },
      body: '{"carId":"41"}',
    });
  });

  it('never replays a command submission after transport failure', async () => {
    upstream.mockRejectedValue(new Error('private upstream URL or token'));
    await expect(client.request('41', 'device')).rejects.toThrow(
      'Device configuration reading is unavailable',
    );
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('keeps profile and single-definition commands on their fixed machine endpoints without replay', async () => {
    upstream.mockResolvedValueOnce(Response.json({ status: 'ACCEPTED', queueIds: ['15'] }));
    await client.requestProfile('41', 'opaque');
    const profileUrl = upstream.mock.calls[0]?.[0];
    expect(profileUrl instanceof URL ? profileUrl.pathname : profileUrl).toBe(
      '/internal/device-configuration/profile-request',
    );
    upstream.mockRejectedValueOnce(new Error('ambiguous write'));
    const definition = '030D0000000000000001000100000000000000000000';
    await expect(client.requestParameter('41', 'opaque', 781, 0, definition)).rejects.toMatchObject(
      { code: 'KARMA_UNAVAILABLE' },
    );
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(upstream.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({
        carId: '41',
        expectedDeviceId: 'opaque',
        parameterId: 781,
        reportingIntervalSeconds: 0,
        rawDefinition: definition,
      }),
    );
  });

  it('passes the parameter-only event watermark and validates separate fresh profile evidence', async () => {
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    upstream.mockResolvedValueOnce(
      Response.json({
        coverageComplete: true,
        readback: { status: 'ABSENT', configurationId: null, parameters: [] },
        observations: [],
      }),
    );
    await client.observations('41', 'opaque', new Date(0), new Date(1000), '101');
    expect(upstream.mock.calls[0]?.[1]?.body).toContain('"afterMessageId":"101"');
    const data = {
      coverageComplete: true,
      readback: { status: 'COMPLETE', profileId: 343 },
      observations: [
        {
          messageId: '102',
          eventTimeUtc: new Date(1000).toISOString(),
          rawMessage: '19,0,416,0,1,1,8,1F0157',
          configurationId: '8',
          messageNumber: 1,
          lastMessage: true,
          profileId: 343,
        },
      ],
    };
    upstream.mockResolvedValueOnce(Response.json(data));
    await expect(
      client.profileObservations('41', 'opaque', new Date(0), new Date(1000)),
    ).resolves.toEqual(data);
    expect(upstream.mock.calls[1]?.[1]?.body).not.toContain('afterMessageId');
    expect(timeout.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([21000, 21000]);
    upstream.mockResolvedValueOnce(
      Response.json({ ...data, observations: [{ ...data.observations[0], profileId: -1 }] }),
    );
    await expect(
      client.profileObservations('41', 'opaque', new Date(0), new Date(1000)),
    ).rejects.toMatchObject({ code: 'INVALID_READBACK' });
  });

  it('distinguishes target changes and validates the numeric queue reference', async () => {
    upstream.mockResolvedValueOnce(new Response(null, { status: 409 }));
    await expect(client.request('41', 'device')).rejects.toMatchObject({ code: 'TARGET_CHANGED' });
    upstream.mockResolvedValueOnce(Response.json({ status: 'ACCEPTED', queueIds: ['bad'] }));
    await expect(client.request('41', 'device')).rejects.toMatchObject({
      code: 'INVALID_READBACK',
    });
  });

  it('rejects absent secrets and unsafe internal URLs without connecting', async () => {
    delete process.env.KARMA_INTERNAL_TOKEN;
    await expect(client.target('41')).rejects.toMatchObject({ code: 'KARMA_UNAVAILABLE' });
    process.env.KARMA_INTERNAL_TOKEN = 'unit-test-token-with-at-least-32-characters';
    process.env.FLEET_KARMA_INTERNAL_URL = 'http://user:secret@127.0.0.1:11014';
    await expect(client.target('41')).rejects.toMatchObject({ code: 'KARMA_UNAVAILABLE' });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('validates definition length, ID and interval before accepting readback', async () => {
    const rawDefinition = '0296' + '0'.repeat(36) + '001E';
    const data = {
      coverageComplete: true,
      readback: {
        status: 'COMPLETE',
        configurationId: '01',
        parameters: [{ parameterId: 662, reportingIntervalSeconds: 30, rawDefinition }],
      },
      observations: [],
    };
    upstream.mockResolvedValueOnce(Response.json(data));
    await expect(client.observations('41', 'device', new Date(0), new Date(1000))).resolves.toEqual(
      data,
    );
    upstream.mockResolvedValueOnce(
      Response.json({
        ...data,
        readback: {
          ...data.readback,
          parameters: [{ parameterId: 662, reportingIntervalSeconds: 60, rawDefinition }],
        },
      }),
    );
    await expect(
      client.observations('41', 'device', new Date(0), new Date(1000)),
    ).rejects.toMatchObject({ code: 'INVALID_READBACK' });
  });

  it('allows the worker observation deadline while keeping target and command calls short', async () => {
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    upstream
      .mockResolvedValueOnce(Response.json({ carId: '41', deviceId: 'device' }))
      .mockResolvedValueOnce(Response.json({ status: 'ACCEPTED', queueIds: ['9'] }))
      .mockResolvedValueOnce(
        Response.json({
          coverageComplete: true,
          readback: { status: 'ABSENT', configurationId: null, parameters: [] },
          observations: [],
        }),
      );
    await client.target('41');
    await client.request('41', 'device');
    await client.observations('41', 'device', new Date(0), new Date(1000));
    expect(timeout.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([4500, 4500, 21000]);
  });
});
