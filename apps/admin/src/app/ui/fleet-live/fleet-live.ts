import type { AdminFleetLiveDeviceFragment } from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import en from './en.json';
import bg from './bg.json';

/** Null means no installed device; undefined means the live request is unavailable. */
export type FleetLiveDevice = AdminFleetLiveDeviceFragment | null | undefined;
export type FleetLiveMode = 'table' | 'record';
const catalogs: Record<Language, typeof en> = { en, bg };
export function fleetLiveText(language: Language) {
  return catalogs[language];
}
/** Recorded DTC/CAN faults or a critical unit alarm; WARNING diagnostic reports (event 02) alone are not faults. */
export function hasFleetFaults(device: FleetLiveDevice): boolean {
  return (
    !!device &&
    (device.diagnostics.count > 0 || device.ermState?.latestAlarm?.severity === 'CRITICAL')
  );
}

/** Stable close reasons translated for both compact lists and the Device profile. */
export function fleetCloseReason(value: string | null | undefined, language: Language): string {
  if (!value) {
    return '—';
  }
  const text = fleetLiveText(language);
  if (value.startsWith('device error:')) {
    return text.deviceError;
  }
  if (value.startsWith('upstream error:')) {
    return text.upstreamError;
  }
  const reasons: Readonly<Record<string, string>> = text.closeReasons;
  return reasons[value] ?? value;
}
