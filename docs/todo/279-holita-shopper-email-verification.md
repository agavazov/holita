# 279 Confirm the email address of a new shopper

**Status:** Needs owner. Can an unverified shopper sign in and place orders, and which actions require verified email? **Product:** Holita.

**Depends on** [210](210-holita-transactional-email-outbox.md).

## Background

The red.bg coverage report marks AC08 as P1. Storefront registration does not verify the initial email address. Ticket 211 handles requests to change an authenticated shopper's email.

## Goal

Confirm the email address of a new shopper.

## Steps

1. Confirm which account and checkout actions stay available before verification.
2. Persist verification state and send an expiring, single-use confirmation through ticket 210 with a scoped resend action.

## Done when

A newly registered shopper can confirm their email through the local mailbox, and checkout applies the agreed access policy for an unverified account.

## Limits

Use the same delivery path as ticket 210. Reuse verification primitives for ticket 211 where applicable.

## References

- [red.bg `auth.php`](../../../red.bg/workspace-ecommerce/services/api/routes/api/v1/auth.php)
- [red.bg `CustomerEmailVerificationService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Auth/CustomerEmailVerificationService.php)
- [Holita `apps/commerce/src/storefront.service.ts:474`](../../holita/apps/commerce/src/storefront.service.ts#L474)
- [Holita `apps/storefront/src/main.ts:150`](../../holita/apps/storefront/src/main.ts#L150)
