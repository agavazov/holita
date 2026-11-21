# 115 Checkout form and manual quote

**Status:** Ready after [114](114-holita-cart.md). **Product:** Holita.

## Background

Basic checkout gathers contact and delivery details and quotes available methods.

## Goal

A guest or signed-in shopper can review a manual-payment checkout total.

## Steps

1. Add shop-scoped payment methods with label, instructions, enabled status and order, plus
   shipping methods with label, fixed fee, enabled status and order.
2. Quote the cart in Commerce using the chosen active methods and current line prices. Build the
   storefront checkout form for name, email, phone, shipping address and method choice.
3. Keep payment and shipping configuration seed-backed until the Admin screens in 122. Seed Cash
   on Delivery and fixed-rate Home Delivery.

## Done when

The checkout form can show a server-priced summary and rejects invalid and cross-shop method
selections.

## Limits

One shipping address and one shop currency. Submission lands in 116.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Checkout service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontCheckoutService.php)
- [Payment model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Commerce/StorePaymentMethod.php)
- [Shipping model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Commerce/StoreShippingMethod.php)
- [Basic checkout](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/checkout.blade.php)
