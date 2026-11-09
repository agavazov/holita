# Discocan architecture

Discocan owns Fleet master data, telemetry, trips, alerts, service tasks, Overview and
Branch settings. The [shared architecture](../architecture/overview.md) describes application
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
One physical unit belongs to one Branch.
`serialNumber` is the optional ERM serial number, unique within that Branch; `edataModule`
records the reported module/version. A Device may be stock or assigned to a Vehicle in the
same scope; several Devices may share a Vehicle. Activity records retain the reporting IMEI
as a snapshot. Vehicles and Drivers with history are deactivated instead of deleted.
See the [Device SDL](../../apps/fleet/src/modules/devices/devices.graphql) for the field contract.

The [Simple eData catalog](erm-resources/simple-edata-catalog/README.md) is shared versioned
manufacturer metadata without Tenant/Branch columns. Its offline CLI preserves provenance
and conflicts; there is no catalog editing/import API. Catalog metadata does not grant
access to a vehicle or authorize a device write.

### ERM device ingestion

[ADR 0007](../architecture/decisions/0007-erm-gateway-and-api-processes.md) separates two
processes in `apps/erm-server`, selected by `ERM_ROLE`:

| Role      | Responsibility                                                                                         | Default listeners                       |
| --------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `gateway` | Device sessions, Karma relay, confirmations, frame/event/command records and the loopback internal API | HTTP 127.0.0.1:11015; TCP 0.0.0.0:11500 |
| `api`     | GraphQL subgraph, database reads, live state and command requests through the gateway                  | HTTP 127.0.0.1:11017                    |

Both use `discocan_erm`. Raw provider records have no Tenant/Branch columns. Frames preserve
exact bytes and direction; decoded events retain raw fields alongside parsed telemetry.
Persistence/decoding failures must not interrupt forwarding or acknowledgements. Private
JSON Lines captures are operational evidence, not a source for public documentation.
When `FLEET_ERM_TELEMETRY_ENABLED=true`, Fleet pulls captured events into scoped status samples
and ignition trips, following
[ADR 0008](../architecture/decisions/0008-erm-telemetry-into-fleet-activity.md). Fleet events come
only from eData: dated `413`/`418` codes, `419` SPN/FMI fault-logger observations, `411` CAN
error flags and `417` CAN loss, without alert lifecycle.

Fleet owns the Device registry. ERM extends `FleetDevice` with `ermState`, `ermEvents`,
`ermCommands` and `ermFrames`, resolved by its external `imei` with `@requires`. Fleet
resolves the Device in the caller's Tenant/Branch first. Provider-level inspection queries
remain separate from this Branch access path. `sendErmDeviceCommand` checks the Device through
Fleet using the caller's session and Branch, then delivers one of six allowlisted reads
through the gateway. There is no arbitrary command input. See
[setup and operator access](development.md#erm-device-server) and the
[ERM SDL](../../apps/erm-server/src/modules/telemetry/telemetry.graphql).

`ermEvents` accepts either a zero-based `offset` or an opaque `cursor`, with `pageSize` 25, 50
or 100. Its page includes the filtered `total`, `offset` and `limit`; category/severity filters
and stable event sorting apply before pagination in the same query snapshot. `ermFrames` and
`ermParameterSnapshots` page the same way and return the same totals; their `direction` orders by
time, newest first by default.

`ErmUnitState.edataMeasurements` returns the latest decoded `405` value per parameter with its
own report time and Monitor 9.56 catalog name/unit. Unknown or ambiguous catalog IDs remain raw
IDs. Values retain their reported hexadecimal bytes; catalog units do not establish a physical
conversion. The Device overview shows these readings and an empty state without received `405`
measurements. Event `02` names include the archived StarLink diagnostic meaning and raw level/code;
unknown codes retain the raw level/code.

### Branch settings

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
[Core's rename contract](../ecommerce/branches.md#graphql-contracts), separately from settings.

## GraphQL contracts and context

SDL defines the API: [Core Branches](../../apps/core/src/modules/branches/branches.graphql),
[Fleet common types](../../apps/fleet/src/graphql/common.graphql), the feature SDL linked in
[the Fleet index](fleet.md) and the [ERM subgraph](../../apps/erm-server/src/modules/telemetry/telemetry.graphql).
Use generated types/TypedDocumentNodes from explicit inputs in
[contracts.mts](../../tools/graphql/contracts.mts); keep runtime SDL in builds.
Router consumes a generated static supergraph without runtime introspection.
After SDL or operation changes, follow the [generation and validation rules](../../AGENTS.md#nestjs).

Public demo discovery exposes `tenants` and `demoLogin`. Authenticated Branch discovery uses
`branches` and `branch`. Fleet business requests require `Authorization: Bearer <session>`
and a valid UUID `x-branch-id`; inputs never accept `tenantId` or `branchId`. Foreign records
are NOT_FOUND. Related IDs outside the Branch are BAD_USER_INPUT on the input field.
Gateway forwards context; each owning service verifies the signed session. Demo login lets
anyone select any Tenant and is not production identity or membership authorization.

`FleetVehicle` and `FleetDevice` are federation entities keyed by `id`, with `branch: Branch!`.
`FleetVehicle.devices` exposes assigned Device entities through a scoped page batch, so Router
can compose each device's live `ermState`. `FleetDevice.diagnostics.count` counts only latest RED,
YELLOW or INFORMATION lamps for the current vehicle/IMEI pair; DTC and CAN observations remain
history. `FleetDevice.warningLamps` and `FleetVehicle.warningLamps`
return each of the three supported FMS1 telltales with its raw value and last measurement time;
missing measurements remain unknown. `stateSince` marks the first observation of the current
decoded state. Device/Vehicle `currentWarnings` contains the RED, YELLOW and INFORMATION
subset. Diagnostic history includes catalog system/description keys and first/last observations
within the requested evidence period. These fields do not assert that a historical fault is still
active. Live ERM values and these
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
See [Router error behavior](../development.md#apollo-router) for pre-execution errors.
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
[the design system](../admin-design-system.md) owns presentation and accessibility rules.
Demo sessions last eight hours in tab sessionStorage; logout honors dirty guards and retires
clients, with no server-side token revocation.
