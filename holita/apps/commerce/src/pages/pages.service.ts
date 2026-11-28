import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  contentInputError,
  contentListCriteria,
  contentSlug,
  plainTextTranslations,
  validContentSlug,
} from '../content-validation.js';
import type { PublishedShopPage } from '../generated/graphql/storefront-types.js';
import type { QueryShopPagesArgs, ShopPage, ShopPageInput } from '../generated/graphql/types.js';
import { Prisma, type ShopPage as StoredPage } from '../generated/prisma/client.js';
import { requireScope, type RequestContext, type Scope } from '../scope.js';
import { PagesRepository } from './pages.repository.js';
import { policyPages, policySlugs } from './policy-pages.js';

function recordId(id: string): string {
  if (!isUUID(id)) {
    throw new BadRequestException('Page ID must be a UUID');
  }
  return id.toLowerCase();
}

function present(row: StoredPage): ShopPage {
  const { id, slug, status, titleBg, titleEn, bodyBg, bodyEn, createdAt, updatedAt } = row;
  return {
    id,
    slug,
    isSystem: policySlugs.includes(slug),
    status,
    titleBg,
    titleEn,
    bodyBg,
    bodyEn,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

@Injectable()
export class PagesService {
  constructor(private readonly repository: PagesRepository) {}

  async list(context: RequestContext, args: QueryShopPagesArgs) {
    const scope = await requireScope(context, false);
    const { offset, limit, words } = contentListCriteria(args);
    const result = await this.repository.list(scope, offset, limit, words, args.sort, args.filter);
    return { ...result, items: result.items.map(present) };
  }

  async find(context: RequestContext, id: string) {
    const row = await this.repository.find(await requireScope(context, false), recordId(id));
    return row ? present(row) : null;
  }

  async published(scope: Scope, slug: string): Promise<PublishedShopPage | null> {
    return validContentSlug(slug) ? this.repository.published(scope, slug) : null;
  }

  async provisionPolicyPages(context: RequestContext): Promise<boolean> {
    const scope = await requireScope(context, true);
    await this.repository.ensurePolicyPages(scope);
    return true;
  }

  async publishedPolicyLinks(scope: Scope) {
    const pages = await this.repository.publishedPolicies(scope);
    const ids = new Map(pages.map(({ slug, id }) => [slug, id]));
    return policyPages.flatMap(({ slug, titleBg, titleEn }) => {
      const id = ids.get(slug);
      return id ? [{ id, slug, labelBg: titleBg, labelEn: titleEn }] : [];
    });
  }

  async save(context: RequestContext, input: ShopPageInput, id?: string) {
    const scope = await requireScope(context, true);
    const slug = contentSlug(input.slug);
    const pageId = id === undefined ? undefined : recordId(id);
    const existing = pageId === undefined ? null : await this.repository.find(scope, pageId);
    if (pageId !== undefined && !existing) {
      throw new NotFoundException('Page not found');
    }
    if (
      slug !== existing?.slug &&
      (policySlugs.includes(slug) || policySlugs.includes(existing?.slug ?? ''))
    ) {
      throw contentInputError('slug', 'SYSTEM_PAGE_SLUG', 'Policy page slugs are fixed');
    }
    const data = { slug, status: input.status, ...plainTextTranslations(input) };
    try {
      const row = existing
        ? await this.repository.update(scope, existing.id, data)
        : await this.repository.create(scope, data);
      return present(row);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw contentInputError('slug', 'DUPLICATE_VALUE', 'This shop already uses the slug');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Page not found');
        }
      }
      throw error;
    }
  }
}
