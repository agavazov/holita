import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { KarmaClient } from '../cars/karma-client.js';

function row(id = 3000000001) {
  return {
    message_id: id,
    car_id: 41,
    device_id: '000123456789012',
    carnumber: 'TEST 41',
    edt: '2026-01-01 10:00:00',
    edt_tz: '2026-01-01 12:00:00',
    pdt: '2026-01-01 10:00:02',
    spd: 0,
    odo: 0,
    latitude: 0,
    longitude: 0,
    parameters: [{ id: 99999, value: 0, desc: 'Unlisted fixture parameter' }],
  };
}

function url(value: Parameters<typeof fetch>[0]): URL {
  if (value instanceof URL) return value;
  if (typeof value === 'string') return new URL(value);
  return new URL(value.url);
}

describe('Karma eData reads', () => {
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
  function respond(value: unknown, status = 200) {
    return Promise.resolve(Response.json(value, { status }));
  }
  function login() {
    upstream.mockImplementationOnce(() => respond({ session_id: 'fixture-session' }));
  }

  it('preserves zero readings, leading-zero devices and unknown parameter IDs without required dates', async () => {
    login();
    upstream.mockImplementationOnce(() => respond([row()]));
    const page = await client.getEdata({ carId: '41' });
    expect(page).toMatchObject({
      hasMore: false,
      nextCursor: null,
      items: [
        {
          id: '3000000001',
          deviceId: '000123456789012',
          spd: 0,
          odo: 0,
          latitude: 0,
          longitude: 0,
          parameters: [{ id: '99999', value: 0, description: 'Unlisted fixture parameter' }],
        },
      ],
    });
    const read = upstream.mock.calls[1];
    if (!read) throw new Error('Missing eData read');
    expect(url(read[0]).pathname).toBe('/apiv2/edata');
    expect(Object.fromEntries(url(read[0]).searchParams)).toEqual({
      car: '41',
      date_type: 'utc',
      showdesc: '1',
      karma_sid: 'fixture-session',
    });
    expect(read[1]?.redirect).toBe('error');
    expect(JSON.stringify(page)).not.toContain('fixture-session');
    expect(JSON.stringify(page)).not.toContain('fixture-password');
  });

  it('walks a 500+ source history in displayed-page steps, keeping a snapshot when newer records arrive', async () => {
    login();
    const messages = Array.from({ length: 600 }, (_, index) => row(3000000001 + index));
    upstream.mockImplementation((input) => {
      const bound = url(input).searchParams.get('to_id');
      return respond(
        messages.filter((entry) => !bound || entry.message_id <= Number(bound)).slice(-500),
      );
    });
    const first = await client.getEdata({ carId: '41', pageSize: 50 });
    expect(first.items).toHaveLength(50);
    expect(first.items[0]?.id).toBe('3000000600');
    expect(first.items.at(-1)?.id).toBe('3000000551');
    messages.push(row(3000000601));
    const ids = first.items.map((entry) => entry.id);
    let cursor = first.nextCursor;
    while (cursor) {
      const page = await client.getEdata({ carId: '41', pageSize: 50, cursor });
      ids.push(...page.items.map((entry) => entry.id));
      cursor = page.nextCursor;
    }
    expect(ids).toHaveLength(600);
    expect(new Set(ids).size).toBe(600);
    expect(ids.at(-1)).toBe('3000000001');
    expect(ids).not.toContain('3000000601');
    expect(upstream).toHaveBeenCalledTimes(13);
    const second = upstream.mock.calls[2];
    if (!second) throw new Error('Missing older read');
    expect(url(second[0]).searchParams.get('to_id')).toBe('3000000550');
  });

  it.each([0, 25, 50, 51])(
    'handles final/empty source size %i without an invented total',
    async (count) => {
      login();
      upstream.mockImplementationOnce(() =>
        respond(Array.from({ length: count }, (_, index) => row(3000000001 + index))),
      );
      const page = await client.getEdata({ carId: '41', pageSize: 50 });
      expect(page.items).toHaveLength(Math.min(count, 50));
      expect(page.hasMore).toBe(count > 50);
      expect(page.nextCursor !== null).toBe(count > 50);
      expect(page).not.toHaveProperty('total');
    },
  );

  it('returns a reusable current-page cursor so Newer does not absorb newly arrived messages', async () => {
    login();
    const rows = Array.from({ length: 100 }, (_, index) => row(3000000001 + index));
    upstream.mockImplementation((input) => {
      const before = url(input).searchParams.get('to_id');
      return respond(rows.filter((entry) => !before || entry.message_id <= Number(before)));
    });
    const first = await client.getEdata({ carId: '41' });
    rows.push(row(3000000101));
    const restored = await client.getEdata({ carId: '41', cursor: first.cursor ?? null });
    expect(restored.items).toEqual(first.items);
    expect(restored.nextCursor).toBe(first.nextCursor);
    expect((await client.getEdata({ carId: '41' })).items[0]?.id).toBe('3000000101');
  });

  it('encodes paired UTC dates and multiple parameter IDs with the verified GET array syntax', async () => {
    login();
    upstream.mockImplementationOnce(() =>
      respond([
        {
          ...row(),
          parameters: [
            { id: 1, value: 0 },
            { id: 785, value: null },
          ],
        },
      ]),
    );
    const page = await client.getEdata({
      carId: '41',
      fromDate: '2026-01-01T00:00:00Z',
      toDate: '2026-01-01T23:59:59Z',
      parameterIds: ['785', '1', '785'],
    });
    expect(page.items[0]?.parameters).toEqual([
      { id: '1', value: 0, description: null },
      { id: '785', value: null, description: null },
    ]);
    const call = upstream.mock.calls[1];
    if (!call) throw new Error('Missing filtered read');
    expect(url(call[0]).searchParams.getAll('parameter_id[]')).toEqual(['1', '785']);
    expect(url(call[0]).searchParams.get('from_date')).toBe('2026-01-01 00:00:00');
  });

  it.each([
    { carId: '../login' },
    { carId: '01' },
    { carId: '9007199254740992' },
    { carId: '41', pageSize: 500 },
    { carId: '41', parameterIds: ['0'] },
    { carId: '41', fromDate: '2026-01-01T00:00:00Z' },
    { carId: '41', fromDate: '2026-02-30T00:00:00Z', toDate: '2026-03-01T00:00:00Z' },
    { carId: '41', fromDate: '2026-01-02T00:00:00Z', toDate: '2026-01-01T00:00:00Z' },
    { carId: '41', cursor: 'not-a-cursor' },
  ])('rejects invalid filters/cursors before contacting upstream: %j', async (input) => {
    await expect(client.getEdata(input)).rejects.toThrow('Invalid Karma eData');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('rejects a cursor reused across truck, size, dates or parameter filters', async () => {
    login();
    upstream.mockImplementationOnce(() =>
      respond(Array.from({ length: 60 }, (_, index) => row(3000000001 + index))),
    );
    const page = await client.getEdata({ carId: '41' });
    const count = upstream.mock.calls.length;
    for (const change of [
      { carId: '42' },
      { pageSize: 25 },
      { parameterIds: ['1'] },
      { fromDate: '2026-01-01T00:00:00Z', toDate: '2026-01-01T23:59:59Z' },
    ])
      await expect(
        client.getEdata({ carId: '41', cursor: page.nextCursor ?? null, ...change }),
      ).rejects.toThrow('Invalid Karma eData');
    expect(upstream).toHaveBeenCalledTimes(count);
  });

  it.each([
    [{ ...row(), car_id: 42 }],
    [row(), row()],
    [row(3000000002), row()],
    [{ ...row(), parameters: [{ id: 1, value: 'wrong' }] }],
    [{ ...row(), latitude: 91 }],
    [{ ...row(), parameters: null }],
    { error: 'Private upstream failure' },
  ])(
    'rejects malformed/foreign response without exposing upstream content: %j',
    async (payload) => {
      login();
      upstream.mockImplementationOnce(() => respond(payload));
      await expect(client.getEdata({ carId: '41' })).rejects.toThrow(
        'Karma is unavailable; try again later',
      );
    },
  );

  it('rejects rows beyond an older cursor instead of silently duplicating a page', async () => {
    login();
    const rows = Array.from({ length: 60 }, (_, index) => row(3000000001 + index));
    upstream
      .mockImplementationOnce(() => respond(rows))
      .mockImplementationOnce(() => respond(rows));
    const first = await client.getEdata({ carId: '41' });
    await expect(
      client.getEdata({ carId: '41', cursor: first.nextCursor ?? null }),
    ).rejects.toThrow('Karma is unavailable');
  });

  it('renews the shared session once with the same complete-operation abort signal', async () => {
    login();
    upstream
      .mockImplementationOnce(() => respond({ error: 'Not logged in' }))
      .mockImplementationOnce(() => respond({ session_id: 'renewed' }))
      .mockImplementationOnce(() => respond([row()]));
    await expect(client.getEdata({ carId: '41' })).resolves.toMatchObject({
      items: [{ id: '3000000001' }],
    });
    expect(upstream).toHaveBeenCalledTimes(4);
    expect(
      upstream.mock.calls.every((call) => call[1]?.signal === upstream.mock.calls[0]?.[1]?.signal),
    ).toBe(true);
  });

  it('stops after a second session rejection', async () => {
    login();
    upstream
      .mockImplementationOnce(() => respond({ error: 'Not logged in' }))
      .mockImplementationOnce(() => respond({ session_id: 'renewed' }))
      .mockImplementationOnce(() => respond({}, 401));
    await expect(client.getEdata({ carId: '41' })).rejects.toThrow('Karma is unavailable');
    expect(upstream).toHaveBeenCalledTimes(4);
  });
});
