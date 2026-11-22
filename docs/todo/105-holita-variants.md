# 105 Product variants

**Status:** Ready. **Product:** Holita.

## Background

red.bg models simple products as a default variant and configurable products as distinct option
combinations.

## Goal

Merchants assign SKU, price and stock to each sellable product variant.

## Steps

1. Keep a shop-unique SKU, price, quantity, inventory tracking, active status and option values.
   Require unique combinations within a product and protect referenced option values from
   deletion.
2. Backfill a default variant for existing products using their current prices. Use variants as
   the source for price and stock while preserving simple-product behavior.
3. Add a Variants section to the Admin Product drawer for a default variant or editable
   combinations. Keep existing storefront cards and detail prices based on active variants.
4. Seed a simple tracked product and a two-colour cookware product with distinct SKUs, prices and
   quantities.

## Done when

A merchant can save a simple product and a product with multiple combinations. Existing active
products remain browsable and duplicate SKUs or combinations are rejected.

## Limits

Variant picking lands in 113. Keep stock editing in the product drawer until 111 adds the
inventory list.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Variant model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Catalog/ProductVariant.php)
- [Product service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/ProductService.php)
- [Admin variant editor](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/products/partials/form/variants.blade.php)
