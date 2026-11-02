import { Injectable } from '@nestjs/common';
import { FleetClock } from '../../clock/fleet-clock.js';
import { literalContains } from '../../database/search.js';
import type {
  QueryFleetKarmaMonitoringEventsArgs,
  QueryFleetKarmaMonitoringTrucksArgs,
  UpdateFleetKarmaMonitoringSettingsInput,
  FleetKarmaMonitoringEvent,
} from '../../generated/graphql/types.js';
import type { KarmaMonitoringEvent, Prisma } from '../../generated/prisma/client.js';
import { KarmaMonitoringEventKind } from '../../generated/prisma/enums.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import {
  booleanFilter,
  enumFilter,
  enumValue,
  integer,
  invalid,
  optionalDateTime,
  pagination,
  requireScope,
  searchTokens,
  ids,
  text,
} from '../../validation.js';
import { KarmaMonitoringRepository, monitoringDefaults } from './karma-monitoring.repository.js';

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    invalid(path, 'Use true or false.', 'INVALID_TYPE');
  }
  return value;
}
export function monitoringEventResult(row: KarmaMonitoringEvent): FleetKarmaMonitoringEvent {
  return { ...row, rawRecord: row.rawRecord === null ? null : JSON.stringify(row.rawRecord) };
}

@Injectable()
export class KarmaMonitoringService {
  constructor(
    private readonly repository: KarmaMonitoringRepository,
    private readonly core: CoreClient,
    private readonly clock: FleetClock,
  ) {}

  async settings(context: RequestContext) {
    return (await this.repository.settings(requireScope(context))) ?? monitoringDefaults;
  }

  async updateSettings(context: RequestContext, input: UpdateFleetKarmaMonitoringSettingsInput) {
    const scope = requireScope(context);
    const data: UpdateFleetKarmaMonitoringSettingsInput = {
      enabled: boolean(input.enabled, 'enabled'),
      statusPollSeconds: integer(input.statusPollSeconds, 'statusPollSeconds', 30, 3600),
      offlineAfterMinutes: integer(input.offlineAfterMinutes, 'offlineAfterMinutes', 2, 1440),
      faultHistoryPollMinutes: integer(
        input.faultHistoryPollMinutes,
        'faultHistoryPollMinutes',
        5,
        1440,
      ),
      faultCommandEnabled: boolean(input.faultCommandEnabled, 'faultCommandEnabled'),
      faultCommandMinutes: integer(input.faultCommandMinutes, 'faultCommandMinutes', 15, 1440),
      retentionDays: integer(input.retentionDays, 'retentionDays', 1, 30),
    };
    await this.core.requireBranch(scope.branchId, context);
    return this.repository.saveSettings(scope, data);
  }

  async trucks(context: RequestContext, args: QueryFleetKarmaMonitoringTrucksArgs) {
    const scope = requireScope(context);
    const page = pagination(args);
    const criteria = {
      tokens: searchTokens(args.search),
      ids: args.ids == null ? undefined : ids(args.ids, 'ids'),
      online: booleanFilter(args.filter?.online, 'online'),
      withFaults: booleanFilter(args.filter?.withFaults, 'withFaults'),
    };
    const sort = {
      field: enumValue(
        args.sort?.field ?? 'DISPLAY_NAME',
        ['DISPLAY_NAME', 'LAST_DATA_AT'] as const,
        'sort',
      ),
      direction: enumValue(args.sort?.direction ?? 'ASC', ['ASC', 'DESC'] as const, 'sort'),
    };
    const result = await this.repository.listTrucks(scope, page, criteria, sort, this.clock.now());
    return {
      ...page,
      ...result,
      items: result.items.map((truck) => ({
        ...truck,
        faults: truck.faults.map(monitoringEventResult),
        latestFault: truck.latestFault ? monitoringEventResult(truck.latestFault) : null,
      })),
    };
  }

  async events(context: RequestContext, args: QueryFleetKarmaMonitoringEventsArgs) {
    const scope = requireScope(context);
    const page = pagination(args);
    const selected = args.ids == null ? undefined : ids(args.ids, 'ids');
    const tokens = searchTokens(args.search);
    const from = optionalDateTime(args.filter?.from, 'filter');
    const to = optionalDateTime(args.filter?.to, 'filter');
    if (from && to && from > to) {
      invalid('filter', 'Use an ordered time range.', 'INVALID_RANGE');
    }
    const carId =
      args.filter?.karmaCarId == null ? undefined : text(args.filter.karmaCarId, 'filter', 32);
    if (carId && !/^[1-9]\d*$/.test(carId)) {
      invalid('filter', 'Use a Karma car ID.', 'INVALID_FORMAT');
    }
    const kinds = enumFilter(args.filter?.kinds, Object.values(KarmaMonitoringEventKind), 'kinds');
    const where: Prisma.KarmaMonitoringEventWhereInput = {
      ...(selected ? { id: { in: selected } } : {}),
      ...(carId ? { karmaCarId: carId } : {}),
      ...(kinds ? { kind: { in: kinds } } : {}),
      occurredAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) },
      AND: tokens.map((token) => ({
        OR: [
          { karmaCarId: literalContains(token) },
          { code: literalContains(token) },
          { details: literalContains(token) },
        ],
      })),
    };
    const result = await this.repository.listEvents(scope, page, where, this.clock.now());
    return { ...page, ...result, items: result.items.map(monitoringEventResult) };
  }
}
