import { generate } from '../../osnova/tools/graphql/generate.mjs';
import { operationPaths, subgraphs, targets } from './graphql/contracts.mjs';

await generate(subgraphs, operationPaths, targets, 'gateway');
await generate(subgraphs, operationPaths, targets, 'sales');
await generate(subgraphs, operationPaths, targets, 'operator');
await generate(subgraphs, operationPaths, targets, 'admin');

const storefront = await import('./graphql/storefront-contracts.mjs');
await generate(storefront.subgraphs, storefront.operationPaths, storefront.targets, 'gateway');
await generate(storefront.subgraphs, storefront.operationPaths, storefront.targets, 'storefront');
