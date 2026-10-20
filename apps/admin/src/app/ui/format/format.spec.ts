import {
  formatDateOnly,
  formatDateTime,
  formatDistanceKm,
  formatDuration,
  formatLitres,
  formatMoneyCents,
  formatNumber,
  formatPercent,
  formatRelative,
  formatSpeed,
  formatTemperature,
  formatVolts,
} from './format';

const nbsp = ' ';

describe('formatting', () => {
  it('keeps null distinct from zero and groups by locale', () => {
    expect(formatNumber(null, 'bg')).toBe('—');
    expect(formatNumber(undefined, 'en')).toBe('—');
    expect(formatNumber(0, 'bg')).toBe('0');
    expect(formatNumber(1234, 'bg')).toBe(`1${nbsp}234`);
    expect(formatNumber(1234, 'en')).toBe('1,234');
    expect(formatNumber(12.345, 'bg', { fraction: 1 })).toBe('12,3');
    expect(formatNumber(Number.NaN, 'en')).toBe('—');
  });

  it.each(['en', 'bg'] as const)(
    'keeps tiny finite numbers distinct from zero with significant digits in %s',
    (language) => {
      const options = { significantDigits: 21 };
      const separator = language === 'bg' ? ',' : '.';
      expect(formatNumber(1e-21, language, options)).toBe(`0${separator}${'0'.repeat(20)}1`);
      expect(formatNumber(Number.MIN_VALUE, language, options)).toBe(
        `0${separator}${'0'.repeat(323)}5`,
      );
      expect(formatNumber(0, language, options)).toBe('0');
      expect(formatNumber(null, language, options)).toBe('—');
      expect(formatNumber(0.29, language, { fraction: 2 })).toBe(
        language === 'bg' ? '0,29' : '0.29',
      );
      expect(formatNumber(123.4, language, { fraction: 0 })).toBe('123');
    },
  );

  it('formats units from the catalogs', () => {
    expect(formatDistanceKm(12.34, 'bg')).toBe(`12,3${nbsp}км`);
    expect(formatSpeed(88, 'en')).toBe(`88${nbsp}km/h`);
    expect(formatLitres(0, 'bg')).toBe(`0${nbsp}л`);
    expect(formatVolts(24.1, 'en')).toBe(`24.1${nbsp}V`);
    expect(formatPercent(45, 'bg')).toBe('45%');
    expect(formatTemperature(-3.5, 'en')).toBe(`-3.5${nbsp}°C`);
    expect(formatDistanceKm(null, 'bg')).toBe('—');
  });

  it('formats euro cents', () => {
    expect(formatMoneyCents(null, 'bg')).toBe('—');
    expect(formatMoneyCents(0, 'bg')).toBe(`0,00${nbsp}€`);
    expect(formatMoneyCents(123_456, 'en')).toBe('€1,234.56');
  });

  it('formats instants in Sofia and calendar dates without conversion', () => {
    const instant = '2026-10-18T06:30:00.000Z';
    expect(formatDateTime(instant, 'bg', 'Europe/Sofia')).toBe('18.10.2026 09:30');
    expect(formatDateTime(instant, 'en', 'Europe/Sofia')).toBe('18 Oct 2026, 09:30');
    expect(formatDateTime('2026-01-15T22:30:00.000Z', 'bg', 'Europe/Sofia')).toBe(
      '16.01.2026 00:30',
    );
    expect(formatDateTime('not a date', 'bg', 'Europe/Sofia')).toBe('—');
    expect(formatDateOnly('2026-10-18', 'bg')).toBe('18.10.2026');
    expect(formatDateOnly('2026-10-18', 'en')).toBe('18 Oct 2026');
    expect(formatDateOnly('18.10.2026', 'en')).toBe('—');
  });

  it('formats relative times against an explicit reference', () => {
    const asOf = '2026-10-18T06:30:00.000Z';
    expect(formatRelative('2026-10-18T06:29:30.000Z', asOf, 'en')).toBe('just now');
    expect(formatRelative('2026-10-18T06:18:00.000Z', asOf, 'bg')).toBe('преди 12 мин');
    expect(formatRelative('2026-10-18T03:30:00.000Z', asOf, 'en')).toBe('3 h ago');
    expect(formatRelative('2026-10-14T06:30:00.000Z', asOf, 'en')).toBe('4 d ago');
    expect(formatRelative('2026-10-18T07:00:00.000Z', asOf, 'en')).toBe('in 30 min');
    expect(formatRelative(null, asOf, 'en')).toBe('—');
  });

  it('shows seconds when an instant is a precise reading bound', () => {
    const instant = '2026-10-18T06:30:45.125Z';
    expect(formatDateTime(instant, 'bg', 'Europe/Sofia', true)).toBe('18.10.2026 09:30:45');
    expect(formatDateTime(instant, 'en', 'Europe/Sofia', true)).toBe('18 Oct 2026, 09:30:45');
    expect(formatDateTime(instant, 'en', 'Europe/Sofia')).toBe('18 Oct 2026, 09:30');
    expect(formatDateTime(null, 'en', 'Europe/Sofia', true)).toBe('—');
  });

  it('formats durations', () => {
    expect(formatDuration(4020, 'bg')).toBe('1 ч 07 мин');
    expect(formatDuration(420, 'en')).toBe('7 min');
    expect(formatDuration(0, 'en')).toBe('0 min');
    expect(formatDuration(null, 'en')).toBe('—');
  });
});
