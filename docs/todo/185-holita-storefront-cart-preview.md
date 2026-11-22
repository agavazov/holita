# 185 Preview the cart without leaving the page

**Status:** Ready. **Product:** Holita.

## Background

red.bg Basic has a working cart drawer. Holita header shows a count and opens the full cart page.

## Goal

Offer a compact cart preview for the shopper's current shop and cart.

## Steps

1. Add a Basic drawer using the existing CartState and checkout/full-cart links.
2. Show contents, totals and loading, empty or failure state, with keyboard focus and localized labels.

## Done when

A shopper can open and close the drawer from catalogue or product detail and see current cart contents.

## Limits

Reuse the existing cart identity and mutations. Keep the full cart route.

## References

- [red.bg Basic cart controller](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/CommerceController.php)
- [Holita cart state](../../holita/apps/storefront/src/cart-state.ts)
- [Holita shop header](../../holita/apps/storefront/src/main.ts)
