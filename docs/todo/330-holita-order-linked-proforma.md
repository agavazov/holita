# 330 Issue a pro forma linked to an existing order

**Status:** Blocked. Waits for approved pro forma and ordinary invoice numbering policies. **Product:** Holita.

**Depends on** [254](254-holita-standalone-pro-formas.md), [274](274-holita-invoice-number-sequence.md).

## Background

The red.bg coverage report marks IV10 as P2. The current order workflow issues one ordinary invoice. Ticket 254 defines standalone pro forma identity but does not link them to orders.

## Goal

Issue a pro forma linked to an existing order.

## Steps

1. Reuse the approved pro forma type and number series to issue a document from a stored order snapshot.
2. Allow a linked pro forma and a linked ordinary invoice to coexist for the same order without affecting either snapshot.

## Done when

Admin can issue and retrieve both document types from one order, with distinct permitted numbers and readable stored lines.

## Limits

Apply the separate approved numbering contract. Existing ordinary invoices are immutable.

## References

- [red.bg `InvoicesController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Documents/InvoicesController.php)
- [red.bg `InvoiceService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/InvoiceService.php)
- [Holita `apps/commerce/src/invoices/invoices.service.ts:89`](../../holita/apps/commerce/src/invoices/invoices.service.ts#L89)
- [Holita `apps/commerce/prisma/schema.prisma:701`](../../holita/apps/commerce/prisma/schema.prisma#L701)
