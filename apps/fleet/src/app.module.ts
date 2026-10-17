import { Module } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLISODateTime, GraphQLModule } from '@nestjs/graphql';
import { formatGraphqlError, graphqlDiagnostics } from './graphql/errors.js';
import { createRequestContext } from './graphql/request-context.js';
import { DevicesModule } from './modules/devices/devices.module.js';
import { VehiclesModule } from './modules/vehicles/vehicles.module.js';

import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    VehiclesModule,
    DevicesModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      fieldResolverEnhancers: ['guards'],
      typeDefs: ['modules/vehicles/vehicles', 'modules/devices/devices'].map((path) =>
        readFileSync(new URL(`./${path}.graphql`, import.meta.url), 'utf8'),
      ),
      resolvers: { DateTime: GraphQLISODateTime },
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
