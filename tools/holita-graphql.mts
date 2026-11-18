import { generate } from '../osnova/tools/graphql/generate.mjs';
import { operationPaths, subgraphs, targets } from '../holita/tools/graphql/contracts.mjs';

await generate(subgraphs, operationPaths, targets, 'gateway');
await generate(subgraphs, operationPaths, targets, 'operator');
