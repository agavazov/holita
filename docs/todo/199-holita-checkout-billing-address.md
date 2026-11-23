# 199 Capture a separate checkout billing address

**Status:** Ready. **Product:** Holita.

## Background

red.bg Basic checkout collects a separate billing address when requested. Holita storefront checkout accepts the delivery address alone.

## Goal

Let shoppers supply billing details independently of delivery.

## Steps

1. Add an optional billing form and persist validated billing fields through the existing checkout placement flow. Use the delivery address when the shopper chooses to use it for billing.
2. Present captured billing details on merchant order detail and use them as invoice recipient defaults where supported.

## Done when

A guest or signed-in shopper can enter a separate billing address or reuse delivery. Order Detail shows the recorded billing address separately, and opening the invoice form uses the stored billing details when available.

## Limits

Manual checkout only. Preserve earlier order and invoice snapshots.

## References

- [red.bg checkout form](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/checkout.blade.php)
- [Holita checkout](../../holita/apps/storefront/src/checkout-page.html)
- [Holita order contract](../../holita/apps/commerce/src/storefront.graphql)
- [red.bg checkout validation](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontCheckoutService.php)
- [Holita placement input](../../holita/apps/commerce/src/storefront.graphql#L288)
- [Holita checkout placement](../../holita/apps/storefront/src/checkout-page.ts#L299)
