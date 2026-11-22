# 169 Rank and cap automatic collections

**Status:** Ready after [168](168-holita-collection-rules.md). **Product:** Holita.

## Background

red.bg automatic collections can order and cap their selection. Holita automatic grouping lacks a merchant-controlled result limit.

## Goal

Allow the merchant to choose a supported default order and maximum for a rule-based collection.

## Steps

1. Add configured rank and item limit to the automatic collection editor and apply them to public reads before pagination.
2. Support deterministic catalogue orders first and add best-selling from existing order data if the report provides an appropriate scoped metric.

## Done when

A capped collection delivers the same intended ranked product set across its public pages.

## Limits

Keep user sorting and manual collection ordering well defined. No external data.

## References

- [red.bg collection selection service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/CollectionSelectionService.php)
- [Holita storefront contract](../../holita/apps/commerce/src/storefront.graphql)
