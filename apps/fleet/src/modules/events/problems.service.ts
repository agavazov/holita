import { Injectable } from '@nestjs/common';
import { FleetClock } from '../../clock/fleet-clock.js';
import type {
  FleetProblem,
  FleetProblemCounts,
  FleetProblemPage,
  FleetProblemSourceKind,
  FleetProblemState,
  QueryFleetProblemsArgs,
} from '../../generated/graphql/types.js';
import type { FleetEventSeverity } from '../../generated/prisma/enums.js';
import type { RequestContext } from '../../graphql/request-context.js';
import {
  ErmDashboardClient,
  type ErmDashboardTelemetry,
  type ErmProblemEvidence,
} from '../../integrations/erm/erm-dashboard.client.js';
import {
  booleanFilter,
  dateTimeRange,
  enumFilter,
  type FleetScope,
  idList,
  invalid,
  pagination,
  requireScope,
} from '../../validation.js';
import { ProblemsRepository } from './problems.repository.js';

const SOURCES: readonly FleetProblemSourceKind[] = [
  'FLEET_ALERT',
  'DIAGNOSTIC',
  'ALARM',
  'REPORTING_GAP',
  'COMMAND',
];
const SEVERITIES: readonly FleetEventSeverity[] = ['INFO', 'WARNING', 'CRITICAL'];
const STATES: readonly FleetProblemState[] = [
  'OPEN',
  'ACKNOWLEDGED',
  'RECORDED',
  'FAILED',
  'UNCERTAIN',
  'EXPIRED',
];
type ProblemPeriod = { from: Date; to: Date };
type StoredSnapshot = Awaited<ReturnType<ProblemsRepository['snapshot']>>;

function diagnosticIdentity(
  imei: string,
  at: Date,
  kind: string,
  troubleCode: string | null,
  status: string | null,
): string {
  return JSON.stringify([imei, at.toISOString(), kind, troubleCode, status]);
}

function importedIdentity(event: StoredSnapshot['events'][number]): string | null {
  if (event.source !== 'ERM' || event.deviceImei === null || event.alertStatus !== null) {
    return null;
  }
  if (event.kind === 'CAN_ERROR') {
    return diagnosticIdentity(event.deviceImei, event.occurredAt, event.kind, null, null);
  }
  if (event.kind === 'DIAGNOSTIC_TROUBLE_CODE' && event.details?.startsWith('eData 419:')) {
    return diagnosticIdentity(
      event.deviceImei,
      event.occurredAt,
      event.kind,
      event.troubleCode,
      event.details.includes('logger deleted') ? 'DELETED' : 'ADDED',
    );
  }
  return null;
}

function rawIdentities(event: ErmProblemEvidence): string[] {
  if (event.eventTime === null) {
    return [];
  }
  const at = event.eventTime;
  return event.diagnostics.map((diagnostic) =>
    diagnosticIdentity(event.imei, at, diagnostic.kind, diagnostic.troubleCode, diagnostic.status),
  );
}

function counts(
  items: FleetProblem[],
  asOf: Date,
  dataAsOf: Date | null,
  ermAsOf: Date | null,
  period: ProblemPeriod,
): FleetProblemCounts {
  const totals = (rows: FleetProblem[]) => ({
    total: rows.length,
    requiringAttention: rows.filter((row) => row.requiringAttention).length,
    recorded: rows.filter((row) => row.state === 'RECORDED').length,
  });
  return {
    asOf,
    dataAsOf,
    ermAsOf,
    periodFrom: period.from,
    periodTo: period.to,
    ...totals(items),
    bySeverity: SEVERITIES.map((severity) => ({
      severity,
      ...totals(items.filter((row) => row.severity === severity)),
    })),
    bySource: SOURCES.map((sourceKind) => ({
      sourceKind,
      ...totals(items.filter((row) => row.sourceKind === sourceKind)),
    })),
  };
}

@Injectable()
export class ProblemsService {
  constructor(
    private readonly problems: ProblemsRepository,
    private readonly erm: ErmDashboardClient,
    private readonly clock: FleetClock,
  ) {}

