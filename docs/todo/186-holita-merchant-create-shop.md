# 186 Create another shop from merchant Admin

**Status:** Needs owner. Confirm merchant shop entitlement and which roles may create an additional shop. **Product:** Holita.

## Background

red.bg approved merchants can create a shop from Admin. Holita merchant Admin can select existing shops, while platform staff and queued Sales onboarding create them through separate operations.

## Goal

Let an eligible merchant create a Branch inside their own Tenant.

## Steps

1. Confirm the eligible merchant role, shop entitlement and minimum initial data policy. Derive Tenant from verified Core identity.
2. Expose a merchant-scoped Core create operation and an Admin create form and switch to the created Branch.

## Done when

An authorized merchant can create and open a shop in their own account. Another Tenant cannot be supplied.

## Limits

Keep Sales provisioning 143 and Backoffice creation separate. No theme selection or provider configuration.

## References

- [red.bg merchant shop creation](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/StoresController.php)
- [red.bg entitlement service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Billing/PlanEntitlementService.php)
- [Holita shop picker](../../holita/packages/operator/src/application.ts)
- [Core platform contract](../../osnova/apps/core/src/modules/tenants/tenants.graphql)
