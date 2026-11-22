import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import type {
  BlogArticleInput,
  QueryShopPagesArgs,
  ShopPageInput,
} from './generated/graphql/types.js';

export function contentInputError(path: string, code: string, message: string) {
  return new UnprocessableEntityException({ message, fieldErrors: [{ path, code, message }] });
}

export function validContentSlug(slug: string): boolean {
  return slug.length <= 200 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug);
}

export function contentSlug(value: string): string {
  const slug = value.trim();
  if (!validContentSlug(slug)) {
    throw contentInputError('slug', 'INVALID_FORMAT', 'Use lowercase letters, digits and hyphens');
  }
  return slug;
}

function text(value: string | null | undefined, path: string, limit?: number) {
  const trimmed = value?.trim();
  if (trimmed?.includes('\u0000')) {
    throw contentInputError(path, 'INVALID_VALUE', 'Text must not contain a null character');
  }
  if (trimmed && limit !== undefined && Array.from(trimmed).length > limit) {
    throw contentInputError(path, 'INVALID_VALUE', 'Title must contain at most 200 characters');
  }
  return trimmed || null;
}

export function plainTextTranslations(
  input: Pick<
    ShopPageInput | BlogArticleInput,
    'status' | 'titleBg' | 'titleEn' | 'bodyBg' | 'bodyEn'
  >,
) {
  const titleBg = text(input.titleBg, 'titleBg', 200);
  const titleEn = text(input.titleEn, 'titleEn', 200);
  const bodyBg = text(input.bodyBg, 'bodyBg');
  const bodyEn = text(input.bodyEn, 'bodyEn');
  if (input.status === 'PUBLISHED' && !(titleBg && bodyBg) && !(titleEn && bodyEn)) {
    throw contentInputError(
      'status',
      'INVALID_VALUE',
      'Publishing requires a title and body in one language',
    );
  }
  return { titleBg, titleEn, bodyBg, bodyEn };
}

export function contentListCriteria(args: Pick<QueryShopPagesArgs, 'offset' | 'limit' | 'search'>) {
  const { offset = 0, limit = 20 } = args;
  const search = (args.search ?? '').trim();
  const words = search.split(/\s+/u).filter(Boolean);
  if (offset < 0 || limit < 1 || limit > 100) {
    throw new BadRequestException('Invalid page');
  }
  if (Array.from(search).length > 200 || words.length > 5 || search.includes('\u0000')) {
    throw new BadRequestException('Invalid search');
  }
  return { offset, limit, words };
}
