import { Injectable } from '@nestjs/common';
import { FleetClock } from '../../clock/fleet-clock.js';
import type {
  FleetProblem,
  FleetProblemCounts,
  FleetProblemDiagnostic,
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
type StoredEvent = StoredSnapshot['events'][number];

function reportIdentity(imei: string | null, sourceId: string): string {
  return JSON.stringify([imei, sourceId]);
}

function diagnosticReport(event: ErmProblemEvidence): number | null {
  if (event.code === 'CAN_DISCONNECTED') {
    return 417;
  }
  const report = /^EDATA_(411|413|417|418|419)$/.exec(event.code);
  return report ? Number(report[1]) : null;
}

function rawDiagnostics(event: ErmProblemEvidence) {
  return event.code === 'CAN_DISCONNECTED' && event.diagnostics.length === 0
    ? [{ kind: 'CAN_DISCONNECTED' as const, troubleCode: null, status: null }]
    : event.diagnostics;
}

function storedDiagnostic(event: StoredEvent): FleetProblemDiagnostic[] {
  if (!['DIAGNOSTIC_TROUBLE_CODE', 'CAN_ERROR', 'CAN_DISCONNECTED'].includes(event.kind)) {
    return [];
  }
  const legacyFault =
    event.kind === 'DIAGNOSTIC_TROUBLE_CODE' && event.details?.startsWith('eData 419:');
  const faultCode = /^SPN (\d+) FMI (\d+)$/.exec(event.troubleCode ?? '');
  return [
    {
      kind: event.kind,
      troubleCode: event.troubleCode,
      status:
        event.diagnosticStatus === 1
          ? 'ADDED'
          : event.diagnosticStatus === 2
            ? 'DELETED'
            : legacyFault
              ? event.details?.includes('logger deleted')
                ? 'DELETED'
                : 'ADDED'
              : null,
      report: event.diagnosticReport ?? (legacyFault ? 419 : null),
      spn:
        event.diagnosticSpn === null
          ? faultCode
            ? Number(faultCode[1])
            : null
          : Number(event.diagnosticSpn),
      fmi: event.diagnosticFmi ?? (faultCode ? Number(faultCode[2]) : null),
      occurredAt: event.occurredAt,
      receivedAt: event.receivedAt,
    },
  ];
}

function diagnosticIdentity(
  imei: string,
  at: Date,
  kind: string,
  troubleCode: string | null,
  status: string | null,
): string {
  return JSON.stringify([imei, at.toISOString(), kind, troubleCode, status]);
}

function importedIdentity(event: StoredEvent): string | null {
  if (event.source !== 'ERM' || event.deviceImei === null || event.alertStatus !== null) {
    return null;
  }
  if (event.kind === 'CAN_ERROR' || event.kind === 'CAN_DISCONNECTED') {
    return diagnosticIdentity(event.deviceImei, event.occurredAt, event.kind, null, null);
  }
  if (
    event.kind === 'DIAGNOSTIC_TROUBLE_CODE' &&
    (event.diagnosticReport !== null || event.details?.startsWith('eData 419:'))
  ) {
    return diagnosticIdentity(
      event.deviceImei,
      event.occurredAt,
      event.kind,
      event.troubleCode,
      storedDiagnostic(event)[0]?.status ?? null,
    );
  }
  return null;
}

function rawIdentities(event: ErmProblemEvidence): string[] {
  const at = event.eventTime ?? event.occurredAt;
  return rawDiagnostics(event).map((diagnostic) =>
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
    const imported = new Map<string, StoredEvent>();
    const importedReports = new Map<string, StoredEvent[]>();
    for (const event of stored.events) {
      const identity = importedIdentity(event);
      if (identity !== null) {
        if (event.sourceEventId === null) {
          imported.set(identity, event);
        } else {
          const key = reportIdentity(event.deviceImei, event.sourceEventId.toString());
          const report = importedReports.get(key) ?? [];
          report.push(event);
          importedReports.set(key, report);
        }
      }
    }
    const rawKeys = new Set(raw.flatMap(rawIdentities));
    const rawReports = new Set(
      raw
        .filter((event) => event.sourceKind === 'DIAGNOSTIC')
        .map((event) => reportIdentity(event.imei, event.sourceId)),
    );
    const items = new Map<string, FleetProblem>();
    const storedReports = new Map<string, FleetProblem>();
    for (const event of stored.events) {
      const identity = importedIdentity(event);
      const reportId =
        identity === null || event.sourceEventId === null
          ? null
          : reportIdentity(event.deviceImei, event.sourceEventId.toString());
      if (
        identity !== null &&
        (reportId === null ? rawKeys.has(identity) : rawReports.has(reportId))
      ) {
        continue;
      }
      const diagnostics = storedDiagnostic(event);
      const existingReport = reportId === null ? undefined : storedReports.get(reportId);
      if (existingReport) {
        existingReport.diagnostics.push(...diagnostics);
        if (
          event.severity === 'CRITICAL' ||
          (event.severity === 'WARNING' && existingReport.severity === 'INFO')
        ) {
          existingReport.severity = event.severity;
        }
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
      const problem: FleetProblem = {
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
        diagnostics,
        vehicleId: event.vehicleId,
        vehicle: event.vehicle,
        deviceId: device?.id ?? null,
        deviceImei: event.deviceImei,
        alertId: event.alertStatus === null ? null : event.id,
        fleetEventId: event.id,
        ermEventId: event.sourceEventId?.toString() ?? null,
        commandRequestId: null,
      };
      items.set(id, problem);
      if (reportId !== null) {
        storedReports.set(reportId, problem);
      }
    }
    for (const evidence of raw) {
      const device = deviceByImei.get(evidence.imei);
      if (!device) {
        continue;
      }
      const reportEvents =
        importedReports.get(reportIdentity(evidence.imei, evidence.sourceId)) ?? [];
      const importedEvent =
        reportEvents[0] ??
        rawIdentities(evidence)
          .map((key) => imported.get(key))
          .find((event) => event !== undefined);
      const diagnostics: FleetProblemDiagnostic[] = rawDiagnostics(evidence).map((diagnostic) => {
        const faultCode = /^SPN (\d+) FMI (\d+)$/.exec(diagnostic.troubleCode ?? '');
        const storedEvent =
          reportEvents.find(
            (event) =>
              event.kind === diagnostic.kind &&
              event.troubleCode === diagnostic.troubleCode &&
              storedDiagnostic(event)[0]?.status === diagnostic.status,
          ) ?? importedEvent;
        return {
          ...diagnostic,
          report: diagnosticReport(evidence) ?? storedEvent?.diagnosticReport ?? null,
          spn: faultCode ? Number(faultCode[1]) : null,
          fmi: faultCode ? Number(faultCode[2]) : null,
          occurredAt: evidence.eventTime ?? evidence.occurredAt,
          receivedAt: storedEvent?.receivedAt ?? null,
        };
      });
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
        diagnostics,
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
        diagnostics: [],
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
