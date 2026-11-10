import type {
  FleetEventSeverity,
  FleetFaultCheck,
  FleetFaultFinding,
  FleetFaultFindingSource,
  FleetFaultSystem,
  FleetWarningLamp,
  FleetWarningLampState,
} from '../../generated/graphql/types.js';
import type { FleetAlertStatus, FleetEventKind } from '../../generated/prisma/enums.js';
import { faultMeaning } from '../events/fault-meanings.js';

export type FaultEvidenceEvent = {
  deviceImei: string | null;
  kind: FleetEventKind;
  severity: FleetEventSeverity;
  occurredAt: Date;
  troubleCode: string | null;
  diagnosticReport: number | null;
  diagnosticStatus: number | null;
  diagnosticSpn: bigint | null;
  diagnosticFmi: number | null;
  details: string | null;
  alertStatus: FleetAlertStatus | null;
};

export type FaultCheckEvidence = {
  /** Every trouble-code event of the vehicle, oldest first. */
  faults: readonly FaultEvidenceEvent[];
  /** CAN loss and CAN error events within the last 24 hours. */
  can: readonly Pick<FaultEvidenceEvent, 'kind' | 'occurredAt'>[];
  /** The last three supply-voltage samples within six hours, newest first. */
  voltages: readonly { value: number; recordedAt: Date }[];
  /** Highest supply voltage within seven days; tells a 24 V system from a 12 V one. */
  peakVoltage: number | null;
  dataAsOf: Date | null;
};

const LAMP_SYSTEMS = new Map<number, FleetFaultSystem>([
  [1896, 'BRAKES'],
  [1906, 'ENGINE'],
  [1910, 'ABS_EBS'],
]);
const SEVERITIES: readonly FleetEventSeverity[] = ['CRITICAL', 'WARNING', 'INFO'];
const SYSTEMS: readonly FleetFaultSystem[] = [
  'BRAKES',
  'ABS_EBS',
  'ENGINE',
  'AFTERTREATMENT',
  'CAN_BUS',
  'POWER',
  'OTHER',
];
const SOURCES: readonly FleetFaultFindingSource[] = [
  'WARNING_LAMP',
  'FAULT_LOGGER',
  'ALERT',
  'CAN_REPORT',
  'VOLTAGE',
];
const LAMP_STATES: readonly FleetWarningLampState[] = [
  'UNKNOWN',
  'OFF',
  'RED',
  'YELLOW',
  'INFORMATION',
  'NOT_AVAILABLE',
  'RESERVED',
];
// 24 V systems charge at about 28 V; 12 V systems never reach 20 V.
const SYSTEM_24V_PEAK = 20;
const LOW_VOLTAGE_24V = 23;
const LOW_VOLTAGE_12V = 11.5;

function loggerStatus(event: FaultEvidenceEvent): 'ADDED' | 'DELETED' | null {
  if (event.diagnosticStatus === 1 || event.diagnosticStatus === 2) {
    return event.diagnosticStatus === 1 ? 'ADDED' : 'DELETED';
  }
  if (event.details?.startsWith('eData 419:')) {
    return event.details.includes('logger deleted') ? 'DELETED' : 'ADDED';
  }
  return null;
}

function finding(
  values: Pick<FleetFaultFinding, 'system' | 'severity' | 'source' | 'since' | 'lastSeenAt'> &
    Partial<FleetFaultFinding>,
): FleetFaultFinding {
  return {
    code: null,
    spn: null,
    fmi: null,
    descriptionKey: null,
    parameterId: null,
    lampState: null,
    value: null,
    occurrences: 1,
    ...values,
  };
}

function codeFinding(
  event: FaultEvidenceEvent,
  source: FleetFaultFindingSource,
  since: Date,
  occurrences: number,
): FleetFaultFinding {
  const parsed = /^SPN (\d+) FMI (\d+)$/.exec(event.troubleCode ?? '');
  const spn =
    event.diagnosticSpn === null
      ? parsed
        ? Number(parsed[1])
        : null
      : Number(event.diagnosticSpn);
  const meaning = faultMeaning(spn);
  return finding({
    system: meaning.systemKey,
    severity: source === 'ALERT' ? event.severity : 'WARNING',
    source,
    code: event.troubleCode,
    spn,
    fmi: event.diagnosticFmi ?? (parsed ? Number(parsed[2]) : null),
    descriptionKey: meaning.descriptionKey,
    since,
    lastSeenAt: event.occurredAt,
    occurrences,
  });
}

