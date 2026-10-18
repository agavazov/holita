import { Module } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { formatGraphqlError, graphqlDiagnostics } from './graphql/errors.js';
import { createRequestContext } from './graphql/request-context.js';
import { DateScalar, DateTimeScalar } from './graphql/scalars.js';
import { DevicesModule } from './modules/devices/devices.module.js';
import { DriversModule } from './modules/drivers/drivers.module.js';
import { VehicleGroupsModule } from './modules/vehicle-groups/vehicle-groups.module.js';
import { VehiclesModule } from './modules/vehicles/vehicles.module.js';

import { HealthController } from './health/health.controller.js';

// SDL file order matches tools/graphql/contracts.mts: shared definitions, then the modules.
const typeDefPaths = [
  'graphql/common',
  'modules/vehicles/vehicles',
  'modules/devices/devices',
  'modules/drivers/drivers',
  'modules/vehicle-groups/vehicle-groups',
];

@Module({
  imports: [
    VehiclesModule,
    DevicesModule,
    DriversModule,
    VehicleGroupsModule,
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
