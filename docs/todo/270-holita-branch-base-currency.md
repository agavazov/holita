# 270 Set the base currency for shop prices and checkout

**Status:** Blocked. Waits for the currency and lock policy in ticket 187. **Product:** Holita.

**Depends on** [187](187-holita-shop-base-currency.md).

## Background

The red.bg coverage report marks PRI-04 as P1. Checkout currently uses BGN for every shop.

## Goal

Set the base currency for shop prices and checkout.

## Steps

1. Persist the approved currency and lock rule from ticket 187 through verified Tenant and Branch settings.
2. Use that value for new catalogue prices and server checkout quotes and preserve the effective existing currency for legacy shops.

## Done when

Two eligible shops can quote in their configured currencies, and changing one shop cannot change the other shop's currency.

## Limits

One currency per Branch. Ticket 271 covers document snapshots and ticket 272 covers display.

## References

- [red.bg `StoreSettingsService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Settings/StoreSettingsService.php#L44)
- [red.bg `StoreCurrencyService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/StoreCurrencyService.php)
- [Holita `apps/commerce/src/checkout/currency.ts:1`](../../holita/apps/commerce/src/checkout/currency.ts#L1)
- [Holita `apps/commerce/src/shop-settings/shop-settings.service.ts:24`](../../holita/apps/commerce/src/shop-settings/shop-settings.service.ts#L24)
