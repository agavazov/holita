import { expectCatalogParity } from '../../../../i18n/catalog-parity';
import bg from './bg.json';
import en from './en.json';
import { maintenanceText } from './messages';
describe('Maintenance messages', () => {
  it('keeps Bulgarian and English keys and placeholders in parity', () => {
    expectCatalogParity(bg, en);
  });
  it('selects the active language', () => {
    expect(maintenanceText('bg')).toBe(bg);
    expect(maintenanceText('en')).toBe(en);
  });
});
