# 169 Rank and cap automatic collections

**Status:** Ready after [168](168-holita-collection-rules.md). **Product:** Holita.

## Background

red.bg automatic collections can order and cap their selection. Holita automatic grouping lacks a merchant-controlled result limit.

## Goal

Allow the merchant to choose a supported default order and maximum for a rule-based collection.

## Steps

1. Add configured rank and item limit to the automatic collection editor and apply them to public reads before pagination.
2. Support deterministic price, name and newest orders. Use a stable tie-breaker so the capped selection stays consistent across pages.

## Done when

A capped collection delivers the same intended ranked product set across its public pages.

## Limits

Keep user sorting and manual collection ordering well defined. Store the catalogue order and limit only. Sales-based ranking is separate.

## References

- [red.bg collection selection service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/CollectionSelectionService.php)
- [Holita storefront contract](../../holita/apps/commerce/src/storefront.graphql)
- [red.bg sort modes](../../../red.bg/workspace-ecommerce/services/api/app/Enums/Catalog/CollectionSortMode.php)
- [Holita existing collection contract](../../holita/apps/commerce/src/commerce.graphql#L528)
