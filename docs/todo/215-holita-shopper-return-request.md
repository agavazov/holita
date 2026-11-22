# 215 Accept authenticated shopper return requests through the API

**Status:** Ready after [201](201-holita-admin-return-cases.md). **Product:** Holita.

## Background

red.bg accepts return requests against owned orders through its storefront API. Ticket 201 provides Admin cases and decisions.

## Goal

Let an authenticated shopper API client submit eligible order lines and quantities into the returns inbox.

## Steps

1. Add a public-graph mutation that derives customer and shop from the verified session. Validate order ownership, eligible state, quantities and duplicate or overlapping requests under the existing return rules.
2. Create a pending case visible in Admin using the 201 contract. Keep merchant actions and refund settlement on the operator side.

## Done when

An eligible API request creates one pending case for the shopper's order. Cross-shop, cross-customer and ineligible requests are rejected.

## Limits

API intake only. No new Basic form, merchant intake or shipment workflow.

## References

- [red.bg storefront return route](../../../red.bg/workspace-ecommerce/services/api/routes/api/v1/storefront.php#L80)
- [red.bg return service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/ReturnService.php)
- [Holita storefront contract](../../holita/apps/commerce/src/storefront.graphql)
