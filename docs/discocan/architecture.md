# Discocan architecture

Discocan covers fleet telemetry. Its implemented Fleet modules are Vehicles, Devices, Drivers,
Vehicle groups, Telemetry (status samples and the data clock), Trips, Events (alerts),
Service tasks, Overview, Settings, device operations and Karma monitoring.
The [shared architecture](../architecture/overview.md) describes applications, execution and tooling.
The shared Branch concept and its domain meaning are explained in [the domain index](README.md#terminology).
Fleet also owns [background device configuration reads and parameter changes](#background-device-configuration-reads).

## Persistence ownership

One PostgreSQL instance contains independent Core/Fleet/ERM Server development and test databases,
with distinct owner/login roles. Admin/Gateway have no Prisma client or database credentials.
Each owning service has its own schema, reviewed SQL migrations and generated client.
Core owns the [Tenant/Branch foundation](../ecommerce/branches.md) currently reused as Discocan organizational scope.
Fleet owns Vehicle, Device, Driver, VehicleGroup, VehicleStatusSample, Trip, FleetEvent,
ServiceTask, FleetSettings and FleetDeviceOperation plus the shared versioned Simple eData vendor catalog. Both services
start with `20261102000000_baseline`; later changes preserve that history through new reviewed
migrations. Branch and every Fleet business table declare tenantId physically second after id;
Fleet branchId is physically third.
Tenant data is inserted by the seed, not by schema migrations.

ERM Server owns `ermConnection`, `ermFrame`, `ermCommand` and `ermEvent` records in `holita_erm`,
separately from Fleet business data. These provider-level records have no Tenant/Branch columns.
Frames retain exact bytes without CR LF, direction (`device`, `upstream`, `holita`), receive time,
parsed envelope, checksum state and partial flag. Connections retain lifecycle metadata and byte
counts; commands retain their request, outcome and exact response. Events decoded from device
`06`/`86` frames retain named raw tokens and trailing fields alongside parsed telemetry. Database
writes are asynchronous and failures do not stop forwarding or acknowledgements.

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

### ERM device ingestion

`apps/erm-server` is an independent NestJS host service with HTTP `/health` on loopback 11015
and a separate StarLink TCP listener on `0.0.0.0:11500` by default. It is outside `dev` and `kill`,
so HTTP application restarts leave device sessions open. Mode is selected from the first complete
device frame: units in `ERM_PRIMARY_UNITS` use primary mode, while other units keep byte-for-byte
mirror mode. Primary mode sends holita acknowledgements for `ERM_ACK_COMMANDS` and accepts
allowlisted commands through a loopback-only internal API protected by `ERM_INTERNAL_TOKEN`.
Karma remains connected in both modes; primary mode filters duplicate confirmations while keeping
Karma authentication and commands. Whole-frame writes prevent holita and Karma traffic from
interleaving. Raw daily UTC JSON Lines captures include holita frames and use private
directory/file permissions. Device `06`/`86` events are decoded using `ERM_EVENT_STRUCTURE` in both
modes. The existing relay remains available. There is no ERM GraphQL endpoint or Fleet processing
pipeline.
See the [application decision](../architecture/decisions/0006-erm-device-server.md) and
[service setup](development.md#erm-device-server).

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
[Overview](../../apps/fleet/src/modules/overview/overview.graphql),
[Settings](../../apps/fleet/src/modules/settings/settings.graphql),
[Device operations](../../apps/fleet/src/modules/device-operations/device-operations.graphql) and
[Karma monitoring](../../apps/fleet/src/modules/karma-monitoring/karma-monitoring.graphql) SDL extend it,
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
`fleetOverview`, `fleetDailyDistance` and `fleetSettings`. Branch summaries
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
unexpected details remain hidden. BAD_USER_INPUT may carry at most 30 `fieldErrors` whose paths
match `^[a-zA-Z][a-zA-Z0-9]*$` with compatibility messages of at most 300 UTF-16 units. Each
newly emitted field error includes a stable `code` for localization, independent of its English
message. Codes contain 1–64 ASCII uppercase letters, digits or underscores and start with a
letter. Core, Fleet, Karma Client and Gateway preserve valid unknown codes and accept legacy entries
without a code; invalid code metadata is omitted without discarding a valid path/message.
Fleet's `FieldErrorCode` union restricts application-emitted reasons; Core uses its own text-validation
subset. The wire format remains open to valid future codes. A source-contract spec checks this
vocabulary against the actual admin maps without importing another application's implementation.

| Code                            | Meaning                                                             | Admin mapping |
| ------------------------------- | ------------------------------------------------------------------- | ------------- |
| `INVALID_VALUE`                 | Generic invalid-value fallback                                      | Generic       |
| `REQUIRED`                      | A required value is absent or blank                                 | Generic       |
| `INVALID_TYPE`                  | Wrong input type; intentionally uses the generic invalid-value text | Generic       |
| `INVALID_FORMAT`                | Malformed or unsupported text/date format                           | Generic       |
| `TOO_LONG`                      | Text exceeds its maximum length                                     | Generic       |
| `TOO_MANY_ITEMS`                | List exceeds its maximum size                                       | Generic       |
| `DUPLICATE_VALUE`               | A value or record ID is repeated                                    | Generic       |
| `NOT_INTEGER`                   | A whole number is required                                          | Generic       |
| `OUT_OF_RANGE`                  | A numeric value or period exceeds its bounds                        | Generic       |
| `UNSUPPORTED_VALUE`             | Value is outside the supported enum/catalog choices                 | Generic       |
| `INVALID_RANGE`                 | Range endpoints are inconsistent                                    | Generic       |
| `ALREADY_EXISTS`                | A scoped unique value already exists                                | Fleet         |
| `DRIVER_ASSIGNED`               | An assignment must be removed before deactivation                   | Fleet         |
| `DRIVER_UNAVAILABLE`            | An active scoped Driver is required                                 | Fleet         |
| `VEHICLE_UNAVAILABLE`           | An available scoped Vehicle is required                             | Fleet         |
| `VEHICLE_INACTIVE`              | Reactivate the Vehicle before assigning a Driver                    | Fleet         |
| `GROUP_UNAVAILABLE`             | A scoped Vehicle group is required                                  | Fleet         |
| `MODEL_REQUIRED`                | Device options require a model                                      | Fleet         |
| `MODEL_OPTIONS_UNSUPPORTED`     | Options are unsupported by the selected model                       | Fleet         |
| `FUTURE_NOT_ALLOWED`            | A future timestamp is forbidden                                     | Fleet         |
| `INVALID_TRANSITION`            | The requested status transition is invalid                          | Fleet         |
| `DUE_THRESHOLD_REQUIRED`        | A due date or due odometer is required                              | Fleet         |
| `ODOMETER_DECREASE`             | An odometer would decrease stored history                           | Fleet         |
| `READING_NOT_LATER`             | An odometer reading must follow the latest reading                  | Fleet         |
| `READING_AFTER_LATEST_DATA`     | A reading exceeds the permitted data time                           | Fleet         |
| `NEXT_DUE_NOT_LATER`            | Next service must follow the completion threshold                   | Fleet         |
| `CONFIGURATION_CAPACITY`        | Device configuration has reached capacity                           | Fleet         |
| `CATALOG_PARAMETER_UNSUPPORTED` | The parameter is unsupported by the selected catalog                | Fleet         |
| `VALUE_UNCHANGED`               | The requested value equals the current value                        | Fleet         |
| `BOUNDED_PERIOD_REQUIRED`       | A bounded period or explicit Trip selection is required             | Fleet         |

Creation's Core timeout is 3 seconds, Gateway's subgraph timeout
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

Devices `STATUS ASC` uses ONLINE, OFFLINE, IN_STOCK; descending reverses those groups while
retaining `id DESC` within each status. Task and event search use canonical enum names with
underscores expanded to spaces; events also recognize the raw enum code. `TASK` sorting uses
the stored title or that canonical service-type name. These API operations have no language
argument. The task-text conditions accept explicitly matched translated `untitledServiceTypes`
for title-less tasks; an empty match list remains empty and does not remove the text condition.

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
configuration changes. See the bounded [source proof](erm-resources/karma-api-v2/web-functionality-research.md#daily-report-source-proof).

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

The [Fleet SDL](../../apps/fleet/src/modules/karma-monitoring/karma-monitoring.graphql) exposes
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
