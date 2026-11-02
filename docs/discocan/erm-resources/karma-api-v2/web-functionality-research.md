# Karma functionality and API reproduction research

Research date: **2026-10-27**. Scope: the supplied Karma web account, the separately
stored API connection, all **36 visible classic-web submenu entries**, the 14
search-help topics, the accessible **NC2** interface and the existing holita
integration. The follow-up pass opened the menu destinations, inspected safe
drill-downs and canceled unsaved editors. This is a research report and a proposed
functional specification, not an implementation or certification of every role,
hardware variant or consequential action. No business record, notification rule,
credential, permission or device configuration was saved or changed.

## Findings that determine the implementation

The API supplies enough data for vehicle discovery, locations, trip lists,
distance reports, eData charts and substantial event/behavior analysis. A
functional equivalent can also include our own POIs, geofences, notifications,
fuel records, service records and tires. Those require holita-owned records and
processing; their existence does not imply synchronization with Karma's records.

Three distinctions matter:

1. **A presentation needs data, not necessarily a dedicated endpoint.** Counts,
   charts, filters and exports can use the existing read methods.
2. **A derived value needs a defined calculation.** Parking, idle, engine-on time,
   driver attribution and scores cannot be reproduced accurately by renaming
   nearby fields.
3. **A vendor-managed resource needs a supported contract to synchronize.** The
   public API v2 does not document POI/geofence/route/notification management,
   telemetry application configuration, query-use reports or video retrieval.
   Current web sources expose a separate internal `POST /i/` interface for many
   of these features. Its existence is useful evidence, not a supported API v2
   contract or permission to depend on it without ERM agreement.

The initial catalog contained hypotheses that the live inspection corrected:

- **Questions** is a user-activity report with User, Questions and Last Access
  columns. Saved report shortcuts are a separate feature.
- **Application** configures telemetry modules and their presentation, not OAuth
  clients or integration credentials. Its wizard offers Weight, IO Extender, DTC,
  ePoly, StarLink Inputs and eMix, followed by fleet/vehicle selection and event
  naming/units. The previous interpretation as integration registration is
  superseded.
- **Hierarchy** shows a fleet/vehicle tree with transmission-date columns; part
  of its grouping can be reconstructed from projects and cars.
- **Stoppings** is a duration-filtered report, with a default 15-minute threshold.
- **Temperature** reports four sensor channels; CAN coolant/oil temperatures are
  separate signals, not automatically Sensor 1/2.
- **Diagnosis** reports battery/starter indicators, not an established ECU/DTC view.
- **Geofence creation** enters the notification wizard's geofence flow; it is not
  just an independent zone editor. The current web source confirms this linkage.
- **Report period semantics** are not uniformly clipped calendar occupancy.
  Stoppings explicitly attributes data to the day when it started; the inspected
  one-day report displayed 28 hours. Reproducing that view needs its attribution
  rule, not a silent 24-hour cap.
- **NC2** accepted the saved website login and showed Users, Vehicles, CMD and
  Statistics. It uses its own web session flow and internal operations, not the
  public API v2 login/session contract.

## Sources and evidence

