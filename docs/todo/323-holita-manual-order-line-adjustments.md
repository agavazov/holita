# 323 Set a manual order line price and discount

**Status:** Ready. **Product:** Holita.

**Depends on** [256](256-holita-invoiced-manual-order-amounts.md).

## Background

The red.bg coverage report marks OR07 as P2. Manual order lines use the catalogue price, with no explicit merchant price or discount on a line.

## Goal

Set a manual order line price and discount.

## Steps

1. Accept validated operator unit price and discount in the existing manual order write operation and snapshot both into the saved line.
2. Use the authoritative adjusted line amount in the order, newly issued invoice and refundable-amount calculation.

## Done when

An eligible manual line can save an adjustment, and the same stored amount is used throughout the order and document flow.

## Limits

No storefront overrides or edits to issued snapshots. Keep refund payments manual.

## References

- [red.bg `OrdersController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Sales/OrdersController.php)
- [red.bg `form.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/sales/orders/partials/form.blade.php)
- [Holita `apps/admin/src/orders/manual-order-editor.ts:115`](../../holita/apps/admin/src/orders/manual-order-editor.ts#L115)
- [Holita `apps/commerce/src/commerce.graphql:731`](../../holita/apps/commerce/src/commerce.graphql#L731)
