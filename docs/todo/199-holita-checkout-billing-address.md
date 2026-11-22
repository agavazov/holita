# 199 Capture a separate checkout billing address

**Status:** Ready. **Product:** Holita.

## Background

red.bg Basic checkout collects a separate billing address when requested. Holita storefront checkout accepts the delivery address alone.

## Goal

Let shoppers supply billing details independently of delivery.

## Steps

1. Add the optional billing form and persist validated billing fields as an order snapshot, defaulting to delivery when the shopper chooses that option.
2. Present captured billing details on merchant order detail and use them as invoice recipient defaults where supported.

## Done when

A shopper can choose a different billing address, and the recorded order supplies those details independently of the shipping address.

## Limits

Manual checkout only. Preserve earlier order and invoice snapshots.

## References

- [red.bg checkout form](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/checkout.blade.php)
- [Holita checkout](../../holita/apps/storefront/src/checkout-page.html)
- [Holita order contract](../../holita/apps/commerce/src/storefront.graphql)
