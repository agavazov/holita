# 218 Limit promotion redemptions per customer

**Status:** Needs owner. Can guests use a code with a per-shopper cap, or should these codes require sign-in? **Product:** Holita.

## Background

red.bg offers a per-customer redemption cap. Holita promo codes have one total use cap.

## Goal

Let a merchant constrain redemptions for each recognized shopper.

## Steps

1. Add an optional per-customer limit to the existing Admin editor, and enforce the approved guest eligibility policy using the shopper identity already verified in checkout.
2. Enforce the cap when quoting and when placing with the existing transaction and redemption count. Localize feedback.

## Done when

One shopper reaches their own cap while another remains eligible under the global limit.

## Limits

One promo code per order. Keep customer identity scoped to the shop.

## References

- [red.bg discount evaluation](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/DiscountService.php)
- [Holita discounts UI](../../holita/apps/admin/src/discounts/discount-editor.ts)
- [Holita checkout service](../../holita/apps/commerce/src/checkout/checkout.service.ts)
- [Holita current quote evaluation](../../holita/apps/commerce/src/checkout/checkout.service.ts#L152)
