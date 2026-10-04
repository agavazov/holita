import { describe, expect, it } from 'vitest';

import {
  localeFromPathname,
  normalizeLocalePathname,
  semanticRouteKey,
  switchPathLocale,
} from './locale.js';

describe('admin locale paths', () => {
  it.each([
    ['/stores/alpha/products', '/bg/stores/alpha/products'],
    ['/xx/stores/alpha/products', '/bg/stores/alpha/products'],
    ['/bg/en/stores/alpha/products', '/bg/stores/alpha/products'],
    ['/en/bg/stores/alpha/products', '/en/stores/alpha/products'],
    ['/bg/bg/stores/alpha/products', '/bg/stores/alpha/products'],
  ])('normalizes %s directly to %s', (input, expected) => {
    expect(normalizeLocalePathname(input)).toBe(expected);
  });

  it('keeps canonical locale paths stable', () => {
    expect(normalizeLocalePathname('/bg/stores/alpha/products')).toBe('/bg/stores/alpha/products');
    expect(normalizeLocalePathname('/en/stores/alpha/products')).toBe('/en/stores/alpha/products');
  });

  it('switches only the locale and preserves semantic route identity', () => {
    const bg = '/bg/stores/alpha/reference/events/event-1/edit';
    const en = switchPathLocale(bg, 'en');
    expect(en).toBe('/en/stores/alpha/reference/events/event-1/edit');
    expect(localeFromPathname(en)).toBe('en');
    expect(semanticRouteKey(bg)).toBe(semanticRouteKey(en));
  });
});
