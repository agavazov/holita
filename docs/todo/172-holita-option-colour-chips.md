# 172 Display variant colors as labelled swatches

**Status:** Ready. **Product:** Holita.

## Background

red.bg supports option display types including colour swatches. Holita option values are plain labels.

## Goal

Let a merchant add color swatches to an option while keeping its values readable.

## Steps

1. Add an optional named color or validated swatch value using the existing option editor.
2. Display a labelled swatch in the storefront variant picker with the existing accessible selection state. Keep text labels for selected and unavailable options.

## Done when

Color options show a readable swatch and label, while ordinary options retain their current presentation.

## Limits

Product detail swatches only.

## References

- [red.bg option settings](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/options/partials/form.blade.php)
- [red.bg Basic variant choices](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/partials/product-variant-selection.blade.php)
- [Holita option editor](../../holita/apps/admin/src/options/option-editor.ts)
- [Holita storefront variant choices](../../holita/apps/storefront/src/main.ts#L747)
