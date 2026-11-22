# 165 Enforce the selected variant's minimum purchase quantity

**Status:** Ready. **Product:** Holita.

## Background

red.bg takes minimum purchase quantity from the selected variant. Holita cart and checkout validate positive quantity and availability, and do not store a variant-specific minimum.

## Goal

Let a merchant define and enforce the minimum for each sellable variant.

## Steps

1. Add and validate the minimum on the variant in the Admin editor and public product contract. Use one for existing variants. Show the current minimum and set valid initial quantity when a shopper changes variant.
2. Apply the same selected-variant minimum to cart adds and updates and to checkout placement. Give localized feedback and keep removing a cart line available.

## Done when

Two variants of one product can have different minima. Product detail follows the selected variant, and cart and placement reject below-minimum quantities for that variant.

## Limits

Variant minimum only. No quantity pricing or case packs.

## References

- [red.bg Basic purchase state](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/ProductDetailView.php#L173)
- [red.bg cart mutation](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontCartMutationService.php)
- [Holita product editor](../../holita/apps/admin/src/products/product-editor.html)
- [Holita cart state](../../holita/apps/storefront/src/cart-state.ts)
