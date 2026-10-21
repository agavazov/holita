# Discocan architecture

Discocan covers fleet telemetry. Its implemented Fleet modules are Vehicles, Devices, Drivers,
Vehicle groups, Telemetry (status samples and the data clock), Trips, Events (alerts),
Service tasks, Overview and Settings.
The [shared architecture](../architecture/overview.md) describes applications, execution and tooling.
The shared Branch concept and its domain meaning are explained in [the domain index](README.md#terminology).
Fleet also owns [background device configuration reads and parameter changes](#background-device-configuration-reads).

## Persistence ownership

One PostgreSQL instance contains independent Core/Fleet development and test databases,
with distinct owner/login roles. Admin/Gateway have no Prisma client or database credentials.
Each owning service has its own schema, reviewed SQL migrations and generated client.
Core owns the [Tenant/Branch foundation](../ecommerce/branches.md) currently reused as Discocan organizational scope.
Fleet owns Vehicle, Device, Driver, VehicleGroup, VehicleStatusSample, Trip, FleetEvent,
ServiceTask, FleetSettings and FleetDeviceOperation plus the shared versioned Simple eData vendor catalog. Both services
preserve their applied migration history and add a Branch rename migration. Fleet also retains
its additive catalog migration and the additive `20261018100000_fleet_master_data`,
`20261018110000_fleet_activity`, `20261020110000_device_stock` and
`20261020220000_fleet_settings`, `20261021000000_device_configuration_reads` and
`20261021100000_device_parameter_changes` migrations. Branch and every Fleet business table have
mandatory tenantId physically second after id; Fleet branchId is physically third (new tables
declare them in that order; the master data columns are appended to Vehicle and Device).
Tenant data is inserted by the seed, not by schema migrations.

The [Simple eData catalog](erm-resources/simple-edata-catalog/README.md) is common
manufacturer reference data without Tenant/Branch columns. Seven related tables preserve
version/source identity, parameters, sets, ordered members, categories and profiles.
Only the local offline CLI imports it. DeviceOperations exposes eligible predefined
parameters through `fleetDeviceParameterPresets` and checks catalog/profile membership
before additions. There is no catalog editing/import API. This scope does not change
Vehicle/Device isolation.

Vehicle has UUID, tenantId, branchId, required License Plate (32 characters, not unique),
nullable Notes (2000), Fleet number (16), type, make/model (64), model year (SMALLINT), VIN (17),
fuel type, tank capacity (SMALLINT litres), status (default `ACTIVE`), groupId, currentDriverId
and timestamps. Device has UUID, tenantId, branchId, required 15-digit IMEI, nullable vehicleId,
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
Vehicle. Unassigned Devices represent stock. The `device_stock` migration only removes the
Vehicle column's NOT NULL requirement, preserving rows, indexes and scoped foreign keys.
There is no cross-database Branch foreign key.

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

The optional [Fleet demo seed](development.md#fleet-demo-data) inserts richer synthetic Discordia
data with stable IDs and a fixed anchor. Its initial transaction takes a transaction-scoped
`pg_advisory_xact_lock` keyed by the seed identity, schema, Tenant and Branch before checking
reserved IDs, natural keys or the anchor. Master records, service tasks and the anchor sample
are inserted in that transaction. The lock releases at commit or rollback; subsequent activity
batches insert missing records without holding it. Concurrent runs must use the same persisted
anchor, and existing records remain unchanged.

Tests deploy migrations into random schemas in dedicated test databases and drop only their
own schema. Development connections, broad resets and shared truncation are not test fixtures.

### Branch settings

The concrete [Settings module](../../apps/fleet/src/modules/settings/settings.module.ts)
owns `FleetSettings`, with UUID/timestamps and a unique `(tenantId, branchId)` key. Its additive
[migration](../../apps/fleet/prisma/migrations/20261020220000_fleet_settings/migration.sql)
preserves existing rows and adds database checks for the four time zones and threshold bounds.
The [Settings SDL](../../apps/fleet/src/modules/settings/settings.graphql) exposes
`fleetSettings` and `updateFleetSettings(input: UpdateFleetSettingsInput!)`. Input replaces all
six fields; tenant and Branch come from verified request context. The mutation verifies the
Branch through Core before a scoped upsert. A read without a saved row returns explicit defaults
without inserting one:

| Field               | Default        | Accepted values                                                        |
| ------------------- | -------------- | ---------------------------------------------------------------------- |
| `timeZone`          | `Europe/Sofia` | `Europe/Sofia`, `Europe/Bucharest`, `Europe/Athens`, `Europe/Belgrade` |
| `distanceUnit`      | `KM`           | `KM`, `MI`                                                             |
| `volumeUnit`        | `LITRE`        | `LITRE`, `US_GALLON`                                                   |
| `lowFuelPct`        | `12`           | Integer 1–50                                                           |
| `notReportingHours` | `48`           | Integer 1–168                                                          |
| `speedLimitKph`     | `90`           | Integer 30–130                                                         |

`lowFuelPct` changes the fresh-reading LOW boundary (strictly below it) in vehicle state and
KPIs; fuel freshness remains six elapsed hours. `notReportingHours` changes vehicle
NOT_CONNECTED and assigned-device OFFLINE boundaries against the Branch data clock; a report
exactly on the cutoff still reports. Stock stays IN_STOCK. Pure TypeScript classifiers receive
the scoped settings. The concrete [settings SQL](../../apps/fleet/src/modules/settings/settings.sql.ts)
returns one scoped row, with defaults when absent, within the caller's snapshot. Vehicles and
Devices derived lists and Overview use it before filtering, sorting, paging and counting;
Vehicles retains those threshold values with its selected facts in the same `RepeatableRead`
transaction. There is no process-global settings cache or per-row settings query.

`FleetClock.now()` supplies the instant for business dates in the configured time zone, including
driver document status, service urgency, completion-date validation and business-date summaries.
`fleetDataClock` returns that `businessDate` and the configured `timeZone` alongside telemetry
`asOf`. Vehicles created-date conditions use that zone. Overview's daily buckets and today's
distance use the calendar date of telemetry `asOf` in that zone; changing the zone does not move
either clock. Trip/score/statistics windows remain fixed elapsed-day windows ending at `asOf`,
and sample freshness and trip in-progress limits remain elapsed hours.

Distance and volume units are display preferences. Stored measurements and GraphQL measurements,
numeric filters and sort values remain canonical km, km/h and litres; money remains EUR cents.
`speedLimitKph` is a stored reference only. Saving settings does not generate alerts, send device
commands or configure notification delivery; the SDL has no notification fields and no
notifications provider is implemented. Branch
names remain owned by [Core's selected-Tenant/Branch rename contract](../ecommerce/branches.md#graphql-contracts),
separate from Fleet settings and without importing another application's implementation.

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
[Event](../../apps/fleet/src/modules/events/events.graphql),
[Service task](../../apps/fleet/src/modules/service-tasks/service-tasks.graphql),
[Overview](../../apps/fleet/src/modules/overview/overview.graphql) and
[Settings](../../apps/fleet/src/modules/settings/settings.graphql) SDL extend it,
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

Public demo discovery exposes `tenants` and `demoLogin`. Core authenticated queries are
`branches` and `branch`; `updateBranchName` uses Core's selected Branch contract. Fleet exposes
list and single-record queries for Vehicles, Devices,
Drivers, Vehicle groups, Trips, Events and Service tasks, plus `fleetVehicleSummary`,
`fleetDeviceSummary`, `fleetDriverSummary`, `fleetTripSummary`, `fleetServiceSummary`,
`fleetDriverScorecard`, `fleetDataClock`, `fleetVehicleSamples`, `fleetAlertCounts`,
`fleetManeuverCounts`, `fleetOverview`, `fleetDailyDistance` and `fleetSettings`. Branch summaries
are independent
of list search, filters and pagination; scorecard and aggregate semantics are described in
[additional list conditions and aggregates](fleet.md#additional-list-conditions-and-aggregates).
Mutations create/update/delete FleetVehicle, FleetDevice, FleetDriver and FleetVehicleGroup,
deactivate a Vehicle, record an odometer reading, acknowledge/resolve/reopen an alert and
create/update/complete/cancel/delete a Service task, and replace preferences with
`updateFleetSettings`. Batch mutations are `deleteFleetVehicles`,
`deactivateFleetVehicles`, `deleteFleetDevices`, `deleteFleetDrivers`, `deactivateFleetDrivers`,
`acknowledgeFleetAlerts`, `cancelFleetServiceTasks` and `deleteFleetServiceTasks`. They accept
1–100 unique IDs and return `succeededIds` plus independent failures, preserving record
protections and alert optimistic concurrency. There is no navigation-badge query;
`fleetAlertCounts` serves only the alert list and ignores actionable and included/excluded
alert-status predicates while retaining the other search and filters.
Only FleetVehicle and FleetDevice are federation entities (`@key(fields: "id")`) and
carry `branch: Branch!`; their reference resolution computes the same derived values as the
list for one ID.
All Branch/business operations require a signed demo session in Authorization. Business operations additionally require a valid `x-branch-id` UUID. Inputs never accept tenantId or branchId.
Repository predicates, totals, relation lookup and federation reference resolution always include the verified Tenant and active Branch.
Foreign IDs appear as NOT_FOUND. Creation and the settings upsert check Branch existence through
Core once per Fleet HTTP request; ordinary business read/update/delete do not make that network
call. Requesting a
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

| Query                | Search fields                                                                                          | Sort fields (default)                                                                                                                                                                                                             | Filter                                                                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fleetVehicles`      | plate, Fleet number, VIN, make, model, notes, current driver names                                     | `LICENSE_PLATE`, `FLEET_NUMBER`, `CREATED_AT`, `UPDATED_AT`, `STATUS`, `LAST_REPORTED_AT`, `ODOMETER_KM` (`CREATED_AT DESC`)                                                                                                      | statuses, vehicleTypes, fuelTypes, groupIds, hasGroup, currentDriverIds, hasDriver, hasDevice, hasOpenAlerts; `allOf` adds activity, exclusions, make, model year, odometer and created-date conditions                                                                |
| `fleetDevices`       | IMEI, firmware, SIM phone/ICCID, model, vehicle plate                                                  | `IMEI`, `INSTALLED_AT`, `CREATED_AT`, `STATUS`, `VEHICLE_LICENSE_PLATE`, `LAST_REPORTED_AT` (`CREATED_AT DESC`)                                                                                                                   | models, options (all given), vehicleIds; `allOf` adds status/model inclusion/exclusion, literal firmware equality/inequality/prefix and hasVehicle                                                                                                                     |
| `fleetDrivers`       | first name, last name, employee number, identification key, phone                                      | `NAME` (then last name), `LAST_NAME` (then first name), `EMPLOYEE_NUMBER`, `LICENSE_EXPIRES_ON`, `TACHOGRAPH_CARD_EXPIRES_ON`, `CREATED_AT`, `STATUS`, `DRIVING_SCORE_30D`, `TRIP_COUNT_30D`, `DISTANCE_30D_KM` (`LAST_NAME ASC`) | statuses, licenseCategories (any given), documentsExpireWithinDays 0–365 (expired included), hasVehicle; `allOf` adds status/assigned-Vehicle exclusions, 30-day score 0–100, trip count 0–2,147,483,647, distance 0–10,000,000 km and document-date conditions        |
| `fleetVehicleGroups` | name, description                                                                                      | `NAME`, `CREATED_AT` (`NAME ASC`)                                                                                                                                                                                                 | —                                                                                                                                                                                                                                                                      |
| `fleetTrips`         | vehicle plate and Fleet number, driver names, start/end address                                        | `STARTED_AT`, `DISTANCE_KM`, `DRIVING_SCORE`, `DURATION_SECONDS` (`STARTED_AT DESC`; others then `startedAt DESC`)                                                                                                                | startedFrom/startedTo (half-open), vehicleIds, driverIds, hasDriver, scored, drivingScoreBelow 0–100, hasEnd; `allOf` adds Vehicle/Driver exclusions, distance 0–5,000 km, score 0–100 and hasEvents (driving maneuvers); page adds filtered `totalDistanceKm`         |
| `fleetEvents`        | vehicle plate and Fleet number, driver names, address, trouble code, details, remark, event-kind names | `OCCURRED_AT`, `SEVERITY` (INFO < WARNING < CRITICAL), `ALERT_STATUS` (OPEN < ACKNOWLEDGED < RESOLVED; null last); latter two then `occurredAt DESC` (`OCCURRED_AT DESC`)                                                         | actionable, alertStatuses, severities, kinds, vehicleIds, driverIds, tripIds, occurredFrom/occurredTo (half-open); `allOf` adds independent repeats and status/severity/kind/Vehicle/Driver exclusions                                                                 |
| `fleetServiceTasks`  | title, workshop, notes, service-type names, vehicle plate and Fleet number                             | `URGENCY` (then `dueOn`, remaining km), `DUE_ON`, `COMPLETED_ON`, `CREATED_AT`, `TASK`, `VEHICLE_LICENSE_PLATE`, `COST_CENTS` (`URGENCY ASC`)                                                                                     | statuses, urgencies (PLANNED only), serviceTypes, vehicleIds, completedFrom/completedTo (closed `Date` range); `allOf` adds Vehicle status, exclusions, literal task text/translated untitled types, due dates, missing due date/cost and cost 0–100,000,000 EUR cents |

All lists except Vehicle groups accept at most 50 nonrecursive `filter.allOf` conditions.
Every condition and present field applies with AND, preserving repeated or contradictory
predicates. Derived filters and sorts apply before pagination and counting. See
[additional list conditions and aggregates](fleet.md#additional-list-conditions-and-aggregates)
for feature-specific null, exclusion, range and summary semantics.

`DateTime` ranges are half-open (`from` inclusive, `to` exclusive, `to` after `from`); `Date`
ranges are closed. `fleetServiceTasks` computes urgency before filtering and paging it with its
total in the same `RepeatableRead` transaction; tasks that are not PLANNED have no urgency and
sort last in both directions. Vehicles also computes activity, latest device report and latest
non-null odometer before filtering/sorting/paging/counting. Its list and summary reuse telemetry's
latest-facts SQL, scoped settings and shared fixed thresholds. The list retains the complete
vehicle state and OPEN
alert count from that snapshot and loads stored references for the selected IDs in the same
transaction, preserving the SQL order and final `id DESC` tie-breaker.
Status order is ACTIVE, IN_WORKSHOP, INACTIVE; nullable values sort last in both directions.

Vehicles `filter.allOf` accepts at most 50 nonrecursive `FleetVehicleCondition` inputs. Every
entry and every present field applies with AND; repeated or contradictory conditions are kept.
Conditions support statuses, activities, types and groups with inclusion/exclusion lists;
fuel types, current drivers and the existing has-group/driver/device/open-alert booleans;
case-insensitive literal make contains/equality; model-year equality, strict above/below and
inclusive from/to; strict odometer above/below and inclusive from/to; and created calendar
dates in the configured Branch time zone (after/before exclusive, from/to inclusive). Excluding optional types or
groups includes rows with null values. Null numeric values do not match numeric comparisons.

`fleetVehicleSummary` returns the complete Branch's data clock and exact counts independent of
search, filters and page: non-INACTIVE vehicles, IN_WORKSHOP vehicles, MOVING and NOT_CONNECTED
activities, OPEN alerts and LOW fuel status. Empty Branch counts are zero with a null data clock.
`deleteFleetVehicles` and `deactivateFleetVehicles` accept 1–100 unique IDs, retain scope per
record and return `succeededIds` plus independent failures (`id`, public code, message).
Expected missing/blocked records do not stop the submitted batch. Deactivation clears the
current driver; deletion preserves the existing history/device restrictions. Single-record
mutations remain available.

Raw SQL is limited to vehicle/device/driver facts and their derived lists and summaries,
Trip duration/list/summary, Overview and daily-distance aggregates, service urgency,
distance-weighted driver scores and the scoped settings/default row in those queries, plus the
scoped Vehicle/Driver row locks and the demo seed's
scoped advisory lock described here. It uses
`$queryRaw` with `Prisma.sql` only, schema-qualifies every table with
[`fleetTable`](../../apps/fleet/src/database/sql.ts) (the pg adapter does not set
`search_path`), repeats the Tenant/Branch predicate on every table reference, casts every
parameter, returns `::int`/`::float8` aggregates and `::text` enums and dates, and parses the
`unknown` rows with concrete readers. Everything else uses the Prisma query API.

MANUAL odometer insertion locks its scoped non-INACTIVE Vehicle with `FOR NO KEY UPDATE`,
then repeats latest-reading validation before inserting. Driver deactivation and every
Vehicle create/update that assigns a driver take the same scoped Driver row lock, then
recheck status or assigned vehicles. These write transactions use READ COMMITTED so a waiter
sees the preceding commit. Core existence checks run before entering the transaction.

Links to other records use reference types with stored fields only: `FleetVehicleRef`
(`id licensePlate fleetNumber vehicleType status`) on `FleetDevice.vehicle` and
`FleetDriver.vehicles`, `FleetTrip.vehicle`, `FleetEvent.vehicle` and `FleetServiceTask.vehicle`,
`FleetDriverRef` (`id firstName lastName employeeNumber status`) on `FleetVehicle.currentDriver`,
`FleetTrip.driver` and `FleetEvent.driver`, and `FleetVehicleGroupRef` (`id name colorToken`) on
`FleetVehicle.group`. Repositories load stored references and counts with the records or through
scoped batch reads; `documentStatus` is computed by a pure function from the business date.
Derived facts used by list filters or sorting are retained with selection and totals in the
same `RepeatableRead` transaction. Vehicles retains state and OPEN alert counts; Devices retains
connectivity and last-report time; Drivers retains the Branch data clock and its 30-day distance,
trip count and weighted score. Trips retains stored trip rows, chronological driving events,
filtered distance total and the Branch data clock; duration, maneuver count and `inProgress`
are computed from those captured values. Services must not replace these with newer facts
after selecting the page.

Display-only derived fields that do not participate in that list's filters or sorting can use
later scoped batches, including Vehicle `nextService` and Driver maneuver rate. Single-record,
federation-reference and mutation responses compute current values through the owning module's
concrete helpers. These boundaries do not provide one transaction for an entire GraphQL response,
separate summary queries or later display-only reads. A type with derived values is returned
only by its own module, except the documented `FleetVehicle.nextService`, a full
`FleetServiceTask`. `FleetEvent` exposes `tripId`
without a `trip` field and `FleetVehicle` `deviceCount` without a device list. There is no
per-row field resolver query. Text validation trims, counts Unicode code points and rejects NUL;
optional fields can be cleared to null. Duplicate unique values are BAD_USER_INPUT with every
duplicated field in one error: services pre-check them in scope and map a concurrent unique
violation by the index name the pg adapter reports (`meta.driverAdapterError.cause.constraint`).
Related IDs outside the Branch are BAD_USER_INPUT on the input field. Deletion blocked by a
foreign key is CONFLICT with an entity message.

## Angular admin foundation

The standalone Angular flow is component → concrete feature API → generated TypedDocumentNode
→ Apollo Angular/HttpLink → Gateway. Login owns the standalone login view and sequential
Tenant/Branch selection. A candidate token loads tenant-scoped Branches through a disposable client;
changing Tenant cancels discovery and ignores late tokens. Submitting a valid Branch activates the
tab session and opens Overview. AdminWorkspace coordinates the common session, language,
login and shell. Its component-scoped BranchContext owns authenticated discovery and
Branch route selection; the shell receives explicit inputs and emits Branch changes
without business data access. KarmaWorkspace consumes only AdminWorkspace session/language,
while FleetWorkspace also consumes BranchContext. Karma routes declare `requiresBranch: false`.
Routes use `/bg` or `/en`, then `/:branchId/fleet/` with Overview, Alerts, Trip log,
Vehicles, Drivers, Devices, Maintenance and `settings/groups`. Editable lists use `/new`
and `/:recordId/edit`; details, scorecards and profile tabs use the concrete routes in
[`fleet.routes.ts`](../../apps/admin/src/app/features/fleet/fleet.routes.ts).
Previous `/reference` URLs redirect to `/fleet`, preserving the resource,
editor path, query parameters and fragment. The language root shows Login while signed out and redirects to the saved
(or first available) Branch's Overview while signed in; `/:branchId/fleet` also opens Overview.
There is no Branch list landing page. The header keeps its Branch switcher. Switching Branches preserves the enabled
current business section and resets list context. Language switching preserves path/query/hash.
Unknown Branches and disabled Fleet never start business requests.

FleetWorkspace keys business views by session/Branch/language/resource/record. Lists retain their
state while child-route drawers open and close; the routed editor is recreated when its record
or workspace identity changes. Vehicle profile tabs retain their record client and keep independent
table pagination in the URL. Each mounted page/editor owns an immutable session/Branch/language-scoped
Apollo client and InMemoryCache. A → B → A creates a fresh A client.
Reads unsubscribe on retirement; submitted writes settle with their captured client and affect
only its cache. Obsolete callbacks cannot navigate, notify or mutate a new workspace.

Vehicles composes the shared `VehiclesView` and `VehicleDrawer` with concrete API-backed hosts.
`UrlListState` owns debounced search, validated AND conditions, sorting and paging; `vehicle-query.ts`
maps them to generated variables, including configured Branch calendar-date conditions. A separate
whole-Branch summary supplies KPIs and the nullable data clock. Activity and fuel freshness come
from server-derived state. The UI preserves an absent clock instead of inventing one.
The full typed editor maps optional empty values to null and loads bounded pages of group and
driver choices through its own captured client.

Vehicles row and selection actions use one `ids[]` delete/deactivate mutation per submission.
The response preserves per-record successes and failures; successful deleted rows remain hidden
if refresh fails, and failed selections stay available for retry. One shared operation toast
reports the result, with persistent partial-failure details. Submitted batches settle in their
captured scope after navigation, while obsolete callbacks cannot update another workspace.
Devices, Drivers, Alerts acknowledgment and Maintenance cancel/delete use their own scoped
IDs-array mutations with the same partial-result and captured-client lifecycle.
Typed Reactive Forms retain failed drafts, focus field errors and guard dirty navigation.
Device Vehicle choices load through bounded pages in its captured editor client; assignment may
be cleared to stock. Multiple Devices can use the same Vehicle. Concrete hosts, supported fields
and workflows are indexed in [Fleet admin](fleet.md#angular-foundation).

The document title is `<page> · holita` (`Sign in · holita` / `Вход · holita` on Login).
The [admin design system](../admin-design-system.md#shell) defines the shell and feature
presentation: a desktop sidebar that collapses to a persisted rail whose links keep their names
and tooltips, a modal navigation drawer below 1024px that traps focus and closes on Escape,
backdrop, navigation and at 1024px, and one topbar row at every width with the breadcrumb and the
Branch, language and account menus (theme switch and Sign out), so resizing keeps editor drafts.
The account menu names the tenant. The notification bell is labelled Demo and explains that
delivery is unavailable until a provider is connected; no fake feed or business-count badge is
supplied. The sidebar ends with `holita · <tenant>`. Light/dark preference uses
`holita.admin.theme`; denied storage leaves the switch usable and reports its failure.
Bulgarian/English catalogs supply shell and all live Fleet UI text. `AdminWorkspace` owns the
shared operation-toast outlet and its scoped `MessageService` above login and signed-in content;
changing the workspace clears its messages. Load and field errors remain inline. Every sidebar navigation link and truck-data section
link pairs its visible label with a decorative inline PrimeIcons SVG. Icons inherit the link color
and remain hidden from assistive technology so labels supply accessible names. The preset
registers only the rendered PrimeNG controls and their dependencies. Public startup config
selects GraphQL URL and availability; a developer's PrimeUI license key belongs only in the
Git-ignored `config.local.json` ([development](development.md#telemetry-admin)).

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
The read-only table fetches all rows on entry or Refresh. Registration, car ID and device ID
search, a project selector and 25/50/100-row pagination operate on that complete account response
without another upstream read. `q`, `project`, `size` and `first` retain list state in the URL;
filter changes reset the page and shortened refreshed lists clamp the visible page.
Registration links open a dedicated `/cars/:recordId` detail route with the verified car fields,
Refresh and a return link. All six truck sections share a header with registration/ID and
Overview, eData, Location, Trips, Events and Driving profile navigation links. Bounded
`listQ`, `listProject`, `listSize` and `listFirst` context restores the originating list;
history filters and cursors are not carried between sections with different clock semantics.
Registration links use the shared `content-link` styling, matching the Fleet tables in both themes.
Missing/invalid IDs show a not-found message; refresh failures retain previous details.
Truck details place registration, device and resolved project/time-zone labels first, followed
by the last-known location. A closed Source fields disclosure retains every original truck field.
All Karma views have Bulgarian/English labels and use the admin theme; `styles/_legacy-karma.scss`
maps their legacy classes to the design-system tokens.
Search fields, filter actions, pagination and detail grids share the same token-based Karma
patterns. Narrow list tables pin a compact identity cell with its available View action while
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
all 13 verified fields and offers a Google Maps link only for valid coordinate pairs.
Zero coordinates are valid. With optional browser `googleMapsEmbedApiKey` configuration,
the location page embeds Google Maps after the user requests it. The fixed Google Embed URL
contains validated coordinates and the public browser key; no Karma session or credential is sent.
Without that key, the external map link remains available. Truck details load a last-known summary independently; its failure
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
eData and Event dialogs show message/time summaries before their content and a closed
Source fields disclosure. Parameter readings and original event text stay directly visible;
the disclosure retains all original fields, including nulls, zeros and unknown codes.
Driving profile puts its applied API period above the categories and preserves original
identity fields in the same disclosure pattern.
Trip dialogs group the verified start/end points and offer Google Maps directions, optionally
embedded after user action with the configured browser key. These are suggested driving directions
between endpoints; the provider supplies no historical GPS trace for drawing the driven route.

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

## Background device configuration reads

Fleet's `DeviceOperationsModule` owns `FleetDeviceOperation`, its scoped GraphQL API and
an `@nestjs/schedule` worker in the existing Nest process. Operation kinds are
`READ_CONFIGURATION`, `ADD_PARAMETER` and `UPDATE_INTERVAL`. Karma Client exposes fixed
machine-authenticated internal HTTP operations for target lookup, parameter/profile reads,
one-definition changes and response-event scans. It has no database or background archive.

`requestFleetDeviceConfigurationRead` accepts the scoped Device UUID and an explicitly
selected Karma car/device pair. The server verifies the upstream device identity; it never
infers that the opaque Karma identifier equals IMEI. Each operation captures the local IMEI
and upstream identifiers. This is a per-request target selection, not automatic synchronization
or a persistent assignment between the two products. All public operation and snapshot reads
require verified Tenant/Branch scope and the normal Fleet availability guard. The worker uses
stored scope without retaining an expiring browser token. Demo authentication identifies a
Tenant, not a named operator or production device-control permission.

The additive migrations retain operation timestamps, deadline, lease, queue references,
response fragments, complete definitions, change intent, baseline operation, observed profile,
submitted definition, write uncertainty and sanitized error codes. Composite Device and
baseline-operation foreign keys preserve Tenant/Branch scope and protect referenced history.
A partial unique index permits one active operation per Karma car across all workspaces because
queue-to-response correlation is not established. Changing the configured Karma account
while operations are active is unsupported.

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

Parameter reads use command `301`, payload `0702BC`; profile reads use `301`, payload `1F`.
The only changing command is `301`, payload `02` followed by exactly one 22-byte definition.
The machine endpoint validates its ID and interval against the supplied definition and
rechecks upstream identity immediately before submission. It cannot accept arbitrary paths,
commands, set replacement (`01`), deletion (`10`), global settings or profile changes.
Karma response-event scans use UTC windows, bounded ID paging and device identity checks.
The background observation scan shares a 20-second deadline across target lookup, login
renewal and all event pages. Fleet allows 21 seconds for that internal HTTP call, within
the 30-second operation lease. Target lookup and device-request submission retain their
four-second provider budget and Fleet's 4.5-second internal-call budget; public Karma
queries retain their existing four-second operation bound.
Each caller also retains its own deadline while joining a shared pending upstream login;
a public read does not wait for the longer background deadline.
Original `401` messages and parsed 22-byte definitions are deduplicated and persisted across
polls/restarts, including incomplete multipart responses. Confirmation requires a consistent,
complete numbered series and complete bounded scan coverage. Each provider scan retains at
most 64 relevant fragments and 1000 definitions; Fleet's merged evidence is also bounded.
Unknown parameter IDs and zero intervals are preserved. Profile observations use separate
`416` evidence. Firmware updates and telemetry ingestion are outside this feature. An observed
configuration response is not a universal causal queue acknowledgment or evidence that CAN
measurements are arriving. The worker does not poll `/queue` or interpret a delivery state as
an applied configuration acknowledgment.

### Durable additions and interval changes

`requestFleetDeviceParameterAddition` and `requestFleetDeviceParameterIntervalUpdate` require
a complete baseline operation for the same scoped Device, current local IMEI and selected
Karma car/device pair. Fleet captures the baseline and intended ID/interval in a new queued
operation. Public inputs contain intent, not raw device definitions. A changed local or
upstream identity stops dispatch.

An addition first reads the profile (`READ_PROFILE`). Eligible presets come only from the
imported Monitor 9.56 EXE SHA-256
`01dd13e50c55fdf84078ce298bde72320d55bee458baa4c0d2a06fca7c0ca1a0`, extractor `1.0.0`,
schema `1`: Monitor-source rows must have one nonempty name per ID, no row issues and
membership in a set used by the observed profile. Fleet checks eligibility again before
writing. Catalog membership does not establish model/firmware compatibility or a live signal.
The [retained Monitor constructor evidence](erm-resources/edata-simple-protocol-v4.04/parameter-reporting.md#monitor-956-predefined-parameter-construction)
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

`fleetDeviceOperations` returns the latest 20 requests for one scoped Device;
`fleetDeviceOperation` retrieves a saved request by ID. `fleetDeviceConfigurationSnapshot`
independently returns the latest complete operation snapshot for the Device's current IMEI, so newer
failed reads cannot hide it beyond the history limit. A snapshot describes the observed
configuration at its recorded time; changes made outside holita can make it stale.

The admin opens `/:language/:branchId/fleet/devices/:recordId/configuration` from Diagnostics.
It reloads saved state on mount and polls it every five seconds while a request is pending.
Navigating away cancels browser reads but leaves the server operation intact. Each mounted
session/Branch/language/device owns its clients; submitted mutations settle against their
captured scope. The current shared-account Karma target picker has no Branch header.
After a target-conflict response, the page reloads the Karma choices. A changed device
identity clears the previous confirmation and requires a new confirmation before retrying.
With writes enabled, the same page offers one catalog addition or one existing interval
change. Its typed form previews target, baseline, ID and before/after interval, requires
explicit confirmation and a separate zero-interval confirmation, and guards dirty navigation.
A changed target or baseline invalidates the draft. Saved history shows kind, phase and
uncertainty; a lost browser response blocks new submissions until saved operations are
successfully refreshed. A failed reconciliation read keeps the draft blocked and retries every
five seconds even without a previously known pending operation. Manual refresh remains available.
