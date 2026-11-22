# 194 Configure customer fields and record values

**Status:** Ready. **Product:** Holita.

## Background

red.bg Admin manages reusable customer field definitions and the API stores values against customers. Holita Customer Detail has fixed contact and address fields.

## Goal

Let a shop define a small set of extra customer fields and fill them on Customer Detail.

## Steps

1. Add Branch-scoped definitions, reusing supported field kinds starting with text, and customer values with validated definition ownership.
2. Add Admin field list and editor and a Customer Detail section for reading and editing values.

## Done when

A field created in one shop can be filled and edited on a customer in that shop only.

## Limits

Merchant-entered fields only. No storefront capture or external sync.

## References

- [red.bg field editor routes](../../../red.bg/workspace-ecommerce/services/admin/routes/admin.php)
- [Holita customer detail](../../holita/apps/admin/src/customers/customer-detail.html)
- [Commerce schema](../../holita/apps/commerce/src/commerce.graphql)
- [red.bg customer field service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Customers/CustomerFieldService.php)
