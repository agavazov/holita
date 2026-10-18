import type { Language } from '../../../../i18n/messages';
import en from './en.json';

export type MaintenanceText = typeof en;

/**
 * The Maintenance catalog. English is the source; each product language is added beside it with
 * the same keys (until then the English text is shown).
 */
const catalogs: Partial<Record<Language, MaintenanceText>> = { en };

export function maintenanceText(language: Language): MaintenanceText {
  return catalogs[language] ?? en;
}
