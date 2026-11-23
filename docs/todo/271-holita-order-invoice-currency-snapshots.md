# 271 Snapshot currency on new orders and invoices

**Status:** Blocked. Waits for the Branch currency in ticket 270. **Product:** Holita.

**Depends on** [270](270-holita-branch-base-currency.md).

## Background

The red.bg coverage report marks PRI-04 as P1. Order and invoice amounts are stored as historical snapshots. New documents need their own currency source once a shop has a configurable currency.

## Goal

Snapshot currency on new orders and invoices.

## Steps

1. Snapshot the approved effective currency when creating a new order or standalone invoice, using the order's stored currency for a linked invoice.
2. Keep historical documents readable with their recorded currency and amounts, using the approved legacy meaning for records without a saved value.

## Done when

A new order and linked invoice agree on currency. Historical orders and invoices retain their complete totals and original currency.

## Limits

Keep payment and delivery manual. Exclude currency conversion.

## References

- [red.bg `StoreSettingsService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Settings/StoreSettingsService.php#L44)
- [red.bg `StoreCurrencyService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/StoreCurrencyService.php)
- [Holita `apps/commerce/src/orders/orders.service.ts:188`](../../holita/apps/commerce/src/orders/orders.service.ts#L188)
- [Holita `apps/commerce/src/invoices/invoices.service.ts:89`](../../holita/apps/commerce/src/invoices/invoices.service.ts#L89)
