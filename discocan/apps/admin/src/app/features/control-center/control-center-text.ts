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

export function returnToDiscoCanError(error: unknown, language: Language): string {
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

/** Translate protocol refusals while keeping the original reason in the audit. */
export function controlCenterReason(reason: string | null | undefined, language: Language): string {
  const text = controlCenterText[language].errors;
  if (!reason) {
    return text.failed;
  }
  if (reason.includes('configuration writes are disabled')) {
    return text.disabled;
  }
  if (reason.includes('Operator role')) {
    return text.readRole;
  }
  if (reason.includes('Engineer role')) {
    return text.writeRole;
  }
  if (reason.includes('restoration') || reason.includes('restore')) {
    return text.restoration;
  }
  if (
    reason.includes('UNCERTAIN') ||
    reason.includes('outcome is unknown') ||
    reason.includes('readback is incomplete') ||
    reason.includes('read the affected parameters') ||
    reason.includes('fresh eData read')
  ) {
    return reason.includes('eData') ? text.freshEdata : text.freshParameters;
  }
  if (reason.includes('primary mode')) {
    return text.primary;
  }
  if (reason.includes('workflow is already running')) {
    return text.running;
  }
  if (reason.includes('queued requests can be cancelled')) {
    return text.cancel;
  }
  if (reason.includes('can be retried')) {
    return text.retry;
  }
  if (reason.includes('writable') || reason.includes('protected parameters')) {
    return text.parameters;
  }
  if (reason.includes('Choose one eData')) {
    return text.edata;
  }
  if (reason.includes('complete parameter snapshot')) {
    return text.snapshot;
  }
  if (reason.includes('interval is unchanged')) {
    return text.unchanged;
  }
  if (
    reason.includes('session changed') ||
    reason.includes('Preflight') ||
    reason.includes('baseline') ||
    reason.includes('TARGET_CHANGED') ||
    reason.includes('ownership or IMEI changed')
  ) {
    return text.changed;
  }
  return text.failed;
}

export function controlCenterError(error: unknown, language: Language, fallback?: string): string {
  const text = controlCenterText[language].errors;
  if (!CombinedGraphQLErrors.is(error)) {
    return fallback ?? text.unavailable;
  }
  const failure = error.errors[0];
  if (!failure) {
    return fallback ?? text.unavailable;
  }
  const reason = controlCenterReason(failure.message, language);
  if (reason !== text.failed) {
    return reason;
  }
  switch (failure.extensions?.['code']) {
    case 'FORBIDDEN':
      return text.forbidden;
    case 'UNAUTHENTICATED':
      return text.session;
    case 'BAD_USER_INPUT':
      return text.invalid;
    case 'NOT_FOUND':
      return text.notFound;
    case 'CONFLICT':
      return text.conflict;
    case 'SERVICE_UNAVAILABLE':
      return text.unavailable;
    default:
      return fallback ?? text.unavailable;
  }
}

export function commandError(error: unknown, language: Language): string {
  return controlCenterError(error, language, controlCenterText[language].queue.unavailable);
}
