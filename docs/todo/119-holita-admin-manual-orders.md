# 119 Manual orders in Admin

**Status:** Ready. **Product:** Holita.

## Background

red.bg offers a merchant order form with customer lookup, variant lines and delivery choices.

## Goal

A merchant can record a phone order and edit its details while it is still placed.

## Steps

1. Add a drawer from Admin Orders for an optional existing customer, contact, shipping address,
   variant quantities, enabled manual methods and notes.
2. Reuse Commerce placement, pricing and stock rules. Apply the net stock change when a placed
   order’s lines change and keep edited order snapshots consistent.
3. A linked order appears in the shopper’s order history. Seed a guest phone order with a merchant
   note and fixed-rate shipping.

## Done when

The merchant can create and revise a placed manual order, with totals and stock derived by
Commerce.

## Limits

Limit edits to placed, unpaid orders and keep private notes in the operator graph.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Order service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/OrderService.php)
- [Admin order form](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/sales/orders/partials/form.blade.php)
