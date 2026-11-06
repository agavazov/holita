# holita admin v2 — proposed UI and design-system plan

Status: approved by the owner on 2026-11-06; packages run in the order of section 13. It authorizes no device operation.
Scope: Discocan admin; assume the separately owned legacy-provider removal is complete. Keep existing Tenant/Branch isolation and workspace lifecycles.
Authority: [coding guide](../../AGENTS.md), [Discocan instructions](../discocan/instructions.md), [design system](../admin-design-system.md), [admin skill](../../.agents/skills/holita-admin-development/SKILL.md).
This plan selects UI work from the [presentation backlog](admin-design-system.md) and [backend backlog](admin-design-system-backend.md); device protocol expansion and physical verification remain in the [ERM roadmap](erm-roadmap.md).

## 1. Goals and principles

- **P0:** richer central design system, one table experience, clear navigation, readable existing commands and persistent waiting feedback.
- **P1:** useful interactive dashboard, complete fleet map, vehicle tracks, consistent dates and time zones.
- **P2:** real sign-in, profile/password change, Tenant users, persisted in-app notifications.
- P0/P1 can be demonstrated internally; client release requires P2 authentication and the existing release prerequisites. Priority is implementation order, not permission to expose demo authentication to clients.
- First show location, activity, problems and the next useful action. Put raw frames, identifiers and unverified measurements behind Technical details.
- Use colour to communicate hierarchy/status, with text and icons. Preserve light/dark, BG/EN, keyboard access and narrow-screen behavior.
- Extend existing concrete components/services and generated operations. No new UI framework, generic CRUD engine, permission system or new device-command families.
- Keep absent, zero, stale and failed data distinct. Never turn an acknowledgement into proof of execution or a historical fault into a currently unresolved fault.

### Deviations from the brief

| Decision | Validated decision / necessary correction                                                                                                                                                                                                                                                       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1       | Adopt the sidebar and dashboard tabs. Preserve Vehicle Maintenance and retained Device Parameters/technical inspection. Device Trips initially links to its currently assigned vehicle; device-assignment history is not a trip contract. Vehicle Commands selects a specific installed device. |
| D2       | Adopt Leaflet/raster tiles and shared map. Heading means a measured direction, not a predicted destination; no destination contract exists. Recorded tracks must use samples, not Google suggested directions.                                                                                  |
| D3       | Adopt `p-chart` for appropriate dashboard charts; retain useful accessible SVG charts. Chart.js is an explicit new dependency, not currently installed.                                                                                                                                         |
| D4       | Adopt one UTC output contract. Fleet already emits millisecond UTC instants; ERM exposes equivalent values as `String`. Preserve compatible offset-bearing inputs and date-only semantics; opaque raw protocol JSON is not a typed instant contract.                                            |
| D5       | Extend the existing Tenant/Branch `FleetSettings` row in Fleet; do not create a second Core settings model. Users remain Tenant-wide, even though Settings links to them.                                                                                                                       |
| D6       | Extend the implemented durable queue/audit. The supplied `$SLU…` example is an incoming acknowledgement, not an outgoing command; original purpose requires correlation.                                                                                                                        |
| D7       | One table presentation with offset, cursor and finite-array modes. Do not force lazy offset paging onto ERM cursor history or small snapshot arrays. SMS generation is an action form, not a table.                                                                                             |
| D8–D10   | Adopt PrimeNG 22/Aura/tokens and component governance. Main checkout, disjoint ownership, serialized integration/checks; this analysis runs no application checks.                                                                                                                              |

### Review decisions (Claude, 2026-11-06)

- **Visual impact:** besides the dark sidebar, tinted canvas and coloured KPI icon wells, add one
  `--p-app-hero-background` gradient token (brand primary to the teal accent, both schemes) used only
  for the sign-in side panel and the dashboard header band. Add an `.app-plate` CSS pattern that shows
  licence plates like a number plate (EU band) in lists, details and map popups.
- **Waves:** C0 and the Core part of A0 do not depend on F0. Wave 1 = **F0 ∥ C0 ∥ A0**, wave 2 =
  **F1 ∥ S0 ∥ N0 ∥ B0**, wave 3 = **V0 ∥ D0 ∥ L0**, wave 4 = **H0 ∥ A1 ∥ A0b → NF0**, wave 5 =
  **NF1**. I0 integrates after every wave.
- **A0 split:** A0 owns only `apps/core/` (users, sessions, sign-in/out, current user, profile,
  password change, users API, internal verification endpoint, first-user setup command). A0b wires
  Fleet/ERM verification, the verified audit actor and Router propagation after C0/B0.
- **Checks during parallel runs:** a run checks only its own projects, serialized by one lock:
  `flock .nx/holita-check.lock npx nx run-many -t build,test,test-db -p <projects> --output-style=static`,
  plus ESLint on its own files; `db:generate` and `codegen` run under the same lock. The integrated
  `npm run check`, `schema:check` and the routing/login smoke run once per wave in I0.
- **Telemetry:** ERM ingestion is already enabled in the development environment, so the dashboard
  and map have real data; B0 does not change ingestion or routing.
- **Tiles:** the OSM standard tile server is the default for development and internal demos; a managed
  provider is configured through the runtime config before client demos.

## 2. Navigation and routes

- Sidebar: **Dashboard, Vehicles, Devices, Drivers, Maintenance, Settings**. Settings children: General, Vehicle groups, Users. Remove Control center and Monitoring grouping.
- Dashboard tabs: **Overview / Problems / Trips**. Account menu: **Profile / Theme / Sign out**. Bell: recent notifications and **See all**.
- Preserve the existing language/Branch prefix and Fleet namespace to minimize churn. Let `B = /:language/:branchId/fleet` below; account/User routes are Tenant/session scoped.

