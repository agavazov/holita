export const subgraphs = [
  {
    name: 'core',
    url: 'http://127.0.0.1:12011/graphql',
    path: 'osnova/apps/core/src/modules/branches/branches.graphql',
    additionalPaths: ['osnova/apps/core/src/modules/tenants/tenants.graphql'],
  },
  {
    name: 'commerce',
    url: 'http://127.0.0.1:12013/graphql',
    path: 'holita/apps/commerce/src/commerce.graphql',
    additionalPaths: [],
  },
  {
    name: 'sales',
    url: 'http://127.0.0.1:12015/graphql',
    path: 'holita/apps/sales-api/src/sales.graphql',
    additionalPaths: [],
  },
];
export const operationPaths = [
  'osnova/packages/ui/src/app/auth/operations.graphql',
  'osnova/packages/ui/src/app/branches/operations.graphql',
  'holita/packages/operator/src/operations.graphql',
  'holita/apps/sales/src/workspace/operations.graphql',
  'holita/apps/admin/src/badges/operations.graphql',
  'holita/apps/admin/src/blog/operations.graphql',
  'holita/apps/admin/src/brands/operations.graphql',
  'holita/apps/admin/src/categories/operations.graphql',
  'holita/apps/admin/src/collections/operations.graphql',
  'holita/apps/admin/src/customers/operations.graphql',
  'holita/apps/admin/src/dashboard/operations.graphql',
  'holita/apps/admin/src/discounts/operations.graphql',
  'holita/apps/admin/src/inventory/operations.graphql',
  'holita/apps/admin/src/navigation/operations.graphql',
  'holita/apps/admin/src/options/operations.graphql',
  'holita/apps/admin/src/orders/operations.graphql',
  'holita/apps/admin/src/pages/operations.graphql',
  'holita/apps/admin/src/payment-methods/operations.graphql',
  'holita/apps/admin/src/shipping-methods/operations.graphql',
  'holita/apps/admin/src/shop-settings/operations.graphql',
  'holita/apps/admin/src/products/operations.graphql',
  'holita/apps/admin/src/characteristics/operations.graphql',
];
export const targets = {
  gateway: {
    supergraph: 'holita/apps/gateway/src/generated/graphql/supergraph.graphql',
    schema: 'holita/apps/gateway/src/generated/graphql/schema.graphql',
  },
  sales: {
    server: {
      subgraph: 'sales',
      path: 'holita/apps/sales-api/src/generated/graphql/types.ts',
    },
    clients: [
      {
        path: 'holita/apps/sales/src/generated/operations.ts',
        operations: ['holita/apps/sales/src/workspace/operations.graphql'],
      },
    ],
  },
  operator: {
    clients: [
      {
        path: 'holita/packages/operator/src/generated/operations.ts',
        operations: ['holita/packages/operator/src/operations.graphql'],
      },
    ],
  },
  admin: {
    clients: [
      {
        path: 'holita/apps/admin/src/generated/badges-operations.ts',
        operations: ['holita/apps/admin/src/badges/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/blog-operations.ts',
        operations: ['holita/apps/admin/src/blog/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/characteristics-operations.ts',
        operations: ['holita/apps/admin/src/characteristics/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/products-operations.ts',
        operations: ['holita/apps/admin/src/products/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/brands-operations.ts',
        operations: ['holita/apps/admin/src/brands/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/categories-operations.ts',
        operations: ['holita/apps/admin/src/categories/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/collections-operations.ts',
        operations: ['holita/apps/admin/src/collections/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/customers-operations.ts',
        operations: ['holita/apps/admin/src/customers/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/dashboard-operations.ts',
        operations: ['holita/apps/admin/src/dashboard/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/discounts-operations.ts',
        operations: ['holita/apps/admin/src/discounts/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/inventory-operations.ts',
        operations: ['holita/apps/admin/src/inventory/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/navigation-operations.ts',
        operations: ['holita/apps/admin/src/navigation/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/options-operations.ts',
        operations: ['holita/apps/admin/src/options/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/pages-operations.ts',
        operations: ['holita/apps/admin/src/pages/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/payment-methods-operations.ts',
        operations: ['holita/apps/admin/src/payment-methods/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/shipping-methods-operations.ts',
        operations: ['holita/apps/admin/src/shipping-methods/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/shop-settings-operations.ts',
        operations: ['holita/apps/admin/src/shop-settings/operations.graphql'],
      },
      {
        path: 'holita/apps/admin/src/generated/orders-operations.ts',
        operations: ['holita/apps/admin/src/orders/operations.graphql'],
      },
    ],
  },
};
