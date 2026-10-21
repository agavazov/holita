import { expectCatalogParity } from '../../../i18n/catalog-parity';
import { karmaFilterErrors } from './karma-filter-errors';
import bg from './i18n/bg.json';
import en from './i18n/en.json';

describe('Karma filter field errors', () => {
  it('keeps translated messages and placeholders in parity', () => {
    expectCatalogParity(en, bg);
  });

  it('requires profile dates, permits absent history dates and identifies the missing paired date', () => {
    expect(karmaFilterErrors('edata', { from: '', to: '' }, 'en')).toEqual({});
    expect(karmaFilterErrors('trips', { from: '', to: '' }, 'en')).toEqual({});
    expect(karmaFilterErrors('profile', { from: '', to: '' }, 'en')).toEqual({
      from: { message: en.requiredDate },
      to: { message: en.requiredDate },
    });
    expect(karmaFilterErrors('events', { from: '2026-01-01T00:00:00', to: '' }, 'bg')).toEqual({
      to: { message: bg.pairedDate },
    });
  });

  it('identifies invalid calendar dates, clock fields and reversed periods without timezone conversion', () => {
    expect(
      karmaFilterErrors('edata', { from: '2026-02-30T03:30:00', to: '2026-03-01T25:00:00' }, 'en'),
    ).toEqual({
      from: { message: en.date },
      to: { message: en.time, part: 'time' },
    });
    expect(
      karmaFilterErrors('trips', { from: '2026-03-29T03:30:00', to: '2026-03-29T03:45:00' }, 'en'),
    ).toEqual({});
    expect(
      karmaFilterErrors(
        'profile',
        { from: '2026-01-02T00:00:00', to: '2026-01-01T00:00:00' },
        'en',
      ),
    ).toEqual({ to: { message: en.dateOrder } });
  });

  it('uses the API parsers for page sizes and parameter/event ID bounds, including event zero', () => {
    const draft = { from: '', to: '' };
    expect(karmaFilterErrors('edata', { ...draft, size: 500, parameters: '0' }, 'en')).toEqual({
      size: { message: en.pageSize },
      parameters: { message: en.parameterIds },
    });
    expect(karmaFilterErrors('events', { ...draft, types: '0, 33' }, 'en')).toEqual({});
    for (const types of ['-1', '1,,2', '9007199254740992', Array(26).fill('0').join(',')]) {
      expect(karmaFilterErrors('events', { ...draft, types }, 'en')).toEqual({
        types: { message: en.eventCodes },
      });
    }
    const parameters = Array.from({ length: 25 }, (_, index) => String(index + 1)).join(',');
    expect(karmaFilterErrors('edata', { ...draft, parameters }, 'en')).toEqual({});
    expect(karmaFilterErrors('edata', { ...draft, parameters: parameters + ',26' }, 'en')).toEqual({
      parameters: { message: en.parameterIds },
    });
  });
});
