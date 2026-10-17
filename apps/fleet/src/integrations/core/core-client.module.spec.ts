import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { RequestContext } from '../../graphql/request-context.js';
import { DevicesModule } from '../../modules/devices/devices.module.js';
import { VehiclesModule } from '../../modules/vehicles/vehicles.module.js';
import { CoreClient } from './core.client.js';

describe('Fleet Core integration ownership', () => {
  let module: TestingModule;
  let client: CoreClient;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [VehiclesModule, DevicesModule],
    }).compile();
    client = module.get(CoreClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  afterAll(async () => module.close());

  it('shares one Core client across Vehicles and Devices', () => {
    expect(module.get(CoreClient, { each: true })).toEqual([client]);
  });

  it('keeps branch checks and authorization isolated between requests', async () => {
    const branchId = randomUUID();
    const fetchCore = jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { branch: { id: branchId } } }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const first: RequestContext = {
      requestId: randomUUID(),
      tenantId: randomUUID(),
      branchId,
      authorization: 'Bearer first-session',
      branchChecks: new Map(),
    };
    const second: RequestContext = {
      ...first,
      requestId: randomUUID(),
      tenantId: randomUUID(),
      authorization: 'Bearer second-session',
      branchChecks: new Map(),
    };

    const firstCheck = client.requireBranch(branchId, first);
    expect(client.requireBranch(branchId, first)).toBe(firstCheck);
    const secondCheck = client.requireBranch(branchId, second);
    expect(secondCheck).not.toBe(firstCheck);
    await Promise.all([firstCheck, secondCheck]);

    expect(fetchCore).toHaveBeenCalledTimes(2);
    for (const [index, context] of [first, second].entries()) {
      expect(fetchCore).toHaveBeenNthCalledWith(
        index + 1,
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: context.authorization,
            'x-request-id': context.requestId,
          }),
        }),
      );
    }
  });
});
