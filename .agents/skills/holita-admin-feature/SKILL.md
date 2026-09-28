---
name: holita-admin-feature
description: Implement or migrate holita admin features using Refine, Aurora/MUI and generated GraphQL contracts while preserving the store-scoped request/cache lifecycle. Use for frontend feature work and store-switch fixes.
---

# Admin feature reference

Read [AGENTS.md](../../../AGENTS.md) and the relevant
[requirements](../../../docs/req/foundation.md). Use the actual Products implementation
for data access, validation and lifecycle behavior:

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
operations beside the feature, then run codegen/schema:check. Follow the Aurora/MUI and
transitional UI rules in AGENTS.md. Existing Ant Design markup is a behavioral reference;
use the original Aurora source for migrated presentation. Do not create a design system,
separate fixture screen or generic CRUD framework.

For layout work, trace the selected Aurora components through their theme overrides,
icons and settings before adapting them. Preserve the selected layout's visual structure
and interactions while replacing demo route/auth/data bindings with holita inputs.
Keep the existing router, Refine provider and feature lifecycle boundaries. A small
layout extraction does not require rewriting the feature editors. Source theme controls
must not overwrite holita list filters or other route query parameters.

Capture the resource in mutation arguments. Keep UI callbacks on the individual mutate
call so unmounting suppresses old navigation/notifications; Refine still invalidates the
original resource. Keep synchronous submission guards. Reference editors use the data-router blocker to confirm discarding dirty forms; Products
keeps its existing behavior. A store switch does not cancel a submitted server write.

Start with `npm run test:admin -- product-form.test.tsx` for form changes,
`data-provider.test.ts` for mapping, and `store-workspace.test.tsx` for lifecycle changes.
The latter uses real Refine hooks/cache with controlled GraphQL transport delays.
For browser behavior use `npm run test:smoke -- products.smoke.spec.mts` with the test DB
prerequisites in [testing](../../../docs/testing.md). Shared navigation changes also use
`reference-layout.smoke.spec.mts`; include `reference-disabled.smoke.spec.mts` when changing
Reference menu visibility or route availability. Compare the shell against the selected
Aurora layout in a browser; component tests do not establish visual fidelity.
Do not run test:full automatically.
Update the existing behavior documentation and verify the affected build/typecheck.

Reference Venues applies the same lifecycle in its own service and admin feature. Follow
`apps/reference/src/venues` and `apps/admin/src/features/reference/venues` when extending
Reference. Use test:reference/test:reference:db with venues.service.spec.ts/venues.db.spec.ts,
and test:admin/test:smoke with the relevant Venue/Reference file. Keep the Reference
availability guard and prefixed public contracts.

Use the [Reference implementation index](../../../docs/reference.md) for richer Event,
Session, gallery, lifecycle and responsive-navigation examples. Select only the patterns
needed by the feature; the index links each implementation to its focused checks.
