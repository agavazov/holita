import type { ErmEventSeverity, ErmLanguage } from '../../../generated/graphql/operations';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { Language } from '../../i18n/messages';
import { toneSeverity } from '../../ui/tones';
import bg from './bg.json';
import en from './en.json';

export const controlCenterText: Record<Language, typeof en> = { bg, en };

export function ermLanguage(language: Language): ErmLanguage {
  return language === 'bg' ? 'BG' : 'EN';
}

export function severityTone(severity: ErmEventSeverity) {
  return toneSeverity(
    severity === 'CRITICAL' ? 'danger' : severity === 'WARNING' ? 'warn' : 'info',
  );
}

export function deviceLabel(device: {
  readonly imei: string;
  readonly vehicle?: { readonly licensePlate: string } | null;
}): string {
  return device.vehicle?.licensePlate ?? device.imei;
}

export function returnToHolitaError(error: unknown, language: Language): string {
  const text = controlCenterText[language].deviceStatus;
  const code = CombinedGraphQLErrors.is(error) ? error.errors[0]?.extensions?.['code'] : null;
  switch (code) {
    case 'FORBIDDEN':
      return text.returnEngineer;
    case 'UNAUTHENTICATED':
      return text.returnSession;
    case 'CONFLICT':
      return text.returnConflict;
    case 'SERVICE_UNAVAILABLE':
      return text.returnUnavailable;
    default:
      return text.returnUnconfirmed;
  }
}
