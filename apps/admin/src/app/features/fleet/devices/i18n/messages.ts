import type { Language } from '../../../../i18n/messages';
import en from './en.json';

export type DevicesText = typeof en;

/**
 * The Devices catalog. English is the source; each product language is added beside it with the
 * same keys (until then the English text is shown).
 */
const catalogs: Partial<Record<Language, DevicesText>> = { en };

export function devicesText(language: Language): DevicesText {
  return catalogs[language] ?? en;
}
