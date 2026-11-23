# 272 Show the selected shop currency in Admin and Basic

**Status:** Blocked. Waits for the Branch currency in ticket 270. **Product:** Holita.

**Depends on** [270](270-holita-branch-base-currency.md).

## Background

The red.bg coverage report marks PRI-04 as P1. Basic formats money in a fixed currency and Admin enters prices against the current single-currency model.

## Goal

Show the selected shop currency in Admin and Basic.

## Steps

1. Use the Branch currency and current request locale in Admin catalogue price fields and Basic catalogue and cart price displays.
2. Keep checkout totals tied to the server quote and share formatting where it already exists.

## Done when

Two shops with different approved currencies show the correct currency in their catalogue, cart and Admin price editor.

## Limits

Limit this change to current prices. Historical document currencies are covered by ticket 271.

## References

- [red.bg `StoreSettingsService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Settings/StoreSettingsService.php#L44)
- [red.bg `StoreCurrencyService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/StoreCurrencyService.php)
- [Holita `apps/storefront/src/main.ts:773`](../../holita/apps/storefront/src/main.ts#L773)
- [Holita `apps/admin/src/products/product-editor.ts:75`](../../holita/apps/admin/src/products/product-editor.ts#L75)
