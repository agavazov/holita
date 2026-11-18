import type {
  FleetEventSeverity,
  FleetProblemSourceKind,
  FleetProblemState,
} from '../../../../generated/graphql/operations';
import { faultDescription, type FleetFaultDiagnostic } from '../../../ui/fleet-live/fault-wording';
import type { Language } from '../../../i18n/messages';
import type { StatusTone } from '../../../theme/status-tones';
import { alertsText } from '../alerts/i18n/messages';
import bg from './problems-bg.json';
import en from './problems-en.json';

export const problemsText = (language: Language): typeof en => (language === 'bg' ? bg : en);

export function problemTitle(
  problem: {
    readonly sourceKind: FleetProblemSourceKind;
    readonly code: string;
    readonly diagnostics?: readonly FleetFaultDiagnostic[];
  },
  language: Language,
): string {
  if (problem.diagnostics?.length) {
    return problem.diagnostics
      .map((diagnostic) => faultDescription(diagnostic, language))
      .join(' · ');
  }
  if (problem.sourceKind === 'FLEET_ALERT') {
    const kind = Object.entries(alertsText(language).kinds).find(([code]) => code === problem.code);
    if (kind) {
      return kind[1];
    }
  }
  return problemsText(language).titles[problem.sourceKind];
}

export const problemSeverityTones: Record<FleetEventSeverity, StatusTone> = {
  CRITICAL: 'danger',
  WARNING: 'warn',
  INFO: 'info',
};

export const problemStateTones: Record<FleetProblemState, StatusTone> = {
  OPEN: 'warn',
  ACKNOWLEDGED: 'info',
  RECORDED: 'neutral',
  FAILED: 'danger',
  UNCERTAIN: 'warn',
  EXPIRED: 'neutral',
};
