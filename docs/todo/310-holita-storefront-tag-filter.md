# 310 Filter public catalogue results by product tags

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks CAT-09 as P2. Basic exposes individual tag pages and other catalogue filters. Tags cannot currently be combined with existing catalogue selections.

## Goal

Filter public catalogue results by product tags.

## Steps

1. Add shop-scoped tag filter choices to the existing catalogue filters and define the combination rule for selected tags.
2. Apply the same state to results and pagination while keeping current dedicated tag routes available.

## Done when

A shopper can combine a tag choice with existing price, brand or availability choices and keep the selection when paging.

## Limits

Keep result-specific price bounds and decorative facet counts outside this run.

## References

- [red.bg `product-filters.blade.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/partials/product-filters.blade.php)
- [red.bg `StorefrontProductReadService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontProductReadService.php#L676)
- [Holita `apps/storefront/src/catalogue-browse.html:31`](../../holita/apps/storefront/src/catalogue-browse.html#L31)
- [Holita `apps/commerce/src/products/catalogue.repository.ts:54`](../../holita/apps/commerce/src/products/catalogue.repository.ts#L54)
