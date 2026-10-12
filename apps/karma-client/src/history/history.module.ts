import { Module } from '@nestjs/common';
import { CarsModule } from '../cars/cars.module.js';
import { HistoryResolver } from './history.resolver.js';
import { HistoryService } from './history.service.js';
@Module({ imports: [CarsModule], providers: [HistoryResolver, HistoryService] })
export class HistoryModule {}
