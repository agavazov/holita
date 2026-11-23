# 263 Page customers and bound manual-order customer search

**Status:** Ready after [152](152-holita-manual-order-customer-phone.md). **Product:** Holita.

## Background

Opening the first Admin Customers page or a manual-order drawer fetches every customer in the shop, including their last order. Admin then slices the Customers list locally. Both entry points become slower and load more data as the shop gains customers.

## Goal

Load one scoped Customers page at a time and return a small result set from the manual-order customer picker.

## Steps

1. Add server-side pagination and name/email search following the existing list contract. Update the Customers screen to use the returned items and count.
2. Use bounded search in the manual-order customer picker and select only the current contact fields it needs. Keep history lookups in the views that use them.
3. Regenerate contracts and run the schema check. Verify the Customers list and picker with enough customers to exceed one page.

## Done when

Initial load and search in Customers request only one page. A customer outside the initial page can be found by name or email and selected in a manual order with their current contact details. Results stay inside the selected shop.

## Limits

Use the existing scoped customer records. Customer creation, address books and email-verification filters have separate contracts.

## References

- [red.bg customer list controller](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Customers/CustomersController.php)
- [Holita customer repository](../../holita/apps/commerce/src/customers/shopper.repository.ts#L6)
- [Holita Customers listing](../../holita/apps/admin/src/customers/customers-page.ts#L65)
- [Holita manual-order customer choices](../../holita/apps/admin/src/orders/operations.graphql#L175)
