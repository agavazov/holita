# 306 Order automatic collections by sold units

**Status:** Ready. **Product:** Holita.

**Depends on** [169](169-holita-collection-order-and-limit.md), [221](221-holita-admin-sales-report.md), [222](222-holita-admin-sales-breakdowns.md).

## Background

The red.bg coverage report marks COL-03 as P2. Ticket 169 adds configurable deterministic collection ordering and caps. The source also supports a bestseller order.

## Goal

Order automatic collections by sold units.

## Steps

1. Use the approved sold-units measure and scoped order population from the sales reporting work to rank suitable eligible products.
2. Apply the current collection criteria, row cap and a stable tie-breaker to the ranked results.

## Done when

A merchant can choose bestselling order and Basic shows the capped eligible products in the documented sold-unit order within the shop.

## Limits

Reuse the sales aggregation semantics. Leave other collection sorting in 169.

## References

- [red.bg `CollectionSelectionService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/CollectionSelectionService.php#L273)
- [red.bg `CollectionSortMode.php`](../../../red.bg/workspace-ecommerce/services/api/app/Enums/Catalog/CollectionSortMode.php)
- [Holita `apps/commerce/src/collections/collections.service.ts:102`](../../holita/apps/commerce/src/collections/collections.service.ts#L102)
- [Holita `apps/commerce/src/products/catalogue.repository.ts:54`](../../holita/apps/commerce/src/products/catalogue.repository.ts#L54)
