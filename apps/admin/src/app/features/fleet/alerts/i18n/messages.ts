import type { Language } from '../../../../i18n/messages';
import en from './en.json';
import bg from './bg.json';

export type AlertsText = typeof en;

const catalogs: Record<Language, AlertsText> = { bg, en };

export function alertsText(language: Language): AlertsText {
  return catalogs[language];
}
