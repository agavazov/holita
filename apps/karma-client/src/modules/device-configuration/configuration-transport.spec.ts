import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';

function url(value: Parameters<typeof fetch>[0]): URL {
  return value instanceof URL ? value : new URL(typeof value === 'string' ? value : value.url);
}

describe('fixed eData configuration request transport', () => {
  const previous = process.env;
  let upstream: jest.SpiedFunction<typeof fetch>;
  let transport: KarmaTransport;
  beforeEach(() => {
    process.env = {
      ...previous,
      KARMA_API_URL: 'https://karma.test/apiv2/',
      KARMA_USER: 'fixture-user',
      KARMA_PASSWORD: 'fixture-password',
    };
    upstream = jest.spyOn(globalThis, 'fetch');
    transport = new KarmaTransport();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = previous;
  });

  it('submits only the fixed parameter-definition read command to one car', async () => {
    upstream
      .mockResolvedValueOnce(Response.json({ session_id: 'fixture-session' }))
      .mockResolvedValueOnce(Response.json([12]));
    const signal = AbortSignal.timeout(4000);
    await expect(transport.requestConfiguration('41', signal)).resolves.toEqual({
      status: 'ACCEPTED',
      queueIds: ['12'],
    });
    const call = upstream.mock.calls[1];
    if (!call) {
      throw new Error('Expected fixed read submission');
    }
    expect(url(call[0]).pathname).toBe('/apiv2/commands');
    expect(url(call[0]).search).toBe('');
    expect(call[1]?.method).toBe('POST');
    expect(call[1]?.body).toBe(
      JSON.stringify({
        car_id: ['41'],
        message: '30,1,19,0,19,301,0,1,1,0702BC',
        karma_sid: 'fixture-session',
      }),
    );
    expect(upstream.mock.calls.every(([, options]) => options?.signal === signal)).toBe(true);
  });

  it.each([401, 500])('does not replay a submission after HTTP %i', async (status) => {
    upstream
      .mockResolvedValueOnce(Response.json({ session_id: 'fixture-session' }))
      .mockResolvedValueOnce(new Response('private provider error', { status }));
    await expect(transport.requestConfiguration('41', AbortSignal.timeout(4000))).resolves.toEqual({
      status: 'UNCERTAIN',
      queueIds: [],
    });
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it.each([{ error: 'Not logged in' }, { error: 'private' }, [], [0], [1, 1], ['1']])(
    'does not replay an unknown provider result',
    async (data) => {
      upstream
        .mockResolvedValueOnce(Response.json({ session_id: 'fixture-session' }))
        .mockResolvedValueOnce(Response.json(data));
      await expect(
        transport.requestConfiguration('41', AbortSignal.timeout(4000)),
      ).resolves.toEqual({ status: 'UNCERTAIN', queueIds: [] });
      expect(upstream).toHaveBeenCalledTimes(2);
    },
  );

  it('keeps a lost response uncertain and sanitizes network diagnostics', async () => {
    upstream
      .mockResolvedValueOnce(Response.json({ session_id: 'fixture-session' }))
      .mockRejectedValueOnce(new Error('https://private.test/?karma_sid=private-session'));
    expect(
      JSON.stringify(await transport.requestConfiguration('41', AbortSignal.timeout(4000))),
    ).not.toContain('private');
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it('sanitizes login failure before any command is dispatched', async () => {
    upstream.mockRejectedValueOnce(new Error('private credential URL'));
    await expect(transport.requestConfiguration('41', AbortSignal.timeout(4000))).rejects.toThrow(
      'Karma is unavailable',
    );
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized internal observation bodies without exposing their content', async () => {
    upstream
      .mockResolvedValueOnce(Response.json({ session_id: 'fixture-session' }))
      .mockResolvedValueOnce(new Response('x'.repeat(2097153)));
    await expect(
      transport.readConfigurationEvents(new URLSearchParams(), AbortSignal.timeout(4000)),
    ).rejects.toThrow('Karma is unavailable');
  });

  it('keeps a public read on its own deadline when it joins a slower background login', async () => {
    jest.useFakeTimers();
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => {
        controller.abort();
      }, milliseconds);
      return controller.signal;
    });
    upstream
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve(Response.json({ session_id: 'fixture-session' }));
            }, 6000);
          }),
      )
      .mockResolvedValueOnce(Response.json([{ car_id: 41 }]));
    try {
      const background = transport.readConfigurationTarget('41', AbortSignal.timeout(20000));
      const publicRead = expect(transport.read('cars', new URLSearchParams())).rejects.toThrow(
        'Karma is unavailable',
      );
      await jest.advanceTimersByTimeAsync(4000);
      await publicRead;
      expect(upstream).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(2000);
      await expect(background).resolves.toEqual([{ car_id: 41 }]);
      expect(upstream).toHaveBeenCalledTimes(2);
      expect(timeout.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([20000, 4000]);
      expect(url(upstream.mock.calls[1]?.[0] ?? 'https://missing.test').pathname).toBe(
        '/apiv2/cars/41',
      );
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
