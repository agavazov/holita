# 198 Use saved addresses at checkout

**Status:** Ready after [197](197-holita-shopper-address-book.md). **Product:** Holita.

## Background

red.bg Basic lets a signed-in shopper choose a saved delivery address and save a new one. Holita Checkout only shows manual entry fields.

## Goal

Reduce repeat entry for signed-in shoppers.

## Steps

1. Load the shopper's address book in checkout. Populate the delivery form from the chosen address and allow a new address to be saved to that account.
2. Continue quoting and placing the order from validated address fields with a historical snapshot.

## Done when

A returning shopper can select or save an address. Guest checkout still works with manual entry.

## Limits

Delivery address selection only.

## References

- [red.bg checkout form](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/checkout.blade.php)
- [Holita checkout form](../../holita/apps/storefront/src/checkout-page.html)
