import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { AccountsModule } from '../../modules/accounts/accounts.module.js';
import { AccountsService } from '../../modules/accounts/accounts.service.js';
import { CarsModule } from '../../modules/cars/cars.module.js';
import { CarsService } from '../../modules/cars/cars.service.js';
import { EdataModule } from '../../modules/edata/edata.module.js';
import { EdataService } from '../../modules/edata/edata.service.js';
import { HistoryModule } from '../../modules/history/history.module.js';
import { HistoryService } from '../../modules/history/history.service.js';
import { LocationModule } from '../../modules/location/location.module.js';
import { LocationService } from '../../modules/location/location.service.js';
import { ReferencesModule } from '../../modules/references/references.module.js';
import { ReferencesService } from '../../modules/references/references.service.js';

function requestUrl(value: Parameters<typeof fetch>[0]): URL {
  return value instanceof URL ? value : new URL(typeof value === 'string' ? value : value.url);
}

describe('Karma feature module transport ownership', () => {
  const previous = process.env;

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = previous;
  });

  it('shares one login across concurrent reads from all six feature modules', async () => {
    process.env = {
      ...previous,
      KARMA_API_URL: 'https://fixture.test/apiv2/',
      KARMA_USER: 'fixture-user',
      KARMA_PASSWORD: 'fixture-password',
    };
    const upstream = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) =>
        Promise.resolve(
          Response.json(
            requestUrl(input).pathname === '/apiv2/login'
              ? { session_id: 'shared-fixture-session' }
              : [],
          ),
        ),
      );
    const module = await Test.createTestingModule({
      imports: [
        AccountsModule,
        CarsModule,
        EdataModule,
        HistoryModule,
        LocationModule,
        ReferencesModule,
      ],
    }).compile();
    const context = { tenantId: 'tenant-a', requestId: 'test' };
    try {
      const results = await Promise.all([
        module.get(CarsService).list(context),
        module.get(AccountsService).users(context),
        module.get(EdataService).list({ carId: '41' }, context),
        module.get(HistoryService).events({ carId: '41' }, context),
        module.get(LocationService).find('41', context),
        module.get(ReferencesService).projects(context),
      ]);
      expect(results).toEqual([
        [],
        [],
        { items: [], hasMore: false, cursor: null, nextCursor: null },
        { items: [], hasMore: false, cursor: null, nextCursor: null },
        null,
        [],
      ]);
      const calls = upstream.mock.calls.map(([input]) => requestUrl(input));
      expect(calls.filter((url) => url.pathname === '/apiv2/login')).toHaveLength(1);
      const reads = calls.filter((url) => url.pathname !== '/apiv2/login');
      expect(reads).toHaveLength(6);
      expect(
        reads.every((url) => url.searchParams.get('karma_sid') === 'shared-fixture-session'),
      ).toBe(true);
    } finally {
      await module.close();
    }
  });
});
