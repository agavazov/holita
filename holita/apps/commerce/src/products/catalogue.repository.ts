import { BadRequestException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DatabaseService } from '../database.service.js';
import type {
  CatalogueCharacteristicGroupFacet,
  CatalogueSort,
} from '../generated/graphql/storefront-types.js';
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
  tagIds: string[];
  optionValueIds: string[];
  inStock: boolean;
  sort: CatalogueSort | null;
  characteristicChoiceIds: string[];
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
  NEWEST: Prisma.sql`"createdAt" DESC, "id" DESC`,
};
const snapshot = { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead };

function resultId(id: unknown): string {
  if (typeof id !== 'string' || !isUUID(id)) {
    throw new Error('Invalid catalogue ID');
  }
  return id;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
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
    const unassigned = {
      listing: null,
      join: Prisma.empty,
      order: Prisma.sql`NULL::integer`,
      manualCollection: false,
    };
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
            manualCollection: true,
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

  private searchCandidates(
    scope: Scope,
    base: Prisma.Sql,
    words: string[],
    matchingVariant: Prisma.Sql,
  ) {
    if (!words.length) {
      return base;
    }
    const phrase = escapeLike(words.join(' '));
    const prefix = phrase + '%';
    const contains = '%' + phrase + '%';
    // Each word may match a different public field when there is no phrase match.
    const tokenMatches = words.map(
      (word) => Prisma.sql`BOOL_OR(field.value ILIKE ${'%' + escapeLike(word) + '%'})`,
    );
    const categories = this.database.table('category');
    return Prisma.sql`
      WITH RECURSIVE public_categories AS (
        SELECT "tenantId", "branchId", "id", ARRAY["name"::text] AS names
        FROM ${categories}
        WHERE "tenantId" = ${scope.tenantId}::uuid AND "branchId" = ${scope.branchId}::uuid
          AND "active" AND "parentId" IS NULL
        UNION ALL
        SELECT child."tenantId", child."branchId", child."id", array_append(parent.names, child."name"::text)
        FROM ${categories} child
        JOIN public_categories parent ON child."tenantId" = parent."tenantId"
          AND child."branchId" = parent."branchId" AND child."parentId" = parent."id"
        WHERE child."active"
      )
      SELECT p.*, matches."searchRank"
      FROM (${base}) p
      LEFT JOIN ${this.database.table('brand')} b ON b."tenantId" = p."tenantId"
        AND b."branchId" = p."branchId" AND b."id" = p."brandId" AND b."status" = 'active'
      LEFT JOIN public_categories c ON c."tenantId" = p."tenantId"
        AND c."branchId" = p."branchId" AND c."id" = p."categoryId"
      CROSS JOIN LATERAL (
        SELECT COALESCE(
          MIN(CASE
            WHEN field.priority = 0 AND field.value ILIKE ${phrase} THEN 1
            WHEN field.priority = 1 AND field.value ILIKE ${phrase} THEN 2
            WHEN field.priority = 0 AND field.value ILIKE ${prefix} THEN 3
            WHEN field.value ILIKE ${contains} THEN 4 + field.priority
          END),
          CASE WHEN ${Prisma.join(tokenMatches, ' AND ')} THEN 7 END
        ) AS "searchRank"
        FROM (
          VALUES (p."name", 0), (b."name", 1),
            (p."descriptionBg", 2), (p."descriptionEn", 2)
          UNION ALL
          SELECT unnest(c.names), 1
          UNION ALL
          SELECT v."sku", 0 FROM ${this.database.table('productVariant')} v
          WHERE ${matchingVariant}
          UNION ALL
          SELECT t."name", 1 FROM ${this.database.table('productTagAssignment')} a
          JOIN ${this.database.table('productTag')} t ON t."tenantId" = a."tenantId"
            AND t."branchId" = a."branchId" AND t."id" = a."tagId"
          WHERE a."tenantId" = p."tenantId" AND a."branchId" = p."branchId"
            AND a."productId" = p."id"
        ) field(value, priority)
      ) matches
    `;
  }

  // Both the listing predicate and the facet counts use the same applicable product choices.
  private applicableCharacteristicChoices() {
    const products = this.database.table('product');
    const groupCategory = this.database.table('characteristicGroupCategory');
    const groupCategories = Prisma.sql`FROM ${groupCategory} gc
      WHERE gc."tenantId" = p."tenantId" AND gc."branchId" = p."branchId"
        AND gc."groupId" = g."id"`;
    return Prisma.sql`
      FROM ${this.database.table('productCharacteristicChoice')} f
      JOIN ${products} assigned
        ON assigned."tenantId" = f."tenantId" AND assigned."branchId" = f."branchId"
          AND assigned."id" = f."productId"
      JOIN ${this.database.table('characteristic')} c
        ON c."tenantId" = f."tenantId" AND c."branchId" = f."branchId"
          AND c."id" = f."characteristicId" AND c."active"
      JOIN ${this.database.table('characteristicGroup')} g
        ON g."tenantId" = c."tenantId" AND g."branchId" = c."branchId"
          AND g."id" = c."groupId" AND g."active"
      WHERE f."tenantId" = p."tenantId" AND f."branchId" = p."branchId" AND f."productId" = p."id"
        AND (
          NOT EXISTS (SELECT 1 ${groupCategories})
          OR EXISTS (SELECT 1 ${groupCategories} AND gc."categoryId" = assigned."categoryId")
        )`;
  }

  private async characteristicFilters(
    tx: Prisma.TransactionClient,
    scope: Scope,
    selectedIds: string[],
    base: Prisma.Sql,
    conditions: Prisma.Sql[],
  ) {
    const definitionOrder = [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }] as const;
    const groups = await tx.characteristicGroup.findMany({
      where: { ...scope, active: true },
      orderBy: [...definitionOrder],
      select: {
        id: true,
        name: true,
        characteristics: {
          where: { ...scope, active: true, kind: { not: 'TEXT' }, choices: { some: scope } },
          orderBy: [...definitionOrder],
          select: {
            id: true,
            name: true,
            choices: { where: scope, orderBy: defaultOrder, select: { id: true, name: true } },
          },
        },
      },
    });
    const choiceFields = new Map(
      groups.flatMap(({ characteristics }) =>
        characteristics.flatMap(({ id, choices }) =>
          choices.map((choice) => [choice.id, id] as const),
        ),
      ),
    );
    const selections = new Map<string, string[]>();
    let valid = true;
    for (const id of selectedIds) {
      const field = choiceFields.get(id);
      if (field) {
        const selection = selections.get(field) ?? [];
        selection.push(id);
        selections.set(field, selection);
      } else {
        valid = false;
      }
    }
    const facets: CatalogueCharacteristicGroupFacet[] = [];
    if (!choiceFields.size) {
      return { predicates: [], facets, valid };
    }
    const applicable = this.applicableCharacteristicChoices();
    const filters = [...selections].map(([id, ids]) => ({
      id,
      matches: Prisma.sql`EXISTS (
        SELECT 1 ${applicable} AND f."choiceId" = ANY(${ids}::uuid[])
      )`,
    }));
    const countWhere = Prisma.join(
      [
        ...conditions,
        ...filters.map(
          ({ id, matches }) => Prisma.sql`(choice."characteristicId" = ${id}::uuid OR ${matches})`,
        ),
        ...(valid ? [] : [Prisma.sql`FALSE`]),
      ],
      ' AND ',
    );
    const counted = await tx.$queryRaw<{ id: unknown; count: number }[]>(Prisma.sql`
      SELECT choice."choiceId" AS id, COUNT(*) FILTER (WHERE ${countWhere})::int AS count
      FROM (${base}) p
      CROSS JOIN LATERAL (SELECT f."choiceId", f."characteristicId" ${applicable}) choice
      GROUP BY choice."choiceId"
    `);
    const counts = new Map(counted.map(({ id, count }) => [resultId(id), count]));
    for (const group of groups) {
      const characteristics = group.characteristics.flatMap(({ choices, ...field }) => {
        const countedChoices = choices.flatMap((choice) => {
          const count = counts.get(choice.id);
          return count === undefined ? [] : [{ ...choice, count }];
        });
        return countedChoices.length ? [{ ...field, choices: countedChoices }] : [];
      });
      if (characteristics.length) {
        facets.push({ id: group.id, name: group.name, characteristics });
      }
    }
    return { predicates: filters.map(({ matches }) => matches), facets, valid };
  }

  async page(scope: Scope, route: CatalogueRoute, criteria: BrowseCriteria) {
    return this.database.client.$transaction(async (tx) => {
      const membership = await this.membership(tx, scope, route);
      if (!membership) {
        return null;
      }
      const {
        offset,
        limit,
        words,
        minPrice,
        maxPrice,
        brandIds,
        tagIds,
        optionValueIds,
        inStock,
        sort,
      } = criteria;
      const variants = this.database.table('productVariant');
      const links = this.database.table('productVariantValue');
      const tagAssignments = this.database.table('productTagAssignment');
      const activeVariant = Prisma.sql`v."productId" = p."id" AND v."tenantId" = p."tenantId"
        AND v."branchId" = p."branchId" AND v."active"`;
      const products = Prisma.sql`FROM ${this.database.table('product')} p ${membership.join}`;
      const publicProduct = Prisma.sql`p."tenantId" = ${scope.tenantId}::uuid
        AND p."branchId" = ${scope.branchId}::uuid AND p."status" = 'active'
        AND ${membership.condition}`;
      const searchColumns = words.length
        ? Prisma.sql`, p."categoryId", p."descriptionBg", p."descriptionEn"`
        : Prisma.empty;
      const base = Prisma.sql`SELECT p."tenantId", p."branchId", p."id", p."name", p."brandId",
          p."createdAt", ${membership.order} AS "sortOrder", offer.price${searchColumns}
        ${products}
        CROSS JOIN LATERAL (SELECT MIN(v."price") AS price FROM ${variants} v WHERE ${activeVariant}) offer
        WHERE ${publicProduct} AND offer.price IS NOT NULL`;
      const visibleOption = { ...scope, active: true, showInFilters: true };
      const brands = await tx.brand.findMany({
        where: { ...scope, status: 'ACTIVE' },
        orderBy: defaultOrder,
      });
      const tags = await tx.productTag.findMany({
        where: tagWhere(scope),
        orderBy: defaultOrder,
        select: identity,
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
      // Materialize the member products of manual collections so option links use indexed lookups.
      const facetQuery = membership.manualCollection
        ? Prisma.sql`
          WITH candidates AS (${base})
          SELECT DISTINCT 'brand' AS kind, p."brandId" AS id
          FROM candidates p WHERE p."brandId" IS NOT NULL
          UNION ALL
          SELECT DISTINCT 'option' AS kind, l."optionValueId" AS id
          FROM candidates p JOIN ${variants} v ON ${activeVariant}
          JOIN ${links} l ON l."tenantId" = v."tenantId" AND l."branchId" = v."branchId"
            AND l."variantId" = v."id"
          UNION ALL
          SELECT DISTINCT 'tag' AS kind, a."tagId" AS id
          FROM candidates p
          JOIN ${tagAssignments} a ON a."tenantId" = p."tenantId" AND a."branchId" = p."branchId"
            AND a."productId" = p."id"
        `
        : Prisma.sql`
          WITH offers AS (
            SELECT v."tenantId", v."branchId", v."id", v."productId", p."brandId"
            ${products}
            JOIN ${variants} v ON ${activeVariant}
            WHERE ${publicProduct}
          )
          SELECT DISTINCT 'brand' AS kind, "brandId" AS id
          FROM offers WHERE "brandId" IS NOT NULL
          UNION ALL
          SELECT DISTINCT 'option' AS kind, l."optionValueId" AS id
          FROM offers v
          JOIN ${links} l ON l."tenantId" = v."tenantId" AND l."branchId" = v."branchId"
            AND l."variantId" = v."id"
          UNION ALL
          SELECT DISTINCT 'tag' AS kind, a."tagId" AS id
          FROM offers v
          JOIN ${tagAssignments} a ON a."tenantId" = v."tenantId" AND a."branchId" = v."branchId"
            AND a."productId" = v."productId"
        `;
      const facets = await tx.$queryRaw<{ kind: string; id: unknown }[]>(facetQuery);
      const brandFacets = new Set(
        facets.filter(({ kind }) => kind === 'brand').map(({ id }) => resultId(id)),
      );
      const optionFacets = new Set(
        facets.filter(({ kind }) => kind === 'option').map(({ id }) => resultId(id)),
      );
      const tagFacets = new Set(
        facets.filter(({ kind }) => kind === 'tag').map(({ id }) => resultId(id)),
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
      const characteristicFacets: CatalogueCharacteristicGroupFacet[] = [];
      const page = {
        listing: membership.listing,
        facets: {
          brands: brands.filter(({ id }) => brandFacets.has(id)),
          tags: tags.filter(({ id }) => tagFacets.has(id)),
          options: [...optionGroups.values()],
          characteristicFacets,
        },
        offset,
        limit,
      };
      const publicBrandIds = new Set(brands.map(({ id }) => id));
      const publicTagIds = new Set(tags.map(({ id }) => id));
      if (
        brandIds.some((id) => !publicBrandIds.has(id)) ||
        tagIds.some((id) => !publicTagIds.has(id)) ||
        selectedOptions.length !== optionValueIds.length
      ) {
        return { ...page, items: [], total: 0 };
      }

      const conditions = [Prisma.sql`TRUE`];
      if (minPrice !== null) {
        conditions.push(Prisma.sql`p.price >= ${minPrice}::numeric`);
      }
      if (maxPrice !== null) {
        conditions.push(Prisma.sql`p.price <= ${maxPrice}::numeric`);
      }
      if (brandIds.length) {
        conditions.push(Prisma.sql`p."brandId" = ANY(${brandIds}::uuid[])`);
      }
      if (tagIds.length) {
        conditions.push(Prisma.sql`EXISTS (
          SELECT 1 FROM ${tagAssignments} a
          WHERE a."tenantId" = p."tenantId" AND a."branchId" = p."branchId"
            AND a."productId" = p."id" AND a."tagId" = ANY(${tagIds}::uuid[])
        )`);
      }
      const stock = inStock
        ? Prisma.sql`AND (NOT v."inventoryTracked" OR v."quantity" >= v."minimumQuantity")`
        : Prisma.empty;
      const options = optionValueIds.map(
        (id) => Prisma.sql`AND EXISTS (
          SELECT 1 FROM ${links} l
          WHERE l."tenantId" = v."tenantId" AND l."branchId" = v."branchId"
            AND l."variantId" = v."id" AND l."optionValueId" = ${id}::uuid
        )`,
      );
      const optionMatches = options.length ? Prisma.join(options, ' ') : Prisma.empty;
      const matchingVariant = Prisma.sql`${activeVariant} ${stock} ${optionMatches}`;
      if (inStock || optionValueIds.length) {
        conditions.push(Prisma.sql`EXISTS (
          SELECT 1 FROM ${variants} v WHERE ${matchingVariant}
        )`);
      }
      const candidates = this.searchCandidates(scope, base, words, matchingVariant);
      if (words.length) {
        // Search narrows counts and results while the listing still supplies all its choices.
        conditions.push(Prisma.sql`p."searchRank" IS NOT NULL`);
      }
      const characteristics = await this.characteristicFilters(
        tx,
        scope,
        criteria.characteristicChoiceIds,
        candidates,
        conditions,
      );
      page.facets.characteristicFacets = characteristics.facets;
      if (!characteristics.valid) {
        return { ...page, items: [], total: 0 };
      }
      const filtered = Prisma.sql`FROM (${candidates}) p
        WHERE ${Prisma.join([...conditions, ...characteristics.predicates], ' AND ')}`;
      const order = sort
        ? sortOrder[sort]
        : words.length
          ? Prisma.sql`"searchRank" ASC, "name" ASC, "id" ASC`
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
