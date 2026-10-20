import { expectCatalogParity } from '../../../../i18n/catalog-parity';
import bg from './bg.json';
import en from './en.json';
import { settingsText } from './messages';

describe('Fleet settings messages', () => {
  it('keeps Bulgarian and English keys and placeholders in parity', () => {
    expectCatalogParity(bg, en);
  });

  it('selects the active language without an English fallback', () => {
    expect(settingsText('bg')).toBe(bg);
    expect(settingsText('en')).toBe(en);
    expect(settingsText('bg').groups.drawer.name).toBe('Име');
  });
});
