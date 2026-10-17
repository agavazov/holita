import { Module } from '@nestjs/common';
import { KarmaTransportModule } from '../../integrations/karma/karma-transport.module.js';
import { CarsModule } from '../cars/cars.module.js';
import { LocationResolver } from './location.resolver.js';
import { LocationService } from './location.service.js';

@Module({
  imports: [CarsModule, KarmaTransportModule],
  providers: [LocationResolver, LocationService],
})
export class LocationModule {}