  async list(context: RequestContext, args: QueryFleetProblemsArgs): Promise<FleetProblemPage> {
    const scope = requireScope(context);
    const page = pagination(args);
    const filter = args.filter;
    const sourceKinds = enumFilter(filter?.sourceKinds, SOURCES, 'sourceKinds');
    const severities = enumFilter(filter?.severities, SEVERITIES, 'severities');
    const states = enumFilter(filter?.states, STATES, 'states');
    const vehicleIds = idList(filter?.vehicleIds, 'vehicleIds');
    const deviceIds = idList(filter?.deviceIds, 'deviceIds');
    const requiringAttention = booleanFilter(filter?.requiringAttention, 'requiringAttention');
    const range = dateTimeRange(filter?.occurredFrom, filter?.occurredTo, {
      from: 'occurredFrom',
      to: 'occurredTo',
    });
    const asOf = this.clock.now();
    const to = range.to ?? asOf;
    const from = range.from ?? new Date(to.getTime() - 86_400_000);
    if (from >= to) {
      invalid('filter', 'filter.occurredTo must be after filter.occurredFrom.', 'INVALID_RANGE');
    }
    if (to.getTime() - from.getTime() > 93 * 86_400_000) {
      invalid('filter', 'Choose an evidence period of at most 93 days.', 'BOUNDED_PERIOD_REQUIRED');
    }
    const period = { from, to };
    const snapshot = await this.snapshot(scope, period, asOf);
    const items = snapshot.items.filter(
      (row) =>
        (sourceKinds === undefined || sourceKinds.includes(row.sourceKind)) &&
        (severities === undefined || severities.includes(row.severity)) &&
        (states === undefined || states.includes(row.state)) &&
        (vehicleIds === undefined ||
          (row.vehicleId != null && vehicleIds.includes(row.vehicleId))) &&
        (deviceIds === undefined || (row.deviceId != null && deviceIds.includes(row.deviceId))) &&
        (requiringAttention === undefined || row.requiringAttention === requiringAttention),
    );
    return {
      ...page,
      items: items.slice(page.offset, page.offset + page.limit),
      total: items.length,
      counts: counts(items, asOf, snapshot.dataAsOf, snapshot.ermAsOf, period),
    };
  }

  async summary(
    context: RequestContext,
    period: ProblemPeriod,
    telemetry?: ErmDashboardTelemetry,
  ): Promise<FleetProblemCounts> {
    const asOf = this.clock.now();
    const snapshot = await this.snapshot(requireScope(context), period, asOf, telemetry);
    return counts(snapshot.items, asOf, snapshot.dataAsOf, snapshot.ermAsOf, period);
  }

