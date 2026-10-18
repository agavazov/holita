import type { Language } from '../../../../i18n/messages';
import en from './en.json';

export type AlertsText = typeof en;

/**
 * The Alerts catalog. English is the source; each product language is added beside it with the
 * same keys (until then the English text is shown).
 */
const catalogs: Partial<Record<Language, AlertsText>> = { en };

export function alertsText(language: Language): AlertsText {
  return catalogs[language] ?? en;
}
