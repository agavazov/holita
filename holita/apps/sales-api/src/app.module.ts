import { unwrapResolverError } from '@apollo/server/errors';
import {
  ConflictException,
  Module,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { AppointmentBookingsModule } from './appointment-bookings/appointment-bookings.module.js';
import { AppointmentServicesModule } from './appointment-services/appointment-services.module.js';
import { ContactsModule } from './contacts/contacts.module.js';
import { DatabaseModule } from './database.module.js';
import { HealthController } from './health.controller.js';
import { LeadsModule } from './leads/leads.module.js';
import { OffersModule } from './offers/offers.module.js';
import { WorkspaceModule } from './workspace/workspace.module.js';

@Module({
  controllers: [HealthController],
  imports: [
    DatabaseModule,
    WorkspaceModule,
    LeadsModule,
    ContactsModule,
    OffersModule,
    AppointmentServicesModule,
    AppointmentBookingsModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typeDefs: readFileSync(new URL('./sales.graphql', import.meta.url), 'utf8'),
      path: '/graphql',
      context: ({ req }: { req: IncomingMessage }) => ({
        authorization: req.headers.authorization,
      }),
      formatError: (formatted, error) => {
        const cause = unwrapResolverError(error);
        if (cause instanceof ServiceUnavailableException) {
          return { ...formatted, extensions: { code: 'SERVICE_UNAVAILABLE' } };
        }
        if (cause instanceof NotFoundException) {
          return { ...formatted, extensions: { code: 'NOT_FOUND' } };
        }
        if (cause instanceof ConflictException) {
          return { ...formatted, extensions: { code: 'CONFLICT' } };
        }
        return formatted;
      },
    }),
  ],
})
export class AppModule {}
