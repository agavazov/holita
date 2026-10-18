import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import type { Language } from '../../i18n/messages';
import { formatDateOnly, formatNumber } from '../format/format';
import { toDateOnly } from '../format/zoned-time';
import { interpolate, uiMessages } from '../i18n/messages';

// Shared validators for drawer forms. Error keys are fixed strings that `validationMessage`
// translates; server-side rules stay authoritative.

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && !value.trim());
}

/** Text measured in code points after trimming; rejects NUL. */
export function textValidator(
  max: number,
  options: { readonly required?: boolean } = {},
): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (value === null || value === undefined || value === '')
      return options.required ? { required: true } : null;
    if (typeof value !== 'string' || value.includes('\u0000')) return { unsupported: true };
    const text = value.trim();
    if (!text) return options.required ? { required: true } : null;
    return Array.from(text).length > max ? { maxLength: { max } } : null;
  };
}

/** Matches a pattern after trimming (and upper-casing when asked); empty values pass. */
export function patternValidator(
  pattern: RegExp,
  options: { readonly transform?: 'upper' | 'none' } = {},
): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (isBlank(value)) return null;
    if (typeof value !== 'string') return { pattern: true };
    const text = options.transform === 'upper' ? value.trim().toUpperCase() : value.trim();
    return pattern.test(text) ? null : { pattern: true };
  };
}

function numberValue(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  return Number.NaN;
}

/** Whole number in [min, max]; empty values pass. */
export function integerValidator(min: number, max: number): ValidatorFn {
  return (control) => {
    if (isBlank(control.value)) return null;
    const value = numberValue(control.value);
    if (!Number.isInteger(value)) return { integer: true };
    if (value < min) return { min: { min } };
    return value > max ? { max: { max } } : null;
  };
}

/** Decimal in [min, max] on a `step` grid; empty values pass. */
export function decimalValidator(min: number, max: number, step: number): ValidatorFn {
  return (control) => {
    if (isBlank(control.value)) return null;
    const value = numberValue(control.value);
    if (!Number.isFinite(value)) return { decimal: true };
    if (value < min) return { min: { min } };
    if (value > max) return { max: { max } };
    const steps = value / step;
    return Math.abs(steps - Math.round(steps)) < 1e-9 ? null : { step: { step } };
  };
}

/** A `YYYY-MM-DD` value (or a DatePicker Date) within optional inclusive bounds. */
export function dateOnlyValidator(
  min: (() => string | null) | string | null,
  max: (() => string | null) | string | null,
): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (isBlank(value)) return null;
    const text =
      value instanceof Date && !Number.isNaN(value.getTime())
        ? toDateOnly(value)
        : typeof value === 'string'
          ? value
          : '';
    if (!dateOnly.test(text)) return { date: true };
    const lower = typeof min === 'function' ? min() : min;
    const upper = typeof max === 'function' ? max() : max;
    if (lower && text < lower) return { dateMin: { min: lower } };
    return upper && text > upper ? { dateMax: { max: upper } } : null;
  };
}

/** Group validator: at least one of two controls has a value; the error shows on the first. */
export function requireOneOf(first: string, second: string): ValidatorFn {
  return (group: AbstractControl) => {
    const a = group.get(first);
    const b = group.get(second);
    if (!a || !b) return null;
    const missing = isBlank(a.value) && isBlank(b.value);
    const { requireOneOf: present, ...others } = a.errors ?? {};
    if (missing && !present) a.setErrors({ ...others, requireOneOf: true });
    if (!missing && present) a.setErrors(Object.keys(others).length ? others : null);
    return null;
  };
}

/** The catalog message of a control's first validation error, or `null`. */
export function validationMessage(
  errors: ValidationErrors | null | undefined,
  language: Language,
): string | null {
  if (!errors) return null;
  const text = uiMessages[language].validation;
  const [key] = Object.keys(errors);
  const detail: unknown = key ? errors[key] : undefined;
  const value = (name: string): string => {
    const item: unknown =
      typeof detail === 'object' && detail !== null ? Reflect.get(detail, name) : undefined;
    if (typeof item === 'number') return formatNumber(item, language, { fraction: 3 });
    if (typeof item === 'string')
      return dateOnly.test(item) ? formatDateOnly(item, language) : item;
    return '';
  };
  switch (key) {
    case 'required':
      return text.required;
    case 'unsupported':
      return text.unsupported;
    case 'maxLength':
      return interpolate(text.maxLength, { max: value('max') });
    case 'pattern':
      return text.pattern;
    case 'integer':
      return text.integer;
    case 'decimal':
      return text.decimal;
    case 'min':
      return interpolate(text.min, { min: value('min') });
    case 'max':
      return interpolate(text.max, { max: value('max') });
    case 'step':
      return interpolate(text.step, { step: value('step') });
    case 'date':
      return text.date;
    case 'dateMin':
      return interpolate(text.dateMin, { min: value('min') });
    case 'dateMax':
      return interpolate(text.dateMax, { max: value('max') });
    case 'requireOneOf':
      return text.requireOneOf;
    default:
      return text.invalid;
  }
}
