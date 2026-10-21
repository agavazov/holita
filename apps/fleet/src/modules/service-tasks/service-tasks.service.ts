import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { addDays, businessDate, FleetClock } from '../../clock/fleet-clock.js';
import type {
  CompleteFleetServiceTaskInput,
  CreateFleetServiceTaskInput,
  FleetServiceSummary,
  FleetServiceTask,
  FleetServiceTaskCompletion,
  FleetServiceTaskActionFailure,
  FleetServiceTaskActionResult,
  FleetServiceTaskPage,
  FleetServiceTaskSortField,
  QueryFleetServiceTasksArgs,
  UpdateFleetServiceTaskInput,
} from '../../generated/graphql/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import { FleetServiceStatus, FleetServiceType } from '../../generated/prisma/enums.js';
import { dateOnlyToDate } from '../../graphql/scalars.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import {
  dateOnly,
  dateOnlyRange,
  enumFilter,
  enumValue,
  type FleetScope,
  idList,
  ids,
  invalid,
  invalidFields,
  optionalDateOnly,
  optionalInteger,
  optionalText,
  pagination,
  requireScope,
  searchTokens,
  sortDirection,
  sortField,
  uuid,
} from '../../validation.js';
import {
  type ServiceTaskCompletionData,
  type ServiceTaskCriteria,
  type ServiceTaskPlan,
  ServiceTasksRepository,
} from './service-tasks.repository.js';
import { SERVICE_URGENCIES, type ServiceTaskRow } from './service-urgency.sql.js';
import { serviceTaskConditions } from './service-task-filter.js';
import { SettingsService } from '../settings/settings.service.js';

const SERVICE_TYPES = Object.values(FleetServiceType);
const SERVICE_STATUSES = Object.values(FleetServiceStatus);
const SORT_FIELDS: readonly FleetServiceTaskSortField[] = [
  'URGENCY',
  'DUE_ON',
  'COMPLETED_ON',
  'CREATED_AT',
  'TASK',
  'VEHICLE_LICENSE_PLATE',
  'COST_CENTS',
];
const MAX_ODOMETER_KM = 9_999_999;
const MAX_COST_CENTS = 100_000_000;
const EARLIEST_SERVICE_DATE = '2000-01-01';
/** The cost window is the business date and the 29 days before it. */
const COST_WINDOW_DAYS = 30;
const ODOMETER_BELOW_EARLIER_SERVICE =
  'The odometer cannot be below an earlier completed service of this vehicle.';

/** Service dates are real calendar days from 2000 to 2100. */
function serviceDate(value: unknown, path: string): string | null {
  const result = optionalDateOnly(value, path);
  if (result !== null && result < EARLIEST_SERVICE_DATE) {
    invalid(path, 'Use a date from 2000-01-01 to 2100-12-31.', 'OUT_OF_RANGE');
  }
  return result;
}

function dateValue(value: string | null): Date | null {
  return value === null ? null : dateOnlyToDate(value);
}

const fieldRules = {
  title: (value: unknown, path = 'title') => optionalText(value, path, 120),
  dueOdometerKm: (value: unknown, path = 'dueOdometerKm') =>
    optionalInteger(value, path, 0, MAX_ODOMETER_KM),
  workshop: (value: unknown) => optionalText(value, 'workshop', 128),
  notes: (value: unknown) => optionalText(value, 'notes', 2000),
};

function requireDue(dueOn: unknown, dueOdometerKm: unknown): void {
  if (dueOn === null && dueOdometerKm === null) {
    invalid('dueOn', 'Give a due date, a due odometer or both.', 'DUE_THRESHOLD_REQUIRED');
  }
}

@Injectable()
export class ServiceTasksService {
  private readonly logger = new Logger(ServiceTasksService.name);
  constructor(
    private readonly tasks: ServiceTasksRepository,
    private readonly core: CoreClient,
    private readonly clock: FleetClock,
    private readonly settings: SettingsService,
  ) {}

