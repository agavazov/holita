import { expectCatalogParity } from '../../../../i18n/catalog-parity';
import bg from './bg.json';
import en from './en.json';
import { tripsText } from './messages';
describe('Trips messages', () => {
  it('keeps Bulgarian and English keys and placeholders in parity', () => {
    expectCatalogParity(bg, en);
  });
  it('selects the active language', () => {
    expect(tripsText('bg')).toBe(bg);
    expect(tripsText('en')).toBe(en);
  });
});
