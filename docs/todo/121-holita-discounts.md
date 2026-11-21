# 121 Discounts and promo codes

**Status:** Ready after [118](118-holita-admin-order-management.md). **Product:** Holita.

## Background

red.bg applies shop-owned discounts when a shopper enters a code.

## Goal

Merchants create checkout promo codes and shoppers see the saving before ordering.

## Steps

1. Keep a unique shop code, fixed or percentage value, enabled status, validity window, minimum
   subtotal and optional total use limit.
2. Add the Admin Discounts list and drawer, and show the code and discount in Admin Order Detail.
   Add apply and remove on the storefront cart and include the saving in checkout.
3. Validate and recalculate against Commerce totals at placement. Record the code and amount on
   the order and count redemptions when the order commits.
4. Seed a live 10% code with a minimum subtotal and an expired code.

## Done when

An eligible code reduces the displayed and stored total. Ineligible, expired and exhausted codes
are rejected.

## Limits

One code per order. The discount applies to item subtotal.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Discount model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Commerce/Discount.php)
- [Discount service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/DiscountService.php)
- [Admin Discounts](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/marketing/discounts/form.blade.php)
- [Discount migration](../../../red.bg/workspace-ecommerce/services/api/database/migrations/main/2026_08_03_000013_create_commerce_discounts.php)
