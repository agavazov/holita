# Historical Karma architecture

Deprecated reference only. Read when a task needs it. These descriptions record the
previous implementation; they do not authorize device writes or renewed Karma development.

## Karma Client

`apps/karma-client` is a separate NestJS federation subgraph. Gateway forwards the signed
admin session to its `karmaCars`, `karmaCar(id: ID!)`, `karmaEdata(input: KarmaEdataInput!)`,
`karmaLocation(carId: ID!)`, `karmaProjects`, `karmaTimeZones`, `karmaVersion`, `karmaTrips`,
`karmaEvents`, `karmaDiagnosticHistory`, `karmaDailyReport`, `karmaPositionSamples`, `karmaDrivingProfile`, `karmaUsers`
and `karmaRoles` queries. Karma Client verifies
that session independently and returns cars from one configured Karma account to all
authenticated tenants. No `x-branch-id` is required or used; all Karma reads are intentionally global. Fleet isolation remains unchanged.

A concrete Karma client authenticates with `POST /login` and requests the complete `GET /cars`
list with `karma_sid`. It keeps the upstream session only in process memory and shares pending
logins across callers. HTTP 401 or the HTTP-200 `{error: "Not logged in"}` response discards only
the rejected session and retries login/read once. A four-second abort signal normally bounds
the whole operation, including login and retry. Public eData reads use eight seconds to
accommodate slower history queries; Gateway allows nine seconds for the Karma subgraph and
five seconds for the other subgraphs. The admin's HTTP deadline remains ten seconds.
Non-success HTTP bodies are cancelled before JSON parsing; only HTTP 401 or a successful
HTTP response containing the session error triggers renewal. Malformed responses, transport
errors and other upstream errors become sanitized
`SERVICE_UNAVAILABLE` errors. Credentials and session IDs are never returned to the admin.

The generated `KarmaCar` GraphQL type exposes ID, Device ID, Project ID, registration number,
type/subtype, year, color, timezone ID and assigned-driver count. Runtime validation preserves
string device identifiers and normalizes numeric/text years to nullable strings. Subtype
and timezone ID remain nullable; driver count is the length of the returned `driver_ids`
array, preserving zero and absent values separately. There is no database, migration, row cache or mapping
to Fleet Vehicles/Devices. The health endpoint does not contact Karma.

Truck details use `GET /cars/{id}` and require a canonical positive safe-integer ID before
upstream access. An empty response array or HTTP 404 becomes a nullable `karmaCar`; multiple
records or a mismatched ID are rejected. Unknown optional SIM/video content is not exposed.

