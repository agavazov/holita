# 108 Product collections

**Status:** Ready after [103](103-holita-categories.md). **Product:** Holita.

## Background

red.bg offers manually curated and rule-based collections.

## Goal

Merchants publish groups of products independently of the category tree.

## Steps

1. Keep name, slug, active status and either an ordered product selection or one automatic rule
   matching a category or brand.
2. Add the Admin Collections list and drawer with a product picker or rule selector. Expose active
   collections and paged active members through the storefront graph.
3. Seed a curated Kitchen Essentials collection and a collection driven by one category rule.

## Done when

Manual order is preserved, the automatic collection reflects a matching product, and inactive
entries are omitted from public queries.

## Limits

Use one automatic rule per collection. Storefront collection pages land in 112.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Collection model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Catalog/ProductCollection.php)
- [Selection service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/CollectionSelectionService.php)
- [Admin Collections](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/collections)
