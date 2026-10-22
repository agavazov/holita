import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../app.module.js';
import { KarmaTransport } from '../integrations/karma/karma-transport.js';
import { issueDemoToken } from '../auth/demo-auth.js';

describe('karma-client GraphQL session boundary', () => {
  let app: INestApplication;
  let baseUrl: string;
  const transport = {
    read: jest.fn<KarmaTransport['read']>(),
    readCar: jest.fn<KarmaTransport['readCar']>(),
    readVersion: jest.fn<KarmaTransport['readVersion']>(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(KarmaTransport)
      .useValue(transport)
      .compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  async function query(source: string, authorization?: string) {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
      body: JSON.stringify({ query: source }),
    });
    const body: unknown = await response.json();
    return body;
  }

  it('every Karma query requires a verified signed session before any upstream call and is shared by all signed tenants without Branch', async () => {
    const tenantA = '01000000-0000-4000-8000-000000000001';
    const tenantB = '01000000-0000-4000-8000-000000000002';
    const forged = issueDemoToken(tenantA).replace(tenantA, tenantB);
    for (const source of [
      '{karmaCars{id}}',
      '{karmaCar(id:"41"){id}}',
      '{karmaUsers{id}}',
      '{karmaRoles{id}}',
      '{karmaEdata(input:{carId:"41"}){hasMore}}',
      '{karmaTrips(input:{carId:"41"}){hasMore}}',
      '{karmaEvents(input:{carId:"41"}){hasMore}}',
      '{karmaDrivingProfile(input:{carId:"41",fromDate:"2026-01-01T00:00:00",toDate:"2026-01-08T00:00:00"}){carId}}',
      '{karmaLocation(carId:"41"){carId}}',
      '{karmaProjects{id}}',
      '{karmaTimeZones{id}}',
      '{karmaVersion{version}}',
    ]) {
      for (const [label, authorization] of [
        ['no authorization', undefined],
        ['invalid token', 'Bearer invalid'],
        ['forged signature', `Bearer ${forged}`],
      ] satisfies [string, string | undefined][]) {
        const row = `${source} with ${label}`;
        const body = await query(source, authorization);
        const upstreamCalls =
          transport.read.mock.calls.length +
          transport.readCar.mock.calls.length +
          transport.readVersion.mock.calls.length;
        expect({ row, value: { body, upstreamCalls } }).toMatchObject({
          row,
          value: {
            body: { errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] },
            upstreamCalls: 0,
          },
        });
      }
    }
    transport.read.mockResolvedValue([
      { car_id: 41, device_id: '000123456789012', project_id: 12, car_number: 'TEST 41' },
    ]);
    for (const tenantId of [tenantA, tenantB]) {
      expect({
        row: tenantId,
        value: await query('{karmaCars{id}}', `Bearer ${issueDemoToken(tenantId)}`),
      }).toEqual({ row: tenantId, value: { data: { karmaCars: [{ id: '41' }] } } });
    }
  });
});
