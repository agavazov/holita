import type { Language } from '../../../i18n/messages';
import bg from './bg.json';
import en from './en.json';
export function monitoringText(language: Language): typeof en {
  return language === 'bg' ? bg : en;
}
