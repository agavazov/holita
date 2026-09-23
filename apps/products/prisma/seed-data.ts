import { ProductStatus, type PrismaClient } from '../src/generated/prisma/client.js';

// Stable store IDs are an explicit seed contract; no cross-application model import.
export const productSeeds = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    storeId: '10000000-0000-4000-8000-000000000001',
    name: 'Sofia notebook',
    sku: 'NOTE-001',
    status: ProductStatus.ACTIVE,
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    storeId: '10000000-0000-4000-8000-000000000001',
    name: 'Sofia pen',
    sku: 'PEN-001',
    status: ProductStatus.DRAFT,
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    storeId: '10000000-0000-4000-8000-000000000001',
    name: 'Sofia bag',
    sku: 'BAG-001',
    status: ProductStatus.ACTIVE,
  },
  {
    id: '20000000-0000-4000-8000-000000000101',
    storeId: '10000000-0000-4000-8000-000000000002',
    name: 'Plovdiv notebook',
    sku: 'NOTE-001',
    status: ProductStatus.DRAFT,
  },
  {
    id: '20000000-0000-4000-8000-000000000102',
    storeId: '10000000-0000-4000-8000-000000000002',
    name: 'Plovdiv pen',
    sku: 'PEN-001',
    status: ProductStatus.ACTIVE,
  },
  {
    id: '20000000-0000-4000-8000-000000000103',
    storeId: '10000000-0000-4000-8000-000000000002',
    name: 'Plovdiv bag',
    sku: 'BAG-001',
    status: ProductStatus.ACTIVE,
  },
];

export function seedProducts(client: PrismaClient) {
  return client.product.createMany({ data: productSeeds, skipDuplicates: true });
}
