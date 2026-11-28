import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { AppointmentServicesRepository } from './appointment-services.repository.js';
import { AppointmentServicesResolver } from './appointment-services.resolver.js';
import { AppointmentServicesService } from './appointment-services.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    AppointmentServicesRepository,
    AppointmentServicesService,
    AppointmentServicesResolver,
  ],
})
export class AppointmentServicesModule {}
