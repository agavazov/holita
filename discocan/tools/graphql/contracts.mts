export { workspaceRoot } from '../../../osnova/tools/graphql/contracts.mjs';

export const subgraphs = [
  {
    name: 'erm-server',
    url: 'http://127.0.0.1:11015/graphql',
    path: 'discocan/apps/erm-server/src/modules/telemetry/telemetry.graphql',
    additionalPaths: ['discocan/apps/erm-server/src/modules/karma/karma.graphql'],
  },
  {
    name: 'core',
    url: 'http://127.0.0.1:11011/graphql',
    path: 'osnova/apps/core/src/modules/branches/branches.graphql',
    additionalPaths: ['osnova/apps/core/src/modules/tenants/tenants.graphql'],
  },
  {
    name: 'fleet',
    url: 'http://127.0.0.1:11013/graphql',
    path: 'discocan/apps/fleet/src/graphql/common.graphql',
    additionalPaths: [
      'discocan/apps/fleet/src/modules/vehicles/vehicles.graphql',
      'discocan/apps/fleet/src/modules/devices/devices.graphql',
      'discocan/apps/fleet/src/modules/device-inspection/device-inspection.graphql',
      'discocan/apps/fleet/src/modules/device-commands/device-commands.graphql',
      'discocan/apps/fleet/src/modules/device-configuration/device-configuration.graphql',
      'discocan/apps/fleet/src/modules/drivers/drivers.graphql',
      'discocan/apps/fleet/src/modules/vehicle-groups/vehicle-groups.graphql',
      'discocan/apps/fleet/src/modules/telemetry/telemetry.graphql',
      'discocan/apps/fleet/src/modules/trips/trips.graphql',
      'discocan/apps/fleet/src/modules/events/events.graphql',
      'discocan/apps/fleet/src/modules/service-tasks/service-tasks.graphql',
      'discocan/apps/fleet/src/modules/overview/overview.graphql',
      'discocan/apps/fleet/src/modules/settings/settings.graphql',
      'discocan/apps/fleet/src/modules/edata-catalog/edata-catalog.graphql',
      'discocan/apps/fleet/src/modules/notifications/notifications.graphql',
      'discocan/apps/fleet/src/modules/geo-zones/geo-zones.graphql',
      'discocan/apps/fleet/src/modules/fault-monitor/fault-monitor.graphql',
    ],
  },
];
export const operationPaths = [
  'discocan/apps/admin/src/app/ui/fleet-live/operations.graphql',
  'osnova/packages/ui/src/app/branches/operations.graphql',
  'osnova/packages/ui/src/app/auth/operations.graphql',
  'discocan/apps/admin/src/app/features/profile/operations.graphql',
  'discocan/apps/admin/src/app/features/users/operations.graphql',
  'discocan/apps/admin/src/app/features/notifications/operations.graphql',
  'discocan/apps/admin/src/app/features/fleet/vehicles/operations.graphql',
  'discocan/apps/admin/src/app/features/fleet/vehicle-groups/operations.graphql',
  'discocan/apps/admin/src/app/features/fleet/alerts/operations.graphql',
  'discocan/apps/admin/src/app/features/fleet/overview/operations.graphql',
  'discocan/apps/admin/src/app/features/fleet/live-dashboard/operations.graphql',
  'discocan/apps/admin/src/app/features/fleet/trips/operations.graphql',
  'discocan/apps/admin/src/app/features/fleet/drivers/operations.graphql',
  'discocan/apps/admin/src/app/features/fleet/maintenance/operations.graphql',
  'discocan/apps/admin/src/app/features/fleet/devices/operations.graphql',
  'discocan/apps/admin/src/app/features/fleet/settings/operations.graphql',
  'discocan/apps/admin/src/app/features/fleet/geo-zones/operations.graphql',
  'discocan/apps/admin/src/app/features/fleet/faults/operations.graphql',
  'discocan/apps/admin/src/app/features/control-center/operations.graphql',
  'discocan/apps/admin/src/app/features/erm/operations.graphql',
  'discocan/apps/fleet/src/integrations/core/operations.graphql',
  'discocan/apps/erm-server/src/modules/telemetry/operations.graphql',
];

const sharedOperations = operationPaths.filter((path) =>
  path.startsWith('osnova/packages/ui/src/app/'),
);
const operationsFor = (app: string) =>
  operationPaths.filter((path) => path.startsWith(`discocan/apps/${app}/`));
const generated = (app: string, name: string) =>
  `discocan/apps/${app}/src/generated/graphql/${name}`;
export const targets = {
  gateway: {
    supergraph: generated('gateway', 'supergraph.graphql'),
    schema: generated('gateway', 'schema.graphql'),
  },
  core: { server: { subgraph: 'core', path: 'osnova/apps/core/src/generated/graphql/types.ts' } },
  fleet: {
    server: { subgraph: 'fleet', path: generated('fleet', 'types.ts') },
    clients: [
      { path: generated('fleet', 'core-operations.ts'), operations: operationsFor('fleet') },
    ],
  },
  'erm-server': {
    server: { subgraph: 'erm-server', path: generated('erm-server', 'types.ts') },
    clients: [
      {
        path: generated('erm-server', 'fleet-operations.ts'),
        operations: operationsFor('erm-server'),
      },
    ],
  },
  operator: {
    clients: [
      {
        path: 'osnova/packages/ui/src/app/generated/operations.ts',
        operations: sharedOperations,
        subgraph: 'core',
      },
    ],
  },
  admin: {
    clients: [
      {
        path: generated('admin', 'operations.ts'),
        operations: [...operationsFor('admin'), ...sharedOperations],
      },
      {
        path: generated('admin', 'startup-operations.ts'),
        operations: [
          'osnova/packages/ui/src/app/auth/operations.graphql',
          'osnova/packages/ui/src/app/branches/operations.graphql',
        ],
      },
    ],
  },
};

export const scalars = { ErmJSON: 'unknown' };
