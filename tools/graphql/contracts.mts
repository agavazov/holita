import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { composeServices } from '@apollo/composition';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { lexicographicSortSchema, parse, printSchema, validate, type GraphQLSchema } from 'graphql';

export const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
export const subgraphs = [
  {
    name: 'core',
    url: 'http://127.0.0.1:11082/graphql',
    path: 'apps/core/src/stores/stores.graphql',
  },
  {
    name: 'products',
    url: 'http://127.0.0.1:11083/graphql',
    path: 'apps/products/src/products/products.graphql',
  },
  {
    name: 'reference',
    url: 'http://127.0.0.1:11086/graphql',
    path: 'apps/reference/src/venues/venues.graphql',
    additionalPaths: [
      'apps/reference/src/events/events.graphql',
      'apps/reference/src/speakers/speakers.graphql',
      'apps/reference/src/tags/tags.graphql',
      'apps/reference/src/sessions/sessions.graphql',
      'apps/reference/src/media/media.graphql',
    ],
  },
];
export const operationPaths = [
  'apps/admin-react/src/features/stores/operations.graphql',
  'apps/admin-react/src/features/products/operations.graphql',
  'apps/products/src/core/operations.graphql',
  'apps/reference/src/core/operations.graphql',
  'apps/admin-react/src/features/reference/speakers/operations.graphql',
  'apps/admin-react/src/features/reference/tags/operations.graphql',
  'apps/admin-react/src/features/reference/events/operations.graphql',
  'apps/admin-react/src/features/reference/venues/operations.graphql',
  'apps/admin-react/src/features/reference/sessions/operations.graphql',
  'apps/admin-react/src/features/reference/media/operations.graphql',
];

export async function readContracts() {
  return Promise.all(
    subgraphs.map(async (subgraph) => ({
      ...subgraph,
      typeDefs: parse(
        (
          await Promise.all(
            [subgraph.path, ...(subgraph.additionalPaths ?? [])].map((path) =>
              readFile(new URL(`../../${path}`, import.meta.url), 'utf8'),
            ),
          )
        ).join('\n'),
      ),
    })),
  );
}

export function composeContracts(contracts: Awaited<ReturnType<typeof readContracts>>) {
  const result = composeServices(contracts);
  if (!result.schema || !result.supergraphSdl) {
    throw new Error(
      `Composition failed:\n${result.errors?.map((error) => error.message).join('\n') ?? 'No supergraph produced'}`,
    );
  }
  const apiSchema = result.schema.toAPISchema().toGraphQLJSSchema();
  const schemas = new Map(
    contracts.map((contract) => [
      contract.name,
      buildSubgraphSchema({ typeDefs: contract.typeDefs }),
    ]),
  );
  return {
    apiSchema,
    schemas,
    supergraphSdl: result.supergraphSdl,
    clientSdl: printSchema(lexicographicSortSchema(apiSchema)) + '\n',
  };
}

export function validateOperation(schema: GraphQLSchema, source: string, location: string) {
  const document = parse(source);
  const errors = validate(schema, document);
  if (errors.length)
    throw new Error(`${location}:\n${errors.map((error) => error.message).join('\n')}`);
  return { document, location };
}

export async function readOperations(schema: GraphQLSchema) {
  return Promise.all(
    operationPaths.map(async (path) =>
      validateOperation(
        schema,
        await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'),
        path,
      ),
    ),
  );
}
