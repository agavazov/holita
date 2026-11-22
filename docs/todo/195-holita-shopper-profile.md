# 195 Edit shopper profile details

**Status:** Ready. **Product:** Holita.

## Background

Basic lets the signed-in shopper edit their profile. Holita My Account displays name and email and links to orders.

## Goal

Let shoppers edit the supported name and phone fields for their account in the current shop.

## Steps

1. Add a storefront operation over the existing Commerce customer record and verify the shopper's shop session.
2. Add a profile form, loading and failure states, and Bulgarian and English field feedback.

## Done when

A saved change appears in My Account and Admin Customer Detail for that shop.

## Limits

Name and phone only. Keep email and credentials in their dedicated flows.

## References

- [red.bg Basic account controller](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/AccountController.php)
- [Holita My Account](../../holita/apps/storefront/src/main.ts)
- [Storefront schema](../../holita/apps/commerce/src/storefront.graphql)
