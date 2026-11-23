# 361 Refresh the reviewed quote after header cart edits

**Status:** Ready. **Product:** Holita.

## Background

Independent review HLR-03 identified this behavior at `1b44cc90`. Changing quantity in the header cart can leave a previously reviewed checkout summary on screen. Commerce rejects the outdated confirmation.

## Goal

Refresh the reviewed quote after header cart edits.

## Steps

Connect a successful change in the shared cart to the checkout review state. Require a current summary before confirmation.

## Done when

Changing two items to one in the header cart while at checkout shows quantity one and requires the updated review.

## Limits

Same-shop checkout and cart edits.

## References

- [main.ts](../../holita/apps/storefront/src/main.ts#L164)
- [cart-preview.ts](../../holita/apps/storefront/src/cart-preview.ts#L84)
- [checkout-page.ts](../../holita/apps/storefront/src/checkout-page.ts#L165)
- [checkout-page.html](../../holita/apps/storefront/src/checkout-page.html#L297)
