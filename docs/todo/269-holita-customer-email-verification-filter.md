# 269 Filter Admin customers by email verification

**Status:** Blocked. Waits for [279](279-holita-shopper-email-verification.md). **Product:** Holita.

## Background

red.bg lets merchants filter customers by confirmed email. Holita's Admin customer list cannot distinguish confirmed shoppers from unconfirmed accounts and contacts.

## Goal

Let a merchant narrow the paginated Customers list by saved email verification state.

## Steps

1. Reuse 279's saved verification state in the scoped Customers list. Add an optional all, confirmed or unconfirmed filter, with an account lacking a confirmation recorded as unconfirmed.
2. Add the localized selector to Admin Customers and preserve name and email search when it changes. Regenerate and check the GraphQL contracts.

## Done when

The confirmed filter returns only confirmed customers from the selected shop and the unconfirmed filter returns the rest, with the correct total on each filtered page.

## Limits

Keep the manual-order customer picker and email verification policy in their own tickets.

## References

- [red.bg customer filters](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/customers/customers/partials/filters.blade.php)
- [Holita Admin customer list](../../holita/apps/admin/src/customers/customers-page.ts#L65)
