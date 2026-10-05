import { useCallback } from 'react';
import {
  useNavigate,
  useParams,
  type NavigateFunction,
  type NavigateOptions,
  type To,
} from 'react-router';
import { defaultLanguage, isLanguage, type Language } from './i18n.js';

export function languagePath(path: string, language: Language): string {
  const suffix = path.replace(/^\/(bg|en)(?=\/|$|[?#])/, '');
  return `/${language}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

export function useLanguage(): Language {
  const { language } = useParams();
  return language && isLanguage(language) ? language : defaultLanguage;
}

export function useLocalizedPath() {
  const language = useLanguage();
  return useCallback((path: string) => languagePath(path, language), [language]);
}

export function useLocalizedNavigate(): NavigateFunction {
  const navigate = useNavigate();
  const localize = useLocalizedPath();
  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') return navigate(to);
      if (typeof to === 'string') return navigate(to.startsWith('/') ? localize(to) : to, options);
      return navigate(
        to.pathname?.startsWith('/') ? { ...to, pathname: localize(to.pathname) } : to,
        options,
      );
    },
    [navigate, localize],
  );
}
