# 111 Inventory list and adjustments

**Status:** Ready after [105](105-holita-variants.md). **Product:** Holita.

## Background

red.bg provides variant stock counts and quantity adjustments in Inventory.

## Goal

Merchants review and adjust tracked stock across the shop.

## Steps

1. List product, variant, SKU, tracking status and quantity. Add search by product or SKU and
   filters for tracked and out-of-stock variants.
2. Add the Admin Inventory list and quantity drawer. Reuse the variant stock field and reject
   negative quantities or quantity edits for untracked variants.
3. Expose availability, rather than raw counts, to the storefront. Seed new products with
   out-of-stock and untracked variants alongside stocked fixtures.

## Done when

An adjustment updates the Product drawer and public availability immediately, and an untracked
variant stays sellable.

## Limits

One stock quantity per variant. Receiving and purchasing workflows are outside this slice.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Inventory service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/InventoryService.php)
- [Inventory read service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/InventoryReadService.php)
- [Admin Inventory](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/inventory/index.blade.php)
