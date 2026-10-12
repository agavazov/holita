import { Module } from '@nestjs/common';
import { CarsModule } from '../cars/cars.module.js';
import { ReferencesResolver } from './references.resolver.js';
import { ReferencesService } from './references.service.js';

@Module({ imports: [CarsModule], providers: [ReferencesResolver, ReferencesService] })
export class ReferencesModule {}
