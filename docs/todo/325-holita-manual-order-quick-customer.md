# 325 Create a contact while entering a manual order

**Status:** Ready. **Product:** Holita.

**Depends on** [192](192-holita-admin-customer-create.md).

## Background

The red.bg coverage report marks OR10 as P2. Manual order creation can select a customer but cannot create a missing contact in place.

## Goal

Create a contact while entering a manual order.

## Steps

1. Reuse the contact-only creation from 192 within the order customer selector and select the returned scoped contact without leaving the draft.

## Done when

A merchant can add a customer and continue the same manual draft with its lines and address edits intact.

## Limits

Create a contact-only customer. No shopper passwords or duplicate editor.

## References

- [red.bg `OrdersController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Sales/OrdersController.php)
- [red.bg `form.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/sales/orders/partials/form.blade.php)
- [Holita `apps/admin/src/orders/manual-order-editor.ts:115`](../../holita/apps/admin/src/orders/manual-order-editor.ts#L115)
- [Holita `apps/admin/src/customers/customer-contact-editor.ts:44`](../../holita/apps/admin/src/customers/customer-contact-editor.ts#L44)
