# Review corrections and Karma device management

Pending work for the current Fleet/Karma implementation. This backlog supersedes the temporary
review scratchpad; retain only open work here. Implemented contracts belong in
[Discocan architecture](../discocan/architecture.md), [Fleet](../discocan/fleet.md) and the
[admin design system](../admin-design-system.md). Existing provider questions remain in
[the Karma backlog](karma-api-v2.md), and reporting/restoration work remains in
[the eData backlog](erm-edata-configuration-interface.md).

## Performance

- **P3 / remaining measurement:** Profile repeated settings reads, Intl construction in real
  display paths and drawer choice loading. Evaluate SQL alternatives against representative
  workloads before selecting an optimization; demo-sized warm plans do not establish production
  latency. No index or caching change follows from estimates.

## Karma settings simplification

The [settings backlog](karma-device-management-design.md) owns live device acceptance,
rule/event allocation and threshold-scale evidence, firmware semantics and Monitor interchange
questions. Do not duplicate those tasks in the general cleanup below. Implemented target
and operation contracts are in
[architecture](../discocan/architecture.md#background-device-configuration-reads).

## Behavior-preserving cleanup after the approved feature

Report before starting this separate scope. Verify a candidate's remaining consumers before
changing it; use concrete functions/helpers only and retain the existing application boundaries.

- **A1-A4:** Consolidate repeated list/query/page-correction/batch-notice functions in ui/list,
  condition codecs and sort transitions. Consolidate the remaining saving/focus helpers;
  remove unused helpers only after checking feature and story consumers.
- **A5-A6:** Move Fleet-only formatting/context out of neutral ui; remove confirmed unused
  selections, route data and catalog entries.
  Preserve real consumers, including TablePanel's internal selectionProgress template.
- **A8-A11:** Reuse duplicated GraphQL fragments/choice operations and bounded page loading,
  remove sample-only alternate view contracts, centralize explanatory thresholds and move
  presentation choices out of container-owned query files.
- **A12:** Ensure Admin stories mount one toast host, consolidate concrete operation notices
  and cover dark presentation.
- Add the formatter commit to git-blame-ignore-revs.
- Replace the added legacy Karma form/detail layouts when their consumers move to shared
  patterns. Existing consumers still need those selectors; add no new legacy rules.
- **Doc2/Doc6:** Correct stale design-system API/story/helper descriptions and give shared
  settings/workspace behavior one authoritative home with links from consumers.

Shared backend packages are deferred to a separately justified architectural change. Keep
feature-owned Apollo lifecycles; do not introduce a shared lifecycle class. Do not delete
branches or worktrees.
