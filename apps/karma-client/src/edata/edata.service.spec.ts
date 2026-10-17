import { describe, expect, it, jest } from '@jest/globals';
import { KarmaClient } from '../cars/karma-client.js';
import { EdataService } from './edata.service.js';

describe('shared authenticated Karma eData access', () => {
  it('authenticates before validating input or contacting Karma', () => {
    const client = new KarmaClient(),
      read = jest.spyOn(client, 'getEdata');
    expect(() =>
      new EdataService(client).list(
        { carId: '../login' },
        { tenantId: undefined, requestId: 'test' },
      ),
    ).toThrow('Sign in');
    expect(read).not.toHaveBeenCalled();
  });
  it('preserves shared account access across signed tenants without Branch context', async () => {
    const client = new KarmaClient(),
      read = jest
        .spyOn(client, 'getEdata')
        .mockResolvedValue({ items: [], hasMore: false, cursor: null, nextCursor: null });
    const service = new EdataService(client);
    for (const tenantId of ['tenant-a', 'tenant-b'])
      await expect(
        service.list({ carId: '41' }, { tenantId, requestId: 'test' }),
      ).resolves.toMatchObject({ items: [] });
    expect(read).toHaveBeenCalledTimes(2);
  });
});
