export const adminLocales = ['bg', 'en'] as const;

export type AdminLocale = (typeof adminLocales)[number];

export const defaultAdminLocale: AdminLocale = 'bg';

export function isAdminLocale(value: string | undefined): value is AdminLocale {
  return value === 'bg' || value === 'en';
}

export function localeFromPathname(pathname: string): AdminLocale | null {
  const firstSegment = pathname.split('/').filter(Boolean)[0];
  return isAdminLocale(firstSegment) ? firstSegment : null;
}

export function normalizeLocalePathname(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];

  if (isAdminLocale(first)) {
    while (isAdminLocale(segments[1])) {
      segments.splice(1, 1);
    }
    return `/${segments.join('/')}`;
  }

  if (first && /^[a-z]{2}$/i.test(first)) {
    segments.shift();
  }

  return `/${[defaultAdminLocale, ...segments].join('/')}`;
}

export function localizedPath(locale: AdminLocale, path: string): string {
  const normalized = normalizeLocalePathname(path.startsWith('/') ? path : `/${path}`);
  const segments = normalized.split('/').filter(Boolean);
  segments[0] = locale;
  return `/${segments.join('/')}`;
}

export function switchPathLocale(pathname: string, locale: AdminLocale): string {
  return localizedPath(locale, pathname);
}

export function pathWithoutLocale(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (isAdminLocale(segments[0])) {
    segments.shift();
  }
  return `/${segments.join('/')}`;
}

export function semanticRouteKey(pathname: string): string {
  return pathWithoutLocale(pathname);
}
