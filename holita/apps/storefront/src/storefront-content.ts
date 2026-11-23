import type { PublicBlogArticleQuery, PublicShopPageQuery } from './generated/operations';
import type { Language } from './storefront-messages';

type Content = PublicBlogArticleQuery['blogArticle'] | PublicShopPageQuery['shopPage'];

export function localizedContent(content: Content | undefined, language: Language) {
  if (!content) {
    return null;
  }
  const { titleBg, titleEn, bodyBg, bodyEn } = content;
  const bg = titleBg && bodyBg ? { title: titleBg, body: bodyBg, language: 'bg' } : null;
  const en = titleEn && bodyEn ? { title: titleEn, body: bodyEn, language: 'en' } : null;
  return language === 'bg' ? (bg ?? en) : (en ?? bg);
}

export function localizedText(
  language: Language,
  bg: string | null | undefined,
  en: string | null | undefined,
): { text: string; language: Language } | null {
  const translations = { bg, en };
  const preferred = translations[language];
  if (preferred) {
    return { text: preferred, language };
  }
  const fallbackLanguage = language === 'bg' ? 'en' : 'bg';
  const fallback = translations[fallbackLanguage];
  return fallback ? { text: fallback, language: fallbackLanguage } : null;
}
