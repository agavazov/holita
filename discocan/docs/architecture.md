# Discocan architecture

Discocan owns Fleet master data, telemetry, trips, alerts, service tasks, Overview and
Branch settings. The [shared architecture](../../docs/architecture/overview.md) describes application
boundaries; the [Fleet index](fleet.md) covers domain rules and source entry points.

## Persistence ownership

Core owns Tenant/Branch. Fleet owns Vehicle, Device, Driver, VehicleGroup,
VehicleStatusSample, Trip, FleetEvent, ServiceTask and FleetSettings. Each service owns its PostgreSQL database, Prisma client
and reviewed migrations. Admin and Router have no database credentials.

Fleet business tables begin with `id`, `tenantId`, `branchId`. Every predicate, relation,
count, aggregate and federation lookup includes verified Tenant and active Branch scope.
Composite foreign keys keep related business records in that scope. Cross-database Branch
foreign keys and PostgreSQL RLS are not used; direct owning-role SQL is not tenant-isolated.
Creation and settings upsert verify Branch existence through Core once per HTTP request;
ordinary reads, updates and deletes do not. Tenant identity never comes from caller inputs.
Core/Fleet start with `20261102000000_baseline`; preserve applied history with new migrations.
Seeds insert missing fixtures without overwriting edits. Tests use isolated schemas in
dedicated test databases, never development connections or broad resets.

Device IMEI is a 15-digit string unique across all Tenants, preserving leading zeros.
One physical unit belongs to one Branch. The optional `serialNumber` is unique within that
Branch. A Device may be stock or assigned to a Vehicle in the same scope, and several Devices
may share a Vehicle. Activity records retain the reporting IMEI as a snapshot. Vehicles and
Drivers with history are deactivated instead of deleted.
See the [Device SDL](../apps/fleet/src/modules/devices/devices.graphql) for the field contract.

## Device types and adapters

Fleet registers each Device as `DISCOCAN` (the default) or `ERM`. Its
[`DeviceAdapter`](../apps/fleet/src/integrations/device-adapter.ts) seam selects the adapter by
the registered type after Fleet resolves the Device in the caller's Tenant and Branch. The
[Discocan adapter](../apps/fleet/src/integrations/discocan/) calls
[`device-server`](../apps/device-server/) over loopback HTTP with a shared bearer token.
[`@discocan/device-contract`](../packages/device-contract/src/index.ts) defines the default
internal routes, payloads and validation for reports, live status, inspection, commands,
configuration and notifications. Device-server validates those requests and currently serves
empty data, empty catalogs and unsupported write outcomes.

Fleet exposes Device state, events and messages through the
[inspection SDL](../apps/fleet/src/modules/device-inspection/device-inspection.graphql),
command requests, batches and the action catalog through the
[commands SDL](../apps/fleet/src/modules/device-commands/device-commands.graphql), and snapshots,
catalogs, measurement configuration and changes through the
[configuration SDL](../apps/fleet/src/modules/device-configuration/device-configuration.graphql).
`FleetDevice.state`, `events`, `messages`, `commands` and the other Fleet device fields work
through the same GraphQL surface for either type. `events` accepts a zero-based `offset` or an
opaque `cursor`, with `pageSize` of 25, 50 or 100. It filters and sorts before pagination.
`messages` and `parameterSnapshots` use the same pagination and default to newest first.

