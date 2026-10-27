# Karma MVP and product experience backlog

The [functional research report](../discocan/erm-resources/karma-api-v2/web-functionality-research.md)
owns the 36-function classic inventory, NC2 console findings, internal web-method
references, API recipes, calculation rules, proposed holita presentation and bounded
live evidence. Keep further source findings there instead
of copying the catalog into this backlog. All tasks below are pending proposals
for a separate implementation session. No application implementation, Google Cloud
configuration or vendor write is authorized by this planning delivery.

## Product outcome and boundaries

Deliver one coherent read-only journey in the existing admin:
**truck → completed local day → Summary/Distance → trip detail → map or Street View**.
Reuse the existing Karma inventory, car header, generated Gateway operations,
history drawers, chart patterns and map preview; do not create a standalone app
or a second version of an existing business screen.

The first release includes:

- A selected-truck Summary/Distance report with trip count, total/day/night
  distance and maximum trip speed, with visible period and dataset coverage.
- The existing trip list/detail connected to that selection, retaining original
  source identities and values.
- A clearly timestamped last-reported truck position, trip endpoints and
  contextual Google Maps/Street View actions in the surfaces listed below.
- A consistent, more expressive presentation with accessible alternatives,
  BG/EN, light/dark and connected Storybook states as part of each task.
- A focused Karma navigation: daily truck work stays prominent; account
  references and occasional technical screens remain available without competing
  with the main journey or filling the truck's primary tab bar.

The first report period is one completed provider-local day, default Yesterday,
after its timezone/boundary proof in MVP-00. Arbitrary long periods, live-day
final totals, fleet-wide historical aggregation and automatic polling are not
first-release promises. A later extension must use measured retrieval limits,
not an arbitrary promise that every date range is supported.

Excluded from this MVP: new device commands, actuator/odometer writes, vendor
entity mutations, exact Parking/Idle/Stoppings formulas, driver rankings,
camera media, configured-module dashboards and synchronization of manual
business records. Actual driven-path rendering is a gated follow-up, not a
Google suggested route relabeled as a GPS recording.

## Working agreement for implementation sessions

Implementation prompts for this backlog and its follow-ups should describe the
expected behavior, user journey, code quality, acceptance and stopping point.
Assume the session already runs in this project; do not lead with a working
directory or repeat setup instructions that the repository already owns.

- Deliver clean, explicit code that fits the existing application boundaries,
  concrete feature services, generated contracts and scoped request lifecycles.
  Reuse demonstrated patterns; do not add speculative abstractions, a parallel
  design system or unrelated refactoring in the name of cleanup.
- Treat UX/UI and information architecture as part of implementation, not final
  decoration. Decide what is primary, contextual or advanced before adding more
  cards, controls or tabs to the truck page.
- Keep components responsible for a coherent screen or interaction. Do not grow
  one truck component into the owner of every report, technical tool, fetch and
  state; equally, do not fragment simple markup into unnecessary wrappers.
- Each prompt covers one bounded delivery below, identifies its dependencies
  and acceptance criteria, and ends there. Do not automatically implement the
  next delivery or MAP-/INS- work. Report any blocker instead of silently
  substituting data, broadening scope or claiming unfinished work is complete.

## Navigation and progressive disclosure

The following is a proposed MVP navigation change, not implemented behavior.
The current Karma sidebar exposes Trucks, Users, Roles, Projects, Time zones
and API information separately; the truck header exposes seven peer sections.
Reorganize these existing destinations without removing their functionality:

| Level                           | Proposed presentation                                                             | Behavior                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main Karma navigation           | Trucks and one Karma administration entry                                         | Prioritize finding a truck. Account administration is outside the selected-truck context, not another truck tab.                                  |
| Karma administration            | Route-backed tabs for Users, Roles, Projects, Time zones and API information      | Reuse the existing read views. These are Karma account resources, not holita Tenant/Branch settings or holita user management.                    |
| Selected truck: daily work      | Overview, Trips and Location                                                      | Overview owns the combined Summary/Distance report, not another duplicate profile/report screen. Keep the primary navigation short.               |
| Selected truck: occasional work | One discoverable More menu for Events, eData, Driving profile and Device settings | Open the existing dedicated destination only when chosen. Do not load every technical view in the overview or turn the menu into a new dashboard. |
| Individual trip/event/message   | Existing contextual drawer and shared map actions                                 | Reveal record-specific facts and source fields on demand rather than adding every detail to the default truck overview.                           |

The precise BG/EN labels and responsive presentation are settled in MVP-01.
Keep the current Fleet navigation outside this bounded Karma reorganization;
do not merge local Fleet/demo records with shared Karma account data.

**Acceptance for the navigation foundation:**

- Main navigation represents user destinations, not every upstream endpoint.
  Keep account tools discoverable in one place and technical tools behind one
  clearly named entry, with the active destination still identifiable.
- Preserve existing deep links or provide explicit redirects if a route must
  change. Refresh, browser Back/Forward and language changes retain the selected
  destination; moving a link must not break saved URLs.
