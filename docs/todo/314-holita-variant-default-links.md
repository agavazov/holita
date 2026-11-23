# 314 Set a default variant and open Basic links to a variant

**Status:** Ready. **Product:** Holita.

**Depends on** [290](290-holita-product-slugs.md).

## Background

The red.bg coverage report marks PRD-07 as P2. Basic selects an available variant automatically. The merchant cannot nominate a default or share a link that selects a specific variant.

## Goal

Set a default variant and open Basic links to a variant.

## Steps

1. Persist one merchant-selected default variant per product and resolve a valid linked active variant before the default on the public product route.
2. Reuse the current available/first fallback if neither selection is usable, and keep the stable product canonical URL.

## Done when

A product URL can preselect its linked variant, while a missing or ineligible selection falls back predictably within that product.

## Limits

Do not change the variant chooser style or stock policy in this run.

## References

- [red.bg `editor-script.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/products/partials/form/editor-script.blade.php#L796)
- [red.bg `ProductDetailView.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/ProductDetailView.php#L90)
- [Holita `apps/storefront/src/main.ts:57`](../../holita/apps/storefront/src/main.ts#L57)
- [Holita `apps/admin/src/products/product-editor.ts:656`](../../holita/apps/admin/src/products/product-editor.ts#L656)
