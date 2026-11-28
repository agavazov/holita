import type { SalesTaskBucket } from '../generated/graphql/types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { salesDate, salesTimeZone } from '../sales-date.js';
import { closedLeadStages } from './lead-stage.js';
import { activeTaskStatuses } from './lead-task.js';

const sofiaOffset = new Intl.DateTimeFormat('en-GB', {
  timeZone: salesTimeZone,
  timeZoneName: 'longOffset',
});

export const salesTaskBuckets = [
  'OVERDUE',
  'TODAY',
  'UPCOMING',
  'NO_FOLLOW_UP',
] as const satisfies readonly SalesTaskBucket[];

function sofiaMidnight(date: string): Date {
  // Sofia changes its clocks after both local and UTC midnight.
  const utcMidnight = new Date(`${date}T00:00:00Z`);
  const offset = sofiaOffset.formatToParts(utcMidnight).find(({ type }) => type === 'timeZoneName');
  return new Date(`${date}T00:00:00${offset?.value.slice(3) || 'Z'}`);
}

export function taskDateFilters(reference: Date) {
  const date = salesDate(reference);
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const today = sofiaMidnight(date);
  const tomorrow = sofiaMidnight(next.toISOString().slice(0, 10));
  return {
    OVERDUE: { lt: today },
    TODAY: { gte: today, lt: tomorrow },
    UPCOMING: { gte: tomorrow },
  } satisfies Record<Exclude<SalesTaskBucket, 'NO_FOLLOW_UP'>, Prisma.DateTimeFilter>;
}

export function activeLeadWhere(tenantId: string) {
  return { tenantId, stage: { notIn: [...closedLeadStages] } } satisfies Prisma.LeadWhereInput;
}

export function openTaskWhere(tenantId: string) {
  return { tenantId, status: { in: activeTaskStatuses } } satisfies Prisma.LeadTaskWhereInput;
}

/** Pass today's Sofia midnight for Quick Work's prompt, which includes overdue-only leads. */
export function leadWithoutFollowUpWhere(tenantId: string, scheduledFrom?: Date) {
  return {
    ...activeLeadWhere(tenantId),
    tasks: {
      none: {
        ...openTaskWhere(tenantId),
        ...(scheduledFrom ? { scheduledAt: { gte: scheduledFrom } } : {}),
      },
    },
  } satisfies Prisma.LeadWhereInput;
}
