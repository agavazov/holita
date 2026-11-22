# 216 Expose enabled customer fields in shopper profiles

**Status:** Ready after [194](194-holita-customer-fields.md), [195](195-holita-shopper-profile.md). **Product:** Holita.

## Background

red.bg Basic profile displays and saves eligible merchant-defined fields. Holita's customer-field and shopper profile slices do not expose merchant-configured fields publicly.

## Goal

Let shoppers fill customer fields explicitly enabled for self-service.

## Steps

1. Add a per-field shopper visibility/edit setting and return only enabled definitions and the owner's current values.
2. Add supported text and choice controls to the profile, with validation and localized errors.

## Done when

The shopper can read and update enabled fields only. Merchant-only fields remain private.

## Limits

Profile only. No storefront registration requirements in this slice.

## References

- [red.bg shopper profile](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/AccountController.php)
- [red.bg fields service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Customers/CustomerFieldService.php)
