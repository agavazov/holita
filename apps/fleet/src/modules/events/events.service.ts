import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { type DataWindow, FleetClock } from '../../clock/fleet-clock.js';
import type {
  FleetAlertCounts,
  FleetAlertActionFailure,
  FleetAlertActionResult,
  FleetAlertTransitionInput,
  FleetEvent,
  FleetEventFilter,
  FleetEventPage,
  FleetEventSortField,
  FleetManeuverCount,
  FleetMeasurementUnit,
  FleetTripDrivingEvent,
  QueryFleetAlertCountsArgs,
  QueryFleetEventsArgs,
  QueryFleetManeuverCountsArgs,
} from '../../generated/graphql/types.js';
import {
  FleetAlertStatus,
  FleetEventKind,
  FleetEventSeverity,
} from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { RequestContext } from '../../graphql/request-context.js';
import {
  booleanFilter,
  dateTimeRange,
  enumFilter,
  enumValue,
  type FleetScope,
  idList,
  ids,
  invalid,
  optionalText,
  pagination,
  requireScope,
  searchTokens,
  sortDirection,
  sortField,
  uuid,
} from '../../validation.js';
import { type EventCriteria, type EventRow, EventsRepository } from './events.repository.js';
import { eventConditions } from './event-filter.js';

const ALERT_STATUSES = Object.values(FleetAlertStatus);
const SEVERITIES = Object.values(FleetEventSeverity);
const EVENT_KINDS = Object.values(FleetEventKind);
const SORT_FIELDS: readonly FleetEventSortField[] = ['OCCURRED_AT', 'SEVERITY', 'ALERT_STATUS'];
/** Longest period `fleetManeuverCounts` accepts without trip IDs. */
const MANEUVER_PERIOD_DAYS = 93;
const DAY_MS = 86_400_000;

/** The first nine event kinds: the maneuvers that scores and scorecards count. */
export const MANEUVER_KINDS: readonly FleetEventKind[] = [
  'HARSH_ACCELERATION',
  'HARSH_BRAKING',
  'SPEED_BUMP',
  'OVERTAKING',
  'ROUNDABOUT',
  'LANE_CHANGE',
  'SHARP_TURN',
  'OFF_ROAD',
  'SPEEDING',
];

/** Unit of `measuredValue`/`thresholdValue` by kind; other kinds carry no measurement. */
export function measurementUnit(kind: FleetEventKind): FleetMeasurementUnit | null {
  switch (kind) {
    case 'SPEEDING':
      return 'KPH';
    case 'IDLING':
    case 'DEVICE_OFFLINE':
      return 'MINUTE';
    case 'LOW_FUEL':
    case 'FUEL_DROP':
      return 'PERCENT';
    case 'POWER_DISCONNECTED':
    case 'LOW_BACKUP_BATTERY':
      return 'VOLT';
    default:
      return null;
  }
}

/** Alert transitions: allowed expected statuses, the new status and its timestamps. */
const TRANSITIONS = {
  acknowledge: {
    from: ['OPEN'],
    data: (now: Date) => ({ alertStatus: 'ACKNOWLEDGED', acknowledgedAt: now }),
  },
  resolve: {
    from: ['OPEN', 'ACKNOWLEDGED'],
    data: (now: Date) => ({ alertStatus: 'RESOLVED', resolvedAt: now }),
  },
  reopen: {
    from: ['RESOLVED'],
    data: () => ({ alertStatus: 'OPEN', acknowledgedAt: null, resolvedAt: null }),
  },
} satisfies Record<
  string,
  {
    from: readonly FleetAlertStatus[];
    data: (now: Date) => Prisma.FleetEventUpdateManyMutationInput;
  }
>;

export type AlertTransition = keyof typeof TRANSITIONS;

