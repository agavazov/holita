import type { Language } from '../../../../i18n/messages';
import en from './en.json';

export type TripsText = typeof en;

/**
 * The Trips catalog. English is the source; each product language is added beside it with the
 * same keys (until then the English text is shown).
 */
const catalogs: Partial<Record<Language, TripsText>> = { en };

export function tripsText(language: Language): TripsText {
  return catalogs[language] ?? en;
}
