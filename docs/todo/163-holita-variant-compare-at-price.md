# 163 Show variant compare-at prices

**Status:** Ready. **Product:** Holita.

## Background

red.bg Admin edits a compare-at price for a variant and Basic displays the selected variant's old price. Holita stores and shows only its selling price.

## Goal

Let merchants show a valid reference price alongside the selected variant price.

## Steps

1. Add an optional compare-at price and validation to the existing variant editor and contract.
2. Render the comparison on product detail when applicable, localized in the shop currency.

## Done when

Changing variants updates both prices, and omitting the reference price leaves the current display.

## Limits

Display only. Checkout, order totals and discounts use the actual selling price.

## References

- [red.bg variant editor](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/products/partials/variants.blade.php)
- [red.bg Basic product](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/product.blade.php)
- [Holita variant editor](../../holita/apps/admin/src/products/product-editor.html)
