import type { Language } from '../../../../i18n/messages';
import en from './en.json';
import bg from './bg.json';

export type DriversText = typeof en;

const catalogs: Record<Language, DriversText> = { en, bg };

export function driversText(language: Language): DriversText {
  return catalogs[language];
}