  private async snapshot(
    scope: FleetScope,
    period: ProblemPeriod,
    asOf: Date,
    suppliedTelemetry?: ErmDashboardTelemetry,
  ) {
    const stored = await this.problems.snapshot(scope, period);
    const imeis = stored.devices.map((device) => device.imei);
    const telemetry = imeis.length
      ? (suppliedTelemetry ?? (await this.erm.telemetry(imeis)))
      : null;
    const raw: ErmProblemEvidence[] = [];
    let ermAsOf: Date | null = telemetry?.asOf ?? null;
    for (let start = 0; start < imeis.length; start += 500) {
      const batch = imeis.slice(start, start + 500);
      let offset = 0;
      for (;;) {
        const page = await this.erm.problems(scope, batch, period, { offset, limit: 500 });
        raw.push(...page.items);
        if (ermAsOf === null || page.asOf < ermAsOf) {
          ermAsOf = page.asOf;
        }
        if (!page.hasMore) {
          break;
        }
        offset += page.items.length;
      }
    }

    const deviceByImei = new Map(stored.devices.map((device) => [device.imei, device]));
    const imported = new Map<string, StoredSnapshot['events'][number]>();
    for (const event of stored.events) {
      const identity = importedIdentity(event);
      if (identity !== null) {
        imported.set(identity, event);
      }
    }
    const rawKeys = new Set(raw.flatMap(rawIdentities));
    const items = new Map<string, FleetProblem>();
    for (const event of stored.events) {
      const identity = importedIdentity(event);
      if (identity !== null && rawKeys.has(identity)) {
        continue;
      }
      const sourceKind =
        event.alertStatus !== null
          ? 'FLEET_ALERT'
          : ['DIAGNOSTIC_TROUBLE_CODE', 'CAN_ERROR', 'CAN_DISCONNECTED'].includes(event.kind)
            ? 'DIAGNOSTIC'
            : 'ALARM';
      const sourceId = `fleet:${event.id}`;
      const id = `${sourceKind}:${sourceId}`;
      const device = event.deviceImei === null ? undefined : deviceByImei.get(event.deviceImei);
      items.set(id, {
        id,
        sourceKind,
        sourceId,
        severity: event.severity,
        occurredAt: event.occurredAt,
        state:
          event.alertStatus === 'ACKNOWLEDGED'
            ? 'ACKNOWLEDGED'
            : event.alertStatus === 'OPEN'
              ? 'OPEN'
              : 'RECORDED',
        requiringAttention: event.alertStatus !== null,
        code: event.kind,
        details: event.details,
        vehicleId: event.vehicleId,
        vehicle: event.vehicle,
        deviceId: device?.id ?? null,
        deviceImei: event.deviceImei,
        alertId: event.alertStatus === null ? null : event.id,
        fleetEventId: event.id,
        ermEventId: null,
        commandRequestId: null,
      });
    }
    for (const evidence of raw) {
      const device = deviceByImei.get(evidence.imei);
      if (!device) {
        continue;
      }
      const importedEvent = rawIdentities(evidence)
        .map((key) => imported.get(key))
        .find((event) => event !== undefined);
      const currentTarget = evidence.sourceKind !== 'COMMAND' || device.id === evidence.deviceId;
      const id = `${evidence.sourceKind}:${evidence.sourceId}`;
      items.set(id, {
        id,
        sourceKind: evidence.sourceKind,
        sourceId: evidence.sourceId,
        severity: evidence.severity,
        occurredAt: evidence.occurredAt,
        state: evidence.state,
        requiringAttention: evidence.sourceKind === 'COMMAND',
        code: evidence.code,
        details: evidence.details,
        vehicleId: importedEvent?.vehicleId ?? (currentTarget ? device.vehicleId : null),
        vehicle: importedEvent?.vehicle ?? (currentTarget ? device.vehicle : null),
        deviceId: evidence.sourceKind === 'COMMAND' ? evidence.deviceId : device.id,
        deviceImei: device.imei,
        alertId: null,
        fleetEventId: importedEvent?.id ?? null,
        ermEventId: evidence.sourceKind === 'COMMAND' ? null : evidence.sourceId,
        commandRequestId: evidence.sourceKind === 'COMMAND' ? evidence.sourceId : null,
      });
    }
    for (const unit of telemetry?.units ?? []) {
      const device = deviceByImei.get(unit.imei);
      if (!device || unit.lastFrameAt === null || unit.reporting) {
        continue;
      }
      const occurredAt = new Date(
        unit.lastFrameAt.getTime() + 2 * unit.expectedIntervalSeconds * 1000,
      );
      const sourceId = `${device.id}:${unit.lastFrameAt.toISOString()}`;
      const id = `REPORTING_GAP:${sourceId}`;
      items.set(id, {
        id,
        sourceKind: 'REPORTING_GAP',
        sourceId,
        severity: 'WARNING',
        occurredAt,
        state: 'OPEN',
        requiringAttention: true,
        code: 'EXPECTED_FRAME_OVERDUE',
        details: null,
        vehicleId: device.vehicleId,
        vehicle: device.vehicle,
        deviceId: device.id,
        deviceImei: device.imei,
        alertId: null,
        fleetEventId: null,
        ermEventId: null,
        commandRequestId: null,
      });
    }
    return {
      items: [...items.values()].sort(
        (left, right) =>
          right.occurredAt.getTime() - left.occurredAt.getTime() || left.id.localeCompare(right.id),
      ),
      dataAsOf: stored.dataAsOf,
      ermAsOf,
      asOf,
    };
  }
}
