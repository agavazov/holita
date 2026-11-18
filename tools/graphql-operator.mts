import { generate } from '../osnova/tools/graphql/generate.mjs';
import {
  operationPaths,
  scalars,
  subgraphs,
  targets,
} from '../discocan/tools/graphql/contracts.mjs';

await generate(subgraphs, operationPaths, targets, 'operator', scalars);
