import type { TranslationKey } from '../../localization/dictionaries.js';

type Translate = (key: TranslationKey, values?: Readonly<Record<string, string | number>>) => string;

export function textError(value: string, max: number, t: Translate, requiredMessage = '') {
  if (!value.trim()) return requiredMessage;
  if (value.includes('\u0000')) return t('common.unsupportedCharacters');
  return Array.from(value.trim()).length > max
    ? t('common.maxCharacters', { count: max })
    : '';
}
