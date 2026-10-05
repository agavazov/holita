import type { TFunction } from 'i18next';
import { fallbackValidation } from '../../i18n/i18n.js';

export function textError(
  value: string,
  max: number,
  requiredMessage = '',
  t: TFunction<'validation'> = fallbackValidation,
) {
  if (!value.trim()) return requiredMessage;
  if (value.includes('\u0000')) return t('text.unsupportedCharacters');
  return Array.from(value.trim()).length > max ? t('text.maxLength', { max }) : '';
}
