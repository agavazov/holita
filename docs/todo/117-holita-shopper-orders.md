# 117 Shopper order history

**Status:** Ready. **Product:** Holita.

## Background

Basic has signed-in order list and detail views.

## Goal

Shoppers can find and review orders linked to their shop account.

## Steps

1. Expose a paged public-graph query for the verified customer’s orders and a scoped detail
   lookup. Show number, date, status, line snapshots, delivery summary, payment instructions,
   charged shipping fee and totals from the order snapshots.
2. Add Storefront Account Orders and Order Detail. Keep Admin screens for 118.
3. Seed a completed order for the demo shopper alongside the placed order.

## Done when

The demo shopper can open both orders. A different shopper or shop cannot read those order IDs.

## Limits

List orders linked to the customer at placement. Guest confirmation stays in checkout.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Order reads](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/OrderReadService.php)
- [Basic account orders](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/account/orders.blade.php)
- [Basic order detail](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/account/order.blade.php)
