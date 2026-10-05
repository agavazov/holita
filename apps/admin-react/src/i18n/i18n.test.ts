import type { ParseKeys } from 'i18next';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { createAdminI18n, isLanguage } from './i18n.js';

describe('admin translation catalogs', () => {
  it('initializes bundled resources immediately with Bulgarian as the default', () => {
    const i18n = createAdminI18n();
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.language).toBe('bg');
    expect(i18n.t('actions.save')).toBe('Запази');
    expect(i18n.t('products:form.name')).toBe('Име');
    expectTypeOf<Extract<ParseKeys<'products'>, 'form.name'>>().toEqualTypeOf<'form.name'>();
    expectTypeOf<Extract<ParseKeys<'products'>, 'form.missing'>>().toEqualTypeOf<never>();
  });

  it('resolves the declared namespaces and English independently', () => {
    const bg = createAdminI18n();
    const en = createAdminI18n('en');
    expect(en.t('actions.save')).toBe('Save');
    expect(bg.t('shell:language.label')).toBe('Език');
    expect(bg.t('stores:select')).toBe('Избери магазин');
    expect(bg.t('reference:events.title')).toBe('Събития');
    expect(bg.t('prototype:actions.reset')).toBe('Възстанови демо данните');
    expect(bg.language).toBe('bg');
  });

  it('interpolates parameters without changing the message structure', () => {
    const i18n = createAdminI18n();
    expect(i18n.t('validation:text.maxLength', { max: 200 })).toBe(
      'Използвай най-много 200 символа.',
    );
    expect(i18n.t('validation:text.maxLength', { lng: 'en', max: 100 })).toBe(
      'Use at most 100 characters.',
    );
  });

  it.each([
    ['bg', 'Продуктът е изтрит.', '2 продукта са изтрити.'],
    ['en', 'Product deleted.', '2 products deleted.'],
  ] as const)('selects singular and plural messages in %s', (language, singular, plural) => {
    const i18n = createAdminI18n(language);
    expect(i18n.t('products:messages.deleted', { count: 1 })).toBe(singular);
    expect(i18n.t('products:messages.deleted', { count: 2 })).toBe(plural);
  });

  it('falls back to English for missing Bulgarian messages without switching language', () => {
    const i18n = createAdminI18n();
    i18n.removeResourceBundle('bg', 'products');
    expect(i18n.t('products:messages.saved')).toBe('Product saved.');
    expect(i18n.language).toBe('bg');
    expect(createAdminI18n().t('products:messages.saved')).toBe('Продуктът е запазен.');
  });

  it('treats an empty Bulgarian translation as missing', () => {
    const i18n = createAdminI18n();
    i18n.addResource('bg', 'common', 'actions.save', '');
    expect(i18n.t('actions.save')).toBe('Save');
  });

  it('accepts only the supported language codes', () => {
    expect(isLanguage('bg')).toBe(true);
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('de')).toBe(false);
  });
});
