import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { FleetClient } from '../telemetry/fleet.client.js';
import { LiveDevicesService } from '../telemetry/live-devices.service.js';
import { KarmaJobs } from './karma.jobs.js';
import { KarmaRepository } from './karma.repository.js';
import { KarmaResolver } from './karma.resolver.js';
import { KarmaService } from './karma.service.js';
import { KarmaTransport } from './karma.transport.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    FleetClient,
    LiveDevicesService,
    KarmaRepository,
    KarmaTransport,
    KarmaService,
    KarmaResolver,
    KarmaJobs,
  ],
})
export class KarmaModule {}
