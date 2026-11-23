# 289 Map category and stock fields in local catalogue imports

**Status:** Ready. **Product:** Holita.

**Depends on** [287](287-holita-mapped-local-csv-import.md).

## Background

The red.bg coverage report marks IMP-03 as P2. The mapped import contract first handles product and variant content. The source also applies mapped category assignments and stock values.

## Goal

Map category and stock fields in local catalogue imports.

## Steps

1. Resolve the documented shop category identifiers during row processing and apply tracked variant stock through the existing inventory contract.
2. Report unresolved categories and invalid stock values in the existing row result without modifying another shop.

## Done when

One mapped local file updates a product's category and tracked stock in its own Branch, with clear row results for rejected inputs.

## Limits

Reuse existing categories and inventory. Keep category hierarchy import and remote sources outside this run.

## References

- [red.bg `MappedImportsController.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Imports/MappedImportsController.php)
- [red.bg `ImportMode.php`](../../../red.bg/workspace-ecommerce/services/api/app/Enums/Imports/ImportMode.php)
- [Holita `apps/commerce/src/commerce.graphql:123`](../../holita/apps/commerce/src/commerce.graphql#L123)
- [Holita `apps/commerce/src/categories/categories.service.ts:85`](../../holita/apps/commerce/src/categories/categories.service.ts#L85)
