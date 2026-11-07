import type {
  AdminFaultDiagnosticFragment,
  AdminWarningLampFragment,
} from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import type { StatusTone } from '../tones';
import bg from './faults-bg.json';
import en from './faults-en.json';

export type FleetFaultDiagnostic = AdminFaultDiagnosticFragment;
export type FleetWarning = AdminWarningLampFragment;

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
