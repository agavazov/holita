# 255 Render stored invoice VAT in downloaded documents

**Status:** Blocked. Waiting for the approved VAT snapshots in 209. **Product:** Holita. Depends on [209](209-holita-invoice-vat-snapshots.md).

## Background

red.bg PDF renders the stored VAT rates and amounts. The Holita PDF renderer uses the current snapshot fields. Ticket 209 covers approved VAT values on new snapshots.

## Goal

Show the saved VAT breakdown on invoice detail and downloaded copies when it exists.

## Steps

1. Render the persisted line and total VAT amounts from 209 in the existing invoice detail and the existing PDF renderer. Shopper history in 207 must use that same renderer.
2. Keep older invoices readable and omit the VAT breakdown when the snapshot lacks it.

## Done when

The merchant invoice detail and PDF display the same saved VAT breakdown for a new taxable invoice. An older snapshot displays no inferred rates.

## Limits

Rendering only. Use stored amounts and rates.

## References

- [red.bg VAT rendering](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/InvoicePdfService.php#L35)
- [Holita invoice detail](../../holita/apps/admin/src/orders/invoice-detail.html)
- [Holita invoice snapshot contract](../../holita/apps/commerce/src/commerce.graphql#L791)
