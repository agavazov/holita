# 116 Checkout order placement

**Status:** Ready after [115](115-holita-checkout-quote.md). **Product:** Holita.

## Background

Basic creates an order from checkout and shows its confirmation.

## Goal

A guest or signed-in shopper can place an order with the chosen manual methods.

## Steps

1. Keep the order number, status, optional verified customer, contact and address snapshots,
   method labels, selected payment instructions, charged shipping fee, currency and totals.
   Snapshot variant SKU, label, quantity and unit price on each line.
2. Revalidate the cart, prices, methods and inventory in Commerce. Create the order, decrement
   tracked stock and consume the cart together. A failed placement keeps the cart and stock
   intact.
3. Authorize guest submission and confirmation with the shop-scoped cart credential. Link the
   confirmation to the consumed cart. Use the verified customer session for signed-in shoppers.
4. Use the stored method snapshots for confirmation and historical order views in 117 and 118.
   Seed one placed order linked to the demo shopper with items, payment instructions and a
   charged shipping fee.

## Done when

Submitting checkout creates one order and confirmation. Reusing the same cart cannot create a
second order and insufficient stock produces a recoverable error. Guest confirmation requires
the credential for the cart that placed the order. Changing a method later leaves the
instructions and charged fee shown on the order unchanged.

## Limits

Manual payment starts unpaid. Provider handoffs and courier calls are excluded.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Order service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/OrderService.php)
- [Order model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Commerce/Order.php)
- [Basic confirmation](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/checkout-success.blade.php)
