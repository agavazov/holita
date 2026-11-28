import { BadRequestException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type {
  AppointmentService,
  AppointmentServiceInput,
  QueryAppointmentServicesArgs,
} from '../generated/graphql/types.js';
import type { AppointmentService as StoredService } from '../generated/prisma/client.js';
import { activityWriteError, salesFieldError } from '../leads/lead-activity-input.js';
import type { SalesScope } from '../scope.js';
import { AppointmentServicesRepository } from './appointment-services.repository.js';

function serviceId(id: string): string {
  if (!isUUID(id)) {
    throw new BadRequestException('Appointment service ID must be a UUID');
  }
  return id.toLowerCase();
}

function localMinute(value: string, field: 'startTime' | 'endTime'): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value)) {
    throw salesFieldError(field, 'INVALID_FORMAT', 'Enter a local time in HH:mm');
  }
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

function localTime(minute: number): string {
  const hours = String(Math.floor(minute / 60)).padStart(2, '0');
  const minutes = String(minute % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function serviceFields(input: AppointmentServiceInput) {
  const { active, color, durationMinutes, bufferMinutes, weekdays } = input;
  const name = input.name.trim();
  const description = input.description?.trim() || null;

  if (!name) {
    throw salesFieldError('name', 'REQUIRED', 'Enter a service name');
  }
  if (name.includes('\u0000')) {
    throw salesFieldError('name', 'INVALID_VALUE', 'Text must not contain a null character');
  }
  if (Array.from(name).length > 255) {
    throw salesFieldError('name', 'TOO_LONG', 'Use at most 255 characters');
  }
  if (description?.includes('\u0000')) {
    throw salesFieldError('description', 'INVALID_VALUE', 'Text must not contain a null character');
  }
  if (!weekdays.length) {
    throw salesFieldError('weekdays', 'REQUIRED', 'Select at least one weekday');
  }
  if (weekdays.some((day) => day < 1 || day > 7)) {
    throw salesFieldError('weekdays', 'INVALID_VALUE', 'Use ISO weekdays from 1 to 7');
  }
  if (durationMinutes <= 0) {
    throw salesFieldError('durationMinutes', 'INVALID_VALUE', 'Enter a positive duration');
  }
  if (bufferMinutes < 0) {
    throw salesFieldError('bufferMinutes', 'INVALID_VALUE', 'Enter a nonnegative buffer');
  }
  const startMinute = localMinute(input.startTime, 'startTime');
  const endMinute = localMinute(input.endTime, 'endTime');
  if (endMinute - startMinute < durationMinutes + bufferMinutes) {
    throw salesFieldError(
      'endTime',
      'WINDOW_TOO_SHORT',
      'End time must follow start time and leave enough room for the duration and buffer',
    );
  }
  return {
    name,
    description,
    ...(active == null ? {} : { active }),
    color,
    durationMinutes,
    bufferMinutes,
    weekdays: [...new Set(weekdays)].sort((a, b) => a - b),
    startMinute,
    endMinute,
  };
}

function present({
  tenantId: _tenantId,
  startMinute,
  endMinute,
  createdAt,
  updatedAt,
  ...fields
}: StoredService): AppointmentService {
  return {
    ...fields,
    startTime: localTime(startMinute),
    endTime: localTime(endMinute),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

@Injectable()
export class AppointmentServicesService {
  constructor(private readonly repository: AppointmentServicesRepository) {}

  async list(scope: SalesScope, { offset = 0, limit = 20, search }: QueryAppointmentServicesArgs) {
    const term = (search ?? '').trim();
    const words = term.split(/\s+/u).filter(Boolean);
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    if (term.includes('\u0000') || Array.from(term).length > 200 || words.length > 5) {
      throw new BadRequestException('Invalid search');
    }
    const page = await this.repository.list(scope, offset, limit, words);
    return { ...page, items: page.items.map(present) };
  }

  async find(scope: SalesScope, id: string) {
    const row = await this.repository.find(scope, serviceId(id));
    return row ? present(row) : null;
  }

  async create(scope: SalesScope, input: AppointmentServiceInput) {
    return present(await this.repository.create(scope, serviceFields(input)));
  }

  async update(scope: SalesScope, id: string, input: AppointmentServiceInput) {
    try {
      return present(await this.repository.update(scope, serviceId(id), serviceFields(input)));
    } catch (error: unknown) {
      return activityWriteError(error, 'Appointment service not found');
    }
  }

  async deactivate(scope: SalesScope, id: string) {
    try {
      return present(await this.repository.update(scope, serviceId(id), { active: false }));
    } catch (error: unknown) {
      return activityWriteError(error, 'Appointment service not found');
    }
  }
}
