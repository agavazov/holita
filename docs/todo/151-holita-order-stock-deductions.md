# 151 Preserve sold variant links for stock restoration

**Status:** Ready. **Product:** Holita.

## Background

Product saves can detach an order line from its sold variant or reuse that variant ID for a different option combination. Cancellation and refund restocks follow the saved variant link.

## Goal

Keep stock restoration linked to the variant originally sold.

## Steps

1. In the scoped product save, preserve variants with outstanding order deductions. Allow deactivation and reject deletion or reassignment to a different option combination while eligible deductions remain.
2. Verify cancellation and a full refund with restock against the preserved variant.

## Done when

A merchant can retire a sold variant from sale and restore the deducted stock once. A product edit cannot redirect restoration to a different option combination.

## Limits

Catalogue saves only. Preserve order snapshots, verified Tenant and Branch scope, and the current eligibility rules for restocking.

## References

- [Product variant replacement](../../holita/apps/commerce/src/products/commerce.repository.ts#L251)
- [Stock restoration](../../holita/apps/commerce/src/orders/orders.repository.ts#L148)
- [Refund rules](../../holita/apps/commerce/src/refunds/refunds.service.ts#L103)
