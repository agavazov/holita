import { Module } from '@nestjs/common';
import { ClockModule } from '../../clock/clock.module.js';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import { CoreClientModule } from '../../integrations/core/core-client.module.js';
import { ScenariosResolver } from './scenarios.resolver.js';
import { ScenariosService } from './scenarios.service.js';

@Module({
  imports: [ClockModule, CoreClientModule],
  providers: [FleetEnabledGuard, ScenariosResolver, ScenariosService],
})
export class ScenariosModule {}
