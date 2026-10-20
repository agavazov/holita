import type { Language } from '../../../../i18n/messages';
import en from './en.json';
import bg from './bg.json';

export type MaintenanceText = typeof en;

const catalogs: Record<Language, MaintenanceText> = { en, bg };

export function maintenanceText(language: Language): MaintenanceText {
  return catalogs[language];
}
