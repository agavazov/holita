import {
  fromDateOnly,
  isoToZonedParts,
  isoToZonedWallTime,
  toDateOnly,
  zonedWallTimeInstants,
  zonedWallTimeToIso,
} from './zoned-time';

describe('zoned time', () => {
  it('zoned wall time and instants convert exactly across DST gaps and overlaps', () => {
    const rows: readonly {
      readonly row: string;
      readonly actual: unknown;
      readonly expected: unknown;
    }[] = [
      {
        row: 'Sofia summer wall time',
        actual: zonedWallTimeToIso(
          { year: 2026, month: 10, day: 18, hour: 9, minute: 30 },
          'Europe/Sofia',
        ),
        expected: '2026-10-18T06:30:00.000Z',
      },
      {
        row: 'Sofia winter wall time',
        actual: zonedWallTimeToIso(
          { year: 2026, month: 1, day: 15, hour: 9, minute: 30 },
          'Europe/Sofia',
        ),
        expected: '2026-01-15T07:30:00.000Z',
      },
      {
        row: 'Sofia autumn overlap resolves to the first 03:30',
        actual: zonedWallTimeToIso(
          { year: 2026, month: 10, day: 25, hour: 3, minute: 30 },
          'Europe/Sofia',
        ),
        expected: '2026-10-25T00:30:00.000Z',
      },
      {
        row: 'Sofia spring gap resolves after the gap',
        actual: zonedWallTimeToIso(
          { year: 2026, month: 3, day: 29, hour: 3, minute: 30 },
          'Europe/Sofia',
        ),
        expected: '2026-03-29T01:30:00.000Z',
      },
      {
        row: 'Sofia parts of the second 03:30',
        actual: isoToZonedParts('2026-10-25T01:30:00.000Z', 'Europe/Sofia'),
        expected: { year: 2026, month: 10, day: 25, hour: 3, minute: 30 },
      },
      {
        row: 'parts of an invalid instant',
        actual: isoToZonedParts('nope', 'Europe/Sofia'),
        expected: null,
      },
      {
        row: 'New York input text keeps seconds and milliseconds',
        actual: isoToZonedWallTime('2026-10-18T07:00:45.125Z', 'America/New_York'),
        expected: '2026-10-18T03:00:45.125',
      },
      {
        row: 'Kathmandu +05:45 input text',
        actual: isoToZonedWallTime('2026-10-18T07:00:45.125Z', 'Asia/Kathmandu'),
        expected: '2026-10-18T12:45:45.125',
      },
      {
        row: 'input text of an invalid instant',
        actual: isoToZonedWallTime('invalid', 'UTC'),
        expected: null,
      },
      {
        row: 'Kathmandu input text back to its instant',
        actual: zonedWallTimeInstants('2026-10-18T12:45:45.125', 'Asia/Kathmandu'),
        expected: [Date.parse('2026-10-18T07:00:45.125Z')],
      },
      {
        row: 'UTC keeps a wall time that Sofia skips',
        actual: isoToZonedWallTime('2026-03-29T03:30:15.125Z', 'UTC'),
        expected: '2026-03-29T03:30:15.125',
      },
      {
        row: 'UTC wall time back to its instant',
        actual: zonedWallTimeInstants('2026-03-29T03:30:15.125', 'UTC'),
        expected: [Date.parse('2026-03-29T03:30:15.125Z')],
      },
      {
        row: 'Sofia spring gap has no instant',
        actual: zonedWallTimeInstants('2026-03-29T03:30:15.125', 'Europe/Sofia'),
        expected: [],
      },
      {
        row: 'Sofia autumn overlap has both instants in order',
        actual: zonedWallTimeInstants('2026-10-25T03:30:45.125', 'Europe/Sofia'),
        expected: [Date.parse('2026-10-25T00:30:45.125Z'), Date.parse('2026-10-25T01:30:45.125Z')],
      },
      {
        row: 'Lord Howe half-hour overlap has both instants in order',
        actual: zonedWallTimeInstants('2026-04-05T01:45:20.125', 'Australia/Lord_Howe'),
        expected: [Date.parse('2026-04-04T14:45:20.125Z'), Date.parse('2026-04-04T15:15:20.125Z')],
      },
      {
        row: 'New York spring gap has no instant',
        actual: zonedWallTimeInstants('2026-03-08T02:30', 'America/New_York'),
        expected: [],
      },
      {
        row: 'native minute precision',
        actual: zonedWallTimeInstants('2026-10-18T12:00', 'UTC'),
        expected: [Date.parse('2026-10-18T12:00:00.000Z')],
      },
      {
        row: 'one fractional second digit',
        actual: zonedWallTimeInstants('2026-10-18T12:00:15.1', 'UTC'),
        expected: [Date.parse('2026-10-18T12:00:15.100Z')],
      },
      {
        row: 'two fractional second digits',
        actual: zonedWallTimeInstants('2026-10-18T12:00:15.12', 'UTC'),
        expected: [Date.parse('2026-10-18T12:00:15.120Z')],
      },
      {
        row: 'DatePicker date to calendar date',
        actual: toDateOnly(new Date(2026, 9, 18, 23, 59)),
        expected: '2026-10-18',
      },
      {
        row: 'calendar date to DatePicker date',
        actual: fromDateOnly('2026-10-18')?.getDate(),
        expected: 18,
      },
      { row: 'impossible calendar date', actual: fromDateOnly('2026-02-30'), expected: null },
    ];
    for (const { row, actual, expected } of rows) {
      expect(actual, row).toEqual(expected);
    }
    for (const wallTime of [
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
    ]) {
      expect(zonedWallTimeInstants(wallTime, 'UTC'), `invalid ${String(wallTime)}`).toEqual([]);
    }
  });
});
