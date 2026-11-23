# 143 Provision a merchant and first shop atomically

**Status:** Ready after [131](131-holita-sales-sales-service.md). **Product:** Holita.

## Background

Holita Core owns the merchant Tenant, administrator account and Branch. The existing merchant
and Branch mutations are separate administrator/operator writes. A Sales handoff needs an
all-or-nothing operation whose result is recoverable when a response is lost.

## Goal

Give the Sales service a narrow, replayable Core contract for new-merchant onboarding.

## Steps

1. Add a private Core platform onboarding command. Require the existing internal service
   credential and verify the forwarded real Core session directly. Require a platform SALES
   caller. Derive the platform tenant from that identity and leave the public GraphQL
   mutations and their permissions intact.
2. Accept a caller-generated operation UUID, merchant name, initial administrator name/email
   and password, and first Branch name. Reuse Core account and name validation. Create the
   customer Tenant, administrator and Branch in one Core transaction. Return merchant Tenant
   ID and Branch ID. Hash the password using the Core account path and keep it out of request
   logs and the replay record.
3. In the same transaction, record the operation UUID scoped to the verified platform
   tenant, the normalized non-secret input needed to detect a conflicting replay, and the
   result IDs. A repeated matching operation returns the original pair, including concurrent
   repeats. A conflicting replay fails without changing records. A committed replay never
   resets the administrator password. Support replay without a password once the operation
   has committed. A new creation still requires a valid initial password.
4. Verify the private contract using the existing isolated Holita Core seed and the seeded
   platform Sales account. Use synthetic merchant/admin/shop input in the dedicated test
   schema. Reuse the existing Sales and merchant demo data. No permanent CRM or onboarding
   fixtures or Sales screen are added here; ticket 141 consumes the contract.

## Done when

Both destination IDs resolve to one Core merchant and its first Branch. A failed creation
leaves neither the merchant nor the Branch. Replaying a committed operation returns the same
pair, and a conflicting operation or unauthorized identity is rejected. Ordinary merchant
mutations keep their current permission checks.

## Limits

Core owns only generic onboarding and its replay records. Lead state, Sales retry UI,
existing-merchant handoffs and dashboard filters are out of scope.

## References

- [Core platform contract](../../osnova/apps/core/src/modules/tenants/tenants.graphql)
- [Core platform writes](../../osnova/apps/core/src/modules/platform/platform.service.ts)
- [Core platform persistence](../../osnova/apps/core/src/modules/platform/platform.repository.ts)
- [Core internal auth pattern](../../osnova/apps/core/src/auth/auth.controller.ts)
- [red.bg merchant creation](../../../red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/MerchantsController.php)
- [red.bg store creation](../../../red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/StoresController.php)
- [Holita existing Sales app entry](../../holita/apps/sales/src/main.ts#L9)
