# 106 Product editor and descriptions

**Status:** Ready after [103](103-holita-categories.md), [105](105-holita-variants.md). **Product:** Holita.

## Background

The red.bg product form combines catalogue placement and descriptive content.

## Goal

Merchants edit the full set of basic product details from the Product drawer.

## Steps

1. Group name, status, brand, category, variants and BG/EN descriptions in the existing Product
   drawer. Preserve existing product links and fields.
   Make the product editor a routed child drawer with the shared `leaveDrawer` guard.
2. Return the two optional descriptions through the storefront graph and show the requested locale
   with a fallback to the other description.
3. Seed a new cookware product with Bulgarian and English descriptions and a matched brand and
   category.

## Done when

A merchant saves and reopens both descriptions and the storefront product page shows the correct
language or fallback.

## Limits

Use text descriptions. The gallery lands in 107.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Product model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Catalog/Product.php)
- [Admin product form](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/products/partials/form)
- [Basic product page](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/product.blade.php)
