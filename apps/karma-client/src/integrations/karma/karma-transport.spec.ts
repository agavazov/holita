import { afterEach, describe, expect, it, jest } from '@jest/globals';
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
    process.env = previous;
  });

  it('renews a rejected Karma session at most once per operation and sanitizes every upstream failure', async () => {
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
  });
});
