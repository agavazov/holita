import { catalogParityProblems, expectCatalogParity } from '../../i18n/catalog-parity';
import bg from './bg.json';
import en from './en.json';
import { interpolate } from './messages';

describe('design-system catalogs', () => {
  it('have identical keys, non-empty texts and placeholders in Bulgarian and English', () => {
    expect(() => {
      expectCatalogParity(bg, en);
    }).not.toThrow();
  });

  it('detects differences', () => {
    expect(
      catalogParityProblems(
        { a: 'x {n}', b: { c: 'y' }, d: ['1'], e: '' },
        { a: 'x', b: {}, d: ['1', '2'], e: 'z', f: 'w' },
      ),
    ).toEqual([
      'a: placeholders differ (n / )',
      'b.c: missing in en',
      'd: 1 / 2 items',
      'e: empty in bg',
      'f: missing in bg',
    ]);
  });

  it('interpolates named placeholders and keeps unknown ones', () => {
    expect(interpolate('{count} of {total}', { count: 2, total: '5' })).toBe('2 of 5');
    expect(interpolate('{missing}', {})).toBe('{missing}');
  });
});
