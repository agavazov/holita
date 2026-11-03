import { Module } from '@nestjs/common';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { GraphQLScalarType } from 'graphql';
import { readFileSync } from 'node:fs';
import { formatGraphqlError, graphqlDiagnostics } from './graphql/errors.js';
import { createRequestContext } from './graphql/request-context.js';
import { HealthController } from './health/health.controller.js';
import { DevicesModule } from './modules/devices/devices.module.js';
import { TelemetryModule } from './modules/telemetry/telemetry.module.js';
import { ermRole } from './role.js';

const role = ermRole();

@Module({
  imports: [
    ...(role === 'api' ? [] : [DevicesModule]),
    ...(role === 'gateway'
      ? []
      : [
          TelemetryModule,
          GraphQLModule.forRoot<ApolloFederationDriverConfig>({
            driver: ApolloFederationDriver,
            typeDefs: readFileSync(
              new URL('./modules/telemetry/telemetry.graphql', import.meta.url),
              'utf8',
            ),
            resolvers: {
              ErmJSON: new GraphQLScalarType({ name: 'ErmJSON', serialize: (value) => value }),
            },
            context: createRequestContext,
            path: '/graphql',
            includeStacktraceInErrorResponses: false,
            autoTransformHttpErrors: false,
            formatError: formatGraphqlError,
            plugins: [graphqlDiagnostics],
          }),
        ]),
  ],
  controllers: [HealthController],
})
export class AppModule {}