- Keep truck identity, list filters/return context and applicable report day
  across contextual navigation. The last-reported position remains separately
  labeled; it must not inherit the historical day's meaning.
- Render and request the active destination only. Visiting administration must
  not fetch all five tabs, and opening a truck must not fetch every advanced view.
- Preserve existing authorization, Tenant/Branch rules, Apollo lifecycle and
  device-editor leave guards. Moving Device settings changes discoverability,
  not its write permissions or operation behavior; do not submit device writes
  to accept the navigation change.
- Tabs/menu/navigation remain usable on mobile, with keyboard and visible
  focus. Avoid a second long row of tabs or an icon-only mystery menu.
- The truck list remains useful without opening the complete truck workspace:
  existing filters, direct Trips navigation and selected-row map/Street View
  actions are entry points. This does not authorize a fleet-wide report or map.

## Consistency rule for every task

**A task is not complete with data wiring alone or an isolated attractive page.**
Every implementation task must identify its shared presentation pattern, update
its real component stories, and demonstrate the same interaction in its affected
surfaces. MVP-07 checks the combined result; it is not a deferred redesign phase.

- Reuse PageHeader, KpiStrip, TablePanel, FormField, record drawers and chart
  patterns from the [admin design system](../admin-design-system.md). Improve a
  repeated pattern once rather than copying styles or creating a second header,
  date selector, status convention or map toolbar.
- Own visual decisions centrally in `apps/admin/src/app/theme/` and
  `apps/admin/src/styles/`; feature styles consume the established tokens and
  breakpoint helpers. No per-screen brand, literal color palette or new UI kit.
- Use identical meanings, icons and BG/EN action names for current position,
  trip endpoints, recorded samples, suggested directions and Street View.
- Keep selected truck/day/timezone and record context through report → drawer →
  map and Back. Live position must never silently replace historical selection.
- Include loading, empty, partial, stale and error states where applicable;
  missing/unknown is not zero, offline, stationary or a device fault.
- Include accessible labels, keyboard navigation, focus return, non-color status
  cues, readable data alternatives, reduced-motion behavior and responsive layout.
- Reuse generated contracts and current scoped Apollo lifecycles. Shared Karma
  reads remain independent of active Branch; local Fleet business data stays scoped.

### Visual direction

Aim for a polished operational workspace, not a reproduction of Karma's dry
report forms or a decorative dashboard full of gauges:

- A strong truck identity header with source fleet and clear contextual actions;
  one compact period/timezone/coverage bar below it.
- Three primary KPI cards: total distance, trip count and maximum speed. A
  labeled day/night composition bar adds context without inventing another score.
- On desktop, a generous contextual map panel beside concise report facts,
  followed by the trip table. On narrow screens, stack sections and keep map
  loading deliberate; the table/coordinate facts remain useful without the map.
- Clear typography hierarchy, tabular numerals, restrained category accents,
  purposeful whitespace, consistent card headers and subtle surface depth using
  current tokens. Change brand/density centrally only if the reference screens
  demonstrate a concrete improvement across the shared patterns.
- Use trends only when comparable complete datasets exist. Do not fill empty
  cards with decorative sparklines, assumed health scores or random sample values.
- Put a short human-readable explanation beside a metric and source details in
  the existing drawer; avoid JSON-first presentation for ordinary users.
- Apply progressive disclosure: the overview answers daily operational
  questions; administrative references, raw telemetry and device configuration
  do not compete with its report, trips or location. Do not replace a long
  technical form with an equally crowded wall of cards.

