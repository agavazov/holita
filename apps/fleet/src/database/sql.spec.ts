import { describe, expect, it } from '@jest/globals';
import { containsPattern } from './search.js';
import {
  booleanOrNull,
  date,
  dateOrNull,
  fleetTable,
  integer,
  integerOrNull,
  number,
  numberOrNull,
  oneOf,
  oneOfOrNull,
  recordOf,
  rowsOf,
  text,
  textOrNull,
} from './sql.js';

describe('Fleet raw SQL helpers', () => {
  it('quotes the schema and accepts only the Fleet tables', () => {
    expect(fleetTable('test_abc', 'Trip').sql).toBe('"test_abc"."Trip"');
    expect(fleetTable('we"ird', 'VehicleStatusSample').sql).toBe('"we""ird"."VehicleStatusSample"');
    expect(fleetTable('public', 'ServiceTask').values).toEqual([]);
    // TypeScript already rejects other names; a direct call still fails at runtime.
    expect(() => {
      Reflect.apply(fleetTable, undefined, ['public', 'Trip"; DROP TABLE "Vehicle']);
    }).toThrow('Unknown Fleet table');
    expect(() => fleetTable('', 'Trip')).toThrow('Invalid Fleet database schema name');
  });

  it('reads typed row fields and rejects wrong shapes', () => {
    const row = recordOf({
      id: 'a',
      title: null,
      kind: 'OPEN',
      count: 3,
      ratio: 1.5,
      at: new Date('2026-10-18T06:30:00.000Z'),
      iso: '2026-10-18T06:30:00.000Z',
      flag: true,
    });
    expect(text(row, 'id')).toBe('a');
    expect(textOrNull(row, 'title')).toBeNull();
    expect(oneOf(row, 'kind', ['OPEN', 'RESOLVED'])).toBe('OPEN');
    expect(oneOfOrNull(row, 'title', ['OPEN'])).toBeNull();
    expect(integer(row, 'count')).toBe(3);
    expect(number(row, 'ratio')).toBe(1.5);
    expect(numberOrNull(row, 'title')).toBeNull();
    expect(date(row, 'at').toISOString()).toBe('2026-10-18T06:30:00.000Z');
    expect(dateOrNull(row, 'iso')?.toISOString()).toBe('2026-10-18T06:30:00.000Z');
    expect(booleanOrNull(row, 'flag')).toBe(true);
    for (const read of [
      () => text(row, 'count'),
      () => text(row, 'missing'),
      () => oneOf(row, 'kind', ['ACKNOWLEDGED']),
      () => integer(row, 'ratio'),
      () => integerOrNull(row, 'id'),
      () => number(row, 'title'),
      () => date(row, 'id'),
      () => booleanOrNull(row, 'count'),
    ])
      expect(read).toThrow('Unexpected database value');
    expect(() => recordOf(null)).toThrow('Unexpected database row');
    expect(() => recordOf([1])).toThrow('Unexpected database row');
    expect(() => rowsOf({}, (value) => value)).toThrow('Unexpected database result');
    expect(rowsOf([{ id: 'x' }], (value) => text(value, 'id'))).toEqual(['x']);
    expect(() => numberOrNull(recordOf({ value: Number.NaN }), 'value')).toThrow();
  });

  it('builds literal ILIKE patterns', () => {
    expect(containsPattern('50%_\\')).toBe('%50\\%\\_\\\\%');
  });
});
