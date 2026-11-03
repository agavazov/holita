# Karma product and delivery backlog

Archived, deprecated reference only. The tasks and approvals below are historical; do not
treat them as active work. Open ERM engineering and vendor questions belong in the
[ERM roadmap](../../todo/erm-roadmap.md).

The [functional research report](karma-api-v2/web-functionality-research.md)
owns the 36-function classic inventory, NC2 console findings, internal web-method
references, API recipes, calculation rules, proposed holita presentation and bounded
live evidence. Keep further source findings there instead
of copying the catalog into this backlog. This file holds the remaining work;
implemented navigation belongs to [Discocan architecture](architecture.md#karma-client).
The bounded report contract and report field/state blueprint are described there;
physical source-unit confirmation remains blocked as specified below. The connected
[day workspace and trip drill-down](architecture.md#daily-report-contract) are
implemented; contextual map placements use the shared workflow in
[Karma maps](development.md#karma-maps). This backlog does not
authorize Google Cloud configuration or vendor writes.

## Boundaries for remaining product work

Remaining work uses real Karma source data and clearly states missing coverage, clocks and units.
Synthetic product scenarios were removed. Storybook snapshots remain a development tool.
Preserve the Karma menu order: Monitoring, Trucks, Administration, Settings. Monitoring owns the
Branch-scoped retained log; per-truck Diagnostics retains the real Karma history.

### Remaining source boundaries

Source, coverage and Google prerequisites limit the corresponding feature; they do not authorize
inventing data. Existing report and measurement workflows retain their source limits.

## Existing first-release slice and boundaries

The following retains the real-data MVP recipe and its detailed component
acceptance. Raw Karma source contracts keep their documented limits.

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

The implemented navigation foundation is described in
[Discocan architecture](architecture.md#karma-client) and the
[admin design system](../../admin-design-system.md#storybook-review).
Future deliveries must preserve its account/truck separation, short primary navigation,
discoverable More menu, direct links, active-view retrieval, list-return context,
BG/EN, responsive keyboard access and device-editor leave guards.

Remaining composition work connects the Overview Summary/Distance report to its
completed local day and existing trip details after MVP-00. Keep the last-reported
position separately labeled, without inheriting the historical day's meaning.
The list's future direct Trips and selected-row map/Street View actions remain
entry points within the relevant later deliveries; they do not authorize a fleet-wide
report or map. Keep unrelated Fleet navigation and local Fleet/demo records separate.

## Consistency rule for every task

**A task is not complete with data wiring alone or an isolated attractive page.**
Every implementation task must identify its shared presentation pattern, update
its real component stories, and demonstrate the same interaction in its affected
surfaces. Combined acceptance is not a deferred redesign phase.

- Reuse PageHeader, KpiStrip, TablePanel, FormField, record drawers and chart
  patterns from the [admin design system](../../admin-design-system.md). Improve a
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
  followed by the trip table. On narrow screens, stack sections and load the
  active map automatically; the table/coordinate facts remain useful if Google
  or the map configuration is unavailable.
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

The [map/source reassessment](karma-api-v2/web-functionality-research.md#map-and-source-data-reassessment)
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
[MapPreview](../../../apps/admin/src/app/ui/map-preview/map-preview.ts)
and [coordinate/link helpers](../../../apps/admin/src/app/ui/map-preview/location-map.ts)
first. Keep map context selection in the concrete feature; do not introduce a
generic map framework or a second app-wide data facade.

Reuse the [shared map workflow](development.md#karma-maps) for point,
endpoint, Street View and suggested-route modes, keyless external links and
optional configured previews. No map SDK or separate implementation is needed
for these contexts.

### Automatic loading of the active map

The owner's requirement supersedes the previous click-to-load policy: the
active map must be visible and load automatically as soon as its valid coordinates
and existing Embed configuration are available. Do not require a Show map/Load
map button or another confirmation. Selecting Street View, another endpoint or
Suggested route loads that chosen view directly, without a second load action.
Changing the selected record/point must update the active map, not leave the
previous location or preview behind.

Opening a screen/drawer with an active map therefore sends that selected point
to Google automatically. The owner explicitly authorized this behavior; explain
the transmission in the shared panel without adding a consent gate. This does
not authorize per-row iframes, hidden-tab preloads, all-truck fan-out, reverse
geocoding, polling, automatic panorama motion or changes to Google setup.
Missing coordinates/configuration or unavailable imagery retain useful source
facts and fallback links; do not promise a successful map without those prerequisites.

Keep Karma credentials/session IDs out of URLs. External links still load only
when opened, open safely and disclose a new tab. Never open, read or print the existing
ignored `apps/admin/public/config.local.json`; use the tracked config schema,
public setup instructions and synthetic/no-key fixtures. No local credential or
map-setting change is part of these implementation tickets.

The application must not claim panorama availability before it is established:
an Embed iframe is cross-origin and its error content must not be inspected.
Keep Return to point and external-map fallback. A later reliable availability
indicator can use a separately configured Street View service/metadata lookup;
[metadata](https://developers.google.com/maps/documentation/streetview/metadata)
provides availability status and imagery date when available.

Multi-marker fleet maps, interactive marker synchronization and arbitrary polylines
need a richer integration than the current Embed preview. MAP-02 must explain
that concrete limitation and choose the smallest sufficient Maps JavaScript
integration. Do not widen the existing Embed-only browser key implicitly:
review API/referrer restrictions, approved APIs, attribution, quotas and billing.
Dynamic maps/panoramas have separate usage rules; see
[Maps JavaScript billing](https://developers.google.com/maps/documentation/javascript/usage-and-billing)
and [Google security guidance](https://developers.google.com/maps/api-security-best-practices).
No key issuance, billing activation or Google settings change is part of this plan.

## First MVP tasks

The tasks below remain open. IDs remain stable dependency references; the
implemented report contract and blueprint are described in
[Discocan architecture](architecture.md#daily-report-contract), and
the shared map foundation in [Karma maps](development.md#karma-maps).
Each ticket inherits the consistency rule above.

| Task   | Priority | Depends on                  | Deliverable                                                                         |
| ------ | -------- | --------------------------- | ----------------------------------------------------------------------------------- |
| MVP-00 | P0       | Supported provider evidence | Confirm physical units for source distance and speed; raw units remain unconfirmed. |

The remaining MVP-00 unit proof gates physical-unit claims in the operational
report; it does not block coordinate-only maps and surroundings. The implemented
contract and [daily workspace](architecture.md#daily-report-contract) do not authorize
another navigation pass, speculative KPIs or physical-unit claims without source proof.
Later delivery dependencies on MVP-01/MVP-02 refer to the implemented contract and
blueprint, with this explicit source-unit limitation.

### Bounded session deliveries

These are implementation boundaries, not new feature stages or additional
ticket IDs. Each delivery uses the existing acceptance criteria and stops before
the next; later prompts should contain behavior and quality expectations rather
than project-location boilerplate.

| Delivery                                                   | Task scope | Result and stopping point                                                                                                                |
| ---------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 2. Reliable daily report contract — remaining source proof | MVP-00     | Confirm physical distance/speed units with supported evidence. The existing raw-unit contract must retain unconfirmed labels until then. |

For each separate implementation session, re-read repository/local instructions
and inspect the dirty checkout before its selected delivery. A request to implement
the first MVP means the P0 tasks above, not automatic execution of MAP-/INS-
follow-ups, provider experiments or existing device-write campaigns.

### MVP-00 Confirm physical report units

**Remaining blocker:** the public API response/help does not establish the physical
units of `trip_distance`, `trip_distance_night` or `max_speed`. Obtain explicit
supported source evidence before mapping them to km/km/h or another physical unit.
Numerical parity and odometer equality alone do not establish units. No vendor
message or support ticket has been sent as part of this delivery.

The [source proof](karma-api-v2/web-functionality-research.md#daily-report-source-proof)
records the bounded reference comparison, proved Europe/Sofia start-day selection,
cross-midnight attribution, both ID boundaries and coordinate feasibility. The
[implemented contract](architecture.md#daily-report-contract) preserves
raw source units, partial/unavailable states and independently scoped metric
availability; no physical-unit claim is hidden in the API or Storybook.

**Acceptance:** confirm the source-to-physical-unit mapping with traceable vendor
or equivalent explicit evidence, then update the concrete generated contract and
BG/EN presentation consistently. Preserve raw precision and existing bounded
retrieval. Other source zones, historical configuration reconstruction and live
active-trip finality are not implied by this remaining prerequisite.

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

### MAP-02 Add a shared richer Google map only for proved interactions

**Priority:** P1. **Depends on:** the [shared map workflow](development.md#karma-maps), the [bounded position contract](architecture.md#karma-client) for trip samples; a separately
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

### MAP-03 Extend the linked explorer with a richer map and verified series

**Priority:** P1. **Depends on:** MAP-02, [Trip drill-down](architecture.md#daily-report-contract); known units/clock alignment
for each additional signal.

The [implemented explorer](development.md#karma-maps) already provides a
bounded point/time list, selected-point Map/Street View and raw event facts. Remaining work is a richer sampled-path/multi-marker map
when MAP-02 prerequisites are approved. The [measurement workspace](architecture.md#measurement-workspace)
already supplies selected source-scale series; additional physical comparisons retain their unit/coverage gates.
Broader source retention/clock/coverage proof remains necessary before wider path claims.
Use a small explicit list of available signals, not an empty universal sensor dashboard.

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

| Task                                           | Priority and dependencies                                                                           | API and calculation                                                                                                                                 | Proposed value and acceptance                                                                                                                                                                                                         |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INS-04 Remaining real measurement-source proof | P2; confirmed units/counter semantics and bounded series                                            | `/trips`, `/edata`, `/location`; compare separately labeled odometer/engine-counter deltas, retaining resets/source changes and different coverage. | Explain Different sources / Different intervals instead of declaring a broken tracker. No direct CAN-meter versus envelope-odometer comparison until unit/scale and matching coverage are proved; preserve unknown scale as raw data. |
| INS-05 Remaining real fuel-consumption proof   | P2; calibrated counter/rate units and matching time/distance coverage                               | `/edata` 687 or another individually proved counter; rate integration only over valid covered intervals; `/trips` for matching distance.            | Liters and L/100 km with counter source, reset/gap markers and coverage explanation. Do not merge 687/1657, interpret a counter decrease as theft or claim tank-event parity. Local prices/receipts are a separate owned-data choice. |
| INS-06 Nearby-truck assistant                  | P2; MAP-02, bounded bulk `/location` through a specific generated contract, chosen freshness policy | Coordinate distance to an explicitly selected destination plus individual source ages.                                                              | Map/list of nearby last-reported positions, with stale/unknown records separated. Straight-line distance is not road ETA, route suitability or an automatically dispatched assignment. No messages or commands are sent.              |

The [measurement workspace](architecture.md#measurement-workspace) implements the
bounded observed-channel matrix and source-scale charts. INS-04/05 above retain the unproved
real scale, reset and coverage prerequisites.

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