/** Current faults of one vehicle from its lamps and the evidence Fleet already holds. */
export function faultFindings(
  lamps: readonly Pick<FleetWarningLamp, 'parameterId' | 'state' | 'recordedAt' | 'stateSince'>[],
  evidence: FaultCheckEvidence,
): FleetFaultFinding[] {
  const findings: FleetFaultFinding[] = [];
  for (const lamp of lamps) {
    const lastSeenAt = lamp.recordedAt;
    if (lastSeenAt == null) {
      continue;
    }
    findings.push(
      finding({
        system: LAMP_SYSTEMS.get(lamp.parameterId) ?? 'OTHER',
        severity: lamp.state === 'RED' ? 'CRITICAL' : lamp.state === 'YELLOW' ? 'WARNING' : 'INFO',
        source: 'WARNING_LAMP',
        parameterId: lamp.parameterId,
        lampState: lamp.state,
        since: lamp.stateSince ?? lastSeenAt,
        lastSeenAt,
      }),
    );
  }

  // The newest logger report of a code decides; an episode starts at its first ADDED report.
  const codes = new Map<string, { event: FaultEvidenceEvent; since: Date; count: number }>();
  const alerts = new Map<string, { event: FaultEvidenceEvent; since: Date; count: number }>();
  for (const event of evidence.faults) {
    const report = event.diagnosticReport ?? (event.details?.startsWith('eData 419:') ? 419 : null);
    const key = JSON.stringify([event.deviceImei, report, event.troubleCode]);
    const status = loggerStatus(event);
    if (status === 'DELETED') {
      codes.delete(key);
    } else if (status === 'ADDED') {
      const current = codes.get(key);
      codes.set(key, {
        event,
        since: current?.since ?? event.occurredAt,
        count: (current?.count ?? 0) + 1,
      });
    } else if (event.alertStatus === 'OPEN' || event.alertStatus === 'ACKNOWLEDGED') {
      const current = alerts.get(key);
      alerts.set(key, {
        event,
        since: current?.since ?? event.occurredAt,
        count: (current?.count ?? 0) + 1,
      });
    }
  }
  for (const { event, since, count } of codes.values()) {
    findings.push(codeFinding(event, 'FAULT_LOGGER', since, count));
  }
  for (const { event, since, count } of alerts.values()) {
    findings.push(codeFinding(event, 'ALERT', since, count));
  }

  for (const kind of ['CAN_DISCONNECTED', 'CAN_ERROR'] as const) {
    const times = evidence.can
      .filter((event) => event.kind === kind)
      .map((event) => event.occurredAt.getTime());
    if (times.length) {
      findings.push(
        finding({
          system: 'CAN_BUS',
          severity: 'WARNING',
          source: 'CAN_REPORT',
          code: kind,
          since: new Date(Math.min(...times)),
          lastSeenAt: new Date(Math.max(...times)),
          occurrences: times.length,
        }),
      );
    }
  }

  const [latest] = evidence.voltages;
  const oldest = evidence.voltages.at(-1);
  if (latest && oldest && evidence.voltages.length === 3 && evidence.peakVoltage !== null) {
    const limit = evidence.peakVoltage >= SYSTEM_24V_PEAK ? LOW_VOLTAGE_24V : LOW_VOLTAGE_12V;
    if (evidence.voltages.every((sample) => sample.value < limit)) {
      findings.push(
        finding({
          system: 'POWER',
          severity: 'WARNING',
          source: 'VOLTAGE',
          value: latest.value,
          since: oldest.recordedAt,
          lastSeenAt: latest.recordedAt,
          occurrences: evidence.voltages.length,
        }),
      );
    }
  }

  return findings.sort(
    (left, right) =>
      SEVERITIES.indexOf(left.severity) - SEVERITIES.indexOf(right.severity) ||
      SYSTEMS.indexOf(left.system) - SYSTEMS.indexOf(right.system) ||
      right.lastSeenAt.getTime() - left.lastSeenAt.getTime(),
  );
}

/** The JSON stored in vehicleFaultCheck.findings. */
export function findingsJson(findings: readonly FleetFaultFinding[]) {
  return findings.map((item) => ({
    system: item.system,
    severity: item.severity,
    source: item.source,
    code: item.code ?? null,
    spn: item.spn ?? null,
    fmi: item.fmi ?? null,
    descriptionKey: item.descriptionKey ?? null,
    parameterId: item.parameterId ?? null,
    lampState: item.lampState ?? null,
    value: item.value ?? null,
    since: item.since.toISOString(),
    lastSeenAt: item.lastSeenAt.toISOString(),
    occurrences: item.occurrences,
  }));
}

function oneOf<T extends string>(values: readonly T[], value: unknown): T | undefined {
  return values.find((item) => item === value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function instant(value: unknown): Date | null {
  const date = typeof value === 'string' ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/** Reads stored findings back; items that do not match the written shape are skipped. */
export function storedFaultCheck(row: {
  checkedAt: Date;
  dataAsOf: Date | null;
  findings: unknown;
}): FleetFaultCheck {
  const items: readonly unknown[] = Array.isArray(row.findings) ? row.findings : [];
  const findings: FleetFaultFinding[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const value = new Map(Object.entries(item));
    const system = oneOf(SYSTEMS, value.get('system'));
    const severity = oneOf(SEVERITIES, value.get('severity'));
    const source = oneOf(SOURCES, value.get('source'));
    const since = instant(value.get('since'));
    const lastSeenAt = instant(value.get('lastSeenAt'));
    if (!system || !severity || !source || !since || !lastSeenAt) {
      continue;
    }
    findings.push({
      system,
      severity,
      source,
      code: text(value.get('code')),
      spn: numeric(value.get('spn')),
      fmi: numeric(value.get('fmi')),
      descriptionKey: text(value.get('descriptionKey')),
      parameterId: numeric(value.get('parameterId')),
      lampState: oneOf(LAMP_STATES, value.get('lampState')) ?? null,
      value: numeric(value.get('value')),
      since,
      lastSeenAt,
      occurrences: numeric(value.get('occurrences')) ?? 1,
    });
  }
  return { checkedAt: row.checkedAt, dataAsOf: row.dataAsOf, findings };
}
