import { describe, expect, it } from 'vitest';
import { dayjs, eventTime, eventInstant } from './event-time.js';
import { eventListFilters, readEventList } from './event-list-state.js';
describe('Europe/Sofia event time', () => {
  it('converts wall-clock values using the date-specific winter and summer offsets', () => {
    expect(eventInstant(dayjs('2026-07-01 12:30'))).toBe('2026-07-01T09:30:00.000Z');
    expect(eventInstant(dayjs('2026-12-01 12:30'))).toBe('2026-12-01T10:30:00.000Z');
    expect(eventTime('2026-12-01T10:30:00Z').format('YYYY-MM-DD HH:mm')).toBe('2026-12-01 12:30');
  });
  it('rejects a nonexistent time during the spring clock change', () => {
    expect(() => eventInstant(dayjs.utc('2026-03-29 03:30'))).toThrow('does not exist');
  });
  it('preserves both stored instants in the repeated autumn hour when saving an edit', () => {
    for (const instant of ['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z']) {
      expect(eventTime(instant).format('YYYY-MM-DD HH:mm')).toBe('2026-10-25 03:30');
      expect(eventInstant(eventTime(instant))).toBe(instant);
    }
  });
  it('recalculates a picker offset when moving a winter date into summer', () => {
    const value = eventTime('2026-12-01T10:30:00Z').month(6);
    expect(eventInstant(value)).toBe('2026-07-01T09:30:00.000Z');
  });
  it('filters complete calendar days across spring and autumn clock changes in Sofia', () => {
    for (const [date, from, before] of [
      ['2026-03-29', '2026-03-28T22:00:00.000Z', '2026-03-29T21:00:00.000Z'],
      ['2026-10-25', '2026-10-24T21:00:00.000Z', '2026-10-25T22:00:00.000Z'],
    ] as const)
      expect(eventListFilters(readEventList(`?from=${date}&to=${date}`))).toEqual([
        { field: 'startsAtFrom', operator: 'eq', value: from },
        { field: 'startsAtBefore', operator: 'eq', value: before },
      ]);
  });
});
