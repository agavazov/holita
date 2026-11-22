# 156 Show storefront account, sign-in and cart request states

**Status:** Ready. **Product:** Holita.

## Background

Sign In and Register show the form before shop lookup completes. My Account can show signed-out links after a failed read. The cart also bypasses the shop lookup state, and authentication forms give little feedback on invalid input or a pending submit.

## Goal

Make storefront shop and account states clear in Bulgarian and English.

## Steps

1. Use the existing storefront loading, error, retry and missing-shop states before opening account, authentication or cart content. Show signed-out actions only after a successful account read without a shopper. Preserve the cart's own request states.
2. Add accessible BG/EN form validation and submitting feedback for registration name, email and password as applicable. Treat action failures separately from shop lookup, without exposing whether an email exists.

## Done when

A slow or failed shop lookup gives the same recoverable feedback on Account, Sign In, Register and Cart. The forms explain invalid input and a failed submission in BG and EN.

## Limits

Keep existing authentication, session, cart merge and cart operations.

## References

- [Storefront shell and forms](../../holita/apps/storefront/src/main.ts)
- [Storefront messages](../../holita/apps/storefront/src/storefront-messages.ts)
- [Cart view](../../holita/apps/storefront/src/cart-page.html)
