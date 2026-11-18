import { generate } from '../../../osnova/tools/graphql/generate.mjs';
import { operationPaths, scalars, subgraphs, targets } from './contracts.mjs';

const target = process.argv[2];
if (!target || process.argv.length !== 3) {
  throw new Error('Use npm run codegen, schema:compose or schema:check');
}
await generate(subgraphs, operationPaths, targets, target, scalars);
