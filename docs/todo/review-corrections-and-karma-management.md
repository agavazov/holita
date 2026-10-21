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

- **Validation / P2:** Finish the required broad admin, contract and backend checks. Reproduce
  admin timeouts with the documented single-worker setting before classifying their cause;
  keep deadlines and behavioral assertions intact.

## Performance

- **P3 / remaining measurement:** Profile repeated settings reads, Intl construction in real
  display paths and drawer choice loading. Evaluate SQL alternatives against representative
  workloads before selecting an optimization; demo-sized warm plans do not establish production
  latency. No index or caching change follows from estimates.

## Karma device-management design and approval

User approval is pending for the [small-screen-flow proposal](karma-device-management-design.md)
and its [proposed identity/scope ADR](karma-device-management-identity-adr.md).
Implement the inventory-to-truck/device/settings move only after confirmation, with the
proposal's scope, durable-operation and validation requirements. No persistent identity links
or command-allowlist extensions are proposed.

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
