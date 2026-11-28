# 202 Record the manual refund for an approved return

**Status:** Ready. **Product:** Holita.

## Background

red.bg Admin can refund an approved return. Holita's current refund restock restores the whole order when the refund consumes the remaining refundable amount. A partial-item return can consume that amount after an earlier refund.

## Goal

Link approved cases to manual refunds without restoring unrelated stock.

## Steps

1. Reuse the scoped manual refund and remaining-balance rules. Determine full-order return from the order lines and quantities, independently of the refund amount. Force all partial-item cases to amount-only settlement, including when the amount equals the remaining balance.
2. Allow the existing whole-order restock path only for a full-order return that meets the current stock and refund rules. Record the return-to-refund link and whether stock was restored, then show the recorded outcome in Returns and Order Detail.

## Done when

A partial-item return exhausting the balance does not restore stock. An eligible full-order return can restore the original variant deductions once, and a repeated settlement cannot create a second refund.

## Limits

Manual settlement only. Keep the direct refund workflow and existing restock eligibility.

## References

- [Holita refund rules](../../holita/apps/commerce/src/refunds/refunds.service.ts#L103)
- [red.bg settlement](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/ReturnService.php#L195)
- [Holita return-related stock restoration](../../holita/apps/commerce/src/orders/orders.repository.ts#L148)
- [Holita current manual refund service](../../holita/apps/commerce/src/refunds/refunds.service.ts#L51)
