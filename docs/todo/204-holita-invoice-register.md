# 204 List invoices across the shop

**Status:** Ready. **Product:** Holita.

## Background

red.bg has a dedicated Admin invoice register. Holita reaches issued invoices from Order Detail.

## Goal

Let merchants find issued invoices without finding the underlying order first.

## Steps

1. Add a scoped, paginated invoice list query with number/date and recipient search as supported.
2. Add the Admin Invoices page with shared states and links to the existing invoice detail.

## Done when

A merchant can find an issued invoice in the selected shop and open its recorded detail.

## Limits

Read-only register. Invoice creation, amendment and downloads are separate.

## References

- [red.bg invoices routes](../../../red.bg/workspace-ecommerce/services/admin/routes/admin.php)
- [Holita invoice details](../../holita/apps/admin/src/orders/invoice-detail.ts)
- [Holita operator SDL](../../holita/apps/commerce/src/commerce.graphql)
