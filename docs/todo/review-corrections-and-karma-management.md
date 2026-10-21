# Review corrections and Karma device management

Pending work for the current Fleet/Karma implementation. This backlog supersedes the temporary
review scratchpad; retain only open work here. Implemented contracts belong in
[Discocan architecture](../discocan/architecture.md), [Fleet](../discocan/fleet.md) and the
[admin design system](../admin-design-system.md). Existing provider questions remain in
[the Karma backlog](karma-api-v2.md), and reporting/restoration work remains in
[the eData backlog](erm-edata-configuration-interface.md).

## Correctness and focused coverage

The identifiers below retain the original review's references. Each correction requires a
focused regression at the affected boundary; database races require guarded PostgreSQL tests.

- **D2 / P2:** Use the configured Branch time zone and display distance unit in the odometer
  editor, preserving canonical km on submission. Expose unavailable states for INACTIVE
  vehicles and for an empty valid time interval; cover DST and direct routes.
- **D10 / P2:** Restore FilterBuilder focus to an enabled control at the condition limit;
  preserve a debounced search draft during correctPage URL rewrites; give simulated-save
  story waits explicit bounds; use a DatePicker with explicit time interpretation for Device
  installedAt; permit captured submitted writes to finish after route retirement; announce
  sort direction; fix the read-only task Vehicle label and nonbreaking unit spacing.
- **D11 / P2:** Add connected Devices out-of-range-page coverage and exercise real Fleet route
  definitions in route-reuse specs. Extend the existing list lifecycle coverage where a real
  gap remains; do not recreate the already existing device-diagnostics spec.
- **Validation / P2:** Restore the existing formatting gate on the files it reports. Reproduce
  admin timeout failures with the documented single-worker setting before classifying them
  as functional defects; keep deadlines and behavioral assertions intact.

## Performance

- **P3 / measurement required:** Measure count-window alternatives, Overview time predicates,
  OPEN-alert predicates/indexes, repeated settings reads, Intl construction and drawer choice
  loading before selecting any optimization. No index or caching change follows from estimates.

## Karma device-management design and approval

Prepare a short design note and stop for user confirmation before implementing the move.
Keep the interface small, accessible and based on existing components; no broad redesign.

- Verify configured-account inventory and combined car/device fields using read-only API
  requests. Distinguish car_id, opaque device_id, local Device UUID and IMEI; registration text
  and a 15-digit format do not establish identity equality or a persistent link.
- Specify inventory/truck/device/configuration screens, retained/removed screens and old-route
  redirects. Keep account inventory Branch-less; require verified Tenant/Branch scope for every
  Fleet read/write and key clients to the selected scope/target/session/language.
- Prefer the existing explicit per-request target selection unless a demonstrated workflow
  requires a persistent link. Record the identity/scope decision in an ADR; any stored link
  needs verified matching, duplicate prevention and missing/ambiguous states.
- List protocol-supported parameter/operator/value/unit/combinations and distinguish them from
  implemented writes. The current command 301 allowlist permits only 0702BC, 1F and 02 plus exactly
  one 22-byte definition. Any extension needs retained encoding evidence and explicit approval;
  do not invent rule bytecode or add a server rule engine.
- Reuse QUEUED, SUBMITTING, WAITING, UNKNOWN, COMPLETE, TIMED_OUT, FAILED with readable BG/EN labels.
  Define catalog-derived names, localized unknown-ID fallbacks and technical disclosures.
- Preserve whole-set/unknown definitions, baseline comparison, 120-second preflight, independent
  verification, durable refresh/restart recovery and no replay after uncertain writes. Queue
  acceptance does not confirm application. Providers remain in Karma Client; reusable durable
  behavior and history remain scoped in Fleet.

## Behavior-preserving cleanup after the approved feature

Report before starting this separate scope. Verify a candidate's remaining consumers before
changing it; use concrete functions/helpers only and retain the existing application boundaries.

- **A1-A4:** Consolidate repeated list/query/page-correction/batch-notice functions in ui/list,
  condition codecs and sort transitions. Consolidate the remaining saving/focus helpers;
  remove unused helpers only after checking feature and story consumers.
- **A5-A6:** Move Fleet-only formatting/context out of neutral ui; remove confirmed unused
  remote options, formatter exports, list helpers, selections, route data and catalog entries.
  Preserve real consumers, including TablePanel's internal selectionProgress template.
- **A8-A11:** Reuse duplicated GraphQL fragments/choice operations and bounded page loading,
  remove sample-only alternate view contracts, centralize explanatory thresholds and move
  presentation choices out of container-owned query files.
- **A12:** Ensure Admin stories mount one toast host, consolidate concrete operation notices
  and cover dark presentation.
- **B1-B3:** Remove unused Driver/trip/event aggregate entry points; consolidate concrete
  failure maps/batch loops/filter helpers. Preserve the documented canonical task/event search
  and sort contract; empty localized enum matches are intentional.
- **T1-T4:** Consolidate native browser selection/GraphQL/KPI/capture/overflow helpers. Move
  standalone eData tooling checks to an explicit runnable target while retaining relevant
  local requirements and device-configuration coverage; avoid duplicate binary collection.
  Add the formatter commit to git-blame-ignore-revs.
- Turn Storybook sample hosts into scenario presenters with canned outcomes, retaining useful
  interactive Examples without copied backend rules.
- Add Storybook interaction/axe tests to affected-admin PR CI; validate with actionlint and
  preserve real event base/head selection and manual-only full regression.
- Replace the added legacy Karma form/detail layouts when their consumers move to shared
  patterns. Existing consumers still need those selectors; add no new legacy rules.
- **Doc2/Doc6:** Correct stale design-system API/story/helper descriptions and give shared
  settings/workspace behavior one authoritative home with links from consumers.

Shared backend packages are deferred to a separately justified architectural change. Keep
feature-owned Apollo lifecycles; do not introduce a shared lifecycle class or a per-worker
smoke backend. Do not delete branches/worktrees or change visual baselines.

## Documentation corrections accompanying the fixes

- **Doc1:** Correct ADR0004 to describe the connected Fleet screens and current Storybook use.
- **Doc3:** Correct command/capture/schema/migration references and scoped table counts against
  the implementation, including FleetSettings and FleetDeviceOperation.
- **Doc4:** Restore agent rules for Meridian as visual inspiration only and never reading,
  printing or committing apps/admin/public/config.local.json; ignore editor swap files.
- **Doc5:** Remove completed/contradictory backlog entries, preserve the theme-purchase decision
  in English, consolidate release/frontend stubs and repair references.
- **Doc7:** Remove implementation-progress wording from authoritative product documents.
