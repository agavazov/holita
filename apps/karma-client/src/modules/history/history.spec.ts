import { CarsService } from '../cars/cars.service.js';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';

import { HistoryService } from './history.service.js';
import { historyQuery, historyParameters, profileParameters } from './history-query.js';
import { tripsPage, eventsPage, drivingProfile, drivingCategories } from './history-response.js';

const signedContext = { tenantId: 'tenant-a', requestId: 'test' };
function trip(id = 4000000001) {
  return {
    trip_id: id,
    car_id: 41,
    car_number: 'TEST 41',
    device_id: '000123456789012',
    driver_id: null,
    trip_active: 0,
    start_message_id: 3000000001,
    start_date: '2026-01-01 00:00:00',
    start_latitude: 0,
    start_longitude: 0,
    start_odo: 0,
    stop_message_id: null,
    stop_date: null,
    stop_latitude: null,
    stop_longitude: null,
    stop_odo: null,
    trip_duration: 0,
    trip_distance: 0,
    trip_duration_night: 0,
    trip_distance_night: 0,
    max_speed: 0,
    driving_score: 0,
    eco_score: 0,
  };
}
function event(id = 3000000001) {
  return {
    message_id: id,
    car_id: 41,
    device_id: '000123456789012',
    eid: 0,
    edt: '2026-01-01 00:00:00',
    edt_tz: null,
    pdt: null,
    latitude: 0,
    longitude: 0,
    spd: 0,
    odo: 0,
    extra: '<script>plain text</script>',
  };
}
function profile() {
  return {
    car_id: 41,
    car_number: 'TEST 41',
    device_id: '000123456789012',
    score: Object.fromEntries(
      drivingCategories.map((name, index) => [name, { score: index % 2 ? 0 : null, weight: 0 }]),
    ),
  };
}
function url(value: Parameters<typeof fetch>[0]): URL {
  return value instanceof URL
    ? value
    : typeof value === 'string'
      ? new URL(value)
      : new URL(value.url);
}
describe('Karma history contracts', () => {
  it('maps all trip fields and nullable active-trip stops without inferring units', () => {
    const page = tripsPage([trip()], historyQuery({ carId: '41' }, 'trips'));
    expect(Object.keys(page.items[0] ?? {})).toHaveLength(23);
    expect(page.items[0]).toMatchObject({
      id: '4000000001',
      driverId: null,
      stopDate: null,
      tripDistance: 0,
      deviceId: '000123456789012',
    });
  });
  it('maps all twelve event fields and preserves code zero and plain text', () => {
    const page = eventsPage([event()], historyQuery({ carId: '41' }, 'events'));
    expect(Object.keys(page.items[0] ?? {})).toHaveLength(12);
    expect(page.items[0]).toMatchObject({
      eventId: '0',
      extra: '<script>plain text</script>',
      latitude: 0,
      edtTz: null,
    });
  });
  it.each(['trips', 'events'] as const)(
    'walks 600 %s rows without skips or overlap and freezes a snapshot',
    (kind) => {
      const source = Array.from({ length: 600 }, (_, i) =>
        kind === 'trips' ? trip(4000000001 + i) : event(3000000001 + i),
      );
      let input: { carId: string; cursor?: string | null } = { carId: '41' };
      const seen: string[] = [];
      for (let i = 0; i < 12; i++) {
        const query = historyQuery(input, kind),
          rows = source
            .filter(
              (row) =>
                ('trip_id' in row ? row.trip_id : row.message_id) <=
                (query.before ?? Number.MAX_SAFE_INTEGER),
            )
            .slice(-500);
        const page = kind === 'trips' ? tripsPage(rows, query) : eventsPage(rows, query);
        expect(page.items).toHaveLength(50);
        seen.push(...page.items.map((row) => row.id));
        input = { carId: '41', cursor: page.nextCursor };
        expect(page.hasMore).toBe(i < 11);
      }
      expect(new Set(seen).size).toBe(600);
      const first =
        kind === 'trips'
          ? tripsPage(source.slice(-500), historyQuery({ carId: '41' }, kind))
          : eventsPage(source.slice(-500), historyQuery({ carId: '41' }, kind));
      expect(() => historyQuery({ carId: '42', cursor: first.cursor }, kind)).toThrow('Invalid');
      expect(() =>
        historyQuery({ carId: '41', cursor: first.cursor }, kind === 'events' ? 'trips' : 'events'),
      ).toThrow('Invalid');
    },
  );
  it.each([0, 25, 50, 100])('handles a terminal source of %i rows', (count) => {
    const page = eventsPage(
      Array.from({ length: count }, (_, i) => event(3000000001 + i)),
      historyQuery({ carId: '41', pageSize: 100 }, 'events'),
    );
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(count);
  });
  it.each([
    { carId: '../login' },
    { carId: '41', pageSize: 49 },
    { carId: '41', fromDate: '2026-02-30T00:00:00Z', toDate: '2026-03-01T00:00:00Z' },
    { carId: '41', fromDate: '2026-01-01T00:00:00Z' },
    { carId: '41', eventTypes: ['-1'] },
    { carId: '41', cursor: 'bad' },
  ])('rejects invalid input before transport', (input) => {
    expect(() => historyQuery(input, 'events')).toThrow('Invalid');
  });
  it('encodes wall-clock trip/profile periods and UTC event periods without browser conversion', () => {
    expect(
      Object.fromEntries(
        profileParameters({
          carId: '41',
          fromDate: '2026-01-01T00:00:00',
          toDate: '2026-01-08T00:00:00',
        }),
      ),
    ).toMatchObject({ from_date: '2026-01-01 00:00:00' });
    const params = historyParameters(
      historyQuery(
        {
          carId: '41',
          eventTypes: ['33', '0', '33'],
          fromDate: '2026-01-01T00:00:00Z',
          toDate: '2026-01-08T00:00:00Z',
        },
        'events',
      ),
    );
    expect(params.getAll('event_type[]')).toEqual(['0', '33']);
    expect(params.get('date_type')).toBe('utc');
    expect(params.has('decode')).toBe(false);
    expect(() =>
      profileParameters({
        carId: '41',
        fromDate: '2026-01-01T00:00:00Z',
        toDate: '2026-01-08T00:00:00Z',
      }),
    ).toThrow('Invalid');
  });
  it.each([
    { rows: [event(), event()] },
    { rows: [event(2), event(1)] },
    { rows: [{ ...event(), car_id: 42 }] },
    { rows: [{ ...event(), spd: Infinity }] },
    { rows: [{ ...event(), extra: {} }] },
    { rows: [{ ...event(), message_id: 9007199254740992 }] },
  ])('rejects malformed or mismatched event batches', ({ rows }) => {
    expect(() => eventsPage(rows, historyQuery({ carId: '41' }, 'events'))).toThrow('unavailable');
  });
  it('rejects upstream business errors, ignored cursor and event/date filters', () => {
    expect(() => tripsPage({ error: 'private' }, historyQuery({ carId: '41' }, 'trips'))).toThrow(
      'unavailable',
    );
    expect(() =>
      eventsPage([event()], historyQuery({ carId: '41', eventTypes: ['33'] }, 'events')),
    ).toThrow('unavailable');
    expect(() =>
      eventsPage(
        [event()],
        historyQuery(
          { carId: '41', fromDate: '2026-01-02T00:00:00Z', toDate: '2026-01-03T00:00:00Z' },
          'events',
        ),
      ),
    ).toThrow('unavailable');
    const page = eventsPage([event(1), event(2)], historyQuery({ carId: '41' }, 'events'));
    const query = historyQuery({ carId: '41', cursor: page.cursor }, 'events');
    expect(() => eventsPage([event(3)], query)).toThrow('unavailable');
  });
  it('preserves nine profile scores, zero/null and identity without a combined rating', () => {
    expect(drivingProfile([], '41')).toBeNull();
    expect(drivingProfile([profile()], '41')).toMatchObject({
      deviceId: '000123456789012',
      categories: expect.arrayContaining([
        { name: 'accelerations', score: null, weight: 0 },
        { name: 'brakes', score: 0, weight: 0 },
      ]),
    });
    expect(drivingProfile([profile()], '41')?.categories).toHaveLength(9);
    expect(() => drivingProfile([{ ...profile(), score: {} }], '41')).toThrow('unavailable');
    expect(() => drivingProfile([profile()], '42')).toThrow('unavailable');
  });
});
describe('authenticated bounded Karma history transport', () => {
  let client: KarmaTransport, upstream: jest.SpiedFunction<typeof fetch>;
  let history: HistoryService;
  const previous = process.env;
  beforeEach(() => {
    process.env = {
      ...previous,
      KARMA_API_URL: 'https://karma.test/apiv2/',
      KARMA_USER: 'fixture-user',
      KARMA_PASSWORD: 'fixture-password',
    };
    client = new KarmaTransport();
    history = new HistoryService(client, new CarsService(client));
    upstream = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = previous;
  });
  const car = { car_id: 41, project_id: 12, device_id: '000123456789012', car_number: 'TEST 41' };
  function respond(value: unknown) {
    return Promise.resolve(Response.json(value));
  }
  function start() {
    upstream
      .mockImplementationOnce(() => respond({ session_id: 'fixture-session' }))
      .mockImplementationOnce(() => respond([car]));
  }
  it('shares one abort budget across login, car, trip read and lookahead for a truncated source', async () => {
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    start();
    upstream
      .mockImplementationOnce(() => respond([trip(5), trip(6)]))
      .mockImplementationOnce(() => respond([trip(3), trip(4)]));
    const page = await history.trips({ carId: '41' }, signedContext);
    expect(page).toMatchObject({ hasMore: true, items: [{ id: '6' }, { id: '5' }] });
    expect(historyQuery({ carId: '41', cursor: page.nextCursor }, 'trips').before).toBe(4);
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(4000);
    expect(new Set(upstream.mock.calls.map((call) => call[1]?.signal)).size).toBe(1);
    expect(
      upstream.mock.calls.every(
        (call) => call[1]?.method === undefined || call[1].method === 'POST',
      ),
    ).toBe(true);
    expect(
      url(upstream.mock.calls[3]?.[0] ?? 'https://missing.test').searchParams.get('to_id'),
    ).toBe('4');
  });
  it('distinguishes missing cars and empty history without contacting a missing car endpoint', async () => {
    upstream
      .mockImplementationOnce(() => respond({ session_id: 'fixture-session' }))
      .mockImplementationOnce(() => respond([]));
    expect(await history.events({ carId: '999' }, signedContext)).toMatchObject({
      items: [],
      hasMore: false,
    });
    expect(upstream).toHaveBeenCalledTimes(2);
  });
  it('renews the session once within the existing budget and sends fixed GET event fields', async () => {
    start();
    upstream
      .mockImplementationOnce(() => respond({ error: 'Not logged in' }))
      .mockImplementationOnce(() => respond({ session_id: 'renewed' }))
      .mockImplementationOnce(() => respond([event()]));
    expect(await history.events({ carId: '41', eventTypes: ['0'] }, signedContext)).toMatchObject({
      items: [{ eventId: '0' }],
    });
    const call = upstream.mock.calls.at(-1);
    if (!call) throw new Error('Missing read');
    expect(url(call[0]).pathname).toBe('/apiv2/events');
    expect(url(call[0]).searchParams.getAll('fields[]')).toEqual(['spd', 'odo', 'edt_tz', 'pdt']);
    expect(url(call[0]).searchParams.getAll('event_type[]')).toEqual(['0']);
    expect(new Set(upstream.mock.calls.map((entry) => entry[1]?.signal)).size).toBe(1);
  });
  it('sanitizes transport failures without leaking a private URL', async () => {
    upstream.mockRejectedValue(new Error('https://private.test/?karma_sid=secret'));
    await expect(history.events({ carId: '41' }, signedContext)).rejects.toThrow(
      'Karma is unavailable',
    );
  });
  it('authenticates each concrete service method before input validation or upstream access', () => {
    const service = new HistoryService(client, new CarsService(client)),
      context = { tenantId: undefined, requestId: 'test' };
    expect(() => service.trips({ carId: '../login' }, context)).toThrow('Sign in');
    expect(() => service.events({ carId: '../login' }, context)).toThrow('Sign in');
    expect(() => service.profile({ carId: '../login', fromDate: '', toDate: '' }, context)).toThrow(
      'Sign in',
    );
    expect(upstream).not.toHaveBeenCalled();
  });
});
