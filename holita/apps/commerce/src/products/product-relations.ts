import type { Option, OptionValue, Prisma, ProductVariant } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

function badgeAssignments(scope: Scope, activeOnly = false) {
  return {
    where: { ...scope, badge: { ...scope, ...(activeOnly ? { active: true } : {}) } },
    orderBy: [{ badge: { sortOrder: 'asc' } }, { badge: { name: 'asc' } }, { badgeId: 'asc' }],
    select: {
      badge: {
        select: { id: true, name: true, slug: true, active: true, color: true, sortOrder: true },
      },
    },
  } satisfies Prisma.Product$badgeAssignmentsArgs;
}

export function productRelations(scope: Scope) {
  return {
    images: { where: scope, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
    badgeAssignments: badgeAssignments(scope),
    tagAssignments: {
      where: { ...scope, tag: scope },
      orderBy: [{ tag: { name: 'asc' } }, { tagId: 'asc' }],
      select: { tag: { select: { id: true, name: true, slug: true } } },
    },
    variants: {
      where: scope,
      orderBy: { sortOrder: 'asc' },
      include: { values: { where: scope, select: { optionValueId: true } } },
    },
  } satisfies Prisma.ProductInclude;
}

export function catalogueProductWhere(scope: Scope) {
  return {
    ...scope,
    status: 'ACTIVE',
    variants: { some: { ...scope, active: true } },
  } satisfies Prisma.ProductWhereInput;
}

export function catalogueProductRelations(scope: Scope) {
  return {
    ...productRelations(scope),
    brand: true,
    badgeAssignments: badgeAssignments(scope, true),
    variants: {
      where: { ...scope, active: true },
      orderBy: { price: 'asc' },
      select: { price: true, quantity: true, inventoryTracked: true },
    },
  } satisfies Prisma.ProductInclude;
}

export function catalogueVariantValues(scope: Scope) {
  return {
    where: {
      ...scope,
      optionValue: { ...scope, option: { ...scope, active: true } },
    },
    select: {
      optionValue: {
        select: {
          id: true,
          label: true,
          sortOrder: true,
          option: { select: { id: true, name: true } },
        },
      },
    },
  } satisfies Prisma.ProductVariant$valuesArgs;
}

type CatalogueOptionValue = Pick<OptionValue, 'id' | 'sortOrder'> & {
  option: Pick<Option, 'id' | 'name'>;
};

export function compareCatalogueOptionValues(
  left: CatalogueOptionValue,
  right: CatalogueOptionValue,
) {
  return (
    left.option.name.localeCompare(right.option.name) ||
    left.option.id.localeCompare(right.option.id) ||
    left.sortOrder - right.sortOrder ||
    left.id.localeCompare(right.id)
  );
}

export function trackedVariantQuantity({
  inventoryTracked,
  quantity,
}: Pick<ProductVariant, 'inventoryTracked' | 'quantity'>): number | null {
  return inventoryTracked ? quantity : null;
}
