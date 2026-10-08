import type { ValidatorFn } from '@angular/forms';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import isEmail from 'validator/es/lib/isEmail.js';

export const speakerFields = ['name', 'email', 'shortBio', 'active'] as const;
export type SpeakerField = (typeof speakerFields)[number];

export function speakerText(max: number, required = false): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (typeof value !== 'string') return { unsupported: true };
    if (value.includes('\u0000')) return { unsupported: true };
    if (!value.trim()) return required ? { required: true } : null;
    return Array.from(value.trim()).length > max ? { maxLength: true } : null;
  };
}

export const speakerEmail: ValidatorFn = (control) => {
  const value: unknown = control.value;
  return typeof value === 'string' && (!value.trim() || isEmail(value.trim()))
    ? null
    : { email: true };
};
export const speakerActive: ValidatorFn = (control) => {
  const value: unknown = control.value;
  return typeof value === 'boolean' ? null : { active: true };
};

export function speakerFieldErrors(error: unknown): Partial<Record<SpeakerField, string>> {
  const result: Partial<Record<SpeakerField, string>> = {};
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
      const path = speakerFields.find((name) => name === field.path);
      if (path && !result[path]) result[path] = field.message;
    }
  }
  return result;
}
