import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { containsPattern } from '../../database/search.js';
import { fleetTable, integer, oneOf, rowsOf } from '../../database/sql.js';
import type {
  FleetServiceTaskSortField,
  FleetServiceUrgency,
} from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  FleetVehicleStatus,
  type FleetServiceStatus,
  type FleetServiceType,
} from '../../generated/prisma/enums.js';
import type { FleetScope, SortDirection } from '../../validation.js';
import {
  parseServiceTaskRow,
  SERVICE_TASK_COLUMNS,
  type ServiceTaskRow,
  serviceTasksWithUrgency,
  URGENCY_RANK,
} from './service-urgency.sql.js';
import type { ServiceTaskConditionCriteria } from './service-task-filter.js';

/** Validated search and filter; `undefined` means no constraint. */
export interface ServiceTaskCriteria {
  tokens: string[];
  ids: string[] | undefined;
  statuses: FleetServiceStatus[] | undefined;
  urgencies: FleetServiceUrgency[] | undefined;
  serviceTypes: FleetServiceType[] | undefined;
  vehicleIds: string[] | undefined;
  completedFrom: string | undefined;
  completedTo: string | undefined;
  allOf?: ServiceTaskConditionCriteria[] | undefined;
}

export interface ServiceTaskSort {
  field: FleetServiceTaskSortField;
  direction: SortDirection;
}

/** Editable columns of a PLANNED task. */
export interface ServiceTaskPlan {
  serviceType: FleetServiceType;
  title: string | null;
  dueOn: Date | null;
  dueOdometerKm: number | null;
  workshop: string | null;
  notes: string | null;
}

export interface ServiceTaskCompletionData {
  completedOn: Date;
  completedOdometerKm: number | null;
  costCents: number | null;
  replacedParts: string | null;
  workshop?: string | null;
  notes?: string | null;
}

/** Urgency counts of PLANNED tasks of vehicles that are not INACTIVE. */
export interface ServiceUrgencyCounts {
  overdue: number;
  dueSoon: number;
  unknownOdometer: number;
  upcoming: number;
}

const taskSelect = {
  id: true,
  vehicleId: true,
  serviceType: true,
  status: true,
  title: true,
  dueOn: true,
  dueOdometerKm: true,
  workshop: true,
} satisfies Prisma.ServiceTaskSelect;

/** Stored fields the write rules read before changing a task. */
export type StoredServiceTask = Prisma.ServiceTaskGetPayload<{ select: typeof taskSelect }>;

/** The same strictly earlier-date floor is used before and inside the completion transaction. */
async function highestCompletedOdometer(
  client: Prisma.TransactionClient,
  scope: FleetScope,
  vehicleId: string,
  before: Date,
): Promise<number | null> {
  const result = await client.serviceTask.aggregate({
    where: {
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      vehicleId,
      status: 'DONE',
      completedOn: { lt: before },
    },
    _max: { completedOdometerKm: true },
  });
  return result._max.completedOdometerKm;
}

function parseUrgencyCounts(row: Record<string, unknown>): ServiceUrgencyCounts {
  return {
    overdue: integer(row, 'overdue'),
    dueSoon: integer(row, 'dueSoon'),
    unknownOdometer: integer(row, 'unknownOdometer'),
    upcoming: integer(row, 'upcoming'),
  };
}

