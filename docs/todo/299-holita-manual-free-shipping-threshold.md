# 299 Apply an approved free manual shipping threshold

**Status:** Needs owner. May Holita add a local API threshold for free manual shipping, and which subtotal should it use? **Product:** Holita.

## Background

The red.bg coverage report marks SH03 as P2. Manual shipping methods currently have a fixed fee. The source also applies an internal order threshold for free shipping.

## Goal

Apply an approved free manual shipping threshold.

## Steps

1. Confirm a narrow configuration path and the subtotal basis allowed by the owner.
2. Apply the optional shop-scoped threshold consistently in the existing quote and final order path, preserving the charged amount in the order.

## Done when

Orders below an approved threshold use the configured manual fee, and an eligible quote and placed order both charge zero shipping.

## Limits

Keep the existing exclusion of new shipping zone and subtotal editors. No courier integration.

## References

- [red.bg `ShippingManager.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Shipping/ShippingManager.php)
- [red.bg `StorefrontCheckoutService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontCheckoutService.php)
- [Holita `apps/commerce/src/manual-methods/manual-methods.service.ts:72`](../../holita/apps/commerce/src/manual-methods/manual-methods.service.ts#L72)
- [Holita `apps/commerce/src/checkout/checkout.service.ts:87`](../../holita/apps/commerce/src/checkout/checkout.service.ts#L87)
