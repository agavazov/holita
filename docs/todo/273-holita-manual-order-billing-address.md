# 273 Capture a separate billing address on manual Admin orders

**Status:** Ready. **Product:** Holita.

**Depends on** [199](199-holita-checkout-billing-address.md).

## Background

The red.bg coverage report marks OR12 as P1. Manual order creation has a shipping address. Ticket 199 adds the separate billing snapshot for storefront checkout.

## Goal

Capture a separate billing address on manual Admin orders.

## Steps

1. Extend the manual order form and scoped operations to accept a separate billing address or the same address as shipping.
2. Reuse ticket 199's snapshot and validation, and show the saved billing value on order detail without affecting earlier issued invoices.

## Done when

A new eligible manual order can save and display a different billing address, and order details with no separate address remain readable.

## Limits

Saved address selection is separate. Order and invoice history follow their existing snapshot rules.

## References

- [red.bg `OrdersController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Sales/OrdersController.php)
- [red.bg `form.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/sales/orders/partials/form.blade.php)
- [Holita `apps/admin/src/orders/manual-order-editor.ts:73`](../../holita/apps/admin/src/orders/manual-order-editor.ts#L73)
- [Holita `apps/commerce/src/commerce.graphql:741`](../../holita/apps/commerce/src/commerce.graphql#L741)
