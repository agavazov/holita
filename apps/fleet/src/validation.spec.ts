import { describe, expect, it } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from './generated/prisma/client.js';
import {
  booleanFilter,
  dateOnly,
  dateOnlyRange,
  dateTime,
  dateTimeRange,
  enumFilter,
  enumList,
  enumValue,
  finite,
  idList,
  ids,
  integer,
  integerFilter,
  invalid,
  invalidFields,
  numberFilter,
  optionalPattern,
  pagination,
  persistenceError,
  requireScope,
  rethrowUniqueViolation,
  searchTokens,
  sortDirection,
  sortField,
  text,
  textErrorCode,
  uniqueViolation,
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

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('Constraint', {
    code,
    clientVersion: '7',
    ...(meta ? { meta } : {}),
  });
}

function adapterError(constraint: unknown) {
  return new Error('Unique constraint failed', {
    cause: { kind: 'UniqueConstraintViolation', constraint, table: 'Vehicle' },
  });
}

describe('Fleet validation helpers', () => {
  const scope = {
    tenantId: '01000000-0000-4000-8000-000000000001',
    branchId: '10000000-0000-4000-8000-000000000001',
  };

  it('requires a verified tenant and a Branch UUID', () => {
    expect(requireScope({ ...scope, branchId: scope.branchId.toUpperCase() })).toEqual(scope);
    expect(() => requireScope({ tenantId: undefined, branchId: scope.branchId })).toThrow(
      'Sign in to a tenant first',
    );
    expect(fieldErrors(() => requireScope({ ...scope, branchId: 'bad' }))).toEqual([
      { path: 'x-branch-id', message: 'Use a valid UUID.', code: 'INVALID_FORMAT' },
    ]);
  });

  it('bounds pagination', () => {
    expect(pagination({})).toEqual({ offset: 0, limit: 20 });
    expect(pagination({ offset: 2147483647, limit: 100 })).toEqual({
      offset: 2147483647,
      limit: 100,
    });
    for (const args of [{ offset: -1 }, { offset: 2147483648 }, { offset: 1.5 }]) {
      expect(fieldErrors(() => pagination(args))).toMatchObject([{ path: 'offset' }]);
    }
    for (const args of [{ limit: 0 }, { limit: 101 }]) {
      expect(fieldErrors(() => pagination(args))).toMatchObject([{ path: 'limit' }]);
    }
  });

  it('tokenizes search on Unicode whitespace with code point and token limits', () => {
    expect(searchTokens(undefined)).toEqual([]);
    expect(searchTokens('  　 ')).toEqual([]);
    expect(searchTokens(' Георги Иванов\tCA ')).toEqual(['Георги', 'Иванов', 'CA']);
    expect(searchTokens('a b c d e')).toHaveLength(5);
    expect(searchTokens('😀'.repeat(200))).toHaveLength(1);
    for (const value of ['a b c d e f', '😀'.repeat(201), 'a\u0000b', 42]) {
      expect(fieldErrors(() => searchTokens(value))).toMatchObject([{ path: 'search' }]);
    }
  });

  it('validates input enum lists and returns them in enumeration order', () => {
    const allowed = ['A', 'B', 'C'] as const;
    expect(enumList(['C', 'A'], allowed, 'options', 3)).toEqual(['A', 'C']);
    expect(enumList([], allowed, 'options', 3)).toEqual([]);
    for (const value of [['A', 'A'], ['D'], 'A', ['A', 'B', 'C']]) {
      expect(fieldErrors(() => enumList(value, allowed, 'options', 2))).toMatchObject([
        { path: 'options' },
      ]);
    }
  });

  it('treats null filters as no constraint and rejects empty or repeated filter lists', () => {
    const id = '30000000-0000-4000-8000-000000000001';
    expect(idList(undefined, 'groupIds')).toBeUndefined();
    expect(idList(null, 'groupIds')).toBeUndefined();
    expect(idList([id.toUpperCase()], 'groupIds')).toEqual([id]);
    expect(enumFilter(['ACTIVE'], ['ACTIVE', 'INACTIVE'], 'statuses')).toEqual(['ACTIVE']);
    expect(booleanFilter(false, 'hasGroup')).toBe(false);
    expect(booleanFilter(null, 'hasGroup')).toBeUndefined();
    expect(integerFilter(365, 'documentsExpireWithinDays', 0, 365)).toBe(365);
    for (const action of [
      () => idList([], 'groupIds'),
      () => idList([id, id], 'groupIds'),
      () => idList(['bad'], 'groupIds'),
      () =>
        idList(
          Array.from({ length: 101 }, () => id),
          'groupIds',
        ),
      () => enumFilter([], ['ACTIVE'], 'statuses'),
      () => enumFilter(['ACTIVE', 'ACTIVE'], ['ACTIVE'], 'statuses'),
      () => enumFilter(['OTHER'], ['ACTIVE'], 'statuses'),
      () => booleanFilter('true', 'hasGroup'),
      () => integerFilter(366, 'documentsExpireWithinDays', 0, 365),
      () => integerFilter(-1, 'documentsExpireWithinDays', 0, 365),
    ]) {
      expect(fieldErrors(action)).toMatchObject([
        { path: 'filter', message: expect.stringMatching(/^filter\./) },
      ]);
    }
  });

  it('accepts real calendar dates only', () => {
    expect(dateOnly('2028-02-29', 'licenseExpiresOn')).toBe('2028-02-29');
    expect(dateOnly('1900-01-01', 'licenseExpiresOn')).toBe('1900-01-01');
    for (const value of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-1-01', '1899-12-31', 7]) {
      expect(fieldErrors(() => dateOnly(value, 'licenseExpiresOn'))).toMatchObject([
        { path: 'licenseExpiresOn' },
      ]);
    }
  });

  it('requires an offset on date-times and converts them to instants', () => {
    expect(dateTime('2026-10-18T09:30:00+03:00', 'installedAt').toISOString()).toBe(
      '2026-10-18T06:30:00.000Z',
    );
    expect(dateTime('2026-10-18T06:30Z', 'installedAt').toISOString()).toBe(
      '2026-10-18T06:30:00.000Z',
    );
    expect(dateTime('2026-10-18T06:30:00.123456Z', 'installedAt').toISOString()).toBe(
      '2026-10-18T06:30:00.123Z',
    );
    for (const value of [
      '2026-10-18T06:30:00',
      '2026-10-18',
      '2026-02-30T00:00:00Z',
      '2026-10-18T24:00:00Z',
      '1999-12-31T23:59:59Z',
      '2026-10-18T06:30:00+3:00',
    ]) {
      expect(fieldErrors(() => dateTime(value, 'installedAt'))).toMatchObject([
        { path: 'installedAt' },
      ]);
    }
  });

  it('uses half-open DateTime ranges and closed Date ranges with single bounds', () => {
    const fields = { from: 'startedFrom', to: 'startedTo' };
    expect(
      fieldErrors(() => dateTimeRange('2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z', fields)),
    ).toMatchObject([{ path: 'filter' }]);
    expect(dateTimeRange('2026-10-18T00:00:00Z', '2026-10-18T00:00:00.001Z', fields)).toEqual({
      from: new Date('2026-10-18T00:00:00.000Z'),
      to: new Date('2026-10-18T00:00:00.001Z'),
    });
    expect(dateTimeRange(null, '2026-10-18T00:00:00Z', fields)).toEqual({
      to: new Date('2026-10-18T00:00:00.000Z'),
    });
    const days = { from: 'completedFrom', to: 'completedTo' };
    expect(dateOnlyRange('2026-10-18', '2026-10-18', days)).toEqual({
      from: '2026-10-18',
      to: '2026-10-18',
    });
    expect(dateOnlyRange('2026-10-18', undefined, days)).toEqual({ from: '2026-10-18' });
    expect(fieldErrors(() => dateOnlyRange('2026-10-18', '2026-10-17', days))).toMatchObject([
      { path: 'filter' },
    ]);
    expect(fieldErrors(() => dateOnlyRange('2026-02-30', null, days))).toMatchObject([
      { path: 'filter' },
    ]);
  });

  it('checks finite numbers, integers and patterns', () => {
    expect(finite(0.1, 'odometerKm', 0, 9999999.9)).toBe(0.1);
    expect(integer(2100, 'modelYear', 1950, 2100)).toBe(2100);
    expect(optionalPattern(' +359 ', 'phone', 20, /^\+?[0-9]+$/, 'Phone')).toBe('+359');
    expect(optionalPattern('  ', 'phone', 20, /^\+?[0-9]+$/, 'Phone')).toBeNull();
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -0.1, '1']) {
      expect(fieldErrors(() => finite(value, 'odometerKm', 0, 10))).toMatchObject([
        { path: 'odometerKm' },
      ]);
    }
    expect(fieldErrors(() => integer(1949, 'modelYear', 1950, 2100))).toMatchObject([
      { path: 'modelYear' },
    ]);
    expect(fieldErrors(() => optionalPattern('12a', 'phone', 20, /^\d+$/, 'Phone'))).toEqual([
      { path: 'phone', message: 'Phone', code: 'INVALID_FORMAT' },
    ]);
  });

  it('validates sort fields and directions on the sort path', () => {
    expect(sortField(undefined, ['NAME', 'CREATED_AT'], 'NAME')).toBe('NAME');
    expect(sortDirection('DESC', 'ASC')).toBe('DESC');
    expect(fieldErrors(() => sortField('OTHER', ['NAME'], 'NAME'))).toMatchObject([
      { path: 'sort' },
    ]);
    expect(fieldErrors(() => sortDirection('UP', 'ASC'))).toMatchObject([{ path: 'sort' }]);
  });

  it('reports every field error in one BAD_USER_INPUT', () => {
    expect(
      fieldErrors(() =>
        invalidFields([
          { path: 'fleetNumber', message: 'Fleet number is taken.' },
          { path: 'vin', message: 'VIN is taken.' },
        ]),
      ),
    ).toEqual([
      { path: 'fleetNumber', message: 'Fleet number is taken.', code: 'INVALID_VALUE' },
      { path: 'vin', message: 'VIN is taken.', code: 'INVALID_VALUE' },
    ]);
  });

  it.each([
    { code: 'REQUIRED', action: () => text(undefined, 'name', 3) },
    { code: 'REQUIRED', action: () => text('   ', 'name', 3) },
    { code: 'INVALID_TYPE', action: () => text(3, 'name', 3) },
    { code: 'TOO_LONG', action: () => text('😀'.repeat(4), 'name', 3) },
    { code: 'INVALID_FORMAT', action: () => text('a\u0000b', 'name', 3) },
    { code: 'INVALID_TYPE', action: () => integer('1', 'name', 0, 3) },
    { code: 'NOT_INTEGER', action: () => integer(1.5, 'name', 0, 3) },
    { code: 'OUT_OF_RANGE', action: () => integer(4, 'name', 0, 3) },
    { code: 'INVALID_FORMAT', action: () => finite(Number.NaN, 'name', 0, 3) },
    { code: 'OUT_OF_RANGE', action: () => finite(-1, 'name', 0, 3) },
    { code: 'UNSUPPORTED_VALUE', action: () => enumValue('OTHER', ['A'], 'name') },
    { code: 'INVALID_TYPE', action: () => enumList('A', ['A'], 'name', 1) },
    { code: 'DUPLICATE_VALUE', action: () => enumList(['A', 'A'], ['A'], 'name', 2) },
    { code: 'TOO_MANY_ITEMS', action: () => enumList(['A', 'B'], ['A', 'B'], 'name', 1) },
    { code: 'INVALID_TYPE', action: () => ids('id', 'name') },
    {
      code: 'TOO_MANY_ITEMS',
      action: () =>
        ids(
          Array.from({ length: 101 }, () => 'id'),
          'name',
        ),
    },
  ])('emits $code for an invalid generic value', ({ code, action }) => {
    expect(fieldErrors(action)).toMatchObject([{ path: 'name', code }]);
  });

  it('uses stable reasons for invalid filters, search and ranges', () => {
    expect(fieldErrors(() => idList([], 'groupIds'))).toMatchObject([
      { path: 'filter', code: 'REQUIRED' },
    ]);
    expect(fieldErrors(() => integerFilter(1.5, 'days', 0, 3))).toMatchObject([
      { path: 'filter', code: 'NOT_INTEGER' },
    ]);
    expect(fieldErrors(() => numberFilter(4, 'score', 0, 3))).toMatchObject([
      { path: 'filter', code: 'OUT_OF_RANGE' },
    ]);
    expect(fieldErrors(() => searchTokens('a b c d e f'))).toMatchObject([
      { path: 'search', code: 'TOO_MANY_ITEMS' },
    ]);
    expect(fieldErrors(() => searchTokens('a\u0000b'))).toMatchObject([
      { path: 'search', code: 'INVALID_FORMAT' },
    ]);
    expect(
      fieldErrors(() => dateOnlyRange('2026-10-18', '2026-10-17', { from: 'from', to: 'to' })),
    ).toMatchObject([{ path: 'filter', code: 'INVALID_RANGE' }]);
  });

  it.each([
    { value: undefined, code: 'REQUIRED' },
    { value: null, code: 'REQUIRED' },
    { value: ' \t ', code: 'REQUIRED' },
    { value: 3, code: 'INVALID_TYPE' },
    { value: '😀'.repeat(4), code: 'TOO_LONG' },
    { value: 'a\u0000b', code: 'INVALID_FORMAT' },
  ])('classifies supported-text failures as $code', ({ value, code }) => {
    expect(textErrorCode(value, 3)).toBe(code);
  });

  it('preserves explicit semantic codes independently of compatibility messages', () => {
    expect(fieldErrors(() => invalid('name', 'Same message.', 'ALREADY_EXISTS'))).toEqual([
      { path: 'name', message: 'Same message.', code: 'ALREADY_EXISTS' },
    ]);
    expect(fieldErrors(() => invalid('name', 'Same message.'))).toEqual([
      { path: 'name', message: 'Same message.', code: 'INVALID_VALUE' },
    ]);
    expect(
      fieldErrors(() =>
        invalidFields([{ path: 'name', message: 'Same message.', code: 'REQUIRED' }]),
      ),
    ).toEqual([{ path: 'name', message: 'Same message.', code: 'REQUIRED' }]);
  });

  it('reads unique violations from the pg adapter error by index or columns', () => {
    expect(
      uniqueViolation(
        prismaError('P2002', {
          driverAdapterError: adapterError({ index: 'Vehicle_tenantId_branchId_vin_key' }),
          modelName: 'Vehicle',
        }),
      ),
    ).toEqual({ index: 'Vehicle_tenantId_branchId_vin_key', fields: [] });
    expect(
      uniqueViolation(
        prismaError('P2002', {
          driverAdapterError: adapterError({ fields: ['"tenantId"', '"branchId"', '"vin"'] }),
        }),
      ),
    ).toEqual({ index: null, fields: ['tenantId', 'branchId', 'vin'] });
    expect(
      uniqueViolation(prismaError('P2002', { driverAdapterError: new Error('no cause') })),
    ).toEqual({ index: null, fields: [] });
    expect(uniqueViolation(prismaError('P2002'))).toEqual({ index: null, fields: [] });
    expect(uniqueViolation(prismaError('P2003'))).toBeNull();
    expect(uniqueViolation(new Error('P2002'))).toBeNull();
  });

  it('maps unique violations to the indexed field or to an unmapped duplicate error', () => {
    const indexes = new Map([
      ['Vehicle_tenantId_branchId_vin_key', { path: 'vin', message: 'VIN is taken.' }],
    ]);
    for (const constraint of [
      { index: 'Vehicle_tenantId_branchId_vin_key' },
      { fields: ['tenantId', 'branchId', 'vin'] },
    ]) {
      expect(
        fieldErrors(() => {
          rethrowUniqueViolation(
            prismaError('P2002', { driverAdapterError: adapterError(constraint) }),
            indexes,
          );
        }),
      ).toEqual([{ path: 'vin', message: 'VIN is taken.', code: 'INVALID_VALUE' }]);
    }
    expect(() => {
      rethrowUniqueViolation(prismaError('P2002'), indexes);
    }).toThrow('A value that must be unique is already used.');
    expect(
      fieldErrors(() => {
        rethrowUniqueViolation(prismaError('P2002'), indexes);
      }),
    ).toBeUndefined();
    expect(() => {
      rethrowUniqueViolation(prismaError('P2003'), indexes);
    }).not.toThrow();
  });

  it('maps missing rows and blocked deletes', () => {
    expect(() => persistenceError(prismaError('P2025'), 'Driver')).toThrow(NotFoundException);
    expect(() => persistenceError(prismaError('P2003'), 'Driver', 'Set it inactive.')).toThrow(
      new ConflictException('Set it inactive.'),
    );
    const other = new Error('database down');
    expect(() => persistenceError(other, 'Driver')).toThrow(other);
  });
});