  async list(
    context: RequestContext,
    args: QueryFleetServiceTasksArgs,
  ): Promise<FleetServiceTaskPage> {
    const scope = requireScope(context);
    const { offset, limit } = pagination(args);
    const tokens = searchTokens(args.search);
    const selected = args.ids == null ? undefined : ids(args.ids, 'ids');
    const filter = args.filter;
    const completed = dateOnlyRange(filter?.completedFrom, filter?.completedTo, {
      from: 'completedFrom',
      to: 'completedTo',
    });
    const criteria: ServiceTaskCriteria = {
      tokens,
      ids: selected,
      statuses: enumFilter(filter?.statuses, SERVICE_STATUSES, 'statuses'),
      urgencies: enumFilter(filter?.urgencies, SERVICE_URGENCIES, 'urgencies'),
      serviceTypes: enumFilter(filter?.serviceTypes, SERVICE_TYPES, 'serviceTypes'),
      vehicleIds: idList(filter?.vehicleIds, 'vehicleIds'),
      completedFrom: completed.from,
      completedTo: completed.to,
      ...(filter?.allOf == null ? {} : { allOf: serviceTaskConditions(filter.allOf) }),
    };
    const sort = {
      field: sortField(args.sort?.field, SORT_FIELDS, 'URGENCY'),
      direction: sortDirection(args.sort?.direction, 'ASC'),
    };
    const page = await this.tasks.list(
      scope,
      await this.today(scope),
      { offset, limit },
      criteria,
      sort,
    );
    return { items: await this.withRefs(scope, page.items), total: page.total, offset, limit };
  }

  find(context: RequestContext, id: string): Promise<FleetServiceTask> {
    return this.load(requireScope(context), uuid(id, 'id'));
  }

  async summary(context: RequestContext): Promise<FleetServiceSummary> {
    const scope = requireScope(context);
    const today = await this.today(scope);
    const costWindowStart = addDays(today, 1 - COST_WINDOW_DAYS);
    const [urgency, inWorkshopVehicles, completed] = await Promise.all([
      this.tasks.urgencyCounts(scope, today),
      this.tasks.countVehiclesInWorkshop(scope),
      this.tasks.completedTotals(scope, dateOnlyToDate(costWindowStart), dateOnlyToDate(today)),
    ]);
    return {
      businessDate: today,
      ...urgency,
      inWorkshopVehicles,
      completedLast30Days: completed.count,
      costLast30DaysCents: completed.costCents,
      costWindowStart,
      costWindowEnd: today,
    };
  }

