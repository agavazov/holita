import { fromDateOnly, isoToZonedParts, toDateOnly, zonedWallTimeToIso } from './zoned-time';

describe('zoned time', () => {
  it('converts Sofia wall time to instants across DST', () => {
    expect(
      zonedWallTimeToIso({ year: 2026, month: 10, day: 18, hour: 9, minute: 30 }, 'Europe/Sofia'),
    ).toBe('2026-10-18T06:30:00.000Z');
    expect(
      zonedWallTimeToIso({ year: 2026, month: 1, day: 15, hour: 9, minute: 30 }, 'Europe/Sofia'),
    ).toBe('2026-01-15T07:30:00.000Z');
    // Autumn overlap: the first 03:30 (EEST).
    expect(
      zonedWallTimeToIso({ year: 2026, month: 10, day: 25, hour: 3, minute: 30 }, 'Europe/Sofia'),
    ).toBe('2026-10-25T00:30:00.000Z');
    // Spring gap: 03:30 does not exist and resolves after the gap (04:30 EEST).
    expect(
      zonedWallTimeToIso({ year: 2026, month: 3, day: 29, hour: 3, minute: 30 }, 'Europe/Sofia'),
    ).toBe('2026-03-29T01:30:00.000Z');
  });

  it('reads the wall-clock parts of an instant', () => {
    expect(isoToZonedParts('2026-10-25T01:30:00.000Z', 'Europe/Sofia')).toEqual({
      year: 2026,
      month: 10,
      day: 25,
      hour: 3,
      minute: 30,
    });
    expect(isoToZonedParts('nope', 'Europe/Sofia')).toBeNull();
  });

  it('converts DatePicker dates to calendar dates and back', () => {
    expect(toDateOnly(new Date(2026, 9, 18, 23, 59))).toBe('2026-10-18');
    expect(fromDateOnly('2026-10-18')?.getDate()).toBe(18);
    expect(fromDateOnly('2026-02-30')).toBeNull();
    expect(fromDateOnly('')).toBeNull();
  });
});
