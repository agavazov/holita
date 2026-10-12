import { Module } from '@nestjs/common';
import { CarsModule } from '../cars/cars.module.js';
import { LocationResolver } from './location.resolver.js';
import { LocationService } from './location.service.js';

@Module({ imports: [CarsModule], providers: [LocationResolver, LocationService] })
export class LocationModule {}
