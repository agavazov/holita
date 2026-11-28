# 333 Approve and export a local monthly sales audit file

**Status:** Needs owner. Should Holita generate local NRA audit XML, and which format and records should it include? **Product:** Holita.

**Depends on** [209](209-holita-invoice-vat-snapshots.md).

## Background

The red.bg coverage report marks IV16 as P2. The source can generate a local NRA audit XML for a shop and month. Holita currently has no approved export contract.

## Goal

Approve and export a local monthly sales audit file.

## Steps

1. Confirm which XML format, source records and period rules are required for Holita.
2. Provide a shop-authorized local export of approved sales and return records and validate it against the approved format.

## Done when

An authorized requester can download a valid file for one shop and month, including the approved sales and return records only.

## Limits

Local file generation only. Exclude submission to an authority or provider integration.

## References

- [red.bg `NraAuditController.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Documents/NraAuditController.php)
- [Holita `apps/commerce/src/invoices/invoices.service.ts:77`](../../holita/apps/commerce/src/invoices/invoices.service.ts#L77)
- [Holita `apps/commerce/src/refunds/refunds.service.ts:51`](../../holita/apps/commerce/src/refunds/refunds.service.ts#L51)
