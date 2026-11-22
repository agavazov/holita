# 192 Create contact-only customers in Admin

**Status:** Ready. **Product:** Holita.

## Background

red.bg Admin can create a customer from its Customers list. Holita stores customers and shoppers together, and storefront registration inserts a fresh record with a Branch-unique email.

## Goal

Let a merchant add a contact for manual orders with an explicit account lifecycle.

## Steps

1. Add a scoped create action using normalized shop-unique email, name and phone and open Customer Detail after creation.
2. Explain before saving that the contact reserves its email in the shop. Create no password, invite or session. Keep the existing public signup conflict when an email is already in use.

## Done when

The contact can be selected for a manual order and cannot sign in or self-register over the existing record. An existing shopper email is rejected in Admin with localized feedback.

## Limits

Contact-only creation. Verified account claiming would be a separate change.

## References

- [red.bg customer controller](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Customers/CustomersController.php)
- [Holita shopper registration](../../holita/apps/commerce/src/storefront.service.ts#L430)
- [Holita Customers list](../../holita/apps/admin/src/customers/customers-page.ts)
