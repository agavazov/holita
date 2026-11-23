# 356 Link available Basic card options to product variant selections

**Status:** Ready. **Product:** Holita.

**Depends on** [314](314-holita-variant-default-links.md).

## Background

The red.bg coverage report marks PRD-12 as P3. Holita shows enabled options on catalogue cards. The source also distinguishes unavailable options and links eligible options to the variant selection.

## Goal

Link available Basic card options to product variant selections.

## Steps

1. Use the eligible variant IDs and links from ticket 314 to link supported available preview values. Show non-purchasable values using the current unavailable state.

## Done when

A shopper can open a product with the linked variant selected, and unavailable options do not imply that they can be purchased.

## Limits

Keep add-to-cart and combination selection on product detail.

## References

- [red.bg `options.blade.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/partials/product-cards/options.blade.php)
- [red.bg `ProductListResource.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Resources/Storefront/ProductListResource.php)
- [Holita `apps/storefront/src/catalogue-browse.html:14`](../../holita/apps/storefront/src/catalogue-browse.html#L14)
- [Holita `apps/storefront/src/main.ts:920`](../../holita/apps/storefront/src/main.ts#L920)
