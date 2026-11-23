# 349 Enforce the local plan limit when a merchant creates another shop

**Status:** Blocked. Waits for merchant shop creation and approved local subscriptions. **Product:** Holita.

**Depends on** [186](186-holita-merchant-create-shop.md), [348](348-holita-merchant-local-subscription.md).

## Background

The red.bg coverage report marks OPS38 as P2. The source applies local plan rights when a merchant creates another shop. The same cap needs to apply to the Admin creation flow after ticket 186.

## Goal

Enforce the local plan limit when a merchant creates another shop.

## Steps

1. Check the verified merchant Tenant's active entitlement in the authoritative Branch creation operation and reject requests above the approved limit.

## Done when

At the approved limit, merchant shop creation returns a clear denial and creates no Branch. Another Tenant's count is independent.

## Limits

Use the local subscription state. Keep Backoffice provisioning behavior according to its existing permissions.

## References

- [red.bg `PlanEntitlementService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Billing/PlanEntitlementService.php)
- [red.bg `StoreLimitPolicy.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Stores/StoreLimitPolicy.php)
- [Holita `packages/operator/src/merchant-detail-page.ts:105`](../../holita/packages/operator/src/merchant-detail-page.ts#L105)
- [Holita `osnova/apps/core/src/modules/platform/platform.service.ts:48`](../../osnova/apps/core/src/modules/platform/platform.service.ts#L48)
