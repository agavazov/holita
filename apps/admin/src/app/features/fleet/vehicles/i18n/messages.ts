import type { Language } from '../../../../i18n/messages';
import en from './en.json';

export type VehiclesText = typeof en;

/**
 * The Vehicles catalog. English is the source; each product language is added beside it with
 * the same keys (until then the English text is shown).
 */
const catalogs: Partial<Record<Language, VehiclesText>> = { en };

export function vehiclesText(language: Language): VehiclesText {
  return catalogs[language] ?? en;
}
