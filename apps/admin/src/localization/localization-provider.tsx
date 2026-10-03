import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { dictionaries, type TranslationKey } from './dictionaries.js';
import type { AdminLocale } from './locale.js';

type Interpolation = Readonly<Record<string, string | number>>;

type LocalizationValue = {
  locale: AdminLocale;
  localeSwitchPending: boolean;
  setLocaleSwitchPending: (id: string, pending: boolean) => void;
  t: (key: TranslationKey, values?: Interpolation) => string;
  formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const LocalizationContext = createContext<LocalizationValue | null>(null);

export function LocalizationProvider({
  locale,
  children,
}: PropsWithChildren<{ locale: AdminLocale }>) {
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const setLocaleSwitchPending = useCallback((id: string, pending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocalizationValue>(() => {
    const intlLocale = locale === 'bg' ? 'bg-BG' : 'en-GB';
    return {
      locale,
      localeSwitchPending: pendingIds.size > 0,
      setLocaleSwitchPending,
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
  }, [locale, pendingIds.size, setLocaleSwitchPending]);

  return <LocalizationContext value={value}>{children}</LocalizationContext>;
}

export function useLocalization(): LocalizationValue {
  const value = useContext(LocalizationContext);
  if (!value) throw new Error('useLocalization must be used within LocalizationProvider.');
  return value;
}

export function useLocaleSwitchPending(pending: boolean) {
  const id = useId();
  const { setLocaleSwitchPending } = useLocalization();

  useEffect(() => {
    setLocaleSwitchPending(id, pending);
    return () => {
      setLocaleSwitchPending(id, false);
    };
  }, [id, pending, setLocaleSwitchPending]);
}
