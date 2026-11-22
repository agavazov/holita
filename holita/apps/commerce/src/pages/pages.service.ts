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

  async save(context: RequestContext, input: ShopPageInput, id?: string) {
    const scope = await requireScope(context, true);
    const data = {
      slug: contentSlug(input.slug),
      status: input.status,
      ...plainTextTranslations(input),
    };
    try {
      const row =
        id === undefined
          ? await this.repository.create(scope, data)
          : await this.repository.update(scope, recordId(id), data);
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
