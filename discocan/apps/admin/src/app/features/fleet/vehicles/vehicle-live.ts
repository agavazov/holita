import type { Language } from '../../../i18n/messages';
import { fleetLiveText, type FleetLiveDevice } from '../../../ui/fleet-live/fleet-live';
import type { StatusTone } from '@osnova/ui';

export function vehicleConnectionStatus(
  state: { live: boolean; connected: boolean; reporting: boolean; hasDevices: boolean },
  language: Language,
): { label: string; tone: StatusTone } {
  const text = fleetLiveText(language);
  if (state.live) {
    return { label: text.live, tone: 'success' };
  }
  if (state.connected) {
    return { label: text.connected, tone: 'info' };
  }
  if (state.reporting) {
    return { label: text.reporting, tone: 'info' };
  }
  return state.hasDevices
    ? { label: text.overdue, tone: 'warn' }
    : { label: text.noDevice, tone: 'neutral' };
}

/** A vehicle is live when at least one installed device is connected and reporting. */
export function vehicleLiveStatus(
  devices: readonly FleetLiveDevice[],
  language: Language,
): { label: string; tone: StatusTone } {
  const text = fleetLiveText(language);
  if (!devices.length) {
    return { label: text.noDevice, tone: 'neutral' };
  }
  const states = devices.flatMap((device) => (device?.state ? [device.state] : []));
  if (states.some((state) => state.connected && state.lastReportAt && !state.health.overdue)) {
    return { label: text.live, tone: 'success' };
  }
  if (states.some((state) => state.connected)) {
    return { label: text.connected, tone: 'info' };
  }
  if (states.some((state) => state.lastReportAt && !state.health.overdue)) {
    return { label: text.reporting, tone: 'info' };
  }
  if (states.some((state) => state.lastReportAt && state.health.overdue)) {
    return { label: text.overdue, tone: 'warn' };
  }
  return devices.some((device) => device !== undefined)
    ? { label: text.never, tone: 'neutral' }
    : { label: text.unavailable, tone: 'neutral' };
}

export function vehicleLastReport(devices: readonly FleetLiveDevice[]): string | null {
  const reports = devices
    .map((device) => device?.state?.lastReportAt ?? device?.lastReportedAt)
    .filter((value): value is string => !!value);
  return reports.sort().at(-1) ?? null;
}

/** Latest recorded activity among installed devices, independent of their socket traffic. */
export function vehicleLiveDevice(devices: readonly FleetLiveDevice[]): FleetLiveDevice {
  return [...devices].sort((left, right) =>
    (right?.state?.latestEvent?.recordedAt ?? '').localeCompare(
      left?.state?.latestEvent?.recordedAt ?? '',
    ),
  )[0];
}
