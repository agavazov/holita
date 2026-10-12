import { Module } from '@nestjs/common';
import { CarsModule } from '../cars/cars.module.js';
import { EdataResolver } from './edata.resolver.js';
import { EdataService } from './edata.service.js';

@Module({ imports: [CarsModule], providers: [EdataResolver, EdataService] })
export class EdataModule {}
