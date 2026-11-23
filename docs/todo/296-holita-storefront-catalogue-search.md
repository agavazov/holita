# 296 Rank storefront searches across catalogue fields

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks CAT-07 as P2. Public catalogue search currently matches product names. Shoppers also search by variant SKU, brand, category and product description.

## Goal

Rank storefront searches across catalogue fields.

## Steps

1. Extend the current scoped database query to match the additional fields and rank exact meaningful matches before broader results.
2. Apply deterministic ordering and preserve existing public catalogue and pagination rules.

## Done when

A shopper can find a public product by SKU, brand, category or description, and the result order is stable across pages in the same shop.

## Limits

Use the existing database. Ticket 184 adds suggestions. Keep external indexes and connectors out.

## References

- [red.bg `StorefrontSearchService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontSearchService.php)
- [red.bg `ProductSearchIndexer.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Search/ProductSearchIndexer.php)
- [Holita `apps/commerce/src/products/catalogue.repository.ts:240`](../../holita/apps/commerce/src/products/catalogue.repository.ts#L240)
- [Holita `apps/storefront/src/catalogue-browse.ts:36`](../../holita/apps/storefront/src/catalogue-browse.ts#L36)
