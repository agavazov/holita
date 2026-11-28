# 278 Recover a forgotten shopper password through local delivery

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks AC07 as P1. Shopper sign-in has no forgotten-password recovery flow.

## Goal

Recover a forgotten shopper password through local delivery.

## Steps

1. Add a shop-scoped request with the same visible response for known and unknown email addresses, and issue an expiring, single-use reset through the local mailbox.

## Done when

A shopper can set a new password through the local message and sign in with it. Expired, reused or other-shop links cannot reset that account.

## Limits

Use local delivery until ticket 277 is approved. Keep Core operator sign-in outside this flow.

## References

- [red.bg `auth.php`](../../../red.bg/workspace-ecommerce/services/api/routes/api/v1/auth.php)
- [red.bg `CustomerPasswordResetService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Auth/CustomerPasswordResetService.php)
- [Holita `apps/commerce/src/storefront.service.ts:223`](../../holita/apps/commerce/src/storefront.service.ts#L223)
- [Holita `apps/storefront/src/main.ts:154`](../../holita/apps/storefront/src/main.ts#L154)
