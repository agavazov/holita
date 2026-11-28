import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import { Prisma, type AppointmentService } from '../generated/prisma/client.js';
import { salesTimeZone } from '../sales-date.js';
import type { SalesScope } from '../scope.js';

type BookingFields = Omit<
  Prisma.AppointmentBookingUncheckedCreateInput,
  'id' | 'tenantId' | 'createdByUserId' | 'updatedByUserId' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class AppointmentBookingsRepository {
  constructor(private readonly database: DatabaseService) {}

  transaction<T>(write: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.database.client.$transaction(write, { isolationLevel: 'ReadCommitted' });
  }

  find({ tenantId }: SalesScope, id: string, db: Prisma.TransactionClient = this.database.client) {
    return db.appointmentBooking.findUnique({ where: { tenantId, id } });
  }

  async lockBooking(scope: SalesScope, id: string, tx: Prisma.TransactionClient) {
    const table = this.database.table('appointmentBooking');
    await tx.$queryRaw`
      SELECT "id" FROM ${table}
      WHERE "tenantId" = ${scope.tenantId}::uuid AND "id" = ${id}::uuid
      FOR NO KEY UPDATE
    `;
    return this.find(scope, id, tx);
  }

  async lockServices({ tenantId }: SalesScope, ids: string[], tx: Prisma.TransactionClient) {
    const table = this.database.table('appointmentService');
    await tx.$queryRaw`
      SELECT "id" FROM ${table}
      WHERE "tenantId" = ${tenantId}::uuid
        AND "id" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY "id"
      FOR NO KEY UPDATE
    `;
    return tx.appointmentService.findMany({ where: { tenantId, id: { in: ids } } });
  }

  findService({ tenantId }: SalesScope, id: string) {
    return this.database.client.appointmentService.findUnique({ where: { tenantId, id } });
  }

  findLead({ tenantId }: SalesScope, id: string, tx: Prisma.TransactionClient) {
    return tx.lead.findUnique({ where: { tenantId, id }, select: { id: true } });
  }

  async slotStarts(
    { startMinute, endMinute, durationMinutes, bufferMinutes }: AppointmentService,
    date: string,
    db: Prisma.TransactionClient = this.database.client,
  ) {
    const step = durationMinutes + bufferMinutes;
    const rows = await db.$queryRaw<{ start: Date }[]>`
      SELECT slot.start
      FROM generate_series(${startMinute}::integer, ${endMinute - step}::integer, ${step}::integer)
        AS grid(local_minute)
      CROSS JOIN LATERAL (
        SELECT ${date}::date + grid.local_minute * INTERVAL '1 minute' AS start
      ) AS wall
      CROSS JOIN LATERAL (
        SELECT wall.start AT TIME ZONE ${salesTimeZone} AS start
      ) AS slot
      WHERE slot.start AT TIME ZONE ${salesTimeZone} = wall.start
        AND (slot.start + ${step}::integer * INTERVAL '1 minute') AT TIME ZONE ${salesTimeZone}
          <= ${date}::date + ${endMinute}::integer * INTERVAL '1 minute'
      ORDER BY slot.start
    `;
    return rows.map(({ start }) => start);
  }

  overlapping(
    { tenantId }: SalesScope,
    serviceId: string,
    startsAt: Date,
    blockedUntil: Date,
    excludeBookingId: string | undefined,
    db: Prisma.TransactionClient = this.database.client,
  ) {
    return db.appointmentBooking.findMany({
      where: {
        tenantId,
        serviceId,
        status: { not: 'CANCELLED' },
        startsAt: { lt: blockedUntil },
        blockedUntil: { gt: startsAt },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { startsAt: true, blockedUntil: true },
    });
  }

  create({ tenantId, userId }: SalesScope, fields: BookingFields, tx: Prisma.TransactionClient) {
    return tx.appointmentBooking.create({
      data: { ...fields, tenantId, createdByUserId: userId, updatedByUserId: userId },
    });
  }

  update(
    { tenantId, userId }: SalesScope,
    id: string,
    fields: Partial<BookingFields>,
    tx: Prisma.TransactionClient,
  ) {
    return tx.appointmentBooking.update({
      where: { tenantId, id },
      data: { ...fields, updatedByUserId: userId },
    });
  }
}
