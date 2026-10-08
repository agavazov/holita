import type { ValidatorFn } from '@angular/forms';
import { CombinedGraphQLErrors } from '@apollo/client/errors';

export const tagFields = ['name', 'color', 'active'] as const;
export type TagField = (typeof tagFields)[number];

export function tagText(max: number, required = false): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (typeof value !== 'string') return { unsupported: true };
    if (value.includes('\u0000')) return { unsupported: true };
    if (!value.trim()) return required ? { required: true } : null;
    return Array.from(value.trim()).length > max ? { maxLength: true } : null;
  };
}

export const tagColor: ValidatorFn = (control) => {
  const value: unknown = control.value;
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? null : { color: true };
};
export const tagActive: ValidatorFn = (control) => {
  const value: unknown = control.value;
  return typeof value === 'boolean' ? null : { active: true };
};

export function tagFieldErrors(error: unknown): Partial<Record<TagField, string>> {
  const result: Partial<Record<TagField, string>> = {};
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
      const path = tagFields.find((name) => name === field.path);
      if (path && !result[path]) result[path] = field.message;
    }
  }
  return result;
}
