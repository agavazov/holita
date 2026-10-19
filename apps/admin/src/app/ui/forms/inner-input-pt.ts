/**
 * Pass-through for PrimeNG controls that render their own `<input>` (InputNumber, DatePicker):
 * links the FormField hint and error and marks the input invalid, which `focusFirstInvalid` and
 * assistive technology read. Usage: `[pt]="innerInputPt('vehicle-year', !!error)"`.
 */
export function innerInputPt(controlId: string, invalid: boolean) {
  return {
    pcInputText: {
      root: {
        'aria-invalid': invalid ? 'true' : undefined,
        'aria-describedby': `${controlId}-hint ${controlId}-error`,
      },
    },
  };
}

/** The grid cell already carries selection; its child span must not repeat aria-selected. */
export function datePickerInputPt(controlId: string, invalid: boolean) {
  return { ...innerInputPt(controlId, invalid), day: { 'aria-selected': null } };
}
