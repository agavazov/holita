# 233 Issue shop gift cards for an approved use

**Status:** Blocked. Deferred until issuance has an approved use within the manual-payment default. **Product:** Holita.

## Background

red.bg Admin issues and manages gift cards. Its checkout API can settle an entire order automatically, and the reviewed Basic checkout has no gift-card input. Holita's payment default is manual.

## Goal

Let merchants issue or disable stored value once it has an approved use consistent with the payment policy.

## Steps

1. Confirm how a shop will use and account for issued value without adding automatic checkout settlement.
2. If approved, add branch-scoped balance, validity and activation fields and Admin issue, inspect and disable actions. Treat a redeemable code as a credential.

## Done when

An authorized merchant can issue and disable a card for the approved use, and card data is scoped to its shop.

## Limits

Deferred manual issuance only. Automatic checkout settlement and its reversals are outside the wave.

## References

- [red.bg gift card Admin](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Marketing/GiftCardsController.php)
- [red.bg settlement](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontCheckoutService.php#L650)
- [Owner defaults](holita-migration.md)
