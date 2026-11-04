import type { ErmEventSeverity, ErmLanguage } from '../../../generated/graphql/operations';
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

/** Fleet's Karma monitoring truck of each IMEI (Karma's device ID is the unit's IMEI). */
export function karmaByImei<T extends { readonly karmaDeviceId: string }>(page: {
  readonly items: readonly T[];
}): ReadonlyMap<string, T> {
  return new Map(page.items.map((truck) => [truck.karmaDeviceId, truck]));
}
