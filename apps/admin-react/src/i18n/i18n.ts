import { createInstance } from 'i18next';

import bg from './locales/bg.json';
import en from './locales/en.json';

export const supportedLanguages = ['bg', 'en'] as const;
export type Language = (typeof supportedLanguages)[number];
export const defaultLanguage: Language = 'bg';
export const fallbackLanguage: Language = 'en';
export const defaultNamespace = 'common';
export const resources = { bg, en };

export function isLanguage(value: string): value is Language {
  return supportedLanguages.some((language) => language === value);
}

export function createAdminI18n(language: Language = defaultLanguage) {
  const instance = createInstance();
  void instance.init({
    lng: language,
    fallbackLng: fallbackLanguage,
    supportedLngs: supportedLanguages,
    defaultNS: defaultNamespace,
    ns: Object.keys(en),
    resources: structuredClone(resources),
    initAsync: false,
    returnEmptyString: false,
    interpolation: { escapeValue: false },
  });
  return instance;
}

// Non-React callers use fixed translators; URL changes never change their captured language.
export const adminMessages = createAdminI18n(fallbackLanguage);
export const fallbackValidation = adminMessages.getFixedT(fallbackLanguage, 'validation');
