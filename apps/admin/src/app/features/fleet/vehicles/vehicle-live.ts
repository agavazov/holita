import type { Language } from '../../../i18n/messages';
import { fleetLiveText, type FleetLiveDevice } from '../../../ui/fleet-live/fleet-live';
import type { StatusTone } from '../../../ui/tones';

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
  const states = devices.flatMap((device) => (device?.ermState ? [device.ermState] : []));
  if (states.some((state) => state.online && state.lastFrameAt && !state.health.overdue)) {
    return { label: text.live, tone: 'success' };
  }
  if (states.some((state) => state.online)) {
    return { label: text.connected, tone: 'info' };
  }
  if (states.some((state) => state.lastFrameAt && !state.health.overdue)) {
    return { label: text.reporting, tone: 'info' };
  }
  if (states.some((state) => state.lastFrameAt && state.health.overdue)) {
    return { label: text.overdue, tone: 'warn' };
  }
  return devices.some((device) => device !== undefined)
    ? { label: text.never, tone: 'neutral' }
    : { label: text.unavailable, tone: 'neutral' };
}

export function vehicleLastReport(devices: readonly FleetLiveDevice[]): string | null {
  const reports = devices
    .map((device) => device?.ermState?.lastFrameAt ?? device?.lastReportedAt)
    .filter((value): value is string => !!value);
  return reports.sort().at(-1) ?? null;
}

/** One compact activity cell; the vehicle profile retains the installed-device details. */
export function vehicleLiveDevice(devices: readonly FleetLiveDevice[]): FleetLiveDevice {
  const rank = (device: FleetLiveDevice): number => {
    const state = device?.ermState;
    return state?.online && state.lastFrameAt && !state.health.overdue
      ? 3
      : state?.online
        ? 2
        : state?.lastFrameAt && !state.health.overdue
          ? 1
          : 0;
  };
  return [...devices].sort(
    (left, right) =>
      rank(right) - rank(left) ||
      (right?.ermState?.latestEvent?.eventTime ?? '').localeCompare(
        left?.ermState?.latestEvent?.eventTime ?? '',
      ),
  )[0];
}
