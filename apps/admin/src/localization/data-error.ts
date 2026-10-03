import type { DataError, FieldError } from '../data/data-error.js';
import type { TranslationKey } from './dictionaries.js';

type Translate = (key: TranslationKey, values?: Readonly<Record<string, string | number>>) => string;

const knownErrors: readonly [RegExp, TranslationKey][] = [
  [/\b(?:sku|code|tag|product).*(?:already exists|duplicate)|already exists.*\b(?:sku|code|tag|product)\b/i, 'errors.duplicate'],
  [/(?:still referenced|is referenced|cannot be deleted.*(?:used|reference))/i, 'errors.referenced'],
  [/(?:gallery|session list).*(?:changed|order)|(?:changed|order).*(?:gallery|session list)/i, 'errors.orderChanged'],
  [/(?:already active|already (?:in )?trash|not in trash|must be (?:draft|trashed)|trash state)/i, 'errors.stateChanged'],
  [/(?:not found|invalid or expired|link is invalid|upload is incomplete or expired)/i, 'errors.notFound'],
  [/(?:at most \d+ (?:images|sessions)|limit)/i, 'errors.limit'],
  [/(?:unsupported character|provide |must contain|must be |choose another|use a shorter|check the )/i, 'errors.invalidValue'],
];

function translateKnownMessage(message: string) {
  return knownErrors.find(([pattern]) => pattern.test(message))?.[1];
}

export function localizedErrorMessage(error: DataError | Error | null | undefined, t: Translate) {
  if (!error) return t('common.genericError');
  const key = translateKnownMessage(error.message);
  return key ? t(key) : t('common.genericError');
}

export function localizedFieldError(error: FieldError | undefined, t: Translate) {
  if (!error) return '';
  const key = translateKnownMessage(error.message);
  return key ? t(key) : t('errors.invalidValue');
}
