# 332 Render invoice original and copy labels for printing

**Status:** Blocked. Waits for stored tax rendering in ticket 255. **Product:** Holita.

**Depends on** [255](255-holita-invoice-vat-rendering.md).

## Background

The red.bg coverage report marks IV13 as P2. Holita downloads one PDF per snapshot. Ticket 255 covers stored VAT rendering. The source also allows original and copy variants and printing.

## Goal

Render invoice original and copy labels for printing.

## Steps

1. Render the approved original or copy label via the same immutable invoice snapshot and authorized renderer. Expose the supported print action from Admin.

## Done when

Operators can print or download the supported labeled versions of one invoice, and all amounts and stored details agree.

## Limits

Reuse one renderer and authorization boundary. Keep external document services out.

## References

- [red.bg `InvoicesController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Documents/InvoicesController.php)
- [red.bg `InvoicePdfService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/InvoicePdfService.php)
- [Holita `apps/admin/src/orders/invoice-detail.html:3`](../../holita/apps/admin/src/orders/invoice-detail.html#L3)
- [Holita `apps/commerce/src/invoices/invoices.service.ts:80`](../../holita/apps/commerce/src/invoices/invoices.service.ts#L80)
