import type { SelectPassThrough } from 'primeng/select';

/**
 * Pass-through for `p-select [multiple]="true"` (PrimeNG 22 deprecates `p-multiselect`): Select
 * puts `aria-multiselectable` on its combobox, which a combobox may not carry (axe
 * `aria-allowed-attr`); the listbox in the overlay keeps the attribute.
 * Usage: `<p-select [multiple]="true" [pt]="selectMultiplePt" … />`.
 */
export const selectMultiplePt = {
  label: { 'aria-multiselectable': null },
} satisfies SelectPassThrough;
