import { describe, expect, it } from 'vitest';

import { DataError } from '../data/data-error.js';
import { dictionaries, type TranslationKey } from './dictionaries.js';
import { localizedErrorMessage, localizedFieldError } from './data-error.js';

function translator(locale: 'bg' | 'en') {
  return (key: TranslationKey) => dictionaries[locale][key];
}

describe('localized data errors', () => {
  it.each([
    ['A product with this SKU already exists in this store', 'errors.duplicate'],
    ['Venue is still referenced.', 'errors.referenced'],
    ['Gallery changed. Reload its order.', 'errors.orderChanged'],
    ['The event is already active.', 'errors.stateChanged'],
    ['Image link is invalid or expired. Refresh the gallery.', 'errors.notFound'],
    ['An event can have at most 10 images.', 'errors.limit'],
  ] as const)('maps recognized business error %s', (message, key) => {
    expect(localizedErrorMessage(new DataError(message), translator('en'))).toBe(
      dictionaries.en[key],
    );
    expect(localizedErrorMessage(new DataError(message), translator('bg'))).toBe(
      dictionaries.bg[key],
    );
  });

  it('uses a localized generic fallback for unknown technical errors', () => {
    const error = new DataError('ECONNRESET while reading upstream', 'request-42');
    expect(localizedErrorMessage(error, translator('en'))).toBe(dictionaries.en['common.genericError']);
    expect(localizedErrorMessage(error, translator('bg'))).toBe(dictionaries.bg['common.genericError']);
    expect(error.requestId).toBe('request-42');
  });

  it('retranslates the same visible field error when the locale changes', () => {
    const fieldError = { path: 'sku', message: 'SKU already exists.' };
    expect(localizedFieldError(fieldError, translator('en'))).toBe(dictionaries.en['errors.duplicate']);
    expect(localizedFieldError(fieldError, translator('bg'))).toBe(dictionaries.bg['errors.duplicate']);
  });
});
