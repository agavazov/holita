import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { KarmaClient } from './karma-client.js';

const row = {
  car_id: 41,
  device_id: '000123456789012',
  project_id: 12,
  car_number: 'TEST 41',
  car_type: 'Truck',
  car_year: '2020',
  car_color: '',
};

function requestUrl(value: Parameters<typeof fetch>[0] | undefined): string {
  if (typeof value === 'string') return value;
  if (value instanceof URL) return value.href;
  if (value instanceof Request) return value.url;
  throw new Error('Missing upstream request URL');
}

describe('Karma upstream client', () => {
  let client: KarmaClient;
  let upstream: jest.SpiedFunction<typeof fetch>;
  const previous = process.env;
  beforeEach(() => {
    process.env = {
      ...previous,
      KARMA_API_URL: 'https://karma.test/apiv2/',
      KARMA_USER: 'fixture-user',
      KARMA_PASSWORD: 'fixture-password',
    };
    client = new KarmaClient();
    upstream = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = previous;
  });
  function respond(data: unknown, status = 200) {
    return Promise.resolve(Response.json(data, { status }));
  }
  function signIn() {
    upstream.mockImplementationOnce(() => respond({ session_id: 'session-one' }));
  }

  it('fetches all cars, preserves device leading zeros and reuses the account session', async () => {
    signIn();
    upstream.mockImplementationOnce(() => respond([row])).mockImplementationOnce(() => respond([]));
    expect(await client.listCars()).toEqual([
      {
        id: '41',
        deviceId: row.device_id,
        projectId: '12',
        carNumber: 'TEST 41',
        carType: 'Truck',
        carYear: '2020',
        carColor: '',
        subType: null,
        timeZoneId: null,
        driverCount: null,
      },
    ]);
    expect(await client.listCars()).toEqual([]);
    expect(upstream).toHaveBeenCalledTimes(3);
    const [loginUrl, loginOptions] = upstream.mock.calls[0] ?? [];
    expect(requestUrl(loginUrl)).toBe('https://karma.test/apiv2/login');
    expect(loginOptions?.body).toBe(
      JSON.stringify({ user: 'fixture-user', password: 'fixture-password' }),
    );
    const carsUrl = new URL(requestUrl(upstream.mock.calls[1]?.[0]));
    expect([...carsUrl.searchParams.keys()]).toEqual(['karma_sid']);
    expect(carsUrl.searchParams.get('karma_sid')).toBe('session-one');
  });

  it('shares a pending login across concurrent list requests', async () => {
    let release: (value: Response) => void = () => {};
    upstream.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    upstream.mockImplementation(() => respond([row]));
    const first = client.listCars();
    const second = client.listCars();
    expect(upstream).toHaveBeenCalledTimes(1);
    release(Response.json({ session_id: 'shared-session' }));
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(
      upstream.mock.calls.filter((call) => requestUrl(call[0]).endsWith('/login')),
    ).toHaveLength(1);
  });

  it('reads one truck by ID and shares the session with the list', async () => {
    signIn();
    upstream
      .mockImplementationOnce(() =>
        respond([{ ...row, sub_type: 'Trailer', time_zone: 8, driver_ids: [] }]),
      )
      .mockImplementationOnce(() => respond([row]));
    await expect(client.getCar('41')).resolves.toMatchObject({
      id: '41',
      deviceId: row.device_id,
      subType: 'Trailer',
      timeZoneId: 8,
      driverCount: 0,
    });
    expect(new URL(requestUrl(upstream.mock.calls[1]?.[0])).pathname).toBe('/apiv2/cars/41');
    await client.listCars();
    expect(upstream).toHaveBeenCalledTimes(3);
  });

  it.each(['../login', '0', '01', '9007199254740992'])(
    'rejects invalid truck ID %s before contacting Karma',
    async (id) => {
      await expect(client.getCar(id)).rejects.toThrow('Invalid Karma car ID');
      expect(upstream).not.toHaveBeenCalled();
    },
  );

  it.each([200, 404])('returns null for a missing truck with HTTP %i', async (status) => {
    signIn();
    upstream.mockImplementationOnce(() => respond([], status));
    await expect(client.getCar('41')).resolves.toBeNull();
  });

  it.each([{ data: [{ ...row, car_id: 42 }] }, { data: [row, { ...row, car_id: 42 }] }])(
    'rejects a mismatched detail response',
    async ({ data }) => {
      signIn();
      upstream.mockImplementationOnce(() => respond(data));
      await expect(client.getCar('41')).rejects.toThrow('Karma is unavailable');
    },
  );

  it('renews an expired session for a detail read', async () => {
    signIn();
    upstream
      .mockImplementationOnce(() => respond({ error: 'Not logged in' }))
      .mockImplementationOnce(() => respond({ session_id: 'session-two' }))
      .mockImplementationOnce(() => respond([row]));
    await expect(client.getCar('41')).resolves.toMatchObject({ id: '41' });
    expect(upstream).toHaveBeenCalledTimes(4);
  });

  it.each([200, 401])(
    'renews an expired session once when Karma responds with HTTP %i',
    async (status) => {
      signIn();
      upstream
        .mockImplementationOnce(() => respond({ error: 'Not logged in' }, status))
        .mockImplementationOnce(() => respond({ session_id: 'session-two' }))
        .mockImplementationOnce(() => respond([row]));
      await expect(client.listCars()).resolves.toHaveLength(1);
      expect(new URL(requestUrl(upstream.mock.calls[3]?.[0])).searchParams.get('karma_sid')).toBe(
        'session-two',
      );
      const signals = upstream.mock.calls.map((call) => call[1]?.signal);
      expect(signals.every((signal) => signal === signals[0])).toBe(true);
    },
  );

  it('stops after a second expired-session response', async () => {
    signIn();
    upstream
      .mockImplementationOnce(() => respond({ error: 'Not logged in' }))
      .mockImplementationOnce(() => respond({ session_id: 'session-two' }))
      .mockImplementationOnce(() => respond({ error: 'Not logged in' }));
    await expect(client.listCars()).rejects.toThrow('Karma is unavailable');
    expect(upstream).toHaveBeenCalledTimes(4);
  });

  it('renews an HTTP 401 session even when the upstream body is not JSON', async () => {
    signIn();
    upstream
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockImplementationOnce(() => respond({ session_id: 'session-two' }))
      .mockImplementationOnce(() => respond([row]));
    await expect(client.listCars()).resolves.toHaveLength(1);
  });

  it.each([
    { error: 'Account blocked' },
    [null],
    [{ ...row, device_id: 123 }],
    [{ ...row, car_id: 1.5 }],
    [row, row],
  ])('rejects invalid upstream data without exposing its contents: %j', async (data) => {
    signIn();
    upstream.mockImplementationOnce(() => respond(data));
    await expect(client.listCars()).rejects.toThrow('Karma is unavailable');
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it('normalizes numeric years and absent optional fields', async () => {
    signIn();
    upstream.mockImplementationOnce(() =>
      respond([{ car_id: 1, project_id: 1, device_id: '', car_number: '', car_year: 2021 }]),
    );
    expect(await client.listCars()).toMatchObject([
      { carYear: '2021', carType: null, carColor: null },
    ]);
  });

  it('recovers after a failed login and sanitizes transport errors', async () => {
    upstream.mockRejectedValueOnce(new Error('secret session-one fixture-password'));
    await expect(client.listCars()).rejects.toThrow('Karma is unavailable; try again later');
    signIn();
    upstream.mockImplementationOnce(() => respond([row]));
    await expect(client.listCars()).resolves.toHaveLength(1);
  });

  it.each(['login', 'cars'])('cancels a stalled HTTP error body during %s', async (endpoint) => {
    let cancelled = false;
    const body = new ReadableStream({
      cancel() {
        cancelled = true;
      },
    });
    if (endpoint === 'cars') signIn();
    upstream.mockResolvedValueOnce(new Response(body, { status: 503 }));
    await expect(client.listCars()).rejects.toThrow('Karma is unavailable');
    expect(cancelled).toBe(true);
    expect(upstream).toHaveBeenCalledTimes(endpoint === 'cars' ? 2 : 1);
  });

  it('does not renew the account session for an HTTP 503 body mentioning login', async () => {
    signIn();
    upstream.mockImplementationOnce(() => respond({ error: 'Not logged in' }, 503));
    await expect(client.listCars()).rejects.toThrow('Karma is unavailable');
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it('does not call Karma when credentials are missing', async () => {
    delete process.env.KARMA_PASSWORD;
    await expect(client.listCars()).rejects.toThrow('Karma is unavailable');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('bounds a stalled upstream read', async () => {
    signIn();
    const controller = new AbortController();
    jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    let started: () => void = () => {};
    const reading = new Promise<void>((resolve) => {
      started = resolve;
    });
    upstream.mockImplementationOnce(
      (_url, options) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => {
              reject(new Error('timeout'));
            },
            {
              once: true,
            },
          );
          started();
        }),
    );
    const result = client.listCars();
    await reading;
    controller.abort();
    await expect(result).rejects.toThrow('Karma is unavailable');
  });
});
