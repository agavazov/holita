import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { AppointmentBookingsRepository } from './appointment-bookings.repository.js';
import { AppointmentBookingsResolver } from './appointment-bookings.resolver.js';
import { AppointmentBookingsService } from './appointment-bookings.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    AppointmentBookingsRepository,
    AppointmentBookingsService,
    AppointmentBookingsResolver,
  ],
})
export class AppointmentBookingsModule {}
