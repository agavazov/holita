import { Module } from '@nestjs/common';
import { ApolloGatewayDriver, type ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { gatewayConfig } from './graphql/gateway.config.js';

import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      useFactory: gatewayConfig,
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
