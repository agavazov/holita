# 258 Expire access to guest order confirmations

**Status:** Ready. **Product:** Holita.

## Background

On a shared browser, a guest order confirmation can be reopened from history with the recipient's name, email, phone and address. The browser retains the receipt key and Commerce currently accepts it without an age limit. The analysis report reproduced reopening the receipt after a reload in the same context.

## Goal

Keep guest confirmation and interrupted checkout recovery available for a short, documented window after purchase.

## Steps

1. Use the cart consumption time to enforce one guest receipt expiry across lookup by order, lookup by cart and retries of an already committed placement.
2. Remove stale guest receipt and pending-checkout entries when encountered in the browser. Keep the existing unavailable state when recovery is no longer allowed.
3. Extend the existing Commerce DB case to check a valid key, a different owner or shop, and expiry against the same order. Document the chosen access window.

## Done when

The original guest can recover a recent order after a reload or interrupted response. After expiry, the same key yields no receipt through any guest path and cannot place a duplicate order. Signed-in order history still works.

## Limits

Keep the current guest ownership and shop checks. The window governs access to the confirmation. Order and invoice retention stays under its existing policy.

## References

- [red.bg Basic checkout confirmation](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/checkout-success.blade.php)
- [Holita guest receipt storage](../../holita/apps/storefront/src/cart-state.ts#L92)
- [Holita guest confirmation ownership](../../holita/apps/commerce/src/orders/orders.repository.ts#L22)
- [Holita retry of committed placement](../../holita/apps/commerce/src/orders/orders.service.ts#L508)
- [Existing receipt regression](../../holita/apps/commerce/test/commerce.db.spec.ts#L2133)