| Existing route                                                | Canonical destination / redirect                                                                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/:language` after sign-in; `B`; `B/overview`                 | `B/dashboard/overview`                                                                                                                 |
| `/:language/:branchId/control-center`                         | `B/dashboard/overview`                                                                                                                 |
| `B/alerts`, including `/:recordId` drawers                    | `B/dashboard/problems`, preserving the alert drawer and applicable URL filters                                                         |
| `B/trips`, including `/:recordId` drawers                     | `B/dashboard/trips`, preserving trip context                                                                                           |
| `B/vehicles`, `B/devices`, `B/drivers`, `B/maintenance`       | Keep; reduce sidebar grouping only                                                                                                     |
| `B/vehicles/:id/alerts`; `.../service`                        | `B/vehicles/:id/problems`; `.../maintenance`; retain nested drawers                                                                    |
| `/:language/:branchId/control-center/devices/:id/:tab`        | `B/devices/:id/:tab`; map `alarms`/`diagnostics` → `problems`, `sms` → `sms-commands`, `events`/`frames` → Technical details subroutes |
| `B/devices/:id/diagnostics`; bare Device record URL           | Problems; Overview respectively                                                                                                        |
| `/:language/:branchId/control-center/sms`                     | `B/devices` with a short “Choose a device to prepare SMS commands” hint; never guess a target                                          |
| `B/settings/general`, `B/settings/groups` and editor children | Keep                                                                                                                                   |
| New `/:language/settings/users`                               | Tenant-wide users; no Branch required                                                                                                  |
| New `/:language/profile`, `/:language/sign-in`                | Current account and standalone sign-in; no Branch required                                                                             |
| New `B/notifications`                                         | Branch feed, reached from the bell                                                                                                     |

- Compatibility redirects retain IDs, valid query/fragment state and contextual return links; replace history. Handle removed-provider compatibility in its owning removal run.
- Navigation/page metadata supplies titles and breadcrumbs for dashboard tabs, account pages and notification destinations; longest-sidebar-prefix matching alone cannot cover them.
- Keep `injectPageRecord`, meaningful back links, focus restoration, mobile drawer/rail and dirty-form guards. Branch switches retain a supported section/tab and clear record-specific context; language switches retain URL context.
- Shell remains presentation-only. Workspace adapters supply account, Branch and bell data; no business queries in layout components.
- Storybook order mirrors this hierarchy: `Admin/Dashboard/...`, `Admin/Vehicles/...`, `Admin/Devices/...`, `Admin/Drivers`, `Admin/Maintenance`, `Admin/Settings/...`, `Admin/Notifications`, `Admin/Profile`, `Admin/Sign in`.

## 3. Theme and tokens

Current causes: `frame.background = surface.0`, panel background inherits white content, sidebar sits on `surface.100`, selected sidebar items return to white, KPI colour is mostly a 3px stripe. Compact density uses 13px table text and 1rem panel/stack spacing. Colour tokens already exist; they are underused.
Sources: [preset](../../apps/admin/src/app/theme/holita-preset.ts), [brands](../../apps/admin/src/app/theme/brands.ts), [tones](../../apps/admin/src/app/theme/status-tones.ts), [patterns](../../apps/admin/src/styles/_patterns.scss).

| Token / central change                                        | Light                                                                               | Dark                                                                                  | Purpose                                                                                                   |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `--p-primary-*`                                               | Keep brand 600/700/800 for cobalt; existing brand-specific steps for others         | Keep 400/300/200                                                                      | Actions and selected state; no brand replacement                                                          |
| `--p-app-canvas-background`                                   | `surface.100`                                                                       | `surface.950`                                                                         | Outer canvas                                                                                              |
| `--p-app-frame-background`                                    | `surface.50`                                                                        | `surface.950`                                                                         | Distinguish workspace from cards                                                                          |
| `--p-app-panel-background`, `--p-app-panel-header-background` | `surface.0`, `surface.50`                                                           | `surface.900`, `surface.800`                                                          | Legible tables and cards                                                                                  |
| New `--p-app-sidebar-background/color/muted-color`            | `surface.900/0/300`                                                                 | `surface.950/100/400`                                                                 | Strong navigation anchor; cover mobile drawer too                                                         |
| Existing `--p-app-sidebar-item-*`; new icon/focus tokens      | Text `surface.100`, hover `surface.800`, active `primary.700` with `surface.0` text | Text `surface.100`, hover `surface.800`, active `primary.400` with `surface.950` text | Update icon, group, footer and focus styles together; do not leave panel-muted colours on dark navigation |
| New `--p-app-panel-accent-background/color`                   | `primary.50/800`                                                                    | `primary.950/200`                                                                     | One restrained dashboard lead panel and selected contextual cards                                         |
| New `--p-app-accent-background/color/solid`                   | `teal.50/800/700`                                                                   | `teal.950/200/400`                                                                    | Secondary informational accent, not a replacement status family                                           |
| Existing `--p-app-tone-{success,info,warn,danger}-*`          | green/sky/amber/red: text 800 on 100, existing solid/button steps                   | Text 200 on existing 16% tint; solid 400                                              | Meaningful status badges, icon wells and problem panels                                                   |
| Existing `--p-app-category-c1..c8`                            | blue600, teal600, amber600, violet600, rose600, lime700, cyan700, fuchsia600        | Same families at 400                                                                  | Chart/group identity; never status semantics                                                              |
| `--p-app-stack-gap`, `panel-padding`, `row-height`            | Use existing density records                                                        | Same density contract                                                                 | Keep compact lists; use space-4/6 around dashboard sections, not arbitrary feature gaps                   |

- Keep cobalt/compact default and ember/pine/comfortable variants. The current pine code uses 700/800/900; treat code as authoritative over the older documentation table.
- Add changed pairs to existing `brandContrastChecks`/`toneContrastChecks`: 4.5:1 text, 3:1 essential icons/focus/graphics, across every brand and both schemes. Check composite tints against actual surfaces. Palette choices above are proposals, not measured passes.
- The “wow” comes from a prominent map, selective tinted KPI cards with icons, concise problems, and a few interactive charts. Keep tables calm; no rainbow rows, decorative gradients or permanent card shadows.
- **Spacing repair:** `.app-card` has no outer margin; `_reset.scss` zeros heading/paragraph margins. Device settings/queue hosts are only `display:block`, and tab panels contain unstacked siblings. Use `.app-view` on tab-content/component stacks and a stretching card-body gap pattern; reserve `.app-stack`'s start alignment for content that should not stretch. Replace local literal gaps with tokens.

## 4. Component catalog and adoption

| Existing component/pattern                                          | Decision                       | Use/story change                                                                             |
| ------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------- |
| PageHeader, EmptyState, FormField, MenuButton, RowActions           | Keep                           | Consistent identity, actions, validation and empty/error messages                            |
| KpiStrip/KpiTile                                                    | Change centrally               | Optional icon/tint and drill-down; fixed loading geometry; Foundations/KPI stories           |
| FilterBuilder, ListSortMenu, URL list helpers                       | Keep/extend                    | Date-format integration and existing supported filters only                                  |
| TablePanel + projected `p-table`                                    | Change centrally               | Common column geometry, skeletons, offset/cursor/local modes; no generic data-fetching layer |
| RouteDrawer and editor forms                                        | Keep                           | Existing guards, typed Reactive Forms, save feedback and focus behavior                      |
| `.app-view`, `.app-card`, `.app-card-grid`, facts/settings patterns | Change centrally               | Explicit tab/card stacking; retain page-specific composition                                 |
| FleetConnection/Now/LastReport/Faults/Summary                       | Change                         | Compact table mode versus detailed record mode; honest connection/freshness/count labels     |
| Sparkline, ColumnSeries, StackedBars                                | Keep                           | Appropriate small charts with native table alternatives; raw eData moved out of Overview     |
| OperationToast                                                      | Keep                           | Ephemeral mutation feedback; separate from persisted bell feed                               |
| Google MapPreview                                                   | Replace active fleet-map usage | New shared map; retain Google external-link helpers and supported technical evidence         |
| Duplicate dashboard and standalone SMS page                         | Remove destinations            | Content becomes Dashboard modules and Device SMS tab                                         |
| Inline raw command tables/expanded request cards                    | Replace presentation           | Common readable history plus details modal                                                   |

| New/revised reusable item                          | PrimeNG/base                                     | Screens                                                   | Story                                                                             |
| -------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `holita-location-map`                              | Leaflet, ordinary accessible controls            | Dashboard, Vehicle, Device                                | `Design System/Maps`: many/one/no position, stale, heading/track, tile failure    |
| `holita-chart-panel`                               | `p-chart`/Chart.js plus data table               | Dashboard overview/problems; later verified detail series | `Design System/Charts`: donut/line/bar, empty/gaps, selection, dark               |
| Compact identity/status/date/problem cell patterns | Projected `p-table`, existing tags/tooltips      | All lists and detail histories                            | Extend responsive-table/TablePanel stories; no component per simple cell          |
| Command details and lifecycle presentation         | `p-dialog`, `p-timeline`, tags, live status text | Device Commands; Vehicle device-targeted Commands         | Shared pattern story plus connected Device workflows                              |
| Shared date/time input adapter                     | Existing `p-datepicker` and zoned-time helpers   | Filters, device install, odometer, maintenance, drivers   | Date/date-time/DST states; preserve milliseconds and unchanged ambiguous instants |
| Persisted notification preview                     | Existing `p-popover`, badge and menu/button      | Topbar and feed adapter                                   | Shell/feed stories separate from operation-toast stories                          |

- **Adoption rule:** PrimeNG first. Add `holita-*` only for structure/behavior reused in at least two screens or meaningful state; use plain CSS/markup for a tab hint, status tag or card title.
- New shared components require `Design System/...` stories, BG/EN text, token-only styling, standalone/OnPush/signals and accessible controls. Domain-specific command data stays in concrete feature services.
- Use already registered Dialog, Timeline, Skeleton, Tabs, Popover, Badge and MeterGroup before adding controls. Add `p-password` for password forms and `p-chart` only with current API/preset support checked at implementation.
- Register new themed controls and dependencies in `holita-preset.ts` and both-scheme `primeng-coverage.html`; retain the ban on `p-progressbar` and deprecated `p-multiselect`.
- Keep colocated stories, `routeAt`/`StoryApp`, typed GraphQL fixtures and existing toolbar globals. Aim for at most eight representative states per screen; no play functions, new story runner or UI-rendering tests.

## 5. One table standard

- Every business list/sub-table uses TablePanel + projected `p-table`; the panel owns title, load/error/empty/refresh presentation and pagination chrome. Hidden chart data tables remain semantic HTML alternatives.
- Three modes share the same cells and geometry: **offset** (existing lazy Fleet lists), **cursor** (ERM history, honest next/previous without invented totals), **local** (finite snapshot arrays). Only bind sorting/paging actually supported by the source.
- Offset lists retain `lazyLoadOnInit=false`, `dataKey`, `trackById`, URL state, supported server sort and explicit selection names. Cursor history keeps a cursor stack so Previous does not merely jump to newest.
- Each concrete view declares stable widths and table min-width using a small explicit column definition/colgroup. Numeric cells align right, identity allows at most two lines, long values truncate, full values live in a title/detail view.
- Preserve the same header/column/skeleton geometry before live data arrives. Use bounded live-cell placeholders; retain old values during refresh. A minimum row height alone cannot prevent content growth.
- Vehicle rows summarize multiple installed devices; never repeat full per-device health/fault blocks. Problems show severity/count plus a link, not every alarm name or diagnostic string.
- Keep frozen final action column on desktop, bounded pinned identity/mobile actions below sm, secondary hiding below md, horizontal keyboard scrolling and row action menus through `TablePanel.run`.
- States: first load, refreshing with rows, empty, filtered-empty, failed first read, stale rows with retry. No raw JSON, protocol `<pre>`, expanding `<details>` or extra error rows inside business cells.

| Migration inventory                                    | Work                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Vehicles, Devices                                      | Preserve existing lazy lists; reduce columns and bound asynchronous live cells               |
| Drivers, Maintenance, Alerts/Problems, Trips           | Keep existing list/query/action architecture; apply widths, cell/date patterns and skeletons |
| Vehicle groups                                         | Replace fetch-all page accumulation with supported bounded paging; standard identity/actions |
| Vehicle Trips/Problems/Maintenance/device-event tables | Same contextual columns as parent lists; wire paging/sort only where supported               |
| Device events/frames/transport commands/snapshots      | Cursor mode, compact summary rows, technical detail modal                                    |
| Snapshot values/diffs                                  | Local mode inside TablePanel; long payload in details                                        |
| Durable requests/configuration history                 | Replace expanded native-detail lists with standard history rows and modal                    |
| SMS device selector / duplicate dashboard table        | Remove selector; retain only useful dashboard preview rows with “View all”                   |

## 6. Page blueprints

### Dashboard

- Header: fleet name, reporting freshness, refresh, date range/time-zone context. Four clickable KPIs: Live trucks, Connected devices, Problems requiring attention, Trips/distance for the selected period.
- Overview: map dominates; adjacent ranked problems; below, movement/connection distribution, daily distance and maintenance/driver summaries. Each module links to a filtered real page.
- Map/list selection and chart slices change visible filters. Counts must come from complete scoped aggregates, not the current first-100 arrays or the current table page.
- Problems combines actionable Fleet alerts, recorded device diagnostic/alarm evidence, reporting gaps and failed/uncertain commands. Show source, severity, time and state separately; deduplicate raw/imported copies by source identity. Only actual alerts receive acknowledge/resolve actions.
- Trips reuses the current trip list/drawer. Keep current data-clock versus business-date labeling until telemetry ingestion is confirmed operational.

| Tab      | One-sentence hint                                                              |
| -------- | ------------------------------------------------------------------------------ |
| Overview | See where the fleet is, which vehicles are reporting and what needs attention. |
| Problems | Review open alerts, recent fault reports and operations that need follow-up.   |
| Trips    | Explore recorded journeys, routes and driving events for the selected period.  |

### Vehicles

- List defaults: Vehicle, Activity/connection, Latest location/report, Problems, Driver, Actions; keep model/group and other registry detail reachable without expanding all rows.
- Detail header: plate, vehicle identity, activity/Live state, last report and a visible problems summary. Overview shows map, heading/speed, recent recorded track, selected facts and existing distance trend.
- Raw eData “last 24 h” dots are hexadecimal magnitudes for IDs 1/3/539 with unverified scaling. Move to Technical details as timestamped observations/counts; no physical-unit chart until verification in the ERM roadmap.

| Tab         | One-sentence hint                                               |
| ----------- | --------------------------------------------------------------- |
| Overview    | See the latest position, movement and vehicle condition.        |
| Problems    | Review open alerts and recorded device faults for this vehicle. |
| Trips       | Review this vehicle’s journeys, routes and driving events.      |
| Maintenance | See planned work, due dates and completed service.              |
| Commands    | Choose an installed device and follow its supported commands.   |

Keep raw observations in a secondary Technical details disclosure. Vehicle SMS is a contextual link to the explicitly selected device’s SMS tab, avoiding a second generator.

### Devices

- List: bounded Device identity, Assigned vehicle, Connection, Last report, Problems, Actions. Header summaries explicitly state whole Branch or current page; target whole-Branch authoritative summaries.
- Detail header: human vehicle label + IMEI, connection/freshness, prominent problems. Overview: concise registry card, current reporting/health card, map and useful actions; collapse protocol/audit identifiers.
- Primary tabs below; Technical details holds Events and Frames with filters and row modals. Keep Parameters as a secondary supported workflow. No duplicate queue and transport-history presentation at the top level.

| Tab/area                   | One-sentence hint                                                            |
| -------------------------- | ---------------------------------------------------------------------------- |
| Overview                   | See this device’s connection, assigned vehicle and latest position.          |
| Problems                   | Review current warnings and historical fault evidence for this device.       |
| Commands                   | Send supported commands and follow their outcomes.                           |
| SMS commands               | Prepare a message to send from your phone to this device.                    |
| Parameters                 | Read supported device settings and compare saved snapshots.                  |
| Technical details — Events | Inspect the reports received from this device for troubleshooting.           |
| Technical details — Frames | Inspect the original protocol messages associated with device communication. |

- SMS: current device is fixed; show SIM destination, purpose, “when to use”, expected reply, generated text and byte count, then Copy/Open SMS. Keep vendor limits and existing supported operations. Do not label either action Sent or Delivered.
- Device Trips is a clearly labelled “Trips of assigned vehicle” link when assigned; no implied historical device-to-vehicle attribution.

### Other pages

| Page/tab                            | Blueprint and one-sentence guidance                                                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drivers                             | Existing standard list/drawer and scorecard; “Manage drivers, document expiry dates and driving summaries.”                                                                        |
| Maintenance                         | Existing task list and drawers, clear due-date/remaining-distance cells; “Plan service, review due work and record completion.”                                                    |
| Settings — General                  | Fleet identity/preferences, standard date format preview, searchable IANA time zone and notification retention; “Set the shared display and operating preferences for this fleet.” |
| Settings — Vehicle groups           | Standard paged list and existing drawer; “Organize vehicles into named groups for filtering and summaries.”                                                                        |
| Settings — Users                    | Tenant scope stated prominently; “Manage the people who can sign in to this organization.”                                                                                         |
| Notifications — All / Unread filter | Common table, source/category/time, target link, mark read/all read; “Review recent notifications for this fleet and open the related record.”                                     |
| Profile                             | Name/email form plus password-change section; “Update your identity and change your password.”                                                                                     |
| Sign in                             | Email/password, language/theme, clear errors, then Branch selection if needed; “Sign in to your organization and choose a fleet.”                                                  |

## 7. Commands: contract, modal and waiting

Problem: current queue cards expose IDs/raw frames and lose visible progress when enqueue returns. Existing durable requests already persist intent/action/actor and lifecycle; a new queue is unnecessary.
Extend [telemetry SDL](../../apps/erm-server/src/modules/telemetry/telemetry.graphql) and existing services with typed display parameters, stable reason/outcome codes and typed configuration steps where missing. Preserve raw evidence and existing safeguards.

- Six existing read actions stay the supported scope. Model durable request, transport command and configuration verification as related records, not one misleading success enum.
- Common history columns: Purpose, Target, Requested, Status, Outcome, Actions. Modal: readable purpose/parameters and target; lifecycle with timestamps; result/next action; collapsed Technical details with references, raw sent/received frames and original codes.
- Resolve UI wording in BG/EN catalogs. Keep operator-entered intent as source text. Unknown action/reason codes get an honest generic label and original code in details.
- Example `$SLU862129080254620,02,8063,900000081,01*01`: unit-origin `SLU`, IMEI, confirmation `02`, reply reference `8063`, original command reference `900000081`, acknowledged result `01`, checksum `01`. It cannot identify the original action without the stored command link. See [C2](../discocan/erm-resources/starlink-online-protocol/authenticated/pages/C2.md), [P180](../discocan/erm-resources/starlink-online-protocol/authenticated/pages/P180.md), [parser](../../apps/erm-server/src/starlink/protocol.ts).

| Backend fact                                           | Human presentation / allowed interaction                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `QUEUED`                                               | Waiting for an eligible device connection; elapsed time and expiry; Cancel available                                |
| `SUBMITTING`, transport `SENT`                         | Sending / waiting for reply according to available transport timestamp; no invented percentage or premature success |
| `ANSWERED` plus result                                 | Acknowledged, or a decoded rejection/result; acknowledgement is not independent verification                        |
| `FAILED`                                               | Failed with translated reason and relevant follow-up                                                                |
| `EXPIRED`                                              | Expired before sending; user can deliberately create a new request                                                  |
| `CANCELLED`                                            | Cancelled before sending                                                                                            |
| `UNCERTAIN` / ambiguous transport timeout              | Outcome unknown; inspect/read back where supported; never automatically resend                                      |
| Configuration `VERIFIED`, `MISMATCH`, `RESTORED`, etc. | Present the existing readback/restoration outcome separately from transport acknowledgement                         |

- Keep the submitted request visible immediately and reopenable after navigation/reload. Poll its durable status using the existing 5-second visible-document pattern while pending; refresh on return. Existing dispatch runs every 10 seconds and device reply timeout is 30 seconds; show observed state, not a guaranteed countdown to completion.
- Use live status text, an indeterminate indicator and `p-timeline`; no `p-progressbar`. Closing a modal does not cancel the command. Queue cancellation remains limited to QUEUED.
- P0 uses existing synthetic demo audit identity honestly; P2 supplies verified user identity without rewriting historical audit.

## 8. Dates and time zones

- **Wire output:** every typed instant is `DateTime`, serialized exactly as `YYYY-MM-DDTHH:mm:ss.sssZ`; date-only values retain `Date`/`YYYY-MM-DD`. Durations, intervals and protocol-native raw values are not instants.
- Reuse Fleet’s scalar contract; implement equivalent ERM scalar registration and update resolver mappings alongside SDL/codegen. Core uses the same contract for newly exposed User/session dates. Keep valid offset-bearing inputs normalized to UTC.
- Cover ERM command/request/configuration/snapshot/event/reading/health/gap/network/frame timestamps, including typed step times. Preserve internal HTTP UTC event serialization and generated client strings/server Date mappings.
- Extend `FleetSettings` with `dateFormat` (`YYYY-MM-DD` default, `DD-MM-YYYY`, `DD.MM.YYYY`) and `notificationRetentionDays` (default 7). Keep existing `timeZone`, units and business-clock behavior; reads still return defaults without inserting.
- Expand the four-zone allowlist to validated IANA identifiers; UI offers a searchable supported list with current time preview. Changing zone changes business-day interpretation, not stored instants.
- Extend existing [format functions/pipes](../../apps/admin/src/app/ui/format/format.ts) and `FleetDisplayPreferences`; one formatter owns instants, calendar dates, table cells, tooltip UTC strings, chart axes and notifications. Language controls words, not the selected numeric date order. Use 24-hour time.
- Replace hard-coded picker formats through one mapping; preserve [zoned-time](../../apps/admin/src/app/ui/format/zoned-time.ts) DST gap/overlap handling, unchanged milliseconds and half-open day filters. Native `datetime-local` cannot guarantee chosen presentation: use the shared editor adapter where uniform input display is required.
- Before Branch selection, account/session instants use an explicit UTC + ISO fallback; there are no per-user date preferences. Relative “ago” text names its correct clock and offers an exact time.

## 9. Map and truthful Live data

Problem: current Google preview shows one selected device; dashboard fetches at most 100 vehicles/devices. Existing fleet samples support tracks, but no all-fleet live map/total contract exists.

- Add Leaflet and its required typings/assets through the single dependency owner. Runtime config adds `mapTileUrl` and `mapAttribution`; document the public config contract and choose a demo/client-capable tile provider. OSM-compatible does not imply unlimited public tile service.
- One `holita-location-map` renders fleet markers or one vehicle/device, measured heading and recorded recent track. Keep Google external links. No geocoding, route prediction or routing engine in this scope.
- Add a concrete scoped map query returning every truck’s canonical latest position/status, explicit no-position records/count and coverage/as-of; use bounded paging when needed and never silently stop at 100.
- Define **Connected** = current ERM socket, **Reporting** = expected-frame freshness, **Live** = connected + reporting; label stored position age separately because a fresh non-position frame does not make old GPS fresh. Stale/unknown positions remain distinguishable.
- Fleet `ONLINE` uses Branch data-clock freshness (default 48h), so do not reuse it as Live. Moving/parked remain activity facts. Label metrics with their source/clock.
- Use existing `fleetVehicleSamples` for recorded track, preserving its newest-2,000 limit and `truncated` indicator; break unavailable intervals rather than implying a complete road route. Default recent track: last 24 hours with coverage/time range visible.
- Map has fit fleet, selected marker/detail link, status legend, last update and matching accessible vehicle list. Tile failure retains data/list/actions; panning/selection survives a data refresh.
- Telemetry ingestion exists behind `FLEET_ERM_TELEMETRY_ENABLED` (default false). Verify it in the later deployment task; this plan does not enable ingestion or change device routing.

## 10. Charts

- Use `p-chart`/Chart.js for live-state donut, daily distance line/bar, and problems by source/severity when those aggregates exist. Do not invent historical online counts from a current snapshot.
- Preserve current SVG column/stacked/sparkline components for small appropriate summaries. Data clock and selected range stay visible; null means a gap, zero means measured zero.
- Shared chart presentation supplies title, legend, units/time zone, tooltip, empty/loading states, accessible summary/data table and keyboard-accessible equivalents of drill-down actions.
- Resolve colours from theme tokens so charts follow brand/scheme changes. Categories use c1–c8; status charts use status tones and text. Keep animation restrained/reduced-motion aware.
- No verified raw eData physical trends until calibration is established; observation counts are permitted when explicitly labelled as counts.

## 11. Auth, profile and users

Problem: Core has only Tenant/Branch, and demo tokens prove only a Tenant. The current design cannot identify a person, verify a password or invalidate a deactivated person’s session. Smallest extension: concrete Core Users/Auth modules with persisted sessions, preserving Router and workspace architecture.

- One User belongs to one Tenant: normalized globally unique email (for email-only login), name, password hash, active flag and timestamps. Use a standard salted password-hash implementation; no roles, memberships, signup, invitations or forgotten-password flow.
- Core verifies credentials and owns revocable sessions. Recommended default: opaque bearer session tokens stored hashed in Core, with a concrete authenticated internal verification endpoint returning verified `tenantId/userId`; Core resolves locally and Fleet/ERM verify through that contract. Do not trust caller identity headers.
- Keep Router propagation of `authorization`/`x-branch-id`/`x-request-id`. Branch remains requested context checked against verified Tenant. Do not import Core persistence into another application.
- User management is Tenant-wide and available equally to authenticated Tenant users: create with an initial password, edit name/email, deactivate. State that scope visibly; do not add implicit owner/admin roles.
- Profile changes own name/email; password change requires current password. Sign-out revokes the session; password change/deactivation invalidate affected sessions. Provision the first user through a controlled setup procedure, without public registration or committed credentials.
- Replace admin demo-token parsing with the real session lifecycle; preserve captured clients, scope retirement and post-login Branch selection. Demo login remains explicit development-only, never a client-release fallback.
- ERM audit takes verified `userId`; historical `demo-tenant:*` audit remains historical. Extend existing isolation/cross-service cases rather than creating a broad auth test suite.

## 12. Notifications

Problem: shell bell is explicitly Demo and settings toggles are unsaved. Source events exist, but a persisted feed/read state does not. Smallest addition: Fleet-owned Branch feed plus per-user receipts, using existing Nest scheduling.

- Store `(tenantId, branchId, id)`, source kind/key, category/severity, occurred/created timestamps, structured wording parameters and entity target. Separate read receipts use verified `userId`; no cross-database foreign key to Core.
- Start with Fleet alert transitions, explicitly labelled recorded device faults/alarms, and terminal durable command outcomes. Do not infer unread items from summary counts or claim unresolved ECU faults from historical observations.
- Fleet workflows project their own events. ERM provides an authenticated typed incremental source contract for retained alarms/command outcomes; Fleet persists cursor/deduplication by stable source identity. Use the same normalized source keys for imported/raw views. Browser presence is not required.
- Bell: latest items, real unread count, Mark all read, See all. Page: standard table with All/Unread/category filtering and record links. Shell receives data/events from a workspace adapter.
- Daily cleanup applies Branch `notificationRetentionDays` to feed creation time, default 7 days; remove receipts with expired feed entries. Preserve telemetry, source events and command audit. Initial feed population starts within the retention window, not all historical data.
- This is in-app delivery only. Remove unsaved email/daily-summary toggles until such delivery is separately requested. Persist structured facts, not pretranslated sentences.

## 13. Work packages and execution

All packages await owner approval. Owned paths are repo-relative; braces name explicit sibling paths. A package may not edit another package’s files in parallel. Feature-local stories/catalogs belong to their package; shared fixture/router/registration edits belong to integration. No product writes occur in this analysis.

| ID / priority / model          | Goal and exclusive owned paths                                                                                                                                                                                                                                                                    | Dependencies                                               | Behavioral acceptance; stories; permitted tests                                                                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F0 · P0 · `gpt-6.1-sol`        | Foundation: `apps/admin/src/app/theme/`, `apps/admin/src/styles/`, `apps/admin/src/app/ui/{table-panel,kpi,fleet-live,i18n}/`, `apps/admin/src/app/ui/{responsive-table,css-patterns}.stories.ts`                                                                                                 | Approval                                                   | Colour hierarchy, spacing and stable table modes work in both schemes/densities; every cell remains bounded across delayed live data. Foundations/Table/KPI stories. No new UI tests.                                                                                                 |
| F1 · P0/P1 · `gpt-6.1-sol`     | Shared map/charts: new `apps/admin/src/app/ui/{location-map,chart-panel}/`, `apps/admin/src/app/ui/map-preview/location-map.ts`, `apps/admin/src/app/core/config/`, `apps/admin/package.json`, `package-lock.json`                                                                                | F0                                                         | Map/list fallback, many/one/empty/stale/track states; chart alternative and drill-down; public tile config. Design System stories. No UI tests. Serialize dependency/preset registration with integration.                                                                            |
| C0 · P0/P1 · `gpt-6-astra`     | Typed ERM dates/commands: `apps/erm-server/src/{graphql,modules/telemetry}/`, `apps/erm-server/src/modules/devices/device-session.ts`                                                                                                                                                             | F0                                                         | Existing queue semantics retained; typed parameters/reason codes/timestamps, raw evidence accessible, old actions unchanged. Extend existing ERM cross-service/device-write cases only.                                                                                               |
| S0 · P1 · `gpt-6.1-sol`        | Branch preferences/date UI: `apps/fleet/src/modules/settings/`, `apps/fleet/prisma/schema.prisma` and settings migration; `apps/admin/src/app/ui/{format,forms,filter-builder}/`, `apps/admin/src/app/features/fleet/settings/` excluding `groups-view.*`                                         | F0                                                         | All three formats/valid IANA zones persist per Branch; date-only/DST behavior retained; retention setting available. Settings/Date stories; extend settings isolation and existing observed date-defect cases only.                                                                   |
| B0 · P1 · `gpt-6-astra`        | Fleet dashboard data: `apps/fleet/src/modules/{overview,telemetry,events,devices}/`, `apps/fleet/src/integrations/erm/`; after C0, `apps/erm-server/src/modules/telemetry/telemetry.{graphql,service.ts,repository.ts,resolver.ts}` for batching                                                  | C0; S0 before schema integration                           | Exact scoped counts/map coverage beyond 100; truthful freshness, diagnostic source identity, recorded track truncation. Extend current overview/list/import cases for SQL/isolation/contracts; no speculative suites.                                                                 |
| N0 · P0 · `gpt-6.1-sol`        | Navigation: `apps/admin/src/app/{layout,workspace}/`, `apps/admin/src/app/features/branches/`, `apps/admin/src/app/app.routes.ts`, `apps/admin/src/app/features/fleet/fleet.routes.ts`, `apps/admin/src/app/features/control-center/control-center.routes.ts`, `apps/admin/.storybook/preview.ts` | F0                                                         | Sidebar, page context, redirects and Branch/language transitions work using retained screens; later account/feed destinations have metadata contracts. Shell/navigation stories; existing routing smoke at integrated handover.                                                       |
| V0 · P0/P1 · `gpt-6.1-sol`     | Vehicles: `apps/admin/src/app/features/fleet/vehicles/`                                                                                                                                                                                                                                           | F0, N0 for P0; F1, S0, B0 for P1; Commands wiring after D0 | Stable list before/after live load; map/track and visible Problems; raw observations moved; tab hints and contextual sub-tables. Delayed-live/default/empty/error/detail stories; extend only an existing case for the reported shift if a meaningful non-rendering test is possible. |
| D0 · P0/P1 · `gpt-6.1-sol`     | Devices/commands/SMS: `apps/admin/src/app/features/fleet/devices/`, `apps/admin/src/app/features/control-center/` excluding `dashboard-page.*`/route files; new `apps/admin/src/app/features/fleet/commands/`                                                                                     | F0, C0, N0 for P0; F1, S0 for map/date completion          | Compact list/detail, unified readable queue/modal, honest persistent waiting, current-device SMS, retained Parameters/technical views. Pending/unknown/failed/ACK/SMS stories; no new wiring tests.                                                                                   |
| L0 · P0/P1 · `gpt-6.1-sol`     | Lists: `apps/admin/src/app/features/fleet/{drivers,maintenance,alerts,trips,vehicle-groups}/`, `apps/admin/src/app/features/fleet/settings/groups-view.*`                                                                                                                                         | F0, N0 for P0; S0 for date completion                      | All lists/drawers share table/date conventions; groups bounded; alert actions and trip navigation unchanged. Migrate colocated stories; no new UI tests.                                                                                                                              |
| H0 · P1 · `gpt-6.1-sol`        | Dashboard: `apps/admin/src/app/features/fleet/overview/`, `apps/admin/src/app/features/control-center/dashboard-page.*` only                                                                                                                                                                      | F1, B0, S0, N0, L0                                         | Unified interactive Overview/Problems/Trips; truthful totals/coverage, source-aware problems and filtered drill-downs. Dashboard stories; no UI tests.                                                                                                                                |
| A0 · P2 · `gpt-6-astra`        | User/session backend: `apps/core/`, `apps/fleet/src/auth/`, `apps/erm-server/src/auth/`, `apps/fleet/src/graphql/request-context.ts`, `apps/erm-server/src/graphql/request-context.ts`, `apps/erm-server/src/modules/telemetry/operator-audit.ts`, `apps/gateway/router/router.yaml` if needed    | C0, B0, S0                                                 | Email login, Tenant isolation, revocation, equal-access users and verified audit actor. Extend Core/isolation/federation contract cases. No role system.                                                                                                                              |
| A1 · P2 · `gpt-6.1-sol`        | Account UI: `apps/admin/src/app/core/auth/`, `apps/admin/src/app/features/{auth,profile,users}/`                                                                                                                                                                                                  | A0, N0, S0                                                 | Login→Branch→Dashboard; profile/password change; Tenant Users CRUD/deactivation with correct errors. Account stories; existing login smoke at handover.                                                                                                                               |
| NF0 · P2 · `gpt-6-astra`       | Feed backend: new `apps/fleet/src/modules/notifications/`, `apps/fleet/prisma/schema.prisma` and feed migration; `apps/fleet/src/modules/{events,erm-telemetry}/` source hooks; new `apps/erm-server/src/modules/notification-export/`                                                            | A0, B0, C0, S0                                             | Persistent scoped feed independent of browser, source deduplication, per-user read state, seven-day default cleanup without source deletion. Extend isolation/raw SQL/cross-service cases.                                                                                            |
| NF1 · P2 · `gpt-6.1-sol`       | Feed UI: new `apps/admin/src/app/features/notifications/`                                                                                                                                                                                                                                         | NF0, A1                                                    | Real bell/page data adapter, unread and See all, source links and read actions. Feed stories; no new UI tests.                                                                                                                                                                        |
| I0 · each wave · `gpt-6.1-sol` | Serial integration: root registration/config/codegen inputs, app module registrations, shared operation/fixture aggregation, shell hookups, `.env.example` and authoritative workflow docs when changed                                                                                           | Respective wave                                            | Resolve only integration seams, generate/check changed contracts and run required handover checks; one owner for lockfile/root/shared-file edits. Preserve unrelated changes.                                                                                                         |

- **Order:** F0 first. Foundation/data group **F1 ∥ C0 ∥ S0 ∥ N0** can then run with the stated path exclusions; C0/N0 have P0 scheduling priority. Integrate each required foundation contract before its consuming page stage. B0 follows C0 and may overlap remaining foundation work without sharing files.
- **P0 page parallel group:** table/navigation/command portions of **V0 ∥ D0 ∥ L0** follow their P0 dependencies; map/date contracts need not delay this cut. Preserve existing formatter compatibility until S0 integration. The same owners finish map/date stages after F1/S0/B0; H0 follows L0/data/map integration. V0 wires Commands only after D0 exports its presentation.
- **Account/feed group:** A0 follows backend changes; then A1 ∥ NF0. NF1 follows both. Run I0 between groups and for final connections; it never edits a file concurrently with its owner.
- N0 initially routes to retained screen implementations. I0 activates each new page/account/feed link only when its package is ready; no missing-component routes or placeholder success flows. Final routing smoke follows these integrations.
- The root lockfile, Prisma schema, shared SDL, theme registry, routes, workspace, root catalogs and shared Storybook fixtures always have one active owner. “Parallel” means disjoint edits, not simultaneous codegen or Nx.
- Implementation handover follows [testing](../testing.md): one `npm run check` per integrated handover, then fix reported failures; relevant single browser smoke for login/routing/main-journey changes; `typecheck:tools` only when tools change. SDL/operations require codegen/schema check. One Nx/check process at a time.
- Keep the 60-case ceiling; extend existing cases for observed defects, isolation, SQL, irreversible writes or cross-service contracts only. Stories/review cover presentation; no new rendering/translation/mock tests. Visual Storybook review is an explicit part of this proposed design acceptance, performed only once implementation is authorized.

## 14. Open questions (defaults allow planning to continue)

| Question                                  | Recommended default                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Which tile provider covers client demos?  | Configurable managed OSM-compatible raster provider with valid attribution; provider/account choice is a deployment prerequisite.    |
| What should “Live” mean?                  | Connected + reporting within the existing expected-frame threshold; show GPS age separately and keep data-clock status distinct.     |
| Which date format and zone?               | `YYYY-MM-DD`, existing Branch zone (new Branch default Europe/Sofia), 24-hour time.                                                  |
| Can all users manage users?               | Yes, equal Tenant access as requested; no roles. State this explicitly before client release.                                        |
| How is email-only login scoped?           | One Tenant per user, globally unique normalized email; no Tenant selector before login.                                              |
| Which notifications and retention?        | Alert transitions, recorded device fault/alarm evidence and terminal command outcomes; seven days; per-user read state.              |
| How much track/history appears initially? | Last 24 hours with timestamps/coverage and existing truncation disclosure; no predicted destination.                                 |
| Where should advanced/raw data live?      | Secondary Technical details and command modal; keep supported Parameters workflows, never raw eData magnitudes on the main Overview. |
