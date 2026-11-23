# 167 Filter inventory by catalogue attributes

**Status:** Ready. **Product:** Holita.

## Background

red.bg inventory has brand, category and product or variant status filters. Holita Inventory currently focuses on stock tracking and quantity.

## Goal

Let a merchant narrow inventory to selected catalogue groups and activity states.

## Steps

1. Add scoped filters for brand, category including descendants, product activity, variant activity and positive or depleted availability. Combine them with existing stock tracking and keep pagination and totals aligned.
2. Expose the filters using shared Admin filter controls and retain them in the existing list URL state.

## Done when

Selecting a parent category includes matching variants in its descendants. Combining category, activity and positive-stock filters returns the corresponding rows and count for the selected shop.

## Limits

Inventory list only. Keep adjustment behavior.

## References

- [red.bg inventory controller](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Catalog/InventoryController.php)
- [Holita inventory page](../../holita/apps/admin/src/inventory/inventory-page.ts)
- [Holita inventory contract](../../holita/apps/commerce/src/commerce.graphql)
- [red.bg inventory filtering](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/InventoryReadService.php#L16)
- [Holita current inventory filters](../../holita/apps/admin/src/inventory/inventory-page.ts#L52)
