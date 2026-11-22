import { BadRequestException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DatabaseService } from '../database.service.js';
import type { CatalogueSort } from '../generated/graphql/storefront-types.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';
import { catalogueProductRelations, catalogueProductWhere } from './product-relations.js';

export type CatalogueRoute =
  | { kind: 'all' }
  | { kind: 'category'; ids: string[] }
  | { kind: 'brand' | 'collection' | 'tag'; slug: string };

export interface BrowseCriteria {
  offset: number;
  limit: number;
  words: string[];
  minPrice: string | null;
  maxPrice: string | null;
  brandIds: string[];
  optionValueIds: string[];
  inStock: boolean;
  sort: CatalogueSort | null;
}

const identity = { id: true, name: true, slug: true };
const defaultOrder = [
  { name: 'asc' },
  { id: 'asc' },
] satisfies Prisma.ProductOrderByWithRelationInput[];
const sortOrder: Record<CatalogueSort, Prisma.Sql> = {
  NAME_ASC: Prisma.sql`"name" ASC, "id" ASC`,
  NAME_DESC: Prisma.sql`"name" DESC, "id" ASC`,
  PRICE_ASC: Prisma.sql`"price" ASC, "id" ASC`,
  PRICE_DESC: Prisma.sql`"price" DESC, "id" ASC`,
};
const snapshot = { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead };

function resultId(id: unknown): string {
  if (typeof id !== 'string' || !isUUID(id)) {
    throw new Error('Invalid catalogue ID');
  }
  return id;
}

function tagWhere(scope: Scope) {
  return {
    ...scope,
    assignments: { some: { ...scope, product: catalogueProductWhere(scope) } },
  } satisfies Prisma.ProductTagWhereInput;
}

@Injectable()
export class CatalogueRepository {
  constructor(private readonly database: DatabaseService) {}

  async brands(scope: Scope, offset: number, limit: number) {
    const where = { ...scope, status: 'ACTIVE' } satisfies Prisma.BrandWhereInput;
    const db = this.database.client;
    const [items, total] = await db.$transaction(
      [
        db.brand.findMany({ where, skip: offset, take: limit, orderBy: defaultOrder }),
        db.brand.count({ where }),
      ],
      snapshot,
    );
    return { items, total, offset, limit };
  }

