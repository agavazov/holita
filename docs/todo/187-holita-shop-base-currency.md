# 187 Configure a shop's base currency

**Status:** Needs owner. Confirm supported currencies and the lock-in policy for each shop. **Product:** Holita.

## Background

red.bg General Settings has a base currency. Holita checkout is configured for BGN and queue 126 explicitly keeps currency outside the general settings form.

## Goal

Allow merchants to use an approved base currency for new shops.

## Steps

1. Confirm supported currency choices and when the base currency becomes locked.
2. Persist the shop currency and use it for new catalogue prices, checkout quotes and order and invoice snapshots.

## Done when

An approved non-default shop currency appears consistently on new prices and orders. Existing documents retain their recorded currency.

## Limits

One currency per shop. No conversions, rates, provider integration or redenomination of existing shops.

## References

- [red.bg settings service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Settings/StoreSettingsService.php)
- [Holita currency constant](../../holita/apps/commerce/src/checkout/currency.ts)
- [General settings queue](../../docs/todo/126-holita-general-settings.md)
