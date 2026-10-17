---
name: holita-admin-development
description: Review or extend the current holita Discocan Angular admin using Vehicles/Devices generated contracts, Gateway transport and scoped Apollo lifecycles. Not for backend implementation.
---

# Holita Discocan Angular admin development

Read [AGENTS.md](../../../AGENTS.md), [architecture](../../../docs/discocan/architecture.md#angular-admin-foundation)
and [focused checks](../../../docs/discocan/testing.md#angular-admin-checks). Use the official
[angular-developer](../angular-developer/SKILL.md) skill for framework conventions and the
PrimeNG plugin router for the relevant current workflow. Agent setup is in
[development](../../../docs/development.md#angular-agent-tools).

Apply [Discocan instructions](../../../docs/discocan/instructions.md). Branch represents a
vehicle fleet in Discocan and an online shop in Ecommerce; both use the Core Branch contract.
This Vehicles/Devices workflow belongs to Discocan; online-shop work uses [Ecommerce instructions](../../../docs/ecommerce/instructions.md).

## Trace the concrete implementation

- [app.config.ts](../../../apps/admin/src/app/app.config.ts) configures standalone routing,
  HTTP, Sakai preset and Branch discovery Apollo. Public startup config selects Gateway URL,
  availability and optional private user license; validate before bootstrap.
- [BranchWorkspace](../../../apps/admin/src/app/features/branches/branch-workspace.ts) owns
  authenticated discovery and session/Branch/language routing. [Login](../../../apps/admin/src/app/features/auth/login.ts)
  owns the standalone login layout and sequential Tenant/Branch selection. Candidate tokens/discovery
  retire on Tenant/language changes; only a submitted Branch activates the session and opens Vehicles.
  There is no Branch list landing page; Fleet navigation contains Vehicles/Devices and the header switches Branches; switching Branches
  preserves Vehicles/Devices and resets query context. Unknown Branches issue no business requests.
- [FleetWorkspace](../../../apps/admin/src/app/features/fleet/fleet-workspace.ts)
  gates availability and keys children by session/Branch/language/resource/editor/ID. Recreate mounted
  views even when Angular reuses parameterized routes. Shell components own presentation only.
- [VehiclesPage](../../../apps/admin/src/app/features/fleet/vehicles/vehicles-page.ts),
  [VehiclesApi](../../../apps/admin/src/app/features/fleet/vehicles/vehicles-api.ts) and
  [VehicleEditor](../../../apps/admin/src/app/features/fleet/vehicles/vehicle-editor.ts)
  are concrete list/client/form examples. Preserve nullable multiline Notes, text limits,
  server-field focus, assigned-Vehicle errors and page-local sequential deletion.
- [DevicesApi](../../../apps/admin/src/app/features/fleet/devices/devices-api.ts) and
  [DeviceEditor](../../../apps/admin/src/app/features/fleet/devices/device-editor.ts)
  keep 15-digit IMEI strings and mandatory same-tenant/same-branch Truck assignment. The existing
  [RelationPicker](../../../apps/admin/src/app/features/fleet/relation-picker.ts) searches,
  pages and hydrates Vehicles through the captured Devices client; preserve read retirement.
- [graphqlOptions](../../../apps/admin/src/app/core/graphql/graphql-options.ts) captures
  immutable session/Branch/language transport headers. Every mounted feature owns its Apollo client
  and InMemoryCache; headers alone do not isolate deduplication/cache.

## Preserve contracts and lifecycle

Keep named operations beside features and consume ignored generated TypedDocumentNodes/types.
Run codegen/schema:check after operation changes. No generic CRUD/facades/duplicate API models.
Business editors use typed Reactive Forms and resource-owned explicit mapping/validation.
Dispose obsolete reads, cancel debounce and keep applied search/sort/page state in the URL.
Retain existing rows only for same-query refresh. Do not reset a bookmarked page before totals arrive.

Submitted writes retain their initiating client/session/Branch/language; retirement lets them settle,
invalidates only that client and suppresses obsolete callbacks. A → B → A creates fresh clients.
Hydrate editor fields once, retain failed drafts and guard dirty unsubmitted navigation/unload.
Disable submitted forms and prevent duplicate writes. Retire confirmation callbacks when views
change, stop unsent sequential deletes, preserve successes and retain failed rows for retry.

## Presentation and verification

Sakai owns the shell/feature visual composition. Use the [pinned source](../../../docs/development.md#sakai-source-reference)
for comparisons, PrimeNG documented APIs/tokens for controls, local feature styles and minimal
global CSS. Keep Bulgarian/English, keyboard/mobile, light/dark and loading/error/empty states.
Do not import ignored template source or add demo routes/dependencies.

Use [focused validation](../holita-focused-validation/SKILL.md). Select concrete Vehicles/Devices
API/query/editor/deletion suites, BranchWorkspace/FleetWorkspace and RelationPicker as affected.
Real CRUD uses angular-vehicles/angular-devices smoke files; routing/transport uses
angular-foundation; shell/theme/focus/resizing uses angular-shell. Run required type/build checks;
metadata validation does not prove compilation/browser behavior. Update authoritative docs and
report actual results and visual-review limits. Never run full regression without user request.