The [ERM adapter](../apps/fleet/src/integrations/erm/) translates StarLink and ERM API data
and forwards the caller's `authorization` and `x-branch-id` headers for operator GraphQL
requests. Live `erm-server` runtime code and processes run unchanged. Its gateway owns
StarLink sessions, acknowledgements, the Karma relay and raw provider records in `discocan_erm`.
The API uses the gateway for live sessions and command delivery. The
[replaced ERM fields](../apps/erm-server/src/modules/telemetry/telemetry.graphql) are
`@inaccessible` in the composed API and remain available to the adapter on `erm-api`. Karma
routing (`FleetDevice.ermRouting`) and return (`returnErmDeviceToDiscoCan`) remain public on the
[ERM subgraph](../apps/erm-server/src/modules/karma/karma.graphql). Recovery sessions and
captured StarLink evidence are exposed under `erm` sub-objects. The corresponding admin
components live in [features/erm](../apps/admin/src/app/features/erm/). See
[ADR 0009](../../docs/architecture/decisions/0009-device-types-and-adapters.md) and
[ERM service setup](development.md#erm-device-server).

Fleet stores ERM-only metadata in `ermDevice`, scoped to the registered Device. This includes
the eData module/version, Karma identifiers and retained routing and backup observations. The
device-neutral `deviceCursor` table stores the last imported event ID and last receipt for
each scoped Device. Fleet imports normalized reports through the adapters into status samples,
ignition trips, measurements and Fleet events. For ERM, `FLEET_ERM_TELEMETRY_ENABLED=true`
enables import as described in
[ADR 0008](../../docs/architecture/decisions/0008-erm-telemetry-into-fleet-activity.md). Its Fleet
events include dated eData `413`/`418` codes, `419` SPN/FMI fault-logger observations, `411` CAN
error flags and `417` CAN loss. These reports are recorded evidence without an alert lifecycle.

The [Simple eData catalog](erm-resources/simple-edata-catalog/README.md) is the shared measurement
vocabulary for both types. Its versioned reference data has no Tenant/Branch columns, and its
offline CLI preserves provenance and conflicts. `FleetDevice.state.measurements` returns the
latest reported value per parameter with its report time and catalog name/unit when known. ERM
supplies these readings from `405` reports. Unknown or ambiguous IDs remain raw IDs. Values
retain the reported hexadecimal bytes, and unit labels do not establish a physical conversion.
StarLink `02` event names retain the raw diagnostic level/code and include its archived meaning
when known.

## Branch settings

`fleetSettings` returns defaults without inserting. `updateFleetSettings` replaces all eight
fields in the verified Tenant/Branch and checks the Branch through Core before upsert.

| Field                       | Default        | Accepted values                                                                    |
| --------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| `timeZone`                  | `Europe/Sofia` | Any valid IANA time zone                                                           |
| `dateFormat`                | `YYYY_MM_DD`   | `YYYY_MM_DD`, `DD_MM_YYYY`, `DD_DOT_MM_DOT_YYYY` (numeric date order in the admin) |
| `notificationRetentionDays` | `7`            | Integer 1–365                                                                      |
| `distanceUnit`              | `KM`           | `KM`, `MI`                                                                         |
| `volumeUnit`                | `LITRE`        | `LITRE`, `US_GALLON`                                                               |
| `lowFuelPct`                | `12`           | Integer 1–50                                                                       |
| `notReportingHours`         | `48`           | Integer 1–168                                                                      |
| `speedLimitKph`             | `90`           | Integer 30–130                                                                     |

`lowFuelPct` and `notReportingHours` affect server-derived facts and counts against the
Branch data clock. `FleetClock.now()` supplies the business date in the configured zone.
`fleetDataClock` exposes `asOf`, `businessDate` and `timeZone`. Daily buckets follow the
calendar date of telemetry `asOf`; trip/score windows remain elapsed-day windows.
Display preferences never change canonical API/storage km, km/h, litres or EUR cents.
The speed limit is a reference only; saving it sends no command and generates no alert.
Notifications have no delivery provider. Branch naming belongs to
[Core's rename contract](../../docs/branches.md#graphql-contracts), separately from settings.

## GraphQL contracts and context

SDL defines the API: [Core Branches](../../osnova/apps/core/src/modules/branches/branches.graphql),
[Fleet common types](../apps/fleet/src/graphql/common.graphql), the feature SDL linked in
[the Fleet index](fleet.md) and the [ERM subgraph](../apps/erm-server/src/modules/telemetry/telemetry.graphql).
Use generated types/TypedDocumentNodes from explicit inputs in
[contracts.mts](../tools/graphql/contracts.mts); keep runtime SDL in builds.
Router consumes a generated static supergraph without runtime introspection.
After SDL or operation changes, follow the [generation and validation rules](../../AGENTS.md#nestjs).

Public demo discovery exposes `tenants` and `demoLogin`. Authenticated Branch discovery uses
`branches` and `branch`. Fleet business requests require `Authorization: Bearer <session>`
and a valid UUID `x-branch-id`; inputs never accept `tenantId` or `branchId`. Foreign records
are NOT_FOUND. Related IDs outside the Branch are BAD_USER_INPUT on the input field.
Gateway forwards context; each owning service verifies the signed session. Demo login lets
anyone select any Tenant and is not production identity or membership authorization.

`FleetVehicle` and `FleetDevice` are federation entities keyed by `id`, with `branch: Branch!`.
`FleetVehicle.devices` exposes assigned Device entities through a scoped page batch. Fleet
resolves `FleetDevice.state` through its adapters. `FleetDevice.diagnostics.count` counts only latest RED,
YELLOW or INFORMATION lamps for the current vehicle/IMEI pair; DTC and CAN observations remain
history. `FleetDevice.warningLamps` and `FleetVehicle.warningLamps`
return each of the three supported FMS1 telltales with its raw value and last measurement time;
missing measurements remain unknown. `stateSince` marks the first observation of the current
decoded state. Device/Vehicle `currentWarnings` contains the RED, YELLOW and INFORMATION
subset. Diagnostic history includes catalog system/description keys and first/last observations
within the requested evidence period. These fields do not assert that a historical fault is still
active. Live device values and these
display-only diagnostics do not drive Fleet list filtering, sorting or whole-Branch counts.
Other record links use stored-field reference types. Derived list facts must be computed
before filtering, sorting, paging and counting, in the same scoped snapshot as rows/totals.
Do not add per-row field queries. Separate root queries and display-only later reads do not
share a response-wide transaction. Keep SQL scoped and parameterized as the
[domain instructions](instructions.md#fleet-backend) require.

`DateTime` serializes UTC ISO with milliseconds; inputs require an explicit `Z` or offset
and years 2000–2100. `Date` accepts real `YYYY-MM-DD` values in 1900–2100. Services validate
custom scalar inputs and report BAD_USER_INPUT at the field path. Server codegen maps
DateTime input/output to string/Date, Date to string; admin values are strings.
Text validation trims, rejects NUL and counts Unicode code points. Explicit null clears
optional fields. Scoped unique conflicts report every duplicated field as BAD_USER_INPUT;
foreign-key-protected deletion reports CONFLICT.

Batch mutations accept 1–100 unique IDs and return `succeededIds` and independent failures.
Record protections and alert `expectedStatus` still apply. Branch summaries are independent
of list search/filters/pagination. `fleetAlertCounts` retains other filters/search while
ignoring actionable and alert-status predicates. `FLEET_ENABLED=false` blocks business and
entity operations while preserving health/schema; admin availability also gates navigation.

### Errors and request IDs

Request IDs accept 1–100 ASCII letters/digits or `._:-`; invalid/missing IDs become UUIDs.
Responses and execution errors expose them. Expected errors use BAD_USER_INPUT, NOT_FOUND,
CONFLICT, SERVICE_UNAVAILABLE or UNAUTHENTICATED; unexpected details remain hidden.
See [Router error behavior](../../docs/development.md#apollo-router) for pre-execution errors.
`fieldErrors` contains at most 30 entries: a simple alphanumeric field path starting with a
letter, a message up to 300 UTF-16 units, and an optional stable localization `code`.
Codes are 1–64 uppercase ASCII letters/digits/underscores, starting with a letter. Preserve
valid unknown codes and legacy entries without a code; discard invalid code metadata only.

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
Every present field and repeated condition applies with AND. Derived filters/sorts run before
paging/counting. DateTime ranges are half-open; Date ranges are closed. Null numeric values
do not match comparisons; excluding optional types/groups includes null rows. Feature-specific
conditions and aggregates are documented once in
[the Fleet index](fleet.md#additional-list-conditions-and-aggregates).

Nullable sort values are last in both directions. Device status order is ONLINE, OFFLINE,
IN_STOCK; Vehicle status order is ACTIVE, IN_WORKSHOP, INACTIVE. Task/event search uses canonical
enum names with underscores expanded to spaces; events also accept the raw enum code.
Translated untitled-task matches are supplied explicitly, without a language argument to the API.

## Angular admin foundation

Keep standalone components → concrete feature services → Apollo with generated operations
through Gateway. Each mounted session/Branch/language/record scope owns its client and cache.
A → B → A creates a fresh A client. Retire reads on scope changes; submitted writes settle
with their captured client, and obsolete callbacks cannot navigate, notify or mutate a new scope.

Branch discovery belongs to BranchContext, separate from the business-independent shell.
Unknown Branches and disabled Fleet issue no business requests. Typed Reactive Forms retain
rejected drafts, map server fields, guard dirty navigation and lock during submitted writes.
Routed drawers retain the parent list; closing preserves query/fragment. Batches remove only
successful IDs from selection, retaining failures for retry.

[Development](development.md#telemetry-admin) owns routes and operator workflows;
[the design system](../../docs/admin-design-system.md) owns presentation and accessibility rules.
Demo sessions last eight hours in tab sessionStorage; logout honors dirty guards and retires
clients, with no server-side token revocation.
