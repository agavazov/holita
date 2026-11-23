import type { ProductVariantInput } from '../generated/graphql/types.js';

type VariantOptions = Pick<ProductVariantInput, 'active' | 'optionValueIds'> & {
  combinationKey: string;
};

export class VariantOptionValuesError extends Error {
  constructor(
    readonly index: number,
    readonly code:
      | 'VARIANT_COMBINATION_IMMUTABLE'
      | 'DUPLICATE_COMBINATION'
      | 'INVALID_OPTION_VALUES'
      | 'MISMATCHED_OPTIONS',
    message: string,
  ) {
    super(message);
  }
}

export function validateVariantOptions(
  variants: readonly VariantOptions[],
  values: readonly { id: string; optionId: string }[],
): void {
  const combinations = new Set<string>();
  const optionsByValue = new Map(values.map(({ id, optionId }) => [id, optionId]));
  let expectedOptions: string | undefined;
  for (const [index, variant] of variants.entries()) {
    if (combinations.has(variant.combinationKey)) {
      throw new VariantOptionValuesError(
        index,
        'DUPLICATE_COMBINATION',
        'This product already has this combination',
      );
    }
    combinations.add(variant.combinationKey);
    const optionIds = variant.optionValueIds.map((id) => optionsByValue.get(id));
    if (optionIds.includes(undefined) || new Set(optionIds).size !== optionIds.length) {
      throw new VariantOptionValuesError(
        index,
        'INVALID_OPTION_VALUES',
        'Choose one value per option from this shop',
      );
    }
    if (!variant.active) {
      continue;
    }
    const options = optionIds.sort().join(',');
    expectedOptions ??= options;
    if (options !== expectedOptions) {
      throw new VariantOptionValuesError(
        index,
        'MISMATCHED_OPTIONS',
        'Use the same options in each active variant',
      );
    }
  }
}
