import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { startRouter } from './federation-fixture.mjs';

describe('native Gateway without available subgraphs or databases', () => {
  let router: Awaited<ReturnType<typeof startRouter>>;
  let stop: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    router = await startRouter({
      adminOrigin: 'http://127.0.0.1:11000',
      subgraphUrls: {
        core: 'http://127.0.0.1:1/graphql',
        fleet: 'http://127.0.0.1:2/graphql',
        'karma-client': 'http://127.0.0.1:3/graphql',
      },
    });
    stop = router.stop;
  });
  afterAll(async () => {
    await stop?.();
  });

  it('serves health on its dedicated listener and executes a local GraphQL query', async () => {
    const health = await fetch(router.healthUrl, { signal: AbortSignal.timeout(3000) });
    expect(health.status).toBe(200);
    const body: unknown = await health.json();
    expect(body).toEqual({ status: 'UP' });
    const response = await fetch(router.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'native-runtime' },
      body: JSON.stringify({ query: '{__typename}' }),
      signal: AbortSignal.timeout(3000),
    });
    const result: unknown = await response.json();
    expect(response.status).toBe(200);
    expect(result).toEqual({ data: { __typename: 'Query' } });
    expect(response.headers.get('x-request-id')).toBe('native-runtime');
  });
  it('does not expose an unrelated route', async () => {
    const response = await fetch(new URL('/unregistered', router.url), {
      signal: AbortSignal.timeout(3000),
    });
    await response.text();
    expect(response.status).toBe(404);
  });
  it('rejects oversized headers before GraphQL handling', async () => {
    const response = await fetch(router.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', baggage: `key=${'x'.repeat(20 * 1024)}` },
      body: JSON.stringify({ query: '{stores{id}}' }),
      signal: AbortSignal.timeout(3000),
    });
    await response.text();
    expect(response.status).toBe(431);
    expect(response.headers.get('x-request-id')).toBeNull();
  });
});
