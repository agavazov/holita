# 224 Manage local newsletter subscriptions

**Status:** Ready. **Product:** Holita.

## Background

red.bg Admin has a newsletter subscriber list and create, update and remove actions. Holita has no local subscription register.

## Goal

Let merchants manage newsletter opt-in records for their own shop.

## Steps

1. Add shop-scoped subscription records with email, consent state and relevant timestamps.
2. Add an Admin list and simple editor for adding a subscriber manually, inspecting consent, changing status and removing a record. Show loading, empty and error states in BG and EN.

## Done when

A merchant can add a subscriber manually, find them by email, see their consent state, update it and remove the record in the selected shop.

## Limits

Local consent register only. No campaign delivery or marketing connectors.

## References

- [red.bg newsletter controller](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Customers/NewsletterController.php)
- [Holita operator graph](../../holita/apps/commerce/src/commerce.graphql)
- [Holita operator query entry](../../holita/apps/commerce/src/commerce.graphql#L894)
