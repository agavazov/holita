import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { KarmaClient } from '../cars/karma-client.js';
import { LocationService } from './location.service.js';
import { ReferencesService } from '../references/references.service.js';
import { location } from './location-response.js';
import { projects, timeZones, version } from '../references/references-response.js';

const car = { car_id: 41, project_id: 12, device_id: '000123456789012', car_number: 'TEST 41' };
const position = {
  car_id: 41,
  device_id: car.device_id,
  carnumber: car.car_number,
  message_id: 3000000001,
  eid: 0,
  edt: '2026-01-01 00:00:00',
  edt_tz: '2026-01-01 02:00:00',
  pdt: null,
  latitude: 0,
  longitude: 0,
  spd: 0,
  odo: 0,
  extra: '<b>plain text</b>',
};

describe('location and reference read contracts', () => {
  it('preserves every verified location field, zeros and plain text', () => {
    expect(location([position], '41')).toEqual({
      carId: '41',
      deviceId: car.device_id,
      carNumber: car.car_number,
      messageId: '3000000001',
      eventId: '0',
      edt: position.edt,
      edtTz: position.edt_tz,
      pdt: null,
      latitude: 0,
      longitude: 0,
      spd: 0,
      odo: 0,
      extra: position.extra,
    });
    expect(
      location(
        [{ ...position, message_id: null, eid: null, latitude: null, longitude: null, edt: null }],
        '41',
      ),
    ).toMatchObject({ messageId: null, eventId: null, latitude: null, longitude: null, edt: null });
    expect(location([], '41')).toBeNull();
  });
  it.each([
    { error: 'private error' },
    [position, position],
    [{ ...position, car_id: 42 }],
    [{ ...position, message_id: 9007199254740992 }],
    [{ ...position, device_id: 123 }],
    [{ ...position, spd: '0' }],
    [{ ...position, extra: {} }],
    [{ ...position, edt: 'unexpected time' }],
  ])('sanitizes malformed location envelopes %#', (data) => {
    expect(() => location(data, '41')).toThrow('Karma is unavailable; try again later');
  });
  it('preserves finite out-of-range coordinates for inspection', () => {
    expect(location([{ ...position, latitude: 91 }], '41')?.latitude).toBe(91);
  });
  it('validates full reference lists and version without coercion', () => {
    expect(projects([{ project_id: 12, name: '' }])).toEqual([{ id: '12', name: '' }]);
    expect(timeZones([{ zone_id: 0, zone_name: 'UTC' }])).toEqual([{ id: 0, name: 'UTC' }]);
    expect(version({ version: '2.26.1.1' })).toEqual({ version: '2.26.1.1' });
    expect(projects([])).toEqual([]);
    expect(timeZones([])).toEqual([]);
    for (const data of [
      { error: 'secret' },
      [{ project_id: '12', name: 'x' }],
      [
        { project_id: 12, name: 'x' },
        { project_id: 12, name: 'y' },
      ],
    ])
      expect(() => projects(data)).toThrow('Karma is unavailable');
    for (const data of [
      [{ zone_id: -1, zone_name: 'x' }],
      [{ zone_id: 2147483648, zone_name: 'x' }],
      [{ zone_id: 0, zone_name: '' }],
      [
        { zone_id: 0, zone_name: 'x' },
        { zone_id: 0, zone_name: 'y' },
      ],
    ])
      expect(() => timeZones(data)).toThrow('Karma is unavailable');
    for (const data of [null, { version: '' }, { version: 2 }])
      expect(() => version(data)).toThrow('Karma is unavailable');
  });
});

