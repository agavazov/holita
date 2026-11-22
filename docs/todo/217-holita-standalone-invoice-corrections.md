# 217 Define how standalone invoices are corrected

**Status:** Needs owner. Approve correction, retention and numbering policy for issued documents. **Product:** Holita. Depends on [205](205-holita-standalone-invoices.md).

## Background

red.bg Admin implements invoice update and removal. Holita preserves issued order invoice snapshots, and standalone issue has a separate slice.

## Goal

Give merchants an approved way to correct or void a standalone document.

## Steps

1. Confirm which states and document types are editable or voidable and what must be retained in the register.
2. Add only the approved transitions with a visible recorded correction history.

## Done when

An operator can correct or void an eligible document without changing the issued history that the retention policy protects.

## Limits

Standalone and pro forma documents only. Keep existing order invoice snapshots immutable.

## References

- [red.bg invoice update and delete](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/InvoiceService.php)
- [Holita issued invoice detail](../../holita/apps/admin/src/orders/invoice-detail.ts)
