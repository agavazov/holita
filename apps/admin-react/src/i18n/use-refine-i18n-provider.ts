import type { I18nProvider } from '@refinedev/core';
import type { TOptions } from 'i18next';
import { useContext, useEffect, useMemo, useRef } from 'react';
import { I18nContext, useTranslation } from 'react-i18next';

import { useLocation, useNavigate } from 'react-router';
import { languagePath } from './routing.js';
import { defaultLanguage, isLanguage } from './i18n.js';

export function useRefineI18nProvider(): I18nProvider {
  // Refine retains locale callbacks, so read the live instance rather than a hook snapshot.
  const { i18n } = useContext(I18nContext);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const currentLocation = useRef(location);
  useEffect(() => {
    currentLocation.current = location;
  }, [location]);
  return useMemo(
    () => ({
      translate: (key: string, options: TOptions | string = {}, defaultMessage?: string) => {
        const defaultValue =
          defaultMessage ??
          (typeof options === 'string'
            ? options
            : typeof options.defaultValue === 'string'
              ? options.defaultValue
              : key);
        // Refine accepts runtime string keys and supplies a fallback for its own messages.
        return t(key, {
          ...(typeof options === 'string' ? {} : options),
          defaultValue,
          returnObjects: false,
          returnDetails: false,
        });
      },
      changeLocale: async (language: string) => {
        if (!isLanguage(language)) throw new Error('Unsupported admin language.');
        const { pathname, search, hash } = currentLocation.current;
        await navigate(languagePath(pathname + search + hash, language));
      },
      getLocale: () => i18n.resolvedLanguage ?? defaultLanguage,
    }),
    [i18n, t, navigate],
  );
}
