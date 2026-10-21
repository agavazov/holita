import {
  fromDateOnly,
  isoToZonedParts,
  isoToZonedWallTime,
  toDateOnly,
  zonedWallTimeInstants,
  zonedWallTimeToIso,
} from './zoned-time';

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

  it('formats native input text with seconds and milliseconds in the requested zone', () => {
    const instant = '2026-10-18T07:00:45.125Z';
    expect(isoToZonedWallTime(instant, 'America/New_York')).toBe('2026-10-18T03:00:45.125');
    expect(isoToZonedWallTime(instant, 'Asia/Kathmandu')).toBe('2026-10-18T12:45:45.125');
    expect(isoToZonedWallTime('invalid', 'UTC')).toBeNull();
    expect(zonedWallTimeInstants('2026-10-18T12:45:45.125', 'Asia/Kathmandu')).toEqual([
      Date.parse(instant),
    ]);
  });

  it('keeps real wall times even when another zone skips them', () => {
    const instant = '2026-03-29T03:30:15.125Z';
    const wallTime = isoToZonedWallTime(instant, 'UTC');
    expect(wallTime).toBe('2026-03-29T03:30:15.125');
    expect(zonedWallTimeInstants(wallTime, 'UTC')).toEqual([Date.parse(instant)]);
    expect(zonedWallTimeInstants(wallTime, 'Europe/Sofia')).toEqual([]);
  });

  it('returns both overlap occurrences, including half-hour changes, in instant order', () => {
    expect(zonedWallTimeInstants('2026-10-25T03:30:45.125', 'Europe/Sofia')).toEqual([
      Date.parse('2026-10-25T00:30:45.125Z'),
      Date.parse('2026-10-25T01:30:45.125Z'),
    ]);
    expect(zonedWallTimeInstants('2026-04-05T01:45:20.125', 'Australia/Lord_Howe')).toEqual([
      Date.parse('2026-04-04T14:45:20.125Z'),
      Date.parse('2026-04-04T15:15:20.125Z'),
    ]);
    expect(zonedWallTimeInstants('2026-03-08T02:30', 'America/New_York')).toEqual([]);
  });

  it.each([
    null,
    '',
    'invalid',
    '2026-02-30T12:00',
    '2026-13-01T12:00',
    '2026-10-18T24:00',
    '2026-10-18T12:60',
    '2026-10-18T12:00:60',
    '2026-10-18T12:00:00.1234',
    '2026-10-18',
    '2026-10-18T12:00Z',
  ])('rejects invalid floating time %s instead of normalizing it', (wallTime) => {
    expect(zonedWallTimeInstants(wallTime, 'UTC')).toEqual([]);
  });

  it('accepts native minute precision and one/two-digit fractional seconds', () => {
    expect(zonedWallTimeInstants('2026-10-18T12:00', 'UTC')).toEqual([
      Date.parse('2026-10-18T12:00:00.000Z'),
    ]);
    expect(zonedWallTimeInstants('2026-10-18T12:00:15.1', 'UTC')).toEqual([
      Date.parse('2026-10-18T12:00:15.100Z'),
    ]);
    expect(zonedWallTimeInstants('2026-10-18T12:00:15.12', 'UTC')).toEqual([
      Date.parse('2026-10-18T12:00:15.120Z'),
    ]);
  });

  it('converts DatePicker dates to calendar dates and back', () => {
    expect(toDateOnly(new Date(2026, 9, 18, 23, 59))).toBe('2026-10-18');
    expect(fromDateOnly('2026-10-18')?.getDate()).toBe(18);
    expect(fromDateOnly('2026-02-30')).toBeNull();
    expect(fromDateOnly('')).toBeNull();
  });
});
