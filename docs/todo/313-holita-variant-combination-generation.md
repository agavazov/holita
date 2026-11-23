# 313 Generate product variant combinations in Admin

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks PRD-06 as P2. The product editor currently adds variant rows manually.

## Goal

Generate product variant combinations in Admin.

## Steps

1. Generate combinations from selected option values on demand and match each combination to any existing form row.
2. Keep existing variant identifiers and edits when regenerating. Use the established policy for existing combinations that cannot be removed.

## Done when

The merchant can generate a small variant matrix, edit a row and regenerate without losing its data or changing the identity of a sold variant.

## Limits

Use the existing product editor and preserve saved variant identities. No arbitrary form builder.

## References

- [red.bg `editor-script.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/products/partials/form/editor-script.blade.php#L257)
- [Holita `apps/admin/src/products/product-editor.ts:656`](../../holita/apps/admin/src/products/product-editor.ts#L656)
- [Holita `apps/commerce/src/products/commerce.repository.ts:24`](../../holita/apps/commerce/src/products/commerce.repository.ts#L24)
