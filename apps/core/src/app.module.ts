import { Module } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { formatGraphqlError, graphqlDiagnostics } from './graphql/errors.js';
import { createRequestContext } from './graphql/request-context.js';
import { TenantsModule } from './tenants/tenants.module.js';
import { BranchesModule } from './branches/branches.module.js';

import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    BranchesModule,
    TenantsModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typeDefs: readFileSync(new URL('./branches/branches.graphql', import.meta.url), 'utf8'),
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
