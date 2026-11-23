# 316 Create brands and categories from the Admin product editor

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks PRD-22 as P2. Operators must leave the product editor to add a missing brand or category.

## Goal

Create brands and categories from the Admin product editor.

## Steps

1. Reuse the existing brand and category forms as scoped creation actions in the product editor, and add the created record to the appropriate selection.

## Done when

The merchant can create and select a brand or category while retaining all unsaved product fields.

## Limits

Reuse the shared dialogs and existing operations. Keep separate management actions on their own screens.

## References

- [red.bg `basic-information.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/products/partials/form/basic-information.blade.php)
- [Holita `apps/admin/src/products/product-editor.ts:62`](../../holita/apps/admin/src/products/product-editor.ts#L62)
- [Holita `apps/admin/src/categories/category-editor.ts:62`](../../holita/apps/admin/src/categories/category-editor.ts#L62)
