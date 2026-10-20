import { expectCatalogParity } from '../../../../i18n/catalog-parity';
import bg from './bg.json';
import en from './en.json';
import { vehiclesText } from './messages';

describe('Vehicles catalogs', () => {
  it('have identical keys, non-empty texts and placeholders in Bulgarian and English', () => {
    expect(() => {
      expectCatalogParity(bg, en);
    }).not.toThrow();
  });

  it('selects the catalog for the active product language', () => {
    expect(vehiclesText('bg')).toBe(bg);
    expect(vehiclesText('en')).toBe(en);
  });
});
