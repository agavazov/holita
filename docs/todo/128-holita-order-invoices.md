# 128 Order invoices

**Status:** Ready after [118](118-holita-admin-order-management.md). **Product:** Holita.

## Background

red.bg lets merchants create an invoice from an order and open the issued document in Admin.

## Goal

Merchants can issue and view an invoice for an order in the selected shop.

## Steps

1. Store one invoice per order with a shop-unique number, issue date, issuer and recipient
   details, order line descriptions, quantities and prices, currency, shipping fee and totals.
   Prefill the recipient and amounts from the order snapshots.
2. Add a Create Invoice action and typed drawer on Admin Order Detail. Link an issued invoice
   to an Admin document view that renders its saved details.
3. Seed an issued invoice for one demo order and leave another order available for issuing.

## Done when

A merchant can issue and reopen an invoice. Later order edits leave the issued document unchanged,
and another shop cannot issue or view it.

## Limits

Order-linked invoices in Admin only. Keep shopper downloads, credit notes and external invoicing
outside this slice.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Invoice creation from an order](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/InvoiceService.php)
- [Admin invoice routes](../../../red.bg/workspace-ecommerce/services/admin/routes/admin.php)
- [Admin invoice view](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/documents/invoices/view.blade.php)
