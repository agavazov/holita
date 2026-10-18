# Discocan architecture

Discocan covers fleet telemetry. Its implemented Fleet modules are Vehicles, Devices, Drivers,
Vehicle groups, Telemetry (status samples and the data clock), Trips, Events (alerts) and
Service tasks.
The [shared architecture](../architecture/overview.md) describes applications, execution and tooling.
The shared Branch concept and its domain meaning are explained in [the domain index](README.md#terminology).

## Persistence ownership

One PostgreSQL instance contains independent Core/Fleet development and test databases,
with distinct owner/login roles. Admin/Gateway have no Prisma client or database credentials.
Each owning service has its own schema, reviewed SQL migrations and generated client.
Core owns the [Tenant/Branch foundation](../ecommerce/branches.md) currently reused as Discocan organizational scope.
Fleet owns Vehicle, Device, Driver, VehicleGroup, VehicleStatusSample, Trip, FleetEvent and
ServiceTask plus the shared versioned Simple eData vendor catalog. Both services preserve their
applied migration history and add a Branch rename migration. Fleet also retains its additive
catalog migration and the additive `20261018100000_fleet_master_data` and
`20261018110000_fleet_activity` migrations. Branch and every Fleet business table have
mandatory tenantId physically second after id; Fleet branchId is physically third (new tables
declare them in that order; the master data columns are appended to Vehicle and Device).
Tenant data is inserted by the seed, not by schema migrations.

The [Simple eData catalog](erm-resources/simple-edata-catalog/README.md) is common
manufacturer reference data without Tenant/Branch columns. Seven related tables preserve
version/source identity, parameters, sets, ordered members, categories and profiles.
Only the local offline CLI imports it; it has no GraphQL endpoint or runtime device
configuration integration. This scope does not change Vehicle/Device isolation.

Vehicle has UUID, tenantId, branchId, required License Plate (32 characters, not unique),
nullable Notes (2000), Fleet number (16), type, make/model (64), model year (SMALLINT), VIN (17),
fuel type, tank capacity (SMALLINT litres), status (default `ACTIVE`), groupId, currentDriverId
and timestamps. Device has UUID, tenantId, branchId, required 15-digit IMEI, required vehicleId,
nullable model, an options enum array (default empty), firmware (32), SIM phone (20), ICCID
(22), installation time, notes and timestamps. IMEI stays a string, preserving leading zeros.
Driver has names (64), employee number and identification key (32), phone (20), email (254),
licence number (32), a licence category enum array (default empty), licence and tachograph
card expiry `DATE` columns, tachograph card number (16), status and notes. VehicleGroup has a
name (64), description (500) and a colour token enum `C1`–`C8` (a design-system slot).

Enums: `FleetVehicleType`, `FleetFuelType`, `FleetVehicleStatus`, `FleetDeviceModel`,
`FleetDeviceOption`, `FleetDriverStatus`, `FleetLicenseCategory`, `FleetGroupColor`; GraphQL
enums use identical names and values. Unique `(tenantId, branchId, …)` indexes cover Device IMEI,
Vehicle Fleet number and VIN, Driver employee number and identification key and VehicleGroup
name (NULLs are distinct); `(tenantId, branchId, id)` uniques are the composite foreign-key
targets. Composite foreign keys `(tenantId, branchId, vehicleId)`, `(tenantId, branchId, groupId)`
and `(tenantId, branchId, currentDriverId)` restrict deletion and update, so a related record is
always in the same Tenant/Branch. Indexes on `(tenantId, branchId, createdAt, id)`, Driver
`(tenantId, branchId, lastName, firstName, id)` and Vehicle group/driver columns serve the
default list orders and relation filters. A CHECK keeps IMEI at 15 digits; hand-written CHECKs in the master data migration enforce model
year 1950–2100, the VIN pattern, tank capacity 1–2000, `INACTIVE` vehicles without a driver, the
SIM/ICCID/phone patterns and non-null enum arrays with at most 13 options and 10 licence
categories (Prisma generates enum arrays as nullable columns). Several Devices may share a
Vehicle. There is no cross-database Branch foreign key.

The activity migration adds four Tenant/Branch-scoped tables and the enums `FleetDataSource`
(`DEMO`, `MANUAL`), `FleetEventKind` (the first nine are maneuvers), `FleetEventSeverity`,
`FleetAlertStatus`, `FleetServiceType` and `FleetServiceStatus`. Measurements are
`DOUBLE PRECISION` device readings; money is integer EUR cents (`costCents`, no currency column).

| Table                 | Content and keys                                                                                                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VehicleStatusSample` | Vehicle, reporting IMEI snapshot (null for MANUAL readings), source, recorded/received time, position, address, speed, heading, ignition, odometer, fuel, voltages, engine hours, coolant. Unique `(tenantId, branchId, vehicleId, deviceImei, recordedAt)` lets two devices report at the same instant |
| `Trip`                | Vehicle, optional driver, IMEI snapshot, start/end time, addresses, coordinates and odometers, distance, idle seconds, maximum speed, fuel used, driving and eco score. Unique `(tenantId, branchId, vehicleId, id)` is the event foreign-key target                                                    |
| `FleetEvent`          | Vehicle, optional trip and driver, IMEI snapshot, time, kind, severity, maneuver intensity 1–3, position, speed, measured/threshold value, trouble code, details, alert status with acknowledge/resolve times and remark                                                                                |
| `ServiceTask`         | Vehicle, type, status (default `PLANNED`), title, due date/odometer, completion date/odometer, workshop, replaced parts, cost, notes                                                                                                                                                                    |

Seven composite foreign keys `ON DELETE/UPDATE RESTRICT` keep every activity row in its vehicle's
Tenant/Branch; `FleetEvent (tenantId, branchId, vehicleId, tripId)` references the trip together
with the vehicle, so an event's trip always belongs to the event's vehicle. Vehicles and drivers
with activity history therefore cannot be deleted. Activity rows keep the IMEI as a snapshot
instead of a Device foreign key, so Devices with history stay deletable. Indexes serve the data
clock `(tenantId, branchId, recordedAt)`, latest state and odometer `(…, vehicleId, recordedAt
DESC)`, the default list orders `(…, startedAt DESC, id)` and `(…, occurredAt DESC, id)`, the alert
inbox `(…, alertStatus, occurredAt DESC, id)`, per-vehicle/driver/trip groupings and the service
`(…, status, dueOn, id)` and `(…, completedOn)` orders. Hand-written CHECKs enforce: MANUAL
samples are exactly the null-IMEI rows and carry only an odometer; trips and events are never
MANUAL; IMEI 15 digits; coordinates both null or both set within −90..90/−180..180; measurement
ranges (which also reject NaN and Infinity); trip end not before start and end odometer not below
start; maneuver-only intensity 1–3; the alert state machine (no alert fields without a status,
`OPEN` without times, `ACKNOWLEDGED` with an acknowledgement time, `RESOLVED` with a resolution
time, never on `INFO` events, times not before the event and resolution not before
acknowledgement); PLANNED tasks have a due value and no completion fields, DONE tasks a
completion date and CANCELLED tasks no completion or cost; odometers 0–10,000,000 and costs
0–100,000,000 cents.
Seeds insert RentalSofia, the stable Discordia and Sandbox Branches, two Discordia Vehicles and one Device. Repeated seeds skip existing keys and never overwrite edits. Fleet has no cross-database Tenant/Branch foreign key; creation verifies the tenant-scoped Branch through Core. Mandatory tenant predicates and composite indexes enforce application isolation; PostgreSQL has no row-level-security policy. Direct SQL access by the owning role can access every tenant.

Tests deploy migrations into random schemas in dedicated test databases and drop only their
own schema. Development connections, broad resets and shared truncation are not test fixtures.

## GraphQL contracts and context

[Core SDL](../../apps/core/src/modules/branches/branches.graphql) and the Fleet SDL files define
the API. Fleet's [common SDL](../../apps/fleet/src/graphql/common.graphql) declares the federation
link, the `DateTime` and `Date` scalars, the Branch reference and `FleetSortDirection`; then
[Vehicle](../../apps/fleet/src/modules/vehicles/vehicles.graphql) (base `Query`/`Mutation`),
[Device](../../apps/fleet/src/modules/devices/devices.graphql),
[Driver](../../apps/fleet/src/modules/drivers/drivers.graphql),
[Vehicle group](../../apps/fleet/src/modules/vehicle-groups/vehicle-groups.graphql),
[Telemetry](../../apps/fleet/src/modules/telemetry/telemetry.graphql),
[Trip](../../apps/fleet/src/modules/trips/trips.graphql),
[Event](../../apps/fleet/src/modules/events/events.graphql) and
[Service task](../../apps/fleet/src/modules/service-tasks/service-tasks.graphql) SDL extend it,
in that order in both `app.module.ts` and [contracts.mts](../../tools/graphql/contracts.mts).
Backend resolvers use generated types and delegate to concrete services/repositories.
Runtime SDL assets are copied into builds. Named Angular/Core lookup operations are explicit
inputs in contracts.mts. Codegen/composition/validation work
offline. Gateway loads a generated static supergraph without introspection or registry polling.

[Hand-written scalars](../../apps/fleet/src/graphql/scalars.ts) replace Nest's `DateTime`:
`DateTime` serializes a `Date` as UTC ISO with milliseconds and `Date` serializes a UTC-midnight
`Date` or a valid `YYYY-MM-DD`. Both accept any string as input (Router cannot validate custom
scalars) and the services validate it: `DateTime` needs `Z` or `±hh:mm` and years 2000–2100,
`Date` a real calendar day in 1900–2100. Malformed values are BAD_USER_INPUT with the input field
as path. Codegen maps server `DateTime` to `string` input / `Date` output and `Date` to `string`;
the admin uses strings.

Public demo discovery exposes tenants and demoLogin. Core/Fleet authenticated queries are
branches, branch, fleetVehicles, fleetVehicle, fleetDevices, fleetDevice, fleetDrivers,
fleetDriver, fleetDriverScorecard, fleetVehicleGroups, fleetVehicleGroup, fleetDataClock,
fleetVehicleSamples, fleetTrips, fleetTrip, fleetEvents, fleetEvent, fleetAlertCounts,
fleetManeuverCounts, fleetServiceTasks, fleetServiceTask and fleetServiceSummary. Mutations
create/update/delete FleetVehicle, FleetDevice, FleetDriver and FleetVehicleGroup, plus
`deactivateFleetVehicle`, `recordFleetOdometerReading`, `acknowledgeFleetAlert`,
`resolveFleetAlert`, `reopenFleetAlert` and create/update/complete/cancel/delete
FleetServiceTask. There is no navigation-badge query; `fleetAlertCounts` serves only the alert
list. Only FleetVehicle and FleetDevice are federation entities (`@key(fields: "id")`) and
carry `branch: Branch!`; their reference resolution computes the same derived values as the
list for one ID.
All Branch/business operations require a signed demo session in Authorization. Business operations additionally require a valid `x-branch-id` UUID. Inputs never accept tenantId or branchId.
Repository predicates, totals, relation lookup and federation reference resolution always include the verified Tenant and active Branch.
Foreign IDs appear as NOT_FOUND. Creation checks Branch existence through Core once per
Fleet HTTP request; read/update/delete do not make that network call. Requesting a
federated Branch field beyond its known ID (for example `branch { name }`) asks Core to resolve
its persisted Branch.

Gateway forwards Branch context without blanket Branch validation. Request IDs accept 1–100 ASCII
letters/digits or `._:-`; invalid/missing IDs are replaced with UUIDs. Responses/errors expose the
ID. Expected Nest exceptions map to BAD_USER_INPUT, NOT_FOUND, CONFLICT or SERVICE_UNAVAILABLE;
unexpected details remain hidden. BAD_USER_INPUT may carry `fieldErrors` whose paths match
`^[a-zA-Z][a-zA-Z0-9]*$` with messages of at most 300 characters. Creation's Core timeout is 3 seconds, Gateway's subgraph timeout
is 5 seconds. No global current Branch or cross-request Branch validation cache exists.
Tenant identity comes only from the HMAC-verified, expiring session. Gateway forwards Authorization; Core, Fleet and Karma Client independently verify it. Arbitrary tenant headers and entity representations cannot select a Tenant. Demo login deliberately allows anyone to choose any Tenant; it is not production identity or membership authorization.

`FLEET_ENABLED=false` rejects Fleet business and entity operations while preserving
schema composition and health. Angular startup availability hides navigation and gates direct routes.

### Standard list contract

Every Fleet list is one root query `(offset: Int! = 0, limit: Int! = 20, search: String,
ids: [ID!], filter: <Entity>Filter, sort: <Entity>Sort)` returning a page with `items`, `total`,
`offset` and `limit` (Vehicle groups have no filter and add `ungroupedVehicleCount`). Arguments
are validated in order with the argument name as `fieldErrors` path: verified scope
(`x-branch-id`), `offset` 0–2,147,483,647 and `limit` 1–100, `search`, `ids` (at most 100 unique
UUIDs), `filter` and `sort`. Search is trimmed, at most 200 code points without NUL and split
on Unicode whitespace into at most five tokens; every token must be a case-insensitive literal
substring (`%`, `_`, `\` escaped, ILIKE) of one search field, so a first and last name match
together while Cyrillic and Latin look-alike letters stay different. Filter fields left out or
null apply no constraint; lists hold 1–100 unique values; booleans require (`true`) or exclude
(`false`). Results sort by the chosen field with NULLS LAST for nullable fields, then secondary
keys, then `id DESC`. The page and its total are read in one `RepeatableRead` transaction with
the scope in the same `where`, so search, filters and IDs never reach another Tenant or Branch.

| Query                | Search fields                                                       | Sort fields (default)                                                                                                                | Filter                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fleetVehicles`      | plate, Fleet number, VIN, make, model                               | `LICENSE_PLATE`, `FLEET_NUMBER`, `CREATED_AT`, `UPDATED_AT` (`CREATED_AT DESC`)                                                      | statuses, vehicleTypes, fuelTypes, groupIds, hasGroup, currentDriverIds, hasDriver, hasDevice, hasOpenAlerts                                                  |
| `fleetDevices`       | IMEI, firmware, SIM phone, vehicle plate                            | `IMEI`, `INSTALLED_AT`, `CREATED_AT` (`CREATED_AT DESC`)                                                                             | models, options (all given), vehicleIds                                                                                                                       |
| `fleetDrivers`       | first name, last name, employee number, identification key, phone   | `LAST_NAME` (then first name), `EMPLOYEE_NUMBER`, `LICENSE_EXPIRES_ON`, `TACHOGRAPH_CARD_EXPIRES_ON`, `CREATED_AT` (`LAST_NAME ASC`) | statuses, licenseCategories (any given), documentsExpireWithinDays 0–365 (licence or card on or before business date + N, expired included), hasVehicle       |
| `fleetVehicleGroups` | name, description                                                   | `NAME`, `CREATED_AT` (`NAME ASC`)                                                                                                    | —                                                                                                                                                             |
| `fleetTrips`         | vehicle plate and Fleet number, driver names, start/end address     | `STARTED_AT`, `DISTANCE_KM`, `DRIVING_SCORE` (`STARTED_AT DESC`; others then `startedAt DESC`)                                       | startedFrom/startedTo (half-open), vehicleIds, driverIds, hasDriver, scored, drivingScoreBelow 0–100 (scored trips only), hasEnd; page adds `totalDistanceKm` |
| `fleetEvents`        | vehicle plate and Fleet number, driver names, address, trouble code | `OCCURRED_AT`, `SEVERITY` (INFO < WARNING < CRITICAL, then `occurredAt DESC`) (`OCCURRED_AT DESC`)                                   | actionable, alertStatuses, severities, kinds, vehicleIds, driverIds, tripIds, occurredFrom/occurredTo (half-open)                                             |
| `fleetServiceTasks`  | title, workshop, vehicle plate and Fleet number                     | `URGENCY` (then `dueOn`, remaining km), `DUE_ON`, `COMPLETED_ON`, `CREATED_AT` (`URGENCY ASC`)                                       | statuses, urgencies (PLANNED only), serviceTypes, vehicleIds, completedFrom/completedTo (`Date`, inclusive)                                                   |

`DateTime` ranges are half-open (`from` inclusive, `to` exclusive, `to` after `from`); `Date`
ranges are closed. `fleetServiceTasks` is the one list whose filter and sort use a derived value:
one scoped raw query computes urgency and pages it with its total in the same `RepeatableRead`
transaction; tasks that are not PLANNED have no urgency and sort last in both directions.

Raw SQL is limited to the vehicle facts (latest device sample and latest odometer per vehicle),
the service urgency queries and the distance-weighted driver score aggregate. It uses
`$queryRaw` with `Prisma.sql` only, schema-qualifies every table with
[`fleetTable`](../../apps/fleet/src/database/sql.ts) (the pg adapter does not set
`search_path`), repeats the Tenant/Branch predicate on every table reference, casts every
parameter, returns `::int`/`::float8` aggregates and `::text` enums and dates, and parses the
`unknown` rows with concrete readers. Everything else uses the Prisma query API.

Links to other records use reference types with stored fields only: `FleetVehicleRef`
(`id licensePlate fleetNumber vehicleType status`) on `FleetDevice.vehicle` and
`FleetDriver.vehicles`, `FleetTrip.vehicle`, `FleetEvent.vehicle` and `FleetServiceTask.vehicle`,
`FleetDriverRef` (`id firstName lastName employeeNumber status`) on `FleetVehicle.currentDriver`,
`FleetTrip.driver` and `FleetEvent.driver`, and `FleetVehicleGroupRef` (`id name colorToken`) on
`FleetVehicle.group`. Repositories load them, `deviceCount` and `vehicleCount` in the page query;
`documentStatus` is computed by a pure function from the business date. Values computed from
other rows or a clock are attached by the owning service for the whole page: vehicle state (one
data-clock aggregate and one raw facts query), open alert counts and the next service (one raw
urgency query), device `lastReportedAt`, driver 30-day statistics, and trip maneuver counts and
`inProgress`. A type with derived values is returned only by its own module, except the
documented `FleetVehicle.nextService`, a full `FleetServiceTask`. `FleetEvent` exposes `tripId`
without a `trip` field and `FleetVehicle` `deviceCount` without a device list. There is no
per-row field resolver query. Text validation trims, counts Unicode code points and rejects NUL;
optional fields can be cleared to null. Duplicate unique values are BAD_USER_INPUT with every
duplicated field in one error: services pre-check them in scope and map a concurrent unique
violation by the index name the pg adapter reports (`meta.driverAdapterError.cause.constraint`).
Related IDs outside the Branch are BAD_USER_INPUT on the input field. Deletion blocked by a
foreign key is CONFLICT with an entity message.

## Angular admin foundation

The standalone Angular flow is component → concrete feature API → generated TypedDocumentNode
→ Apollo Angular/HttpLink → Gateway. Login owns the standalone Sakai login view and sequential
Tenant/Branch selection. A candidate token loads tenant-scoped Branches through a disposable client;
changing Tenant cancels discovery and ignores late tokens. Submitting a valid Branch activates the
tab session and opens Vehicles. AdminWorkspace coordinates the common session, language,
login and shell. Its component-scoped BranchContext owns authenticated discovery and
Branch route selection; the shell receives explicit inputs and emits Branch changes
without business data access. KarmaWorkspace consumes only AdminWorkspace session/language,
while FleetWorkspace also consumes BranchContext. Karma routes declare `requiresBranch: false`.
Routes use `/bg` or `/en`, then `/:branchId/fleet/vehicles` or `/devices`, with `/new`
and `/:recordId/edit`. Previous `/reference` URLs redirect to `/fleet`, preserving the resource,
editor path, query parameters and fragment. The language root shows Login while signed out and redirects to the saved
(or first available) Branch's Vehicles while signed in. There is no Branch list landing page.
Fleet navigation contains Vehicles/Devices; the header keeps its Branch switcher. Choosing a Branch at login opens Vehicles; switching Branches preserves the enabled
current business section and resets list context. Language switching preserves path/query/hash.
Unknown Branches and disabled Fleet never start business requests.

FleetWorkspace keys child views by session/Branch/language/resource/editor/ID. Each mounted page/editor
owns an immutable session/Branch/language-scoped Apollo client and InMemoryCache. A → B → A creates a fresh A client.
Reads unsubscribe on retirement; submitted writes settle with their captured client and affect
only its cache. Obsolete callbacks cannot navigate, notify or mutate a new workspace.

Lists provide URL-backed search/sort/paging, selection and confirmed page-local sequential deletion.
Successful deletions remain removed after refresh failures; failed rows remain selected for retry.
Navigation retires confirmation callbacks and stops unsent deletes. Submitted writes still settle.
Typed Reactive Forms provide validation, server-field focus, null clearing, dirty navigation guards
and retained failed drafts. Device's remote Vehicle picker searches/pages through the captured
DevicesApi and hydrates the assigned Vehicle. Multiple Devices can use the same Vehicle.

The browser title is Admin. The header and login show only the logo mark.
Sakai defines the shell and feature presentation. The ignored [source](../development.md#sakai-source-reference)
is a visual reference only. PrimeNG Aura compatibility tokens and local Cyrillic-capable Lato use
Sakai's 14px root. Desktop header/sidebar are 56px/280px; content caps at 1504px on wide screens.
Below 992px, one Branch selector moves into a second 56px row without resetting editor drafts.
The mobile Drawer traps focus and supports Escape/backdrop dismissal; collapsed desktop links
are inert. The footer carries holita. Light/dark preference uses `holita.admin.theme`; denied
storage leaves the toggle usable and reports its failure. Bulgarian/English catalogs supply UI text.
Every sidebar navigation link and truck-data section link pairs its visible label with
a decorative inline PrimeIcons SVG. Icons inherit the link color, retain the Sakai
spacing and remain hidden from assistive technology so labels supply accessible names.
The trimmed preset contains implemented controls and their PrimeNG dependencies.
Public startup config selects GraphQL URL, availability and optional user-supplied PrimeUI license.

Demo sessions last eight hours and persist only in the browser tab sessionStorage. Logout navigates through the dirty-editor guard, clears the tab session and destroys discovery/business clients. Expiry retires the current workspace. Submitted writes retain their captured token and may settle after logout. Logout has no server-side token revocation. [Development](development.md#demo-tenant-login) describes configuration and production limitations.

## Karma Client

`apps/karma-client` is a separate NestJS federation subgraph. Gateway forwards the signed
admin session to its `karmaCars`, `karmaCar(id: ID!)`, `karmaEdata(input: KarmaEdataInput!)`,
`karmaLocation(carId: ID!)`, `karmaProjects`, `karmaTimeZones`, `karmaVersion`, `karmaTrips`, `karmaEvents`, `karmaDrivingProfile`, `karmaUsers` and `karmaRoles` queries. Karma Client verifies
that session independently and returns cars from one configured Karma account to all
authenticated tenants. No `x-branch-id` is required or used; all Karma reads are intentionally global. Fleet isolation remains unchanged.

A concrete Karma client authenticates with `POST /login` and requests the complete `GET /cars`
list with `karma_sid`. It keeps the upstream session only in process memory and shares pending
logins across callers. HTTP 401 or the HTTP-200 `{error: "Not logged in"}` response discards only
the rejected session and retries login/read once. A four-second abort signal bounds the whole
operation, including login and retry, within Gateway's five-second subgraph timeout.
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

Angular owns a fresh Apollo client/cache for each mounted session/language/truck view and sends
no Branch header. The route is mounted while authenticated even when Branch discovery is empty
or fails and when Fleet is disabled. Changing the Branch on this page updates the remembered
Branch without navigation or reloading Karma. Navigation, language changes, session replacement
and logout retire obsolete reads. Refresh retains the previous successful rows on failure.
The read-only table fetches all rows on entry or Refresh. Registration links open a dedicated
`/cars/:recordId` detail route with the verified car fields, Refresh and a return link.
Registration links use the shared `content-link` styling, matching the Fleet tables in both themes.
Missing/invalid IDs show a not-found message; refresh failures retain previous details.
All Karma views have Bulgarian/English labels and use the existing Sakai/PrimeNG theme.

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
a modal exposes every message field and a complete parameter table. Applied filters and
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
all 13 verified fields and offers an OpenStreetMap link only for valid coordinate pairs.
Zero coordinates are valid. Maps open on user action in a new tab; no map SDK or embedded
map requests are used. Truck details load a last-known summary independently; its failure
does not hide the truck.

Concrete reference reads validate complete project/time-zone lists, reject duplicate IDs
and expose original names. `/projects`, `/time-zones` and `/api-info` have separate account
menu entries under both language-prefixed Karma sections. Project/time-zone search and
local pagination cover the full returned list, with exact totals and 25/50/100 sizes
(default 50). Search/page/size stay in the URL across reload, Back and language changes.
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
Older/Newer, URL cursor/filter state and full row dialogs with keyboard close and focus
restoration. Events also accept at most 25 original event codes, including zero, and
use explicit UTC filtering. Trip/profile periods are source wall-clock values; their
provider timezone is unspecified and the UI discloses this. Source timestamps are
shown without implicit browser conversion. Profile starts with a seven-day wall-clock
range derived from the current UTC clock and supports replacing/expanding it; the
period aggregate needs no record paginator. Its nine category names, nullable scores
and weights remain original values, without a combined rating or invented scale.

Every mounted history/profile owns a fresh captured Apollo client/cache. Filter/period
or cursor changes cancel obsolete reads and clear old rows/details; same-query Refresh
retains prior successful values on failure. Browser history stores previous cursor
metadata for Newer, while separately opened cursors can use Latest. Truck/language/
session/navigation/logout retire clients. There is no automatic decoding, polling,
map SDK, upstream write or device command in these reads.

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