  async tags(scope: Scope, offset: number, limit: number) {
    const where = tagWhere(scope);
    const db = this.database.client;
    const [items, total] = await db.$transaction(
      [
        db.productTag.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: defaultOrder,
          select: identity,
        }),
        db.productTag.count({ where }),
      ],
      snapshot,
    );
    return { items, total, offset, limit };
  }

  private async membership(tx: Prisma.TransactionClient, scope: Scope, route: CatalogueRoute) {
    const unassigned = { listing: null, join: Prisma.empty, order: Prisma.sql`NULL::integer` };
    switch (route.kind) {
      case 'all':
        return { ...unassigned, condition: Prisma.sql`TRUE` };
      case 'category':
        return { ...unassigned, condition: Prisma.sql`p."categoryId" = ANY(${route.ids}::uuid[])` };
      case 'brand': {
        const listing = await tx.brand.findUnique({
          where: { tenantId_branchId_slug: { ...scope, slug: route.slug }, status: 'ACTIVE' },
          select: identity,
        });
        return (
          listing && {
            ...unassigned,
            listing,
            condition: Prisma.sql`p."brandId" = ${listing.id}::uuid`,
          }
        );
      }
      case 'tag': {
        const listing = await tx.productTag.findUnique({
          where: { tenantId_branchId_slug: { ...scope, slug: route.slug }, ...tagWhere(scope) },
          select: identity,
        });
        return (
          listing && {
            ...unassigned,
            listing,
            condition: Prisma.sql`EXISTS (
            SELECT 1 FROM ${this.database.table('productTagAssignment')} t
            WHERE t."tenantId" = p."tenantId" AND t."branchId" = p."branchId"
              AND t."productId" = p."id" AND t."tagId" = ${listing.id}::uuid
          )`,
          }
        );
      }
      case 'collection': {
        const listing = await tx.productCollection.findUnique({
          where: { tenantId_branchId_slug: { ...scope, slug: route.slug }, active: true },
          select: { ...identity, mode: true, categoryId: true, brandId: true },
        });
        if (!listing) {
          return null;
        }
        if (listing.mode === 'MANUAL') {
          return {
            listing,
            join: Prisma.sql`JOIN ${this.database.table('productCollectionItem')} c
              ON c."tenantId" = p."tenantId" AND c."branchId" = p."branchId"
                AND c."productId" = p."id" AND c."collectionId" = ${listing.id}::uuid`,
            condition: Prisma.sql`TRUE`,
            order: Prisma.sql`c."sortOrder"`,
          };
        }
        const condition =
          listing.mode === 'CATEGORY'
            ? Prisma.sql`p."categoryId" = ${listing.categoryId}::uuid`
            : Prisma.sql`p."brandId" = ${listing.brandId}::uuid`;
        return { ...unassigned, listing, condition };
      }
    }
  }

  async page(scope: Scope, route: CatalogueRoute, criteria: BrowseCriteria) {
    return this.database.client.$transaction(async (tx) => {
      const membership = await this.membership(tx, scope, route);
      if (!membership) {
        return null;
      }
      const { offset, limit, words, minPrice, maxPrice, brandIds, optionValueIds, inStock, sort } =
        criteria;
      const variants = this.database.table('productVariant');
      const links = this.database.table('productVariantValue');
      const activeVariant = Prisma.sql`v."productId" = p."id" AND v."tenantId" = p."tenantId"
        AND v."branchId" = p."branchId" AND v."active"`;
      const productScope = Prisma.sql`p."tenantId" = ${scope.tenantId}::uuid
        AND p."branchId" = ${scope.branchId}::uuid AND p."status" = 'active'`;
      const base = Prisma.sql`SELECT p."tenantId", p."branchId", p."id", p."name", p."brandId",
          ${membership.order} AS "sortOrder", offer.price
        FROM ${this.database.table('product')} p
        ${membership.join}
        CROSS JOIN LATERAL (SELECT MIN(v."price") AS price FROM ${variants} v WHERE ${activeVariant}) offer
        WHERE ${productScope} AND ${membership.condition} AND offer.price IS NOT NULL`;
      const visibleOption = { ...scope, active: true, showInFilters: true };
      const brands = await tx.brand.findMany({
        where: { ...scope, status: 'ACTIVE' },
        orderBy: defaultOrder,
      });
      const choices = await tx.optionValue.findMany({
        where: { ...scope, option: visibleOption },
        orderBy: [
          { option: { name: 'asc' } },
          { optionId: 'asc' },
          { sortOrder: 'asc' },
          { id: 'asc' },
        ],
        select: { id: true, label: true, option: { select: { id: true, name: true } } },
      });
      const selectedOptions = choices.filter(({ id }) => optionValueIds.includes(id));
      if (new Set(selectedOptions.map(({ option }) => option.id)).size !== selectedOptions.length) {
        throw new BadRequestException('Choose one value per option');
      }
      const facets = await tx.$queryRaw<{ kind: string; id: unknown }[]>(Prisma.sql`
        WITH candidates AS (${base})
        SELECT DISTINCT 'brand' AS kind, p."brandId" AS id
        FROM candidates p WHERE p."brandId" IS NOT NULL
        UNION ALL
        SELECT DISTINCT 'option' AS kind, l."optionValueId" AS id
        FROM candidates p JOIN ${variants} v ON ${activeVariant}
        JOIN ${links} l ON l."tenantId" = v."tenantId" AND l."branchId" = v."branchId"
          AND l."variantId" = v."id"
      `);
      const brandFacets = new Set(
        facets.filter(({ kind }) => kind === 'brand').map(({ id }) => resultId(id)),
      );
      const optionFacets = new Set(
        facets.filter(({ kind }) => kind === 'option').map(({ id }) => resultId(id)),
      );
      const optionGroups = new Map<
        string,
        { id: string; name: string; values: { id: string; label: string }[] }
      >();
      for (const { id, label, option } of choices) {
        if (!optionFacets.has(id)) {
          continue;
        }
        const group = optionGroups.get(option.id) ?? { ...option, values: [] };
        group.values.push({ id, label });
        optionGroups.set(option.id, group);
      }
      const page = {
        listing: membership.listing,
        facets: {
          brands: brands.filter(({ id }) => brandFacets.has(id)),
          options: [...optionGroups.values()],
        },
        offset,
        limit,
      };
      const publicBrandIds = new Set(brands.map(({ id }) => id));
      if (
        brandIds.some((id) => !publicBrandIds.has(id)) ||
        selectedOptions.length !== optionValueIds.length
      ) {
        return { ...page, items: [], total: 0 };
      }

      const conditions = [
        Prisma.sql`TRUE`,
        ...words.map(
          (word) => Prisma.sql`p."name" ILIKE ${'%' + word.replace(/[\\%_]/g, '\\$&') + '%'}`,
        ),
      ];
      if (minPrice !== null) {
        conditions.push(Prisma.sql`p.price >= ${minPrice}::numeric`);
      }
      if (maxPrice !== null) {
        conditions.push(Prisma.sql`p.price <= ${maxPrice}::numeric`);
      }
      if (brandIds.length) {
        conditions.push(Prisma.sql`p."brandId" = ANY(${brandIds}::uuid[])`);
      }
      if (inStock || optionValueIds.length) {
        const stock = inStock
          ? Prisma.sql`AND (NOT v."inventoryTracked" OR v."quantity" > 0)`
          : Prisma.empty;
        const options = optionValueIds.map(
          (id) => Prisma.sql`AND EXISTS (
          SELECT 1 FROM ${links} l
          WHERE l."tenantId" = v."tenantId" AND l."branchId" = v."branchId"
            AND l."variantId" = v."id" AND l."optionValueId" = ${id}::uuid
        )`,
        );
        const choicePredicates = options.length ? Prisma.join(options, ' ') : Prisma.empty;
        conditions.push(Prisma.sql`EXISTS (
          SELECT 1 FROM ${variants} v WHERE ${activeVariant} ${stock} ${choicePredicates}
        )`);
      }
      const filtered = Prisma.sql`FROM (${base}) p WHERE ${Prisma.join(conditions, ' AND ')}`;
      const order = sort
        ? sortOrder[sort]
        : route.kind === 'all'
          ? Prisma.sql`"name" ASC, "id" DESC`
          : Prisma.sql`"sortOrder" ASC NULLS LAST, "name" ASC, "id" ASC`;
      const [count] = await tx.$queryRaw<{ total: number }[]>(
        Prisma.sql`SELECT COUNT(*)::int AS total ${filtered}`,
      );
      const rows = await tx.$queryRaw<{ id: unknown }[]>(Prisma.sql`
        SELECT p."id" ${filtered} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}
      `);
      if (!count || !Number.isInteger(count.total)) {
        throw new Error('Invalid catalogue total');
      }
      const ids = rows.map(({ id }) => resultId(id));
      const items = await tx.product.findMany({
        where: { ...scope, id: { in: ids } },
        include: catalogueProductRelations(scope),
      });
      const indexed = new Map(items.map((item) => [item.id, item]));
      return { ...page, items: ids.flatMap((id) => indexed.get(id) ?? []), total: count.total };
    }, snapshot);
  }
}
