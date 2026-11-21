# 116 Checkout order placement

**Status:** Ready after [115](115-holita-checkout-quote.md). **Product:** Holita.

## Background

Basic creates an order from checkout and shows its confirmation.

## Goal

A guest or signed-in shopper can place an order with the chosen manual methods.

## Steps

1. Keep the order number, status, optional verified customer, contact and address snapshots,
   method labels, currency and totals. Snapshot variant SKU, label, quantity and unit price on
   each line.
2. Revalidate the cart, prices, methods and inventory in Commerce. Create the order, decrement
   tracked stock and consume the cart together. A failed placement keeps the cart and stock
   intact.
3. Add storefront submission and confirmation backed by the current cart or shopper’s authority.
   Admin order screens land in 118. Seed one placed order linked to the demo shopper with item and
   method snapshots.

## Done when

Submitting checkout creates one order and confirmation. Reusing the same cart cannot create a
second order and insufficient stock produces a recoverable error.

## Limits

Manual payment starts unpaid. Provider handoffs and courier calls are excluded.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Order service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/OrderService.php)
- [Order model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Commerce/Order.php)
- [Basic confirmation](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/checkout-success.blade.php)
