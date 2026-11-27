# 163 Show variant compare-at prices

**Status:** Needs owner. When may Basic show a merchant-entered compare-at price, and when must it show the saved 30-day reference? **Product:** Holita.

## Background

red.bg Basic displays the compare-at price, and its public API separately exposes a 30-day price reference. Holita currently shows the selling price.

## Goal

Let merchants show a valid reference price alongside the selected variant price.

## Steps

1. Add an optional compare-at price and validation to the existing variant editor and contract.
2. Apply the approved public display policy to `CatalogueVariant.referencePrice30Days`. Localize amounts in the shop currency.

## Done when

Changing variants shows the selling price and only the eligible comparison for that variant. If the approved rule requires history and the reference is unavailable, the page shows the selling price alone.

## Limits

Display only. Checkout, order totals and discounts use the actual selling price.

## References

- [red.bg variant editor](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/products/partials/variants.blade.php)
- [red.bg Basic product](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/product.blade.php)
- [Holita variant editor](../../holita/apps/admin/src/products/product-editor.html)
- [red.bg public variant prices](../../../red.bg/workspace-ecommerce/services/api/app/Http/Resources/Storefront/ProductVariantResource.php)
- [Holita current variant fields](../../holita/apps/commerce/src/commerce.graphql#L38)
