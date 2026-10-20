import { expectCatalogParity } from '../../../../i18n/catalog-parity';
import bg from './bg.json';
import en from './en.json';
import { devicesText } from './messages';

describe('Devices catalogs', () => {
  it('preserves all keys and placeholders in Bulgarian and English', () => {
    expect(() => {
      expectCatalogParity(bg, en);
    }).not.toThrow();
    expect(devicesText('bg')).toBe(bg);
    expect(devicesText('en')).toBe(en);
  });
});
