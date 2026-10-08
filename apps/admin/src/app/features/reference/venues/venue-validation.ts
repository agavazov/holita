import type { ValidatorFn } from '@angular/forms';
import { CombinedGraphQLErrors } from '@apollo/client/errors';

export const venueFields = [
  'name',
  'description',
  'city',
  'countryCode',
  'address',
  'capacity',
  'active',
] as const;
export type VenueField = (typeof venueFields)[number];
export const venueTextLimits = { name: 200, description: 2000, city: 120, address: 300 };

export function venueText(max: number, required = false): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (typeof value !== 'string') return { unsupported: true };
    if (value.includes('\u0000')) return { unsupported: true };
    if (!value.trim()) return required ? { required: true } : null;
    return Array.from(value.trim()).length > max ? { maxLength: true } : null;
  };
}

export const venueCountry: ValidatorFn = (control) => {
  const value: unknown = control.value;
  return typeof value === 'string' && /^[a-z]{2}$/i.test(value.trim())
    ? null
    : { countryCode: true };
};
export const venueCapacity: ValidatorFn = (control) => {
  const value: unknown = control.value;
  return value === null ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 2147483647)
    ? null
    : { capacity: true };
};
export const venueActive: ValidatorFn = (control) => {
  const value: unknown = control.value;
  return typeof value === 'boolean' ? null : { active: true };
};

export function venueFieldErrors(error: unknown): Partial<Record<VenueField, string>> {
  const result: Partial<Record<VenueField, string>> = {};
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
      const path = venueFields.find((name) => name === field.path);
      if (path && !result[path]) result[path] = field.message;
    }
  }
  return result;
}
