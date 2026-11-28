# 249 Inspect transactional notices and exercise local delivery

**Status:** Ready. **Product:** Holita.

## Background

red.bg Backoffice lists queued email and can send a restricted sample to exercise delivery. Holita captures transactional email in Commerce, and Holita Backoffice has no email screen. Inspection uses the same resolved delivery state as local capture.

## Goal

Let authorized staff see local delivery outcomes and exercise the same path with a sample message.

## Steps

1. Add a scoped, authorized Backoffice list and detail showing recorded timing and delivery state. Omit verification tokens and other credential-bearing message content from staff responses. Link the destination from existing Backoffice navigation or home.
2. Send a fixed sample only to the signed-in staff address or an approved internal allowlist. Route the sample through the same capture sink as ordinary notices and show the actual delivery result.

## Done when

Staff can inspect a seeded notice and confirm that an allowed sample arrives in the local mailbox. Unauthorized reads and arbitrary recipients are rejected.

## Limits

Local inspection and sample delivery only. Live email requires owner approval.

## References

- [red.bg Backoffice email controller](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/System/EmailsController.php)
- [Holita Backoffice entry](../../holita/apps/backoffice/src/main.ts)
- [red.bg recorded delivery outcome](../../../red.bg/workspace-ecommerce/services/api/app/Services/Notifications/EmailQueueDrainer.php)
- [Holita Backoffice route registration](../../holita/apps/backoffice/src/main.ts#L9)
