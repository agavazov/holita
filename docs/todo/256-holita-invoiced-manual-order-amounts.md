# 256 Lock manual-order amounts after invoicing

**Status:** Ready. **Product:** Holita.

## Background

The analysis report found that an operator can issue an invoice for a placed, unpaid manual order for 10 BGN, then change its quantity or delivery fee so the order totals 20 BGN. The issued invoice keeps the original 10 BGN, and Commerce refuses a second invoice for that order.

## Goal

Preserve invoiced order lines and shipping charges once the invoice has been issued.

## Steps

1. Enforce the rule in Commerce using the same scoped order lock as invoice issuance. Reject invoice-affecting manual edits before they change stock or totals.
2. Show the same restrictions in Admin. Keep existing nonmonetary editing and the separate order status, payment and refund actions available under their current rules.
3. Extend the existing Commerce DB case to cover an edit before issue and a rejected edit afterward.

## Done when

The operator can change the quantity or shipping charge before invoicing, and the issued invoice uses that updated amount. An attempt to change either afterward leaves the order, invoice and stock unchanged and shows why the edit is unavailable.

## Limits

Keep issued invoice snapshots immutable and retain the one-invoice-per-order rule. Keep the regression inside the existing test case.

## References

- [red.bg order edits](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/OrderService.php)
- [red.bg invoice service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/InvoiceService.php)
- [Holita manual-order update](../../holita/apps/commerce/src/orders/orders.service.ts#L264)
- [Holita invoice order lock](../../holita/apps/commerce/src/invoices/invoices.repository.ts#L42)
- [Admin order actions](../../holita/apps/admin/src/orders/order-detail.ts#L138)
- [Existing Commerce DB case](../../holita/apps/commerce/test/commerce.db.spec.ts#L1329)
