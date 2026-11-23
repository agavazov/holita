# 168 Combine rule conditions in automatic collections

**Status:** Ready. **Product:** Holita.

## Background

red.bg evaluates automatic collection rules against category, brand, tag and badge. Holita supports manual groups or one category or brand condition.

## Goal

Let merchants combine supported inclusion rules for one automatic collection.

## Steps

1. Combine scoped category, brand, tag and badge conditions with AND. Support `equals` for an exact selection and `in` for any of several selections. Preserve existing category and brand collections on upgrade.
2. Add the rule controls and make an empty rule set visibly mean all active products in the shop. Use the same rule evaluation in public browse and merchant previews.

## Done when

A collection matches a combination of exact and multiple-choice conditions. An empty rule set returns the active products in the selected shop.

## Limits

Supported catalogue predicates only, with existing manual collections unchanged.

## References

- [red.bg selection service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/CollectionSelectionService.php)
- [Holita collection editor](../../holita/apps/admin/src/collections/collection-editor.ts)
- [Holita collection contract](../../holita/apps/commerce/src/commerce.graphql)
- [red.bg Admin collection rules](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/collections/partials/form.blade.php)
- [Holita collection shape](../../holita/apps/commerce/src/commerce.graphql#L528)
