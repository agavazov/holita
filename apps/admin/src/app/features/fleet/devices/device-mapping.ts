import type { Language } from '../../../i18n/messages';
import type {
  AdminDeviceDetailsFragment,
  AdminDevicesLiveQuery,
  CreateFleetDeviceInput,
} from '../../../../generated/graphql/operations';
import { fleetFieldErrors } from '../field-errors';
import type { DeviceField, DeviceForm } from './device-drawer';
import type { DeviceRow } from './devices-view';
import { deviceModels, deviceOptions } from './device-query';

type ErmState = AdminDevicesLiveQuery['fleetDevices']['items'][number]['ermState'];
type Routing = AdminDevicesLiveQuery['fleetDevices']['items'][number]['routing'];

/** The holita state and Fleet's routing state by device ID. */
export interface DevicesLive {
  readonly states: ReadonlyMap<string, ErmState>;
  readonly routing: ReadonlyMap<string, Routing>;
}

/** A missing `live` or device ID means the holita state is unknown. */
export function deviceRow(
  device: AdminDeviceDetailsFragment,
  live?: DevicesLive | null,
): DeviceRow {
  const state = live?.states.get(device.id);
  return {
    id: device.id,
    imei: device.imei,
    model: device.model ?? '',
    serialNumber: device.serialNumber ?? '',
    edataModule: device.edataModule ?? '',
    simPhoneNumber: device.simPhoneNumber ?? '',
    firmware: device.firmwareVersion ?? '',
    simIccid: device.simIccid ?? '',
    vehicleId: device.vehicleId,
    plate: device.vehicle?.licensePlate ?? null,
    status: device.status,
    lastSeenAt: device.lastReportedAt,
    signal: null,
    voltage: null,
    notes: device.notes ?? '',
    live: state
      ? {
          online: state.online,
          mode: state.mode,
          lastFrameAt: state.lastFrameAt,
          alarms: state.alarmsLast24h,
          overdue: state.health.overdue,
          routeWrites: state.health.karmaRoutingWritesLast24h,
          routing: live?.routing.get(device.id) ?? null,
        }
      : state === null
        ? 'karma'
        : null,
  };
}
export function deviceForm(device: AdminDeviceDetailsFragment): DeviceForm {
  return {
    imei: device.imei,
    model: device.model ?? '',
    simIccid: device.simIccid ?? '',
    vehicleId: device.vehicleId,
    notes: device.notes ?? '',
    serialNumber: device.serialNumber ?? '',
    options: device.options,
    firmwareVersion: device.firmwareVersion ?? '',
    edataModule: device.edataModule ?? '',
    simPhoneNumber: device.simPhoneNumber ?? '',
    smsPassword: device.smsPassword ?? '',
    installedAt: device.installedAt ?? '',
  };
}
export function deviceInput(form: DeviceForm): CreateFleetDeviceInput {
  const model = deviceModels.find((code) => code === form.model) ?? null;
  if (form.model && model === null) {
    throw new Error('Unsupported device model.');
  }
  if (form.options?.some((option) => !deviceOptions.some((code) => code === option))) {
    throw new Error('Unsupported device option.');
  }
  return {
    imei: form.imei.trim(),
    vehicleId: form.vehicleId,
    model,
    serialNumber: form.serialNumber?.trim() || null,
    options: deviceOptions.filter((code) => form.options?.includes(code)),
    simIccid: form.simIccid.trim() || null,
    notes: form.notes.trim() || null,
    firmwareVersion: form.firmwareVersion?.trim() || null,
    edataModule: form.edataModule?.trim() || null,
    simPhoneNumber: form.simPhoneNumber?.trim() || null,
    smsPassword: form.smsPassword?.trim() || null,
    installedAt: form.installedAt?.trim() || null,
  };
}
export function deviceFieldErrors(
  error: unknown,
  language: Language = 'en',
): Partial<Record<DeviceField, string>> {
  return fleetFieldErrors(
    error,
    [
      'imei',
      'vehicleId',
      'model',
      'serialNumber',
      'options',
      'simIccid',
      'notes',
      'firmwareVersion',
      'edataModule',
      'simPhoneNumber',
      'smsPassword',
      'installedAt',
    ],
    language,
  );
}
