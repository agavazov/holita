# 331 Issue a linked ordinary invoice when an order is marked paid

**Status:** Blocked. Waits for the invoice issuer settings, approved VAT and ordinary invoice numbering. **Product:** Holita.

**Depends on** [203](203-holita-invoice-issuer-settings.md), [209](209-holita-invoice-vat-snapshots.md), [274](274-holita-invoice-number-sequence.md).

## Background

The red.bg coverage report marks IV11 as P2. Holita records a manual payment independently from invoice issuance. The source can issue the ordinary invoice after marking an order paid.

## Goal

Issue a linked ordinary invoice when an order is marked paid.

## Steps

1. Use approved issuer, VAT and invoice numbering settings to request one linked ordinary invoice on the eligible paid transition.
2. Reuse the existing issue path and its duplicate rules. An ordinary invoice already present satisfies the transition and a pro forma does not.

## Done when

An eligible paid order results in one ordinary paid invoice, and a repeated transition does not create a second issued document.

## Limits

Manual payment only. Automatic external payment confirmation stays excluded.

## References

- [red.bg `RaiseInvoiceForPaidOrder.php`](../../../red.bg/workspace-ecommerce/services/api/app/Listeners/RaiseInvoiceForPaidOrder.php)
- [red.bg `InvoiceService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/InvoiceService.php)
- [Holita `apps/commerce/src/orders/orders.service.ts:188`](../../holita/apps/commerce/src/orders/orders.service.ts#L188)
- [Holita `apps/commerce/src/invoices/invoices.service.ts:89`](../../holita/apps/commerce/src/invoices/invoices.service.ts#L89)
