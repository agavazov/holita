# 329 Filter the shop invoice register by document attributes

**Status:** Ready. **Product:** Holita.

**Depends on** [328](328-holita-invoice-document-fields.md).

## Background

The red.bg coverage report marks IV04 as P2. The basic register covers search by number, date or recipient. The source provides filters for the expanded invoice metadata.

## Goal

Filter the shop invoice register by document attributes.

## Steps

1. Extend the existing scoped register with filters for available payment status, method, dates, customer and source order. Include document type when the corresponding contract is present.

## Done when

A merchant can narrow the existing paginated register by the stored attributes, and invoices with missing optional fields remain accessible.

## Limits

Use the existing register. Document modeling and standalone lifecycle stay in their own tickets.

## References

- [red.bg `form.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/documents/invoices/partials/form.blade.php)
- [red.bg `filters.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/documents/invoices/partials/filters.blade.php)
- [Holita `apps/commerce/src/invoices/invoices.service.ts:77`](../../holita/apps/commerce/src/invoices/invoices.service.ts#L77)
- [Holita `apps/admin/src/orders/invoice-detail.ts:42`](../../holita/apps/admin/src/orders/invoice-detail.ts#L42)
