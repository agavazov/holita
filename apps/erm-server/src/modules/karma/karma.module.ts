import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetClient } from '../telemetry/fleet.client.js';
import { KarmaRepository } from './karma.repository.js';
import { KarmaResolver } from './karma.resolver.js';
import { KarmaService } from './karma.service.js';
import { KarmaTransport } from './karma.transport.js';

@Module({
  imports: [DatabaseModule],
  providers: [FleetClient, KarmaRepository, KarmaTransport, KarmaService, KarmaResolver],
})
export class KarmaModule {}
