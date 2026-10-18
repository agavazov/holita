import bg from './bg.json';
import en from './en.json';
import { catalogParityProblems } from './catalog-parity';
import { readLanguage } from './messages';

describe('application catalogs', () => {
  it('have identical keys, non-empty texts and placeholders in Bulgarian and English', () => {
    expect(catalogParityProblems(bg, en)).toEqual([]);
  });

  it('reads the route language with Bulgarian as the default', () => {
    expect(readLanguage('en')).toBe('en');
    expect(readLanguage('de')).toBe('bg');
    expect(readLanguage(null)).toBe('bg');
  });
});
