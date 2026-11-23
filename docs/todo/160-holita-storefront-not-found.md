# 160 Show a shop-scoped storefront not-found page

**Status:** Ready. **Product:** Holita.

## Background

Holita's storefront route list has no wildcard. The owner report opened an unrecognized path under a valid shop and saw a blank body with no header or way back. A missing product on a supported route already has its own state.

## Goal

Give shoppers a clear localized missing-page state with a route back to the shop.

## Steps

1. Add a scoped fallback after supported storefront routes, keep the Basic header on a known shop and reuse the existing shop load, error and missing states.
2. Show the shop link for a known Branch and a neutral state when the Branch is unknown.

## Done when

An unknown nested path for a known Branch shows the Basic header, a BG/EN not-found message and a link to that shop. Missing products retain their existing state and an unknown Branch shows the neutral missing-shop state.

## Limits

Basic route recovery only. Keep the current Branch URL structure.

## References

- [red.bg Basic not-found view](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/errors/storefront.blade.php)
- [Storefront routes and shell](../../holita/apps/storefront/src/main.ts#L918)
- [Storefront text](../../holita/apps/storefront/src/storefront-messages.ts)
