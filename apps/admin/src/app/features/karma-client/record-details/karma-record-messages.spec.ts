import { expectCatalogParity } from '../../../i18n/catalog-parity';
import bg from './i18n/bg.json';
import en from './i18n/en.json';

describe('Karma record detail messages', () => {
  it('keeps all summary and source headings translated', () => {
    expectCatalogParity(en, bg);
  });
});
