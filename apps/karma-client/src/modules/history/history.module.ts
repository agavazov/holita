import { Module } from '@nestjs/common';
import { KarmaTransportModule } from '../../integrations/karma/karma-transport.module.js';
import { CarsModule } from '../cars/cars.module.js';
import { HistoryResolver } from './history.resolver.js';
import { HistoryService } from './history.service.js';
@Module({
  imports: [CarsModule, KarmaTransportModule],
  providers: [HistoryResolver, HistoryService],
})
export class HistoryModule {}
