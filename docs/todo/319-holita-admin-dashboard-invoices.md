# 319 Show invoice activity on the shop dashboard

**Status:** Ready after [328](328-holita-invoice-document-fields.md). **Product:** Holita.

## Background

The red.bg dashboard summarizes paid, unpaid and overdue invoices, groups invoice amounts by issue date and links to recent documents. Holita has a shop dashboard. The invoice register links to issued document details.

## Goal

Let a merchant see invoice balances and follow recent invoices to their existing details.

## Steps

1. Extend the dashboard read with invoice counts and amounts by payment status, overdue amounts based on saved due dates and daily invoice amounts by issue date and current payment status.
2. Add a compact panel using shared Admin patterns and route recent invoices to their existing details. Include older invoices with missing fields only in totals supported by their recorded values.

## Done when

Paid, unpaid and overdue invoices contribute to the corresponding totals for their shop. The daily series reflects issue dates, and recent links open existing snapshots.

## Limits

Invoice reporting only. Use the delivered payment and due-date fields and the existing register and detail. Do not introduce status edits or recreate history.

## References

- [red.bg invoice dashboard metrics](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/DashboardService.php#L152)
- [red.bg invoice dashboard panel](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/dashboard/index.blade.php#L122)
- [Holita invoice snapshot](../../holita/apps/commerce/src/commerce.graphql#L791)
- [Invoice register](204-holita-invoice-register.md)
