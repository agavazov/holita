import { Module } from '@nestjs/common';
import { FleetClock } from './fleet-clock.js';

@Module({ providers: [FleetClock], exports: [FleetClock] })
export class ClockModule {}
