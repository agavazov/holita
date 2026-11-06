import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { DateTimeScalar } from '../../graphql/scalars.js';
import { DevicesModule } from '../devices/devices.module.js';
import { TelemetryRepository } from './telemetry.repository.js';
import { TelemetryResolver } from './telemetry.resolver.js';
import { TelemetryService } from './telemetry.service.js';
import { ermRole } from '../../role.js';
import { LiveDevicesService } from './live-devices.service.js';
import { FleetClient } from './fleet.client.js';
import { ErmDeviceResolver, ErmEventResolver } from './telemetry.resolver.js';
import { InternalTelemetryController } from './internal-telemetry.controller.js';
import { InternalTelemetryGuard } from './internal-telemetry.guard.js';
import { ParameterSnapshotsRepository } from './parameter-snapshots.repository.js';
import { ParameterSnapshotsService } from './parameter-snapshots.service.js';
import { ConfigurationChangesService } from './configuration-changes.service.js';
import { UnitWorkflowsService } from './unit-workflows.service.js';
import { CommandRequestsRepository } from './command-requests.repository.js';
import { CommandRequestsService } from './command-requests.service.js';

@Module({
  imports: [DatabaseModule, ...(ermRole() === 'api' ? [] : [DevicesModule])],
  controllers: [InternalTelemetryController],
  providers: [
    DateTimeScalar,
    TelemetryRepository,
    TelemetryService,
    TelemetryResolver,
    ErmDeviceResolver,
    ErmEventResolver,
    LiveDevicesService,
    FleetClient,
    InternalTelemetryGuard,
    ParameterSnapshotsRepository,
    ParameterSnapshotsService,
    ConfigurationChangesService,
    UnitWorkflowsService,
    CommandRequestsRepository,
    CommandRequestsService,
  ],
})
export class TelemetryModule {}
