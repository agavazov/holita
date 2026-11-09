import { BadRequestException } from '@nestjs/common';
import type {
  ErmCommandRequestsSortField,
  QueryErmCommandRequestsArgs,
  SendErmDeviceCommandInput,
} from '../../generated/graphql/types.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { deviceActions } from './device-actions.js';
import { auditId } from './operator-audit.js';

const statuses = [
  'QUEUED',
  'SUBMITTING',
  'ANSWERED',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
  'UNCERTAIN',
];
const sortFields: readonly ErmCommandRequestsSortField[] = [
  'ACTION',
  'STATUS',
  'UNIT_ID',
  'ACTOR_ID',
  'REQUESTED_AT',
  'COMPLETED_AT',
];

function values<T>(items: T[], valid: (item: T) => boolean): T[] {
  if (
    !items.length ||
    items.length > 100 ||
    new Set(items).size !== items.length ||
    !items.every(valid)
  ) {
    throw new BadRequestException('Command filters require 1–100 unique valid values');
  }
  return items;
}

export function commandDeviceIds(ids: string[]): string[] {
  const normalized = ids.map(auditId);
  return values(normalized, () => true);
}

export function commandRequestOptions(input: Omit<SendErmDeviceCommandInput, 'deviceId'>) {
  const seconds = input.expiresInSeconds ?? 7200;
  const intent = input.intent?.trim() || input.action;
  if (
    !Object.hasOwn(deviceActions, input.action) ||
    !Number.isInteger(seconds) ||
    seconds < 1 ||
    seconds > 86400 ||
    intent.length > 200
  ) {
    throw new BadRequestException(
      'Command action must be an allowlisted read, expiry 1–86400 seconds and intent at most 200 characters',
    );
  }
  return { seconds, intent };
}

export function commandRequestsQuery(args: QueryErmCommandRequestsArgs) {
  const offset = args.offset ?? 0;
  const limit = args.limit ?? 20;
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 2147483647 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new BadRequestException('Command offset must be nonnegative and limit 1–100');
  }
  const field = args.sort?.field ?? 'REQUESTED_AT';
  const direction = args.sort?.direction ?? 'DESC';
  if (!sortFields.includes(field) || !['ASC', 'DESC'].includes(direction)) {
    throw new BadRequestException('Choose a supported command sort field and ASC or DESC');
  }
  const order = direction === 'ASC' ? 'asc' : 'desc';
  const fields = {
    ACTION: { action: order },
    STATUS: { status: order },
    UNIT_ID: { unitId: order },
    ACTOR_ID: { actorId: order },
    REQUESTED_AT: { createdAt: order },
    COMPLETED_AT: { completedAt: { sort: order, nulls: 'last' } },
  } satisfies Record<ErmCommandRequestsSortField, Prisma.ErmCommandRequestOrderByWithRelationInput>;
  const orderBy: Prisma.ErmCommandRequestOrderByWithRelationInput[] = [
    fields[field],
    { id: order },
  ];
  const filter = args.filter;
  const createdFrom = filter?.createdFrom == null ? undefined : new Date(filter.createdFrom);
  const createdTo = filter?.createdTo == null ? undefined : new Date(filter.createdTo);
  if (
    (createdFrom && !Number.isFinite(createdFrom.getTime())) ||
    (createdTo && !Number.isFinite(createdTo.getTime())) ||
    (createdFrom && createdTo && createdFrom >= createdTo)
  ) {
    throw new BadRequestException('Invalid command creation period');
  }
  const actorId = filter?.actorId?.trim();
  if (
    actorId !== undefined &&
    (!actorId.length || actorId.length > 128 || actorId.includes('\0'))
  ) {
    throw new BadRequestException('Invalid command issuer');
  }
  const where: Prisma.ErmCommandRequestWhereInput = {
    ...(filter?.statuses != null
      ? { status: { in: values(filter.statuses, (value) => statuses.includes(value)) } }
      : {}),
    ...(filter?.actions != null
      ? { action: { in: values(filter.actions, (value) => Object.hasOwn(deviceActions, value)) } }
      : {}),
    ...(filter?.deviceIds != null ? { deviceId: { in: commandDeviceIds(filter.deviceIds) } } : {}),
    ...(filter?.imeis != null
      ? { unitId: { in: values(filter.imeis, (value) => /^\d{15}$/.test(value)) } }
      : {}),
    ...(actorId === undefined ? {} : { actorId }),
    ...(createdFrom || createdTo
      ? {
          createdAt: {
            ...(createdFrom ? { gte: createdFrom } : {}),
            ...(createdTo ? { lt: createdTo } : {}),
          },
        }
      : {}),
  };
  return { offset, limit, where, orderBy };
}
