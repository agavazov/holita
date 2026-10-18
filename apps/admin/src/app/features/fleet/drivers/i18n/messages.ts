import type { Language } from '../../../../i18n/messages';
import en from './en.json';

export type DriversText = typeof en;

/**
 * The Drivers catalog. English is the source; each product language is added beside it with the
 * same keys (until then the English text is shown).
 */
const catalogs: Partial<Record<Language, DriversText>> = { en };

export function driversText(language: Language): DriversText {
  return catalogs[language] ?? en;
}
