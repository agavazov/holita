import { operatorStrings } from '@holita/operator';
import type { Language } from '@osnova/ui';
import type {
  BlogArticleStatus,
  OperatorBlogArticleListFieldsFragment,
} from '../generated/blog-operations';

export const articleStatuses = ['DRAFT', 'PUBLISHED'] as const;

export function articleTitle(
  article: OperatorBlogArticleListFieldsFragment,
  language: Language,
): string {
  return (
    (language === 'bg'
      ? (article.titleBg ?? article.titleEn)
      : (article.titleEn ?? article.titleBg)) ?? article.slug
  );
}

export function articleStatus(status: BlogArticleStatus, language: Language): string {
  return status === 'PUBLISHED'
    ? operatorStrings[language].blogPublished
    : operatorStrings[language].draft;
}
