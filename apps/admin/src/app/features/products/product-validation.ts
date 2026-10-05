import type { ValidatorFn } from '@angular/forms';

export function productText(max: number): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (typeof value !== 'string' || !value.trim()) return { required: true };
    if (value.includes('\u0000')) return { unsupported: true };
    return Array.from(value.trim()).length > max ? { maxLength: true } : null;
  };
}

export const productStatus: ValidatorFn = (control) => {
  const value: unknown = control.value;
  return value === 'DRAFT' || value === 'ACTIVE' ? null : { status: true };
};
