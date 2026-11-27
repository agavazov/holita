# 295 Choose and save a shopper billing address at checkout

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks CK04 as P2. Checkout supports a separate billing snapshot and
already lets signed-in shoppers choose a saved delivery address.

## Goal

Choose and save a shopper billing address at checkout.

## Steps

1. Reuse the address book and ownership checks to let a signed-in shopper choose a saved billing address or opt to save a new billing address at checkout.
2. Copy the chosen billing address through the existing order snapshot flow.

## Done when

The signed-in shopper can use or save their own billing address. Guests still enter an address manually, and no address from another shop can be selected.

## Limits

One checkout workflow and the shared address model. Keep guest persistence outside this ticket.

## References

- [red.bg `CommerceController.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/CommerceController.php)
- [red.bg `checkout.blade.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/checkout.blade.php)
- [Holita `apps/storefront/src/checkout-page.ts:102`](../../holita/apps/storefront/src/checkout-page.ts#L102)
- [Holita `apps/commerce/src/checkout/checkout.service.ts:87`](../../holita/apps/commerce/src/checkout/checkout.service.ts#L87)
