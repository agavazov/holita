import type { OperatorInventoryVariantFieldsFragment } from '../generated/inventory-operations';

export function variantLabel(
  variant: OperatorInventoryVariantFieldsFragment,
  defaultLabel: string,
): string {
  return (
    variant.optionValues.map(({ optionName, label }) => `${optionName}: ${label}`).join(' · ') ||
    defaultLabel
  );
}
