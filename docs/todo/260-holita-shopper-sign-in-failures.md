# 260 Make failed shopper sign-in handling consistent

**Status:** Ready. **Product:** Holita.

## Background

Commerce returns the same sign-in error for an invalid password and a missing customer, but the missing or passwordless customer path skips password verification. The storefront Router's shared cap also means sign-in traffic consumes the same request budget as catalogue traffic. The analysis report found these differences by code review.

## Goal

Use comparable verification work for failed sign-ins and give sign-in an independent traffic limit.

## Steps

1. Apply equivalent password-verification work for missing accounts, passwordless contacts and invalid passwords. Use the existing password verifier and retain the generic rejection.
2. Cap shopper sign-in separately from normal browsing at the storefront request boundary. Preserve the existing general Router limit and shop-scoped authentication.
3. Verify successful sign-in and all three rejection paths. Verify that reaching the sign-in limit still permits a normal catalogue request.

## Done when

Invalid sign-in responses use the same public message and comparable verification work regardless of account state. A sign-in burst is limited independently of the catalogue.

## Limits

Keep the existing session and guest-cart merge behaviour. Apply the limit only to shopper sign-in.

## References

- [red.bg authentication routes](../../../red.bg/workspace-ecommerce/services/api/routes/api/v1/auth.php)
- [Holita shopper sign-in](../../holita/apps/commerce/src/storefront.service.ts#L490)
- [Holita storefront Router traffic shaping](../../holita/apps/gateway/router/storefront.yaml#L10)
