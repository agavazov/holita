import type { Language } from '../../../../i18n/messages';
import en from './en.json';
import bg from './bg.json';

export type OverviewText = typeof en;

const catalogs: Record<Language, OverviewText> = { en, bg };

export function overviewText(language: Language): OverviewText {
  return catalogs[language];
}
