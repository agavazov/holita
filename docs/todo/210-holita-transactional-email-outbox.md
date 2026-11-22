# 210 Capture transactional order email in a local mailbox

**Status:** Ready. **Product:** Holita.

## Background

red.bg queues order placement and status emails. Holita has on-screen receipts and status history but no local transactional delivery path.

## Goal

Produce localized order notices and deliver them to a local recipient-capture sink for internal releases.

## Steps

1. Record scoped order placement and selected status notices using BG/EN templates. Distinguish one notice per template and source event so retries do not duplicate delivery.
2. Deliver messages to a local recipient-capture sink that preserves the intended recipient and supports reading the message in development. Reuse the same delivery path for later verification flows.

## Done when

A demo order and supported transitions produce the expected messages in the local mailbox. Repeated processing does not send duplicates.

## Limits

Local capture only. Staff inspection is in 249. Live delivery requires owner approval and is outside this ticket.

## References

- [red.bg order customer mailer](../../../red.bg/workspace-ecommerce/services/api/app/Services/Notifications/OrderCustomerMailer.php)
- [Holita order placement](../../holita/apps/commerce/src/orders/orders.service.ts)
- [Holita checkout](../../holita/apps/commerce/src/checkout/checkout.service.ts)
