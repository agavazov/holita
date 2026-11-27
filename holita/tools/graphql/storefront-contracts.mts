export const subgraphs = [
  {
    name: 'commerce',
    url: 'http://127.0.0.1:12013/storefront/graphql',
    path: 'holita/apps/commerce/src/storefront.graphql',
    additionalPaths: [],
  },
];
export const operationPaths = [
  'holita/apps/storefront/src/operations.graphql',
  'holita/tools/graphql/shopper-address-operations.graphql',
];
export const targets = {
  gateway: {
    supergraph: 'holita/apps/gateway/src/generated/storefront/supergraph.graphql',
    schema: 'holita/apps/gateway/src/generated/storefront/schema.graphql',
  },
  storefront: {
    clients: [
      { path: 'holita/apps/storefront/src/generated/operations.ts', operations: operationPaths },
    ],
  },
};
