import type { Language } from '../../../i18n/messages';
import bg from './bg.json';
import en from './en.json';

export const liveDashboardText = (language: Language): typeof en => (language === 'bg' ? bg : en);
