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
];
export const operationPaths = [
  'osnova/packages/ui/src/app/auth/operations.graphql',
  'osnova/packages/ui/src/app/branches/operations.graphql',
  'holita/packages/operator/src/operations.graphql',
];
export const targets = {
  gateway: {
    supergraph: 'holita/apps/gateway/src/generated/graphql/supergraph.graphql',
    schema: 'holita/apps/gateway/src/generated/graphql/schema.graphql',
  },
  operator: {
    clients: [
      {
        path: 'holita/packages/operator/src/generated/operations.ts',
        operations: ['holita/packages/operator/src/operations.graphql'],
      },
    ],
  },
};
