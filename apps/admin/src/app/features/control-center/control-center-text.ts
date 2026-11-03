import type { ErmEventSeverity, ErmLanguage } from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import { toneSeverity } from '../../ui/tones';
import bg from './bg.json';
import en from './en.json';

export const controlCenterText: Record<Language, typeof en> = { bg, en };

export function ermLanguage(language: Language): ErmLanguage {
  return language === 'bg' ? 'BG' : 'EN';
}

/** ERM timestamps are shown in the fleet's local time. */
export const fleetTimeZone = 'Europe/Sofia';

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
