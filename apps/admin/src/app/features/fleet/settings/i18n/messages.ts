import type { Language } from '../../../../i18n/messages';
import en from './en.json';

export type SettingsText = typeof en;

/**
 * The Fleet settings catalog. English is the source; each product language is added beside it
 * with the same keys (until then the English text is shown).
 */
const catalogs: Partial<Record<Language, SettingsText>> = { en };

export function settingsText(language: Language): SettingsText {
  return catalogs[language] ?? en;
}
