# 150 Recover guest orders after an interrupted checkout

**Status:** Ready. **Product:** Holita.

## Background

A committed guest checkout can lose its response. The storefront currently holds the reviewed cart ID in memory and clears the guest cart credential when reloading a consumed cart. The customer can lose their receipt and order again from a new cart.

## Goal

A guest can reopen confirmation for their placed order after reloading an interrupted checkout.

## Steps

1. Retain the pending cart ID and the original guest credential through reload for the current Branch. Preserve the credential while resolving the placement outcome.
2. Look up the placed order using the original cart ID and credential, scoped to the verified Tenant and Branch. Use the existing order confirmation view when the lookup succeeds.
3. If the cart is still active, let the guest resume checkout and review the order. When confirmation is recovered, clear the pending checkout and retain the existing receipt credential.

## Done when

If the server commits placement but the response is lost, reloading checkout recovers the existing confirmation and leaves a single order and stock deduction. A different Branch or credential cannot recover that order. If placement did not commit, the guest can review and place their active cart again.

## Limits

Use the existing receipt and cart ownership rules. Do not persist checkout contact details or automatically submit a fresh order on reload.

## References

- [Storefront placement and confirmation](../../holita/apps/storefront/src/checkout-page.ts#L287)
- [Guest cart credential handling](../../holita/apps/storefront/src/cart-state.ts#L111)
- [Commerce placement retry](../../holita/apps/commerce/src/orders/orders.service.ts#L478)
