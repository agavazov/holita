import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../app.module.js';
import { KarmaClient } from '../cars/karma-client.js';
import { issueDemoToken } from '../graphql/demo-auth.js';

describe('karma-client health endpoint', () => {
  let app: INestApplication;
  let baseUrl: string;
  const readCars = jest.fn<() => Promise<[]>>().mockResolvedValue([]);

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(KarmaClient)
      .useValue({ listCars: readCars })
      .compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds without branch context or database access', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body: unknown = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok', service: 'karma-client' });
  });

  it('does not expose an unrelated route', async () => {
    const response = await fetch(`${baseUrl}/unregistered`);
    await response.text();
    expect(response.status).toBe(404);
  });

  async function query(authorization?: string) {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
      body: JSON.stringify({ query: '{karmaCars{id}}' }),
    });
    const body: unknown = await response.json();
    return body;
  }

  it.each([
    undefined,
    'Bearer invalid',
    'Bearer ' + issueDemoToken('01000000-0000-4000-8000-000000000001').slice(0, -1) + '!',
  ])('rejects missing/invalid authorization %s without reading Karma', async (authorization) => {
    readCars.mockClear();
    expect(await query(authorization)).toMatchObject({
      errors: [{ extensions: { code: 'UNAUTHENTICATED' } }],
    });
    expect(readCars).not.toHaveBeenCalled();
  });

  it('accepts the signed session protocol for different tenants without Branch context', async () => {
    for (const tenantId of [
      '01000000-0000-4000-8000-000000000001',
      '01000000-0000-4000-8000-000000000002',
    ]) {
      expect(await query('Bearer ' + issueDemoToken(tenantId))).toEqual({
        data: { karmaCars: [] },
      });
    }
  });
});