@Injectable()
export class ServiceTasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Raw urgency list: filter, search, sort, page and total in one RepeatableRead transaction. */
  async list(
    scope: FleetScope,
    today: string,
    page: { offset: number; limit: number },
    criteria: ServiceTaskCriteria,
    sort: ServiceTaskSort,
  ): Promise<{ items: ServiceTaskRow[]; total: number }> {
    const base = serviceTasksWithUrgency(this.prisma.schema, scope, today);
    const where = this.listConditions(scope, criteria);
    const direction = Prisma.raw(sort.direction === 'ASC' ? 'ASC' : 'DESC');
    const ordering: Record<FleetServiceTaskSortField, Prisma.Sql> = {
      URGENCY: Prisma.sql`${URGENCY_RANK} ${direction} NULLS LAST, t."dueOn"::date ASC NULLS LAST,
        t."remainingKm" ASC NULLS LAST`,
      DUE_ON: Prisma.sql`t."dueOn"::date ${direction} NULLS LAST`,
      COMPLETED_ON: Prisma.sql`t."completedOn"::date ${direction} NULLS LAST`,
      CREATED_AT: Prisma.sql`t."createdAt" ${direction}`,
      TASK: Prisma.sql`COALESCE(t."title", replace(t."serviceType", '_', ' ')) ${direction}`,
      VEHICLE_LICENSE_PLATE: Prisma.sql`(SELECT v."licensePlate" FROM ${fleetTable(this.prisma.schema, 'Vehicle')} v WHERE v."tenantId" = ${scope.tenantId}::uuid AND v."branchId" = ${scope.branchId}::uuid AND v."id" = t."vehicleId") ${direction} NULLS LAST`,
      COST_CENTS: Prisma.sql`t."costCents" ${direction} NULLS LAST`,
    };
    return this.prisma.client.$transaction(
      async (transaction) => {
        const rows: unknown = await transaction.$queryRaw(Prisma.sql`
          WITH tasks AS (${base})
          SELECT ${SERVICE_TASK_COLUMNS} FROM tasks t
          WHERE ${where}
          ORDER BY ${ordering[sort.field]}, t."id" DESC
          LIMIT ${page.limit}::int OFFSET ${page.offset}::int`);
        const counted: unknown = await transaction.$queryRaw(Prisma.sql`
          WITH tasks AS (${base})
          SELECT count(*)::int AS "total" FROM tasks t WHERE ${where}`);
        const [total] = rowsOf(counted, (row) => integer(row, 'total'));
        return { items: rowsOf(rows, parseServiceTaskRow), total: total ?? 0 };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /** Urgency rows of the given task IDs (any status). */
  async findMany(
    scope: FleetScope,
    today: string,
    ids: readonly string[],
  ): Promise<ServiceTaskRow[]> {
    if (!ids.length) {
      return [];
    }
    const base = serviceTasksWithUrgency(this.prisma.schema, scope, today);
    const rows: unknown = await this.prisma.client.$queryRaw(Prisma.sql`
      WITH tasks AS (${base})
      SELECT ${SERVICE_TASK_COLUMNS} FROM tasks t WHERE t."id" = ANY(${ids}::uuid[])`);
    return rowsOf(rows, parseServiceTaskRow);
  }

  /**
   * Per vehicle, the PLANNED task with the worst urgency, then the earliest due date, the fewest
   * remaining kilometres and the newest ID.
   */
  async nextForVehicles(
    scope: FleetScope,
    today: string,
    vehicleIds: readonly string[],
  ): Promise<ServiceTaskRow[]> {
    if (!vehicleIds.length) {
      return [];
    }
    const base = serviceTasksWithUrgency(this.prisma.schema, scope, today);
    const rows: unknown = await this.prisma.client.$queryRaw(Prisma.sql`
      WITH tasks AS (${base})
      SELECT DISTINCT ON (t."vehicleId") ${SERVICE_TASK_COLUMNS} FROM tasks t
      WHERE t."status" = 'PLANNED' AND t."vehicleId" = ANY(${vehicleIds}::uuid[])
      ORDER BY t."vehicleId", ${URGENCY_RANK} ASC NULLS LAST, t."dueOn"::date ASC NULLS LAST,
        t."remainingKm" ASC NULLS LAST, t."id" DESC`);
    return rowsOf(rows, parseServiceTaskRow);
  }

  /** Urgency counts of PLANNED tasks whose vehicle is not INACTIVE. */
  async urgencyCounts(scope: FleetScope, today: string): Promise<ServiceUrgencyCounts> {
    const base = serviceTasksWithUrgency(this.prisma.schema, scope, today);
    const vehicles = fleetTable(this.prisma.schema, 'Vehicle');
    const rows: unknown = await this.prisma.client.$queryRaw(Prisma.sql`
      WITH tasks AS (${base})
      SELECT count(*) FILTER (WHERE t."urgency" = 'OVERDUE')::int AS "overdue",
        count(*) FILTER (WHERE t."urgency" = 'DUE_SOON')::int AS "dueSoon",
        count(*) FILTER (WHERE t."urgency" = 'UNKNOWN_ODOMETER')::int AS "unknownOdometer",
        count(*) FILTER (WHERE t."urgency" = 'UPCOMING')::int AS "upcoming"
      FROM tasks t
      WHERE t."status" = 'PLANNED' AND EXISTS (
        SELECT 1 FROM ${vehicles} v
        WHERE v."tenantId" = ${scope.tenantId}::uuid AND v."branchId" = ${scope.branchId}::uuid
          AND v."id" = t."vehicleId" AND v."status"::text <> 'INACTIVE'
      )`);
    const [counts] = rowsOf(rows, parseUrgencyCounts);
    if (!counts) {
      throw new Error('Missing service urgency counts');
    }
    return counts;
  }

  /** DONE tasks completed in the closed date range: count and Σ non-null cost. */
  async completedTotals(scope: FleetScope, from: Date, to: Date) {
    const result = await this.prisma.client.serviceTask.aggregate({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        status: 'DONE',
        completedOn: { gte: from, lte: to },
      },
      _count: { _all: true },
      _sum: { costCents: true },
    });
    return { count: result._count._all, costCents: result._sum.costCents ?? 0 };
  }

  countVehiclesInWorkshop(scope: FleetScope): Promise<number> {
    return this.prisma.client.vehicle.count({
      where: { tenantId: scope.tenantId, branchId: scope.branchId, status: 'IN_WORKSHOP' },
    });
  }

  vehicleRefs(scope: FleetScope, ids: readonly string[]) {
    return this.prisma.client.vehicle.findMany({
      where: { tenantId: scope.tenantId, branchId: scope.branchId, id: { in: [...ids] } },
      select: { id: true, licensePlate: true, fleetNumber: true, vehicleType: true, status: true },
    });
  }

  findVehicle(scope: FleetScope, id: string) {
    return this.prisma.client.vehicle.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      select: { id: true, status: true },
    });
  }

  findTask(scope: FleetScope, id: string): Promise<StoredServiceTask | null> {
    return this.prisma.client.serviceTask.findUnique({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId },
      select: taskSelect,
    });
  }

  /** Highest completion odometer of the vehicle's DONE tasks completed before `before`. */
  highestCompletedOdometer(
    scope: FleetScope,
    vehicleId: string,
    before: Date,
  ): Promise<number | null> {
    return highestCompletedOdometer(this.prisma.client, scope, vehicleId, before);
  }

  async create(scope: FleetScope, vehicleId: string, data: ServiceTaskPlan): Promise<string> {
    const row = await this.prisma.client.serviceTask.create({
      data: { ...data, vehicleId, tenantId: scope.tenantId, branchId: scope.branchId },
      select: { id: true },
    });
    return row.id;
  }

  /** Changes a task only while it is PLANNED; returns the number of changed rows. */
  async updatePlanned(
    scope: FleetScope,
    id: string,
    data: Partial<ServiceTaskPlan>,
  ): Promise<number> {
    const { count } = await this.prisma.client.serviceTask.updateMany({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId, status: 'PLANNED' },
      data,
    });
    return count;
  }

  /**
   * PLANNED → DONE and, when `next` is given, the next PLANNED task in one transaction; a
   * failure of either write rolls back both. The scoped Vehicle lock serializes completion
   * odometer checks and scheduling with other completions and Vehicle deactivation.
   */
  complete(
    scope: FleetScope,
    id: string,
    vehicleId: string,
    data: ServiceTaskCompletionData,
    next: { vehicleId: string; plan: ServiceTaskPlan } | null,
  ): Promise<{
    completed: number;
    nextId: string | null;
    schedulingBlocked?: boolean;
    odometerTooLow?: boolean;
  }> {
    return this.prisma.client.$transaction(
      async (transaction) => {
        const locked: unknown = await transaction.$queryRaw(Prisma.sql`
          SELECT v."status"::text AS "status" FROM ${fleetTable(this.prisma.schema, 'Vehicle')} v
          WHERE v."tenantId"=${scope.tenantId}::uuid AND v."branchId"=${scope.branchId}::uuid
            AND v."id"=${vehicleId}::uuid
          FOR NO KEY UPDATE`);
        const [status] = rowsOf(locked, (row) =>
          oneOf(row, 'status', Object.values(FleetVehicleStatus)),
        );
        if (status === undefined) {
          return { completed: 0, nextId: null };
        }
        if (next && status === 'INACTIVE') {
          return { completed: 0, nextId: null, schedulingBlocked: true };
        }
        if (data.completedOdometerKm !== null) {
          const highest = await highestCompletedOdometer(
            transaction,
            scope,
            vehicleId,
            data.completedOn,
          );
          if (highest !== null && data.completedOdometerKm < highest) {
            return { completed: 0, nextId: null, odometerTooLow: true };
          }
        }
        const { count } = await transaction.serviceTask.updateMany({
          where: { id, tenantId: scope.tenantId, branchId: scope.branchId, status: 'PLANNED' },
          data: { ...data, status: 'DONE' },
        });
        if (!count || !next) {
          return { completed: count, nextId: null };
        }
        const created = await transaction.serviceTask.create({
          data: {
            ...next.plan,
            vehicleId: next.vehicleId,
            tenantId: scope.tenantId,
            branchId: scope.branchId,
          },
          select: { id: true },
        });
        return { completed: count, nextId: created.id };
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }

  async cancelPlanned(scope: FleetScope, id: string): Promise<number> {
    const { count } = await this.prisma.client.serviceTask.updateMany({
      where: { id, tenantId: scope.tenantId, branchId: scope.branchId, status: 'PLANNED' },
      data: { status: 'CANCELLED' },
    });
    return count;
  }

  /** Deletes PLANNED or CANCELLED tasks only; completed service stays as history. */
  async deleteUncompleted(scope: FleetScope, id: string): Promise<number> {
    const { count } = await this.prisma.client.serviceTask.deleteMany({
      where: {
        id,
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        status: { in: ['PLANNED', 'CANCELLED'] },
      },
    });
    return count;
  }

  private listConditions(scope: FleetScope, criteria: ServiceTaskCriteria): Prisma.Sql {
    const vehicles = fleetTable(this.prisma.schema, 'Vehicle');
    const conditions: Prisma.Sql[] = criteria.tokens.map((token) => {
      const pattern = containsPattern(token);
      return Prisma.sql`(t."title" ILIKE ${pattern}::text OR t."workshop" ILIKE ${pattern}::text OR t."notes" ILIKE ${pattern}::text OR replace(t."serviceType", '_', ' ') ILIKE ${pattern}::text
        OR EXISTS (
          SELECT 1 FROM ${vehicles} v
          WHERE v."tenantId" = ${scope.tenantId}::uuid AND v."branchId" = ${scope.branchId}::uuid
            AND v."id" = t."vehicleId"
            AND (v."licensePlate" ILIKE ${pattern}::text OR v."fleetNumber" ILIKE ${pattern}::text)
        ))`;
    });
    if (criteria.ids) {
      conditions.push(Prisma.sql`t."id" = ANY(${criteria.ids}::uuid[])`);
    }
    for (const condition of [criteria, ...(criteria.allOf ?? [])]) {
      if ('vehicleStatuses' in condition && condition.vehicleStatuses) {
        conditions.push(
          Prisma.sql`EXISTS(SELECT 1 FROM ${vehicles} v WHERE v."tenantId"=${scope.tenantId}::uuid AND v."branchId"=${scope.branchId}::uuid AND v."id"=t."vehicleId" AND v."status"::text=ANY(${condition.vehicleStatuses}::text[]))`,
        );
      }
      if (condition.statuses) {
        conditions.push(Prisma.sql`t."status" = ANY(${condition.statuses}::text[])`);
      }
      // Only PLANNED tasks have an urgency, so an urgency filter implies PLANNED.
      if (condition.urgencies) {
        conditions.push(Prisma.sql`t."urgency" = ANY(${condition.urgencies}::text[])`);
      }
      if (condition.serviceTypes) {
        conditions.push(Prisma.sql`t."serviceType" = ANY(${condition.serviceTypes}::text[])`);
      }
      if (condition.vehicleIds) {
        conditions.push(Prisma.sql`t."vehicleId" = ANY(${condition.vehicleIds}::uuid[])`);
      }
      if (condition.completedFrom) {
        conditions.push(Prisma.sql`t."completedOn"::date >= ${condition.completedFrom}::date`);
      }
      if (condition.completedTo) {
        conditions.push(Prisma.sql`t."completedOn"::date <= ${condition.completedTo}::date`);
      }
      if ('excludedStatuses' in condition && condition.excludedStatuses) {
        conditions.push(Prisma.sql`NOT (t."status" = ANY(${condition.excludedStatuses}::text[]))`);
      }
      if ('excludedUrgencies' in condition && condition.excludedUrgencies) {
        conditions.push(
          Prisma.sql`(t."urgency" IS NULL OR NOT (t."urgency" = ANY(${condition.excludedUrgencies}::text[])))`,
        );
      }
      if ('excludedServiceTypes' in condition && condition.excludedServiceTypes) {
        conditions.push(
          Prisma.sql`NOT (t."serviceType" = ANY(${condition.excludedServiceTypes}::text[]))`,
        );
      }
      if ('excludedVehicleIds' in condition && condition.excludedVehicleIds) {
        conditions.push(
          Prisma.sql`NOT (t."vehicleId" = ANY(${condition.excludedVehicleIds}::uuid[]))`,
        );
      }
      if ('dueOnBefore' in condition && condition.dueOnBefore) {
        conditions.push(Prisma.sql`t."dueOn"::date < ${condition.dueOnBefore}::date`);
      }
      if ('dueOnAfter' in condition && condition.dueOnAfter) {
        conditions.push(Prisma.sql`t."dueOn"::date > ${condition.dueOnAfter}::date`);
      }
      if ('dueOnFrom' in condition && condition.dueOnFrom) {
        conditions.push(Prisma.sql`t."dueOn"::date >= ${condition.dueOnFrom}::date`);
      }
      if ('dueOnTo' in condition && condition.dueOnTo) {
        conditions.push(Prisma.sql`t."dueOn"::date <= ${condition.dueOnTo}::date`);
      }
      if ('hasDueOn' in condition && condition.hasDueOn != null) {
        conditions.push(
          condition.hasDueOn ? Prisma.sql`t."dueOn" IS NOT NULL` : Prisma.sql`t."dueOn" IS NULL`,
        );
      }
      if ('costCentsAbove' in condition && condition.costCentsAbove != null) {
        conditions.push(Prisma.sql`t."costCents" > ${condition.costCentsAbove}::int`);
      }
      if ('costCentsBelow' in condition && condition.costCentsBelow != null) {
        conditions.push(Prisma.sql`t."costCents" < ${condition.costCentsBelow}::int`);
      }
      if ('hasCost' in condition && condition.hasCost != null) {
        conditions.push(
          condition.hasCost
            ? Prisma.sql`t."costCents" IS NOT NULL`
            : Prisma.sql`t."costCents" IS NULL`,
        );
      }
      if ('taskContains' in condition && condition.taskContains) {
        const pattern = containsPattern(condition.taskContains);
        conditions.push(
          Prisma.sql`(t."title" ILIKE ${pattern}::text OR (t."title" IS NULL AND t."serviceType" = ANY(${condition.untitledServiceTypes ?? []}::text[])))`,
        );
      }
      if ('taskEquals' in condition && condition.taskEquals) {
        conditions.push(
          Prisma.sql`(lower(t."title") = lower(${condition.taskEquals}::text) OR (t."title" IS NULL AND t."serviceType" = ANY(${condition.untitledServiceTypes ?? []}::text[])))`,
        );
      }
    }
    return conditions.length ? Prisma.join(conditions, ' AND ') : Prisma.sql`TRUE`;
  }
}