Angular owns a fresh Apollo client/cache for each mounted session/language/truck read and sends
no Branch header for Karma data. The route is mounted while authenticated even when Branch discovery is empty
or fails and when Fleet is disabled. Changing the Branch on this page updates the remembered
Branch without navigation or reloading Karma. Navigation, language changes, session replacement
and logout retire obsolete reads. Refresh retains the previous successful rows on failure.
The read-only table fetches all rows on entry or Refresh. Registration, car ID and device ID
search, a project selector and 25/50/100-row pagination operate on that complete account response
without another upstream read. `q`, `project`, `size` and `first` retain list state in the URL;
filter changes reset the page and shortened refreshed lists clamp the visible page.
Registration links open a dedicated `/cars/:recordId` detail route with the verified car fields,
Refresh and a return link. All truck sections share the truck's registration/ID as the main
heading, a searchable truck switcher and visible tabs for Overview, Trips, Location, Events,
eData & measurements, Diagnostics, Device settings, Daily report and Driving profile. Tabs scroll
horizontally on narrow screens; each destination is a direct route link with an active-page cue.
Switching trucks retains the current section and bounded list return context. Daily report uses
`/cars/:recordId/daily-report` and reuses the report shown on Overview.
Device settings uses the [separately scoped Fleet operation workflow](#background-device-configuration-reads).
Bounded `listQ`, `listProject`, `listSize` and `listFirst` context restores the originating list
through both the truck header's return link and the Trucks breadcrumb;
history filters and cursors are not carried between sections with different clock semantics.
Registration links use the shared `app-link` styling, matching the Fleet tables in both themes.
Missing/invalid IDs show a not-found message; refresh failures retain previous details.
Truck details place registration, device and resolved project/time-zone labels first, followed
by the last-known location. A closed Source fields disclosure retains every original truck field.
Maps have explicit Show map / Hide map controls. Location and trip details start expanded;
other page types start collapsed. The choice is remembered per page type in localStorage,
falling back to these defaults when storage is unavailable or invalid. Collapsing a map or
opening a drawer retains its mounted preview; a collapsed map first loads when shown.
All Karma views have Bulgarian/English labels and use shared page headers, form fields,
form sections/grids, table panels, route drawers and facts. Account information is read-only;
source identifiers and optional history request controls sit behind Technical details. Narrow list tables pin a compact identity cell with its available View action while
the other columns scroll; identity and row actions remain attributable without removing data.
eData, trips, events and driving-profile periods use a PrimeNG date picker with a
separate time field including seconds. The shared control preserves literal UTC or API wall-clock
fields without browser time-zone or daylight-saving conversion;
URL state and existing request validation remain authoritative.
Invalid submitted dates, time ranges and ID lists show field-specific translated errors and
focus the first invalid input. Invalid URL filters retain their separate warning and do not
issue data reads until corrected.

The concrete eData feature validates car/message/parameter IDs as positive safe integers
represented by GraphQL IDs. It maps all verified message fields and numeric parameter
ID/value/description readings, preserving zero, null, leading-zero device identifiers and
unknown parameter IDs. `spd`, `odo` and `pdt` retain their source names because their units
or timestamp semantics have not been established. Descriptions are requested with `showdesc=1`.

A page performs one fixed GET `/edata` read, which returns the latest up to 500 matching
messages in ascending ID order. The service reverses them and selects 25, 50 (default) or 100. `hasMore` is true when the response contains more than the requested page size; no
total is fabricated. The next cursor sets inclusive `to_id` to the last displayed ID minus
one, preserving all messages within the upstream batch. Opaque cursors contain the normalized
truck/filter/page-size scope, current upper bound and initial snapshot ID. The returned
current-page cursor allows Newer to restore that upper bound even if newer messages arrive.
Dates are optional paired UTC bounds and apply to `edt`; at most 25 unique parameter IDs
use the verified bracketed GET syntax. Inputs and response scope/order/bounds are checked;
malformed data or upstream errors produce sanitized errors.

`/bg/karma-client/cars/:recordId/edata` and its English equivalent load the truck directly,
then its message page. The table shows UTC event time, message ID and parameter count;
a right-hand drawer exposes every message field and a complete parameter table. Applied filters and
cursor stay in the URL. Browser history stores only previous cursor metadata for Newer,
including across reload/back; a separately opened cursor URL or language change can reset
that trail, while Latest remains available. Latest refreshes the current filter's newest
messages. Navigation/filter changes cancel obsolete reads and clear prior rows; only
same-page Refresh retains rows on failure. No polling, persistence or writes are added.

Location uses fixed GET `/location` with scalar `car` and bracketed `fields[]` selections
for `spd`, `odo`, `edt_tz` and `pdt`. The same four-second signal covers car existence,
login/renewal and location. Missing cars return null before querying their location; an
empty location array is also null, while a last-message envelope with null coordinates
remains visible. Business error objects, multiple/mismatched rows and malformed fields
become sanitized errors. Message/event IDs are strings; event code zero is preserved.
`extra` is plain text; timestamp/code/metric values retain source names without inferred
units, timezone conversion or online status. Finite out-of-range coordinates remain
inspectable but cannot produce a map link.

The separate `/cars/:recordId/location` page loads the truck then its location, exposes
all 13 verified fields and supplies the source identity, coordinates and times to the shared
`MapPreview`. Its Map and Street View modes retain coordinate facts and keyless external
actions; zero coordinates are valid. Optional browser `googleMapsEmbedApiKey` configuration
loads the selected view when the operator expands the panel and coordinates are valid.
Mode, endpoint and source changes update the preview URL directly; the panel discloses that
coordinates are sent to Google. Hidden tabs, table rows and polling do not load previews.
Without a key, valid external actions remain available; invalid coordinates retain textual
fallbacks. Fixed Google Embed URLs contain validated
coordinates and the public browser key, without Karma sessions or credentials. No map SDK
or panorama metadata service is used. See the [map workflow](development.md#karma-maps).
Truck details load a last-known summary independently; its failure does not hide the truck.

Concrete reference reads validate complete project/time-zone lists, reject duplicate IDs
and expose original names. The Karma sidebar contains Trucks and Karma administration.
Administration groups Users, Roles, Projects, Time zones and API information in route-backed
tabs at `/:language/karma-client/administration/:section`. These are Karma account resources,
separate from holita Tenant/Branch settings and the selected truck. The original `/users`,
`/roles`, `/projects`, `/time-zones` and `/api-info` addresses redirect to their administration
destinations, retaining query parameters and fragments. Only the active resource screen is
mounted and queried. Project/time-zone search and local pagination cover the full returned list,
with exact totals and 25/50/100 sizes
(default 50). Search/page/size stay in the URL across reload, Back and language changes.
Switching administration resources clears the previous resource's search, pagination and fragment;
selecting the current tab preserves its URL.
Truck list/details resolve names from a separate reference query and retain original IDs;
failed lookups have their own warning and cannot block truck reads. Every mounted view
owns its captured Apollo client/cache, retired on navigation/language/session/logout.
The upstream version read requires no Karma login; the GraphQL version query still
requires a verified signed admin session. All views support Refresh/retry with retained
previous values on same-query failure.

Concrete history SDL and generated operations expose `karmaTrips`, `karmaEvents` and
nullable `karmaDrivingProfile`. Each validates the signed session first, canonical car
ID and filters, then verifies car existence before fixed GET reads. One four-second
signal covers existence, login/renewal, history and any trip lookahead. Missing cars
produce empty histories or a null profile; business errors remain sanitized errors.
Trips preserve all 23 verified fields, including nullable stop data and raw numeric
active flags; events preserve 12 fields with bracketed selection for `spd`, `odo`,
`edt_tz` and `pdt`. Device strings, code zero, null readings and plain-text extra remain
intact. Runtime checks reject mismatched identity, duplicate/unordered/unsafe IDs,
malformed metrics and event date/type/cursor-bound violations.

History pages return the newest 25/50/100 rows (50 default), current and next cursors,
and `hasMore`, without a total. Trip bounds use `trip_id`; event bounds use `message_id`.
Inclusive `to_id` advances by the last displayed ID minus one, with an initial upper
snapshot. Cursors bind endpoint kind, car, normalized dates/codes and size. Events
read one latest-up-to-500 batch. A short nonempty trip batch performs at most one older
lookahead within the same operation budget, because the provider's trip batch limit
is unspecified; verified older rows enable continuation even below the chosen size.
Terminal empty lookahead disables Older. Trip pages may contain fewer than the selected
size while still allowing Older. No whole-history traversal occurs inside a request.

The separate truck routes `/cars/:recordId/trips`, `/events` and `/driving-profile`
are reached from truck details. Trips/events provide optional paired dates, Latest/
Older/Newer, URL cursor/filter state and full row drawers with keyboard close and focus
restoration. Events also accept at most 25 original event codes, including zero, and
use explicit UTC filtering. Trip/profile periods are source wall-clock values; their
provider timezone is unspecified and the UI discloses this. Source timestamps are
shown without implicit browser conversion. Profile starts with a seven-day wall-clock
range derived from the current UTC clock and supports replacing/expanding it; the
period aggregate needs no record paginator. Its nine category names, nullable scores
and weights remain original values, without a combined rating or invented scale.
eData and Event drawers show message/time summaries before their content and a closed
Source fields disclosure. Parameter readings and original event text stay directly visible;
the disclosure retains all original fields, including nulls, zeros and unknown codes.
Driving profile puts its applied API period above the categories and preserves original
identity fields in the same disclosure pattern.
Trip drawers supply the same panel with the trip identity and recorded start/end points
and times. Start/End selection retains that source context while switching between Map
and Street View. Suggested Google route is available only with two valid endpoints;
one valid point keeps its point actions. Google's directions do not represent recorded
vehicle movement. No sampled historical path is rendered by this panel.

`karmaPositionSamples(input: {carId, startMessageId, stopMessageId})` reads one explicit
message window through the signed Karma account, without Branch filtering. The connected
`TripPositionExplorer` supplies the original IDs of its selected trip; the API does not
independently assert trip association. Car validation and one fixed event read share a
four-second deadline. The response body is limited to 2 MiB and the result to 500 records,
without automatic pagination or eData requests. The widened provider bounds are filtered
back to the exact inclusive message window.

The result retains each `KarmaEvent`, a nullable established `instantUtc`, retrieval time,
request limits, both boundary-presence flags and the count of repeated IDs removed. The first
returned occurrence of a message ID is retained. With valid UTC `edt` clocks throughout,
records are ordered by UTC then numeric message ID; otherwise source order and raw times
remain available. Distinct records at the same instant or coordinate are retained.
Retrieval is partial when a boundary is missing or the row cap is reached, and unavailable
when the source fails. Physical position coverage remains `NOT_ASSESSED` in every result.

`TripDetails` owns one `PointExplorer` for both trip-list and daily-report drawers. Selection
and local 10/25/50 paging reuse the loaded dataset without source requests or URL changes.
The selected record supplies its own map coordinates, time, ID and raw speed/odometer facts.
Missing or failed samples retain the trip's actual endpoint records. A Holita view rule
marks intervals longer than 15 minutes between loaded valid UTC positions; it does not
establish sampling frequency or a missing physical journey. Source-declared gaps remain
separate. Google Embed renders the selected point or endpoints, not an arbitrary polyline.

Every mounted history/profile owns a fresh captured Apollo client/cache. Filter/period
or cursor changes cancel obsolete reads and clear old rows/details; same-query Refresh
retains prior successful values on failure. Browser history stores previous cursor
metadata for Newer, while separately opened cursors can use Latest. Truck/language/
session/navigation/logout retire clients. There is no automatic decoding, polling,
map SDK, upstream write or device command in these reads.

### Measurement workspace

The existing eData page offers Source messages and Measurements views over the same loaded
`karmaEdata` page. Switching view, channel, record or local table page makes no source request.
UTC bounds, parameter filters, cursor and 25/50/100 page limits remain the existing API contract;
one eData request has an eight-second deadline and validates at most 500 upstream records.
The analysis always identifies its loaded subset, inclusive requested bounds, parameter filter
and continuation state. It calculates no full-window totals from the displayed API page.
The retrieval clock records when this view received a successful non-loading response;
failed refreshes retain the preceding values and clock.

`MeasurementWorkspace` presents an observed-channel
matrix distinguishes numeric values, explicit nulls and absent readings, with separate latest
observed and latest numeric source times. Known catalog IDs are candidates, not hardware
capabilities; unknown returned IDs remain selectable. Real readings retain their raw scale,
source descriptions and original message/parameter identities. Envelope `spd`/`odo` do not
inherit CAN units. Real counter deltas, cross-source comparison and fuel consumption remain
unavailable without independently established scale, counter semantics and matched coverage.

The selected series uses established UTC instants and retains equal-time records. Nulls,
absent values, declared source gaps and intervals over the explicit 15-minute viewing rule
break the line. Unproved clocks leave the original table available without a chart. The
readable table and selected source facts identify the same record as the single point
Map/Street View. Missing coordinates do not borrow another record's point. Opening the
original source-message drawer temporarily removes the underlying measurement map.

### Daily report contract

`karmaDailyReport(input: {carId, day?})` is a read-only generated Gateway contract
in the existing History feature. The existing truck Overview at
`/:language/karma-client/cars/:recordId` consumes it through `DailyReport`.
Omitting `day` selects Yesterday in the proven source zone; an explicit day must be
an ISO calendar date and must be completed. The currently proved zone is the car's
`Europe/Sofia` reference from `/time-zones`; other zones return `UNSUPPORTED_PERIOD`.
No Branch or browser zone supplies a fallback. Local midnight boundaries are resolved
separately with IANA rules, so UTC durations can be 23, 24 or 25 hours.

The selection is **whole trips starting in the source-local day**. Crossing-midnight
trips belong to their start day; values are not clipped to calendar occupancy.
A nonzero/missing active flag or absent stop time prevents final distance/speed
claims. Current car configuration is the zone source, not a reconstruction of past
configuration changes. See the bounded [source proof](karma-api-v2/web-functionality-research.md#daily-report-source-proof).

The service shares one four-second signal across car lookup, zone lookup and at
most four logical raw `/trips` page reads. Existing session renewal may retry a
wire GET once within the same operation deadline. It retains at most 1,000 rows and limits each trip
response to 2 MiB. Date bounds remain fixed; continuation uses the inclusive upper
ID bound `min(trip_id) - 1`. An empty `from_id=max(initial trip_id)+1` probe first
confirms the initial upper boundary; a nonempty probe leaves a subset with
`SOURCE_BOUNDARY_NOT_PROVEN`. A short batch is followed by another request: an empty
older range then establishes retrieval completion under the observed provider rules.
Page/row/deadline limits preserve a labeled subset rather than certify completeness.
This does not promise an immutable snapshot, retention or every physical trip.

The contract separately carries:

- `retrieval`: completion of the provider query, independent of metric availability.
- `state` and `reason`: complete, partial, empty, unsupported period or unavailable,
  including the concrete limit/failure/open-trip reason.
- Each metric's nullable value, availability and available/required input counts.
- `trips`: the exact bounded `KarmaTrip` set used by those metrics, including a partial set.
  Both the report and the independent trip list select the generated `KarmaTripFields` fragment.
- Selected identity, source zone, local/exclusive UTC boundaries, request/row limits
  and `retrievedAt`. That timestamp describes retrieval, not measurement freshness.
- `positionCoverage: NOT_ASSESSED`: no GPS-sample coverage is inferred from trips.

The backend sums `trip_distance` and `trip_distance_night`, subtracts for day
distance, counts the selected trips and takes available source maximum speeds.
Missing inputs affect the corresponding metric; values are not rounded in the
contract. A complete empty selection has zero count/distances and null maximum
speed. An upstream failure before obtaining a usable set leaves values null.
Source distance/speed units remain **unconfirmed**: the generated units explicitly
say `SOURCE_DISTANCE_UNCONFIRMED` and `SOURCE_SPEED_UNCONFIRMED`. These are raw source
aggregates, with no km/km/h label or conversion. Unit confirmation remains an MVP-00
blocker before the operational report promises physical units.

The connected Overview keeps the existing truck header/navigation, followed by a source-local
calendar day control, compact `SourceContext`, three `KpiTile` values, day/night `StackedBars`,
one map context and the paged loaded-trip table. The shared `DayOverview` owns presentation;
`daily-report-presentation.ts` formats the server result without computing replacement totals
from table pages. Composition appears only when both parts cover the same complete selection.
The native date input submits a completed `day` in the URL; Yesterday omits it so the server
chooses the source-local date. The validated day survives truck-tab navigation, while history
`from`/`to` filters retain their independent clock semantics. Returning to the inventory keeps
its original list context without a report-day filter.

`#trip-<id>` selects a record from that same report in the existing route drawer. Opening and
closing preserve truck/day/list context and restore row focus; a deep link outside the loaded
set shows an unavailable-record message. The drawer reuses `TripDetails` and its position
explorer with the source trip's endpoints and bounded event samples, never a substituted current location. All 23 original
trip fields remain available, with raw units, nulls and zeros preserved. The default map is
explicitly the last reported position, independent of the historical day, and is unmounted
while the historical drawer map is active. Missing location, report failure, empty query and
partial/missing metrics remain independent. Both real and example views keep readable source
facts without a Google key. Connected Storybook snapshots are synthetic and remain outside
runtime code.

The Overview's optional second day uses the same generated report operation with an independent
subscription and retrieval time. Only that explicit pair is loaded; URL `compareDay` changes do
not refetch the primary day. Comparison requires distinct completed source-local days, identical
car/zone/selection/unit and complete finite metric values. A zero comparison value permits a
unit difference but no percentage. Report completion never implies physical position coverage.
Displayed percentage differences use up to two decimal places; original report and export
inputs retain their source precision. The comparison rule and raw-unit explanation appear
once above the table, while unavailable and zero-baseline reasons remain with their metrics.

`report-evidence.ts` derives readable day/trip/selected-point briefs and explicit JSON export
fields from those loaded contracts. Day exports contain the chosen report, optional comparison,
metric availability/input counts, contributing trips, period, raw units and bounded retrieval
metadata. Trip exports retain the original trip and only a selected position or endpoint, with
the position read's separate clock and limits. Coordinates are omitted unless explicitly
chosen. Export does not read the API, include opaque upstream payloads or use the independent
latest location. The brief is deterministic factual text, with no scoring or diagnosis.

The account `accounts` module exposes signed `karmaUsers` and `karmaRoles` fixed GET reads.
User records preserve all eleven source fields: identity/profile text, numeric active flag,
nullable expiry text, role/time-zone/project IDs and the complete ordered project-ID array.
Roles preserve ID and original description; neither response grants permissions or changes
admin authentication. `/karma-client/users` and `/karma-client/roles` are separate menu routes
with complete-list local search and URL q/size/first paging (25/50/100, default 50). Users
have a keyboard-accessible detail dialog showing every source field; null expiry and zero
remain distinct. Same-scope refresh failures retain rows, and session/language/navigation
retirement uses the existing captured client lifecycle. These reads keep the global account
scope and four-second operation bound.

### Real diagnostic report history

`karmaDiagnosticHistory` owns a bounded diagnostic projection of actual Karma events.
Its input carries a canonical car ID, page size/cursor and optional inclusive message-ID
bounds. A source read uses `date_type=utc`, at most 500 rows and a four-second deadline.
Provider ID bounds are padded and filtered locally to preserve the public inclusive range
when the source includes boundary rows.
The response preserves each original event and payload with its family, decoding state
and UTC instant. `historyComplete` remains false: provider pages establish neither full
historical coverage nor the ECU's current active faults. Upstream failure is unavailable,
not empty history. Unknown layouts remain opaque, and invalid known layouts remain
malformed without guessed fault fields.

The `419` type `21` decoder follows the independently reacquired captures: repeated
four-byte big-endian SPN, FMI, status. Reported `01` means added and `02` removed.
OBD `413` and communication `411` use their documented layouts; ambiguous `418`, tracker
E2 and E70 reports retain their separate source families. Special `154,0` is NACK/error;
`154,1` is positive special ACK. No authoritative description dictionary, ECU identity,
severity or active-state reconstruction is supplied.
Valid numbered report fragments are decoded independently; they are not assembled into a
complete logger. Type-only fault payloads remain unresolved and cannot establish a successful read.

The connected truck Diagnostics page reads this projection through generated
TypedDocumentNodes. Source details retain message/car/device IDs, source UTC time,
display time zone and raw bytes.

## Background device configuration reads

Fleet's `DeviceOperationsModule` owns `FleetDeviceOperation`, its scoped GraphQL API and
an `@nestjs/schedule` worker in the existing Nest process. Operation kinds are
`READ_CONFIGURATION`, `ADD_PARAMETER`, `UPDATE_INTERVAL`, `READ_RULES`, `UPSERT_RULE`,
`READ_FAULT_LOGGER` and `READ_COMMUNICATION_DIAGNOSTICS`.
Karma Client exposes fixed machine-authenticated internal HTTP operations for target lookup,
parameter/profile/rule/diagnostic reads, queue reconciliation, one-definition changes and response-event scans. It has no
database or background archive.

Karma's car record owns the configuration target: `car_id` identifies the car and its
`device_id` identifies the attached device in Karma. Configuration inputs carry `karmaCarId`
and `expectedKarmaDeviceId`; the server verifies this pair upstream before queuing work and
again before dispatch. The device identifier is opaque and is not treated as a local IMEI.
Local Fleet Device registration and a separate identity mapping are not required.

Each operation captures the upstream pair. All public operation and snapshot reads
require verified Tenant/Branch scope and the normal Fleet availability guard. The worker uses
stored scope without retaining an expiring browser token. Demo authentication identifies a
Tenant, not a named operator or production device-control permission.

The additive migrations retain operation timestamps, deadline, lease, queue references,
response fragments, complete definitions, change intent, baseline operation, observed profile,
submitted definition, write uncertainty and sanitized error codes. Composite baseline-operation
foreign keys preserve Tenant/Branch scope and protect referenced history. Nullable local Device
references and IMEI values remain only as historical metadata on older operation rows.
A partial unique index permits one active operation per Karma car across all workspaces because
queue-to-response correlation is not established. Changing the configured Karma account
while operations are active is unsupported.

Diagnostic reads use `requestFleetDeviceDiagnosticRead` with the verified car/device pair
and one fixed kind. `fleetDeviceDiagnosticOperations` returns the latest 20 such operations
within the verified Tenant/Branch. The worker retains original queue states and response
message IDs, UTC timestamps and raw payloads in the existing evidence JSON. A pending or
unknown retained queue blocks a subsequent diagnostic submission across workspaces, including
after a local timeout. This worker-only lookup never exposes another workspace's queue IDs.
Observed terminal queue states `1` (transmitted) and `3` (failed to receive acknowledgment)
permit a new explicit request; they do not establish a device report. Ambiguous submissions
are polled without replay. `154,0` ends the operation as `FAILED` / `DEVICE_NACK`;
`154,1` keeps observation pending. Only an observed matching fault or communication report
produces `COMPLETE`, meaning report observed, without claiming full coverage or causality
from a queue ID that the response does not echo. The UI identifies queue delivery and
special acknowledgment separately; no outer transport ACK is inferred from them.
Before submission, a bounded latest-event read captures the source message watermark in
the existing operation row. Diagnostic observation pages use message-ID bounds and filter
source UTC locally, avoiding the dated queries that timed out in the live campaign.

The worker runs every ten seconds, processing at most five due operations per pass. A
conditional database update claims a 30-second lease with a unique token; every result write
checks the stored Tenant/Branch, token and unexpired lease. Before dispatch it persists
`SUBMITTING`. Restarted reads in that state become `UNKNOWN` and check for responses instead
of replaying a potentially accepted request. A durable `writeDispatchedAt` marker is saved
before the sole write attempt; it records an attempted submission boundary, not proven
delivery. Recovery after that marker proceeds only to verification. Waiting is stored as `nextCheckAt`, not a long
HTTP request or database transaction. Shutdown and restart retain the work; at least one
Fleet process must be running to advance it.

States are `QUEUED`, `SUBMITTING`, `WAITING`, `UNKNOWN`, `COMPLETE`, `TIMED_OUT` and `FAILED`.
Operations expire ten minutes after creation. HTTP failures leave response polling pending
until that deadline. A changed target, inconsistent response or exceeded evidence bound fails
the operation. Stopping Fleet does not extend the deadline. Expiry means no matching complete
configuration was confirmed; it does not prove a command was never delivered. The vendor queue
may deliver an accepted command later, and holita cannot cancel it. Refresh and reconcile
device state before requesting another change; an uncertain write is never automatically replayed.

Parameter reads use command `301`, payload `0702BC`; profile reads use `301`, payload `1F`;
rule reads use `301`, payload `0802BC`. The changing payloads are `02` followed by exactly one
22-byte parameter definition and `04` followed by exactly one validated rule record.
The machine endpoint validates the supplied definition and
rechecks upstream identity immediately before submission. It cannot accept arbitrary paths,
commands, set replacement (`01`), deletion (`10`), global settings or profile changes.
Karma response-event scans use UTC windows, bounded ID paging and device identity checks.
The background observation scan shares a 20-second deadline across target lookup, login
renewal and all event pages. Fleet allows 21 seconds for that internal HTTP call, within
the 30-second operation lease. Target lookup and device-request submission retain their
four-second provider budget and Fleet's 4.5-second internal-call budget. Public eData queries
use eight seconds; other public Karma queries retain their four-second operation bound.
Each caller also retains its own deadline while joining a shared pending upstream login;
a public read does not wait for the longer background deadline.
Original `401` messages and parsed 22-byte definitions are deduplicated and persisted across
polls/restarts, including incomplete multipart responses. Confirmation requires a consistent,
complete numbered series and complete bounded scan coverage. Each provider scan retains at
most 64 relevant fragments and 1000 definitions; Fleet's merged evidence is also bounded.
Unknown parameter IDs and zero intervals are preserved. Profile observations use separate
`416` evidence; rule observations use separate numbered `402` fragments with payload `08`.
Parameter and rule reads retain the terminal response `19,0,154,0` with its original
message ID and timestamp. With complete scan coverage, a terminal response without a complete
configuration ends the operation as `FAILED` / `READ_NO_CONFIGURATION`; it never establishes
an empty configuration. A complete valid configuration takes precedence over this response.
Unknown rule bytecode stays intact. Firmware updates and telemetry ingestion are outside this feature. An observed
configuration response is not a universal causal queue acknowledgment or evidence that CAN
measurements are arriving. The worker does not poll `/queue` or interpret a delivery state as
an applied configuration acknowledgment.

### Durable additions and interval changes

`requestFleetDeviceParameterAddition` and `requestFleetDeviceParameterIntervalUpdate` require
a complete baseline operation for the same Tenant/Branch and selected Karma car/device pair.
Fleet captures the baseline and intended ID/interval in a new queued operation. Public inputs
contain intent, not raw device definitions. A changed upstream identity stops dispatch.

An addition first reads the profile (`READ_PROFILE`). Eligible presets come only from the
imported Monitor 9.56 EXE SHA-256
`01dd13e50c55fdf84078ce298bde72320d55bee458baa4c0d2a06fca7c0ca1a0`, extractor `1.0.0`,
schema `1`: Monitor-source rows must have one nonempty name per ID, no row issues and
membership in a set used by the observed profile. Fleet checks eligibility again before
writing. Catalog membership does not establish model/firmware compatibility or a live signal.
The [retained Monitor constructor evidence](../../discocan/erm-resources/edata-simple-protocol-v4.04/parameter-reporting.md#monitor-956-predefined-parameter-construction)
defines the generic predefined-ID packet; it does not invent a CAN decoder. No eligible
catalog means additions are unavailable; existing intervals can still be edited.

Both change kinds request a complete fresh baseline (`READ_PARAMETERS`) and compare every
ID and raw definition with the operator's captured baseline. Any difference stops the change.
An addition requires the ID to be absent and fewer than 1000 existing definitions; that is
the adapter's verification bound, not a promised device capacity. An interval update requires
the ID to exist, including IDs unknown to the catalog, and changes only its final two interval
bytes. All other captured fields remain byte-for-byte intact. Supported requested intervals
are integers `0..65000` seconds. Monitor describes zero as **not in use**; retaining a zero
definition differs from deleting it and does not prove that measurements stopped.

Preflight freshness is **120 seconds**, measured conservatively from the earlier of the
phase request time and the earliest response timestamp. Fetching an old reply after restart
does not refresh its age. Expired evidence triggers a new safe read after advancing its own
message-ID watermark. Profile and parameter evidence remain separate. Before `WRITE_PARAMETER`,
and again after saving the durable write marker, the remaining lease, deadline and preflight
age must accommodate the complete 4.5-second internal submission budget. A marker-bearing
operation that cannot safely send moves to uncertain verification rather than retrying a write.

`VERIFY_PARAMETERS` issues an independent full parameter read. Its `afterMessageId` watermark
excludes the baseline fragments before assembly. Completion requires the intended definition
and every unrelated definition to match the expected whole set; an addition also permits
the observed predefined multiplier/divisor normalization from `1/1` to `0/0`. Other differences
fail verification. An unchanged complete read advances the watermark and requests another
safe read until the deadline. Queue acceptance or an HTTP response alone never completes a
change. This confirms configuration evidence, not measurement availability, calibration,
global/profile equality or universal causal correlation with a specific queue entry.

### Durable rule reads and single-rule changes

`requestFleetDeviceRulesRead` reads the complete rule set for the same explicit scoped target.
`fleetDeviceRulesSnapshot` returns its latest complete rule snapshot independently of parameter
snapshots. Rules expose the complete original definition, header fields and referenced parameter
IDs; `expression` is canonical grouped ID text for the supported editable subset and null for
opaque or imported n-ary expressions. Rule names are local editor metadata, absent from device records.

`requestFleetDeviceRuleChange` accepts an explicit `ruleId`, `expression`, separate
`trueEventId`/`falseEventId`, `debounceMilliseconds`, and both rule and parameter baseline
operation IDs. Both complete baselines must match the active Tenant/Branch and exact
Karma target. Every referenced parameter must already exist in the parameter baseline. The
shared `@holita/edata-rules` codec compiles the expression; public input never accepts raw hex.
Rule/event IDs use `0..65535`, debounce uses `1..32767` milliseconds and RuleData is at most
128 bytes. A selected ID updates that existing rule or adds one if absent; holita does not
allocate an unused device ID. Existing dashboard activation is preserved, while new rules
use false. Unsupported existing expressions cannot be overwritten through this mutation.

The operation captures both whole baselines, rereads parameters then rules, and requires
both fresh observations to match within the same 120-second preflight window. It then sends
one `04` record through the durable write marker. `VERIFY_RULES` performs an independent full
rule read after the baseline watermark. Completion requires exactly the intended record and
every unrelated record unchanged, including opaque bytecode. Unchanged observations cause
safe rereads; conflicting observations fail the operation. Recovery never repeats the write.
The parameter baseline proves configured dependencies, not live input values or firmware
evaluation semantics. No server-side expression evaluator, rule deletion, set replacement,
global/profile changes or automatic multi-rule deployment is exposed.

`fleetDeviceOperations(karmaCarId, expectedKarmaDeviceId)` returns the latest 20 requests for
that pair within the active Tenant/Branch; `fleetDeviceOperation` retrieves a saved request by ID.
`fleetDeviceConfigurationSnapshot` and `fleetDeviceRulesSnapshot` take the same pair and
independently return the latest complete snapshot, so newer failed reads cannot hide it beyond
the history limit. Operations expose their `branchId` for scoped client reconciliation.
Historical requests remain available by scoped history/ID. A snapshot describes the observed
configuration at its recorded time; changes made outside holita can make it stale.

The admin opens `/:language/karma-client/cars/:recordId/configuration` through More →
Device settings in the truck navigation. The selected Karma car directly supplies its device;
the screen shows
**Device in Karma** without another car/device selector or setup step. The shell's active
Branch scopes operation history and submissions. Karma account data remains independent of
Branch, and `projectId` is not interpreted as a local Branch. Local Fleet Vehicle/Device
records remain a separate workflow.

Old Fleet configuration bookmarks return to the Karma car list and never infer the upstream
truck from an IMEI or registration. An unauthenticated
visit to the matched Karma settings route returns there after successful login and Branch selection.

The selected session/Branch/language/Karma pair owns the Fleet clients independently of the
Branch-free Karma reads. Changing that selection retires readers and timers; submitted
mutations settle against their captured scope. A changed upstream identity remounts the
configuration workspace. Navigating away leaves the
durable server operation intact. The page reloads saved state on mount and polls every five
seconds while a request is pending. Snapshot editing requires the latest complete baseline
to match the current Karma pair and active Branch.

**Read configuration** requests parameters first, then rules only after that exact parameter
operation completes for the captured target. The page never starts both concurrently. Reload
retains each saved result but does not dispatch a new command automatically; **Continue reading
rules** explicitly resumes an incomplete read sequence. Each snapshot keeps its own timestamp,
and a failed rule read does not block parameter changes backed by a complete parameter snapshot.

Parameters use the shared table and typed change drawer for one catalog addition or existing
interval change. The action fixes the editor mode and, for interval edits, the parameter.
The form previews the target and before/after interval, requires
explicit confirmation and separate zero-interval confirmation, and guards dirty navigation
and scope changes. A changed target or baseline invalidates the draft. Original definitions
remain available with baseline identifiers in technical details. History expands when the selected target has operations
and retains kind, phase and uncertainty. Local rule authoring is available without Fleet scope
and uses browser storage partitioned by signed Tenant and Karma car. Simple condition rows
and advanced expression text use the same AST and binary codec. The form explicitly selects
true/false transition reports; zero-zero rules require calculation-only mode. A local revision
and its matching confirmed Rule ID share a row. INI/TXT imports
retain original source and opaque definitions; importing never dispatches device commands.
Each online rule change has a separate review against both confirmed snapshots, the selected
target and exact record. A later matching complete readback retires only the exact submitted
local revision, while preserving later edits and its local display name. Failed or uncertain
submissions retain the draft until matching evidence is available.
The [development workflow](development.md#background-device-configuration-reads)
describes authoring, exports and submission.

A lost browser response blocks new submissions until saved operations are successfully
refreshed. A failed reconciliation read keeps the draft blocked and retries every five seconds
even without a previously known pending operation. Manual refresh remains available.

## Karma pull monitoring

Fleet's `karma-monitoring` module owns the separate Tenant/Branch-scoped
`karmaMonitoringSettings`, `karmaMonitoringTruck` and `karmaMonitoringEvent` tables.
No existing Fleet table references them. Monitoring is disabled by default through
`FLEET_KARMA_MONITORING_ENABLED` and each Branch's settings. A ten-second NestJS tick
uses `waitForCompletion` and persisted poll times/cursors. Defaults are a 60-second status
poll, 15-minute no-data threshold, hourly diagnostic history and fault-logger reads, and
10-day retention. Settings validate status 30–3600 seconds, offline 2–1440 minutes,
history 5–1440 minutes, commands 15–1440 minutes and retention 1–30 days.

The authenticated internal Karma Client endpoints `POST /internal/karma-monitoring/status`
and `/history` use the existing machine token and bounded transport. Status uses account-wide
`GET /cars` plus bulk `GET /location` (two Karma calls per minute for ten trucks per enabled
Branch at defaults, excluding session renewal and separate fault reads). `lastDataAt` uses the
source `edt` interpreted as UTC, not the polling time or the undocumented `pdt` reception field;
bulk response coverage and timestamp semantics still require live verification. Trucks with no
fresh data are described as “no data since”, without inferring power state.

History uses the existing diagnostic-history source, bounds and decoder through `GET /events`
with `date_type=utc` and a first-pull date window starting at now minus `retentionDays`. It requests
`eid` 33 and continues forward from the persisted message-ID cursor without date parameters.
Each full 500-row page continues on the next tick; a short page returns to the configured interval.
Response order is normalized while car/device identity remains verified. Only eData fault reports
`413` (OBD), `418` (FMS) and `419` (SPN/FMI) apply: each decoded entry carrying a code or SPN/FMI
produces one deduplicated `FAULT_REPORTED` event. Undecoded fault
reports produce `FAULT_REPORT_UNDECODED` events and do not count towards trucks with faults;
generic tracker/OBD events (`eid` 2/70), acknowledgements and communication reports are ignored.
Events use source `edt`, falling back to `pdt` when `edt` is missing; missing source times and
records older than retention are skipped. `recordedAt` remains the retrieval time. Raw records and
reported ADDED/REMOVED/UNKNOWN status remain available. Truck fault counts and latest faults use
only `FAULT_REPORTED` events within retention, not a claim about all currently active faults.

Online trucks request only `READ_FAULT_LOGGER` through DeviceOperationsService when dispatch is
enabled and the existing account-wide active-car constraint permits it. Operations carry
`monitoringOrigin`; user operation histories exclude them. Requests and terminal outcomes are logged,
including “not acknowledged”, faults, unresolved reports and failures. A type byte alone does not
prove an empty logger. Monitoring never clears faults or sends configuration writes. Pending reads
are reconciled even after a Branch disables monitoring. Daily retention deletes old events and
monitoring operations only; settings, truck state and history watermarks remain.

The [Fleet SDL](../../../apps/fleet/src/modules/karma-monitoring/karma-monitoring.graphql) exposes
`fleetKarmaMonitoringSettings`, `updateFleetKarmaMonitoringSettings`,
`fleetKarmaMonitoringTrucks` and `fleetKarmaMonitoringEvents`, using distinct
`FleetKarmaMonitoring*` types. Lists use scoped snapshots, bounded offset pagination,
search/ID selection and explicit filters; event logs are newest first and constrained by retention.
Trucks include latest data/no-data times, reported faults and the latest command outcome.

Open **Karma Client → Monitoring** for the selected Branch. **Trucks** shows Branch-wide
online/no-data/report KPIs, status and fault-report filters, the last source data in the Branch
time zone with relative age, no-data time, retained report count/latest code and the last fault-read
outcome. Its Diagnostics link opens the real truck history. **Faults** lists retained source reports,
including reported removals; **Log** lists newest events with truck, kind and inclusive Branch-date
filters and pagination. Details show the original source record. Visible monitoring pages refresh
every 60 seconds. Reports in the window are not an active-fault inventory.

**Karma Client → Settings** edits all monitoring switches, intervals and retention (10 days by
default) for the selected Branch. Save confirms the stored settings; reducing retention can remove
older records. The disabled state links here and explains the required server monitoring switch.
The page cannot observe the server switches. Fault reads send only the read-only logger command to
online trucks at the configured interval and also require server device commands to be enabled.
