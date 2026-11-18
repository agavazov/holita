import type { Language } from '../../../../i18n/messages';
import en from './en.json';
import bg from './bg.json';

export type TripsText = typeof en;

const catalogs: Record<Language, TripsText> = { bg, en };

export function tripsText(language: Language): TripsText {
  return catalogs[language];
}
