---
name: holita-admin-development
description: Review or extend the connected holita Discocan Fleet admin using shared screen presentation, generated Gateway contracts and scoped Apollo lifecycles. Not for backend implementation.
---

# Holita Discocan Angular admin development

Read [AGENTS.md](../../../AGENTS.md), [architecture](../../../docs/discocan/architecture.md#angular-admin-foundation)
and [focused checks](../../../docs/discocan/testing.md#angular-admin-checks). Use the official
[angular-developer](../angular-developer/SKILL.md) skill for framework conventions and the
PrimeNG plugin router for the relevant current workflow. Agent setup is in
[development](../../../docs/development.md#angular-agent-tools).

Apply [Discocan instructions](../../../docs/discocan/instructions.md). Branch represents a
vehicle fleet in Discocan and an online shop in Ecommerce; both use the Core Branch contract.
This Fleet workflow belongs to Discocan; online-shop work uses [Ecommerce instructions](../../../docs/ecommerce/instructions.md).

## Trace the concrete implementation

- [app.config.ts](../../../apps/admin/src/app/app.config.ts) configures standalone routing,
  HTTP, the holita theme (`provideHolitaTheme`) and Branch discovery Apollo. Public startup
  config selects Gateway URL, availability and optional private user license; validate before
  bootstrap.
- [AdminWorkspace](../../../apps/admin/src/app/workspace/admin-workspace.ts) coordinates the common
  session/language/login and shell. Its component-scoped
  [BranchContext](../../../apps/admin/src/app/features/branches/branch-context.ts) owns authenticated
  discovery and Branch selection/routing. Karma consumes the common session/language without
  depending on BranchContext. [Login](../../../apps/admin/src/app/features/auth/login.ts)
  owns the standalone login layout and sequential Tenant/Branch selection. Candidate tokens/discovery
  retire on Tenant/language changes; only a submitted Branch activates the session and opens Overview.
  Login, the language root and the Branch Fleet root open Overview. There is no Branch list landing page. The
  header switches Branches, preserves the current Fleet section or Vehicle groups, returns
  from record paths to that section and resets query/hash context. Unknown Branches issue no
  business requests.
- [FleetWorkspace](../../../apps/admin/src/app/features/fleet/fleet-workspace.ts)
  gates availability and keys business views by session/Branch/language/resource.
  [FleetRouteReuseStrategy](../../../apps/admin/src/app/features/fleet/fleet-route-reuse.ts)
  retains list/profile parents across query and drawer navigation and recreates scoped record
  routes on Branch, language or record changes. Shell components own presentation only.
- [graphqlOptions](../../../apps/admin/src/app/core/graphql/graphql-options.ts) captures
  immutable session/Branch/language transport headers. Every mounted feature owns its Apollo client
  and InMemoryCache; headers alone do not isolate deduplication/cache.

Connected entry points under `apps/admin/src/app/features/fleet`:

| Feature          | Runtime source and contract boundary                                                                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vehicles         | `vehicles/vehicles-page.ts`, `vehicle-editor-page.ts`, `vehicles-api.ts`, `vehicle-query.ts`, `vehicle-mapping.ts`: full record/editor, Branch KPIs and group/driver choices                                                        |
| Profile/odometer | `vehicles/vehicle-profile-page.ts`, `vehicle-profile-api.ts`, `vehicle-odometer-page.ts`: overview/trips/alerts/service tabs with independently paged records; shared vehicle editor and a manual reading drawer                    |
| Devices          | `devices/devices-list-page.ts` exports the routed `DevicesPage`; `device-editor-page.ts`, `device-diagnostics-page.ts`, `devices-api.ts`, `device-query.ts`, `device-mapping.ts` own live behavior                                  |
| Overview         | `overview/overview-page.ts` and `overview-api.ts`: actual Branch KPIs/charts, recent trips and attention links                                                                                                                      |
| Alerts           | `alerts/alerts-page.ts`, `alert-detail-page.ts`, `alerts-api.ts`, `alert-query.ts`, `alert-mapping.ts`: actionable events, optimistic transitions and status-independent filtered counts                                            |
| Trips            | `trips/trips-page.ts`, `trip-detail-page.ts`, `trips-api.ts`, `trip-query.ts`, `trip-mapping.ts`: real event timeline, filtered distance total and separate Branch summary                                                          |
| Drivers          | `drivers/drivers-page.ts`, `driver-editor-page.ts`, `driver-scorecard-page.ts`, `drivers-api.ts`, `driver-query.ts`, `driver-mapping.ts`: routed read/edit, document fields and 7/30/90-day scorecards                              |
| Maintenance      | `maintenance/maintenance-page.ts`, `maintenance-record-page.ts`, `maintenance-api.ts`, `maintenance-query.ts`, `service-task-mapping.ts`: planned editors, immutable receipts/cancelled records and atomic completion/next planning |
| Vehicle groups   | `vehicle-groups/vehicle-groups-page.ts`, `vehicle-group-editor-page.ts`, `vehicle-groups-api.ts`: complete paged list, shared settings presentation and protected single-record deletion                                            |
| General settings | `settings/general-settings-page.ts`, `general-settings-api.ts`, `general-settings-mapping.ts`, `general-settings-view.ts`: Fleet preferences and separate Core Branch renaming with truthful partial-save handling                  |

Trace the selected operation in its feature's `operations.graphql`, then the concrete API,
explicit query/mapping and shared view/drawer. Profile consumes pure Trip/Alert/Service row
mappers; do not inject another screen's service or duplicate its business editor. Actual
routes are in [fleet.routes.ts](../../../apps/admin/src/app/features/fleet/fleet.routes.ts).
Workflow details and field constraints belong to [Fleet](../../../docs/discocan/fleet.md).

`FleetWorkspace` owns the captured `settings/fleet-preferences.ts` read gate. Do not mount a
business view or issue its queries before preferences load; expose Retry on failure and issue
no preferences/business reads for unknown or disabled Branches. `FLEET_DISPLAY` from
`ui/format/fleet-format.ts` supplies configured time zone and display units. Convert read
values/charts through `injectFleetFormat()` while preserving null/zero. Storage, typed editors
and filters retain their explicitly labelled canonical km/kmh/l units; never submit rounded
display conversions. Calendar filters use the Branch zone; honour explicit entry-zone hints.

## Preserve contracts and lifecycle

Keep named operations beside features and consume ignored generated TypedDocumentNodes/types.
Run codegen/schema:check after operation changes. No generic CRUD/facades/duplicate API models.
Business editors use typed Reactive Forms and resource-owned explicit mapping/validation.
Dispose obsolete reads, cancel debounce and keep applied search/conditions/sort/page state in
the URL through `UrlListState` and an explicit feature `ListDefinition`. Use the real backend's
independent `allOf` predicates and supported sort fields. Search is bounded to five words/200
code points; relation selections to 100, and choice requests to bounded pages. Load every
choice page rather than silently truncating the Branch. Retain existing rows only for
same-query refresh. Do not reset a bookmarked page before totals arrive.

Submitted writes retain their initiating client/session/Branch/language; retirement lets them settle,
invalidates only that client and suppresses obsolete callbacks. A → B → A creates fresh clients.
Hydrate editor fields once, retain failed drafts and guard dirty unsubmitted navigation/unload.
Routed drawers own load/error/missing/invalid-ID states and close to the retained parent's
absolute `DrawerHost.closeLink`, preserving query/hash. Use `leaveDrawer`/`canLeave()` so one
dirty navigation asks once. A profile edit returns to the active tab. Keep server-derived
state and a missing data clock unchanged; instant filters use the configured Branch time zone
and service dates stay calendar values. Disable submitted forms, prevent duplicate writes and
focus mapped server fields even when a fast failure produces no rendered busy frame.

Vehicles delete/deactivate, Devices/Drivers delete, Alerts acknowledge and Maintenance
cancel/delete submit one IDs-array mutation for a row or selection. Preserve per-ID failures,
remove only successful IDs from the selection and let a submitted batch settle in its captured
scope. Vehicle groups deletion remains single-record and protected. Retire pending
confirmations on query context change/destroy. Publish current operation results through the
one `OperationToast`/`MessageService` in `AdminWorkspace`; load/field errors stay inline, and
retired callbacks never notify or refresh a new workspace.

Preserve these distinctions: a stock Device has `vehicleId: null`; live restart, firmware
policy and signal/voltage have no provider contract and must stay unavailable. Storybook Demo
successes are not live operations. Maintenance costs and filters use exact integer EUR cents;
DONE/CANCELLED history cannot be edited. An inactive vehicle may receive historical service
completion but no next planning. A service odometer does not update telemetry; a manual
odometer reading does not advance the telemetry clock. General settings saves real Fleet
preferences, then conditionally renames the Core Branch. Keep the two writes separate: apply
canonical saved Fleet values immediately, retain a rejected name draft, expose a partial-save
warning and make Discard restore the actual persisted baseline. Full success refreshes Branch
discovery after a rename. Notification switches and the Demo bell remain explicitly
unavailable, with no preferences/delivery write; speed limit is a stored reference and does
not generate alerts.

## Presentation and verification

The [admin design system](../../../docs/admin-design-system.md) owns shell and feature
presentation; follow the [admin design-system skill](../holita-admin-design-system/SKILL.md) for
tokens, patterns, PrimeNG controls and stories, and review in the
[admin Storybook](../../../docs/development.md#admin-storybook). Use PrimeNG documented APIs/tokens
for controls, local feature styles and minimal global CSS. Keep Bulgarian/English,
keyboard/mobile, light/dark and loading/error/empty states. Every connected screen has a BG/EN
catalog; preserve key/placeholder parity tests. Do not import Storybook samples/fixtures into
application code or add demo routes/dependencies.

Use [focused validation](../holita-focused-validation/SKILL.md) and the
[concrete screen selectors](../../../docs/discocan/testing.md#connected-fleet-screens).
For example, `--include=app/features/fleet/maintenance/maintenance-record-page.spec.ts`
checks the routed workflow; `--include=app/features/fleet/vehicles/vehicle-profile.spec.ts`
checks profile/reading lifecycle; `--include=app/features/fleet/devices/devices-list-page.spec.ts`
checks the current Devices adapter. Add AdminWorkspace/BranchContext/FleetWorkspace and shared
drawer/filter/action specs when affected. Real persistence uses `angular-vehicles.smoke.spec.mts`,
`angular-devices.smoke.spec.mts` and `angular-fleet.smoke.spec.mts`; routing/transport uses
`angular-foundation`, and shell/theme/focus/resizing uses `angular-shell`. Live `Admin/...`
stories use the real routed container with immutable typed GraphQL snapshots, while sample
`Examples/...` stories isolate presentation. Run required type/build checks;
metadata validation does not prove compilation/browser behavior. Update authoritative docs and
report actual results and visual-review limits. Never run full regression without user request.

General settings uses `settings/general-settings-api.spec.ts`,
`general-settings-page.spec.ts`, `general-settings-view.spec.ts`,
`general-settings-mapping.spec.ts` and `fleet-preferences.spec.ts`; include
`app/ui/format/fleet-format.spec.ts` plus workspace/Branch specs when changing propagation or
the initial gate. Current Device query/client coverage is `devices/device-query.spec.ts` and
`devices/devices-client.spec.ts`; editor and batch behavior use `device-editor-page.spec.ts`
and `devices-list-page.spec.ts`.
