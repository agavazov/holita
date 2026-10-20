import type { Language } from '../../../../i18n/messages';
import bg from './bg.json';
import en from './en.json';

export type VehiclesText = typeof en;

/** The Vehicles catalog in each supported product language. */
const catalogs: Record<Language, VehiclesText> = { bg, en };

export function vehiclesText(language: Language): VehiclesText {
  return catalogs[language];
}
