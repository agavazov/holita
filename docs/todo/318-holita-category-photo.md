# 318 Manage and publish a category photo

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks MED-03 as P2. The category contract does not expose a photo. The source allows merchants to supply one and exposes it publicly.

## Goal

Manage and publish a category photo.

## Steps

1. Connect a single shop-owned image using existing Commerce media handling and support adding, replacing or removing it in the current category editor.
2. Expose the photo through the public category contract and display it when present in the Basic category view.

## Done when

A merchant can replace or clear a photo in their Branch, and only its current public category image appears in Basic.

## Limits

Use local development storage and existing media mechanisms. No shared media library.

## References

- [red.bg `CategoriesController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Catalog/CategoriesController.php#L114)
- [red.bg `form.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/categories/partials/form.blade.php)
- [Holita `apps/commerce/src/commerce.graphql:400`](../../holita/apps/commerce/src/commerce.graphql#L400)
- [Holita `apps/admin/src/categories/category-editor.html:57`](../../holita/apps/admin/src/categories/category-editor.html#L57)
