# 200 Add a shopper note at checkout

**Status:** Ready. **Product:** Holita.

## Background

red.bg Basic checkout sends an optional shopper note. Holita supports a merchant note for manual orders but does not capture a shopper note.

## Goal

Allow the shopper to pass an order instruction to the merchant.

## Steps

1. Add a localized, bounded note field to checkout and save the text as a scoped order snapshot.
2. Show the shopper note in Order Detail and the shopper's confirmation and account order where appropriate.

## Done when

An order with a note shows it to its merchant and its shopper. Operator-only notes stay private.

## Limits

One plain-text note. No messaging thread.

## References

- [red.bg checkout](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/CommerceController.php)
- [Holita checkout](../../holita/apps/storefront/src/checkout-page.html)
- [Holita order detail](../../holita/apps/admin/src/orders/order-detail.html)
