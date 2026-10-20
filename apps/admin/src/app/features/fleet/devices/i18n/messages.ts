import type { Language } from '../../../../i18n/messages';
import en from './en.json';
import bg from './bg.json';

export type DevicesText = typeof en;

/** The Devices catalog in each supported product language. */
const catalogs: Record<Language, DevicesText> = { en, bg };

export function devicesText(language: Language): DevicesText {
  return catalogs[language];
}
