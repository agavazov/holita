import type { Language } from '../../../i18n/messages';
import type {
  AdminDeviceDetailsFragment,
  CreateFleetDeviceInput,
} from '../../../../generated/graphql/operations';
import { fleetFieldErrors } from '../field-errors';
import type { DeviceField, DeviceForm } from './device-drawer';
import type { DeviceRow } from './devices-view';
import { deviceModels, deviceOptions } from './device-query';

export function deviceRow(device: AdminDeviceDetailsFragment): DeviceRow {
  return {
    id: device.id,
    imei: device.imei,
    model: device.model ?? '',
    firmware: device.firmwareVersion ?? '',
    simIccid: device.simIccid ?? '',
    vehicleId: device.vehicleId,
    plate: device.vehicle?.licensePlate ?? null,
    status: device.status,
    lastSeenAt: device.lastReportedAt,
    signal: null,
    voltage: null,
    notes: device.notes ?? '',
  };
}
export function deviceForm(device: AdminDeviceDetailsFragment): DeviceForm {
  return {
    imei: device.imei,
    model: device.model ?? '',
    simIccid: device.simIccid ?? '',
    vehicleId: device.vehicleId,
    notes: device.notes ?? '',
    options: device.options,
    firmwareVersion: device.firmwareVersion ?? '',
    simPhoneNumber: device.simPhoneNumber ?? '',
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
    options: deviceOptions.filter((code) => form.options?.includes(code)),
    simIccid: form.simIccid.trim() || null,
    notes: form.notes.trim() || null,
    firmwareVersion: form.firmwareVersion?.trim() || null,
    simPhoneNumber: form.simPhoneNumber?.trim() || null,
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
      'options',
      'simIccid',
      'notes',
      'firmwareVersion',
      'simPhoneNumber',
      'installedAt',
    ],
    language,
  );
}