  async create(
    context: RequestContext,
    input: CreateFleetServiceTaskInput,
  ): Promise<FleetServiceTask> {
    const scope = requireScope(context);
    const vehicleId = uuid(input.vehicleId, 'vehicleId');
    const dueOn = serviceDate(input.dueOn, 'dueOn');
    const plan: ServiceTaskPlan = {
      serviceType: enumValue(input.serviceType, SERVICE_TYPES, 'serviceType'),
      title: fieldRules.title(input.title),
      dueOn: dateValue(dueOn),
      dueOdometerKm: fieldRules.dueOdometerKm(input.dueOdometerKm),
      workshop: fieldRules.workshop(input.workshop),
      notes: fieldRules.notes(input.notes),
    };
    requireDue(plan.dueOn, plan.dueOdometerKm);
    await this.requireServiceableVehicle(scope, vehicleId);
    await this.core.requireBranch(scope.branchId, context);
    let id: string | null;
    try {
      id = await this.tasks.create(scope, vehicleId, plan);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        invalid('vehicleId', 'Choose a vehicle in this branch.', 'VEHICLE_UNAVAILABLE');
      }
      throw error;
    }
    if (id === null) {
      invalid(
        'vehicleId',
        'Choose a vehicle in this branch that is not inactive.',
        'VEHICLE_UNAVAILABLE',
      );
    }
    return this.load(scope, id);
  }

  async update(
    context: RequestContext,
    id: string,
    input: UpdateFleetServiceTaskInput,
  ): Promise<FleetServiceTask> {
    const scope = requireScope(context);
    const recordId = uuid(id, 'id');
    const data: Partial<ServiceTaskPlan> = {};
    if (input.serviceType !== undefined) {
      data.serviceType = enumValue(input.serviceType, SERVICE_TYPES, 'serviceType');
    }
    if (input.title !== undefined) {
      data.title = fieldRules.title(input.title);
    }
    if (input.dueOn !== undefined) {
      data.dueOn = dateValue(serviceDate(input.dueOn, 'dueOn'));
    }
    if (input.dueOdometerKm !== undefined) {
      data.dueOdometerKm = fieldRules.dueOdometerKm(input.dueOdometerKm);
    }
    if (input.workshop !== undefined) {
      data.workshop = fieldRules.workshop(input.workshop);
    }
    if (input.notes !== undefined) {
      data.notes = fieldRules.notes(input.notes);
    }
    if (!Object.keys(data).length) {
      throw new BadRequestException('Provide at least one service task field to update');
    }
    const stored = await this.tasks.findTask(scope, recordId);
    if (!stored) {
      throw new NotFoundException('Service task not found');
    }
    if (stored.status !== 'PLANNED') {
      throw new ConflictException('Only planned service can be changed');
    }
    requireDue(
      data.dueOn === undefined ? stored.dueOn : data.dueOn,
      data.dueOdometerKm === undefined ? stored.dueOdometerKm : data.dueOdometerKm,
    );
    if (!(await this.tasks.updatePlanned(scope, recordId, data))) {
      await this.plannedConflict(scope, recordId, 'Only planned service can be changed');
    }
    return this.load(scope, recordId);
  }

  /**
   * Completes a PLANNED task and, when a next due date or odometer is given, schedules the next
   * PLANNED task of the same vehicle and type in the same transaction.
   */
  async complete(
    context: RequestContext,
    id: string,
    input: CompleteFleetServiceTaskInput,
  ): Promise<FleetServiceTaskCompletion> {
    const scope = requireScope(context);
    const recordId = uuid(id, 'id');
    const today = await this.today(scope);
    const completedOn = dateOnly(input.completedOn, 'completedOn');
    if (completedOn < EARLIEST_SERVICE_DATE || completedOn > today) {
      invalid('completedOn', 'Use a completion date from 2000-01-01 up to today.', 'OUT_OF_RANGE');
    }
    const data: ServiceTaskCompletionData = {
      completedOn: dateOnlyToDate(completedOn),
      completedOdometerKm: optionalInteger(
        input.completedOdometerKm,
        'completedOdometerKm',
        0,
        MAX_ODOMETER_KM,
      ),
      costCents: optionalInteger(input.costCents, 'costCents', 0, MAX_COST_CENTS),
      replacedParts: optionalText(input.replacedParts, 'replacedParts', 1000),
      ...(input.workshop === undefined ? {} : { workshop: fieldRules.workshop(input.workshop) }),
      ...(input.notes === undefined ? {} : { notes: fieldRules.notes(input.notes) }),
    };
    const nextDueOn = serviceDate(input.nextDueOn, 'nextDueOn');
    if (nextDueOn !== null && nextDueOn <= completedOn) {
      invalid(
        'nextDueOn',
        'The next due date must be after the completion date.',
        'NEXT_DUE_NOT_LATER',
      );
    }
    const nextDueOdometerKm = fieldRules.dueOdometerKm(
      input.nextDueOdometerKm,
      'nextDueOdometerKm',
    );
    if (
      nextDueOdometerKm !== null &&
      data.completedOdometerKm !== null &&
      nextDueOdometerKm <= data.completedOdometerKm
    ) {
      invalid(
        'nextDueOdometerKm',
        'The next due odometer must be above the completion odometer.',
        'NEXT_DUE_NOT_LATER',
      );
    }
    const nextTitle = fieldRules.title(input.nextTitle, 'nextTitle');
    const stored = await this.tasks.findTask(scope, recordId);
    if (!stored) {
      throw new NotFoundException('Service task not found');
    }
    if (stored.status !== 'PLANNED') {
      throw new ConflictException('Only planned service can be completed');
    }
    if (data.completedOdometerKm !== null) {
      const highest = await this.tasks.highestCompletedOdometer(
        scope,
        stored.vehicleId,
        data.completedOn,
      );
      if (highest !== null && data.completedOdometerKm < highest) {
        invalid('completedOdometerKm', ODOMETER_BELOW_EARLIER_SERVICE, 'ODOMETER_DECREASE');
      }
    }
    const next =
      nextDueOn === null && nextDueOdometerKm === null
        ? null
        : {
            vehicleId: stored.vehicleId,
            plan: {
              serviceType: stored.serviceType,
              title: nextTitle ?? stored.title,
              dueOn: dateValue(nextDueOn),
              dueOdometerKm: nextDueOdometerKm,
              workshop: data.workshop === undefined ? stored.workshop : data.workshop,
              notes: null,
            },
          };
    const result = await this.tasks.complete(scope, recordId, stored.vehicleId, data, next);
    if (result.odometerTooLow) {
      invalid('completedOdometerKm', ODOMETER_BELOW_EARLIER_SERVICE, 'ODOMETER_DECREASE');
    }
    if (result.schedulingBlocked) {
      invalidFields([
        ...(nextDueOn === null
          ? []
          : [
              {
                path: 'nextDueOn',
                message: 'A next service cannot be planned for an inactive vehicle.',
                code: 'VEHICLE_UNAVAILABLE',
              },
            ]),
        ...(nextDueOdometerKm === null
          ? []
          : [
              {
                path: 'nextDueOdometerKm',
                message: 'A next service cannot be planned for an inactive vehicle.',
                code: 'VEHICLE_UNAVAILABLE',
              },
            ]),
      ]);
    }
    if (!result.completed) {
      await this.plannedConflict(scope, recordId, 'Only planned service can be completed');
    }
    const taskIds = result.nextId === null ? [recordId] : [recordId, result.nextId];
    const [completed, created] = await this.withRefs(
      scope,
      await this.tasks.findMany(scope, today, taskIds),
      taskIds,
    );
    if (!completed) {
      throw new NotFoundException('Service task not found');
    }
    return { completed, next: created ?? null };
  }

  async cancel(context: RequestContext, id: string): Promise<FleetServiceTask> {
    const scope = requireScope(context);
    const recordId = uuid(id, 'id');
    if (!(await this.tasks.cancelPlanned(scope, recordId))) {
      await this.plannedConflict(scope, recordId, 'Only planned service can be cancelled');
    }
    return this.load(scope, recordId);
  }

  /** Deletes a PLANNED or CANCELLED task; completed service is kept as history. */
  async delete(context: RequestContext, id: string): Promise<FleetServiceTask> {
    const scope = requireScope(context);
    const recordId = uuid(id, 'id');
    const task = await this.load(scope, recordId);
    if (task.status === 'DONE') {
      throw new ConflictException('Completed service is kept as history');
    }
    if (!(await this.tasks.deleteUncompleted(scope, recordId))) {
      await this.plannedConflict(scope, recordId, 'Completed service is kept as history');
    }
    return task;
  }

  async cancelMany(
    context: RequestContext,
    values: readonly string[],
  ): Promise<FleetServiceTaskActionResult> {
    requireScope(context);
    const selected = ids(values, 'ids');
    if (!selected.length) {
      invalid('ids', 'Choose at least one service task.', 'REQUIRED');
    }
    const succeededIds: string[] = [];
    const failures: FleetServiceTaskActionFailure[] = [];
    for (const id of selected) {
      try {
        await this.cancel(context, id);
        succeededIds.push(id);
      } catch (error: unknown) {
        failures.push(this.actionFailure(context, id, error));
      }
    }
    return { succeededIds, failures };
  }

  async deleteMany(
    context: RequestContext,
    values: readonly string[],
  ): Promise<FleetServiceTaskActionResult> {
    requireScope(context);
    const selected = ids(values, 'ids');
    if (!selected.length) {
      invalid('ids', 'Choose at least one service task.', 'REQUIRED');
    }
    const succeededIds: string[] = [];
    const failures: FleetServiceTaskActionFailure[] = [];
    for (const id of selected) {
      try {
        await this.delete(context, id);
        succeededIds.push(id);
      } catch (error: unknown) {
        failures.push(this.actionFailure(context, id, error));
      }
    }
    return { succeededIds, failures };
  }

  private actionFailure(
    context: RequestContext,
    id: string,
    error: unknown,
  ): FleetServiceTaskActionFailure {
    if (error instanceof HttpException) {
      const code = new Map([
        [400, 'BAD_USER_INPUT'],
        [404, 'NOT_FOUND'],
        [409, 'CONFLICT'],
        [503, 'SERVICE_UNAVAILABLE'],
      ]).get(error.getStatus());
      if (code) {
        return { id, code, message: error.message };
      }
    }
    this.logger.error({
      requestId: context.requestId,
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return { id, code: 'INTERNAL_SERVER_ERROR', message: 'Unable to change service task.' };
  }

  /** The next PLANNED task per vehicle ID (`FleetVehicle.nextService`, one raw query). */
  async nextForVehicles(
    scope: FleetScope,
    vehicleIds: readonly string[],
  ): Promise<Map<string, FleetServiceTask>> {
    if (!vehicleIds.length) {
      return new Map();
    }
    const tasks = await this.withRefs(
      scope,
      await this.tasks.nextForVehicles(scope, await this.today(scope), vehicleIds),
    );
    return new Map(tasks.map((task) => [task.vehicleId, task]));
  }

  private async today(scope: FleetScope): Promise<string> {
    return businessDate(this.clock.now(), (await this.settings.read(scope)).timeZone);
  }

  private async requireServiceableVehicle(scope: FleetScope, vehicleId: string): Promise<void> {
    const vehicle = await this.tasks.findVehicle(scope, vehicleId);
    if (!vehicle || vehicle.status === 'INACTIVE') {
      invalid(
        'vehicleId',
        'Choose a vehicle in this branch that is not inactive.',
        'VEHICLE_UNAVAILABLE',
      );
    }
  }

  private async load(scope: FleetScope, id: string): Promise<FleetServiceTask> {
    const [task] = await this.withRefs(
      scope,
      await this.tasks.findMany(scope, await this.today(scope), [id]),
    );
    if (!task) {
      throw new NotFoundException('Service task not found');
    }
    return task;
  }

  /** A conditional write changed nothing: the task is missing (NOT_FOUND) or not PLANNED. */
  private async plannedConflict(scope: FleetScope, id: string, message: string): Promise<never> {
    if (!(await this.tasks.findTask(scope, id))) {
      throw new NotFoundException('Service task not found');
    }
    throw new ConflictException(message);
  }

  /**
   * Attaches vehicle references with one query; `order` (task IDs) fixes the result order,
   * otherwise the rows keep theirs.
   */
  private async withRefs(
    scope: FleetScope,
    rows: readonly ServiceTaskRow[],
    order?: readonly string[],
  ): Promise<FleetServiceTask[]> {
    if (!rows.length) {
      return [];
    }
    const vehicles = new Map(
      (await this.tasks.vehicleRefs(scope, [...new Set(rows.map((row) => row.vehicleId))])).map(
        (vehicle) => [vehicle.id, vehicle],
      ),
    );
    const sorted = order ? order.flatMap((id) => rows.filter((row) => row.id === id)) : [...rows];
    return sorted.map((row) => {
      const vehicle = vehicles.get(row.vehicleId);
      if (!vehicle) {
        throw new Error('Service task without its vehicle');
      }
      return { ...row, branchId: scope.branchId, vehicle };
    });
  }
}
