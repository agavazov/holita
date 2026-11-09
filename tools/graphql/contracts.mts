import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { composeServices } from '@apollo/composition';
import { buildSubgraphSchema } from '@apollo/subgraph';
import {
  concatAST,
  lexicographicSortSchema,
  parse,
  printSchema,
  Source,
  validate,
  type GraphQLSchema,
} from 'graphql';

export const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
export const subgraphs = [
  {
    name: 'erm-server',
    url: 'http://127.0.0.1:11015/graphql',
    path: 'apps/erm-server/src/modules/telemetry/telemetry.graphql',
    additionalPaths: ['apps/erm-server/src/modules/karma/karma.graphql'],
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
    path: 'apps/fleet/src/graphql/common.graphql',
    additionalPaths: [
      'apps/fleet/src/modules/vehicles/vehicles.graphql',
      'apps/fleet/src/modules/devices/devices.graphql',
      'apps/fleet/src/modules/drivers/drivers.graphql',
      'apps/fleet/src/modules/vehicle-groups/vehicle-groups.graphql',
      'apps/fleet/src/modules/telemetry/telemetry.graphql',
      'apps/fleet/src/modules/trips/trips.graphql',
      'apps/fleet/src/modules/events/events.graphql',
      'apps/fleet/src/modules/service-tasks/service-tasks.graphql',
      'apps/fleet/src/modules/overview/overview.graphql',
      'apps/fleet/src/modules/settings/settings.graphql',
      'apps/fleet/src/modules/notifications/notifications.graphql',
    ],
  },
];
export const operationPaths = [
  'apps/admin/src/app/ui/fleet-live/operations.graphql',
  'apps/admin/src/app/features/branches/operations.graphql',
  'apps/admin/src/app/features/auth/operations.graphql',
  'apps/admin/src/app/features/profile/operations.graphql',
  'apps/admin/src/app/features/users/operations.graphql',
  'apps/admin/src/app/features/notifications/operations.graphql',
  'apps/admin/src/app/features/fleet/vehicles/operations.graphql',
  'apps/admin/src/app/features/fleet/vehicle-groups/operations.graphql',
  'apps/admin/src/app/features/fleet/alerts/operations.graphql',
  'apps/admin/src/app/features/fleet/overview/operations.graphql',
  'apps/admin/src/app/features/fleet/live-dashboard/operations.graphql',
  'apps/admin/src/app/features/fleet/trips/operations.graphql',
  'apps/admin/src/app/features/fleet/drivers/operations.graphql',
  'apps/admin/src/app/features/fleet/maintenance/operations.graphql',
  'apps/admin/src/app/features/fleet/devices/operations.graphql',
  'apps/admin/src/app/features/fleet/settings/operations.graphql',
  'apps/admin/src/app/features/control-center/operations.graphql',
  'apps/fleet/src/integrations/core/operations.graphql',
  'apps/erm-server/src/modules/telemetry/operations.graphql',
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

export async function readOperations(schema: GraphQLSchema) {
  const documents = await Promise.all(
    operationPaths.map(async (location) => ({
      document: parse(
        new Source(await readFile(new URL(`../../${location}`, import.meta.url), 'utf8'), location),
      ),
      location,
    })),
  );
  const errors = validate(schema, concatAST(documents.map(({ document }) => document)));
  if (errors.length) {
    throw new Error(errors.map((error) => error.toString()).join('\n'));
  }
  return documents;
}
