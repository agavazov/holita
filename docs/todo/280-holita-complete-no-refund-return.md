# 280 Complete a full return when no refund remains

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks RT06 as P1. When an approved full return concerns an unpaid order or an order whose refundable balance is already zero, the money-only path cannot complete the return.

## Goal

Complete a full return when no refund remains.

## Steps

1. Use the return approval and order-status rules to finish an eligible full return with zero money movement.
2. Restore only the original remaining stock deductions once and record the completion in the order and return history.

## Done when

An eligible unpaid or fully refunded order can complete its entire return, restores applicable stock once and creates no additional monetary refund.

## Limits

Full approved returns only. Keep payment-provider integrations excluded.

## References

- [red.bg `ReturnService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/ReturnService.php)
- [red.bg `OrderService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/OrderService.php)
- [Holita `apps/commerce/src/refunds/refunds.service.ts:51`](../../holita/apps/commerce/src/refunds/refunds.service.ts#L51)
- [Holita `apps/commerce/src/orders/orders.service.ts:188`](../../holita/apps/commerce/src/orders/orders.service.ts#L188)
