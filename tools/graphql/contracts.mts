import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { composeServices } from '@apollo/composition';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { lexicographicSortSchema, parse, printSchema, validate, type GraphQLSchema } from 'graphql';

export const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
export const subgraphs = [
  {
    name: 'karma-client',
    url: 'http://127.0.0.1:11014/graphql',
    path: 'apps/karma-client/src/modules/cars/cars.graphql',
    additionalPaths: [
      'apps/karma-client/src/modules/accounts/accounts.graphql',
      'apps/karma-client/src/modules/edata/edata.graphql',
      'apps/karma-client/src/modules/history/history.graphql',
      'apps/karma-client/src/modules/location/location.graphql',
      'apps/karma-client/src/modules/references/references.graphql',
    ],
  },
  {
    name: 'core',
    url: 'http://127.0.0.1:11011/graphql',
    path: 'apps/core/src/modules/branches/branches.graphql',
    additionalPaths: ['apps/core/src/modules/tenants/tenants.graphql'],
  },
  {
    name: 'fleet',
    url: 'http://127.0.0.1:11013/graphql',
    path: 'apps/fleet/src/modules/vehicles/vehicles.graphql',
    additionalPaths: ['apps/fleet/src/modules/devices/devices.graphql'],
  },
];
export const operationPaths = [
  'apps/admin/src/app/features/karma-client/cars/operations.graphql',
  'apps/admin/src/app/features/karma-client/edata/operations.graphql',
  'apps/admin/src/app/features/karma-client/location/operations.graphql',
  'apps/admin/src/app/features/karma-client/history/operations.graphql',
  'apps/admin/src/app/features/karma-client/references/operations.graphql',
  'apps/admin/src/app/features/karma-client/accounts/operations.graphql',
  'apps/admin/src/app/features/branches/operations.graphql',
  'apps/admin/src/app/features/fleet/vehicles/operations.graphql',
  'apps/admin/src/app/features/fleet/devices/operations.graphql',
  'apps/fleet/src/integrations/core/operations.graphql',
];

export async function readContracts() {
  return Promise.all(
    subgraphs.map(async (subgraph) => ({
      ...subgraph,
      typeDefs: parse(
        (
          await Promise.all(
            [subgraph.path, ...subgraph.additionalPaths].map((path) =>
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
