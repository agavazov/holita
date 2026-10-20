import { expectCatalogParity } from '../../../../i18n/catalog-parity';
import bg from './bg.json';
import en from './en.json';
import { alertsText } from './messages';
describe('Alerts messages', () => {
  it('keeps Bulgarian and English keys and placeholders in parity', () => {
    expectCatalogParity(bg, en);
  });
  it('selects the active language', () => {
    expect(alertsText('bg')).toBe(bg);
    expect(alertsText('en')).toBe(en);
  });
});
