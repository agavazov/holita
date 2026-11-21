# 129 Manual order refunds

**Status:** Ready after [118](118-holita-admin-order-management.md). **Product:** Holita.

## Background

red.bg shows refund history and lets merchants record a refund for a paid manual order.

## Goal

Merchants can record money returned outside Holita and see the refundable balance.

## Steps

1. Store the order, amount, currency, optional reason, restock choice and timestamp. Accept
   positive amounts on paid manual orders up to the remaining paid balance. Check the balance
   and write the refund together.
2. Add refund history and a Record Refund drawer to Admin Order Detail. Show partial and full
   refund status. Offer restock on the completing refund through the existing cancellation
   path so already returned stock stays unchanged.
3. Seed a paid demo order with a partial refund and a remaining refundable balance.

## Done when

A merchant can record a partial refund and then refund the remaining balance. Commerce rejects an
amount above the balance and returns tracked stock once when the merchant chooses restock on the
full refund.

## Limits

Recording only. Keep provider calls, returns intake and storefront refund actions outside this
slice.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Refund service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/RefundService.php)
- [Refund migration](../../../red.bg/workspace-ecommerce/services/api/database/migrations/main/2026_08_03_000001_create_refunds.php)
- [Admin refund history and form](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/sales/refunds/index.blade.php)
