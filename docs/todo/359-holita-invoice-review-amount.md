# 359 Confirm the reviewed order amount before issuing an invoice

**Status:** Ready. **Product:** Holita.

## Background

Independent review HLR-01 identified this behavior at `1b44cc90`. An unpaid manual order can change between the invoice preview and issuance. Issuance currently uses the latest order values while the editor still shows the previous amount.

## Goal

Confirm the reviewed order amount before issuing an invoice.

## Steps

Carry the reviewed order state through issuance and compare the relevant lines and totals before committing the invoice. Show changed amounts for confirmation.

## Done when

A preview of 10 EUR cannot issue a 20 EUR invoice without a renewed confirmation. An unchanged order still issues normally.

## Limits

Order-linked invoices before issuance. Existing correction policy is separate.

## References

- [invoice-editor.html](../../holita/apps/admin/src/orders/invoice-editor.html#L147)
- [invoice-editor.ts](../../holita/apps/admin/src/orders/invoice-editor.ts#L359)
- [manual-order-lines.ts](../../holita/apps/commerce/src/orders/manual-order-lines.ts#L104)
- [invoices.repository.ts](../../holita/apps/commerce/src/invoices/invoices.repository.ts#L116)
