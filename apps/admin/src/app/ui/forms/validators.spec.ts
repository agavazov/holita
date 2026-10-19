import { FormControl, FormGroup } from '@angular/forms';
import { focusFirstInvalid } from './focus';
import {
  dateOnlyValidator,
  decimalValidator,
  integerValidator,
  patternValidator,
  requireOneOf,
  textValidator,
  validationMessage,
} from './validators';

function errors(validator: ReturnType<typeof textValidator>, value: unknown) {
  return validator(new FormControl(value));
}

describe('form validators', () => {
  it('measures trimmed text in code points and rejects NUL', () => {
    const required = textValidator(3, { required: true });
    expect(errors(required, '')).toEqual({ required: true });
    expect(errors(required, '   ')).toEqual({ required: true });
    expect(errors(required, ' 😀😀😀 ')).toBeNull();
    expect(errors(required, 'abcd')).toEqual({ maxLength: { max: 3 } });
    expect(errors(required, 'a\u0000')).toEqual({ unsupported: true });
    expect(errors(textValidator(3), null)).toBeNull();
  });

  it('matches patterns after trimming and optional upper-casing', () => {
    const vin = patternValidator(/^[A-HJ-NPR-Z0-9]{17}$/, { transform: 'upper' });
    expect(errors(vin, ' wdb9634031l123456 ')).toBeNull();
    expect(errors(vin, 'WDB963403IL123456')).toEqual({ pattern: true });
    expect(errors(vin, '')).toBeNull();
  });

  it('checks integers, decimals and their ranges', () => {
    const odometer = integerValidator(0, 2_000_000);
    expect(errors(odometer, 12)).toBeNull();
    expect(errors(odometer, '12')).toBeNull();
    expect(errors(odometer, 1.5)).toEqual({ integer: true });
    expect(errors(odometer, -1)).toEqual({ min: { min: 0 } });
    expect(errors(odometer, 2_000_001)).toEqual({ max: { max: 2_000_000 } });
    expect(errors(odometer, null)).toBeNull();
    const tank = decimalValidator(0, 1500, 0.5);
    expect(errors(tank, 120.5)).toBeNull();
    expect(errors(tank, 120.25)).toEqual({ step: { step: 0.5 } });
    expect(errors(tank, 'x')).toEqual({ decimal: true });
  });

  it('accepts exact cents near the maximum without admitting fractional cents', () => {
    const cost = decimalValidator(0, 1_000_000, 0.01);
    for (const value of [
      0,
      0.01,
      123.45,
      999_999.09,
      999_999.19,
      999_999.99,
      1_000_000,
      '999999.19',
    ])
      expect(errors(cost, value)).toBeNull();
    for (const value of [0.001, 999_999.191, 999_999.199, 999_999.190000001, 999_999.189999999])
      expect(errors(cost, value)).toEqual({ step: { step: 0.01 } });
    expect(errors(cost, -0.01)).toEqual({ min: { min: 0 } });
    expect(errors(cost, 1_000_000.01)).toEqual({ max: { max: 1_000_000 } });
  });

  it('retains decimal grids other than cents, including exponent notation', () => {
    const quarter = decimalValidator(0, 10, 0.25);
    expect(errors(quarter, 5.75)).toBeNull();
    expect(errors(quarter, 5.76)).toEqual({ step: { step: 0.25 } });
    const small = decimalValidator(0, 1, 1e-7);
    expect(errors(small, 3e-7)).toBeNull();
    expect(errors(small, 3.1e-7)).toEqual({ step: { step: 1e-7 } });
  });

  it('checks calendar dates against bounds (strings or DatePicker dates)', () => {
    const notFuture = dateOnlyValidator(null, () => '2026-10-18');
    expect(errors(notFuture, '2026-10-18')).toBeNull();
    expect(errors(notFuture, new Date(2026, 9, 19))).toEqual({ dateMax: { max: '2026-10-18' } });
    expect(errors(dateOnlyValidator('2026-01-01', null), '2025-12-31')).toEqual({
      dateMin: { min: '2026-01-01' },
    });
    expect(errors(notFuture, '18.10.2026')).toEqual({ date: true });
  });

  it('requires an integer when configured without treating zero as blank', () => {
    const required = integerValidator(1, 50, { required: true });
    for (const value of [null, undefined, '', '   '])
      expect(errors(required, value)).toEqual({ required: true });
    expect(errors(required, 0)).toEqual({ min: { min: 1 } });
    expect(errors(required, 12)).toBeNull();
    expect(errors(integerValidator(0, 50, { required: true }), 0)).toBeNull();
  });

  it('requires one of two controls and shows the error on the first', () => {
    const group = new FormGroup(
      { dueOn: new FormControl<string | null>(null), dueKm: new FormControl<number | null>(null) },
      { validators: requireOneOf('dueOn', 'dueKm') },
    );
    expect(group.controls.dueOn.errors).toEqual({ requireOneOf: true });
    group.controls.dueKm.setValue(150_000);
    expect(group.controls.dueOn.errors).toBeNull();
    expect(group.valid).toBe(true);
  });

  it('translates the first error with formatted parameters', () => {
    expect(validationMessage({ maxLength: { max: 2000 } }, 'bg')).toBe(
      'Използвайте най-много 2 000 знака.',
    );
    expect(validationMessage({ dateMax: { max: '2026-10-18' } }, 'en')).toBe(
      'Choose 18 Oct 2026 or earlier.',
    );
    expect(validationMessage({ required: true }, 'en')).toBe('This field is required.');
    expect(validationMessage({ custom: true }, 'en')).toBe('The value is not valid.');
    expect(validationMessage(null, 'en')).toBeNull();
  });

  it('focuses the first invalid field in visual order', () => {
    const form = document.createElement('form');
    form.innerHTML = `
      <input id="vehicle-plate" aria-invalid="false" />
      <input id="vehicle-vin" aria-invalid="true" />
      <input id="vehicle-notes" aria-invalid="true" />`;
    document.body.append(form);
    try {
      expect(focusFirstInvalid(form, ['plate', 'notes', 'vin'], 'vehicle-')).toBe(true);
      expect(document.activeElement?.id).toBe('vehicle-notes');
      expect(focusFirstInvalid(form, ['plate'], 'vehicle-')).toBe(false);
    } finally {
      form.remove();
    }
  });
});
