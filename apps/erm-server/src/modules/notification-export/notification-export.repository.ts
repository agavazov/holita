import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { sqlNullableDate, sqlNullableText, sqlRows, sqlText } from '../../database/sql.js';
import { Prisma, type ErmCommandRequest } from '../../generated/prisma/client.js';
import { categoryEventIds } from '../../starlink/event-catalog.js';
import { commandView } from '../telemetry/command-evidence.js';
import type {
  NotificationExportCursor,
  NotificationExportScope,
} from './notification-export.types.js';

export interface NotificationExportEvent {
  id: string;
  eventId: string | null;
  occurredAt: Date;
  eventTime: Date | null;
  fields: unknown;
}

@Injectable()
export class NotificationExportRepository {
  constructor(private readonly prisma: PrismaService) {}

  private table(name: 'ermEvent' | 'ermFrame') {
    return Prisma.raw(`"${this.prisma.schema.replaceAll('"', '""')}"."${name}"`);
  }

  async events(
    imei: string,
    since: Date,
    after: string,
    limit: number,
  ): Promise<NotificationExportEvent[]> {
    return sqlRows(
      await this.prisma.client.$queryRaw(Prisma.sql`
        SELECT event.id::text AS id, event."eventId", event."eventTime", event.fields,
          coalesce(event."eventTime", frame."receivedAt") AS "occurredAt"
        FROM ${this.table('ermEvent')} event
        JOIN ${this.table('ermFrame')} frame ON frame.id = event."frameId"
        WHERE event."unitId" = ${imei} AND event.id > ${after}::bigint
          AND coalesce(event."eventTime", frame."receivedAt") >= ${since}
          AND (event."eventId" IN (${Prisma.join(categoryEventIds(['ALARM']))}, '70', '89')
            OR event.fields -> 'edata' ->> 'type' = '419'
            OR (event.fields -> 'edata' ->> 'type' = '411'
              AND event.fields -> 'edata' ->> 'canError' <> '0'))
        ORDER BY event.id LIMIT ${limit + 1}
      `),
    ).map((row) => {
      const occurredAt = sqlNullableDate(row, 'occurredAt');
      if (occurredAt === null) {
        throw new Error('Invalid notification export timestamp');
      }
      return {
        id: sqlText(row, 'id'),
        eventId: sqlNullableText(row, 'eventId'),
        eventTime: sqlNullableDate(row, 'eventTime'),
        occurredAt,
        fields: row['fields'],
      };
    });
  }

  commands(
    scope: NotificationExportScope,
    since: Date,
    after: NotificationExportCursor,
    limit: number,
  ) {
    return this.prisma.client.ermCommandRequest.findMany({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        deviceId: scope.deviceId,
        unitId: scope.imei,
        status: { in: ['ANSWERED', 'FAILED', 'EXPIRED', 'UNCERTAIN'] },
        completedAt: { gte: since },
        ...(after.commandCompletedAt !== null && after.commandId !== null
          ? {
              OR: [
                { completedAt: { gt: new Date(after.commandCompletedAt) } },
                { completedAt: new Date(after.commandCompletedAt), id: { gt: after.commandId } },
              ],
            }
          : {}),
      },
      orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
  }

  async transportCommands(scope: NotificationExportScope, requests: ErmCommandRequest[]) {
    const linked = requests.filter(
      (request): request is ErmCommandRequest & { commandId: string } =>
        request.tenantId === scope.tenantId &&
        request.branchId === scope.branchId &&
        request.deviceId === scope.deviceId &&
        request.unitId === scope.imei &&
        request.commandId !== null,
    );
    const commands = linked.length
      ? await this.prisma.client.ermCommand.findMany({
          where: {
            unitId: scope.imei,
            id: { in: linked.map((request) => request.commandId) },
          },
        })
      : [];
    return new Map(commands.map((command) => [command.id, commandView(command)]));
  }
}
