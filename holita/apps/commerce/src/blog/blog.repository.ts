import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type {
  BlogArticleInput,
  BlogArticleSort,
  BlogArticleStatus,
  BlogTagSort,
} from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

type ArticleFields = Omit<BlogArticleInput, 'tagIds'>;
type TagFields = Pick<Prisma.BlogTagCreateInput, 'name' | 'normalizedName' | 'slug'>;
const tagFields = { id: true, name: true, slug: true } satisfies Prisma.BlogTagSelect;
const tagOrder: Prisma.BlogTagOrderByWithRelationInput[] = [{ name: 'asc' }, { id: 'asc' }];

function articleTags(scope: Scope) {
  return {
    where: scope,
    orderBy: [{ tag: { name: 'asc' } }, { tagId: 'asc' }],
    select: { tag: { select: tagFields } },
  } satisfies Prisma.BlogArticle$tagAssignmentsArgs;
}

export type BlogArticleRow = Prisma.BlogArticleGetPayload<{
  include: { tagAssignments: ReturnType<typeof articleTags> };
}>;

@Injectable()
export class BlogRepository {
  constructor(private readonly database: DatabaseService) {}

  listArticles(
    scope: Scope,
    offset: number,
    limit: number,
    words: string[],
    status?: BlogArticleStatus | null,
    sort?: BlogArticleSort | null,
  ) {
    const direction = sort?.direction === 'ASC' ? 'asc' : 'desc';
    const order: Prisma.BlogArticleOrderByWithRelationInput =
      sort?.field === 'SLUG'
        ? { slug: direction }
        : sort?.field === 'STATUS'
          ? { status: direction }
          : { updatedAt: direction };
    return this.pageArticles(scope, offset, limit, order, {
      ...(status ? { status } : {}),
      AND: words.map((word) => ({
        OR: [
          { slug: { contains: word, mode: 'insensitive' } },
          { titleBg: { contains: word, mode: 'insensitive' } },
          { titleEn: { contains: word, mode: 'insensitive' } },
        ],
      })),
    });
  }

  publicArticles(scope: Scope, offset: number, limit: number, tagSlug?: string | null) {
    return this.pageArticles(
      scope,
      offset,
      limit,
      { publishedAt: 'desc' },
      {
        status: 'PUBLISHED',
        ...(tagSlug
          ? { tagAssignments: { some: { ...scope, tag: { ...scope, slug: tagSlug } } } }
          : {}),
      },
    );
  }

  private async pageArticles(
    scope: Scope,
    offset: number,
    limit: number,
    order: Prisma.BlogArticleOrderByWithRelationInput,
    filter: Prisma.BlogArticleWhereInput,
  ) {
    const where = { ...filter, ...scope };
    const [items, total] = await this.database.client.$transaction(
      [
        this.database.client.blogArticle.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [order, { id: 'asc' }],
          include: { tagAssignments: articleTags(scope) },
        }),
        this.database.client.blogArticle.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  article(scope: Scope, id: string) {
    return this.database.client.blogArticle.findUnique({
      where: { ...scope, id },
      include: { tagAssignments: articleTags(scope) },
    });
  }

  publicArticle(scope: Scope, slug: string) {
    return this.database.client.blogArticle.findUnique({
      where: { tenantId_branchId_slug: { ...scope, slug }, status: 'PUBLISHED' },
      include: { tagAssignments: articleTags(scope) },
    });
  }

  saveArticle(scope: Scope, fields: ArticleFields, tagIds: string[], id?: string) {
    return this.database.client.$transaction(
      async (tx): Promise<BlogArticleRow | null> => {
        const where = id === undefined ? null : { ...scope, id };
        const existing = where
          ? await tx.blogArticle.findUniqueOrThrow({ where, select: { publishedAt: true } })
          : null;
        const tags = tagIds.length
          ? await tx.blogTag.findMany({
              where: { ...scope, id: { in: tagIds } },
              orderBy: tagOrder,
              select: tagFields,
            })
          : [];
        if (tags.length !== tagIds.length) {
          return null;
        }
        const publishedAt =
          fields.status === 'PUBLISHED' ? (existing?.publishedAt ?? new Date()) : null;
        const data = { ...fields, publishedAt };
        const article = where
          ? await tx.blogArticle.update({ where, data })
          : await tx.blogArticle.create({ data: { ...scope, ...data } });
        const assignmentScope = { ...scope, articleId: article.id };
        if (where) {
          await tx.blogArticleTag.deleteMany({ where: assignmentScope });
        }
        if (tagIds.length) {
          await tx.blogArticleTag.createMany({
            data: tagIds.map((tagId) => ({ ...assignmentScope, tagId })),
          });
        }
        return { ...article, tagAssignments: tags.map((tag) => ({ tag })) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listTags(
    scope: Scope,
    offset: number,
    limit: number,
    words: string[],
    sort?: BlogTagSort | null,
  ) {
    const where: Prisma.BlogTagWhereInput = {
      ...scope,
      AND: words.map((word) => ({
        OR: [
          { name: { contains: word, mode: 'insensitive' } },
          { slug: { contains: word, mode: 'insensitive' } },
        ],
      })),
    };
    const direction = sort?.direction === 'DESC' ? 'desc' : 'asc';
    const order: Prisma.BlogTagOrderByWithRelationInput =
      sort?.field === 'SLUG' ? { slug: direction } : { name: direction };
    const [items, total] = await this.database.client.$transaction(
      [
        this.database.client.blogTag.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [order, { id: 'asc' }],
          select: tagFields,
        }),
        this.database.client.blogTag.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  tagChoices(scope: Scope) {
    return this.database.client.blogTag.findMany({
      where: scope,
      orderBy: tagOrder,
      select: tagFields,
    });
  }

  publicTags(scope: Scope) {
    return this.database.client.blogTag.findMany({
      where: {
        ...scope,
        assignments: { some: { ...scope, article: { ...scope, status: 'PUBLISHED' } } },
      },
      orderBy: tagOrder,
      select: { name: true, slug: true },
    });
  }

  tag(scope: Scope, id: string) {
    return this.database.client.blogTag.findUnique({ where: { ...scope, id }, select: tagFields });
  }

  tagByNormalizedName(scope: Scope, normalizedName: string) {
    return this.database.client.blogTag.findUnique({
      where: { tenantId_branchId_normalizedName: { ...scope, normalizedName } },
      select: { id: true },
    });
  }

  saveTag(scope: Scope, data: TagFields, id?: string) {
    return id === undefined
      ? this.database.client.blogTag.create({ data: { ...scope, ...data }, select: tagFields })
      : this.database.client.blogTag.update({ where: { ...scope, id }, data, select: tagFields });
  }
}
