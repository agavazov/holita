# 118 Admin order management

**Status:** Ready after [117](117-holita-shopper-orders.md). **Product:** Holita.

## Background

red.bg merchants use order list and detail for processing, cancellation and manual payment.

## Goal

Merchants can see and fulfill orders placed in their shop.

## Steps

1. Add Admin Orders list and detail, searchable by order number or contact and filterable by
   status. Display the stored items, contact, address, method and totals.
2. Add the order status flow placed, confirmed, processing, shipped, completed and cancelled.
   Allow manual marking as paid, and restore tracked stock once when an eligible order is
   cancelled.
3. Expose shopper-visible status updates through the existing order detail. Seed a confirmed order
   and a shipped order with manual payment marked paid.

## Done when

A merchant can advance and cancel eligible orders in the selected shop. Shoppers see their updated
status and cancelling again leaves stock unchanged.

## Limits

Maintain order history through status changes. Manual creation and edits land in 119.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Order status](../../../red.bg/workspace-ecommerce/services/api/app/Enums/Commerce/OrderStatus.php)
- [Order service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/OrderService.php)
- [Admin Orders](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/sales/orders)
