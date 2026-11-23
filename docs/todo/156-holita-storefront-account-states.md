# 156 Show storefront account, sign-in and cart request states

**Status:** Ready. **Product:** Holita.

## Background

Sign In and Register show the form before shop lookup completes. My Account can show signed-out links after a failed read. The cart also bypasses the shop lookup state, and authentication forms give little feedback on invalid input or a pending submit.

## Goal

Make storefront shop and account states clear in Bulgarian and English.

## Steps

1. Use the existing storefront loading, error, retry and missing-shop states before opening account, authentication or cart content. Show signed-out actions only after a successful account read without a shopper. Preserve the cart's own request states.
2. Show accessible BG/EN messages beside invalid email and password fields in Sign In and beside invalid name, email and password fields in Register. Show submitting feedback and keep the generic credential failure separate from a shop lookup failure.

## Done when

A slow or failed shop lookup gives the same recoverable feedback on Account, Sign In, Register and Cart. A failed account read shows an error and offers retry. The forms explain invalid fields and failed submissions in BG and EN.

## Limits

Keep existing authentication, session, cart merge and cart operations.

## References

- [red.bg shopper sign-in and registration](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/CustomerAuthController.php)
- [Sign-in and registration](../../holita/apps/storefront/src/main.ts#L433)
- [Shop and account route handling](../../holita/apps/storefront/src/main.ts#L850)
- [Storefront messages](../../holita/apps/storefront/src/storefront-messages.ts)
- [Cart view](../../holita/apps/storefront/src/cart-page.html)
