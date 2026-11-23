# 206 Download the existing issued invoice snapshot

**Status:** Ready. **Product:** Holita.

## Background

red.bg Admin serves a rendered invoice. Holita shows an issued order-linked invoice on screen from stored fields.

## Goal

Let an authorized merchant download a PDF containing the current invoice snapshot fields.

## Steps

1. Render the stored issuer, recipient, lines, currency and totals from the existing invoice snapshot. Omit unavailable VAT amounts and rates and make no inference about their values.
2. Add the download from the issued invoice view reached through Order Detail. Use the same scoped snapshot lookup as Invoice Detail and expose the renderer for later shopper access and VAT fields.

## Done when

The downloaded document matches the recorded fields even after an order change. A merchant in a different shop cannot read it.

## Limits

One PDF for the current invoice snapshot. Shopper access follows in 207 and VAT rendering follows in 255.

## References

- [red.bg renderer](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/InvoicePdfService.php#L35)
- [Holita invoice snapshot service](../../holita/apps/commerce/src/invoices/invoices.service.ts)
- [Holita invoice detail](../../holita/apps/admin/src/orders/invoice-detail.html)
- [Holita scoped invoice lookup](../../holita/apps/commerce/src/invoices/invoices.service.ts#L85)
- [Holita invoice detail loader](../../holita/apps/admin/src/orders/invoice-detail.ts#L62)
