import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { EdataService } from '../../modules/edata/edata.service.js';
import { KarmaTransport } from './karma-transport.js';

function requestUrl(value: Parameters<typeof fetch>[0]): URL {
  return value instanceof URL ? value : new URL(typeof value === 'string' ? value : value.url);
}

function respond(value: unknown, status = 200) {
  return () => Promise.resolve(Response.json(value, { status }));
}

describe('Karma session transport', () => {
  const previous = process.env;

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    process.env = previous;
  });

  it('renews a rejected session once, sanitizes failures and gives only eData a longer read deadline', async () => {
    const upstream = jest.spyOn(globalThis, 'fetch');
    const unavailable = { error: 'Karma is unavailable; try again later' };
    const login = '/apiv2/login';
    const cars = '/apiv2/cars';
    const rows: {
      row: string;
      credentials: boolean;
      reads: (() => Promise<Response>)[];
      expected: { outcome: unknown; paths: string[]; sessions: string[]; signals: number };
    }[] = [
      {
        row: 'Not logged in once',
        credentials: true,
        reads: [respond({ error: 'Not logged in' }), respond([])],
        expected: {
          outcome: { value: [] },
          paths: [login, cars, login, cars],
          sessions: ['session-1', 'session-2'],
          signals: 1,
        },
      },
      {
        row: 'HTTP 401 without JSON',
        credentials: true,
        reads: [() => Promise.resolve(new Response('Unauthorized', { status: 401 })), respond([])],
        expected: {
          outcome: { value: [] },
          paths: [login, cars, login, cars],
          sessions: ['session-1', 'session-2'],
          signals: 1,
        },
      },
      {
        row: 'rejected twice',
        credentials: true,
        reads: [respond({ error: 'Not logged in' }), respond({ error: 'Not logged in' })],
        expected: {
          outcome: unavailable,
          paths: [login, cars, login, cars],
          sessions: ['session-1', 'session-2'],
          signals: 1,
        },
      },
      {
        row: 'HTTP 503 mentioning login',
        credentials: true,
        reads: [respond({ error: 'Not logged in' }, 503)],
        expected: {
          outcome: unavailable,
          paths: [login, cars],
          sessions: ['session-1'],
          signals: 1,
        },
      },
      {
        row: 'private transport error',
        credentials: true,
        reads: [
          () =>
            Promise.reject(
              new Error('https://karma.test/apiv2/cars?karma_sid=session-1 fixture-password'),
            ),
        ],
        expected: {
          outcome: unavailable,
          paths: [login, cars],
          sessions: ['session-1'],
          signals: 1,
        },
      },
      {
        row: 'missing password',
        credentials: false,
        reads: [],
        expected: { outcome: unavailable, paths: [], sessions: [], signals: 0 },
      },
    ];
    for (const { row, credentials, reads, expected } of rows) {
      process.env = {
        ...previous,
        KARMA_API_URL: 'https://karma.test/apiv2/',
        KARMA_USER: 'fixture-user',
        KARMA_PASSWORD: 'fixture-password',
      };
      if (!credentials) {
        delete process.env.KARMA_PASSWORD;
      }
      let logins = 0;
      const pending = [...reads];
      upstream.mockClear();
      upstream.mockImplementation((input) => {
        if (requestUrl(input).pathname === login) {
          logins++;
          return Promise.resolve(Response.json({ session_id: `session-${String(logins)}` }));
        }
        const next = pending.shift();
        return next ? next() : Promise.reject(new Error('Unexpected Karma read'));
      });
      const outcome = await new KarmaTransport().read('cars', new URLSearchParams()).then(
        (value: unknown) => ({ value }),
        (error: unknown) => ({ error: error instanceof Error ? error.message : 'Unexpected' }),
      );
      const calls = upstream.mock.calls;
      expect({
        row,
        value: {
          outcome,
          paths: calls.map(([input]) => requestUrl(input).pathname),
          sessions: calls.flatMap(([input]) => requestUrl(input).searchParams.getAll('karma_sid')),
          signals: new Set(calls.map(([, init]) => init?.signal)).size,
        },
      }).toEqual({ row, value: expected });
    }

    process.env = {
      ...previous,
      KARMA_API_URL: 'https://karma.test/apiv2/',
      KARMA_USER: 'fixture-user',
      KARMA_PASSWORD: 'fixture-password',
    };
    jest.useFakeTimers();
    jest.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => {
        controller.abort(new DOMException('Timed out', 'TimeoutError'));
      }, milliseconds);
      return controller.signal;
    });
    upstream.mockImplementation((input, init) => {
      if (requestUrl(input).pathname === login) {
        return Promise.resolve(Response.json({ session_id: 'slow-read-session' }));
      }
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve(Response.json([]));
        }, 5540);
        init?.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(new DOMException('Timed out', 'TimeoutError'));
          },
          { once: true },
        );
      });
    });
    const karma = new KarmaTransport();
    const slowEdata = new EdataService(karma)
      .list(
        { carId: '41' },
        { tenantId: '01000000-0000-4000-8000-000000000001', requestId: 'slow-edata' },
      )
      .then(
        (page) => ({ items: page.items, hasMore: page.hasMore }),
        (error: unknown) => ({ error: error instanceof Error ? error.message : 'Unexpected' }),
      );
    await jest.advanceTimersByTimeAsync(5540);
    await expect(slowEdata).resolves.toEqual({ items: [], hasMore: false });
    const slowCars = karma.read('cars', new URLSearchParams()).then(
      () => ({ value: [] }),
      (error: unknown) => ({ error: error instanceof Error ? error.message : 'Unexpected' }),
    );
    await jest.advanceTimersByTimeAsync(5540);
    await expect(slowCars).resolves.toEqual(unavailable);
  });
});
