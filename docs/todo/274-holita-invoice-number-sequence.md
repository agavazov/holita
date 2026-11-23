# 274 Assign shop invoice numbers automatically

**Status:** Needs owner. Which numbering series, starting number and gap policy should Holita use for new ordinary invoices? **Product:** Holita.

## Background

The red.bg coverage report marks IV05 as P1. Holita currently requires an operator to supply a unique number for an invoice linked to an order.

## Goal

Assign shop invoice numbers automatically.

## Steps

1. Confirm the numbering policy and initial sequence with the owner, including coexistence with the existing manual numbers.
2. Allocate the next allowed number within the scoped issue operation and preserve all historical numbers.

## Done when

Two newly issued linked invoices in the same shop get distinct valid numbers, and an issue failure cannot leave a duplicate document.

## Limits

Keep this to ordinary order-linked invoices. Apply the approved policy to any future standalone or pro forma series independently.

## References

- [red.bg `InvoiceService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/InvoiceService.php)
- [Holita `apps/commerce/src/invoices/invoices.service.ts:43`](../../holita/apps/commerce/src/invoices/invoices.service.ts#L43)
- [Holita `apps/admin/src/orders/invoice-editor.ts:49`](../../holita/apps/admin/src/orders/invoice-editor.ts#L49)
