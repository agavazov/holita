# 350 Enforce the local plan limit when a merchant adds a domain

**Status:** Blocked. Waits for the domain alias and local subscription contracts. **Product:** Holita.

**Depends on** [348](348-holita-merchant-local-subscription.md), [353](353-holita-storefront-alias-verification.md).

## Background

The red.bg coverage report marks OPS38 as P2. The source checks domain entitlements when a shop adds an alias. Holita needs the same authorized local check after verified aliases are available.

## Goal

Enforce the local plan limit when a merchant adds a domain.

## Steps

1. Check the approved entitlement and eligible count in the alias-add operation and return a clear denial when the limit is exceeded.

## Done when

A merchant at the approved limit cannot create another alias. A denied request cannot affect an alias in another Tenant or Branch.

## Limits

Use the approved local entitlement and alias rules. No DNS or TLS provider integration is introduced here.

## References

- [red.bg `PlanEntitlementService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Billing/PlanEntitlementService.php)
- [red.bg `StoreLimitPolicy.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Stores/StoreLimitPolicy.php)
- [Holita `apps/commerce/src/shop-settings/shop-settings.service.ts:24`](../../holita/apps/commerce/src/shop-settings/shop-settings.service.ts#L24)
- [Holita `apps/storefront/src/main.ts:919`](../../holita/apps/storefront/src/main.ts#L919)
