# 218 Limit promotion redemptions per customer

**Status:** Ready. **Product:** Holita.

## Background

red.bg offers a per-customer redemption cap. Holita promo codes have one total use cap.

## Goal

Let a merchant constrain redemptions for each recognized shopper.

## Steps

1. Add an optional per-customer limit to the existing Admin editor, and use a policy for guest eligibility consistent with verified shopper identity.
2. Enforce the cap when quoting and when placing with the existing transaction and redemption count. Localize feedback.

## Done when

One shopper reaches their own cap while another remains eligible under the global limit.

## Limits

One promo code per order. Keep customer identity scoped to the shop.

## References

- [red.bg discount evaluation](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/DiscountService.php)
- [Holita discounts UI](../../holita/apps/admin/src/discounts/discount-editor.ts)
- [Holita checkout service](../../holita/apps/commerce/src/checkout/checkout.service.ts)
