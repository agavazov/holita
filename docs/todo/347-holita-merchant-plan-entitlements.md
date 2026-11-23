# 347 Approve and publish a catalogue of merchant plans and rights

**Status:** Needs owner. Which local plans and shop and domain rights should Holita seed at launch? **Product:** Holita.

## Background

The red.bg coverage report marks OPS36 as P2. The source has a merchant API for active plans and rights. Holita does not have a shared plan catalogue.

## Goal

Approve and publish a catalogue of merchant plans and rights.

## Steps

1. Approve the launch catalogue and the entitlement fields. Add one owning model and a verified merchant query for active plans and their rights.

## Done when

A merchant can read the approved active plans and available shop and domain rights through the operator graph.

## Limits

Read-only API. No plan editor, billing provider or automatic charging.

## References

- [red.bg `PlansController.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Billing/PlansController.php)
- [red.bg `BillingReadService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Billing/BillingReadService.php)
- [Holita `osnova/apps/core/src/modules/tenants/tenants.graphql:1`](../../osnova/apps/core/src/modules/tenants/tenants.graphql#L1)
- [Holita `apps/commerce/src/commerce.graphql:894`](../../holita/apps/commerce/src/commerce.graphql#L894)
