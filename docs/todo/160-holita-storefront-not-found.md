# 160 Show a shop-scoped storefront not-found page

**Status:** Ready. **Product:** Holita.

## Background

Holita's storefront route list has no wildcard. An unrecognized path under an otherwise valid shop can leave the outlet blank.

## Goal

Give shoppers a clear localized missing-page state with a route back to the shop.

## Steps

1. Add a scoped fallback after supported storefront routes and reuse the existing shop load/error/missing states.
2. Show the shop link for a known Branch and a neutral state when the Branch is unknown.

## Done when

Unknown nested paths show a BG/EN recovery page, while valid products and shop-level failures keep their specific states.

## Limits

Basic route recovery only. Keep the current Branch URL structure.

## References

- [Storefront routes and shell](../../holita/apps/storefront/src/main.ts)
- [Storefront text](../../holita/apps/storefront/src/storefront-messages.ts)
