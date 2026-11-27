# 322 Copy a saved customer address into a manual order

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks OR06 as P2. Manual orders currently require typing an address already held in the customer address book.

## Goal

Copy a saved customer address into a manual order.

## Steps

1. Load eligible addresses for the selected scoped customer and copy the chosen record into the order form and snapshot.

## Done when

A merchant can choose the selected customer's saved address, edit the order copy and save without changing the address book or earlier orders.

## Limits

Use the shared address model. Any separate saved billing selector should reuse the existing manual billing snapshot.

## References

- [red.bg `OrdersController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Sales/OrdersController.php)
- [red.bg `form.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/sales/orders/partials/form.blade.php)
- [Holita `apps/admin/src/orders/manual-order-editor.ts:73`](../../holita/apps/admin/src/orders/manual-order-editor.ts#L73)
- [Holita `apps/commerce/src/orders/orders.service.ts:188`](../../holita/apps/commerce/src/orders/orders.service.ts#L188)
