# 264 Find manual-order variants by exact SKU

**Status:** Ready. **Product:** Holita.

## Background

The manual-order picker displays variant SKUs, but its query currently matches only product names and reads the first 20 products. An operator who types an exact SKU or searches a common name can miss the variant they need.

## Goal

Let the operator find the intended active variant by SKU or product name from the current shop.

## Steps

1. Make the scoped picker query include exact SKU matches in its bounded result. Preserve product-name matching and allow access to further matches when the first set is full.
2. Use the result directly in the existing picker. Run codegen and the schema check if the operator contract changes.

## Done when

Typing an exact SKU returns its selectable variant even when the product name differs from the search or more than 20 products share the name. Searching a common name can reveal later matches. The picker excludes unavailable choices under its existing rules and never returns variants from another shop.

## Limits

Keep storefront catalogue search and inventory barcode search under their own contracts.

## References

- [red.bg manual-order form](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/sales/orders/partials/form.blade.php)
- [Holita picker operation](../../holita/apps/admin/src/orders/operations.graphql#L191)
- [Holita manual-order variant picker](../../holita/apps/admin/src/orders/manual-order-editor.ts#L265)
- [Holita operator product search](../../holita/apps/commerce/src/products/commerce.repository.ts#L61)
