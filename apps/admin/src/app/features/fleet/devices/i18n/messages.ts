import type { Language } from '../../../../i18n/messages';
import en from './en.json';
import bg from './bg.json';

export type DevicesText = typeof en;

/** The Devices catalog in each supported product language. */
const catalogs: Record<Language, DevicesText> = { en, bg };

export function devicesText(language: Language): DevicesText {
  return catalogs[language];
}

/** The product name of a device model; empty when the model is unknown. */
export function deviceModelLabel(language: Language, model: string | null | undefined): string {
  const models: Record<string, string> = catalogs[language].models;
  return model ? (models[model] ?? model) : '';
}
