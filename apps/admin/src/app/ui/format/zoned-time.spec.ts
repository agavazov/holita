import {
  supportedDateFormats,
  formatDateOnly,
  formatDateTime,
  formatDateTimeCell,
  formatDateRange,
  formatDateTimeRange,
  datePickerFormat,
} from './format';
import {
  formatDateTimeInput,
  parseDateTimeInput,
  dateTimeInputInstants,
} from '../forms/date-time-input';
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
      {
        row: 'ISO date order ignores English words',
        actual: formatDateTime('2026-10-18T07:00:45.125Z', 'en', 'Europe/Sofia', true),
        expected: '2026-10-18 10:00:45',
      },
      {
        row: 'day-first hyphen order ignores Bulgarian words',
        actual: formatDateTime(
          '2026-10-18T07:00:45.125Z',
          'bg',
          'Asia/Kathmandu',
          false,
          'DD_MM_YYYY',
        ),
        expected: '18-10-2026 12:45',
      },
      {
        row: 'dotted date order and midnight zone crossing',
        actual: formatDateTime(
          '2026-10-18T23:00:45.125Z',
          'en',
          'Europe/Sofia',
          false,
          'DD_DOT_MM_DOT_YYYY',
        ),
        expected: '19.10.2026 02:00',
      },
      {
        row: 'calendar date retains its date-only meaning',
        actual: formatDateOnly('2026-10-18', 'en', 'DD_DOT_MM_DOT_YYYY'),
        expected: '18.10.2026',
      },
      {
        row: 'calendar date range shares the selected numeric order',
        actual: formatDateRange('2026-10-18', '2026-10-19', 'bg', 'DD_MM_YYYY'),
        expected: '18-10-2026 – 19-10-2026',
      },
      {
        row: 'instant range shares the selected numeric order and Branch zone',
        actual: formatDateTimeRange(
          '2026-10-18T23:00:00.000Z',
          '2026-10-19T00:00:00.000Z',
          'en',
          'Europe/Sofia',
          false,
          'DD_MM_YYYY',
        ),
        expected: '19-10-2026 02:00 – 19-10-2026 03:00',
      },
      {
        row: 'date cell retains the exact normalized UTC instant in its title',
        actual: formatDateTimeCell(
          '2026-10-18T10:00:45.125+03:00',
          'en',
          'Europe/Sofia',
          true,
          'DD_MM_YYYY',
        ),
        expected: { text: '18-10-2026 10:00:45', title: '2026-10-18T07:00:45.125Z' },
      },
      {
        row: 'all date picker formats have a four-digit year',
        actual: supportedDateFormats.map((format) => datePickerFormat(format)),
        expected: ['yy-mm-dd', 'dd-mm-yy', 'dd.mm.yy'],
      },
      {
        row: 'text adapter keeps selected order, seconds and milliseconds',
        actual: formatDateTimeInput(
          '2026-10-18T07:00:45.125Z',
          'Asia/Kathmandu',
          'DD_DOT_MM_DOT_YYYY',
        ),
        expected: '18.10.2026 12:45:45.125',
      },
      {
        row: 'text adapter round trips milliseconds',
        actual: parseDateTimeInput('18-10-2026 12:45:45.125', 'Asia/Kathmandu', 'DD_MM_YYYY'),
        expected: '2026-10-18T07:00:45.125Z',
      },
      {
        row: 'text adapter rejects a skipped wall time',
        actual: parseDateTimeInput('29.03.2026 03:30:45.125', 'Europe/Sofia', 'DD_DOT_MM_DOT_YYYY'),
        expected: null,
      },
      {
        row: 'unchanged text retains the second autumn occurrence and milliseconds',
        actual: parseDateTimeInput(
          '25-10-2026 03:30:45.125',
          'Europe/Sofia',
          'DD_MM_YYYY',
          '2026-10-25T01:30:45.125Z',
        ),
        expected: '2026-10-25T01:30:45.125Z',
      },
      {
        row: 'changed ambiguous input exposes both occurrences for bounded editors',
        actual: dateTimeInputInstants(
          '25.10.2026 03:30:45.125',
          'Europe/Sofia',
          'DD_DOT_MM_DOT_YYYY',
        ),
        expected: [Date.parse('2026-10-25T00:30:45.125Z'), Date.parse('2026-10-25T01:30:45.125Z')],
      },
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
