import { Module } from '@nestjs/common';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { CommerceRepository } from './commerce.repository.js';
import { CommerceResolver } from './commerce.resolver.js';
import { CommerceService } from './commerce.service.js';
import { DatabaseService } from './database.service.js';
import { StorefrontResolver } from './storefront.resolver.js';
import { StorefrontService } from './storefront.service.js';

@Module({ providers: [DatabaseService], exports: [DatabaseService] })
class DatabaseModule {}
@Module({
  imports: [DatabaseModule],
  providers: [CommerceRepository, CommerceResolver, CommerceService],
})
class OperatorModule {}
@Module({ imports: [DatabaseModule], providers: [StorefrontResolver, StorefrontService] })
class StorefrontModule {}
const context = ({ req }: { req: IncomingMessage }) => ({
  authorization: req.headers.authorization,
  branchId: req.headers['x-branch-id'],
});
@Module({
  imports: [
    OperatorModule,
    StorefrontModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typeDefs: readFileSync(new URL('./commerce.graphql', import.meta.url), 'utf8'),
      path: '/graphql',
      include: [OperatorModule],
      context,
    }),
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typeDefs: readFileSync(new URL('./storefront.graphql', import.meta.url), 'utf8'),
      path: '/storefront/graphql',
      include: [StorefrontModule],
      context,
    }),
  ],
})
export class AppModule {}
