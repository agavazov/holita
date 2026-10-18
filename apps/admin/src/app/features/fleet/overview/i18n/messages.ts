import type { Language } from '../../../../i18n/messages';
import en from './en.json';

export type OverviewText = typeof en;

/**
 * The Overview catalog. English is the source; each product language is added beside it with the
 * same keys (until then the English text is shown).
 */
const catalogs: Partial<Record<Language, OverviewText>> = { en };

export function overviewText(language: Language): OverviewText {
  return catalogs[language] ?? en;
}
