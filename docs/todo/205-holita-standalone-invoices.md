# 205 Issue ordinary standalone invoices

**Status:** Ready after [204](204-holita-invoice-register.md). **Product:** Holita.

## Background

red.bg can issue an invoice independently of an order. Holita issues immutable order-linked invoices, and the register in 204 provides a shared way to find invoices.

## Goal

Let merchants issue a standard standalone invoice for entered recipient details and lines.

## Steps

1. Add a scoped standalone issuance command and editor. Snapshot the recipient, issuer, lines, currency and totals, using the existing ordinary invoice conventions and shop-unique numbering.
2. Add the issued record to the existing invoice register and detail. Preserve immutable order-linked invoices.

## Done when

A merchant can issue and find an ordinary invoice without an order. Existing order-linked records and numbers remain valid.

## Limits

Ordinary issuance only. Pro forma policy, corrections and VAT changes are separate.

## References

- [red.bg invoice controller](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Documents/InvoicesController.php)
- [Holita invoice issuance](../../holita/apps/commerce/src/invoices/invoices.service.ts)
- [Holita invoice data model](../../holita/apps/commerce/prisma/schema.prisma#L556)
