# 348 Approve and manage a local merchant plan and trial

**Status:** Needs owner. When does a merchant trial start and end, and which plan changes are allowed before and after expiry? **Product:** Holita.

**Depends on** [347](347-holita-merchant-plan-entitlements.md).

## Background

The red.bg coverage report marks OPS37 as P2. The source exposes a current subscription, trial and permitted local plan change. The catalogue in 347 defines the eligible plans.

## Goal

Approve and manage a local merchant plan and trial.

## Steps

1. Approve initial plan and trial duration, expiry behavior and allowed plan changes. Then add a Tenant-scoped API for current subscription, trial state and the approved change operation.

## Done when

A merchant can see the current local plan and trial state and can make only a permitted plan change.

## Limits

Use the approved plan catalogue. Exclude charging and external subscription providers.

## References

- [red.bg `SubscriptionController.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Billing/SubscriptionController.php)
- [red.bg `SubscriptionService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Billing/SubscriptionService.php)
- [Holita `osnova/apps/core/src/modules/tenants/tenants.graphql:1`](../../osnova/apps/core/src/modules/tenants/tenants.graphql#L1)
- [Holita `apps/commerce/src/commerce.graphql:995`](../../holita/apps/commerce/src/commerce.graphql#L995)
