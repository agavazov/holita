# 297 Combine order filters in the Admin list

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks OR02 as P2. The Admin order list has general search and a single status filter. Merchants need to narrow a busy shop's order list by several fields together.

## Goal

Combine order filters in the Admin list.

## Steps

1. Extend the existing paginated order list and generated operations with date range, multiple statuses, shipping and payment methods, customer type and selected customer. Reuse the bounded customer lookup from the manual-order picker.

## Done when

The selected filters apply together within one shop, can be cleared independently, and preserve deterministic paging.

## Limits

Reuse the existing shop order list, search and list presentation.

## References

- [red.bg `filters.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/sales/orders/partials/filters.blade.php)
- [red.bg `OrdersController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Sales/OrdersController.php)
- [Holita `apps/admin/src/orders/orders-page.ts:82`](../../holita/apps/admin/src/orders/orders-page.ts#L82)
- [Holita `apps/commerce/src/orders/orders.service.ts:188`](../../holita/apps/commerce/src/orders/orders.service.ts#L188)