describe('authenticated bounded location and reference transport', () => {
  const previous = process.env;
  let client: KarmaClient;
  let upstream: jest.SpiedFunction<typeof fetch>;
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
  function login() {
    upstream.mockResolvedValueOnce(Response.json({ session_id: 'fixture-session' }));
  }
  it('checks car existence and requests all four selected fields within one signal budget', async () => {
    login();
    upstream
      .mockResolvedValueOnce(Response.json([car]))
      .mockResolvedValueOnce(Response.json([position]));
    await expect(client.getLocation('41')).resolves.toMatchObject({ messageId: '3000000001' });
    const url = upstream.mock.calls[2]?.[0];
    if (!(url instanceof URL)) throw new Error('Expected URL');
    expect(url.pathname).toBe('/apiv2/location');
    expect(url.searchParams.get('car')).toBe('41');
    expect(url.searchParams.getAll('fields[]')).toEqual(['spd', 'odo', 'edt_tz', 'pdt']);
    expect(new Set(upstream.mock.calls.map((call) => call[1]?.signal)).size).toBe(1);
    expect(upstream.mock.calls.every((call) => call[1]?.redirect === 'error')).toBe(true);
  });
  it('distinguishes missing cars from an upstream business error without reading a missing car location', async () => {
    login();
    upstream.mockResolvedValueOnce(Response.json([]));
    await expect(client.getLocation('999')).resolves.toBeNull();
    expect(upstream).toHaveBeenCalledTimes(2);
    upstream
      .mockResolvedValueOnce(Response.json([car]))
      .mockResolvedValueOnce(Response.json({ error: 'private error' }));
    await expect(client.getLocation('41')).rejects.toThrow('Karma is unavailable');
  });
  it.each(['../login', '01', '0', '9007199254740992'])(
    'rejects malformed ID %s before login',
    async (id) => {
      await expect(client.getLocation(id)).rejects.toThrow('Invalid Karma car ID');
      expect(upstream).not.toHaveBeenCalled();
    },
  );
  it('reads references with shared session and renews once for location', async () => {
    login();
    upstream
      .mockResolvedValueOnce(Response.json([{ project_id: 12, name: 'Fixture project' }]))
      .mockResolvedValueOnce(Response.json([{ zone_id: 0, zone_name: 'UTC' }]));
    await client.listProjects();
    await client.listTimeZones();
    upstream
      .mockResolvedValueOnce(Response.json([car]))
      .mockResolvedValueOnce(Response.json({ error: 'Not logged in' }))
      .mockResolvedValueOnce(Response.json({ session_id: 'new-fixture-session' }))
      .mockResolvedValueOnce(Response.json([position]));
    await expect(client.getLocation('41')).resolves.toMatchObject({ carId: '41' });
    expect(upstream).toHaveBeenCalledTimes(7);
    const signals = upstream.mock.calls.slice(3).map((call) => call[1]?.signal);
    expect(new Set(signals).size).toBe(1);
  });
  it('reads public upstream version without account credentials or a Karma session', async () => {
    delete process.env.KARMA_USER;
    delete process.env.KARMA_PASSWORD;
    upstream.mockResolvedValueOnce(Response.json({ version: '2.26.1.1' }));
    await expect(client.getVersion()).resolves.toEqual({ version: '2.26.1.1' });
    const url = upstream.mock.calls[0]?.[0];
    if (!(url instanceof URL)) throw new Error('Expected URL');
    expect(url.pathname).toBe('/apiv2/version');
    expect(url.search).toBe('');
    expect(upstream).toHaveBeenCalledTimes(1);
  });
  it('cancels version HTTP errors and sanitizes transport exceptions', async () => {
    let cancelled = false;
    upstream.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
        { status: 503 },
      ),
    );
    await expect(client.getVersion()).rejects.toThrow('Karma is unavailable');
    expect(cancelled).toBe(true);
    upstream.mockRejectedValueOnce(new Error('secret'));
    await expect(client.getVersion()).rejects.toThrow('Karma is unavailable; try again later');
  });
  it('requires a verified admin session for every read including public upstream version', () => {
    const loc = new LocationService(client),
      refs = new ReferencesService(client),
      context = { tenantId: undefined, requestId: 'test' };
    expect(() => loc.find('../login', context)).toThrow('Sign in');
    expect(() => refs.projects(context)).toThrow('Sign in');
    expect(() => refs.timeZones(context)).toThrow('Sign in');
    expect(() => refs.version(context)).toThrow('Sign in');
    expect(upstream).not.toHaveBeenCalled();
  });
});
