# 276 Record variant prices and expose the 30-day reference

**Status:** Ready. **Product:** Holita.

**Depends on** [257](257-holita-variant-combination-identity.md).

## Background

The red.bg coverage report marks PRI-03 as P1. Holita does not store effective price history. red.bg provides a separate historical reference in the public API.

## Goal

Record variant prices and expose the 30-day reference.

## Steps

1. Record effective price changes for the same Tenant, Branch and stable variant ID using the existing price write path.
2. Expose the lowest known price for the documented 30-day window in the storefront API with an explicit unknown result when usable history is absent.

## Done when

Changing a variant price preserves the historical values under the same identity, and the public API returns the correct known reference or unknown without guessing a history.

## Limits

Keep Admin compare-at and any shopper-visible discount claim in ticket 163. Use actual price data and the variant identity fix in ticket 257.

## References

- [red.bg `2026_08_03_000017_create_variant_price_history.php`](../../../red.bg/workspace-ecommerce/services/api/database/migrations/main/2026_08_03_000017_create_variant_price_history.php)
- [red.bg `OmnibusPriceService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/OmnibusPriceService.php)
- [Holita `apps/commerce/src/products/commerce.repository.ts:24`](../../holita/apps/commerce/src/products/commerce.repository.ts#L24)
- [Holita `apps/commerce/src/storefront.graphql:137`](../../holita/apps/commerce/src/storefront.graphql#L137)
