# 211 Verify a shopper email change using local delivery

**Status:** Ready after [210](210-holita-transactional-email-outbox.md). **Product:** Holita.

## Background

red.bg Basic lets a shopper request, resend and cancel an email change and verify it from the new mailbox. Ticket 210 provides local recipient capture.

## Goal

Let a signed-in shopper verify a replacement shop email for internal use.

## Steps

1. Bind each request to the verified shopper and shop. Verify uniqueness and send the expiring, single-use proof to the new address through the local capture path. Invalidate superseded or cancelled proofs.
2. Add localized request, resend, cancel and confirmation states. Change the sign-in email only after verification.

## Done when

The intended new recipient can confirm from the local mailbox. An expired or reused proof fails, and the original email stays valid until confirmation.

## Limits

Internal release and local delivery only. Live email remains owner-gated. Keep merchant-initiated correction separate.

## References

- [red.bg account controller](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/AccountController.php)
- [Holita account shell](../../holita/apps/storefront/src/main.ts)
- [Holita shopper authentication](../../holita/apps/commerce/src/storefront.service.ts)
