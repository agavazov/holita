import { expectCatalogParity } from '../../../../i18n/catalog-parity';
import bg from './bg.json';
import en from './en.json';
import { deviceConfigurationText } from './messages';

describe('Device configuration catalogs', () => {
  it('preserves Bulgarian and English keys and placeholders', () => {
    expect(() => {
      expectCatalogParity(bg, en);
    }).not.toThrow();
    expect(deviceConfigurationText('bg')).toBe(bg);
    expect(deviceConfigurationText('en')).toBe(en);
  });
});
