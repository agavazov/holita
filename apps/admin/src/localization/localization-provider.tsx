import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';

import { dictionaries, type TranslationKey } from './dictionaries.js';
import type { AdminLocale } from './locale.js';

type Interpolation = Readonly<Record<string, string | number>>;

type LocalizationValue = {
  locale: AdminLocale;
  t: (key: TranslationKey, values?: Interpolation) => string;
  formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const LocalizationContext = createContext<LocalizationValue | null>(null);

export function LocalizationProvider({
  locale,
  children,
}: PropsWithChildren<{ locale: AdminLocale }>) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocalizationValue>(() => {
    const intlLocale = locale === 'bg' ? 'bg-BG' : 'en-GB';
    return {
      locale,
      t: (key, values) => {
        const template = dictionaries[locale][key];
        if (!values) return template;
        return Object.entries(values).reduce(
          (result, [name, replacement]) =>
            result.replaceAll(`{${name}}`, String(replacement)),
          template,
        );
      },
      formatDate: (input, options) =>
        new Intl.DateTimeFormat(intlLocale, options).format(new Date(input)),
      formatNumber: (input, options) => new Intl.NumberFormat(intlLocale, options).format(input),
    };
  }, [locale]);

  return <LocalizationContext value={value}>{children}</LocalizationContext>;
}

export function useLocalization(): LocalizationValue {
  const value = useContext(LocalizationContext);
  if (!value) throw new Error('useLocalization must be used within LocalizationProvider.');
  return value;
}
