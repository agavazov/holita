# 259 Recover signed-in checkout after an interrupted response

**Status:** Ready. **Product:** Holita.

## Background

When Commerce commits an order but the response is lost, a signed-in shopper who reloads checkout lands on an empty cart. The order remains in history, but checkout loses the direct path to its confirmation. The guest path already retains a pending attempt.

## Goal

Recover the committed order and open its confirmation on reload for the same shopper and shop.

## Steps

1. Record the pending cart ID before placement in the current shop and shopper session. Reuse the shopper's existing credential and keep contact, address and other form data out of the pending entry.
2. Recover the existing order against the consumed cart with verified shop and customer ownership. Clear the pending entry on resolution and preserve normal checkout if placement never committed.
3. Extend the existing interrupted-checkout smoke case to include a signed-in shopper whose response is lost after commit.

## Done when

Reloading after a lost response opens the original confirmation for the same signed-in shopper. Recovery cannot reveal another customer's order or charge stock twice.

## Limits

Reuse the existing order and checkout flow. Follow codegen and schema verification if the recovery contract changes.

## References

- [red.bg checkout controller](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/CommerceController.php)
- [Holita checkout placement](../../holita/apps/storefront/src/checkout-page.ts#L312)
- [Holita active cart lookup](../../holita/apps/commerce/src/cart/cart.repository.ts#L25)
- [Holita committed-placement retry](../../holita/apps/commerce/src/orders/orders.service.ts#L508)
- [Existing interrupted-checkout smoke](../../holita/tools/browser/holita.smoke.spec.mts#L1787)
