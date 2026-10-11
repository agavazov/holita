import type { ValidatorFn } from '@angular/forms';
import { CombinedGraphQLErrors } from '@apollo/client/errors';

export const vehicleFields = ['licensePlate', 'notes'] as const;
export type VehicleField = (typeof vehicleFields)[number];

export function vehicleText(max: number, required = false): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (typeof value !== 'string') return { unsupported: true };
    if (value.includes('\u0000')) return { unsupported: true };
    if (!value.trim()) return required ? { required: true } : null;
    return Array.from(value.trim()).length > max ? { maxLength: true } : null;
  };
}

export function vehicleFieldErrors(error: unknown): Partial<Record<VehicleField, string>> {
  const result: Partial<Record<VehicleField, string>> = {};
  if (!CombinedGraphQLErrors.is(error)) return result;
  for (const failure of error.errors) {
    const fields: unknown = failure.extensions?.['fieldErrors'];
    if (!Array.isArray(fields)) continue;
    for (const candidate of fields.slice(0, 30)) {
      const field: unknown = candidate;
      if (
        typeof field !== 'object' ||
        field === null ||
        !('path' in field) ||
        !('message' in field) ||
        typeof field.message !== 'string' ||
        field.message.length > 300
      )
        continue;
      const path = vehicleFields.find((name) => name === field.path);
      if (path && !result[path]) result[path] = field.message;
    }
  }
  return result;
}
