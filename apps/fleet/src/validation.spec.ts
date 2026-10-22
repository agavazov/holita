import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import {
  dateOnly,
  dateOnlyRange,
  dateTime,
  dateTimeRange,
  pagination,
  requireScope,
  searchTokens,
} from './validation.js';

function fieldErrors(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    if (!(error instanceof BadRequestException)) {
      throw error;
    }
    const response = error.getResponse();
    return typeof response === 'object' && 'fieldErrors' in response
      ? response.fieldErrors
      : undefined;
  }
  throw new Error('Expected BAD_USER_INPUT');
}

describe('Fleet validation helpers', () => {
  const scope = {
    tenantId: '01000000-0000-4000-8000-000000000001',
    branchId: '10000000-0000-4000-8000-000000000001',
  };

  it('list-contract helpers', () => {
    expect(() => requireScope({ tenantId: undefined, branchId: scope.branchId })).toThrow(
      'Sign in to a tenant first',
    );
    const instants = { from: 'startedFrom', to: 'startedTo' };
    const days = { from: 'completedFrom', to: 'completedTo' };
    const accepted: [string, () => unknown, unknown][] = [
      [
        'upper-case Branch UUID',
        () => requireScope({ ...scope, branchId: scope.branchId.toUpperCase() }),
        scope,
      ],
      ['default page', () => pagination({}), { offset: 0, limit: 20 }],
      [
        'largest page',
        () => pagination({ offset: 2147483647, limit: 100 }),
        { offset: 2147483647, limit: 100 },
      ],
      ['absent search', () => searchTokens(undefined), []],
      ['Unicode whitespace search', () => searchTokens('  　 '), []],
      [
        'tokens split on Unicode whitespace',
        () => searchTokens(' Георги Иванов\tCA '),
        ['Георги', 'Иванов', 'CA'],
      ],
      ['five tokens', () => searchTokens('a b c d e').length, 5],
      ['200 code points', () => searchTokens('😀'.repeat(200)).length, 1],
      ['leap day', () => dateOnly('2028-02-29', 'licenseExpiresOn'), '2028-02-29'],
      ['earliest date', () => dateOnly('1900-01-01', 'licenseExpiresOn'), '1900-01-01'],
      [
        'date-time with an offset',
        () => dateTime('2026-10-18T09:30:00+03:00', 'installedAt').toISOString(),
        '2026-10-18T06:30:00.000Z',
      ],
      [
        'UTC date-time without seconds',
        () => dateTime('2026-10-18T06:30Z', 'installedAt').toISOString(),
        '2026-10-18T06:30:00.000Z',
      ],
      [
        'date-time with microseconds',
        () => dateTime('2026-10-18T06:30:00.123456Z', 'installedAt').toISOString(),
        '2026-10-18T06:30:00.123Z',
      ],
      [
        'one-millisecond DateTime range',
        () => dateTimeRange('2026-10-18T00:00:00Z', '2026-10-18T00:00:00.001Z', instants),
        { from: new Date('2026-10-18T00:00:00.000Z'), to: new Date('2026-10-18T00:00:00.001Z') },
      ],
      [
        'DateTime upper bound only',
        () => dateTimeRange(null, '2026-10-18T00:00:00Z', instants),
        { to: new Date('2026-10-18T00:00:00.000Z') },
      ],
      [
        'single-day Date range',
        () => dateOnlyRange('2026-10-18', '2026-10-18', days),
        { from: '2026-10-18', to: '2026-10-18' },
      ],
      [
        'Date lower bound only',
        () => dateOnlyRange('2026-10-18', undefined, days),
        { from: '2026-10-18' },
      ],
    ];
    for (const [row, action, expected] of accepted) {
      expect({ row, value: action() }).toEqual({ row, value: expected });
    }
    const rejected: [string, () => unknown, string][] = [
      ['invalid Branch UUID', () => requireScope({ ...scope, branchId: 'bad' }), 'x-branch-id'],
      ['negative offset', () => pagination({ offset: -1 }), 'offset'],
      ['offset above int32', () => pagination({ offset: 2147483648 }), 'offset'],
      ['fractional offset', () => pagination({ offset: 1.5 }), 'offset'],
      ['zero limit', () => pagination({ limit: 0 }), 'limit'],
      ['limit above 100', () => pagination({ limit: 101 }), 'limit'],
      ['six tokens', () => searchTokens('a b c d e f'), 'search'],
      ['201 code points', () => searchTokens('😀'.repeat(201)), 'search'],
      ['NUL in search', () => searchTokens('a\u0000b'), 'search'],
      ['non-text search', () => searchTokens(42), 'search'],
      [
        '29 February of a common year',
        () => dateOnly('2026-02-29', 'licenseExpiresOn'),
        'licenseExpiresOn',
      ],
      ['30 February', () => dateOnly('2026-02-30', 'licenseExpiresOn'), 'licenseExpiresOn'],
      ['month 13', () => dateOnly('2026-13-01', 'licenseExpiresOn'), 'licenseExpiresOn'],
      ['unpadded month', () => dateOnly('2026-1-01', 'licenseExpiresOn'), 'licenseExpiresOn'],
      ['date before 1900', () => dateOnly('1899-12-31', 'licenseExpiresOn'), 'licenseExpiresOn'],
      ['non-text date', () => dateOnly(7, 'licenseExpiresOn'), 'licenseExpiresOn'],
      [
        'date-time without an offset',
        () => dateTime('2026-10-18T06:30:00', 'installedAt'),
        'installedAt',
      ],
      ['date instead of a date-time', () => dateTime('2026-10-18', 'installedAt'), 'installedAt'],
      [
        'impossible date-time',
        () => dateTime('2026-02-30T00:00:00Z', 'installedAt'),
        'installedAt',
      ],
      ['hour 24', () => dateTime('2026-10-18T24:00:00Z', 'installedAt'), 'installedAt'],
      [
        'date-time before 2000',
        () => dateTime('1999-12-31T23:59:59Z', 'installedAt'),
        'installedAt',
      ],
      ['unpadded offset', () => dateTime('2026-10-18T06:30:00+3:00', 'installedAt'), 'installedAt'],
      [
        'empty half-open DateTime range',
        () => dateTimeRange('2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z', instants),
        'filter',
      ],
      ['reversed Date range', () => dateOnlyRange('2026-10-18', '2026-10-17', days), 'filter'],
      ['impossible Date bound', () => dateOnlyRange('2026-02-30', null, days), 'filter'],
    ];
    for (const [row, action, path] of rejected) {
      expect({ row, value: fieldErrors(action) }).toMatchObject({ row, value: [{ path }] });
    }
  });
});