Primary source: [current public API help](https://karma.online/apiv2/). Its
`endpoints.js` and `help.js` were fetched again and were byte-identical to the
[archived vendor sources](source/README.md). The existing catalog of 20 paths / 32
declared HTTP operations therefore remains the request-contract reference.

Supporting sources:

- [Endpoint catalog](endpoint-catalog.md), [field dictionary](data-models.md),
  [transport/time/cursor rules](transport-and-authentication.md),
  [parameter metadata](observed-parameters.md) and [integration boundaries](holita-integration.md).
- Current [admin routes](../../../../apps/admin/src/app/features/karma-client/karma.routes.ts),
  [history service](../../../../apps/karma-client/src/modules/history/history.service.ts),
  [history SDL](../../../../apps/karma-client/src/modules/history/history.graphql)
  and [map workflow](../../development.md#karma-maps).
- The user-supplied [Karma guide 4.3.2](../karma-user-guide-v4.3.2/README.md).
  Its 2018 screenshots explain workflows, not the current API contract.
  [Report examples](../karma-user-guide-v4.3.2/content.md#pdf-page-13),
  [route planning](../karma-user-guide-v4.3.2/content.md#pdf-page-24),
  [notification stages](../karma-user-guide-v4.3.2/content.md#pdf-page-29) and
  [manual records](../karma-user-guide-v4.3.2/content.md#pdf-page-34) are useful
  historical references. Live observations below take precedence.

### Current web source references

The follow-up pass inspected these public scripts linked by the actual pages.
Only method names and functional observations are retained; the bundles, public
map-provider keys and live account payloads are not copied into this report.

| Reference | Primary source                                                                                        | SHA-256                                                            |
| --------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| W01       | [Classic connection configuration](https://karma.online/ExternalResources/externalJS.js)              | `6bc8592feaf82ef9956f42a97e8f9ad8513a77f58e17a055ebf7f73c439d42e3` |
| W02       | [Classic report constants and transport](https://karma.online/karma_04_49321db6.js)                   | `23cb9e2446f384b4cf3606433ce7c8225b489bf59a29a62243eca1d649321db6` |
| W03       | [Classic workflows and resource operations](https://karma.online/karma_06_97698195.js)                | `cc59e86c050b38095485087a4a212477078cfe68450b2cad24814d4197698195` |
| W04       | [NC2 core and authentication transport](https://karma.online/nc2/main-es2015.f269dc5eb1d719ac8a12.js) | `c3276731a0f8daa35be6da08f804a7bb15167dd4da63e50b2abb387b9831e278` |
| W05       | [NC2 feature module](https://karma.online/nc2/5-es2015.d97cd2009ffb7c9d9088.js)                       | `8a705057a86f62f8facd662319ba17f4a1cff2c8499e04f5bbb234bab6ae7c14` |

These are deployed-client observations on the research date. A label in a
downloaded module can describe an unavailable or legacy feature. It does not
establish server permission, a stable response schema or an ERM support promise.

### Bounded live sample

In the initial API comparison, twenty data-read requests were made: 19 GETs and one documented read-only
`POST /location`, following one API login. Eighteen reads returned HTTP 200 with
the expected array envelope; two reached their 20-second observation deadline.
Public-source downloads and web navigation are separate from those counts.
There were no entity writes, device commands, `/parameters` queries or queue polls.

Three previously observed vehicles were selected for matching; detailed report
comparisons used one vehicle and the completed **2026-10-26** web day. Identifiers,
coordinates, personal information, raw records and credentials are omitted here.

| Evidence | Observation                                                                                                                                                                                                                              | What it establishes / does not establish                                                                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E01      | API returned ten cars and one project; three sampled registrations matched the web inventory, and the primary device/project also matched.                                                                                               | Comparable sampled scope using separate connections; not a universal account/permission equivalence.                                                                        |
| E02      | `/drivers` was empty; car driver assignments were empty and sampled trip driver IDs were zero. The web Behavior selector had no driver rows.                                                                                             | Driver report parity is blocked by missing attribution data. Zero is not a real driver entity.                                                                              |
| E03      | `/trips` returned nine completed trips for the chosen wall-clock day. Summary trip count, distance rounded to one decimal and maximum speed matched the web report.                                                                      | A practical source for these three summary fields on this sample.                                                                                                           |
| E04      | Distance report day/night totals matched sums of trip distance and night-distance fields. Every sampled trip distance equaled stop minus start odometer.                                                                                 | Source aggregates can reproduce that report; the vendor's definition of night remains unspecified.                                                                          |
| E05      | All nine `trip_duration` values equaled the floor of timestamp elapsed minutes. Their sum and the precise elapsed-time sum differed; neither exactly supplied the web engine-on total.                                                   | Minute/truncation evidence for this sample. Do not equate trip duration, elapsed time and engine-on time or declare universal units from one installation.                  |
| E06      | One trip start matched the same message's `edt_tz`, not `edt`; the observed offset was +02:00.                                                                                                                                           | Local-time evidence for that car/date. It does not establish every project's zone, DST behavior or profile time interpretation.                                             |
| E07      | Equal `from_id`/`to_id` bounds returned no event; widening the lower/upper bounds recovered the intended message.                                                                                                                        | Boundary inclusivity needs care. This is not a complete cursor specification.                                                                                               |
| E08      | Latest events/eData and a historical eData tail returned 500 rows. Latest sensors returned 500 envelopes with all `sensors` values null.                                                                                                 | Real history batches exist; 500 envelopes are neither complete history nor actual sensor readings.                                                                          |
| E09      | `GET /events?decode=1` with event-type filtering returned optional `extra_parsed.esafe` data: `manuever`, `level`, `duration`, `x`, `y`, `z`. Sample maneuver codes were 3/5/7/9 and levels 2/3. Some axes were null.                    | A useful structured behavior source, outside the current GraphQL mapper. Preserve the actual `manuever` spelling; maneuver/axis/duration semantics still need a dictionary. |
| E10      | Driving profile returned the nine known category objects, each with score/weight; four categories had non-null scores.                                                                                                                   | Partial real score data. Null categories cannot become zero scores or an invented overall grade.                                                                            |
| E11      | `POST /location` with two car IDs returned exactly the requested two cars. Selected scalar-location reads returned `vin`/`vbat`.                                                                                                         | Bulk map reads are viable on this sample; batch limits and other POST read variants were not tested.                                                                        |
| E12      | The primary eData sample contained thirteen parameter IDs, including newly cataloged 781, Battery Voltage (Starlink). Another vehicle exposed a smaller set.                                                                             | Capabilities vary by installation; catalog presence is not per-vehicle availability.                                                                                        |
| E13      | Web Fuel left fuel-used/event cells blank although a historical tail for the same local day contained cumulative CAN fuel readings. Temperature returned no sensor rows.                                                                 | The dedicated web reports and CAN parameters are not automatically interchangeable. The historical tail did not establish full-day coverage.                                |
| E14      | Date-filtered events and an unfiltered decoded ID-range request timed out at 20 seconds. Successful sampled reads took about 0.17–1.64 seconds.                                                                                          | Query-dependent latency is a real constraint against the current four-second service budget; failures are not empty datasets.                                               |
| E15      | Fuel records had Date/Volume/Odometer/Location/Receipt fields; an opened blank editor was canceled and the list returned to zero rows. Maintenance showed current/next dates and odometers, service type, location, comment and receipt. | These are manual business records, distinct from telemetry; no matching public API methods are declared.                                                                    |
| E16      | Questions and Application had the different purposes described above; Hierarchy had transmission-date columns and Stoppings a duration threshold.                                                                                        | Corrects the initial menu-only hypotheses.                                                                                                                                  |

The latency probe's event window was a UTC day, while the report comparison used
the provider's wall-clock trip day. No event-to-web parity is claimed across those
different windows. Browser screens were inspected, but live screenshots/private
transcripts were not exported into the repository. Historical illustrations are
linked above. The running holita GraphQL/admin was not exercised for parity;
its baseline was inspected in source.

### Daily report source proof

A further bounded public-API-only investigation on 2026-10-27 used the existing
API connection, GET reads and ordinary API login. No `/i/`, device parameter query,
command, queue poll or vendor mutation was used. Forty-three successful data reads
included bounded selection of the existing reference truck, clock/ID boundary
probes and coordinates. Private identities, positions, sessions and raw rows are
not retained here. These observations qualify the current report contract, rather
than certify every provider account or historical configuration.

| Observation                                                                                                                                                                                                                                  | Supported rule / limitation                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The reference completed day 2026-10-26 returned nine trips: total 377.58, night 134.008, day 243.572 and maximum source speed 91.5.                                                                                                          | Reproduces the numerical E03/E04 reference; calculations retain source floating-point precision. Physical distance/speed units are still unconfirmed.                                                                       |
| The selected car's zone reference resolves to Europe/Sofia. A 2026-10-26 start message matches `edt_tz`, with `edt` offset +120 minutes; a 2026-10-02 sample matches at +180 minutes.                                                        | Corroborates provider wall clock and seasonal offsets for this car. It does not establish previous car-zone configurations or every repeated/skipped historical clock time.                                                 |
| Equal date endpoints at one trip's start returned that trip; moving the lower endpoint one second forward excluded it; an instant at its stop did not select it.                                                                             | Observed inclusive filtering by start time, not calendar-overlap clipping.                                                                                                                                                  |
| A real crossing-midnight trip in a 126-row recent batch was returned for its start day and excluded from its stop day.                                                                                                                       | Whole-trip start-day attribution, including distance/night values across midnight.                                                                                                                                          |
| Inclusive ID range recovered all nine reference rows; an upper bound at the middle ID returned five; the complementary lower-bound query returned the other four; both `to_id=min-1` and `from_id=max+1` within the same day returned empty. | Supports checking both ID boundaries, then bounded descending traversal to an explicit terminal empty range. Short batches/cursor exhaustion alone are insufficient. No universal batch cap or retention guarantee follows. |
| All nine reference trips and the 126-row recent sample had active flag zero and stop times.                                                                                                                                                  | Active/non-final behavior was not observed live. The report conservatively marks nonzero/unknown active flags or missing stop times non-final instead of inventing final totals.                                            |
| Eighteen reference endpoint pairs and the selected last location had finite, range-valid coordinates.                                                                                                                                        | Point/endpoint feasibility only; zero validity is covered synthetically. No complete driven path or GPS-time coverage is claimed.                                                                                           |

Authenticated probe latencies were approximately 0.07–0.38 seconds; the observed
login-inclusive first read was below 0.9 seconds. The measured small-day workload
fits the existing four-second operation budget. The implemented boundary allows
four logical trip page reads (including upper-bound verification), 1,000 retained rows and a 2 MiB trip-response body, plus the fixed
car/zone lookups within that same deadline. These are explicit application limits,
not alleged provider caps. A slow/larger selection returns a subset or unavailable
result without raising the blanket timeout or adding a historical store.

**Remaining source blocker:** public API response/help metadata does not establish
physical distance/speed units. Numeric parity and odometer equality do not prove
km/km/h. The contract labels raw source units as unconfirmed; confirming their
physical mapping requires explicit supported vendor evidence. Source query completion,
field availability and position/time sample coverage remain separate. A completed
query is not proof that all physical trips were recorded, and a later read may
change because of provider corrections, late arrivals or retention.

### Systematic follow-up evidence

The follow-up used ordinary web navigation/report reads, one NC2 sign-in and
public-source inspection. It did not repeat the direct API data probe or manually
invoke the discovered internal operations. Report generation and authentication
can update the provider's access/usage audit automatically; no explicit business,
configuration or access-control write was submitted.

| Evidence | Observation                                                                                                                                                          | Consequence                                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E17      | The 36 classic menu destinations were visited, including all seven empty driver selectors. Report/View/Shortcut availability differs between reports.                | Menu coverage is established for this account; empty selectors do not prove populated driver reports. The action matrix below states the limits.                        |
| E18      | NC2 accepted the saved web credentials through its own login screen and exposed four top-level destinations.                                                         | Website credential reuse is observed for this account. Shared sessions, API-account equivalence and identical permissions remain unproven.                              |
| E19      | NC2 Users listed one user; Vehicles listed ten vehicles and additional firmware/eFuel/eSafe/hardware fields. A vehicle detail showed a 13-column recent-event table. | NC2 is a technical operations console, not another copy of the classic report catalog. No private rows are retained here.                                               |
| E20      | NC2 Diagnostics displayed an empty Time (Local)/MT/RefNum/Data table; Parameters displayed populated ID/Modified/Value rows.                                         | Cached parameter display and incoming diagnostic messages are separate models. Neither establishes a DTC schema or authorizes a device query.                           |
| E21      | NC2 Statistics accepted a completed-day/unit selection and returned no records, with five transport-statistics columns.                                              | The selector and empty result schema are known, not the meaning or units of populated counters.                                                                         |
| E22      | The notification wizard exposed 24 trigger families. A speed-condition draft reached Cycles and Notify By; it was canceled.                                          | Thresholds, validity, occurrence limits, popup/ACK and optional automatic-command controls exist. No rule, recipient delivery or command was activated.                 |
| E23      | The Application wizard exposed six telemetry application types; a DTC draft reached event Rename/Unit fields and was canceled.                                       | Application means configurable telemetry presentation. It is not evidence of OAuth/application credential issuance.                                                     |
| E24      | Assets, Driver, Vehicle, User, Fleet, Maintenance and Tire editors exposed additional fields. Unsaved editors were canceled or closed.                               | Richer editor fields are mapped below; their visibility does not expand public API write payloads.                                                                      |
| E25      | Summary, Distance, Parking, Odometer, Engine Hours, Fuel and Camera exposed nested tables. Stoppings exposed a trip breakdown.                                       | Detail tables are separate functional requirements, not merely extra columns on the parent report.                                                                      |
| E26      | Stoppings displayed 28 hours for a selected single day and a footer specifying start-day attribution.                                                                | A whole attributed interval can extend beyond the selected day. Exact interval selection still needs proof; calendar clipping would change the source report's meaning. |
| E27      | A live-map Rename dialog exposed Input 1–4, Ignition, Engine and Sensor 1–8 aliases.                                                                                 | Naming metadata is distinct from actual readings and from the four-channel Temperature report. No alias was saved.                                                      |
| E28      | W01–W05 contain concrete classic/NC2 internal operations, including resource reads/writes, reports and media helpers.                                                | Many gaps are gaps in public API v2, not evidence that Karma has no underlying service. Source-only operations remain explicitly unsupported/unverified candidates.     |

The inspected account still cannot demonstrate real driver attribution, populated
external sensors, camera clips, accident payloads, existing route/POI/geofence
records or actual notification acknowledgement/delivery. Save, Finish, Delete,
activation/password changes, Send, output controls, firmware/configuration actions
and scheduled delivery were not executed. PDF/Excel/CSV contents were not
downloaded or compared. Those limits are not counted as successful action tests.

## API methods and the existing holita boundary

Paths below are relative to `https://karma.online/apiv2/`. Authentication stays in
the existing server connection. Query recipes omit session values deliberately.

| Method                                                 | Inputs relevant to reproduction                                                                                      | Current holita use / required extension                                                                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /cars`, `GET /cars/{id}`                          | Optional list project/car/device selectors; detail path ID.                                                          | `karmaCars` / `karmaCar` exist. Lists currently load the account array and filter locally. Raw driver identities and several metadata fields are not exposed.                 |
| `GET /projects`, `/time-zones`                         | Reference lists.                                                                                                     | Existing queries resolve names and timezone IDs. A project is not automatically a holita Branch.                                                                              |
| `GET /users`, `/roles`                                 | Optional project selector for users.                                                                                 | Existing read-only account views; roles are reference data, not holita authorization grants.                                                                                  |
| `GET /drivers`                                         | Optional `project_id`.                                                                                               | No Karma driver query/mapper yet. Empty responses provide no nonempty row schema. Local Fleet Drivers are separate records.                                                   |
| `GET /location`                                        | Scalar `car`; repeated `fields[]` such as `spd`, `odo`, `edt_tz`, `pdt`, `vin`, `vbat`; documented address selector. | `karmaLocation` exists with fixed fields. Voltages, addresses and bulk selection need a specific extension and mapping.                                                       |
| `POST /location`                                       | JSON car-ID array and selected fields.                                                                               | Two-car read verified. No current bulk GraphQL operation; do not issue one request per map marker when a proven bulk read is available.                                       |
| `GET /trips`                                           | Car; paired provider-wall-clock dates; ID bounds.                                                                    | `karmaTrips` exists with display cursors. Sample `trip_distance`, night distance and max speed support reports.                                                               |
| `GET /events`                                          | Car; paired dates with `date_type=utc`; `event_type[]`, `fields[]`, ID bounds; optional `decode=1`.                  | `karmaEvents` preserves selected fields and opaque `extra`. Decoded eSafe, voltages, addresses and fuller filters need explicit contracts.                                    |
| `GET /edata`                                           | Car; UTC dates; `parameter_id[]`; `showdesc=1`; ID bounds.                                                           | `karmaEdata` exists. Charts/aggregates require a bounded dataset and source-specific unit metadata.                                                                           |
| `GET /sensors`                                         | Car and documented date/ID/event selectors.                                                                          | Not exposed; only null sensor payloads observed. The help also declares POST reads, which were not exercised.                                                                 |
| `GET /driving-profile`                                 | Car and provider-wall-clock period.                                                                                  | Existing query exposes nine score/weight pairs. No supported overall-score formula is established.                                                                            |
| `GET /black_box/{id}`                                  | An existing accident-report ID.                                                                                      | No known report ID or discovery contract in this sample; do not probe guessed IDs.                                                                                            |
| `GET /queue/{id}`                                      | An existing submitted queue ID.                                                                                      | Not part of the public Karma query adapter. Queue state alone does not prove applied configuration. No new queues were created here.                                          |
| `GET /parameters`, `PUT /parameters`, `POST /commands` | Documented device inputs.                                                                                            | Device interaction, not ordinary history. Even a GET with `query` may contact a device. Reuse only the separately controlled Fleet operation contract; none was invoked here. |

The help also declares car/driver writes and project creation. Their existence
does not prove this account's write permission. If a later implementation includes
them, the documented payload subsets are:

- Car creation: device/project/timezone/registration plus optional type/year/color.
  Car update: registration/type/year/color only.
- Driver creation: project/first name/last name/phone. Driver update: names/phone.
  Driver assignment and the richer web form are not covered by these fields.
- Project creation: name. No project update/delete or user/role/application
  management contract is declared.

The existing adapter does not implement these entity writes. The browser must
not call vendor endpoints directly or receive vendor sessions.

## Calculation rules

These rules specify proposed holita behavior. A source field or sample relationship
is identified explicitly; an unverified Karma formula is not silently replaced.

| Rule                  | Calculation and qualification                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01: distance         | For a complete selected trip set, total = sum of `trip_distance`; night = sum of `trip_distance_night`; day = total − night. E03/E04 establish sample parity. Preserve the vendor night classification.                                                                                                                                              |
| C02: duration         | Keep reported `trip_duration` separate from elapsed `stop − start` after resolving the source zone. E05 supports truncated minutes on nine trips, not a universal conversion. An engine-on total needs ignition intervals, not just a trip-duration sum.                                                                                             |
| C03: intervals        | Once event meanings are verified, pair state transitions. Select the attribution policy explicitly: complete intervals attributed to their start day versus calendar-overlap intervals clipped to the period. E26 demonstrates why these are different reports. Parking, stationary time, ignition-on time and idle remain distinct classifications. |
| C04: parking/stopping | Count and sum the relevant intervals; apply the chosen duration threshold. Group by a known place or an explicit spatial grouping rule for location charts. Stoppings currently offers 15 minutes by default; its precise relation to Parking still needs event-level proof.                                                                         |
| C05: idle             | Requires an engine-running signal plus a stationary signal. RPM > 0 can support engine-running evidence; RPM zero does not establish ignition off. The current help advertises idle reporting above 300 seconds. Preserve shorter stationary intervals separately.                                                                                   |
| C06: fuel             | Prefer the change in one calibrated cumulative fuel counter, such as 687. A fallback estimate from rate 662 is the trapezoidal sum of adjacent rates × elapsed hours over covered intervals. Do not combine 687 and 1657 as the same counter or integrate across unknown gaps.                                                                       |
| C07: consumption/cost | After units and coverage are known, L/100 km = 100 × liters used / distance in km. Estimated cost = distance/100 × configured L/100 km × configured price/L. Actual receipt cost needs recorded prices/amounts; volume alone is insufficient. Missing inputs yield no estimate.                                                                      |
| C08: gauges/charts    | Show latest reading with its own timestamp; min/max describe the covered samples. Separate CAN oil/coolant, external temperature channels, tracker supply voltage and tracker internal battery. Do not substitute one sensor family for another.                                                                                                     |
| C09: odometer/hours   | Use a chosen source counter and its unit. CAN 152 is labeled meters; API envelope `odo` and trip metrics have separate semantics. Engine counter 64 differs from ignition-on duration. Deltas require the same counter/source segment.                                                                                                               |
| C10: behavior         | Count events by proven maneuver/severity and period. Events per 100 km is a possible explicitly holita-defined metric after distance units are known. Keep vendor score/weight pairs intact; an arithmetic or weighted average is not proven to equal Karma's grade.                                                                                 |
| C11: geography        | For nearest vehicles/POIs and circular geofences, use coordinate distance with an explicit meter/km unit. Straight-line proximity is not road distance or ETA. Entry/exit/dwell derived from sampled positions has the resolution of those samples.                                                                                                  |
| C12: freshness        | Age = current UTC time − a proven source event timestamp. Show age/last report time. A selected stale threshold is our rule, not proof of provider disconnection; `pdt` is not a verified substitute.                                                                                                                                                |
| C13: local records    | Service due dates/odometers compare the next target with the agreed business date/odometer. Tire mileage accumulates fitted-use segments. Fuel receipts, service records and tire history are independently stored business facts.                                                                                                                   |
| C14: totals/exports   | Aggregate only the complete identified selection. A loaded cursor page can have page totals, not whole-period/fleet totals. Include period, zone, source and coverage in exports; label a partial selection as partial.                                                                                                                              |
| C15: detail shares    | For an identified complete detail set, distance share = row distance / selected distance; duration share = row duration / selected duration; count share = row count / selected count. Show no percentage for a missing/zero denominator. Match each table's own denominator and grouping; web location clustering and rounding are not established. |

No universal score thresholds, fuel-theft detection thresholds, sensor scaling,
battery-health algorithm, night definition or connectivity timeout was established.
Those are delivery conditions below, rather than hidden implementation guesses.

## Vehicles: ten functions

### V01 — Summary

- **API:** `GET /cars/{id}`, `/trips`, `/location`; `/events` for additional state
  intervals and `/edata` only for proven signal-based metrics.
- **Calculate:** trip count, C01 distance/day/night and maximum trip speed.
  Travel, idle, parking, engine-on percentages and averages need C02–C05 and the
  correct denominator; E03 does not prove those remaining formulas.
- **Show:** vehicle header, shared period filter, KPI strip and a summary table
  with drill-downs to trips, events and maps. The web columns include distance /
  average, trips, driving percentage, travel/idle/parking/engine-on time and max
  speed. Show each available metric independently.
- **Condition:** count/distance/max-speed are the first proven slice. The web
  Parking and Summary screens also round parking time differently; exact formatting
  parity is not yet established. Existing car/trip views are reused.

### V02 — Distance

- **API:** `GET /trips`; `/cars` for labels/project selection. Optional `/edata`
  parameter 152 supplies a separate CAN counter view.
- **Calculate:** C01; group complete trips by vehicle and resolved local day.
  Estimated cost uses C07 and our configuration, since the richer web fuel
  settings are not returned by the car API.
- **Show:** total/day/night KPIs, daily stacked bars and a vehicle/trip table.
  The observed web report has Total Distance, Estimated Total Cost, Day Distance
  and Night Distance columns.
- **Condition:** E04 proves the source sums for one day. Do not add a second
  distance count from both trip distance and odometer deltas.

### V03 — Parking

- **API:** `GET /events` with the verified state/event selections, plus `/trips`
  for context and an address lookup where supported.
- **Calculate:** C03/C04; time, count, period percentage and location/hour groups.
  The sampled web parking count exceeded its trip count; one gap per trip does
  not reproduce this report.
- **Show:** Total Parking Time / Parkings / Parking percentage / Distance table,
  an interval drawer and map. The observed View also has parking-by-location and
  parking-by-hour charts with chart-to-map navigation.
- **Condition:** a reliable engine/park event dictionary, boundary events and the
  counting rule remain necessary. A trip-gap display can be offered under its
  own meaning without calling it verified Parking.

### V04 — Fuel

- **API:** `GET /edata` for 662/687/1657/785, `/sensors` for a real tank sensor,
  `/events` for verified refuel/theft events and `/trips` for distance.
- **Calculate:** C06/C07; level percentages are not liters without tank capacity
  and calibration. A level increase/drop is only a candidate refuel/theft event
  until its detection rule is defined.
- **Show:** separate level, engine fuel rate and cumulative-consumption charts;
  a fuel-event list and consumption summary. The web report has Total Fuel Used,
  No. Of Fuel Events, Distance and Trips.
- **Condition:** E13 shows that a blank vendor Fuel report can coexist with useful
  CAN data. Offer CAN measurements under their own source label; do not fabricate
  the absent tank-event report or claim full-period consumption from a tail batch.

### V05 — Odometer

- **API:** `GET /location`, `/trips` start/stop odometers and `/edata` parameter 152.
- **Calculate:** C09; optional trip/month distance uses C01. An actual manual
  correction or reset changes business/device state and is a separate write workflow.
- **Show:** selected source counter, last report time and distance history, with
  source details available. The live report has Odometer Start, Odometer End,
  Total Distance and Trips; its nested Trips by Distance adds distance share,
  start/end odometers and duration. Do not merge GPS/tracker/CAN counters.
- **Condition:** the report and nested trips were inspected, without changing a
  counter. Public car-update fields do not include an odometer update. W03's
  internal `SetOdometer` is a separate consequential action, not an API v2 PUT field.

### V06 — Engine Hours

- **API:** `/events` with proven ignition states; `/edata` parameter 64 for the
  accumulated engine counter, with RPM 1 as a separate running signal.
- **Calculate:** C02/C03/C09. Preserve source night-duration classification where
  available; do not assume astronomical night or driving time equals engine-on time.
- **Show:** Engine On Time / Day Engine On Time / Night Engine On Time, as in the
  observed web report; show a CAN engine-hours counter separately. Its Engine On
  Details table has duration/share, start/end places/times, day/night duration and
  distance. Keep that interval table distinct from the trip table.
- **Condition:** E05 demonstrates why summing trip durations is insufficient.
  Counter readings are feasible before exact vendor ignition-duration parity.

### V07 — Temperature

- **API:** `/sensors` for external channels; `/edata` 188 for oil and 539 for coolant.
- **Calculate:** C08; per-channel latest value and observed min/max. Keep original
  timestamps and do not fill missing channels with zero.
- **Show:** four external channel series when supplied, plus separately named CAN
  oil/coolant charts. The web table has Vehicle, Driver, Trips and Sensor 1–4.
- **Condition:** external sensor payloads were null and the web report empty.
  Real CAN temperatures can still be displayed; they do not prove external sensors.

### V08 — Diagnosis: battery/starter

- **API:** selected `/location` and `/events` fields `vin`/`vbat`; `/edata` 781 is
  another explicitly distinct source. Use existing protocol evidence for any
  additional supported diagnostic reading, without issuing a new device command.
- **Calculate:** voltage history and extrema only after field/unit confirmation.
  Battery life/SoH, starter time and unit temperature need their actual source
  fields or documented algorithms; voltage alone cannot supply them.
- **Show:** the observed report's Unit Temperature, StarLink BAT Voltage, Vehicle
  BAT Voltage, Vehicle BAT Life and Starter Time as independently available facts,
  with voltage charts and source age.
- **Condition:** do not substitute CAN coolant/oil for tracker temperature or call
  this a DTC report. DTC evidence has a separate existing investigation.

### V09 — Accident

- **API:** `/events` for a proven accident reference, then `GET /black_box/{id}`.
- **Calculate:** event counts and, only after the report schema is known,
  time-aligned acceleration/speed traces and supported severity facts.
- **Show:** accident list → event/map detail → report graph and available source
  evidence. Keep the source event distinct from a completed black-box report.
- **Condition:** no suitable report ID or populated model was available. No
  arbitrary ID was requested. An accident menu does not prove downloadable data.

### V10 — Camera

- **API:** `/cars` video metadata and `/events` for known camera event types;
  actual images/live/recorded media need an additional supported interface.
- **Calculate:** counts by known type/period; no inference of fatigue or behavior
  from a generic event code without its dictionary.
- **Show:** camera-event timeline and map first; media player/download only when
  actual media metadata, permissions and URLs are available. The live report has
  Vehicle, Total Camera Events and Trips, with trip detail and View actions. The
  sampled event-total cell was blank while trip rows were available.
- **Condition:** sampled car video metadata was null. Fatigue, phone, smoking,
  distraction, seatbelt and obstruction are advertised help scenarios, not
  verified media availability for this account.

## Drivers: seven functions

All driver features need a nonempty `/drivers` model and reliable historical
assignment. `trip.driver_id` is a useful candidate; today's car assignment does
not establish yesterday's driver. E02 currently blocks live driver-level parity.
Vehicle-level results remain useful and must not be relabeled as driver results.

### D01 — Driver Summary

- **API:** `/drivers`, `/cars`, `/trips`, with `/events` and `/driving-profile` where
  attribution to the selected driver and interval is established.
- **Calculate:** the verified V01 metrics grouped by historical driver identity;
  keep unassigned activity separate rather than distributing it among drivers.
- **Show:** driver header, assignment history, KPI strip and vehicle/trip breakdown.
- **Condition:** the public profile API selects cars, not drivers. A multi-car
  driver score needs an explicit aggregation contract, not an assumed average.

### D02 — Driver Distance

- **API:** `/drivers` and driver-linked `/trips`.
- **Calculate:** C01 by driver and period, using each trip once; keep source
  day/night distances and distinguish current assignments from historical ones.
- **Show:** daily distance bars, totals and a trip/vehicle table linking to the
  existing trip drawer.
- **Condition:** no source driver assignments were available to verify this grouping.

### D03 — Driver Parking

- **API:** `/events` plus `/trips` and a verified driver-assignment history.
- **Calculate:** V03 intervals attributed to the driver effective at that time.
- **Show:** parking intervals, location/hour charts and vehicle context.
- **Condition:** driver changes during an interval need a stated attribution rule;
  copying a car's current driver would invent historical ownership.

### D04 — Speed

- **API:** `/trips.max_speed`, `/events.spd` and confirmed overspeed event types;
  `/drivers` for attribution.
- **Calculate:** maximum of reported maxima; overspeed counts/durations only from
  a verified event definition or an explicitly holita-defined sampled threshold.
  Do not infer the maximum between sparse samples.
- **Show:** maximum-speed KPI, speed chart, threshold control and event/map list.
- **Condition:** source `spd` units and a legal/road speed limit are separate
  questions. A selected numeric threshold is not automatically a legal violation.

### D05 — Behavior

- **API:** `/events?decode=1` and `/driving-profile`; `/trips` supplies distance.
- **Calculate:** C10 by maneuver/severity; preserve `extra_parsed.esafe` fields.
  The help defines normal/aggressive/dangerous levels, while exact maneuver code
  names, duration and acceleration units still need confirmation.
- **Show:** maneuver/severity counts, category bars, time chart and linked map/
  event drawer. Unmapped maneuver codes retain their source identity.
- **Condition:** the live driver selector was empty. The same data can support a
  vehicle behavior view after the decoded contract is exposed through Gateway.

### D06 — Eco Driving

- **API:** `/trips.eco_score` and `/driving-profile` category score/weight pairs.
- **Calculate:** source values and simple descriptive distributions. A composite
  grade/ranking remains unavailable until ERM explains scales, weights and aggregation.
- **Show:** existing nine-category presentation, per-trip scores and a selected
  period, with unavailable categories retained as missing.
- **Condition:** a trip eco score and a category profile are not proven to be the
  same grade. Do not introduce color thresholds or driver rankings as vendor facts.

### D07 — Working Hours

- **API:** driver-linked `/trips` and verified `/events` state intervals.
- **Calculate:** activity durations from C03. Actual working shifts/breaks require
  defined work-state events or our own recorded work entries.
- **Show:** day/week activity timeline with separate driving, idle and unavailable
  intervals; a work/rest view only when its inputs and rules are defined.
- **Condition:** trip time alone does not establish paid work, rest or tachograph
  compliance. No regulatory/compliance claim is supported by this research.

## Road: four functions

### R01 — Route Planning

- **API:** `/cars`, `/drivers` and `/location` supply selection/start context.
  There is no declared route-plan CRUD or route-optimization method.
- **Calculate:** a separate routing provider supplies route geometry, road
  distance, directions and ETA. Our stored ordered stops can support progress
  against sampled positions; do not reconstruct a planned route from trip totals.
- **Show:** vehicle/driver, name, schedule and start/end/intermediate POIs, then a
  map and ordered stop list. The live five-stage wizard is Name/Dates/Vehicle →
  Start Place → End Place → Places → Advised Route, with an optional Notifications
  checkbox. Its Start Place step offered the empty POI list and Add new POI.
- **Condition:** plans/assignments would be holita-owned unless ERM supplies a
  supported management contract. Route notifications are an additional local
  workflow, not a reason to submit arbitrary device commands. End/place/route
  results were not generated: that would first require a saved POI in this account.

### R02 — POI

- **API:** `/location` and historical coordinates can place vehicles relative to
  our POIs. No POI list/write/import operation is declared.
- **Calculate:** C11 proximity and observed visits, using stored coordinates and a
  defined radius. POI names/categories and visit rules are our business records.
- **Show:** searchable POI table, map placement and a drawer for its fields;
  visit history links back to the source messages and selected period. The live
  list/editor exposes Address, Name, Description, Radius in meters, Color and
  View; the route selector also shows Fleet. A blank POI draft was canceled.
- **Condition:** this can be a holita feature without mirroring Karma's POI list.
  Import/export and sharing scope need a selected requirement, not an assumed API.

### R03 — Geofence

- **API:** `/location` for current positions and `/events` for available historical
  positions. No geofence management method is declared.
- **Calculate:** C11 inside/outside transitions and dwell for stored circles.
  The observed web list supports Name, Radius and Color; additional shapes were
  not established and are not required by this proposal.
- **Show:** map with circle/color, zone table and vehicle entry/exit/dwell history;
  a rule can refer to a stored zone if local notification processing is selected.
  The live Add new geofence action enters the notification wizard with the
  geofence section selected; W03 confirms this composition. Preserve the link
  between zone, targets, inside/outside condition and notification cycle.
- **Condition:** sampled transitions have timestamp/position resolution limits.
  They do not prove the physical crossing instant or reproduce vendor-generated
  geofence events. The sampled web list was empty.

### R04 — Stoppings

- **API:** `/events` stationary/state evidence, `/trips` for journey context and
  known address/coordinate sources.
- **Calculate:** C03/C04; count/sum stops exceeding the selected minute threshold.
  The live form defaulted to 15 minutes. The precise stop classifier and equality
  at the threshold were not established from the aggregate report.
- **Show:** duration filter, Total Stopping Time / Stoppings / Trips / Distance
  report and interval/map drill-downs. The inspected trip breakdown adds each
  trip's stopping count/time and a further stopping-detail affordance. The footer
  specifies start-day attribution; E26 prevents interpreting this as clipped
  calendar-day occupancy.
- **Condition:** a documented classifier is required for exact parity. This is
  a duration-filtered activity report, not evidence of another POI resource.

## Notifications: three functions

The raw event feed is an input to notifications. It does not expose a proven
notification ID, rule, recipient, delivery or acknowledgement model. Reproducing
these functions with our own logic requires persisted rules/results and server
processing; a browser-only view cannot deliver reliable background notifications.
No notification or message was sent during this research.

### N01 — List

- **API:** `/events`, `/cars` and `/drivers` supply source events and labels.
  Notification state comes from a supported vendor interface or our own records.
- **Calculate:** evaluate a selected local rule over received source data and
  record one notification occurrence with its source reference and current state.
- **Show:** Vehicle / Driver / Type / Description / Location / Time, as observed,
  plus explicitly local status when we own acknowledgement/delivery.
- **Condition:** do not treat an event row as a delivered notification or an
  acknowledgement. The web list was empty for the inspected selection.

### N02 — Report

- **API:** the N01 source reads and stored notification occurrences. No dedicated
  vendor notification-report endpoint is declared.
- **Calculate:** counts by rule/type/vehicle/driver/period and delivery or
  acknowledgement status only where recorded.
- **Show:** a vehicle/driver and period selector, then Vehicle, Driver, Type,
  Description, Value, Location, Time, Info/ACK and Status Remark, matching the
  inspected empty report. Add local filters/counts only over our recorded state.
  Reuse the same occurrences as the list.
- **Condition:** API event history cannot reconstruct past emails, app receipts or
  user acknowledgements that were never supplied to us.

### N03 — Create / Edit

- **API:** `/cars`, `/drivers` and our POI/zone references feed selection controls.
  No public method stores the vendor rule, recipients or schedule.
- **Calculate:** explicit trigger/threshold/duration, active schedule and selected
  channel rules. Delivery requires a separately chosen sender/channel integration.
- **Show:** the live List → Triggers → Cycles → Notify By → Summary workflow,
  limited to supported signals. Conditions can include comparison/value,
  sustained duration, dates/weekdays/time or Forever, message text, popup Info/ACK
  and color. The inspected Notify By step offered Email Message; do not advertise
  SMS availability merely because a historical guide or hidden template mentions it.
- **Condition:** create holita-owned rules or obtain an ERM rule-management
  contract. The device rule editor is a different workflow; do not repurpose its
  device writes for application email/push rules. The vendor's optional Command
  to Send Automatically field is a separate device-control capability and must
  not become an unrestricted text field in holita.

## Settings: twelve functions

### S01 — Drivers

- **API:** `GET /drivers`; later `POST /drivers`, `PUT /drivers/{id}` and
  `DELETE /drivers/{id}` only if writes are explicitly selected and permitted.
- **Calculate:** list filtering/grouping and reference lookups; historical
  assignment is not a computed substitute for an assignment contract.
- **Show:** identity/contact/company/fleet/vehicle details with a scoped editor.
  The live empty table also had birth date, driver ID, code, created and photo.
- **Condition:** declared writes cover names/phone/project, not every visible
  field or vehicle assignment. Obtain a nonempty driver schema and explain which
  fields would remain in holita. Existing local Fleet Drivers are not synchronized.

### S02 — Vehicles

- **API:** existing `/cars`, detail, `/projects` and `/time-zones`; documented car
  writes cover only the subset listed in the API section.
- **Calculate:** reference labels, assigned-driver count and local list filters.
  Do not infer an identity from registration or map every device ID to a Fleet IMEI.
- **Show:** reuse the current truck list/detail and source drawer. A later editor
  separates source-supported fields from holita-owned extensions. Observed web
  fields included VIN, transmission, fuel settings, SIM/camera details and photo.
- **Condition:** a richer web editor does not expand the documented PUT payload.
  No vendor car was created, updated or deleted in this work.

### S03 — Assets

- **API:** `/cars` may supply shared tracking facts, but `sub_type` and the sampled
  null `vehicle_type` do not establish a separate asset model or CRUD contract.
- **Calculate:** only group assets after their type/identity mapping is proven;
  current position/age can then use the same location reads.
- **Show:** the inspected Name, Description, Purpose, Address, Fleet, StarLink ID,
  Time Zone and Created list, plus View. The canceled blank editor confirmed these
  editable labels except Created. Map placement belongs to the same record.
- **Condition:** the empty list/editor establishes fields, not a nonempty API
  asset model. Do not guess classification from vehicle names or create duplicate
  records for trackers already represented as cars. W03 uses the richer internal
  vehicle-management workflow; that does not prove an API v2 asset type mapping.

### S04 — Fleets

- **API:** `GET /projects`, `/cars` for membership, and documented `POST /projects`
  for future creation. Update/delete operations are not declared.
- **Calculate:** vehicle counts grouped by source `project_id`; driver/user counts
  only from corresponding supported memberships.
- **Show:** fleet/project list and read detail with vehicles. The observed web
  table had Name and Created; the API supplies project ID/name, not a proven
  project-created timestamp. The live editor additionally has Notification
  Template and Units Convertor: Date, Hour, Week first day, Distance, Volume,
  Temperature and Air pressure. These are not application registrations.
- **Condition:** web Fleet and sampled API Project matched in E01. This does not
  authorize treating a provider Project as a holita Branch or making them identical.

### S05 — Users

- **API:** `/users`, `/roles`, `/projects` and `/time-zones` already have queries.
- **Calculate:** resolve source role/project/timezone references and filter the
  loaded user list. Preserve numeric active flags and source expiry values.
- **Show:** current account table/detail with memberships and source role text.
  The inspected classic editor includes Allow Sending Commands, fleet references
  for units and applications, timezone, country and expiry. Those settings must
  not silently become holita authorization grants.
- **Condition:** user editing, role assignment, invitations and membership changes
  need another vendor contract or a separate holita identity workflow. Role text
  is not a machine-readable authorization policy.

### S06 — Hierarchy

- **API:** `/projects` + `/cars` reconstruct a project → vehicle grouping;
  `/location` supplies last-known report data.
- **Calculate:** tree counts and last-reported age. First transmission cannot be
  recovered from a latest batch; a locally recorded first-seen time has a
  different meaning. Deeper subgroup membership is not supplied by a flat project list.
- **Show:** expandable fleet/vehicle tree with counts and available transmission
  facts. Name, First Transmission, Last Transmission and export were observed.
- **Condition:** basic grouping is feasible now. Source-first timestamps and
  arbitrary hierarchy synchronization remain unproven; permission inheritance
  was not established by this screen.

### S07 — Fuel records

- **API:** `/cars`, `/trips` and `/edata` provide context; there is no public
  fuel-receipt CRUD or attachment method.
- **Calculate:** sum recorded volume over the selected period; compare receipts
  with measured/estimated consumption without equating them. C07 cost needs an
  actual price/amount source.
- **Show:** per-vehicle Date / Volume / Odometer / Location / Receipt table and
  drawer, matching the inspected live editor. Attachments would be our stored
  business documents if this local feature is selected.
- **Condition:** our records can reproduce the workflow; they will not appear in
  Karma unless a separate supported synchronization contract exists. Research
  opened/canceled a blank form and retained the empty source list.

### S08 — Maintenance

- **API:** car/odometer reads are context. No public vendor maintenance CRUD exists.
  Reuse the existing local Fleet service-task workflow where its fields fit.
- **Calculate:** C13 due-by-date/due-by-odometer and history/cost only from recorded
  service facts. Device telemetry is not evidence that a service was performed.
- **Show:** current/next date, current/next odometer, service type, location,
  comment and receipt; calendar/due list and a linked service history. The live
  empty table and canceled editor also revealed a Replaced Parts field that is
  not a list column.
- **Condition:** source identity and Tenant/Branch ownership must be explicit
  before associating local Fleet service tasks with shared Karma cars.

### S09 — Tires

- **API:** car/odometer reads provide usage context; no tire CRUD/placement/history
  method is declared. Sensor readings would require separately proven hardware/data.
- **Calculate:** C13 accumulated mileage across fitment segments; replacement
  dates and any measured pressure remain recorded facts.
- **Show:** vehicle tire-position diagram, tire/spare list and fitment history.
  The inspected diagram has axle-side positions and Spare. Its unsaved Edit Tire
  form offers Tire Type, Tire Size, Tire Odometer and Vehicle Odometer in km,
  Replace By, Air pressure in PSI and Replaced Date, plus Save/Cancel/Delete.
- **Condition:** this is a potential local business feature, not automatic TPMS
  or vendor tire synchronization. Define the actual supported vehicle layout first.

### S10 — Questions report

- **API:** `/users` can label users. No query-history/count/last-access method is
  declared in API v2.
- **Calculate:** if holita query-use reporting is selected, count its own recorded
  searches/reports by user/period and show last observed access. Provider totals
  cannot be calculated from vehicle telemetry.
- **Show:** user/period selector and User / Questions / Last Access table, as
  observed. Detail/audit retention requires an explicit requirement; do not
  retain private free-text queries merely to reproduce a count.
- **Condition:** vendor history needs an additional interface. This is not the
  saved-filter/shortcut feature; the initial catalog's guess was superseded.

### S11 — Disconnected

- **API:** `/cars`, latest `/location` or appropriate `/events` contact evidence.
- **Calculate:** C12 source age, with a selected local staleness threshold.
  A provider connection-state flag/event would be preferable for exact equivalence.
- **Show:** vehicles ordered by last report time and age, available last position
  and a clear stale/missing-data state.
- **Condition:** exact Karma timeout/state semantics were not established.
  Ignition off, sleeping tracker, absent CAN and disconnected tracker are different.

### S12 — Telemetry application configuration

- **API:** `/cars` and `/projects` label the selection; `/events` or `/sensors`
  can supply readings only after the selected module's payload is identified.
  No public API v2 application-definition CRUD or event-alias contract is declared.
  W03 contains internal `GetApplications`, `GetApplicationTypes`,
  `GetApplicationValues`, `SaveApplication` and application-report operations.
- **Calculate:** module-specific counts, durations and value series from proven
  readings. Weight/pressure/digital states and DTC code collections are different
  models. A user-configured label/unit is not proof of a raw sensor's scaling.
- **Show:** Name/Fleet/Last Update list and Application → Fleet & Vehicles →
  Rename → Summary wizard. The six offered modules are Weight, IO Extender, DTC,
  ePoly, StarLink Inputs and eMix; icon/category and description are configurable.
  A DTC draft exposed Confirmed, Current and Permanent Trouble Codes and Live Event,
  each with selection/rename/unit fields. It was canceled before Finish.
- **Condition:** the account has no saved applications, so populated module
  dashboards were not available. For holita, expose only proven module signals,
  reuse the separate diagnostic-contract investigation for actual DTC layouts,
  and keep any local display definitions explicitly local. Do not build an OAuth
  client registry from this menu or equate it with the Battery/Starter report.

## Shared views and the proposed holita presentation

These functions span menu entries and reuse existing views rather than producing
36 disconnected business screens.

### X01 — Fleet map and vehicle sidebar

- **API:** cars/projects plus a specific bulk-location read; E11 verifies a
  two-car POST read. Current GraphQL only exposes single-car location.
- **Calculate:** counts from the loaded selection, source age and marker grouping.
  Status colors need their actual state definition; speed zero is insufficient.
- **Show:** searchable project/vehicle list beside a clustered map; select a row
  or marker to open the same vehicle header/details. Keep per-vehicle source times.
- **Condition:** existing holita point/endpoint map previews are reusable. A true
  multi-marker map, traffic and Street View require an appropriate map-provider
  interface; a directions iframe is not the same capability.

### X02 — Historical map, trip details and activity timeline

- **API:** `/trips` start/stop references and available `/events`/`/edata` positions.
- **Calculate:** order real source positions by time/identity; C03 supplies proven
  activity intervals. No geometric interpolation establishes an actual driven route.
- **Show:** trip list → existing detail drawer → actual available points/events.
  A synchronized time selection can link rows, charts and markers.
- **Condition:** the existing suggested start-to-stop driving route is provider
  directions, not a historical GPS trace. Source density and history completeness
  were not proven for a whole day. The inspected web map mixed a live Status
  panel with historical activity; our UI should identify each time context.

### X03 — Vehicle widget and current status

- **API:** `/location`, `/trips`, `/edata` and verified state records. Weather has
  no declared API v2 method and would require another source.
- **Calculate:** latest speed/selected odometer, C01 month distance when complete
  and C12 source age. The historical guide describes TM as month totals and T1
  as a start-point/session counter; exact current widget behavior was not verified.
- **Show:** compact, labeled values with source time rather than relying on a
  dial alone. Battery, fuel, engine and communication facts remain separate.
- **Condition:** no guessed Eco grade, battery health or ignition flag. Manual
  counter/odometer changes require their own supported workflow.

### X04 — eData and condition charts

- **API:** the existing `/edata` query with parameter IDs and UTC period, plus
  explicitly supported additional event/location fields.
- **Calculate:** C06/C08/C09 only for identified sources and covered intervals.
- **Show:** reuse the eData message/parameter list and source drawers; add selected
  parameter series and latest-value cards. Keep thirteen observed IDs as metadata,
  not a universal supported-parameter dropdown or per-vehicle capability guarantee.
- **Condition:** preserve null/zero, original IDs and source descriptions. Extending
  structured eSafe/voltage fields needs SDL/operations changes in a later session.

### X05 — Search, filters and saved shortcuts

- **API:** translate supported entity/period/type/threshold selections to the
  fixed methods listed above. No arbitrary REST path or device command input.
- **Calculate:** deterministic parsing/reference resolution for supported terms;
  expose the interpreted selection so ambiguous periods/entities are visible.
- **Show:** existing structured filters first, optional text-query entry and saved
  report/filter shortcuts. A saved shortcut stores the selection, not frozen totals.
  The live Shortcut wizard labels Icon → Question → Report → Summary. The direct
  Create Shortcut path prefills the current report; W03 deliberately disables
  Next in that path rather than requiring a second report selection.
- **Condition:** vendor shortcut management and scheduled reports are not exposed by public API v2.
  Local shortcuts can reproduce the convenience; an AI service is not required.
  W03 stores shortcuts through internal `UserData_*` operations and contains
  email/relative-period configuration plus `GETMAILREPORTDATA`. These are not
  public API v2 methods. Scheduling/email is a separate backend capability, not a
  browser timer; no schedule, recipient or shortcut was saved.

### X06 — Reports, print and exports

- **API:** the same identified data used by the current filtered view; no vendor
  PDF/Excel generator is necessary for our own exports.
- **Calculate:** C14. Use one result definition for table/chart/export so their
  scope and totals agree. Distinguish loaded rows from the complete period.
- **Show:** shared vehicle/driver/period filters, KPI strip, sortable table,
  relevant chart, row drawer/map action, Print and selected export actions.
- **Condition:** vendor controls were observed, but export files were not downloaded
  or compared. Full-history export requires a proven bounded retrieval strategy.

### X07 — Preferences, permissions and owned data

- **API:** timezones/projects/users/roles provide reference values; no generic
  vendor preference or membership-update method is declared.
- **Calculate:** display conversion only after canonical source units/timezone are
  known. Keep original values in source details. The live Fleet editor, not the
  Application menu, supplies the observed unit/date-format preferences.
- **Show:** reuse BG/EN catalogs, current themes and existing settings patterns.
  A user must be able to tell whether an edit is saved in holita or sent to Karma.
- **Condition:** shared Karma account data remains available under its current
  signed-session scope, without a Branch filter. New local rules/records must use
  verified Tenant/Branch ownership and explicit source identity association. No
  automatic account/project/Branch or driver identity mapping is established here.

### X08 — Device settings, command status and DTCs

- **API:** existing fixed internal configuration operations use selected event
  reads and `POST /commands`; queue reads are a possible separate extension.
- **Calculate:** the existing persisted preflight/submission/readback lifecycle,
  not a new optimistic success calculation from an HTTP response or queue state.
- **Show:** reuse Device settings and the current operation/verification views.
  DTC interpretation follows the separate protocol investigation and confirmed
  fault layouts, not the Battery/Starter menu.
- **Condition:** no new parameter/rule/global/profile/reset command is authorized
  by this report. GET device-query parameters must not be treated as passive history.

### X09 — Input and sensor names and operator controls

- **API:** public `/events`, `/location` and `/sensors` can supply proven states
  and measurements, but do not expose the web's alias-management contract. W03
  references `getCarInputsAndSensors`, `RenameCarInAndSensNames`,
  `RenameCarOutputs`, `SetOdometer`, `SetOutputOn` and `SetOutputOff` internally.
- **Calculate:** decode only established bit/state definitions and calibrated
  readings. Display aliases are metadata, not evidence of channel presence.
- **Show:** the live widget's Input / Sensor section and Rename dialog identify
  Input 1–4, Ignition, Engine and Sensor 1–8. A local alias editor could preserve
  raw channel identity beside the chosen label. Four Temperature report channels
  do not establish that these eight sensor slots are populated or equivalent.
- **Condition:** the rename dialog was closed unchanged. Output switching,
  odometer correction and command sending are consequential operations, not
  telemetry reads. Source references alone are not evidence that this account
  has connected actuators or may safely operate them; none was activated.

## Screen and action coverage

This matrix distinguishes an opened screen or control from a completed business
operation. The report's API/calculation/UI cards remain the reproduction recipes.
Common sorting/filter/search/paging and export controls were inventoried, not
exhaustively exercised for every column, value, file format and record type.
An empty selection is not a successful populated-detail test.

| Function           | Opened or inspected safely                                                                            | Not executed or not demonstrated                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| V01 Summary        | Selected-day report; Trips Details; Parking Details; max-speed link to map; View affordance.          | Exact time/average formulas, every chart/map interaction and exports.                            |
| V02 Distance       | Report; Trips by Distance with share, duration, places/times, estimated cost and day/night distance.  | Exact cost configuration/rounding and export contents.                                           |
| V03 Parking        | Report; Parking by Duration and Parking by Count grouped tables; location/hour map-chart views.       | Exact location grouping, state classifier and boundary attribution.                              |
| V04 Fuel           | Report and Trips Details; fuel-used/event cells blank in sample; View affordance.                     | Real refuel/theft records, calibrated fuel graph and media.                                      |
| V05 Odometer       | Start/end/total/trips report; Trips by Distance, odometers, duration and shares.                      | Any odometer correction or counter reset.                                                        |
| V06 Engine Hours   | Report; Engine On Details with duration/share, places/times, day/night duration and distance.         | Complete ignition classification and counter/duration equivalence.                               |
| V07 Temperature    | Empty four-sensor report; Export Details control.                                                     | Populated channel graph/detail or exported samples.                                              |
| V08 Diagnosis      | Battery/Starter report; double-click produced no additional populated detail.                         | Battery-life/starter algorithms, historical chart payload and device diagnostics.                |
| V09 Accident       | Empty report with Vehicle, Driver, Notification Type, Type, Where, Time and Accident Details.         | Actual accident detail/download, black-box ID discovery or device accident-data request.         |
| V10 Camera         | Vehicle/Total Camera Events/Trips report; Trips Details and View.                                     | Camera event total was blank; no actual image, clip, playback or live stream.                    |
| D01 Summary        | Empty driver selector; period, Report, View and Create Shortcut.                                      | Populated driver results and drill-downs.                                                        |
| D02 Distance       | Empty driver selector; period, Report, View and Create Shortcut.                                      | Historical driver grouping and populated detail.                                                 |
| D03 Parking        | Empty driver selector; period, Report, View and Create Shortcut.                                      | Driver parking attribution and populated detail.                                                 |
| D04 Speed          | Empty driver selector; period, Report, View and Create Shortcut.                                      | Populated speed/violation results.                                                               |
| D05 Behavior       | Empty driver selector; period, Report and Create Shortcut; no View on this form.                      | Driver maneuver/score results.                                                                   |
| D06 Eco Driving    | Empty driver selector; period, Report and Create Shortcut; no View on this form.                      | Driver grade/ranking and weighting.                                                              |
| D07 Working Hours  | Empty driver selector; date/weekdays plus From Time/To Time; Report only.                             | Work/rest results or compliance semantics.                                                       |
| R01 Route Planning | Empty list; five-stage wizard; name/dates/vehicle and Start Place; Notifications option.              | End/intermediate places and advised route require saved POIs; Finish not used.                   |
| R02 POI            | Empty list; Add editor, radius/unit/color and View; canceled and empty list rechecked.                | Saved placement, visits, edit/delete of an existing POI or imports.                              |
| R03 Geofence       | Empty list; Print/Delete/View controls; Add enters geofence notification flow.                        | Saved zone geometry, entry/exit/dwell results and deletion.                                      |
| R04 Stoppings      | Threshold/period form; report and Trips Details with stopping count/time and further detail controls. | A populated standalone stopping-event detail was not established; exact classifier remains open. |
| N01 List           | Empty list; vehicle/driver selection, Print/Edit and export icons.                                    | Existing notification Edit/ACK/status action and delivery.                                       |
| N02 Report         | Selected-period empty report; Value, Info/ACK and Status Remark columns.                              | Historical notification occurrences, treated status or delivery reconciliation.                  |
| N03 Create / Edit  | Empty rule list; five-stage wizard through Notify By; 24 trigger families and speed-condition editor. | Summary/Finish, actual delivery, automatic commands, modification/deletion of a saved rule.      |
| S01 Drivers        | Empty list and blank rich editor; canceled.                                                           | Saved driver/photo/assignment or deletion.                                                       |
| S02 Vehicles       | Ten-row inventory and existing rich editor; canceled unchanged.                                       | Create/update/delete, photo upload, assignment or hardware changes.                              |
| S03 Assets         | Empty list and blank editor; canceled and empty list rechecked.                                       | Nonempty asset model, saved tracker/placement or deletion.                                       |
| S04 Fleets         | Fleet list and editor including unit/date preferences and notification template; canceled.            | Creation, preferences save, template change and deletion.                                        |
| S05 Users          | User list and editor including Allow Sending Commands; canceled unchanged.                            | Identity, role, fleet, command permission or expiry changes.                                     |
| S06 Hierarchy      | Fleet/vehicle tree and Name/First Transmission/Last Transmission/Export controls.                     | Arbitrary deeper hierarchy and first-transmission API equivalence.                               |
| S07 Fuel records   | Vehicle/day selector, empty receipt table and canceled blank editor.                                  | Receipt/image upload, save/edit/delete and real receipt reconciliation.                          |
| S08 Maintenance    | Empty history and canceled editor including Replaced Parts.                                           | Saved due service, attachment, parts or existing-history edits.                                  |
| S09 Tires          | Vehicle selector, axle/side diagram, Spare and Edit Tire fields; closed unchanged.                    | Tire placement/change/delete, mileage history and actual pressure readings.                      |
| S10 Questions      | User/period selector and empty User/Questions/Last Access report.                                     | Query detail/history graph; no private query transcripts extracted.                              |
| S11 Disconnected   | Empty Vehicle/Driver/Fleet/Created By/Time/Address table and Print/View controls.                     | Exact disconnection threshold, recovered connection or a populated detail.                       |
| S12 Application    | Empty list; six-module wizard through DTC Rename/Unit stage; canceled.                                | Finish, live configured-module dashboards or vendor synchronization.                             |

### Detail calculations and navigation

The safe drill-downs add the following requirements to the parent cards:

- **Trip detail:** preserve source identity and start/end times/places, distance,
  reported duration and maximum speed. Some tables also have day/night distance,
  estimated cost, parking or stopping values. Use `/trips` for its actual fields;
  do not manufacture the missing extended columns from a report label.
- **Shares:** use C15 with the parent selection's actual denominator. A share of
  distance is not a share of time, and a location's count share is not its duration
  share. Missing/zero denominators remain unavailable rather than misleading 0%.
- **Parking groups:** the inspected grouped tables had Duration or Count, `%`,
  Where and View. Their number of locations need not equal their number of
  parking intervals. The vendor's spatial grouping rule remains unknown.
- **Engine detail:** its independently classified intervals cannot be replaced by
  the nine-trip set merely because both offer a map View button.
- **Start-day reports:** E26 requires a deliberate attribution mode. To calculate
  complete attributed intervals from raw events, retrieve the preceding state and
  the eventual closing transition as needed; a query limited to midnight bounds
  can be insufficient. An unfinished interval and a retrieval timeout are not zero.
- **Map actions:** row View, maximum-speed and last-trip affordances reuse a
  shared map/detail context. Our version should visibly retain the selected
  record, date/timezone and live-versus-history mode. The observed live widget
  can change while a historical report selection remains visible.
- **Export actions:** classic reports show Print/PDF/Excel and Temperature also
  Export Details. W05's NC2 table Export calls client-side CSV export. Available
  controls and source code establish format intent, not verified file contents,
  pagination completeness or parity of attachment/media exports.

## Internal classic web methods and public API alternatives

W01 configures the classic web endpoint as the current origin plus `/i/`; W02
configures POST JSON-response requests, while W03 supplies operation selectors.
NC2 independently points to the same base URL in W04. This is **not**
`/apiv2/`: these web requests use `qT` operation names and a web-session field,
whereas the public integration uses its API v2 session contract.

The names below are static client references. They were not replayed manually,
their payload/response/permission contracts were not validated, and some report
families have several variants. Exact naming/case, including vendor misspellings,
is preserved. The public alternative column points to the methods proposed for
holita; **internal** is not a recommendation to expose arbitrary `qT` dispatch.

| Function  | Internal source-only operation family                                                                                                                                   | Public API v2 alternative or gap                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| V01 / D01 | `report_general`, `report_general_trip`, `report_general_park`, `report_general_idle`, `report_general_graphs`                                                          | `/trips` + verified `/events` intervals; no exact aggregate-report contract.                                              |
| V02 / D02 | `report_distance`, `report_distance_trips`                                                                                                                              | `/trips` sums; cost needs explicit configuration.                                                                         |
| V03 / D03 | `report_park`, `report_park_by_time`, `report_park_by_count`                                                                                                            | Verified `/events` intervals and spatial groups; source classifier still needed.                                          |
| V04       | `report_fuel`, `report_fuel_events`, `report_fuel_trips`, `report_fuel_graph`                                                                                           | `/edata`, `/sensors`, known `/events` types and `/trips`; calibrated dedicated fuel-report parity is unproven.            |
| V05       | `report_odo`, `report_odo_trips`; separate `SetOdometer` action                                                                                                         | `/location`, `/trips`, selected `/edata`; no public odometer-write field.                                                 |
| V06       | `report_engine`, `report_engine_trips`                                                                                                                                  | State `/events` and separate engine-counter `/edata`.                                                                     |
| V07       | `report_temperature`, `report_temperature_graph`, `report_temperature_trips`                                                                                            | `/sensors`; CAN temperatures remain separate `/edata` signals.                                                            |
| V08       | `report_batteryStarter`, `report_batteryStarter_history`                                                                                                                | Proven voltage fields/parameters only; other algorithms/sources absent.                                                   |
| V09       | `report_accident`, `report_accident_detailed`                                                                                                                           | Known `/events` reference then `/black_box/{id}`; discovery/model missing.                                                |
| V10       | `report_camera`, `report_camera_events`, `report_camera_events_graph`; `camera_alarm_info`, `camera_online`, `camera_video_file_info` helpers                           | Known `/events` and real car video metadata; no public live/recorded-media retrieval.                                     |
| D04       | `report_speed`, `report_speed_trips`                                                                                                                                    | `/trips.max_speed`, `/events` speed/verified overspeed types plus attribution.                                            |
| D05       | Behavior/score candidates include `report_profile`, `report_profile_trips`, `report_profile_trips_maneuvers`, `report_safety`, `report_score` and detailed variants.    | `/events?decode=1`, `/driving-profile`; these internal families are not a proven one-to-one driver-grade mapping.         |
| D06       | `report_eco`, `report_eco_trips`                                                                                                                                        | Source trip eco/profile values, without invented combined ranking.                                                        |
| D07       | `report_workingHours`, `report_workingHours_trips`, `report_working_detail`, `report_working_totals`                                                                    | Attributed trip/state activity; actual shift/rest semantics require another contract.                                     |
| R01       | `GetRoutesPlanning`, `SaveRoutePlanning`, `DelRoutePlanning`                                                                                                            | No route-plan CRUD; local plans plus a selected routing provider.                                                         |
| R02       | `GetInterestPlaces`, `SaveInterestPlaces`, `DelInterestPlaces`                                                                                                          | No POI CRUD; local scoped records and position-based calculations.                                                        |
| R03       | `GetGeozones`, `SaveGeozone`, `DelGeozones`, `NotificationsEdit_GetTriggersByGeozone`                                                                                   | No zone/rule CRUD; local zones and notification processing if selected.                                                   |
| R04       | `report_stoppings`, `report_stoppings_events`, `report_stoppings_trips`, `report_stoppings_trips_events`                                                                | Verified state/position `/events` with `/trips` context and explicit attribution.                                         |
| N01       | `Notifications_GetPerformsByCarID`, `Notifications_GetPerformsByRelatedID`, `Notifications_GetPerformsCount`, `Notifications_UpdatePerform`                             | Event feed does not include notification delivery/ACK/remark state. Use local occurrences or a supported vendor contract. |
| N02       | `report_notificationstypes`, `report_notificationstypes_events`, `Notifications_GetPerformsTypes`, `Notifications_GetPerformsSubFleetTypes`                             | No public notification report/history interface.                                                                          |
| N03       | `NotificationsEdit_Get`, `NotificationsEdit_CreateNew`, `NotificationsEdit_Update`, `NotificationsEdit_Delete`, `NotificationsEdit_DeleteTrigger`; trigger dictionaries | `/cars` and `/drivers` label choices; no rule/recipient/schedule CRUD.                                                    |
| S01       | `GetDrivers`, `SaveDriver`, `DelDriver`                                                                                                                                 | Declared driver reads/writes cover a smaller field subset; assignments/photos remain gaps.                                |
| S02       | `GetCars`, `CarInfo`, `SaveCar`, `DelCar`, `GETCARIMAGE`                                                                                                                | `/cars` and declared narrow writes; no complete rich-editor/photo contract.                                               |
| S03       | Industry/asset metadata uses the internal vehicle-management family, including `DelCar`.                                                                                | `/cars` type mapping is not proven for a populated asset. Do not invent another public resource path.                     |
| S04       | `SaveProject`, `DelProject`, `GetUnitsConversion`, `GetNotificationTemplates`                                                                                           | `/projects` read/create only; update/delete, conversions and templates need a supported contract.                         |
| S05       | `GetUsers`, `SaveUser`, `DelUser`                                                                                                                                       | `/users`, `/roles`, `/projects`, `/time-zones` reads; no user/permission mutation.                                        |
| S06       | `getUserHierarchy`                                                                                                                                                      | `/projects` + `/cars` for basic grouping only.                                                                            |
| S07       | `ManualData_Fuel_Get`, `ManualData_Fuel_Add`, `MANUALDATA_FUEL_DEL`, `ManualData_Fuel_GetImage`                                                                         | No receipt CRUD/image method; holita-owned records are independent.                                                       |
| S08       | `ManualData_Service_Get`, `ManualData_Service_Add`, `MANUALDATA_SERVICE_DEL`, `ManualData_Service_GetImage`                                                             | No vendor maintenance CRUD; reuse suitable local Fleet service tasks.                                                     |
| S09       | `GetTires`, `SaveTire`, `ChangeTirePosition`, `DelTire`                                                                                                                 | No tire CRUD/fitment interface.                                                                                           |
| S10       | `GetUsersQuestions`, `GetUserQuestionsDeatails`, `GetUserQuestionsGraph`                                                                                                | No query-audit API. `/users` supplies labels only.                                                                        |
| S11       | `GetUnconnectedCars`                                                                                                                                                    | Source age from `/location` is an explicitly local approximation, not this server classifier.                             |
| S12       | `GetApplications`, `GetApplicationTypes`, `GetApplicationValues`, `SaveApplication`, `DelApplication`, `Report_ApplicationEvents` and event/trip variants               | No application-definition/alias CRUD. Module payloads must be proven independently.                                       |
| X01–X03   | `BaseSync`, `CarMarkerInfo`, `CarInfoPlus`, `FocusCar`, `Trip`, `TripByEventId`, `TRIPBYMAXSPEED`, reverse-geocoding helpers                                            | Bulk `/location`, `/cars`, `/trips`, source positions and a selected map/geocoding provider.                              |
| X05       | `UserData_Get`, `UserData_Add`, `UserData_Set`, `UserData_Del`, `GETMAILREPORTDATA`                                                                                     | No shortcut/schedule API; local saved selections and separately implemented delivery.                                     |
| X09       | `getCarInputsAndSensors`, `RenameCarInAndSensNames`, `RenameCarOutputs`, `SetOutputOn`, `SetOutputOff`                                                                  | Reading proven states is distinct from alias writes and actuator control.                                                 |

This discovery makes an ERM-supported richer integration plausible, but does not
establish that undocumented web calls are stable or licensed for external use.
The smallest supported approach remains public API data plus explicitly owned
holita workflows. For exact vendor synchronization, obtain ERM's contract before
choosing an internal operation instead of guessing its inputs from the client.

## NC2 technical console

The [NC2 login](https://karma.online/nc2/login) presents the title Camel. The saved
website credentials worked in its own login form. A route contains a user ID;
those account-specific URLs are deliberately omitted. W04 constructs an internal
login operation and retains NC2 session data separately from the classic page.
No API v2 session, identity-provider equivalence or equal privilege model follows
from using the same website credential pair.

### K01 — Users and user administration

- **Observed:** Users has Active, User ID, Username, Full Name, Created, Expires
  and Last Login, plus row number. A user-detail dialog exposes Activation,
  Edit User and Change Password. Edit fields include first/last name, email,
  role, expiry and timezone. Nothing was edited, activated or submitted.
- **Internal source:** `KC_GetUsers`, `KC_GetUser`, `KC_GetRoles`, `GetTimeZones`;
  `KC_ToggleUserActivation` and `SaveUser` are consequential mutations.
- **Public API:** `/users`, `/roles`, `/time-zones` provide only their observed
  reference models. No public activation/password/user-edit operation exists.
- **Calculate and show in holita:** source-user list and resolved references can
  reuse current account views. Last Login requires its actual source; do not
  replace it with telemetry time or query Last Access. Local identity management
  is a separate security workflow, not a clone of vendor roles. Password changes
  and permission expansion are outside this research.

### K02 — Vehicles and hardware inventory

- **Observed:** ten rows; Vehicle ID, Fleet, License Plate, Driver ID, Name, Make,
  UnitID, Firmware, eFuel, eSafe, Hardware, Last Transmission and Engine On,
  with row number and selection checkboxes. Double-click opens technical detail;
  ordinary cell interaction can copy a value to the clipboard.
- **Internal source:** `KC_GetCars`; client/car selection and basic information
  also reference `KC_GetClients` and `KC_BasicInfoByCarID`.
- **Public API:** `/cars`, `/projects` and `/location` cover proven identities,
  grouping and last-known facts. The richer firmware/hardware inventory is not
  established by the current public car DTO; do not infer it from make/model.
- **Calculate and show in holita:** selection counts, filtered inventory and
  source age; separate tracker firmware, eFuel/eSafe versions and hardware model
  when a real supported source is supplied. No version comparison should imply
  that a firmware upgrade is available or authorized.

### K03 — Recent event monitor

- **Observed:** vehicle detail's Send Command tab includes a recent-event grid:
  Time (GMT), Number Message, EID, Position Time (PDT), Latitude, Longitude,
  SPDK, ODO, CSS, VIN, VBAT, BATC and BATH. Refresh, search, column selection and
  export controls are present. The visible recent batch is not full history.
- **Internal source:** `KC_LastEvents`; other feature-source history references
  include `KC_GetEvents`. These are not API v2 aliases with established schemas.
- **Public API:** `/events` with supported fields, and `/location` for a current
  point. Some additional NC2 columns still need actual field/unit confirmation.
- **Calculate and show in holita:** preserve source message identity and both
  clocks, decode only proven fields and calculate source age independently.
  Extend the existing event table/source drawer rather than creating another
  telemetry store. Keep command composition outside the read-only monitor.

### K04 — Incoming diagnostics and cached parameters

- **Observed:** Diagnostics is an empty Time (Local)/MT/RefNum/Data table.
  Parameters has populated ID/Modified/Value rows. Opening these tabs showed no
  Send action or progress workflow; no refresh/device-read command was pressed.
- **Internal source:** `KC_LastIncoming` and `KC_GetParameters` respectively.
- **Public API:** no proven equivalent for these complete cached NC2 models.
  Selected `/events` extra payloads may contain independently documented device
  responses. Public `/parameters?query=...` is a device-query mechanism and must
  not be substituted as an ordinary cached read.
- **Calculate and show in holita:** display cached observation time and raw
  parameter identity/value only with its catalog/definition; never interpret
  every parameter ID as an eData measurement ID. Reuse persisted, controlled
  device-read evidence when appropriate. An empty Diagnostics table establishes
  neither OBD/DTC payloads nor the meaning of every MT/RefNum combination.

### K05 — CMD and command catalog

- **Observed:** CMD opens the command/vehicle technical workflow. The visible
  catalog had 27 options covering eFuel, eSafe, eData and Dome: version/settings/
  diagnostic reads as well as reset/default/delete operations. SEND was not used;
  no command was selected for dispatch. Raw command payloads are not reproduced here.
- **Internal source:** `GetCommandsPairs` and `SendCommand`. A separate legacy
  source helper spells the catalog `GetCommandPairs`; no equivalence was tested.
- **Public API:** `POST /commands` and subsequent source responses/queue state
  are the relevant family, not a read-only business query. Only already approved
  fixed Fleet operations should remain available in holita's current design.
- **Calculate and show in holita:** the existing persisted command intent,
  preflight/submission/readback lifecycle, with observation evidence and clear
  uncertain outcomes. Do not add a generic command text box, automatically replay
  an uncertain send, or expose reset/delete/default actions merely for visual parity.

### K06 — Statistics and shared grid tools

- **Observed:** Start Date, End Date and Select Unit ID → Search; Clear All.
  A completed-day/unit query returned an empty table with Unit ID, Server Answer,
  Recieved, Compressed From Recived and Dicompressed, preserving the UI spelling.
  This is transport statistics, not trip distance or fuel usage.
- **Internal source:** `KC_Statistics`; the NC2 service code sends a date-only
  start and advances the selected end date by one day. That implementation detail
  does not establish API v2 date-bound semantics.
- **Public API:** no transport/server-compression statistics endpoint is declared.
  Counting a downloaded event page would not reproduce these server counters.
- **Calculate and show in holita:** an equivalent requires provider counters or
  explicitly local transport instrumentation. Preserve source counters; calculate
  ratios only after units and denominators are defined. Current empty data does
  not support a compression percentage or delivery-success rate.
- **Shared tools:** Users, Vehicles, event/diagnostic/parameter tables expose
  search, configurable columns, Clear Filters, paging and Export as applicable.
  W05 implements the common Export as CSV. NC2 windows can be closed/resized/
  maximized where offered. Reproduce these as normal shared table/dialog behavior,
  not dedicated API methods; file contents and maximum export scope were not tested.

### NC2 source-only capabilities outside the visible menu

W05 also ships the following operation families. They were not visible top-level
destinations for the supplied account and were not opened by constructing hidden
routes, requesting broader accounts or invoking their operations.

| Source-only capability           | Internal selectors                                                                                                                     | Public API and reproduction condition                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuration presets            | `KC_GetConfigPresets`, `KC_GetConfigPreset`, `KC_AddConfigParam`, `KC_SetConfigParam`, `KC_DeleteConfigParam`, `KC_ApplyConfigPreset`  | No public preset CRUD/apply contract. Not equivalent to the existing single-rule/parameter edit. Requires a separate scoped requirement and device-write approval.               |
| Firmware operations              | `KC_GetAvailableVersions`, `KC_UpgradeStatus`, `KC_FirmwareUpdate`                                                                     | No public firmware-update workflow. A source label does not establish compatible firmware or permission; no version/upgrade action was invoked.                                  |
| Project references               | `KC_GetProjects`                                                                                                                       | `/projects` can reproduce its proven basic ID/name reference only; no richer NC2 response was probed.                                                                            |
| Notification monitor             | `GetNotifications`, `GetNotificationsByNumber`                                                                                         | No proven public notification-history model; event pages cannot supply delivery/ACK state.                                                                                       |
| Billing and price administration | `GetUserBillingTree`, `GetUserBillingTreeByUserID`, `GetPartnerUserNames`, `EditBillingPrice`                                          | No public billing API. These are sensitive commercial records and a price mutation; no data was requested or changed. Local billing would be an independently specified feature. |
| Summaries and invoices           | `GetSummaryReport`, `GetSummaryReportByUserID`, `GetProjectsSummayReport`, `GetProjectInvoice`, `GetUserInvoice`, `GetInvoiceByUserID` | Client references, not observed reports or financial facts. No public equivalent or verified calculation/schema; no invoice action was executed.                                 |

Consequently the account-visible NC2 inventory is complete at its four top-level
destinations, but global NC2 product completeness cannot be claimed from this
role. The source-only table makes those potential gaps explicit without promoting
them into working features or attempting privilege escalation.

## Notification trigger families

The live condition accordion contains **24 families**. These are selectable web
concepts, not an API v2 event dictionary: a trigger item's HTML ID must not be
passed as an `event_type` solely because both are numbers. W03 separately refers
to camera, eData, DLT and StarLink trigger dictionaries.

| Family                   | Observed condition choices                                                                                                                                           | Public data and calculation needed for holita                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Accident                 | Real Accident Notification; Accident Suspicious                                                                                                                      | Proven accident event/reference and, where available, `/black_box/{id}`. Suspicion is not a confirmed accident.           |
| Battery                  | Voltage, charge, life                                                                                                                                                | Proven voltage fields or actual charge/health source; do not derive all three from voltage alone.                         |
| Camera Events            | Fatigue, phone call, smoking, distraction, abnormal driving, seat belt, camera blocked                                                                               | Mapped camera `/events` payloads; an event is separate from downloadable media.                                           |
| Canbus Events            | Disconnected, wake/sleep while ignition off, IDX finish                                                                                                              | Proven CAN state/event dictionary and source time. Missing eData alone is not a disconnection.                            |
| Disconnected From Server | Disconnected From Server                                                                                                                                             | Exact server status contract or explicitly local freshness threshold.                                                     |
| DLT Events               | Workday start/end/exceeded, trip start/resume/duration exceeded, parking start                                                                                       | Actual DLT state/events. Do not infer tachograph/work-law compliance from trip duration.                                  |
| DTC                      | Confirmed, Current, Permanent Trouble Codes                                                                                                                          | Proven diagnostic payload/layout; not the Battery/Starter screen or an arbitrary eData number.                            |
| eData Rules              | eData Rule                                                                                                                                                           | Identified rule-result events and rule identity. Configuring a device rule is a separate write.                           |
| eMix                     | Stopped, mixing, unloading, missing sensors, fault, power up                                                                                                         | Actual mixer state payload; do not classify a generic engine RPM series as a mixer.                                       |
| ePoly                    | POI-area enter/exit/stay and car-speed exceedance                                                                                                                    | Proven source events or explicitly local geometry/threshold rules; ePoly configuration is not established.                |
| Fuel                     | Refuel/theft/start variants, installation state, low level, BLE sensor connected/disconnected/lost                                                                   | Calibrated tank signals and mapped events; CAN cumulative consumption alone is insufficient.                              |
| Geofence                 | Staying inside; staying outside                                                                                                                                      | Zone geometry plus target/condition/cycle, with sampled-position dwell limitations.                                       |
| Idle                     | Idle                                                                                                                                                                 | Verified engine-running and stationary state, sustained-duration rule and boundary coverage.                              |
| Input / Sensor           | Input / Sensor                                                                                                                                                       | Established channel identity, state/scaling and timestamp; names alone are metadata.                                      |
| IO Extender              | Events 1–8                                                                                                                                                           | Proven module/event mapping and payload. These labels do not prove eight installed channels.                              |
| Odometer                 | Odometer                                                                                                                                                             | Selected counter source/unit and threshold; correction/reset is not a notification read.                                  |
| Safety                   | 18 maneuvers: acceleration/braking; left/right and wide turns; turn/brake/acceleration combinations; roundabout, lane change, bypassing and bumps                    | `/events?decode=1` plus a confirmed maneuver/severity dictionary. Do not map menu order to `manuever` codes.              |
| Speed                    | Speed                                                                                                                                                                | Proven speed source/unit plus comparison and sustained duration. Not automatically a road-law violation.                  |
| StarLink Events          | 57 event labels, including ignition/engine transitions, geofence, voltage, inputs, battery, towing/panic/jamming, manual events, RPM, immobilizer and service states | Confirmed `eid`/extra dictionary and installation capability. An alarm label is not permission to actuate an immobilizer. |
| StarLink Inputs          | High/low transitions for Inputs 1–4                                                                                                                                  | Verified bit/channel transitions, not a guessed CSS bit map.                                                              |
| Temperature              | Internal device and Sensors 1–4                                                                                                                                      | Proper tracker/external sensor source, unit and thresholds, separate from CAN coolant/oil.                                |
| Trip                     | Distance; time                                                                                                                                                       | Complete attributed `/trips` set and verified duration semantics.                                                         |
| Vehicle Status           | Ignition off/on; engine off/on                                                                                                                                       | Distinct proven state transitions. Speed zero, RPM zero and ignition off are not interchangeable.                         |
| Weight                   | Load garbage, loading, loading time, unload, periodic weight value                                                                                                   | Actual Weight application signal/calibration and activity states. No installed weighing system was demonstrated.          |

The speed draft exposed a comparison, a numeric value labeled kph, sustained
duration, bounded validity by dates/weekdays/time or Forever, message text,
optional automatic command, popup Info/ACK and color. Its displayed default of
120 kph is UI evidence, not a recommended threshold. Cycles offered No Limit
(with a displayed daily 250-occurrence qualification), Once, Occurrence Times
and Occurrence Times at One Day. Enforcement and exact boundary behavior were
not tested. Implement only selected, supported rule families, never all 24 as
empty or guessed controls.

## The fourteen search-help topics mapped to methods

These mappings describe how our search could dispatch supported selections.
The vendor parser's complete grammar, operator precedence and date interpretation
were not reverse-engineered. One free-text Parking view was inspected; its full
period interpretation was not proven, so it was not used for numerical parity.

| Help topic              | Data/method route                                          | Calculation and presentation                                                                                                              |
| ----------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| General questions       | `/cars`, `/drivers`, `/trips`, `/location`                 | Resolve the selected entity and supported operation; show applied filters and the matching list/report.                                   |
| Drivers Location        | `/drivers`, assignments, `/location`; historical `/events` | Current car position attributed to a proven driver. Historical position needs source fixes at the requested time, not today's assignment. |
| Routes                  | `/trips`, available historical positions                   | Trip list/detail and real points; route planning stays R01.                                                                               |
| Fuel Events             | `/edata`, nonempty `/sensors`, proven `/events` types      | V04 charts/event list. A tank drop alone is not confirmed theft.                                                                          |
| Speed Events            | `/events.spd`, `/trips.max_speed`                          | D04 selected threshold versus maxima/actual event definitions.                                                                            |
| Parking Events          | `/events`, `/trips` context                                | V03 interval table/map with period, weekday and time-of-day filters in the resolved zone.                                                 |
| Find Nearby Drivers     | assignments + bulk `/location`                             | C11 straight-line ordering/radius; show data age and unavailable driver attribution.                                                      |
| Find an Address         | separate map/geocoding service                             | Search/center map; no corresponding API v2 geocoding operation is declared.                                                               |
| Driving Behavior Events | `/events?decode=1`, `/driving-profile`                     | D05 maneuver/severity chart, event details and map after code mapping.                                                                    |
| Camera Events           | known `/events` types, real video metadata                 | V10 event timeline; media requires another verified interface.                                                                            |
| Idle                    | engine/stationary signals in `/events` or `/edata`         | C05 durations/totals with the advertised above-300-second reporting rule distinguished from other stops.                                  |
| Engine                  | verified state events; RPM as separate evidence            | Engine/ignition filters and V06 intervals; RPM zero does not prove ignition off.                                                          |
| Driving Profile         | `/driving-profile` with provider-wall-clock dates          | Existing nine-category score/weight view with null categories preserved.                                                                  |
| Dates and Hours Search  | endpoint-specific period parameters                        | Resolve relative dates once, show the resulting period/zone and translate to UTC only for endpoints whose UTC contract is established.    |

## Map and source data reassessment

The current generated contracts already retain the inputs for contextual maps:

- [Location](../../../../apps/karma-client/src/modules/location/location.graphql)
  has nullable latitude/longitude, source clocks and message identity.
- [Trips/events](../../../../apps/karma-client/src/modules/history/history.graphql)
  have trip endpoint coordinates/message IDs/times and individual event coordinates.
- [eData](../../../../apps/karma-client/src/modules/edata/edata.graphql)
  can carry message coordinates with UTC/local timestamps and parameter values.

These are point-bearing records, not a dedicated verified trip-polyline contract.
The existing [map preview](../../../../apps/admin/src/app/ui/map-preview/map-preview.ts)
uses optional Google Embed for points, Street View and suggested directions, and keeps external
links without a configured key. It does not render an actual sampled
trip trace. A statement that the current trip view lacks a
trace must not be read as proof that the underlying event API has no positions.

### Additional bounded coordinate sample

A further six direct GET reads followed one API login: one cars read, two trip
reads, two eData reads and one events read. All six returned HTTP 200 arrays;
no command, configuration, entity mutation, internal `/i/` call or Google location
request was made. The same existing API car was used for the five data reads.
Only aggregate availability observations are retained here.

| Observation                                                                                                                                 | What it establishes                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cars returned ten rows. A selected completed-day trip query for the chosen car was empty; a trip read without date bounds returned 59 rows. | Empty selected-period data is distinct from no trip history. This is not another parity comparison against E03's selected vehicle/day or proof of exhaustive history.                             |
| A completed-trip candidate had numeric valid start and stop coordinate pairs.                                                               | An endpoint-based trip view is feasible for the sampled record without a continuous track.                                                                                                        |
| An eData historical tail and latest eData read were both empty for this car.                                                                | Event/trip availability does not establish eData/CAN availability on every installation. Empty readings must not be labeled unsupported hardware or disconnection.                                |
| Events returned 500 timestamped rows with numeric, range-valid coordinate pairs and 195 distinct pairs.                                     | The public event API supplies real position-bearing history on this sample, beyond just trip endpoints. Numeric validity does not establish GPS fix accuracy, freshness or a full physical route. |
| No sampled trip had both its boundary-message IDs present in that 500-row event batch.                                                      | This batch does not prove a complete selected-trip track. A bounded trip/window retrieval and explicit completeness/gap rules are still necessary.                                                |

No new universal point frequency, retention, gap threshold, map-matching rule or
complete-route guarantee follows from this sample. The first release can safely
fall back to last-reported position and endpoints. The bounded proof below establishes
one correlated message window; arbitrary latest messages remain insufficient.

### Bounded trip message-window proof

One further read-only example used four successful HTTP requests, each with a four-second
deadline: login, cars, trips and one events read. The event request took approximately
1.2 seconds. It used the selected completed trip's own message anchors, widened by one on
each side for the observed provider boundary semantics, then checked the exact inclusive
window. No private IDs, coordinates or payloads were retained.

The response contained 314 range-valid positions with 314 distinct message IDs and 282
distinct UTC timestamps. Both boundary messages were present; their `edt_tz` text matched
the trip's original start/stop text. The UTC `edt` values formed a coherent ordered window.
No adjacent interval exceeded the chosen 600-second proof threshold. Equal-time records
remain distinct, and the implemented read reports duplicate-ID removal and ordering rather
than deduplicating geometry. The UI independently displays its explicit 15-minute viewing rule.

This establishes useful correlated samples for one bounded trip window, not universal
retention, continuous physical coverage or a guaranteed successful query for every trip.
The generated [position contract](../../../../apps/karma-client/src/modules/history/history.graphql)
limits the read to one response, 500 rows and four seconds, reports missing boundaries/caps
as partial, and keeps physical coverage unassessed. It does not reconstruct trip-local time
as UTC, treat `pdt` as receipt time or assume eData availability. E11 still establishes only
the observed two-car bulk response; fleet-wide batch limits remain unproved.

### Google Maps readiness

The current integration and Google products support different presentation levels:

| Level                                           | Readiness                                                                                                                         | Boundary                                                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Last-reported location and endpoint exploration | Existing public Karma queries/coordinates and current map preview/helpers.                                                        | Use original source time; last reported does not mean physically live.                                             |
| External Street View action                     | [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) support panorama actions without an API key.       | Coverage and selected panorama are Google-dependent; this is surroundings imagery, not vehicle video.              |
| Optional embedded panorama                      | [Embed](https://developers.google.com/maps/documentation/embed/embedding-map) includes a `streetview` mode.                       | Loads the active configured view automatically; absent imagery must leave a useful location/text fallback. |
| Recorded-point path or multi-marker interaction | [Maps JavaScript polylines](https://developers.google.com/maps/documentation/javascript/shapes) can connect supplied coordinates. | The API renderer does not supply missing telemetry or turn a segment/suggested road route into recorded travel.    |

[Street View metadata](https://developers.google.com/maps/documentation/streetview/metadata)
can establish panorama availability and a capture date when supplied. Capture
date may be coarse or missing; no current-condition or live-truck claim is
justified. A richer Maps JavaScript integration has its own
[billing](https://developers.google.com/maps/documentation/javascript/usage-and-billing)
and [key restriction](https://developers.google.com/maps/api-security-best-practices)
requirements, distinct from existing Embed configuration.

### Product opportunity boundary

The inspected classic interface already has maps, Street View access, reports
and historical activity views. They are not novel features merely because holita
can expose them in more places. The useful opportunities are an integrated,
accessible experience and additional analysis of the same data:

- Distinguish retrieval completion, point/time coverage and missing metric inputs
  beside every report instead of a single unexplained accuracy/health score.
- Compare explicitly comparable complete periods, explain each delta and retain
  the original source calculation/selection.
- Show observed signal availability per vehicle, rather than promising the same
  CAN/temperature/voltage channels for all hardware.
- Link a selected trip/time/point to available events, CAN signals, source details
  and surroundings without mixing current position with past activity.
- Explain counter-source differences, reset/gap effects and measured fuel coverage
  instead of treating every discrepancy as theft or a device fault.

Those integrated forms were not observed in the supplied account; this is not
proof of their absence from every Karma role/version. Concrete pending tasks,
dependency gates, visual consistency rules and acceptance criteria belong in the
[MVP and product experience backlog](../../../todo/karma-web-functional-discovery.md),
not in a claim that those features are already implemented.

## Proposed delivery sequence

This is a sequence of future functional slices, not an implementation performed
by this research. The current five-application workspace already supports the
first slice; a separate application is not necessary to evaluate these workflows.
The [detailed MVP backlog](../../../todo/karma-web-functional-discovery.md#first-mvp-tasks)
owns the task dependencies, shared visual direction, contextual Google Maps/
Street View placements and acceptance gates. Its first-release scope deliberately
does not promise a complete historical track.

1. **Vehicle and trip reports:** reuse the car list/detail, period controls,
   source drawers and map previews. Add the proven Summary/Distance fields from
   E03/E04. Acceptance: same selected car/day, matching trip count, rounded total/
   day/night distance and maximum speed; no invented duration/score fields.
2. **Signal charts and behavior:** selected eData series, timestamped voltage
   facts, decoded eSafe detail and the existing profile. Acceptance: exact source
   identity/value/time preservation, missing data visible and only confirmed
   source labels/units. Resolve four-second versus slow-query behavior before
   promising arbitrary historical reports.
3. **Activity intervals and driver reports:** after event/time/assignment contracts
   are proven, add Parking, Stoppings, engine-on/idle and driver grouping. Acceptance:
   a populated comparable source example for each classification and no fake driver.
4. **Owned workflows:** choose POIs/geofences, local notification rules, fuel
   records, maintenance or tires according to actual priority. Define scope,
   identity association and ownership before persistence or background processing.
   Existing Fleet maintenance is reused where appropriate.
5. **Vendor-dependent features:** accidents, media, configured telemetry modules,
   query-use history and richer vendor entity edits wait for their actual interface/
   data. Decide with ERM whether the discovered internal web methods have a
   supported external contract before choosing vendor synchronization over local
   ownership. NC2 firmware, billing, presets and arbitrary commands are not
   implied implementation scope and must not block earlier read-oriented slices.

Each selected slice gets a functional pass in the current admin, then presentation,
connected Storybook fixtures, BG/EN, theme/mobile/accessibility review and focused
handover verification. Stories reuse the real components and synthetic fixtures;
they do not become another backend or prove vendor availability.

## Remaining questions for ERM

These are an unsent question list. No email or ticket was created.

1. What are the precise units, rounding and algorithms for trip duration,
   travel/parking/idle/engine-on totals, average denominators and night splits?
   Which car/project timezone applies to trips and profiles, including historical DST?
   Which reports attribute complete intervals to their starting day, and what
   retrieval bounds recover closing transitions outside that day?
2. Can ERM provide the event `eid` dictionary and `extra_parsed.esafe` maneuver,
   severity, duration and axis definitions, with score/weight scales and aggregation?
3. What are the pagination/order/inclusivity/retention guarantees, supported bulk
   sizes and rate limits? Why do the sampled date/decoded-range queries exceed
   20 seconds while latest reads are fast, and which bounded query form is recommended?
4. Which tank sensor/eFuel inputs feed the dedicated Fuel and Temperature reports,
   and how do they relate to CAN IDs, calibration and missing-value conventions?
5. Which fields/interfaces supply battery health, starter duration and tracker
   temperature? How are accident report IDs discovered and camera media retrieved?
6. Are there supported APIs for POIs, geofences, route plans, notification rules/
   delivery/acknowledgement, hierarchy, first transmission, query-use reports and
   telemetry application definitions/event aliases? Which current web fields can
   actually be edited via API? Are the listed `/i/` operation families supported
   for an external integration, with versioning, permission, rate-limit and schema
   guarantees, or is another official interface required?
7. What is the nonempty driver/sensor model, how are driver assignments changed,
   and is historical driver attribution available independently of today's car record?
8. Which supported interface supplies NC2 firmware/hardware metadata, cached
   parameters and incoming diagnostic messages? What are CSS, BATC, BATH,
   parameter-ID namespaces and the Statistics counters' exact units? Can these
   reads be obtained without sending a device command?
9. What is the full role-to-menu/action matrix for classic Karma and NC2? The
   supplied web login works in both, but API-account/session equivalence and the
   source-only billing/preset/firmware features remain unverified.

Implementation choices and remaining acceptance work are tracked in the
[discovery backlog](../../../todo/karma-web-functional-discovery.md). Existing
[API/protocol questions](../../../todo/karma-api-v2.md) and
[device-settings acceptance](../../../todo/karma-device-management-design.md)
remain separate; their completed device writes must not be replayed for this report.
