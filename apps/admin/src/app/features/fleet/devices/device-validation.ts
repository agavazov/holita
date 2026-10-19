import type { ValidatorFn } from '@angular/forms';
import { CombinedGraphQLErrors } from '@apollo/client/errors';

export const deviceFields = ['imei', 'vehicleId'] as const;
export type DeviceField = (typeof deviceFields)[number];

export const deviceImei: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (typeof value !== 'string' || !value.trim()) {
    return { required: true };
  }
  return /^[0-9]{15}$/.test(value.trim()) ? null : { imei: true };
};
export const deviceVehicle: ValidatorFn = (control) => {
  const value: unknown = control.value;
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? null
    : { required: true };
};

export function deviceFieldErrors(error: unknown): Partial<Record<DeviceField, string>> {
  const result: Partial<Record<DeviceField, string>> = {};
  if (!CombinedGraphQLErrors.is(error)) {
    return result;
  }
  for (const failure of error.errors) {
    const fields: unknown = failure.extensions?.['fieldErrors'];
    if (!Array.isArray(fields)) {
      continue;
    }
    for (const candidate of fields.slice(0, 30)) {
      const field: unknown = candidate;
      if (
        typeof field !== 'object' ||
        field === null ||
        !('path' in field) ||
        !('message' in field) ||
        typeof field.message !== 'string' ||
        field.message.length > 300
      ) {
        continue;
      }
      const path = deviceFields.find((name) => name === field.path);
      if (path && !result[path]) {
        result[path] = field.message;
      }
    }
  }
  return result;
}
