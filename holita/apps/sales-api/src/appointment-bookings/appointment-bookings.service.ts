import { Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type {
  AppointmentBooking,
  AppointmentBookingInput,
  AppointmentBookingStatus,
  AppointmentRescheduleInput,
  AppointmentSlot,
  QueryAppointmentSlotsArgs,
} from '../generated/graphql/types.js';
import type {
  AppointmentBooking as StoredBooking,
  AppointmentService,
  Prisma,
} from '../generated/prisma/client.js';
import { activityInstant, salesFieldError } from '../leads/lead-activity-input.js';
import { salesDate } from '../sales-date.js';
import type { SalesScope } from '../scope.js';
import { AppointmentBookingsRepository } from './appointment-bookings.repository.js';

const minute = 60_000;

function uuid(id: string, field: string): string {
  if (!isUUID(id)) {
    throw salesFieldError(field, 'INVALID_FORMAT', 'Use a UUID');
  }
  return id.toLowerCase();
}

function startsAt(input: string): Date {
  const instant = activityInstant(input);
  if (!instant) {
    throw salesFieldError('startsAt', 'INVALID_FORMAT', 'Use an ISO 8601 instant with an offset');
  }
  return instant;
}

function localDay(input: string): number {
  const date = new Date(`${input}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(input) ||
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() === 0 ||
    date.toISOString().slice(0, 10) !== input
  ) {
    throw salesFieldError('date', 'INVALID_FORMAT', 'Use a date in YYYY-MM-DD format');
  }
  return date.getUTCDay() || 7;
}

function bookingSnapshot(service: AppointmentService, start: Date) {
  const { durationMinutes, bufferMinutes } = service;
  const endsAt = new Date(start.getTime() + durationMinutes * minute);
  return {
    startsAt: start,
    endsAt,
    blockedUntil: new Date(endsAt.getTime() + bufferMinutes * minute),
    durationMinutes,
    bufferMinutes,
  };
}

function present({
  tenantId: _tenantId,
  startsAt,
  endsAt,
  blockedUntil,
  createdAt,
  updatedAt,
  ...booking
}: StoredBooking): AppointmentBooking {
  return {
    ...booking,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    blockedUntil: blockedUntil.toISOString(),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

function requireService(service: AppointmentService | null | undefined): AppointmentService {
  if (!service) {
    throw new NotFoundException('Appointment service not found');
  }
  return service;
}

@Injectable()
export class AppointmentBookingsService {
  constructor(private readonly repository: AppointmentBookingsRepository) {}

  async slots(scope: SalesScope, args: QueryAppointmentSlotsArgs): Promise<AppointmentSlot[]> {
    const serviceId = uuid(args.serviceId, 'serviceId');
    const exclude =
      args.excludeBookingId == null ? undefined : uuid(args.excludeBookingId, 'excludeBookingId');
    const day = localDay(args.date);
    const service = requireService(await this.repository.findService(scope, serviceId));
    if (!service.active || !service.weekdays.includes(day)) {
      return [];
    }

    const starts = await this.repository.slotStarts(service, args.date);
    const now = Date.now();
    const slots = starts
      .filter((start) => start.getTime() > now)
      .map((start) => bookingSnapshot(service, start));
    const first = slots[0];
    const last = slots.at(-1);
    if (!first || !last) {
      return [];
    }
    const blocked = await this.repository.overlapping(
      scope,
      serviceId,
      first.startsAt,
      last.blockedUntil,
      exclude,
    );
    return slots.map(({ startsAt, endsAt, blockedUntil }) => ({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      blockedUntil: blockedUntil.toISOString(),
      isAvailable: !blocked.some(
        (booking) => booking.startsAt < blockedUntil && booking.blockedUntil > startsAt,
      ),
    }));
  }

  async find(scope: SalesScope, id: string) {
    const booking = await this.repository.find(scope, uuid(id, 'id'));
    return booking ? present(booking) : null;
  }

  create(scope: SalesScope, input: AppointmentBookingInput) {
    const serviceId = uuid(input.serviceId, 'serviceId');
    const leadId = input.leadId == null ? null : uuid(input.leadId, 'leadId');
    const start = startsAt(input.startsAt);
    const notes = input.notes?.trim() || null;
    if (notes?.includes('\u0000')) {
      throw salesFieldError('notes', 'INVALID_VALUE', 'Text must not contain a null character');
    }

    return this.repository.transaction(async (tx) => {
      const [row] = await this.repository.lockServices(scope, [serviceId], tx);
      const service = requireService(row);
      if (leadId && !(await this.repository.findLead(scope, leadId, tx))) {
        throw new NotFoundException('Lead not found');
      }
      const slot = bookingSnapshot(service, start);
      await this.assertAvailable(scope, service, slot, undefined, tx);
      return present(
        await this.repository.create(scope, { ...slot, serviceId, leadId, notes }, tx),
      );
    });
  }

  reschedule(scope: SalesScope, id: string, input: AppointmentRescheduleInput) {
    const bookingId = uuid(id, 'id');
    const serviceId = input.serviceId == null ? undefined : uuid(input.serviceId, 'serviceId');
    const start = startsAt(input.startsAt);

    return this.repository.transaction(async (tx) => {
      const booking = await this.lockBooking(scope, bookingId, tx);
      const targetId = serviceId ?? booking.serviceId;
      const services = await this.repository.lockServices(scope, [booking.serviceId, targetId], tx);
      const service = requireService(services.find(({ id }) => id === targetId));
      const slot = bookingSnapshot(service, start);
      await this.assertAvailable(scope, service, slot, bookingId, tx);
      return present(
        await this.repository.update(scope, bookingId, { ...slot, serviceId: targetId }, tx),
      );
    });
  }

  updateStatus(scope: SalesScope, id: string, status: AppointmentBookingStatus) {
    const bookingId = uuid(id, 'id');

    return this.repository.transaction(async (tx) => {
      const booking = await this.lockBooking(scope, bookingId, tx);
      const [service] = await this.repository.lockServices(scope, [booking.serviceId], tx);
      if (booking.status === 'CANCELLED' && status !== 'CANCELLED') {
        await this.assertAvailable(scope, requireService(service), booking, bookingId, tx);
      }
      return present(await this.repository.update(scope, bookingId, { status }, tx));
    });
  }

  private async lockBooking(scope: SalesScope, id: string, tx: Prisma.TransactionClient) {
    const booking = await this.repository.lockBooking(scope, id, tx);
    if (!booking) {
      throw new NotFoundException('Appointment booking not found');
    }
    return booking;
  }

  private async assertAvailable(
    scope: SalesScope,
    service: AppointmentService,
    { startsAt, blockedUntil }: Pick<StoredBooking, 'startsAt' | 'blockedUntil'>,
    excludeBookingId: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    const unavailable = () =>
      salesFieldError('startsAt', 'SLOT_UNAVAILABLE', 'Choose an available appointment slot');
    const start = startsAt.getTime();
    const date = salesDate(startsAt);
    if (!service.active || start <= Date.now() || !service.weekdays.includes(localDay(date))) {
      throw unavailable();
    }
    const starts = await this.repository.slotStarts(service, date, tx);
    if (!starts.some((candidate) => candidate.getTime() === start)) {
      throw unavailable();
    }

    const conflicts = await this.repository.overlapping(
      scope,
      service.id,
      startsAt,
      blockedUntil,
      excludeBookingId,
      tx,
    );
    if (conflicts.length) {
      throw unavailable();
    }
  }
}
