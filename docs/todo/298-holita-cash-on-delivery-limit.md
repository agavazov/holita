# 298 Confirm and enforce the manual cash-on-delivery limit

**Status:** Needs owner. Which order total and boundary should determine cash-on-delivery eligibility, and which manual method is designated for it? **Product:** Holita.

## Background

The red.bg coverage report marks PY03 as P2. Holita has manual payment methods, but no typed cash-on-delivery method with an order limit.

## Goal

Confirm and enforce the manual cash-on-delivery limit.

## Steps

1. Confirm which total and boundary to use, then store the limit on an explicitly designated manual cash-on-delivery method.
2. Apply the same eligibility check to checkout quoting and order placement.

## Done when

An over-limit quote explains that cash on delivery is unavailable and final submission cannot bypass the restriction by passing the previous method ID.

## Limits

Manual payment only. Exclude provider reconciliation and external payment APIs.

## References

- [red.bg `ShippingManager.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Shipping/ShippingManager.php)
- [red.bg `StorefrontCheckoutService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontCheckoutService.php)
- [Holita `apps/commerce/src/manual-methods/manual-methods.service.ts:72`](../../holita/apps/commerce/src/manual-methods/manual-methods.service.ts#L72)
- [Holita `apps/commerce/src/checkout/checkout.service.ts:87`](../../holita/apps/commerce/src/checkout/checkout.service.ts#L87)
