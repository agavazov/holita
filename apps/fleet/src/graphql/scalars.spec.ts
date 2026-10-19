import { describe, expect, it } from '@jest/globals';
import { Kind } from 'graphql';
import {
  DateScalar,
  DateTimeScalar,
  dateOnlyToDate,
  dateToDateOnly,
  isDateOnly,
} from './scalars.js';

describe('Fleet scalars', () => {
  it('serializes DateTime instants in UTC with milliseconds and rejects other values', () => {
    expect(DateTimeScalar.serialize(new Date('2026-10-18T09:30:00+03:00'))).toBe(
      '2026-10-18T06:30:00.000Z',
    );
    for (const value of ['2026-10-18T06:30:00.000Z', new Date(Number.NaN), 0, null]) {
      expect(() => DateTimeScalar.serialize(value)).toThrow('DateTime cannot represent');
    }
  });

  it('parses DateTime and Date inputs leniently as strings only', () => {
    expect(DateTimeScalar.parseValue('not validated here')).toBe('not validated here');
    expect(DateScalar.parseValue('2026-02-30')).toBe('2026-02-30');
    expect(DateTimeScalar.parseLiteral({ kind: Kind.STRING, value: 'x' })).toBe('x');
    expect(DateScalar.parseLiteral({ kind: Kind.STRING, value: '2026-10-18' })).toBe('2026-10-18');
    for (const scalar of [DateTimeScalar, DateScalar]) {
      expect(() => scalar.parseValue(20261018)).toThrow('must be a string');
      expect(() => scalar.parseLiteral({ kind: Kind.INT, value: '20261018' })).toThrow(
        'must be a string',
      );
    }
  });

  it('serializes Date from UTC-midnight instants or valid date strings', () => {
    expect(DateScalar.serialize(new Date('2026-10-18T00:00:00.000Z'))).toBe('2026-10-18');
    expect(DateScalar.serialize('2028-02-29')).toBe('2028-02-29');
    for (const value of [
      new Date('2026-10-18T00:00:00.001Z'),
      '2026-02-29',
      '2026-10-18T00:00:00Z',
      20261018,
    ]) {
      expect(() => DateScalar.serialize(value)).toThrow('Date cannot represent');
    }
  });

  it('converts calendar dates through UTC midnight', () => {
    expect(dateOnlyToDate('2026-10-18').toISOString()).toBe('2026-10-18T00:00:00.000Z');
    expect(dateToDateOnly(new Date('2026-10-18T23:59:59.999Z'))).toBe('2026-10-18');
    expect(isDateOnly('2024-02-29')).toBe(true);
    expect(isDateOnly('2026-02-29')).toBe(false);
    expect(isDateOnly('2026-04-31')).toBe(false);
    expect(isDateOnly('26-04-01')).toBe(false);
  });
});
