import { Module } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { formatGraphqlError, graphqlDiagnostics } from './graphql/errors.js';
import { createRequestContext } from './graphql/request-context.js';
import { CarsModule } from './modules/cars/cars.module.js';
import { LocationModule } from './modules/location/location.module.js';
import { ReferencesModule } from './modules/references/references.module.js';
import { HistoryModule } from './modules/history/history.module.js';
import { EdataModule } from './modules/edata/edata.module.js';
import { HealthController } from './health/health.controller.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { DeviceConfigurationModule } from './modules/device-configuration/device-configuration.module.js';

@Module({
  imports: [
    AccountsModule,
    CarsModule,
    DeviceConfigurationModule,
    EdataModule,
    HistoryModule,
    LocationModule,
    ReferencesModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typeDefs: [
        readFileSync(new URL('./modules/accounts/accounts.graphql', import.meta.url), 'utf8'),
        readFileSync(new URL('./modules/cars/cars.graphql', import.meta.url), 'utf8'),
        readFileSync(new URL('./modules/edata/edata.graphql', import.meta.url), 'utf8'),
        readFileSync(new URL('./modules/history/history.graphql', import.meta.url), 'utf8'),
        readFileSync(new URL('./modules/location/location.graphql', import.meta.url), 'utf8'),
        readFileSync(new URL('./modules/references/references.graphql', import.meta.url), 'utf8'),
      ].join('\n'),
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
