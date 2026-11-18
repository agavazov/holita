import { generate } from '../osnova/tools/graphql/generate.mjs';
import {
  operationPaths,
  scalars,
  subgraphs,
  targets,
} from '../discocan/tools/graphql/contracts.mjs';
import * as holita from '../holita/tools/graphql/contracts.mjs';

// Register each product with local GraphQL contracts here.
for (const product of [
  { operationPaths, scalars, subgraphs, targets },
  { ...holita, scalars: {} },
]) {
  await generate(
    product.subgraphs,
    product.operationPaths,
    product.targets,
    'check',
    product.scalars,
  );
}
