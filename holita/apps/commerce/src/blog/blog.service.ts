import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  contentInputError,
  contentListCriteria,
  contentSlug,
  plainTextTranslations,
  validContentSlug,
} from '../content-validation.js';
import type {
  PublicBlogArticle,
  PublicBlogArticlePage,
} from '../generated/graphql/storefront-types.js';
import type {
  BlogArticle,
  BlogArticleInput,
  BlogTagInput,
  QueryBlogArticlesArgs,
  QueryBlogTagsArgs,
} from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import { requireScope, type RequestContext, type Scope } from '../scope.js';
import { BlogRepository, type BlogArticleRow } from './blog.repository.js';

function recordId(id: string): string {
  if (!isUUID(id)) {
    throw new BadRequestException('Blog record ID must be a UUID');
  }
  return id.toLowerCase();
}

function invalidTags() {
  return contentInputError('tagIds', 'INVALID_VALUE', 'Choose distinct tags from this shop');
}

function presentArticle(row: BlogArticleRow): BlogArticle {
  const {
    id,
    slug,
    status,
    titleBg,
    titleEn,
    bodyBg,
    bodyEn,
    createdAt,
    updatedAt,
    publishedAt,
    tagAssignments,
  } = row;
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
    publishedAt: publishedAt?.toISOString() ?? null,
    tags: tagAssignments.map(({ tag }) => tag),
  };
}

function presentPublicArticle(row: BlogArticleRow): PublicBlogArticle {
  if (!row.publishedAt) {
    throw new Error('Published article is missing its publication time');
  }
  const hasBg = Boolean(row.titleBg && row.bodyBg);
  const hasEn = Boolean(row.titleEn && row.bodyEn);
  return {
    slug: row.slug,
    titleBg: hasBg ? row.titleBg : null,
    bodyBg: hasBg ? row.bodyBg : null,
    titleEn: hasEn ? row.titleEn : null,
    bodyEn: hasEn ? row.bodyEn : null,
    publishedAt: row.publishedAt.toISOString(),
    tags: row.tagAssignments.map(({ tag: { name, slug } }) => ({ name, slug })),
  };
}

@Injectable()
export class BlogService {
  constructor(private readonly repository: BlogRepository) {}

  async listArticles(context: RequestContext, args: QueryBlogArticlesArgs) {
    const scope = await requireScope(context, false);
    const { offset, limit, words } = contentListCriteria(args);
    const result = await this.repository.listArticles(
      scope,
      offset,
      limit,
      words,
      args.status,
      args.sort,
    );
    return { ...result, items: result.items.map(presentArticle) };
  }

  async article(context: RequestContext, id: string) {
    const row = await this.repository.article(await requireScope(context, false), recordId(id));
    return row ? presentArticle(row) : null;
  }

  async saveArticle(context: RequestContext, input: BlogArticleInput, id?: string) {
    const scope = await requireScope(context, true);
    const fields = {
      slug: contentSlug(input.slug),
      status: input.status,
      ...plainTextTranslations(input),
    };
    const tagIds = input.tagIds.map((tagId) => tagId.toLowerCase());
    if (tagIds.some((tagId) => !isUUID(tagId)) || new Set(tagIds).size !== tagIds.length) {
      throw invalidTags();
    }
    try {
      const row = await this.repository.saveArticle(
        scope,
        fields,
        tagIds,
        id === undefined ? undefined : recordId(id),
      );
      if (!row) {
        throw invalidTags();
      }
      return presentArticle(row);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw contentInputError('slug', 'DUPLICATE_VALUE', 'This shop already uses the slug');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Blog article not found');
        }
        if (error.code === 'P2034') {
          throw new ConflictException('Blog article changed while saving');
        }
      }
      throw error;
    }
  }

  async listTags(context: RequestContext, args: QueryBlogTagsArgs) {
    const scope = await requireScope(context, false);
    const { offset, limit, words } = contentListCriteria(args);
    return this.repository.listTags(scope, offset, limit, words, args.sort);
  }

  async tagChoices(context: RequestContext) {
    return this.repository.tagChoices(await requireScope(context, false));
  }

  async tag(context: RequestContext, id: string) {
    return this.repository.tag(await requireScope(context, false), recordId(id));
  }

  async saveTag(context: RequestContext, input: BlogTagInput, id?: string) {
    const scope = await requireScope(context, true);
    const name = input.name.trim().replace(/\s+/gu, ' ');
    if (!name || Array.from(name).length > 200 || name.includes('\u0000')) {
      throw contentInputError('name', 'INVALID_VALUE', 'Tag name must contain 1 to 200 characters');
    }
    const normalizedName = name.toLowerCase().normalize();
    const data = { name, normalizedName, slug: contentSlug(input.slug) };
    const key = id === undefined ? undefined : recordId(id);
    try {
      return await this.repository.saveTag(scope, data, key);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const existing = await this.repository.tagByNormalizedName(scope, normalizedName);
          if (existing && existing.id !== key) {
            throw contentInputError(
              'name',
              'DUPLICATE_VALUE',
              'This shop already uses the tag name',
            );
          }
          throw contentInputError('slug', 'DUPLICATE_VALUE', 'This shop already uses the slug');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Blog tag not found');
        }
      }
      throw error;
    }
  }

  async publicArticles(
    scope: Scope,
    offset: number,
    limit: number,
    tagSlug?: string | null,
  ): Promise<PublicBlogArticlePage> {
    if (tagSlug != null && !validContentSlug(tagSlug)) {
      return { items: [], total: 0, offset, limit };
    }
    const result = await this.repository.publicArticles(scope, offset, limit, tagSlug);
    return { ...result, items: result.items.map(presentPublicArticle) };
  }

  async publicArticle(scope: Scope, slug: string): Promise<PublicBlogArticle | null> {
    const row = validContentSlug(slug) ? await this.repository.publicArticle(scope, slug) : null;
    return row ? presentPublicArticle(row) : null;
  }

  publicTags(scope: Scope) {
    return this.repository.publicTags(scope);
  }
}
