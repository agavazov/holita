# 170 Scope characteristic groups to categories

**Status:** Ready. **Product:** Holita.

## Background

red.bg chooses applicable characteristics by category. Holita presents the same characteristic groups to all products in a shop.

## Goal

Let a merchant use a group for relevant categories and retain general groups.

## Steps

1. Allow optional category assignments in the existing group editor. Resolve applicable groups from the product's current category selection for Admin editing and public details. A group with no assigned categories applies generally.
2. Preserve existing saved values when a group temporarily ceases to apply.

## Done when

Different categories show their applicable groups, and unscoped groups continue to work.

## Limits

Group applicability only. Choice fields have a separate ticket.

## References

- [red.bg product features fields](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/products/partials/form/features.blade.php)
- [Holita characteristic editor](../../holita/apps/admin/src/characteristics/characteristic-group-editor.ts)
- [Holita product editor](../../holita/apps/admin/src/products/product-editor.ts)
- [red.bg category applicability](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/ProductService.php#L382)
- [Holita group editor](../../holita/apps/admin/src/characteristics/characteristic-group-editor.ts#L86)
