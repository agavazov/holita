import { Module } from '@nestjs/common';
import { CarsResolver } from './cars.resolver.js';
import { CarsService } from './cars.service.js';
import { KarmaTransportModule } from '../../integrations/karma/karma-transport.module.js';

@Module({
  imports: [KarmaTransportModule],
  providers: [CarsResolver, CarsService],
  exports: [CarsService],
})
export class CarsModule {}
