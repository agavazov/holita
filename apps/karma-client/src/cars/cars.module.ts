import { Module } from '@nestjs/common';
import { CarsResolver } from './cars.resolver.js';
import { CarsService } from './cars.service.js';
import { KarmaClient } from './karma-client.js';

@Module({ providers: [CarsResolver, CarsService, KarmaClient], exports: [KarmaClient] })
export class CarsModule {}
