import { expectCatalogParity } from '../../../../i18n/catalog-parity';
import bg from './bg.json';
import en from './en.json';
import { driversText } from './messages';

describe('Drivers catalogs', () => {
  it('preserves all keys and placeholders in Bulgarian and English', () => {
    expect(() => {
      expectCatalogParity(bg, en);
    }).not.toThrow();
    expect(driversText('bg')).toBe(bg);
    expect(driversText('en')).toBe(en);
  });
});
