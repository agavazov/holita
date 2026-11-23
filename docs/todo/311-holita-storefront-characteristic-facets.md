# 311 Filter the public catalogue by characteristic values

**Status:** Ready. **Product:** Holita.

**Depends on** [170](170-holita-category-characteristics.md), [171](171-holita-characteristic-choice-fields.md).

## Background

The red.bg coverage report marks CAT-10 as P2. Tickets 170 and 171 organize applicable characteristic groups and reusable values. The current public catalogue does not expose them as filters.

## Goal

Filter the public catalogue by characteristic values.

## Steps

1. Expose applicable public groups, selectable values and scoped counts using the existing catalogue query contract.
2. Add grouped controls in Basic and combine selected values with current filters and pagination.

## Done when

A shopper can filter a category by reusable characteristics, see their facet counts and receive only matching public products from that shop.

## Limits

Reuse the existing characteristic and catalogue data. Keep support for arbitrary raw characteristic text outside this run.

## References

- [red.bg `StorefrontProductReadService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontProductReadService.php#L737)
- [red.bg `product-filters.blade.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/partials/product-filters.blade.php)
- [Holita `apps/storefront/src/catalogue-browse.html:31`](../../holita/apps/storefront/src/catalogue-browse.html#L31)
- [Holita `apps/commerce/src/products/catalogue.repository.ts:54`](../../holita/apps/commerce/src/products/catalogue.repository.ts#L54)
