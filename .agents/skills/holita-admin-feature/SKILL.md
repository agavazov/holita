---
name: holita-admin-feature
description: Implement or change holita admin features following the actual Refine and Ant Design Products UI, generated GraphQL operations and store-scoped request/cache lifecycle. Use for frontend feature work and store-switch fixes.
---

# Admin feature reference

Read [AGENTS.md](../../../AGENTS.md) and the relevant
[requirements](../../../docs/req/foundation.md). Use the actual Products implementation:

- [StoreWorkspace](../../../apps/admin/src/features/stores/store-workspace.tsx) owns store
  selection and keys the feature subtree. Routes are the active store source.
  Its pathname key also isolates editor mutations across routes within the same store.
- [Data provider](../../../apps/admin/src/data/data-provider.ts) maps generated operations
  to Refine. Its stores/<UUID>/products resource scopes requests, cache and invalidation.
  Preserve the immutable per-request headers and fetch-only transport; do not add a cache.
- [Product list](../../../apps/admin/src/features/products/product-list.tsx) uses useList
  and useDelete with server pagination and a pending-aware confirmation.
- [Editor](../../../apps/admin/src/features/products/product-editor.tsx) uses useOne,
  useCreate/useUpdate and the shared [ProductForm](../../../apps/admin/src/features/products/product-form.tsx).

Keep data access in the provider/hooks and use generated input/result types. Change named
operations beside the feature, then run codegen/schema:check. Ant Design supplies controls;
do not create a design system, separate fixture screen or generic CRUD framework.

Capture the resource in mutation arguments. Keep UI callbacks on the individual mutate
call so unmounting suppresses old navigation/notifications; Refine still invalidates the
original resource. Keep synchronous submission guards. Reference editors use the data-router blocker to confirm discarding dirty forms; Products
keeps its existing behavior. A store switch does not cancel a submitted server write.

Start with `npm run test:admin -- product-form.test.tsx` for form changes,
`data-provider.test.ts` for mapping, and `store-workspace.test.tsx` for lifecycle changes.
The latter uses real Refine hooks/cache with controlled GraphQL transport delays.
For browser behavior use `npm run test:smoke -- products.smoke.spec.mts` with the test DB
prerequisites in [testing](../../../docs/testing.md). Do not run test:full automatically.
Update the existing behavior documentation and verify the affected build/typecheck.

Reference Venues applies the same lifecycle in its own service and admin feature. Follow
`apps/reference/src/venues` and `apps/admin/src/features/reference/venues` when extending
Reference. Use test:reference/test:reference:db with venues.service.spec.ts/venues.db.spec.ts,
and test:admin/test:smoke with the relevant Venue/Reference file. Keep the Reference
availability guard and prefixed public contracts.

Use the [Reference implementation index](../../../docs/reference.md) for richer Event,
Session, gallery, lifecycle and responsive-navigation examples. Select only the patterns
needed by the feature; the index links each implementation to its focused checks.
