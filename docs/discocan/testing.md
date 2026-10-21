# Discocan focused checks

## Simple eData reference catalog

See the [catalog checks](erm-resources/simple-edata-catalog/README.md#focused-validation)
for EXE-only TypeScript fixtures and the focused Fleet `edata-catalog.unit.spec.ts`,
`edata-catalog.db.spec.ts` and `initial-migration.db.spec.ts branch-migration.db.spec.ts` selectors. Real PostgreSQL
checks cover the full v9.56 catalog, transactional rollback, concurrency, idempotency
and stored-row verification in dedicated test schemas.

Follow the [shared validation guide](../testing.md) for native targets, database prerequisites,
guarded fixtures, CI selection and manual full regression. These checks cover the current
Fleet implementation using the shared Core Branch scope.

## Vehicles checks

`npm run test:fleet -- vehicles.service.spec.ts --skip-nx-cache` checks the master data field
rules, the merged-row INACTIVE/driver rule, duplicate pre-check paths, filter/sort mapping, the
`sort` path and creation-only Core checks. `vehicles.db.spec.ts` checks actual scoped CRUD,
federation references, the round trip of every field with group/driver references, duplicate
Fleet number/VIN paths, group/driver scoping, deactivation, the INACTIVE CHECK, filters, sorts
with NULLS LAST, multi-token and Cyrillic case-insensitive search, literal `%_\` and
page/total consistency.

```bash
npm run test:admin -- --include="app/features/fleet/vehicles/*.spec.ts" --include=app/features/fleet/fleet-workspace.spec.ts --skip-nx-cache
npm run test:smoke:admin -- angular-vehicles.smoke.spec.mts
npm run test:smoke:admin -- angular-fleet.smoke.spec.mts --grep="profile tab"
```

Angular suites cover URL query helpers, typed forms, server-field focus, client/cache isolation,
late writes, partial deletion/retry and retired confirmations. `vehicle-profile.spec.ts` and
`vehicle-profile-query.spec.ts` cover the profile API/adapter, related-record paging, shared
editor return paths and manual readings without a fabricated data clock. Browser checks use real CRUD,
reload/scoping and Bulgarian 1280/390/320px light/dark forms/lists. Captures belong in ignored
`.references/review/vehicles`.

## Devices checks

`npm run test:fleet -- devices.service.spec.ts --skip-nx-cache` checks IMEI/assignment
validation, the option-for-model matrix, SIM/ICCID/firmware and installation-time rules,
merged-row validation, scoped calls and constraint mapping. `devices.db.spec.ts` checks exact digits,
leading zeros, per-Tenant/Branch uniqueness, same-tenant/same-branch FK, shared Vehicles, protected Vehicle deletion,
reassignment, scoped CRUD, the new fields, option rules, the `FleetVehicleRef` vehicle and list
filters/search/sorting.

```bash
npm run test:admin -- --include="app/features/fleet/devices/*.spec.ts" --skip-nx-cache
npm run test:smoke:admin -- angular-devices.smoke.spec.mts
```

Controlled Angular tests exercise the routed `devices-list-page.ts`/`device-editor-page.ts`
runtime: captured clients, optional stock assignment, full bounded Vehicle choices, typed
fields, diagnostics metadata, field focus and real IDs-array deletion with partial results.
Submitted batches survive scope retirement without late UI callbacks. Real browser cases check
persistent stock and assignment/reassignment/uniqueness, scope and Bulgarian desktop/narrow light/dark views.
Captures belong in ignored `.references/review/devices`. Signal/voltage, firmware policy and
restart have no live provider contract; Storybook Demo interactions do not prove such a command.

## Fleet list contract, Drivers and Vehicle groups checks

```bash
npm run test:fleet -- validation.spec.ts scalars.spec.ts drivers.service.spec.ts vehicle-groups.service.spec.ts --skip-nx-cache
npm run test:fleet:db -- constraints.db.spec.ts drivers.db.spec.ts vehicle-groups.db.spec.ts
```

`validation.spec.ts` covers paging bounds, search tokens (five tokens, 200 code points, NUL,
Unicode whitespace), filter and input enum lists, calendar dates (30 February, leap days),
date-times with required offsets, half-open `DateTime` and closed `Date` ranges, finite numbers,
`invalidFields` and `uniqueViolation` for adapter errors with an index, with columns, without a
cause and for other errors. `scalars.spec.ts` covers `Date`/`DateTime` serialization, string-only
parsing and UTC-midnight conversion. `drivers.service.spec.ts` covers field rules, document status
at today, today + 30 and + 31 days at a fixed Sofia business date and INACTIVE-while-assigned;
`vehicle-groups.service.spec.ts` covers name rules and defaults.

`constraints.db.spec.ts` proves every master data CHECK with direct SQL, composite foreign keys
rejecting foreign-Branch/Tenant groups and drivers, and that a real P2002 from each natural unique
index reports its generated index name through the pg adapter and is mapped by the service to its
field path. `drivers.db.spec.ts` covers CRUD, uniqueness, protection of assigned drivers, the
documents filter at a fixed `FleetClock` and scoped search/sorting; `vehicle-groups.db.spec.ts`
covers CRUD, unique names, vehicle and ungrouped counts and protected deletion. List specs seed
rows in another Branch and another Tenant with the same Branch UUID and assert that only the
requested scope is visible and counted.

## Fleet activity checks

```bash
npm run test:fleet -- sql.spec.ts vehicle-state.spec.ts telemetry.service.spec.ts trips.service.spec.ts events.service.spec.ts service-tasks.service.spec.ts vehicles.service.spec.ts devices.service.spec.ts drivers.service.spec.ts health.spec.ts --skip-nx-cache
npm run test:fleet:db -- constraints.db.spec.ts telemetry.db.spec.ts trips.db.spec.ts events.db.spec.ts service-tasks.db.spec.ts vehicles.db.spec.ts devices.db.spec.ts drivers.db.spec.ts
npm run test:gateway:db -- federation.db.spec.mts
```

Unit specs: `sql.spec.ts` covers `fleetTable` quoting and its closed table list and the raw row
readers; `vehicle-state.spec.ts` the activity and fuel classification at 48 h, 5 km/h, 12 %,
6 h, unknown ignition and a missing data clock; `telemetry.service.spec.ts` odometer reading
bounds and ordering and the sample window; `trips.service.spec.ts` filters, duration,
score-below and `inProgress` at 24 h, 24 h + 1 ms, an ended trip and no data clock;
`events.service.spec.ts` the full transition matrix (three mutations × three expected
statuses) without database access on invalid transitions, remark semantics, alert and maneuver
counts and measurement units; `service-tasks.service.spec.ts` create/update/complete/cancel/
delete rules and next-task validation. The vehicles, devices and drivers service specs cover
the batched derived values (state, open alerts, next service, last report, 30-day statistics
and the scorecard window).

Database specs: `constraints.db.spec.ts` also proves every activity CHECK, the composite keys
for foreign-Branch drivers and trips and an event whose trip belongs to another vehicle, and the
(vehicle, IMEI, time) sample key. `telemetry.db.spec.ts` proves that the data clock ignores
MANUAL rows and other Branches/Tenants, that a reading changes the odometer but not the clock or
activity, the reading bounds, the half-open seven-day window and the 2,000-row cap, with raw SQL
in a random schema. `trips.db.spec.ts` covers every filter, sorts with NULLS LAST and the
`startedAt` tie-break, paging, `totalDistanceKm` and maneuver counts. `events.db.spec.ts` covers
filters/search, alert counts equal to the list totals per status for the same search and filter,
persisted transitions, a stale `expectedStatus`, two parallel acknowledgements (one CONFLICT) and
informational or foreign events as NOT_FOUND. `service-tasks.db.spec.ts` covers urgency for
date-only, km-only, both and unknown-odometer tasks at a fixed business date, the raw list's
order and paging for every sort, filters and search, the summary windows, completion with the
next task, a forced failure that rolls both writes back, and cancel/delete rules. Vehicles,
devices and drivers specs add page-level state/open alerts/next service, `hasOpenAlerts`,
`lastReportedAt` by (vehicle, IMEI) including reassignment, and 30-day statistics with the
scorecard. The federation case records an odometer reading through Router, inserts a device
sample and an OPEN alert into the per-run schema (`fleetDatabaseUrl`/`fleetSchema` from the
fixture), acknowledges it once (the repeat is CONFLICT) and checks that alert counts match the
actionable list with and without search while Sandbox stays empty.

## Angular admin checks

`--include` paths are relative to `apps/admin/src`; `--filter` selects case names.
Use `VITEST_MAX_WORKERS=1` on CPU-constrained hosts without changing case deadlines.

```bash
npm run test:admin -- --include=app/features/branches/branch-context.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/features/fleet/fleet-workspace.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/core/config/admin-config.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/core/graphql/graphql-options.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/theme/appearance.spec.ts --skip-nx-cache
```

Branch/workspace tests prove independent login layout, sequential Tenant/Branch selection, cancellation
of obsolete candidate tokens and Branch discovery, tenant A → B → A, direct Fleet navigation and
the Overview landing route, cancellation on Branch/language
change, unknown Branch and disabled Fleet behavior. Feature APIs prove retired submitted-write
success/failure and isolated caches. Real transport uses `angular-foundation.smoke.spec.mts`;
Shell focus/theme/resizing/mobile behavior uses `angular-shell.smoke.spec.mts`; design-system
changes use the checks in the [admin design system](../admin-design-system.md#changing-the-design-centrally).
Behavioral checks and [Storybook visual review](../testing.md#storybook-visual-review) are
separate evidence.

### Connected Fleet screens

Select the concrete feature files that own a changed contract or workflow. Paths below are
relative to `apps/admin/src/app/features/fleet`; run one with
`npm run test:admin -- --include=app/features/fleet/<path> --skip-nx-cache`.

| Feature                      | Focused Angular specs                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview                     | `overview/overview-page.spec.ts`                                                                                                                                                                                                                                                                              |
| Alerts                       | `alerts/alerts-api.spec.ts`, `alerts/alert-query.spec.ts`, `alerts/alert-mapping.spec.ts`, `alerts/alerts-page.spec.ts`, `alerts/alert-detail-page.spec.ts`                                                                                                                                                   |
| Trips                        | `trips/trips-api.spec.ts`, `trips/trip-query.spec.ts`, `trips/trip-mapping.spec.ts`, `trips/trips-page.spec.ts`, `trips/trip-detail-page.spec.ts`                                                                                                                                                             |
| Drivers and scorecard        | `drivers/drivers-api.spec.ts`, `drivers/driver-query.spec.ts`, `drivers/driver-mapping.spec.ts`, `drivers/drivers-page.spec.ts`, `drivers/driver-editor-page.spec.ts`, `drivers/driver-scorecard-page.spec.ts`                                                                                                |
| Maintenance                  | `maintenance/maintenance-api.spec.ts`, `maintenance/maintenance-query.spec.ts`, `maintenance/service-task-mapping.spec.ts`, `maintenance/maintenance-choices.spec.ts`, `maintenance/maintenance-page.spec.ts`, `maintenance/maintenance-record-page.spec.ts`, `maintenance/service-completion-drawer.spec.ts` |
| Vehicle groups               | `vehicle-groups/vehicle-groups-api.spec.ts`, `vehicle-groups/vehicle-group-mapping.spec.ts`, `vehicle-groups/vehicle-groups-page.spec.ts`, `vehicle-groups/vehicle-group-editor-page.spec.ts`                                                                                                                 |
| General settings/preferences | `settings/general-settings-api.spec.ts`, `settings/general-settings-mapping.spec.ts`, `settings/general-settings-page.spec.ts`, `settings/general-settings-view.spec.ts`, `settings/fleet-preferences.spec.ts`                                                                                                |
| Vehicle profile and odometer | `vehicles/vehicle-profile.spec.ts`, `vehicles/vehicle-profile-query.spec.ts`, `vehicles/vehicle-profile-view.spec.ts`, `vehicles/odometer-drawer.spec.ts`                                                                                                                                                     |

These adapters cover actual generated operation shapes and captured-client lifetime, direct
record bookmarks, full choice paging, retained refresh data and drafts, field errors, URL
filters and partial batch retry. Alerts cases exercise optimistic transitions; Trips cases
preserve the returned event timeline and unknown measurements. Driver scorecard cases change
7/30/90-day URL periods without inventing telemetry. Maintenance cases distinguish immutable
vehicle assignment, exact cents, read-only history, atomic completion/next planning and an
inactive vehicle's historical completion. Group deletion checks preserve protected records.
Keep these checks distinct from the backend rules in the Fleet unit/database suites.

General settings cases cover the initial preferences gate and Retry before business queries,
captured reads/writes through Branch/language/session changes, conditional Core renaming and
honest partial saves. A failed name remains editable while Discard keeps already saved Fleet
preferences. `app/ui/format/fleet-format.spec.ts` covers display-unit conversion without losing
null/zero or changing labelled canonical editor/filter inputs. Include the workspace/Branch
specs when changing the gate or navigation.

```bash
npm run test:admin -- --include="app/features/fleet/**/i18n/*.spec.ts" --skip-nx-cache
npm run test:admin -- --include=app/ui/filter-builder/filter-model.spec.ts --include=app/ui/table-panel/table-panel.spec.ts --include=app/ui/drawer/route-drawer.spec.ts --skip-nx-cache
npm run test:smoke:admin -- angular-fleet.smoke.spec.mts
```

Catalog specs compare Bulgarian/English keys and placeholders; the shared filter/action/drawer
cases cover numeric precision, retired confirmations and guarded close behavior.
`angular-fleet.smoke.spec.mts` owns compiled-app/Gateway/database checks for Overview retry and
null telemetry, Group persistence/scope, Driver documents/scorecard, profile tab and editor
return paths, manual zero readings, Maintenance receipts/next tasks and empty or missing
Trips/Alerts. Use the native `--grep` selector for one relevant case. The fixture owns its
dedicated database schemas and services; do not substitute a development database.

Live-container stories sit beside the adapters (`overview-page.stories.ts`,
`alerts-page.stories.ts`, `trips-page.stories.ts`, `drivers-page.stories.ts`,
`maintenance-page.stories.ts`, `devices-list-page.stories.ts`,
`vehicle-groups-page.stories.ts`, `vehicles-page.stories.ts`,
`vehicle-profile-page.stories.ts`). They exercise real routes/services against typed immutable
GraphQL snapshots under `src/storybook`, including controlled failures. Refetch intentionally
returns the same read snapshot after a mutation; these stories are transport/presentation
evidence, not persistence or a second backend query engine. Existing sample stories remain
presentation examples. Run the native Storybook play/a11y target and the relevant visual
captures using the [shared selectors](../testing.md#storybook-visual-review); captures remain
candidates until a person approves them.

## Tenant sessions and migrations

```bash
npm run test:core -- demo-auth.spec.ts --skip-nx-cache
npm run test:core -- database.module.spec.ts --skip-nx-cache
npm run test:fleet -- core-client.module.spec.ts --skip-nx-cache
npm run test:core:db -- persistence.db.spec.ts branches.db.spec.ts initial-migration.db.spec.ts branch-migration.db.spec.ts
npm run test:fleet:db -- vehicles.db.spec.ts devices.db.spec.ts drivers.db.spec.ts vehicle-groups.db.spec.ts telemetry.db.spec.ts trips.db.spec.ts events.db.spec.ts service-tasks.db.spec.ts constraints.db.spec.ts initial-migration.db.spec.ts branch-migration.db.spec.ts seeds.db.spec.ts
npm run test:admin -- --include=app/workspace/admin-workspace.spec.ts --include=app/core/auth/demo-session.spec.ts --skip-nx-cache
npm run test:smoke:admin -- angular-tenants.smoke.spec.mts
```

Session checks cover signatures, tampering, expiry, production opt-in, unauthenticated reads and
ignored tenant headers. DB/federation tests exercise scoped discovery/CRUD/entity resolution,
identical Branch IDs and IMEIs across tenants, composite relation rejection and seed idempotency.
Initial-migration tests deploy the complete schema in dedicated guarded databases, then check
mandatory scope columns, physical id/tenantId/branchId order for all eight Fleet business tables, and the full applied migration history. Upgrade tests preserve existing records (which receive the master data defaults) and migration checksums through the Branch rename, master data and activity migrations. They never touch
development tables. Angular tests cover logged-out deep links, Tenant/Branch dropdown gating and retry, obsolete candidate
responses, root-to-Overview navigation, remembered Branch selection, tenant client/cache retirement,
delayed submitted writes and fresh A → B → A clients. Browser login checks use the actual dropdown,
logout/reload and desktop/narrow light/dark views; fixture auto-login is disabled for that suite.

Module ownership checks establish one Core Prisma client with one disconnect on shutdown,
and one Fleet Core client with separate authorization and Branch-check promises per request.

## Karma Client checks

Shared Karma date/time controls use `app/features/karma-client/date-time/karma-date-time.spec.ts`
and `app/features/karma-client/karma-date-time.spec.ts`. The component keeps API clock hours textual,
including daylight-saving gaps; run with `TZ=Europe/Sofia` to exercise that boundary.
Map validation, optional configuration and explicit loading use
`app/features/karma-client/location/map-preview/map-preview.spec.ts`. Storybook's
`Design System/Karma/Controls` and `Admin/Karma Client/Maps` cover the shared responsive controls,
location, suggested endpoint route and missing-coordinate states without external map requests.
Truck section navigation and list-return context use
`app/features/karma-client/car-header/karma-car-header.spec.ts`; local search/project/pagination
use `app/features/karma-client/cars/cars-page/cars-page.spec.ts` and the
`Admin/Karma Client/Trucks` stories. Filter field errors and focus have routed form coverage
beside the date/history forms. Device overview-before-edit and save/cancel return use
`app/features/fleet/devices/device-diagnostics-page.spec.ts`, the editor/list specs and
`angular-devices.smoke.spec.mts`.

```bash
npm run test:karma-client -- accounts.spec.ts history.spec.ts location.spec.ts edata.spec.ts edata.service.spec.ts cars.spec.ts cars.service.spec.ts karma-transport.spec.ts health.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/features/karma-client/accounts/accounts.spec.ts --include=app/features/karma-client/history/history.spec.ts --include=app/features/karma-client/location-references.spec.ts --include=app/features/karma-client/edata/edata-page/edata-page.spec.ts --include=app/features/karma-client/karma-workspace.spec.ts --include=app/features/branches/branch-context.spec.ts --skip-nx-cache
npm run test:gateway:db -- federation.db.spec.mts
npm run test:smoke:admin -- angular-karma-phase4.smoke.spec.mts angular-karma-phase3.smoke.spec.mts angular-karma-phase2.smoke.spec.mts angular-edata.smoke.spec.mts angular-karma.smoke.spec.mts angular-foundation.smoke.spec.mts angular-shell.smoke.spec.mts
```

The client checks cover response validation, credential absence, bounded transport failures,
concurrent login sharing, session reuse and one renewal after Karma's HTTP-200 session error.
The transport module test imports all six feature modules and verifies that concurrent
feature reads share one upstream login through one application-local transport provider.
Non-success HTTP bodies are cancelled before parsing; tests include stalled bodies and prevent
session renewal for unrelated HTTP failures.
Detail checks cover invalid IDs before upstream access, missing trucks and mismatched responses.
HTTP tests verify the signed session protocol and reject anonymous/invalid sessions before
upstream reads. Angular checks cover independence from Branches/Fleet, no Branch header and
retirement across session/language/truck changes and logout, direct details and malformed IDs.

Federation and browser fixtures run the compiled Karma Client against a local controlled Karma
HTTP server. They never use live account credentials; the existing guarded Core/Fleet database
prerequisites still apply. Federation proves the common list/details across tenants/Branches, upstream
renewal and Fleet operation while Karma fails. Browser checks cover routing, Refresh, error/empty
states, Branch switching, reload/language and disabled-Fleet/signed-out behavior. Detail browser
checks cover list links, direct routes, Refresh/retry, retained data and missing/invalid trucks.

The eData suites cover a 500-row upstream cap with complete traversal beyond that cap,
50-row boundaries without skips/duplicates, current-page snapshots when new messages arrive,
UTC/parameter encoding, cursor/filter scope, source ordering and response validation.
Angular checks cover zero/null detail values, URL state, cancellation on filter/truck/language/
session changes and logout, missing trucks and retained rows on refresh failure.
The eData browser fixture walks all 600 messages, tests Newer/Latest/reload/back, filters and
page-size selection, keyboard dialog close/focus restoration and desktop/mobile light/dark
captures under ignored `.references/review/`.

Location/reference checks cover all verified fields, null/zero values, plain-text escaping,
malformed/mismatched/duplicate upstream records, signed access to public version, fixed
field selection and a common abort budget across location existence/login/read/renewal.
Angular cases cover missing trucks, independent reference failure, label/ID hydration,
bookmarked reference pages, and retirement across truck/view/language/session/logout.
The browser suite checks complete-list search/pagination, retained Refresh failures,
null/invalid/empty location, map link safety, separate menu navigation and BG/EN
desktop/mobile light/dark captures under ignored `.references/review/`.

History checks cover 600-row traversal, endpoint-bound cursor scopes, source order and
IDs, inclusive bounds, short-trip-batch lookahead, selected event fields/codes/UTC
periods, malformed source data, missing cars, nine profile categories and null/zero.
Transport cases preserve one budget through existence/login/read/lookahead/renewal.
Angular cases cover direct routes, full dialogs and escaping, seven-day defaults,
filter/period retirement, truck A → B → A, language/logout and native form submission.
The compiled browser fixture covers trip/event traversal, reload/back/Latest/Newer,
size/date/code filters, keyboard dialog focus, retained profile refresh/retry, empty/
missing states and desktop/mobile light/dark captures. Real Gateway cases verify signed
shared-account access across tenants/Branches for all three queries. These deterministic
fixtures do not establish live provider uptime, active-trip semantics or score units.

Account tests cover all eleven user fields, original memberships, null/zero/plain text,
strict duplicate/shape validation, signed shared access before reads, renewal within the
four-second bound and sanitized failures. Angular checks cover URL paging/search, retained
refresh data, navigation/language/session cancellation and logout. Gateway verifies the
complete account arrays across two Tenants/Branches with controlled renewal, failure and empty
states. Browser cases cover local paging beyond 50, all-field dialogs/focus, menu navigation,
reload/language, retained failures and desktop/mobile light/dark captures. Use the native
`--testNamePattern='Karma users'` Gateway selector for this behavior.

## Background device configuration read checks

Use the existing guarded PostgreSQL prerequisites, then run focused native checks:

```bash
npm run test:fleet -- device-operations.service.spec.ts device-operations.processor.spec.ts device-write-processor.spec.ts device-parameter-change.spec.ts device-read-evidence.spec.ts karma-device-reads.client.spec.ts --skip-nx-cache
npm run test:karma-client -- device-configuration.spec.ts configuration-transport.spec.ts parameter-write.spec.ts --skip-nx-cache
npm run test:fleet:db -- device-operations.db.spec.ts device-parameter-changes.db.spec.ts initial-migration.db.spec.ts branch-migration.db.spec.ts constraints.db.spec.ts
npm run test:gateway:db -- federation.db.spec.mts
npm run test:admin -- --include="app/features/fleet/device-operations/**/*.spec.ts" --skip-nx-cache
npm run test:smoke:admin -- angular-device-configuration.smoke.spec.mts
```

The persistence checks restart the Nest application against the same isolated schema,
recover a lease, retain multipart evidence and test Tenant/Branch isolation. The write
DB suite preserves the exact unknown baseline, verifies split evidence across restart
with writing disabled, recovers an expired write-marker lease without replay, enforces
cross-kind target locking/scoped baseline references and checks catalog eligibility. Write unit
checks cover whole-baseline comparison, eligible profiles, unknown-definition preservation,
zero/65000 intervals, conservative 120-second freshness, stale-reply rereads, capacity and
post-marker lease/deadline budget. The provider checks fixed `1F`/single-`02` packets,
cross-field definition validation, watermark filtering, separate `416` evidence, machine
authentication and uncertainty without replay.

The federation fixture uses real Fleet/Karma Client processes and a controlled upstream,
releases delayed reads after a Fleet restart, applies one additive definition, simulates an
accepted write with a lost response and verifies a normalized addition without another write.
It also updates an unknown ID's interval while preserving all other bytes and definitions.
The browser fixture verifies saved requests and results across navigation and reload,
adds a preset with separate zero confirmation, guards a dirty draft and updates an unknown
interval through uncertain-response verification. These checks send
no live device commands and do not establish compatibility with every hardware/firmware.

`Admin/Fleet/Device configuration` stories cover waiting, uncertain, timed-out, confirmed,
empty, disabled and error states, independent write availability, saved write failures,
historical snapshot selection, raw-definition disclosures and a row action that opens the
real editor. Interactive stories verify zero confirmation, confirmation reset after an intent
change and retaining a dirty draft when navigation is cancelled.
The parameter editor's focused cases cover baseline/target
changes, catalog choices, previews, zero confirmation, invalid/unchanged intervals, dirty
navigation and captured-scope submission. Visual candidates require human review; do not create or
replace approved baselines automatically. Scheduler execution and queue transmission alone
are not proof of a complete configuration response.

The configuration stories propagate play failures. Static visual captures wait for the
interaction's final controls and validation state, rather than relying only on the preview's
render-completion marker. Mobile captures check page width and ensure the interval and edit
action do not overlap. The zero-interval draft also covers all three brands and both densities
in light/dark desktop/mobile variants.
