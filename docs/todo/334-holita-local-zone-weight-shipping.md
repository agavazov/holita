# 334 Apply approved zone and weight rules to manual shipping quotes

**Status:** Needs owner. May Holita add local API-only zone and weight rules for manual shipping, and which areas and missing-weight behavior should it support? **Product:** Holita.

**Depends on** [315](315-holita-variant-package-measurements.md).

## Background

The red.bg coverage report marks SH02 as P2. Holita quotes the configured fixed manual rate. The source contains working built-in address-zone and weight pricing without provider calls.

## Goal

Apply approved zone and weight rules to manual shipping quotes.

## Steps

1. Confirm an API-only configuration scope, supported areas and handling of missing product weights.
2. Apply the approved shop-scoped rule to the same fee path used for the checkout quote and saved order.

## Done when

A cart with a supported address and weight receives the configured manual rate in the quote and placed order.

## Limits

No shipping-zone editor or courier API. Reuse variant weights from ticket 315.

## References

- [red.bg `ShippingManager.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Shipping/ShippingManager.php)
- [red.bg `ShippingZoneMatcher.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Shipping/ShippingZoneMatcher.php)
- [Holita `apps/commerce/src/manual-methods/manual-methods.service.ts:72`](../../holita/apps/commerce/src/manual-methods/manual-methods.service.ts#L72)
- [Holita `apps/commerce/src/checkout/checkout.service.ts:87`](../../holita/apps/commerce/src/checkout/checkout.service.ts#L87)
