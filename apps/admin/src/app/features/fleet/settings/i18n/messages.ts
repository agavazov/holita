import type { Language } from '../../../../i18n/messages';
import en from './en.json';
import bg from './bg.json';

export type SettingsText = typeof en;

const catalogs: Record<Language, SettingsText> = { bg, en };

export function settingsText(language: Language): SettingsText {
  return catalogs[language];
}
