# 167 Filter inventory by catalogue attributes

**Status:** Ready. **Product:** Holita.

## Background

red.bg inventory has brand, category and product or variant status filters. Holita Inventory currently focuses on stock tracking and quantity.

## Goal

Let a merchant narrow inventory to selected catalogue groups and activity states.

## Steps

1. Add scoped filters to the Commerce inventory list, keeping existing paging and row totals.
2. Expose the filters using shared Admin filter controls and retain them in the existing list URL state.

## Done when

Combining catalogue and stock filters produces the expected list and total in a populated demo.

## Limits

Inventory list only. Keep adjustment behavior.

## References

- [red.bg inventory controller](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Catalog/InventoryController.php)
- [Holita inventory page](../../holita/apps/admin/src/inventory/inventory-page.ts)
- [Holita inventory contract](../../holita/apps/commerce/src/commerce.graphql)
