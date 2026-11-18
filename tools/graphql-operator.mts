import { generate } from '../osnova/tools/graphql/generate.mjs';

const subgraphs = [
  {
    name: 'core',
    url: 'http://127.0.0.1:1/graphql',
    path: 'osnova/apps/core/src/modules/branches/branches.graphql',
    additionalPaths: ['osnova/apps/core/src/modules/tenants/tenants.graphql'],
  },
];
const operationPaths = [
  'osnova/packages/ui/src/app/auth/operations.graphql',
  'osnova/packages/ui/src/app/branches/operations.graphql',
];
const targets = {
  operator: {
    clients: [
      {
        path: 'osnova/packages/ui/src/app/generated/operations.ts',
        operations: operationPaths,
        subgraph: 'core',
      },
    ],
  },
};
await generate(subgraphs, operationPaths, targets, 'operator');
