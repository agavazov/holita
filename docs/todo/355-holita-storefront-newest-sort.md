# 355 Sort Basic catalogue results by newest products

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks CAT-06 as P3. Basic currently offers name and price sorts. Newest first helps shoppers find recent stock without a curated collection.

## Goal

Sort Basic catalogue results by newest products.

## Steps

1. Add an explicit newest sort to the current public catalogue query and control, using creation time and a stable tie-breaker.

## Done when

Newest first works with existing filters and consecutive pages have a stable order.

## Limits

Reuse current public availability rules and the existing browse view.

## References

- [red.bg `StorefrontProductReadService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontProductReadService.php#L660)
- [Holita `apps/commerce/src/storefront.graphql:109`](../../holita/apps/commerce/src/storefront.graphql#L109)
- [Holita `apps/storefront/src/catalogue-browse.ts:36`](../../holita/apps/storefront/src/catalogue-browse.ts#L36)
