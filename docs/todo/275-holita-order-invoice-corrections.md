# 275 Define correction for an issued order invoice

**Status:** Needs owner. Which correction or cancellation action is permitted for issued order-linked invoices, and what history must stay visible? **Product:** Holita.

**Depends on** [204](204-holita-invoice-register.md).

## Background

The red.bg coverage report marks IV08 as P1. Holita issues immutable linked invoice snapshots. Ticket 217 concerns standalone documents.

## Goal

Define correction for an issued order invoice.

## Steps

1. Confirm the permissible correction or cancellation action, document trail and operator who can perform it.
2. Implement the approved action through the linked invoice workflow with the original snapshot and number preserved.

## Done when

An authorized operator can resolve an incorrect issued order invoice through the approved process and see the full history.

## Limits

Exclude credit-note behavior unless separately authorized. Reuse the agreed standalone lifecycle where applicable.

## References

- [red.bg `InvoicesController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Documents/InvoicesController.php)
- [red.bg `InvoiceService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/InvoiceService.php)
- [Holita `apps/commerce/src/invoices/invoices.service.ts:89`](../../holita/apps/commerce/src/invoices/invoices.service.ts#L89)
- [Holita `apps/admin/src/orders/invoice-detail.html:3`](../../holita/apps/admin/src/orders/invoice-detail.html#L3)
