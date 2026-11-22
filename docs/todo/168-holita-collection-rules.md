# 168 Combine rule conditions in automatic collections

**Status:** Ready. **Product:** Holita.

## Background

red.bg evaluates automatic collection rules against category, brand, tag and badge. Holita supports manual groups or one category or brand condition.

## Goal

Let merchants combine supported inclusion rules for one automatic collection.

## Steps

1. Represent several scoped AND conditions and preserve existing category and brand collections on upgrade.
2. Add an Admin rule editor and evaluate the same rules in public browse and merchant previews.

## Done when

A collection matches its rule combination, updates when product attributes change and never selects another shop's records.

## Limits

Supported catalogue predicates only, with existing manual collections unchanged.

## References

- [red.bg selection service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/CollectionSelectionService.php)
- [Holita collection editor](../../holita/apps/admin/src/collections/collection-editor.ts)
- [Holita collection contract](../../holita/apps/commerce/src/commerce.graphql)
