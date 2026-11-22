# 223 Alert merchants to new orders in one shop inbox

**Status:** Ready. **Product:** Holita.

## Background

red.bg consumes placed-order events into a shop inbox and keeps the read state by shop. Holita can place orders from storefront or Admin without a notification inbox.

## Goal

Let merchants see unread order alerts for the selected shop regardless of where the order originated.

## Steps

1. Feed both existing placement paths into the same Tenant and Branch scoped inbox. Record one entry per placed order and use shared read state for that shop.
2. Expose the Admin inbox and unread count, link each entry to Order Detail, and allow opening or marking all as read for that shop.

## Done when

One storefront order and one Admin order produce two alerts in the same shop. Opening or marking alerts read is reflected for its operators and leaves other shops untouched.

## Limits

Newly placed orders only. Email delivery and external channels are separate.

## References

- [red.bg read state](../../../red.bg/workspace-ecommerce/services/api/app/Services/Notifications/NotificationService.php#L50)
- [red.bg event consumer](../../../red.bg/workspace-ecommerce/services/api/app/Services/Events/Consumers/OrderPlacedNotificationConsumer.php#L20)
- [Holita placement](../../holita/apps/commerce/src/orders/orders.service.ts)
- [Holita manual orders](../../holita/apps/admin/src/orders/manual-order-editor.ts)
