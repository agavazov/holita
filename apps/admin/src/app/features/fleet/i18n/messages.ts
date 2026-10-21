import type { Language } from '../../../i18n/messages';
import bg from './bg.json';
import en from './en.json';

const catalogs: Record<Language, typeof en> = { bg, en };

export function fleetValidationText(language: Language): typeof en {
  return catalogs[language];
}
