# 196 Change a shopper password

**Status:** Ready. **Product:** Holita.

## Background

Basic offers signed-in shoppers a password change. Holita only registers and signs in shoppers.

## Goal

Give shoppers a shop-scoped password-change form.

## Steps

1. Verify the customer session and current password before hashing and saving a valid replacement using existing shopper auth conventions.
2. Add the Account password form with localized validation and completion feedback. Handle sessions through the existing Commerce credential lifecycle.

## Done when

The new password signs the shopper in to that shop, and the old password fails.

## Limits

Signed-in password change only.

## References

- [red.bg password route](../../../red.bg/workspace-ecommerce/services/storefront/basic/routes/web.php)
- [Holita account and authentication](../../holita/apps/storefront/src/main.ts)
- [Storefront schema](../../holita/apps/commerce/src/storefront.graphql)
