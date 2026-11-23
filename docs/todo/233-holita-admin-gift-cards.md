# 233 Issue shop gift cards for an approved use

**Status:** Needs owner. What manual use is allowed for shop gift cards, and when may an operator reactivate or delete one? **Product:** Holita.

## Background

red.bg Admin issues and manages gift cards. Its checkout API can settle an entire order automatically, and the reviewed Basic checkout has no gift-card input. Holita's payment default is manual.

## Goal

Let merchants issue or disable stored value once it has an approved use consistent with the payment policy.

## Steps

1. Confirm how a shop will use and account for issued value within manual payments. Define which cards can be disabled, reactivated or deleted and what history each action retains.
2. If approved, add Branch-scoped balance, validity and status fields and the agreed Admin actions. Treat a redeemable code as a credential.

## Done when

An authorized merchant can issue and manage cards for the approved manual use. State changes and retention follow the approved rules and other shops cannot access the cards.

## Limits

Deferred manual issuance only. Automatic checkout settlement and its reversals are outside the wave.

## References

- [red.bg gift card Admin](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Marketing/GiftCardsController.php)
- [red.bg settlement](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontCheckoutService.php#L650)
- [Holita manual payment methods](../../holita/apps/commerce/src/commerce.graphql#L764)
- [Owner defaults](holita-migration.md)
