# 328 Save explicit payment and issuer fields on new invoices

**Status:** Ready. **Product:** Holita.

**Depends on** [203](203-holita-invoice-issuer-settings.md).

## Background

The red.bg coverage report marks IV04 as P2. Current invoices have basic issuer, recipient and amount snapshots. Merchants need the fields represented on their issued documents and payment status for reporting.

## Goal

Save explicit payment and issuer fields on new invoices.

## Steps

1. Add the implemented source's optional tax-event date, due date/payment terms, method, paid or unpaid status, issuer representative and bank fields, reason, note and line unit to new ordinary invoice snapshots.
2. Use the current editor and detail, apply the appropriate immutable snapshot rules and leave historical records readable with absent optional values.

## Done when

Admin can issue and read a new invoice with those fields, including a due date and explicit payment state distinct from issue and due dates. Stored historical values are unchanged.

## Limits

Keep VAT values in 209, rendered documents in 206/255 and advanced registry filters in 329. No external banking integrations.

## References

- [red.bg `form.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/documents/invoices/partials/form.blade.php)
- [red.bg `filters.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/documents/invoices/partials/filters.blade.php)
- [Holita `apps/admin/src/orders/invoice-editor.ts:69`](../../holita/apps/admin/src/orders/invoice-editor.ts#L69)
- [Holita `apps/commerce/prisma/schema.prisma:701`](../../holita/apps/commerce/prisma/schema.prisma#L701)