Target WCAG 2.2 AA for our controls: normal text contrast at least 4.5:1,
non-text control/state contrast at least 3:1, visible unobscured focus, and
24×24 CSS-pixel minimum targets subject to the standard's exceptions. Prefer
44×44 targets for map/Street View actions where practical; that is our comfort
goal, not a claim that AA requires 44 pixels. Do not use color alone for status
or selection. See [WCAG 2.2](https://www.w3.org/TR/WCAG22/),
[target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
and [use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

## Google Maps and trip presentation

### Data levels and truthful labels

The [map/source reassessment](../discocan/erm-resources/karma-api-v2/web-functionality-research.md#map-and-source-data-reassessment)
confirms trip endpoints and timestamped event coordinates, but not a complete
sampled path for a selected trip. Apply these distinct modes:

| Mode                   | Source                                                                      | Presentation and condition                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Last reported position | `karmaLocation` / public `/location`                                        | Truck marker/point, source time, age, available speed and odometer. Say Last reported, not guaranteed live/current physical position.                                            |
| Trip endpoints         | Existing `KarmaTrip` start/stop coordinates and source times                | Start/End selector, facts and point actions. If one endpoint is missing, show only the available one; never fabricate a second point.                                            |
| Recorded samples       | Identified `/events` or `/edata` coordinates within a proved trip selection | Later point/segment view with sample times and explicit gaps. A line between samples is visualization, not evidence of continuous travel.                                        |
| Suggested directions   | Google route between chosen endpoints                                       | Separate explicit action and label Suggested Google route, not Trip recording or Distance actually driven.                                                                       |
| Street View            | Google panorama near a selected coordinate                                  | Explore surroundings. Imagery is not live vehicle video, may be dated and may not exist at the exact telemetry coordinate. Browsing the panorama never changes the source point. |

### First-release placements

| Surface                            | Consistent map entry point                         | Scope                                                                                                     |
| ---------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Truck inventory                    | Row action: Location / Street View                 | Fetch only the selected truck's existing location query; no iframe per row or uncontrolled fleet fan-out. |
| Truck profile and Summary/Distance | Shared contextual map panel                        | Last reported position is explicitly separate from the selected historical report day.                    |
| Location page                      | Same panel/actions, not another map implementation | Coordinate/time facts and external fallback remain visible.                                               |
| Trip list and detail drawer        | Start / End map and Street View actions            | Preserve trip identity/time; suggested directions is optional and separately labeled.                     |
| Event detail                       | Location / Street View for that event              | Use that event's validated coordinate/time, never the truck's newer position as a substitute.             |
| eData detail                       | Location / Street View for that message            | Use message coordinates if present; telemetry values remain readable without a map.                       |

Reuse and extend the current
[MapPreview](../../apps/admin/src/app/features/karma-client/location/map-preview/map-preview.ts)
and [coordinate/link helpers](../../apps/admin/src/app/features/karma-client/location/location-map.ts)
first. Keep map context selection in the concrete feature; do not introduce a
generic map framework or a second app-wide data facade.

For the first release, Google Maps URLs provide external location, directions
and panorama actions without a Google API key. Optional Embed previews use the
existing key configuration and can add a `streetview` mode. No embedded map is
loaded until the user requests it; the fallback links work when no key is
configured. See [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)
and [Embed modes](https://developers.google.com/maps/documentation/embed/embedding-map).

Coordinates are sent to Google on the explicit load/open action. Explain this
in the shared panel, keep Karma credentials/session IDs out of URLs, and do not
add silent reverse geocoding, per-row imagery or background preloads. External
links open safely and disclose a new tab. Never open, read or print the existing
ignored `apps/admin/public/config.local.json`; use the tracked config schema,
public setup instructions and synthetic/no-key fixtures. No local credential or
map-setting change is part of these implementation tickets.

The application must not claim panorama availability before it is established:
an Embed iframe is cross-origin and its error content must not be inspected.
Offer Return to location and external-map fallback. A later reliable availability
indicator can use a separately configured Street View service/metadata lookup;
[metadata](https://developers.google.com/maps/documentation/streetview/metadata)
provides availability status and imagery date when available.

Multi-marker fleet maps, selected-point synchronization and arbitrary polylines
need a richer integration than the current Embed preview. MAP-02 must explain
that concrete limitation and choose the smallest sufficient Maps JavaScript
integration. Do not widen the existing Embed-only browser key implicitly:
review API/referrer restrictions, approved APIs, attribution, quotas and billing.
Dynamic maps/panoramas have separate usage rules; see
[Maps JavaScript billing](https://developers.google.com/maps/documentation/javascript/usage-and-billing)
and [Google security guidance](https://developers.google.com/maps/api-security-best-practices).
No key issuance, billing activation or Google settings change is part of this plan.

## First MVP tasks

All tasks are open. IDs are stable references for a separate session, not
completed milestones. Each ticket inherits the consistency rule above.

| Task   | Priority | Depends on                                           | Deliverable                                                            |
| ------ | -------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| MVP-00 | P0       | Existing read-only integration                       | Proved source/day/timezone and bounded report/coordinate contract.     |
| MVP-01 | P0       | Existing navigation; MVP-00 for report fields/states | Focused navigation and one shared visual/interaction blueprint.        |
| MVP-02 | P0       | MVP-00                                               | Authoritative report calculations and coverage through Gateway.        |
| MVP-03 | P0       | MVP-00, MVP-01                                       | Shared point/endpoint/Street View presentation and no-key fallback.    |
| MVP-04 | P0       | MVP-01, MVP-02, MVP-03                               | Connected Summary/Distance experience.                                 |
| MVP-05 | P0       | MVP-02, MVP-03, MVP-04                               | Trip drill-down with retained report and map context.                  |
| MVP-06 | P0       | MVP-03, MVP-05                                       | Consistent contextual map actions across the listed existing surfaces. |
| MVP-07 | P0       | MVP-01 through MVP-06                                | Cross-screen design, accessibility and Storybook acceptance.           |
| MVP-08 | P0       | MVP-02 through MVP-07                                | Source parity, integration validation and bounded handover.            |

MVP-01 has two checkpoints: navigation/shared layout using existing data first,
then the report composition after MVP-00 proves its fields and states. The first
checkpoint does not complete the whole ticket or authorize speculative KPIs.

Execution path: MVP-01 navigation checkpoint → MVP-00 → finish MVP-01 and
MVP-02 → MVP-03 → MVP-04 → MVP-05 → MVP-06 → MVP-07 → MVP-08. No report screen
may bypass its source-contract or design/presentation dependencies.

### Bounded session deliveries

These are implementation boundaries, not new feature stages or additional
ticket IDs. Each delivery uses the existing acceptance criteria and stops before
the next; later prompts should contain behavior and quality expectations rather
than project-location boilerplate.

| Delivery                                       | Task scope                                               | Result and stopping point                                                                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Navigation and shared experience foundation | First MVP-01 checkpoint                                  | Group account views, simplify truck navigation and establish the shared responsive layout with existing data/stories. No report backend, new calculations or Maps features yet. |
| 2. Reliable daily report contract              | MVP-00, MVP-02 and the remaining MVP-01 report decisions | Prove source coverage, implement authoritative calculations and settle the report's field/state design. No invented totals or premature dashboard.                              |
| 3. Shared maps and surroundings                | MVP-03                                                   | Consistent point/endpoint/Street View behavior and no-key fallback. No GPS trace, richer Maps SDK or fleet map.                                                                 |
| 4. Daily operational overview                  | MVP-04                                                   | One connected, readable Summary/Distance view using the approved layout, report and shared map. No duplicate truck profile or report screen.                                    |
| 5. Contextual exploration                      | MVP-05, MVP-06                                           | Connected trip drill-down and shared map actions in the agreed existing surfaces, preserving context. No unrelated technical-screen redesign.                                   |
| 6. Combined acceptance and handover            | MVP-07, MVP-08                                           | Review cross-screen UX/design/accessibility and source parity, resolve in-scope issues and hand over the MVP. No MAP-/INS- work.                                                |

For each separate implementation session, re-read repository/local instructions
and inspect the dirty checkout before its selected delivery. A request to implement
the first MVP means the P0 tasks above, not automatic execution of MAP-/INS-
follow-ups, provider experiments or existing device-write campaigns.

### MVP-00 Prove the report and coordinate contract

**Work:** select one existing truck and a completed source-local day, using the
research's distance/count/speed comparison as the reference. Establish timezone,
date bounds, active-trip handling, source units and a bounded retrieval plan.
Public sources are `/cars/{id}`, `/time-zones`, `/trips` and `/location`;
historical `/events`/`/edata` are only coordinate feasibility inputs here.

**Acceptance:**

- Define which complete trip set belongs to the day and which fields are
  available; current assignment/Branch must not reinterpret source identity.
- Establish a real completion condition for all required report pages. Cursor
  exhaustion in the current display adapter alone must not be promoted to an
  upstream completeness guarantee without reconciling its lookahead/period rules.
- Distinguish query retrieval completion, time/position sample coverage and
  per-metric field availability. A completed provider query is not proof that
  every physical trip or GPS position was recorded; do not invent one universal
  accuracy/health percentage from those different facts.
- Select and measure request/page/row/deadline limits before implementation.
  The observed slow history queries and existing four-second service budget must
  produce an explicit supported-period or partial-result decision, not a blanket
  timeout increase, unbounded loop or new historical warehouse.
- Define complete, partial, empty, unsupported-period and unavailable states.
  Partial metrics must say Loaded subset; a timeout must not become zero trips.
- Confirm point/endpoint coordinate validity, including valid zero values.
  The MVP remains deliverable with location/endpoints even if MAP-01 cannot prove
  a useful trip track.
- Preserve reference metadata/expected aggregates without committing private
  source IDs, locations, credentials or raw rows. Contract fixtures are synthetic.

### MVP-01 Define and apply the shared experience blueprint

**Work:** first implement the navigation/progressive-disclosure proposal with
existing views and a shared responsive layout. Then, after MVP-00, finalize the
truck header, period/coverage bar, KPI cards, composition chart, map panel, table
and drawer hierarchy together. Map each slot to an existing component/pattern
before proposing another shared component. The first checkpoint must not need
new report queries, fake metrics or changes to device-operation behavior.

**Acceptance:**

- Meet the navigation-foundation criteria above: one account administration
  entry with tabs, three primary truck destinations and one More menu, working
  deep links and only active-view retrieval. Preserve existing leave guards.
- One desktop/narrow/mobile composition covers inventory → overview → trip →
  source detail, including map collapse/loading and consistent action placement.
- Color, typography, spacing, density, radius, elevation and status meaning
  reuse central tokens. A shared-pattern improvement identifies every affected
  MVP consumer and its story; no one-page visual fork or broad unrelated redesign.
- Define BG/EN labels and icon meanings for every map mode, period, freshness,
  missing value and coverage state. Default totals and unavailable values are
  visually distinguishable without relying on color.
- Present real information hierarchy: ordinary users see meaningful labels and
  facts first, original source fields remain progressively disclosed.
- A map-free/table-first path is part of the blueprint, not an accessibility
  workaround added after the visual implementation.
- Keep screen composition, source/report calculations and map behavior in their
  appropriate existing layers. Do not create a monolithic truck component or
  copy feature-specific fetching into the shell/navigation.

### MVP-02 Implement authoritative report data and coverage

**Work:** extend the concrete Karma Client read feature and generated Gateway
contract only as needed for one truck/day report. Keep source retrieval and
report calculations authoritative in one place; the browser must not sum just
the currently visible trip page and call it a daily report. No new database or
cross-application implementation imports are required by this slice.

**Acceptance:**

- Total distance = sum of `trip_distance`; night = sum of
  `trip_distance_night`; day = total − night; count uses the agreed trip set;
  max speed = maximum of available source maxima. Missing required inputs leave
  the affected aggregate unavailable/partial rather than silently skipping them.
- Keep raw source precision and format at presentation; do not add distance
  twice from odometer deltas or combine unrelated counters. A complete empty set
  can have zero trips/distance; its maximum speed is unavailable, not a fake zero.
- Return selected identity/period/zone, source/coverage facts and bounded
  retrieval outcome through a specific generated contract. Preserve individual
  field availability; no generic untyped JSON reporting endpoint.
- Reuse verified signed-session handling and existing upstream lifecycle.
  Source account reads remain shared across authenticated Tenants/Branches;
  credentials stay server-side. Do not call internal `/i/` operations.
- A changed SDL/operation follows codegen and schema checks. A cross-service
  contract case may extend an existing allowed test; do not create a UI/mock
  test suite or exceed the repository's 60-case budget.

### MVP-03 Extend the shared Google Maps and Street View panel

**Work:** extend the current preview/link helpers with explicit point, endpoint,
suggested-directions and panorama contexts. Reuse the existing optional Embed
configuration; external Maps URLs are the baseline, not a new paid SDK dependency.

**Acceptance:**

- One shared toolbar uses the same Map, Street View and Suggested route actions
  and icons in every placement. The context names the source record/time and
  explains historical versus last-reported position.
- No-key mode keeps valid external point/panorama/directions links and a useful
  placeholder. Embedded place/Street View opens only on explicit user action;
  map failure, missing key or no imagery never hides coordinate facts.
- Validate finite coordinate pairs and ranges; retain zero coordinates, do not
  default missing data to `(0,0)`, and do not create directions from one endpoint.
- Street View is labeled as surrounding imagery, not live camera/video or the
  truck's capture-time environment. A nearby panorama never moves the source
  marker. Do not guess vehicle heading from a missing source field.
- Preserve Google attribution and controls; reuse restriction-safe URL creation.
  Do not alter credential permissions, API enablement or billing as a side effect.
- Keyboard focus, labels, exit/return actions, accessible text facts and touch
  targets work in the shared stories. There is no autoplay, forced camera motion
  or eager map/imagery request on each table row.

### MVP-04 Build the connected Summary and Distance view

**Work:** add one report view within the current truck workspace, reusing the
car header, period controls, source drawer and real generated report operation.
Do not create separate duplicate Summary and Distance screens for the same data.

**Acceptance:**

- Identity → selected day/timezone/coverage → three KPIs → day/night composition
  → contextual map → trip table follows MVP-01 at all supported widths.
- Replace/extend the existing truck overview rather than adding another peer
  Summary screen. Technical/reference fields stay progressively disclosed;
  the daily view must not mount the advanced sections in the background.
- Each KPI explains its calculation/source and opens the relevant trip/source
  context; table and chart use the exact same report result, not independent totals.
- The map defaults to the explicitly labeled last-reported location when no
  trip is selected. That live-context card never claims it belongs to the past
  report day; selecting a trip changes only the labeled historical map context.
- Initial loading, empty report, partial result, per-metric missing values,
  unavailable service and failed location map render independently and clearly.
- Unknown parking/idle/engine-on totals and overall driver grade are absent or
  explicitly unavailable, not filled with nearby fields to make the dashboard busy.
- The same real component has connected success/empty/partial/error stories;
  Source fields remain accessible without becoming the default presentation.

### MVP-05 Connect trip drill-down and endpoint exploration

**Work:** reuse the existing trip list/detail drawer from the report. Retain
selected truck/day/timezone when opening/closing a record and map exploration.

**Acceptance:**

- Show source trip identity, start/end times and coordinates, available
  odometers, distance/night distance, source duration and maximum speed with
  established units. Do not relabel duration as verified ignition-on time.
- Each available endpoint offers the shared Map/Street View actions. Suggested
  Google directions is a separate optional action, never the actual driven path.
- One endpoint/no endpoints, active or incomplete trip, unavailable historical
  points and missing optional fields have distinct useful states.
- Existing source details, record navigation and focus return remain usable;
  external map exploration does not mutate the trip or abandon the report context.
- The trip's table row, drawer header and map context agree on identity/time.
  No hidden additional query supplies a different truck's current position.

### MVP-06 Roll out contextual maps consistently

**Work:** apply MVP-03 to the first-release placement table: inventory selected-row
actions, profile/overview, Location, trip detail, event detail and eData detail.
Do not redesign unrelated account/settings/device-write screens in this ticket.

**Acceptance:**

- Every listed surface uses the shared validated-coordinate actions and the
  same map panel behavior; no duplicated URL builder, icon naming or iframe logic.
- Inventory loads only the selected truck; event/eData views use their own
  message coordinates and time, not latest location as an undocumented fallback.
- Missing/stale/error labels and the fallback path remain consistent. A user
  can always read coordinates/source time and continue without loading Google.
- Opening/closing a map preserves the existing row selection, filters and
  drawer focus. Avoid multiple active previews where a single selected context
  suffices; no map request storm during paging or sorting.
- Connected stories cover at least one successful and missing-coordinate case
  per real consumer, reusing shared synthetic map fixtures.

### MVP-07 Accept visual consistency and accessibility across the journey

**Work:** review the assembled screens and the shared changes already delivered
with each task, following the [design-system skill](../../.agents/skills/holita-admin-design-system/SKILL.md).
This is a cross-screen acceptance gate, not permission to postpone task-level design.

**Acceptance:**

- The same headers, spacing hierarchy, KPI treatment, number/date formatting,
  status tones, action icons, map toolbar and source drawers are used throughout.
- Review the full information hierarchy, not only individual components:
  essential actions are easy to find, account tools are grouped, the truck tab
  bar stays focused and the More menu identifies the active technical page.
- Review connected Storybook states for success, loading, empty, partial,
  stale location, upstream error, missing coordinates, no key and unavailable
  panorama/fallback. Stories use real components and synthetic fixtures, not a
  second backend or application imports of fixtures.
- Check BG/EN text expansion, light/dark, the existing brand/density variants,
  desktop/narrow/tablet/mobile375 and zoom. Any central token change works for
  all affected shared consumers rather than fixing one screenshot.
- Keyboard-only use reaches all report/map actions, dialogs restore focus,
  sticky UI does not obscure it, charts have readable data alternatives, and
  reduced-motion mode avoids nonessential animation. Review our markup with
  Storybook's Accessibility panel; do not claim Google's iframe has been audited.
- Selecting a marker must have a list/text equivalent. No task depends on hover,
  precise dragging, color perception or Street View imagery to reveal essential data.

### MVP-08 Verify source parity and hand over the slice

**Work:** verify the agreed source comparison and the real connected journey;
follow [focused validation](../../.agents/skills/holita-focused-validation/SKILL.md).

**Acceptance:**

- For the agreed truck/day, trip count, rounded total/day/night distance and
  maximum speed match the reference source. Coverage and missing-value behavior
  are demonstrated with synthetic partial/empty cases, without private data dumps.
- The journey truck → day → report → trip → endpoint/Street View → Back works,
  and the last-reported position fallback works without historical track points.
- Existing administration/technical deep links, tab/menu navigation, list return
  context and device-editor leave protection still work after reorganization;
  no live device write is needed for this acceptance.
- No unexpected vendor writes, browser exposure of Karma credentials, inferred
  Branch mapping or automatic external location transmission is introduced.
- Run no checks while writing; at handover run `npm run check` once, codegen/
  schema checks when contracts change, one matching browser smoke file for the
  changed main journey, and `typecheck:tools` only if tools changed. Do not run
  the full smoke/federation/regression suite or add a UI test suite by default.
- Report actual check results and unverified external imagery/coverage. Update
  implemented workflow/configuration documentation only when the feature exists,
  and remove completed backlog items rather than retaining a progress journal.

## Remaining data and contract prerequisites

| Prerequisite                     | Affected report sections                                     | Remaining work                                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time, units and rounding         | V01–V07, R04, C01–C09/C15                                    | Confirm units/rounding, source timezones and detail denominators for the selected implementation slice. Preserve the observed Stoppings start-day attribution rather than assuming clipped calendar intervals. Obtain exact engine-on/parking/idle formulas and night rules before broader parity claims.                                     |
| State and maneuver dictionary    | V03, V06, D04–D07, R04, X03                                  | Resolve event IDs, stationary/ignition distinctions and eSafe maneuver/duration/axis meanings. Preserve decoded fields through a specific generated contract only when implementation is requested.                                                                                                                                           |
| Historical retrieval and latency | All period reports, X02/X06                                  | Agree a bounded retrieval strategy, row/cursor completeness and caller/service budgets. Two investigated query forms exceeded 20 seconds; the current history service has a four-second operation budget. Do not replace these failures with empty data or whole-period totals.                                                               |
| Driver attribution               | D01–D07, S01                                                 | Obtain a nonempty driver model and historical assignment evidence. The inspected account has no drivers/assignments; do not create vendor fixtures or map local Fleet Drivers automatically.                                                                                                                                                  |
| Hardware-dependent readings      | V04, V07–V10                                                 | Obtain real external sensor, accident-report ID and camera/media evidence. Clarify dedicated fuel/temperature reports versus CAN sources, plus battery-health/starter fields. Do not change configuration just to manufacture research data.                                                                                                  |
| Vendor-owned resources           | R01–R03, N01–N03, S03/S06/S10/S12                            | Ask ERM whether the discovered internal `/i/` operations have a supported external contract before choosing vendor synchronization. Otherwise select explicitly holita-owned workflows. Questions is query-use reporting; Application configures Weight/IO Extender/DTC/ePoly/StarLink Inputs/eMix presentation, not integration credentials. |
| Rich entity writes               | S01/S02/S04/S05                                              | Decide whether writes are required, prove permissions and map only documented payload fields. Current reads do not establish assignment, photo, odometer, user/role or application-write contracts.                                                                                                                                           |
| NC2 technical read models        | K01–K06                                                      | Obtain supported schemas for firmware/hardware, cached parameters, incoming diagnostics and transport statistics. The saved web login works in NC2; API-session/permission equivalence is still unverified. Do not substitute a device query for a cached read.                                                                               |
| Data-gated action evidence       | Coverage matrix, V07/V09/V10, D01–D07, R01–R03, N01–N03, S12 | Obtain existing populated examples without creating vendor fixtures: driver assignments, external sensor readings, accident/media records, POIs/routes/geofences, notification ACK/history and configured telemetry modules. Verify export contents and scheduled delivery only as a separately selected acceptance exercise.                 |

The report contains an unsent ERM question list. Do not send it or perform device
experiments without a separate request. Existing protocol and device-setting work
remains in [the API backlog](karma-api-v2.md) and
[device-settings acceptance](karma-device-management-design.md); do not replay its
completed writes.

## Post-MVP map and trip tasks

These tasks are useful extensions, not prerequisites that can hold the point/
endpoint MVP hostage. They use the same consistency rule and map placements.

### MAP-01 Prove useful trip-point coverage

**Priority:** P1. **Depends on:** MVP-00, MVP-02, MVP-05.

Use existing trip start/stop message IDs and timestamps to select bounded
`/events` positions; evaluate `/edata` positions only where that vehicle actually
has eData. Document pagination/order, source clocks, duplicates and boundary
behavior before proposing a trip-track contract. Do not assume the latest 500
rows span a particular trip, or that a vehicle with events has CAN readings.

**Acceptance:** a read-only example correlates one identified trip with its
actual timestamped positions, states which endpoints are present, counts valid/
distinct points, and reports gaps and query completion separately. A single point,
empty result, service timeout and partial path have explicit fallback behavior.
Use a defined, explained gap criterion before drawing segments; do not infer GPS
accuracy or tracking frequency from a menu label. Retain no private raw sample in
the repository. If this cannot be proved, leave the existing point/endpoints
experience in place and record the concrete provider/data dependency.

### MAP-02 Add a shared richer Google map only for proved interactions

**Priority:** P1. **Depends on:** MVP-03, MAP-01 for trip paths; a separately
proved bounded bulk-location contract for a fleet layer.

**Problem:** the current Embed preview cannot render our arbitrary sampled path,
coordinate selection and linked multi-marker state. **Smallest proposed change:**
one richer map implementation behind the same contextual panel, using Maps
JavaScript where those interactions are actually needed; retain the point/Embed/
external fallback and existing feature services. No separate fleet app or generic
provider abstraction is justified by this need.

**Acceptance:** key/API/referrer/quota/billing prerequisites are explicitly
approved and configured through supported public config before activation;
no private config is read as a shortcut. Plot only known coordinates; source
identity/time survives marker selection. Distinguish endpoints, observed samples
and suggested routes by label/legend as well as appearance. Preserve Google
attribution, keyboard-capable marker interaction, a synchronized accessible list
and usable no-key/no-service fallback. Reuse one selected map context rather than
mounting a map on every row. Any new API/config/contract documentation is updated
with the implementation, not now.

Google's [polyline support](https://developers.google.com/maps/documentation/javascript/shapes)
draws segments between supplied coordinates; it does not establish where the
truck traveled between them. Its [accessible marker guidance](https://developers.google.com/maps/documentation/javascript/advanced-markers/accessible-markers)
supports keyboard interaction and descriptive marker titles.

### MAP-03 Build a linked Trip Explorer

**Priority:** P1. **Depends on:** MAP-01, MAP-02, MVP-05; known units/clock alignment
for each additional signal.

Offer a point/time list beside the sampled-path map, plus selected speed/CAN
series and event markers. Selecting a row/time/sample updates one shared context;
the user can inspect its source and open Street View near that sample. Use a
small explicit list of available signals, not an empty universal sensor dashboard.

**Acceptance:** map, signal, event and source drawer refer to the same truck/time;
gaps are visible and not interpolated into recorded movement. Timestamped sample
stepping is not smooth playback at an invented sampling rate. Distinguish recorded
speed, maximum trip speed and any derived between-point estimate. Missing CAN
data must not block the trip/position view; missing track points must not block
endpoint exploration. No Roads snapping or suggested directions may be presented
as recorded GPS truth. Table/keyboard equivalents remain available for every
selection. This is an integrated experience improvement, not a claim that Karma
has no trip map or playback feature.

## Additional API-derived opportunities

These ideas were **not observed as the specified integrated capability in the
supplied account**. That does not prove they are absent from every Karma role,
version or paid module. Maps, Street View and trip maps themselves already exist
in Karma; the proposed advantage is consistent access, linked analysis and clear
evidence/coverage, not claiming those features as unique inventions.

| Task                                        | Priority and dependencies                                                                           | API and calculation                                                                                                                                 | Proposed value and acceptance                                                                                                                                                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INS-01 Comparable-period analysis           | P1; MVP-02/MVP-04 and two supported complete periods                                                | `/trips`; absolute differences in distance/count/maxima and percentage change only with a nonzero comparable baseline.                              | Side-by-side day comparison with the same timezone, unit, filters and completion state. Never compare a partial day to a complete day as an improvement/decline or infer driver quality/causation from distance.                                                             |
| INS-02 Observed telemetry capability matrix | P1; MVP-00/MVP-06 and bounded eData/event retrieval                                                 | `/cars`, `/edata`, `/events`; observed parameter presence, null counts, last observed timestamp and sampling gaps within the requested data.        | A readable matrix of available/not observed/unknown signals, with source drill-down. Start with selected vehicles and explicit retrieval bounds; no unbounded per-car query fan-out. Not observed is not unsupported hardware or a disconnected sensor.                      |
| INS-03 Explainable trip/day brief           | P1; MVP-02/MVP-04/MVP-05                                                                            | Existing report/trip values and coverage; deterministic sentences with links to contributing records and calculation definitions.                   | A concise human-readable summary beside the visual report, building on MVP metric explanations rather than another dashboard. Never invent a root cause, legal violation, health grade or hidden overall score; no AI service is needed for fact templates.                  |
| INS-04 Measurement-source comparison        | P2; confirmed units/counter semantics and bounded series                                            | `/trips`, `/edata`, `/location`; compare separately labeled odometer/engine-counter deltas, retaining resets/source changes and different coverage. | Explain Different sources / Different intervals instead of declaring a broken tracker. No direct CAN-meter versus envelope-odometer comparison until unit/scale and matching coverage are proved; preserve unknown scale as raw data.                                        |
| INS-05 Fuel consumption with evidence       | P2; calibrated counter/rate units and matching time/distance coverage                               | `/edata` 687 or another individually proved counter; rate integration only over valid covered intervals; `/trips` for matching distance.            | Liters and L/100 km with counter source, reset/gap markers and coverage explanation. Do not merge 687/1657, interpret a counter decrease as theft or claim tank-event parity. Local prices/receipts are a separate owned-data choice.                                        |
| INS-06 Nearby-truck assistant               | P2; MAP-02, bounded bulk `/location` through a specific generated contract, chosen freshness policy | Coordinate distance to an explicitly selected destination plus individual source ages.                                                              | Map/list of nearby last-reported positions, with stale/unknown records separated. Straight-line distance is not road ETA, route suitability or an automatically dispatched assignment. No messages or commands are sent.                                                     |
| INS-07 Selected evidence export             | P2; MVP-02/MVP-05 and a proved export selection/coverage                                            | The same selected report/trip/point data, period, units and source references; no independent totals.                                               | Downloadable trip/day brief or CSV with explicit partial/complete scope and a deliberate choice to include coordinates. No public share link, email delivery, raw credential/session export or private evidence committed to the repo. Reuse existing export/table patterns. |

For each chosen opportunity, first define its synthetic success/empty/partial/
error stories in the same presentation family. Do not convert this candidate
list into automatic implementation scope or start a new analytics platform.

## Deferred vendor-dependent areas

- Exact activity/driver parity waits for source dictionaries, interval/time
  semantics and historical assignment data; it is not a renamed trip-duration sum.
- Holita-owned POIs/geofences/notification rules or manual fuel/service/tire
  records require an explicit ownership and persistence decision. Vendor
  synchronization instead requires ERM's supported contract.
- Accident/media, query-use history, telemetry application definitions and
  input/sensor aliases need their actual source contracts and populated examples.
- NC2 presets, firmware, user administration or billing require a separate
  explicit product request; source-only capabilities are not a roadmap commitment.

## Scope rules for future work

- Karma account reads retain their current signed-session scope without Branch
  filtering. Source project and holita Branch are not interchangeable identities.
- Local business records/rules use verified Tenant/Branch ownership and explicit
  associations to source identities; do not automatically synchronize by registration.
- Credentials/sessions remain server-side. A new public GraphQL field or operation
  follows the existing schema/codegen workflow.
- API reads, provider queue status, device commands and application notifications
  are separate operations. No arbitrary device-command input or ambiguous replay.
- Keep remaining work here; actual source observations and reproduction decisions
  belong in the linked report. Do not retain private account transcripts or tokens.
