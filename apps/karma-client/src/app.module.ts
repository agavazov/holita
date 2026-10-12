import { Module } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { formatGraphqlError, graphqlDiagnostics } from './graphql/errors.js';
import { createRequestContext } from './graphql/request-context.js';
import { CarsModule } from './cars/cars.module.js';
import { LocationModule } from './location/location.module.js';
import { ReferencesModule } from './references/references.module.js';
import { HistoryModule } from './history/history.module.js';
import { EdataModule } from './edata/edata.module.js';
import { HealthController } from './health/health.controller.js';
import { AccountsModule } from './accounts/accounts.module.js';

@Module({
  imports: [
    AccountsModule,
    CarsModule,
    EdataModule,
    HistoryModule,
    LocationModule,
    ReferencesModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typeDefs: [
        readFileSync(new URL('./accounts/accounts.graphql', import.meta.url), 'utf8'),
        readFileSync(new URL('./cars/cars.graphql', import.meta.url), 'utf8'),
        readFileSync(new URL('./edata/edata.graphql', import.meta.url), 'utf8'),
        readFileSync(new URL('./history/history.graphql', import.meta.url), 'utf8'),
        readFileSync(new URL('./location/location.graphql', import.meta.url), 'utf8'),
        readFileSync(new URL('./references/references.graphql', import.meta.url), 'utf8'),
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
