import bg from './bg.json';
import en from './en.json';
import { overviewText } from './messages';
import { expectCatalogParity } from '../../../../i18n/catalog-parity';

describe('Overview catalog', () => {
  it('keeps Bulgarian key and interpolation parity', () => {
    expectCatalogParity(bg, en);
    expect(overviewText('bg').title).toBe('Преглед');
  });
});
