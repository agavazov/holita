# 365 Preserve a storefront session across equivalent shop URLs

**Status:** Ready. **Product:** Holita.

## Background

Independent review HLR-07 identified this behavior at `1b44cc90`. Upper- and lowercase forms of a valid shop UUID resolve to the same shop in Commerce, while storefront browser keys can differ.

## Goal

Preserve a storefront session across equivalent shop URLs.

## Steps

Canonicalize the shop identifier consistently for cart and shopper-session storage. Account for saved keys from existing sessions.

## Done when

A shopper can change UUID casing in the URL and retain the same cart and session. A different shop remains isolated.

## Limits

Local shop identity and browser storage.

## References

- [cart-state.ts](../../holita/apps/storefront/src/cart-state.ts#L197)
- [cart-state.ts](../../holita/apps/storefront/src/cart-state.ts#L32)
- [cart-state.ts](../../holita/apps/storefront/src/cart-state.ts#L66)
- [storefront.service.ts](../../holita/apps/commerce/src/storefront.service.ts#L291)
