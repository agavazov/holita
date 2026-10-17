import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { KarmaClient } from '../cars/karma-client.js';
import { AccountsService } from './accounts.service.js';
import { users, roles } from './accounts-response.js';

function user() {
  return {
    user_id: 71,
    user_name: '<b>fixture</b>',
    active: 0,
    expire_date: null,
    role_id: 40,
    first_name: '',
    last_name: 'Test',
    time_zone: 0,
    email: 'fixture@example.test',
    project_id: 0,
    project_ids: [12, 0, 12],
  };
}
function requestUrl(value: Parameters<typeof fetch>[0]): URL {
  return value instanceof URL ? value : new URL(typeof value === 'string' ? value : value.url);
}
describe('Karma account response contracts', () => {
  it('preserves all eleven fields, raw flag, null, zero IDs, empty text and original membership order', () => {
    expect(users([user()])).toEqual([
      {
        id: '71',
        userName: '<b>fixture</b>',
        active: 0,
        expireDate: null,
        roleId: '40',
        firstName: '',
        lastName: 'Test',
        timeZoneId: 0,
        email: 'fixture@example.test',
        projectId: '0',
        projectIds: ['12', '0', '12'],
      },
    ]);
    expect(Object.keys(users([user()])[0] ?? {})).toHaveLength(11);
    expect(
      users([
        { ...user(), active: 2, expire_date: 'uninterpreted source text', project_ids: [] },
      ])[0],
    ).toMatchObject({ active: 2, expireDate: 'uninterpreted source text', projectIds: [] });
  });
  it('preserves descriptions without assigning role permissions', () => {
    expect(roles([{ role_id: 40, description: '<script>plain text</script>' }])).toEqual([
      { id: '40', description: '<script>plain text</script>' },
    ]);
    expect(roles([])).toEqual([]);
    expect(users([])).toEqual([]);
  });
  it.each([
    { rows: { error: 'Not logged in' } },
    { rows: [user(), user()] },
    { rows: [{ ...user(), user_id: Number.MAX_SAFE_INTEGER + 1 }] },
    { rows: [{ ...user(), user_name: null }] },
    { rows: [{ ...user(), active: NaN }] },
    { rows: [{ ...user(), expire_date: undefined }] },
    { rows: [{ ...user(), time_zone: -1 }] },
    { rows: [{ ...user(), role_id: 0 }] },
    { rows: [{ ...user(), project_ids: ['12'] }] },
    { rows: [{ ...user(), project_id: -1 }] },
    { rows: [{ ...user(), email: {} }] },
  ])('rejects malformed or ambiguous users without exposing source contents', ({ rows }) => {
    expect(() => users(rows)).toThrow('Karma is unavailable; try again later');
  });
  it.each([
    { rows: null },
    { rows: [{ role_id: 0, description: '' }] },
    { rows: [{ role_id: 40, description: null }] },
    {
      rows: [
        { role_id: 40, description: '' },
        { role_id: 40, description: 'duplicate' },
      ],
    },
  ])('rejects malformed or duplicate role IDs', ({ rows }) => {
    expect(() => roles(rows)).toThrow('Karma is unavailable');
  });
});
describe('Karma account transport and authorization', () => {
  let client: KarmaClient;
  let upstream: jest.SpiedFunction<typeof fetch>;
  const previous = process.env;
  beforeEach(() => {
    process.env = {
      ...previous,
      KARMA_API_URL: 'https://fixture.test/apiv2/',
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
  it('authenticates before either account request', () => {
    const service = new AccountsService(client),
      context = { tenantId: undefined, requestId: 'test' };
    expect(() => service.users(context)).toThrow('Sign in');
    expect(() => service.roles(context)).toThrow('Sign in');
    expect(upstream).not.toHaveBeenCalled();
  });
  it('shares a single server-held login and reads fixed account paths without Branch filters', async () => {
    upstream
      .mockResolvedValueOnce(Response.json({ session_id: 'fixture-session' }))
      .mockResolvedValueOnce(Response.json([user()]))
      .mockResolvedValueOnce(Response.json([{ role_id: 40, description: 'Viewer' }]));
    const service = new AccountsService(client);
    expect(await service.users({ tenantId: 'a', requestId: 'test' })).toHaveLength(1);
    expect(await service.roles({ tenantId: 'b', requestId: 'test' })).toHaveLength(1);
    expect(upstream).toHaveBeenCalledTimes(3);
    expect(upstream.mock.calls.map((call) => requestUrl(call[0]).pathname)).toEqual([
      '/apiv2/login',
      '/apiv2/users',
      '/apiv2/roles',
    ]);
    for (const call of upstream.mock.calls.slice(1)) {
      expect([...requestUrl(call[0]).searchParams.keys()]).toEqual(['karma_sid']);
      expect(call[1]?.method ?? 'GET').toBe('GET');
    }
  });
  it('renews once with the same four-second operation signal', async () => {
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    upstream
      .mockResolvedValueOnce(Response.json({ session_id: 'fixture-session' }))
      .mockResolvedValueOnce(Response.json({ error: 'Not logged in' }))
      .mockResolvedValueOnce(Response.json({ session_id: 'renewed' }))
      .mockResolvedValueOnce(Response.json([user()]));
    expect(await client.listUsers()).toHaveLength(1);
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(4000);
    expect(new Set(upstream.mock.calls.map((call) => call[1]?.signal)).size).toBe(1);
  });
  it('sanitizes failures and does not repeatedly log in', async () => {
    upstream
      .mockResolvedValueOnce(Response.json({ session_id: 'fixture-session' }))
      .mockResolvedValueOnce(Response.json({ error: 'Not logged in' }))
      .mockResolvedValueOnce(Response.json({ session_id: 'renewed' }))
      .mockResolvedValueOnce(Response.json({ error: 'Not logged in' }));
    await expect(client.listRoles()).rejects.toThrow('Karma is unavailable');
    expect(upstream).toHaveBeenCalledTimes(4);
    upstream.mockRejectedValueOnce(new Error('https://private.test/?karma_sid=secret'));
    await expect(client.listUsers()).rejects.toThrow('Karma is unavailable');
  });
});
