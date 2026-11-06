import { Module } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { formatGraphqlError, graphqlDiagnostics } from './graphql/errors.js';
import { createRequestContext } from './graphql/request-context.js';
import { TenantsModule } from './modules/tenants/tenants.module.js';
import { BranchesModule } from './modules/branches/branches.module.js';

import { HealthController } from './health/health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthService } from './auth/auth.service.js';
import { UsersModule } from './modules/users/users.module.js';
import { DateTimeScalar } from './graphql/scalars.js';

@Module({
  imports: [
    BranchesModule,
    TenantsModule,
    AuthModule,
    UsersModule,
    GraphQLModule.forRootAsync<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      imports: [AuthModule],
      inject: [AuthService],
      useFactory: (auth: AuthService) => ({
        typeDefs: ['modules/branches/branches', 'modules/tenants/tenants'].map((path) =>
          readFileSync(new URL(`./${path}.graphql`, import.meta.url), 'utf8'),
        ),
        context: (http: Parameters<typeof createRequestContext>[0]) =>
          createRequestContext(http, auth),
        resolvers: { DateTime: DateTimeScalar },
        path: '/graphql',
        includeStacktraceInErrorResponses: false,
        autoTransformHttpErrors: false,
        formatError: formatGraphqlError,
        plugins: [graphqlDiagnostics],
      }),
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
