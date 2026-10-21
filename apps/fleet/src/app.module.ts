import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { readFileSync } from 'node:fs';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { formatGraphqlError, graphqlDiagnostics } from './graphql/errors.js';
import { createRequestContext } from './graphql/request-context.js';
import { DateScalar, DateTimeScalar } from './graphql/scalars.js';
import { DevicesModule } from './modules/devices/devices.module.js';
import { DriversModule } from './modules/drivers/drivers.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { ServiceTasksModule } from './modules/service-tasks/service-tasks.module.js';
import { TelemetryModule } from './modules/telemetry/telemetry.module.js';
import { TripsModule } from './modules/trips/trips.module.js';
import { VehicleGroupsModule } from './modules/vehicle-groups/vehicle-groups.module.js';
import { VehiclesModule } from './modules/vehicles/vehicles.module.js';
import { OverviewModule } from './modules/overview/overview.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { DeviceOperationsModule } from './modules/device-operations/device-operations.module.js';

import { HealthController } from './health/health.controller.js';

// SDL file order matches tools/graphql/contracts.mts: shared definitions, then the modules.
const typeDefPaths = [
  'graphql/common',
  'modules/vehicles/vehicles',
  'modules/devices/devices',
  'modules/drivers/drivers',
  'modules/vehicle-groups/vehicle-groups',
  'modules/telemetry/telemetry',
  'modules/trips/trips',
  'modules/events/events',
  'modules/service-tasks/service-tasks',
  'modules/overview/overview',
  'modules/settings/settings',
  'modules/device-operations/device-operations',
];

@Module({
  imports: [
    ScheduleModule.forRoot(),
    VehiclesModule,
    DevicesModule,
    DriversModule,
    VehicleGroupsModule,
    TelemetryModule,
    TripsModule,
    EventsModule,
    ServiceTasksModule,
    OverviewModule,
    SettingsModule,
    DeviceOperationsModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      fieldResolverEnhancers: ['guards'],
      typeDefs: typeDefPaths.map((path) =>
        readFileSync(new URL(`./${path}.graphql`, import.meta.url), 'utf8'),
      ),
      resolvers: { DateTime: DateTimeScalar, Date: DateScalar },
      context: createRequestContext,
      path: '/graphql',
      includeStacktraceInErrorResponses: false,
      autoTransformHttpErrors: false,
      formatError: formatGraphqlError,
      plugins: [graphqlDiagnostics],
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
