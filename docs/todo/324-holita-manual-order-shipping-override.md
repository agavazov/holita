# 324 Override the shipping fee on one manual order

**Status:** Ready. **Product:** Holita.

**Depends on** [256](256-holita-invoiced-manual-order-amounts.md).

## Background

The red.bg coverage report marks OR08 as P2. The manual order uses the selected method's default shipping fee. Merchants sometimes need to enter the amount agreed for one order.

## Goal

Override the shipping fee on one manual order.

## Steps

1. Allow an authorized operator to enter a validated per-order shipping fee and persist it in the existing order monetary snapshot.

## Done when

The selected method keeps its default fee, while this eligible manual order shows and totals the explicit fee through the normal downstream snapshot workflow.

## Limits

Manual order only. Keep issued invoices intact and use the existing currency and money representation.

## References

- [red.bg `OrdersController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Sales/OrdersController.php)
- [red.bg `form.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/sales/orders/partials/form.blade.php)
- [Holita `apps/admin/src/orders/manual-order-editor.ts:200`](../../holita/apps/admin/src/orders/manual-order-editor.ts#L200)
- [Holita `apps/commerce/src/commerce.graphql:741`](../../holita/apps/commerce/src/commerce.graphql#L741)
