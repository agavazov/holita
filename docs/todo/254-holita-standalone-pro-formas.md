# 254 Define and issue standalone pro formas

**Status:** Needs owner. Approve pro forma numbering, lifecycle and any conversion to ordinary invoices. **Product:** Holita. Depends on [205](205-holita-standalone-invoices.md).

## Background

red.bg distinguishes pro forma documents from ordinary invoices. Ticket 205 covers the ordinary standalone document only.

## Goal

Let merchants issue a clearly identified pro forma under an approved document and numbering policy.

## Steps

1. Confirm the pro forma numbering, label, lifecycle and relationship to ordinary invoices.
2. Implement the approved type in the standalone editor and register while preserving ordinary invoice identity and historical records.

## Done when

An approved pro forma is distinguishable in the register and does not consume or overwrite the ordinary invoice sequence unless the approved policy calls for it.

## Limits

Pro formas only. No external accounting integration or edits to existing order invoices.

## References

- [red.bg pro forma issuance](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/InvoiceService.php)
- [Holita invoice data model](../../holita/apps/commerce/prisma/schema.prisma#L556)
