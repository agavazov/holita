# 206 Download the existing issued invoice snapshot

**Status:** Ready. **Product:** Holita.

## Background

red.bg Admin serves a rendered invoice. Holita shows an issued order-linked invoice on screen from stored fields.

## Goal

Let an authorized merchant download a PDF containing the current invoice snapshot fields.

## Steps

1. Render the stored issuer, recipient, lines, currency and totals from the existing invoice snapshot. Omit unavailable VAT amounts and rates and make no inference about their values.
2. Add the download in Admin Invoice Detail and verify Tenant and Branch on every read.

## Done when

The downloaded document matches the recorded fields even after an order change. A merchant in a different shop cannot read it.

## Limits

One PDF for the current invoice snapshot. VAT rendering is a separate ticket after VAT values are recorded.

## References

- [red.bg renderer](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/InvoicePdfService.php#L35)
- [Holita invoice snapshot service](../../holita/apps/commerce/src/invoices/invoices.service.ts)
- [Holita invoice detail](../../holita/apps/admin/src/orders/invoice-detail.html)
