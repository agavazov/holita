import type { Language } from '@osnova/ui';
import type { OperatorShopPageListFieldsFragment } from '../generated/pages-operations';

type Page = OperatorShopPageListFieldsFragment;

export function pageTitle(page: Page, language: Language): string {
  return (
    (language === 'bg' ? (page.titleBg ?? page.titleEn) : (page.titleEn ?? page.titleBg)) ??
    page.slug
  );
}

export function pagePath(branchId: string | undefined, page: Page): string | null {
  return branchId && page.status === 'PUBLISHED' ? `/s/${branchId}/pages/${page.slug}` : null;
}
