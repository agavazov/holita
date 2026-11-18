import { Module } from '@nestjs/common';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { CommerceRepository } from './commerce.repository.js';
import { CommerceResolver } from './commerce.resolver.js';
import { CommerceService } from './commerce.service.js';
import { DatabaseService } from './database.service.js';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typeDefs: readFileSync(new URL('./commerce.graphql', import.meta.url), 'utf8'),
      path: '/graphql',
      context: ({ req }: { req: IncomingMessage }) => ({
        authorization: req.headers.authorization,
        branchId: req.headers['x-branch-id'],
      }),
    }),
  ],
  providers: [DatabaseService, CommerceRepository, CommerceResolver, CommerceService],
})
export class AppModule {}
