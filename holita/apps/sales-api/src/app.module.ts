import { unwrapResolverError } from '@apollo/server/errors';
import { Module, ServiceUnavailableException } from '@nestjs/common';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { DatabaseModule } from './database.module.js';
import { HealthController } from './health.controller.js';
import { WorkspaceModule } from './workspace/workspace.module.js';

@Module({
  controllers: [HealthController],
  imports: [
    DatabaseModule,
    WorkspaceModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typeDefs: readFileSync(new URL('./sales.graphql', import.meta.url), 'utf8'),
      path: '/graphql',
      context: ({ req }: { req: IncomingMessage }) => ({
        authorization: req.headers.authorization,
      }),
      formatError: (formatted, error) => {
        if (unwrapResolverError(error) instanceof ServiceUnavailableException) {
          return { ...formatted, extensions: { code: 'SERVICE_UNAVAILABLE' } };
        }
        return formatted;
      },
    }),
  ],
})
export class AppModule {}
