import type {
  AdminFaultCheckFragment,
  AdminFaultDiagnosticFragment,
  AdminFaultReadFragment,
  AdminFreezeFrameFragment,
  AdminWarningLampFragment,
  FleetEventSeverity,
  FleetFaultSystem,
} from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import { formatNumber } from '../format/format';
import { interpolate } from '../i18n/messages';
import type { StatusTone } from '../tones';
import bg from './faults-bg.json';
import en from './faults-en.json';

export type FleetFaultDiagnostic = AdminFaultDiagnosticFragment;
export type FleetWarning = AdminWarningLampFragment;
export type FleetFaultCheck = AdminFaultCheckFragment;
export type FleetFaultFinding = FleetFaultCheck['findings'][number];
export type FleetFaultRead = AdminFaultReadFragment;
export type FleetFreezeFrame = AdminFreezeFrameFragment;

/** Dashboard order of the fault lamps. */
export const faultSystems: readonly FleetFaultSystem[] = [
  'ENGINE',
  'BRAKES',
  'ABS_EBS',
  'AFTERTREATMENT',
  'CAN_BUS',
  'POWER',
  'OTHER',
];

export function severityTone(severity: FleetEventSeverity): StatusTone {
  return severity === 'CRITICAL' ? 'danger' : severity === 'WARNING' ? 'warn' : 'info';
}

const severityRank: Record<FleetEventSeverity, number> = { INFO: 0, WARNING: 1, CRITICAL: 2 };

/** The worst severity among the findings, or null without findings. */
export function worstSeverity(
  findings: readonly Pick<FleetFaultFinding, 'severity'>[],
): FleetEventSeverity | null {
  return findings.reduce<FleetEventSeverity | null>(
    (worst, finding) =>
      worst === null || severityRank[finding.severity] > severityRank[worst]
        ? finding.severity
        : worst,
    null,
  );
}

/** The worst severity per lit system, in dashboard order. */
export function litSystems(
  findings: readonly Pick<FleetFaultFinding, 'system' | 'severity'>[],
): { system: FleetFaultSystem; severity: FleetEventSeverity }[] {
  return faultSystems.flatMap((system) => {
    const severity = findings
      .filter((finding) => finding.system === system)
      .map((finding) => finding.severity)
      .sort((left, right) => severityRank[right] - severityRank[left])[0];
    return severity ? [{ system, severity }] : [];
  });
}

/** Check findings with the lamp findings replaced by the lamps reported since the check. */
export function withCurrentLamps(
  findings: readonly FleetFaultFinding[],
  lamps: readonly FleetWarning[],
): FleetFaultFinding[] {
  return [
    ...lamps.flatMap((lamp): FleetFaultFinding[] => {
      const lastSeenAt = lamp.recordedAt;
      return lastSeenAt
        ? [
            {
              system: warningLampSystem(lamp.parameterId),
              severity:
                lamp.state === 'RED' ? 'CRITICAL' : lamp.state === 'YELLOW' ? 'WARNING' : 'INFO',
              source: 'WARNING_LAMP',
              code: null,
              spn: null,
              fmi: null,
              descriptionKey: null,
              parameterId: lamp.parameterId,
              lampState: lamp.state,
              value: null,
              since: lamp.stateSince ?? lastSeenAt,
              lastSeenAt,
              occurrences: 1,
            },
          ]
        : [];
    }),
    ...findings.filter((finding) => finding.source !== 'WARNING_LAMP'),
  ].sort(
    (left, right) =>
      severityRank[right.severity] - severityRank[left.severity] ||
      faultSystems.indexOf(left.system) - faultSystems.indexOf(right.system),
  );
}

/** What the finding is, in the user's words. */
export function findingTitle(finding: FleetFaultFinding, language: Language): string {
  const text = faultsText(language);
  switch (finding.source) {
    case 'WARNING_LAMP':
      return interpolate(text.scanner.lampOn, {
        lamp: warningLampLabel(finding.parameterId ?? 0, language),
        state: finding.lampState ? text.states[finding.lampState] : '—',
      });
    case 'CAN_REPORT':
      return finding.code === 'CAN_ERROR' ? text.canError : text.canLoss;
    case 'VOLTAGE':
      return interpolate(text.scanner.lowVoltage, {
        value: `${formatNumber(finding.value ?? null, language, { fraction: 1 })}\u00a0V`,
      });
    default: {
      const description = Object.entries(text.spn).find(
        ([key]) => `faults.spn.${key}` === finding.descriptionKey,
      )?.[1];
      return (
        description ??
        (finding.spn === null ? (finding.code ?? text.recordedFault) : `SPN ${String(finding.spn)}`)
      );
    }
  }
}

/** The trouble code as a mechanic reads it, or null when the finding has none. */
export function findingCode(finding: FleetFaultFinding): string | null {
  if (finding.spn !== null) {
    return `SPN ${String(finding.spn)} / FMI ${finding.fmi === null ? '—' : String(finding.fmi)}`;
  }
  return finding.source === 'FAULT_LOGGER' || finding.source === 'ALERT'
    ? (finding.code ?? null)
    : null;
}

/** The newest fault-logger read among a device's command requests. */
export function latestFaultRead(reads: readonly FleetFaultRead[]): FleetFaultRead | null {
  return (
    reads
      .filter((read) => read.action === 'READ_EDATA_FAULTS')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  );
}

export const faultsText = (language: Language): typeof en => (language === 'bg' ? bg : en);

export function faultSystem(system: FleetFaultDiagnostic['systemKey'], language: Language): string {
  return faultsText(language).systems[system];
}

export function faultFmi(fmi: number | null, language: Language): string {
  if (fmi === null) {
    return '—';
  }
  return (
    Object.entries(faultsText(language).fmi).find(([key]) => key === String(fmi))?.[1] ??
    faultsText(language).unknownFmi
  );
}

export function faultDescription(diagnostic: FleetFaultDiagnostic, language: Language): string {
  const text = faultsText(language);
  const description = Object.entries(text.spn).find(
    ([key]) => `faults.spn.${key}` === diagnostic.descriptionKey,
  )?.[1];
  if (description) {
    return description;
  }
  if (diagnostic.spn !== null) {
    return `SPN ${String(diagnostic.spn)}${diagnostic.fmi === null ? '' : ` / FMI ${String(diagnostic.fmi)}`}`;
  }
  if (diagnostic.kind === 'CAN_DISCONNECTED') {
    return text.canLoss;
  }
  if (diagnostic.kind === 'CAN_ERROR') {
    return text.canError;
  }
  return diagnostic.troubleCode ?? text.recordedFault;
}

export function warningLampLabel(parameterId: number, language: Language): string {
  const lamps = faultsText(language).lamps;
  return parameterId === 1896
    ? lamps.BRAKE_SYSTEM
    : parameterId === 1906
      ? lamps.ENGINE
      : parameterId === 1910
        ? lamps.ABS
        : '—';
}

export function warningLampSystem(parameterId: number): FleetFaultDiagnostic['systemKey'] {
  return parameterId === 1896
    ? 'BRAKES'
    : parameterId === 1906
      ? 'ENGINE'
      : parameterId === 1910
        ? 'ABS_EBS'
        : 'OTHER';
}

export function warningStateLabel(state: FleetWarning['state'], language: Language): string {
  return faultsText(language).states[state];
}

export function warningTone(state: FleetWarning['state']): StatusTone {
  return state === 'RED'
    ? 'danger'
    : state === 'YELLOW'
      ? 'warn'
      : state === 'INFORMATION'
        ? 'info'
        : 'neutral';
}
