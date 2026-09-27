import { Module } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLISODateTime, GraphQLModule } from '@nestjs/graphql';
import { formatGraphqlError, graphqlDiagnostics } from './graphql/errors.js';
import { createRequestContext } from './graphql/request-context.js';
import { MediaModule } from './media/media.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { EventsModule } from './events/events.module.js';
import { SpeakersModule } from './speakers/speakers.module.js';
import { TagsModule } from './tags/tags.module.js';
import { VenuesModule } from './venues/venues.module.js';

import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    VenuesModule,
    EventsModule,
    SessionsModule,
    MediaModule,
    SpeakersModule,
    TagsModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      fieldResolverEnhancers: ['guards'],
      typeDefs: [
        'venues/venues',
        'events/events',
        'speakers/speakers',
        'tags/tags',
        'sessions/sessions',
        'media/media',
      ].map((path) => readFileSync(new URL(`./${path}.graphql`, import.meta.url), 'utf8')),
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
