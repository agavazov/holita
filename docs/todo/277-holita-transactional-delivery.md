# 277 Authorize and deliver live transactional email

**Status:** Needs owner. Which live transport, sender and recipient rules may Holita use for transactional email? **Product:** Holita.

## Background

The red.bg coverage report marks NT03 as P1. The local mailbox makes transactional messages testable. Live delivery requires a route explicitly allowed by the owner.

## Goal

Authorize and deliver live transactional email.

## Steps

1. Confirm the permitted transport, approved senders and recipients, and who can see delivery outcomes.
2. Use the existing transactional delivery seam and record delivery outcomes on each queued message after approval.

## Done when

An authorized order notice is delivered through the named approved transport and its outcome can be inspected. Local development can still use the mailbox.

## Limits

Transactional email only. Keep excluded provider integrations outside the migration unless the owner explicitly changes the exclusion.

## References

- [red.bg `OrderCustomerMailer.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Notifications/OrderCustomerMailer.php)
- [red.bg `EmailQueueDrainer.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Notifications/EmailQueueDrainer.php)
- [Holita `apps/commerce/src/orders/orders.service.ts:188`](../../holita/apps/commerce/src/orders/orders.service.ts#L188)
