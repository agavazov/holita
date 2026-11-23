# 198 Use saved addresses at checkout

**Status:** Ready after [197](197-holita-shopper-address-book.md) and [305](305-holita-shopper-address-book-ui.md). **Product:** Holita.

## Background

red.bg Basic lets a signed-in shopper choose a saved delivery address and save a new one. Holita Checkout only shows manual entry fields.

## Goal

Reduce repeat entry for signed-in shoppers.

## Steps

1. Read only the verified shopper's shipping-eligible addresses through the model in 197. Populate the delivery form from the chosen address and allow a new delivery address to be saved to that account.
2. Continue quoting and placing the order from validated address fields with a historical snapshot.

## Done when

A returning shopper can select or save a shipping address, and an address from another customer's account is unavailable. Guest checkout still works with manual entry.

## Limits

Delivery address selection only.

## References

- [red.bg checkout form](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/checkout.blade.php)
- [Holita checkout form](../../holita/apps/storefront/src/checkout-page.html)
- [red.bg checkout handling](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/CommerceController.php)
- [Holita checkout review](../../holita/apps/storefront/src/checkout-page.ts#L267)
