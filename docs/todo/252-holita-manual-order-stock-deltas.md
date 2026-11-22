# 252 Preserve stock deductions on manual order edits

**Status:** Ready. **Product:** Holita.

## Background

A manual order edit can clear the deduction for a previously purchased variant if the same variant is re-added while inventory tracking is off.

## Goal

Preserve deductions for units that remain on the order and apply only the net stock change.

## Steps

1. Calculate stock deltas from prior deductions by variant. Carry forward the deduction for retained units, restore only removed units and use the current tracking rules for new units.
2. Keep existing line identity, price and historical snapshot behavior. Verify the same-quantity replacement after a tracking toggle and restoration of a subsequently removed quantity.

## Done when

Replacing a line with the same variant and quantity preserves the existing deduction and leaves stock unchanged. Removing deducted units restores exactly those units once.

## Limits

Manual order edits only. Keep the existing Tenant and Branch checks and restoration eligibility.

## References

- [Manual order stock deltas](../../holita/apps/commerce/src/orders/manual-order-lines.ts#L103)
- [Order stock restoration](../../holita/apps/commerce/src/orders/orders.repository.ts#L148)
