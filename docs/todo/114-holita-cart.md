# 114 Shopper cart

**Status:** Ready. **Product:** Holita.

## Background

Basic supports guest and signed-in carts with quantity edits and sign-in merge.

## Goal

Shoppers can keep selected variants in a cart while browsing.

## Steps

1. Keep a shop-owned cart with variant IDs and quantities. Authorize access through an opaque,
   shop-scoped cart credential for guests or the verified customer session for signed-in shoppers.
   Merge guest lines into the shopper’s cart at sign-in and report unavailable items.
2. Add public read, add, update and remove operations, plus a cart page and item count. Price
   lines in Commerce and show item totals and stock issues.
3. Keep Admin on the existing product and stock screens. Seed an open cart for a demo shopper with
   two available variants.

## Done when

A cart survives reload, tab navigation and sign-in, stays scoped to the shop and owner, and
reflects current prices and availability.

## Limits

Stock is committed at order placement. Shipping and discounts are subsequent slices.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Cart model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Commerce/Cart.php)
- [Cart mutations](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontCartMutationService.php)
- [Basic cart](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/cart.blade.php)
