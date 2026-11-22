import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

const namedTarget = { id: true, name: true, slug: true, active: true } as const;
const pageTarget = { id: true, titleBg: true, titleEn: true, slug: true, status: true } as const;

function orderedItems(scope: Scope) {
  return {
    where: scope,
    orderBy: { sortOrder: 'asc' },
    include: {
      category: { select: namedTarget },
      collection: { select: namedTarget },
      page: { select: pageTarget },
    },
  } satisfies Prisma.NavigationMenu$itemsArgs;
}

export type NavigationMenuRow = Prisma.NavigationMenuGetPayload<{
  include: { items: ReturnType<typeof orderedItems> };
}>;
export type NavigationItemFields = Omit<
  Prisma.NavigationMenuItemCreateManyInput,
  'id' | 'tenantId' | 'branchId' | 'menuId'
>;
type MenuTarget = { id: string } | Pick<Prisma.NavigationMenuCreateInput, 'placement'>;

function namedSearch(words: string[]) {
  return words.map((word) => ({
    OR: [
      { name: { contains: word, mode: 'insensitive' as const } },
      { slug: { contains: word, mode: 'insensitive' as const } },
    ],
  }));
}

@Injectable()
export class NavigationRepository {
  constructor(private readonly database: DatabaseService) {}

  list(scope: Scope) {
    return this.database.client.navigationMenu.findMany({
      where: scope,
      orderBy: { placement: 'asc' },
      select: { id: true, placement: true, _count: { select: { items: { where: scope } } } },
    });
  }

  find(scope: Scope, id: string) {
    return this.database.client.navigationMenu.findUnique({
      where: { ...scope, id },
      include: { items: orderedItems(scope) },
    });
  }

  menusWithItems(scope: Scope) {
    return this.database.client.navigationMenu.findMany({
      where: scope,
      include: { items: orderedItems(scope) },
    });
  }

  async firstInvalidDestination(scope: Scope, items: NavigationItemFields[]) {
    const categoryIds = items.flatMap(({ categoryId }) => (categoryId ? [categoryId] : []));
    const collectionIds = items.flatMap(({ collectionId }) => (collectionId ? [collectionId] : []));
    const pageIds = items.flatMap(({ pageId }) => (pageId ? [pageId] : []));
    const [categories, collections, pages] = await Promise.all([
      categoryIds.length
        ? this.database.client.category.findMany({
            where: { ...scope, id: { in: categoryIds } },
            select: { id: true },
          })
        : [],
      collectionIds.length
        ? this.database.client.productCollection.findMany({
            where: { ...scope, id: { in: collectionIds } },
            select: { id: true },
          })
        : [],
      pageIds.length
        ? this.database.client.shopPage.findMany({
            where: { ...scope, id: { in: pageIds } },
            select: { id: true },
          })
        : [],
    ]);
    const foundCategories = new Set(categories.map(({ id }) => id));
    const foundCollections = new Set(collections.map(({ id }) => id));
    const foundPages = new Set(pages.map(({ id }) => id));
    return items.findIndex(
      ({ categoryId, collectionId, pageId }) =>
        (categoryId != null && !foundCategories.has(categoryId)) ||
        (collectionId != null && !foundCollections.has(collectionId)) ||
        (pageId != null && !foundPages.has(pageId)),
    );
  }

  save(scope: Scope, target: MenuTarget, items: NavigationItemFields[]) {
    return this.database.client.$transaction(async (tx) => {
      const { id } =
        'id' in target
          ? await tx.navigationMenu.update({
              where: { ...scope, id: target.id },
              data: { updatedAt: new Date() },
            })
          : await tx.navigationMenu.create({ data: { ...scope, ...target } });
      if ('id' in target) {
        await tx.navigationMenuItem.deleteMany({ where: { ...scope, menuId: id } });
      }
      if (items.length) {
        await tx.navigationMenuItem.createMany({
          data: items.map((item) => ({ ...item, ...scope, menuId: id })),
        });
      }
      return tx.navigationMenu.findUniqueOrThrow({
        where: { ...scope, id },
        include: { items: orderedItems(scope) },
      });
    });
  }

  async categoryChoices(scope: Scope, offset: number, limit: number, words: string[]) {
    const category = this.database.client.category;
    const where = { ...scope, AND: namedSearch(words) };
    const [items, total] = await this.database.client.$transaction(
      [
        category.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          select: namedTarget,
        }),
        category.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  async collectionChoices(scope: Scope, offset: number, limit: number, words: string[]) {
    const collection = this.database.client.productCollection;
    const where = { ...scope, AND: namedSearch(words) };
    const [items, total] = await this.database.client.$transaction(
      [
        collection.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          select: namedTarget,
        }),
        collection.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  async pageChoices(scope: Scope, offset: number, limit: number, words: string[]) {
    const page = this.database.client.shopPage;
    const where: Prisma.ShopPageWhereInput = {
      ...scope,
      AND: words.map((word) => ({
        OR: [
          { slug: { contains: word, mode: 'insensitive' } },
          { titleBg: { contains: word, mode: 'insensitive' } },
          { titleEn: { contains: word, mode: 'insensitive' } },
        ],
      })),
    };
    const [items, total] = await this.database.client.$transaction(
      [
        page.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [{ slug: 'asc' }, { id: 'asc' }],
          select: pageTarget,
        }),
        page.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }
}
