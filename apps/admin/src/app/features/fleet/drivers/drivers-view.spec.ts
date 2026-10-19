import { daysUntil, documentWarningDays } from './drivers-view';

describe('driver document expiry', () => {
  it('uses calendar days without treating an expiry today as already expired', () => {
    expect(daysUntil('2026-10-18', '2026-10-18')).toBe(0);
    expect(daysUntil('2026-10-17', '2026-10-18')).toBe(-1);
    expect(daysUntil('2026-11-17', '2026-10-18')).toBe(documentWarningDays);
    expect(daysUntil('2026-11-18', '2026-10-18')).toBe(31);
  });
});
