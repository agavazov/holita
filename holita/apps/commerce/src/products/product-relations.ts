import type { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

export function productRelations(scope: Scope) {
  return {
    images: { where: scope, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
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
    variants: {
      where: { ...scope, active: true },
      orderBy: { price: 'asc' },
      take: 1,
      select: { price: true },
    },
  } satisfies Prisma.ProductInclude;
}