function toEvent(row: EventRow): FleetEvent {
  return {
    id: row.id,
    branchId: row.branchId,
    vehicleId: row.vehicleId,
    vehicle: row.vehicle,
    tripId: row.tripId,
    driverId: row.driverId,
    driver: row.driver,
    deviceImei: row.deviceImei,
    source: row.source,
    occurredAt: row.occurredAt,
    kind: row.kind,
    severity: row.severity,
    intensity: row.intensity,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    speedKph: row.speedKph,
    measuredValue: row.measuredValue,
    thresholdValue: row.thresholdValue,
    measurementUnit: measurementUnit(row.kind),
    troubleCode: row.troubleCode,
    details: row.details,
    alertStatus: row.alertStatus,
    acknowledgedAt: row.acknowledgedAt,
    resolvedAt: row.resolvedAt,
    remark: row.remark,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Search and filter of `fleetEvents`, shared by the counts so they describe the same list. */
function eventCriteria(
  search: unknown,
  selectedIds: unknown,
  filter: FleetEventFilter | null | undefined,
): EventCriteria {
  const tokens = searchTokens(search);
  const selected =
    selectedIds === null || selectedIds === undefined ? undefined : ids(selectedIds, 'ids');
  const period = dateTimeRange(filter?.occurredFrom, filter?.occurredTo, {
    from: 'occurredFrom',
    to: 'occurredTo',
  });
  return {
    tokens,
    ids: selected,
    actionable: booleanFilter(filter?.actionable, 'actionable'),
    alertStatuses: enumFilter(filter?.alertStatuses, ALERT_STATUSES, 'alertStatuses'),
    severities: enumFilter(filter?.severities, SEVERITIES, 'severities'),
    kinds: enumFilter(filter?.kinds, EVENT_KINDS, 'kinds'),
    vehicleIds: idList(filter?.vehicleIds, 'vehicleIds'),
    driverIds: idList(filter?.driverIds, 'driverIds'),
    tripIds: idList(filter?.tripIds, 'tripIds'),
    occurredFrom: period.from,
    occurredTo: period.to,
    ...(filter?.allOf == null ? {} : { allOf: eventConditions(filter.allOf) }),
  };
}

/** Nine maneuver rows in enum order, zero rows included. */
function maneuverRows(
  counts: readonly { kind: FleetEventKind; intensity: number | null; count: number }[],
): FleetManeuverCount[] {
  return MANEUVER_KINDS.map((kind) => {
    const ofKind = counts.filter((row) => row.kind === kind);
    const at = (intensity: number | null) =>
      ofKind.filter((row) => row.intensity === intensity).reduce((sum, row) => sum + row.count, 0);
    const total = ofKind.reduce((sum, row) => sum + row.count, 0);
    const intensity1 = at(1),
      intensity2 = at(2),
      intensity3 = at(3);
    return {
      kind,
      intensity1,
      intensity2,
      intensity3,
      intensityUnknown: total - intensity1 - intensity2 - intensity3,
      total,
    };
  });
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  constructor(
    private readonly events: EventsRepository,
    private readonly clock: FleetClock,
  ) {}

  async list(context: RequestContext, args: QueryFleetEventsArgs): Promise<FleetEventPage> {
    const scope = requireScope(context);
    const { offset, limit } = pagination(args);
    const criteria = eventCriteria(args.search, args.ids, args.filter);
    const sort = {
      field: sortField(args.sort?.field, SORT_FIELDS, 'OCCURRED_AT'),
      direction: sortDirection(args.sort?.direction, 'DESC'),
    };
    const page = await this.events.list(scope, { offset, limit }, criteria, sort);
    return { items: page.items.map(toEvent), total: page.total, offset, limit };
  }

  async find(context: RequestContext, id: string): Promise<FleetEvent> {
    const row = await this.events.find(requireScope(context), uuid(id, 'id'));
    if (!row) {
      throw new NotFoundException('Event not found');
    }
    return toEvent(row);
  }

  /** Actionable events per status for the same search and filter, ignoring the status parts. */
  async alertCounts(
    context: RequestContext,
    args: QueryFleetAlertCountsArgs,
  ): Promise<FleetAlertCounts> {
    const scope = requireScope(context);
    const criteria = eventCriteria(args.search, undefined, args.filter);
    const rows = await this.events.alertCounts(scope, {
      ...criteria,
      actionable: undefined,
      alertStatuses: undefined,
      ...(criteria.allOf === undefined
        ? {}
        : {
            allOf: criteria.allOf.map((condition) => ({
              ...condition,
              actionable: undefined,
              alertStatuses: undefined,
              excludedAlertStatuses: undefined,
            })),
          }),
    });
    const count = (status: FleetAlertStatus, severity?: FleetEventSeverity) =>
      rows
        .filter(
          (row) =>
            row.alertStatus === status && (severity === undefined || row.severity === severity),
        )
        .reduce((sum, row) => sum + row.count, 0);
    return {
      open: count('OPEN'),
      openCritical: count('OPEN', 'CRITICAL'),
      acknowledged: count('ACKNOWLEDGED'),
      resolved: count('RESOLVED'),
    };
  }

  /** Maneuver counts for trips or for a period of at most 93 days. */
  async maneuverCounts(
    context: RequestContext,
    args: QueryFleetManeuverCountsArgs,
  ): Promise<FleetManeuverCount[]> {
    const scope = requireScope(context);
    const criteria = eventCriteria(undefined, undefined, args.filter);
    const { occurredFrom, occurredTo } = criteria;
    if (
      !criteria.tripIds &&
      !(
        occurredFrom &&
        occurredTo &&
        occurredTo.getTime() - occurredFrom.getTime() <= MANEUVER_PERIOD_DAYS * DAY_MS
      )
    ) {
      invalid(
        'filter',
        `filter.tripIds or filter.occurredFrom and filter.occurredTo at most ${String(MANEUVER_PERIOD_DAYS)} days apart are required.`,
        'BOUNDED_PERIOD_REQUIRED',
      );
    }
    return maneuverRows(await this.events.kindIntensityCounts(scope, criteria, MANEUVER_KINDS));
  }

  /**
   * Alert transition with optimistic concurrency: the caller states the status it saw; a
   * changed alert is a CONFLICT and an informational or foreign event is NOT_FOUND.
   */
  async transition(
    context: RequestContext,
    transition: AlertTransition,
    id: string,
    input: FleetAlertTransitionInput,
  ): Promise<FleetEvent> {
    const scope = requireScope(context);
    const recordId = uuid(id, 'id');
    const rule = TRANSITIONS[transition];
    const expected = enumValue(input.expectedStatus, ALERT_STATUSES, 'expectedStatus');
    const allowed: readonly FleetAlertStatus[] = rule.from;
    if (!allowed.includes(expected)) {
      invalid(
        'expectedStatus',
        `An alert cannot be changed this way from ${expected}.`,
        'INVALID_TRANSITION',
      );
    }
    const remark =
      input.remark === undefined ? {} : { remark: optionalText(input.remark, 'remark', 1000) };
    const changed = await this.events.transition(scope, recordId, expected, {
      ...rule.data(this.clock.now()),
      ...remark,
    });
    const row = await this.events.find(scope, recordId);
    if (!row || row.alertStatus === null) {
      throw new NotFoundException('Alert not found');
    }
    if (!changed) {
      throw new ConflictException('The alert changed after it was loaded; reload it.');
    }
    return toEvent(row);
  }

  async acknowledgeMany(
    context: RequestContext,
    values: readonly string[],
    input: FleetAlertTransitionInput,
  ): Promise<FleetAlertActionResult> {
    requireScope(context);
    const selected = ids(values, 'ids');
    if (!selected.length) {
      invalid('ids', 'Choose at least one alert.', 'REQUIRED');
    }
    // Validate the shared input before the first write, including an empty selection boundary.
    const expected = enumValue(input.expectedStatus, ALERT_STATUSES, 'expectedStatus');
    if (expected !== 'OPEN') {
      invalid('expectedStatus', 'Only open alerts can be acknowledged.', 'INVALID_TRANSITION');
    }
    if (input.remark !== undefined) {
      optionalText(input.remark, 'remark', 1000);
    }
    const succeededIds: string[] = [];
    const failures: FleetAlertActionFailure[] = [];
    for (const id of selected) {
      try {
        await this.transition(context, 'acknowledge', id, input);
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
  ): FleetAlertActionFailure {
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
    return { id, code: 'INTERNAL_SERVER_ERROR', message: 'Unable to acknowledge alert.' };
  }

  /** Complete maneuver timelines for a page of scoped trip/vehicle pairs. */
  async drivingEventsByTrip(
    scope: FleetScope,
    trips: readonly { readonly id: string; readonly vehicleId: string }[],
  ): Promise<Map<string, FleetTripDrivingEvent[]>> {
    const result = new Map<string, FleetTripDrivingEvent[]>();
    if (!trips.length) {
      return result;
    }
    const rows = await this.events.drivingEventsByTrip(scope, trips, MANEUVER_KINDS);
    for (const { tripId, ...event } of rows) {
      if (tripId === null) {
        continue;
      }
      const timeline = result.get(tripId) ?? [];
      timeline.push(event);
      result.set(tripId, timeline);
    }
    return result;
  }

  /** OPEN alerts per vehicle ID (vehicles without any are absent). */
  async openAlertCounts(scope: FleetScope, vehicleIds: readonly string[]) {
    if (!vehicleIds.length) {
      return new Map<string, number>();
    }
    const rows = await this.events.openAlertCounts(scope, vehicleIds);
    return new Map(rows.map((row) => [row.vehicleId, row.count]));
  }

  /** Maneuver events per trip ID (trips without any are absent). */
  async maneuverCountsByTrip(
    scope: FleetScope,
    trips: readonly { vehicleId: string; tripId: string }[],
  ) {
    if (!trips.length) {
      return new Map<string, number>();
    }
    const rows = await this.events.countsByTrip(scope, trips, MANEUVER_KINDS);
    return new Map(rows.map((row) => [row.tripId, row.count]));
  }

  /** Maneuver events per driver ID with `occurredAt` in the window. */
  async maneuverTotalsByDriver(
    scope: FleetScope,
    driverIds: readonly string[],
    window: DataWindow,
  ) {
    if (!driverIds.length) {
      return new Map<string, number>();
    }
    const rows = await this.events.countsByDriver(scope, driverIds, MANEUVER_KINDS, window);
    return new Map(rows.map((row) => [row.driverId, row.count]));
  }

  /** Nine maneuver rows of one driver with `occurredAt` in the window (zeros without one). */
  async driverManeuvers(
    scope: FleetScope,
    driverId: string,
    window: DataWindow | null,
  ): Promise<FleetManeuverCount[]> {
    if (window === null) {
      return maneuverRows([]);
    }
    return maneuverRows(
      await this.events.driverKindIntensityCounts(scope, driverId, MANEUVER_KINDS, window),
    );
  }
}
