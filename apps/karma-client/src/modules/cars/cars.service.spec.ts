import { describe, expect, it, jest } from '@jest/globals';
import { CarsService } from './cars.service.js';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';

describe('shared Karma cars access', () => {
  it('requires an authenticated session before a detail read', () => {
    const client = new KarmaTransport();
    const read = jest.spyOn(client, 'readCar');
    expect(() =>
      new CarsService(client).find('41', { tenantId: undefined, requestId: 'test' }),
    ).toThrow('Sign in');
    expect(read).not.toHaveBeenCalled();
  });

  it('reads truck details for different authenticated tenants without Branch context', async () => {
    const client = new KarmaTransport();
    const read = jest.spyOn(client, 'readCar').mockResolvedValue([]);
    const service = new CarsService(client);
    for (const tenantId of ['tenant-a', 'tenant-b']) {
      await expect(service.find('41', { tenantId, requestId: 'test' })).resolves.toBeNull();
    }
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('requires an authenticated session before contacting Karma', () => {
    const client = new KarmaTransport();
    const read = jest.spyOn(client, 'read');
    expect(() => new CarsService(client).list({ tenantId: undefined, requestId: 'test' })).toThrow(
      'Sign in',
    );
    expect(read).not.toHaveBeenCalled();
  });
  it('returns the same account list to different authenticated tenants without Branch context', async () => {
    const client = new KarmaTransport();
    const read = jest.spyOn(client, 'read').mockResolvedValue([]);
    const service = new CarsService(client);
    for (const tenantId of ['tenant-a', 'tenant-b']) {
      await expect(service.list({ tenantId, requestId: 'test' })).resolves.toEqual([]);
    }
    expect(read).toHaveBeenCalledTimes(2);
  });
});
