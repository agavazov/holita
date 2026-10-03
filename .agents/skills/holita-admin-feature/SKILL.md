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
  with server pagination, URL filters/sorting and page-local batch deletion. Products and
  LookupList share [useRecordDeletion](../../../apps/admin/src/features/use-record-deletion.ts);
  its per-call callbacks stop the unsent remainder on unmount and preserve failed rows for retry.
  `changeListQuery` commits the current text drafts with filter/sort changes and cancels their
  pending debounce; keep programmatic resets from scheduling a new search. Restore drafts on
  every navigation, including Back/Forward when only a different filter changed.
- [Editor](../../../apps/admin/src/features/products/product-editor.tsx) uses useOne,
  useCreate/useUpdate and the shared [ProductForm](../../../apps/admin/src/features/products/product-form.tsx).

Keep data access in the provider/hooks and use generated input/result types. Change named
operations beside the feature, then run codegen/schema:check. Follow the Aurora/MUI rules
in AGENTS.md and use the original Aurora source for presentation. The
[Products reference](../../../docs/reference.md#products-the-aurora-crud-reference) identifies
shared presentation components and feature-owned state, fields and deletion rules. Read it
before adapting Products to another module. Do not create a design system,
fixture-only alternative to a feature screen or generic CRUD framework.

Use the [UI catalog and shared inventory](../../../docs/reference.md#ui-catalog-and-shared-components)
to review presentation patterns before adding a component. Reuse ContentSection for grouped
body/form content and keep validation in the concrete form. Catalog examples use local state
only and reset when leaving their tab or store; do not add mock operations, storage or feature
contracts for a presentation preview. Check the catalog in light/dark and narrow layouts when
changing its examples or shared presentation. Use `test:smoke -- ui-catalog.smoke.spec.mts`.

For layout work, trace the selected Aurora components through their theme overrides,
icons and settings before adapting them. Preserve the selected layout's visual structure
and interactions while replacing demo route/auth/data bindings with holita inputs.
The selected holita shell uses a simple single-column sidenav with all enabled groups
visible together and no footer. Keep the mode indicator in the top bar (beside the store
selector below it on mobile). Aurora is the component source; do not restore its Stacked
group rail, sidebar profile or footer from the template.
Keep the existing router, Refine provider and feature lifecycle boundaries. A small
layout extraction does not require rewriting the feature editors. Source theme controls
must not overwrite holita list filters or other route query parameters.

Capture the resource in mutation arguments. Keep UI callbacks on the individual mutate
call so unmounting suppresses old navigation/notifications; Refine still invalidates the
original resource. Keep synchronous submission guards. Reference editors use the data-router blocker to confirm discarding dirty forms; Products
keeps its existing behavior. A store switch does not cancel a submitted server write.

Start with `npm run test:admin -- product-form.test.tsx` for form changes,
`product-list.test.tsx` for filter/query transitions, `data-provider.test.ts` for mapping,
and `store-workspace.test.tsx` for lifecycle changes.
The latter uses real Refine hooks/cache with controlled GraphQL transport delays.
For browser behavior use `npm run test:smoke -- products.smoke.spec.mts` with the test DB
prerequisites in [testing](../../../docs/testing.md). Use `products-aurora.smoke.spec.mts`
for automatic filters, sorting/history, selection, batch deletion and responsive list/form captures.
Shared navigation changes also use
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

## Prototype workflow

Use [development modes](../../../docs/development.md#admin-data-modes) for commands and
current availability. Begin with [operation handlers](../../../apps/admin/src/mocks/handlers.ts),
[Tags](../../../apps/admin/src/mocks/tags.ts), [Products](../../../apps/admin/src/mocks/products.ts),
[Venues](../../../apps/admin/src/mocks/venues.ts), [Speakers](../../../apps/admin/src/mocks/speakers.ts),
[Events](../../../apps/admin/src/mocks/events.ts), [Sessions](../../../apps/admin/src/mocks/sessions.ts),
[Media](../../../apps/admin/src/mocks/media.ts)
and [versioned state](../../../apps/admin/src/mocks/state.ts). Keep concrete resource behavior
in its module, storage/Reset in state, and shared primitive validation in validation.ts.
The provider and generated
operations are shared with Real; MSW replaces only the transport response.

1. Identify all named operations used by the screen, including supporting lookups and
   mutation results. Read the actual owning service validation/repository before mocking
   an existing operation. Add concrete handlers and fixtures without importing service code.
2. Add the supported business section to [navigation](../../../apps/admin/src/navigation.ts) only
   after those handlers exist. Keep unimplemented routes guarded and unknown operations
   rejected. Prototype availability is independent of backend Reference disablement.
3. Keep the storage snapshot bounded and bump its version for incompatible fixture/state
   changes. Exercise failed writes and Reset; feature components do not read storage.
4. Run `npm run test:admin -- prototype.test.ts prototype-events.test.ts prototype-media.test.ts --skip-nx-cache` for mock/provider behavior
   and `npm run test:smoke -- prototype.smoke.spec.mts` for worker startup, persistence,
   Reset and navigation with no backend. Select the affected real feature checks as well;
   prototype results do not establish real-service parity.
   Use `prototype-crud.smoke.spec.mts` for Products/Venues/Speakers persistence, store
   isolation and referenced batch failures. Preserve null-last sorting, omitted/null
   updates and the owning service's error shape when adding or changing operations.
   Use `prototype-store-switch.smoke.spec.mts` alongside `products.smoke.spec.mts` for
   delayed Product reads, pending writes, Reset blocking and preserved new-store drafts.
   Use `prototype-events.smoke.spec.mts` for Event/Session relations, program, lifecycle and
   History. Resolve relation labels from current lookup rows, enforce actual referenced
   deletion including Trash, and persist mutations with History in one snapshot.
   Use `prototype-media.smoke.spec.mts` for native IndexedDB, XHR upload/cancel, saved
   bytes, cover/alt/order, Trash/Restore and Reset. Follow media.ts/media-storage.ts for
   metadata-authoritative persistence and orphan cleanup. Read the real media service,
   repository and local storage validation before extending media mocks. Select
   `tools/browser/media.smoke.spec.mts` for Real regression. Do not scatter mode checks
   through features or claim identical browser/Sharp decoding.
5. Update current behavior and limitations in the authoritative docs. Keep future-feature
   plans separate. Backend readiness is established by its actual contract/runtime checks,
   not by enabling a menu or checking a TypeScript type.

For a review spanning several modules, select the existing paired browser files from
[reviewing both admin modes](../../../docs/testing.md#reviewing-both-admin-modes).
Report executed counts, visual review and limitations separately. Do not compare fixture
names/counts as parity or substitute Prototype results for Real service checks.
