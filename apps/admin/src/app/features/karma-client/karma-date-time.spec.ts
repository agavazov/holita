import { karmaDateControl, karmaDateParameter } from './karma-date-time';

describe('Karma DatePicker clock strings', () => {
  it('preserves UTC or unspecified API clock fields without browser-zone conversion', () => {
    for (const value of ['2026-03-29T03:30:45', '2026-10-25T03:30:00', '2026-01-01T00:00:00']) {
      expect(karmaDateControl(value)).toBe(value.replace('T', ' '));
      expect(karmaDateParameter(karmaDateControl(value))).toBe(value);
    }
  });

  it('hydrates minute-precision bookmarks with seconds and clears nullable picker values', () => {
    expect(karmaDateControl('2026-01-01T08:15')).toBe('2026-01-01 08:15:00');
    expect(karmaDateControl('')).toBe('');
    expect(karmaDateParameter('')).toBe('');
    expect(karmaDateParameter(null)).toBe('');
  });

  it('leaves malformed input available for the existing filter validation', () => {
    expect(karmaDateParameter('invalid date')).toBe('invalidTdate');
    expect(karmaDateControl('2026-02-30T08:15:00')).toBe('2026-02-30 08:15:00');
  });
});
