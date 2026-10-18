# Admin design system: Fleet backend build spec

Pending work for `feature/admin-design-system`. This is the authoritative backend plan for the
Discocan Fleet demo domain; the frontend plan lives in
[admin-design-system-frontend.md](admin-design-system-frontend.md) and the decision record in
[admin-design-system.md](admin-design-system.md). It replaces the backend parts of the decision
record's "Fleet demo scope (proposal)". Nothing here is
implemented yet. When slices B1–B4 are done, move the implemented behaviour into the product
documents listed in section 12 and delete this file.

Read [AGENTS.md](../../AGENTS.md), [Discocan instructions](../discocan/instructions.md) and the
[backend skill](../../.agents/skills/holita-backend-feature/SKILL.md) first. Every rule there still
applies: concrete feature repositories, no generic CRUD or repository layer, no `any`, casts or lint
suppressions, Tenant and Branch on every predicate, insert-only seeds, new reviewed migrations only,
no database resets, no new dependencies.

## 0. Binding inputs

User decisions that shape the backend:

- One standard list contract (pagination, sorting, filtering, search) reused by every Fleet list.
  Breaking changes to the existing Vehicles/Devices list arguments are allowed.
- Develop Fleet "to the max" as a demo and test bed: extended Vehicle/Device plus Driver,
  VehicleGroup, VehicleStatusSample, Trip, FleetEvent and ServiceTask; deterministic synthetic data.
- Overview becomes the landing page; all editing happens in route-driven drawers (frontend work,
  but the API must serve every screen listed in the frontend plan).
- Karma Client is untouched and its tests must keep passing. Nothing is merged to `main`.

Every fix from the scope review is applied. Where each one lands:

| Review finding                                          | Resolution in this spec                                         |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| SDL-only stage fails typecheck/test:schema              | Contract slices land with their resolvers (2.1, 13)             |
| MANUAL odometer rows corrupt the data clock/state       | Device-only clock and state, MANUAL rules (2.2, 7.1, 9.6)       |
| Duplicates as CONFLICT field errors                     | Duplicates are `BAD_USER_INPUT` fieldErrors (2.4, 9)            |
| Drawer routing restructure                              | Frontend plan; API keeps every editor read/write route-agnostic |
| Existing db specs not listed                            | Explicit updates per migration (5.4, 11.2)                      |
| KPI SDL gaps (window, coverage, documents, groups, EUR) | FleetMetric, per-card queries, EUR cents (6.10, 7.5)            |
| One clock for business dates                            | Two clocks (2.2)                                                |
| Shell badge from business data                          | No badge query; counts only for the Alerts page (6.8)           |
| Low fuel defined three ways                             | One `FleetFuelStatus` definition (7.2)                          |
| Contradictory demo numbers                              | Reconciled generator; pinned scenario outcomes (10)             |
| Keys and indexes (Trip FK target, sample key, clock)    | Section 4                                                       |
| Per-row derived resolvers                               | Reference types and service-attached derived values (2.3)       |
| Derived sort/filter not repository-expressible          | Dropped; one raw list with proven paging (3.5, 7.4)             |
| `Date` scalar unimplemented                             | Hand-written scalars, codegen mapping (6.1, 8.3)                |
| Preset token list, Storybook link, approval             | Frontend plan                                                   |

## 1. Verified facts and spikes

Run the spikes again before writing code; a different result changes the plan only as stated.

| ID  | Question                                                                                             | Result (2026-10-18, Prisma 7.10.0, @prisma/adapter-pg 7.10.0)                                                                                                                                                                                                                                                           | Fallback / consequence                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Does `prisma validate` accept optional composite relations whose `tenantId`/`branchId` are required? | Yes. A candidate schema with every relation in section 4 validated.                                                                                                                                                                                                                                                     | If a future Prisma rejects it: keep the scalar FK column, remove that Prisma relation field, add the composite FK by hand in the migration SQL and document it in architecture.md as reviewed SQL-only. |
| S2  | Where must `prisma migrate diff` run?                                                                | Only inside `apps/fleet` (it needs `prisma.config.ts`). Outside it the CLI printed nothing or failed with an empty "Error in Schema engine".                                                                                                                                                                            | Generate migration SQL from `apps/fleet` as shown in 5.1.                                                                                                                                               |
| S3  | Generated SQL shape                                                                                  | `migrate diff` emits enums, `ADD COLUMN` (appended after `updatedAt`, alphabetical), `CREATE TABLE` with fields in model order, indexes, composite FKs `ON DELETE RESTRICT ON UPDATE RESTRICT`. Scalar lists are nullable.                                                                                              | Add CHECKs by hand (5.2). Enum arrays get a `NOT NULL` CHECK instead of a column change, so later diffs stay clean.                                                                                     |
| S4  | Long index names                                                                                     | Truncated to 63 bytes, e.g. `VehicleStatusSample_tenantId_branchId_vehicleId_deviceImei__key`.                                                                                                                                                                                                                          | Map unique violations by the exact generated index name.                                                                                                                                                |
| S5  | P2002 metadata under the pg adapter                                                                  | `@prisma/adapter-pg` (case `23505`) throws a `DriverAdapterError` whose `cause` is `{ kind: 'UniqueConstraintViolation', constraint: { index: <name> }` (or `{ fields }`), `table }`. The client wraps it as P2002 with `meta = { driverAdapterError, modelName }`: there is no `meta.constraint` and no `meta.target`. | `uniqueViolation(error)` (8.2) reads `meta.driverAdapterError.cause.constraint.index`, else `.constraint.fields`; `constraints.db.spec.ts` proves it against the generated index names (11.2).          |
| S6  | Does the adapter set `search_path` for raw SQL?                                                      | No. The `schema` option only qualifies Prisma-generated SQL (`schemaName`). Raw SQL resolves through the default `search_path`.                                                                                                                                                                                         | Every raw table reference is schema-qualified with `fleetTable(schema, name)` (2.5). Test schemas prove it.                                                                                             |
| S7  | Custom scalar input errors through Router                                                            | Router cannot validate custom scalars; a subgraph variable-coercion HTTP 400 is not part of the documented public error contract.                                                                                                                                                                                       | `Date`/`DateTime` parse leniently (strings only); services validate format and return `BAD_USER_INPUT` with fieldErrors over HTTP 200.                                                                  |
| S8  | Does the section-6 SDL compose?                                                                      | Yes. All section-6 blocks together build as one Fleet subgraph and compose with the current Core and Karma Client SDL (25 Fleet queries, 22 Fleet mutations); the existing admin Vehicles/Devices operations and the Fleet Core operation still validate.                                                               | If an edit breaks composition, `npm run schema:check` reports it before any code is written.                                                                                                            |

Run S1–S3 from the worktree root:

```bash
npm run db:validate
cd apps/fleet && npx prisma migrate diff --from-schema "$PREV" --to-schema prisma/schema.prisma --script
```

`$PREV` is a copy of the previous `apps/fleet/prisma/schema.prisma` written to a scratch location
outside the repository (`git show HEAD:apps/fleet/prisma/schema.prisma > "$PREV"`).

## 2. Cross-cutting decisions

### 2.1 Contract slices land with their resolvers

SDL, resolvers, persistence, tests and docs of a slice land together; no slice leaves a field
without a resolver or a failing typecheck. B1 master data (Vehicle/Device columns, Driver,
VehicleGroup, the standard list contract), B2 activity (samples, trips, events, service tasks,
derived vehicle/device/driver values), B3 overview cards, B4 demo seed. The existing admin
operations stay valid in every slice; the frontend rewrites them later.

### 2.2 Two clocks

| Clock             | Definition                                                                                                                      | Used for                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Data clock `asOf` | `max(recordedAt)` of `VehicleStatusSample` rows with `deviceImei IS NOT NULL` in the Tenant/Branch; `null` when there are none. | Activity, reporting, fuel freshness, every trip/event window (7 d, 24 h, 30 d driver stats, daily distance), `new alerts 24 h`. |
| Business date     | `FleetClock.now()` converted to a calendar date in `Europe/Sofia` (`YYYY-MM-DD`).                                               | Driver document status, service urgency and summary windows, completion/due date validation.                                    |
| Write time        | `FleetClock.now()`.                                                                                                             | `acknowledgedAt`, `resolvedAt`, MANUAL `receivedAt`, upper bounds of `installedAt` and MANUAL `recordedAt`.                     |

MANUAL samples never change `asOf`, activity, reporting, fuel status or the latest-state values.
They only contribute to the "latest odometer" (any source). `fleetDataClock` exposes `asOf`,
`businessDate` and the zone so the UI can show "data as of" and its own stale banner
(browser now − `asOf` > 48 h). The acknowledgement-latency KPI from the proposal is dropped.

`FleetClock` (8.1) is an injectable with `now(): Date`; db specs override it to fix the business
date. Raw SQL receives the business date and `asOf` as parameters; it never calls `now()`,
`CURRENT_DATE` or `CURRENT_TIMESTAMP`.

### 2.3 Derived values and reference types

Rule: a GraphQL type that has derived values (values computed from other rows or a clock) is
returned only by its own module's queries and mutations. Every link from another record uses a
`…Ref` type with stored identification fields only:

| Type                   | Fields                                           | Used by                                                                                                                              |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `FleetVehicleRef`      | `id licensePlate fleetNumber vehicleType status` | `FleetDevice.vehicle`, `FleetDriver.vehicles`, `FleetTrip.vehicle`, `FleetEvent.vehicle`, `FleetServiceTask.vehicle`, overview items |
| `FleetDriverRef`       | `id firstName lastName employeeNumber status`    | `FleetVehicle.currentDriver`, `FleetTrip.driver`, `FleetEvent.driver`, document items                                                |
| `FleetVehicleGroupRef` | `id name colorToken`                             | `FleetVehicle.group`                                                                                                                 |

Services return complete objects: repositories `include`/`select` the refs in the same query, and
derived values are computed for the whole page with batched queries (section 7) and attached
before returning. `find`, `resolveReference` and every mutation result reuse the same batch
functions with one ID. Resolvers contain only root delegation, `@ResolveReference` and the existing
`branch` stub field; there is no `@ResolveField` that queries, no DataLoader and no per-row query.
`FleetEvent` exposes `tripId` but no `trip` field; `FleetVehicle` exposes `deviceCount` but no
`devices` list (detail pages call `fleetDevices(filter: { vehicleIds: [...] })`).

Single documented exception: `FleetVehicle.nextService` returns the full `FleetServiceTask`
(including `urgency`, `remainingDays`, `remainingKm` and its own `vehicle` ref) from the vehicles
module. It is computed only by the batched `ServiceTasksService.nextForVehicles(scope, ids)` (one
raw urgency query per page, 7.4) and attached by `VehiclesService` together with the other B2
derived values; no other cross-module link may return a type with derived values.

### 2.4 Error model

| Code (HTTP status in Nest)  | When                                                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BAD_USER_INPUT` (400)      | Any validation failure, duplicate unique values, related IDs outside the Branch, invalid state transitions requested by the caller, malformed `Date`/`DateTime` strings. Carries `fieldErrors` when a field is known. |
| `NOT_FOUND` (404)           | The record ID does not exist in the verified Tenant/Branch (foreign IDs look missing); an informational event addressed as an alert.                                                                                  |
| `CONFLICT` (409)            | `expectedStatus` mismatch on alerts; editing/completing/cancelling a service task that is no longer `PLANNED`; deleting a `DONE` task; deletion blocked by a foreign key (P2003).                                     |
| `SERVICE_UNAVAILABLE` (503) | Core Branch check unavailable on create; Fleet disabled.                                                                                                                                                              |
| `UNAUTHENTICATED` (401)     | Missing or invalid demo session.                                                                                                                                                                                      |

`fieldErrors` paths must match `^[a-zA-Z][a-zA-Z0-9]*$` (Fleet formatter and Router both drop
other paths) and messages stay at most 300 UTF-16 units. Paths are the input field name for
mutation inputs (`vin`, `currentDriverId`, `nextDueOn`, `remark`, `expectedStatus`), and the
top-level argument name for list and card arguments (`offset`, `limit`, `search`, `ids`,
`filter`, `sort`, `days`, `withinDays`, `from`, `to`); the message names the nested field. The
existing `invalid('sort.field', …)` and `invalid('sort.direction', …)` calls change to path `sort`.
Messages are English, as today.

Duplicate handling: services run a scoped pre-check (`tenantId`, `branchId`, value, excluding the
record being updated) and report every duplicated field in one `BAD_USER_INPUT`. A P2002 raised by
a concurrent insert is mapped to the same paths through `uniqueViolation(error)` (S5, 8.2): by
index name first, by the reported column when the adapter gives only `fields`; an unmapped P2002
becomes `BAD_USER_INPUT` without fieldErrors ("A value that must be unique is already used.").

### 2.5 Raw SQL rules

Raw SQL is limited to: vehicle facts (latest device sample and latest odometer per vehicle),
service-task urgency queries (list, find, next per vehicle, summary, overdue vehicles), the
distance-weighted score aggregate and daily distance buckets. Everything else uses the Prisma
query API.

1. `$queryRaw` with `Prisma.sql` tagged templates only; never `$queryRawUnsafe` or string concatenation of values.
2. Every table reference is `fleetTable(this.prisma.schema, 'Trip')` (8.2), never a bare name.
3. Every table reference in `FROM`/`JOIN`/`LATERAL` carries its own `"tenantId" = ${tenantId}::uuid AND "branchId" = ${branchId}::uuid`, in addition to join equalities.
4. Every parameter has an explicit cast (`::uuid`, `::uuid[]`, `::timestamptz`, `::date`, `::int`, `::float8`, `::text`, `::text[]`). Enum columns are compared as text (`t."status"::text = 'PLANNED'`, `= ANY(${values}::text[])`) because enum types live in the per-run schema and cannot be referenced unqualified.
5. Aggregates are cast to `::int` or `::float8`; no `bigint` or `numeric` reaches TypeScript. Columns are listed explicitly (no `*`); enum columns are selected as `::text` and `date` columns as `::text` (`YYYY-MM-DD`, avoiding driver time-zone conversion); `timestamptz` columns are read as instants (the row reader accepts a `Date` or an ISO string).
6. `$queryRaw` results are `unknown`; each query has a concrete row parser built from the small field readers in `database/sql.ts` (8.2). No generic type argument stands in for runtime checks.

### 2.6 Thresholds and units

One file, `apps/fleet/src/fleet-thresholds.ts`, exports the constants. TypeScript uses them
directly; raw SQL receives them as parameters.

| Constant                     | Value          | Meaning                                                              |
| ---------------------------- | -------------- | -------------------------------------------------------------------- |
| `BUSINESS_TIME_ZONE`         | `Europe/Sofia` | Business date and daily-distance buckets                             |
| `NOT_CONNECTED_AFTER_HOURS`  | 48             | Latest device sample older than `asOf − 48 h` ⇒ `NOT_CONNECTED`      |
| `MOVING_MIN_SPEED_KPH`       | 5              | Ignition on and speed ≥ 5 ⇒ `MOVING`                                 |
| `LOW_FUEL_PERCENT`           | 12             | Fresh fuel reading below 12 % ⇒ `LOW`                                |
| `FUEL_READING_MAX_AGE_HOURS` | 6              | Older readings ⇒ `STALE`                                             |
| `SERVICE_DUE_SOON_DAYS`      | 14             | Due date within 14 days ⇒ `DUE_SOON`                                 |
| `SERVICE_DUE_SOON_KM`        | 1500           | Due odometer within 1,500 km ⇒ `DUE_SOON`                            |
| `DOCUMENT_EXPIRING_DAYS`     | 30             | Driver document expiring within 30 days                              |
| `ATTENTION_WARNING_ALERTS`   | 3              | Three or more open WARNING alerts ⇒ attention reason                 |
| `SCORE_MIN_DISTANCE_KM`      | 0.5            | Trips shorter than this never count towards scores                   |
| `OPEN_TRIP_MAX_HOURS`        | 24             | A trip without end that started within 24 h of `asOf` ⇒ `inProgress` |
| `KPI_WINDOW_DAYS`            | 7              | Overview usage window                                                |
| `DRIVER_STATS_DAYS`          | 30             | Driver list statistics window                                        |
| `LOW_CONFIDENCE_TRIPS`       | 5              | Scorecards with fewer trips are low confidence                       |

Units are holita's demo contract: km, km/h, litres, volts, °C, minutes, percent, 0–100 scores,
EUR cents. No equivalence with Karma values is claimed.

## 3. Standard list contract

### 3.1 Shape

Every Fleet list is one root query with this signature and page type (template, not valid SDL):

```text
fleetThings(
  offset: Int! = 0
  limit: Int! = 20
  search: String
  ids: [ID!]
  filter: FleetThingFilter
  sort: FleetThingSort
): FleetThingPage!

type FleetThingPage {
  items: [FleetThing!]!
  total: Int!
  offset: Int!
  limit: Int!
  # optional aggregates over the whole filtered set, e.g. totalDistanceKm
}

enum FleetThingSortField { … }
input FleetThingSort {
  field: FleetThingSortField! = <default field>
  direction: FleetSortDirection! = <default direction>
}
```

`FleetSortDirection { ASC DESC }` is shared (in `graphql/common.graphql`). A list with nothing to
filter omits `filter` (GraphQL has no empty input types). `items` are always the entity type.

### 3.2 Arguments and validation (in this order)

1. `requireScope(context)`: verified Tenant, `x-branch-id` UUID (path `x-branch-id` as today).
2. `pagination(args)`: `offset` integer 0–2,147,483,647, `limit` integer 1–100 (existing helper).
3. `searchTokens(args.search)`: trim; empty ⇒ no search; more than 200 code points or NUL ⇒ path `search`; split on Unicode whitespace; more than 5 tokens ⇒ path `search`.
4. `ids(args.ids, 'ids')`: at most 100 unique UUIDs (existing helper).
5. Filter fields (3.5): `null`/omitted means no constraint. Lists are 1–100 unique values (an empty list is `BAD_USER_INPUT`, path `filter`). Enum values are re-checked. IDs are UUIDs. Booleans: `true` requires, `false` excludes. Ranges: `DateTime` ranges are half-open (`from` inclusive, `to` exclusive) and require `to > from`; `Date` ranges are closed (both inclusive) and require `to ≥ from`, so `completedFrom = completedTo` selects one day. A range may give only one bound.
6. Sort: field from the entity enum, direction `ASC`/`DESC`, defaults from 3.6 (path `sort`).

All validated parts are combined with AND. Search, filter and IDs never select another Tenant or
Branch because the scope is always part of the same `where`.

### 3.3 Search

Each token must match at least one of the list's search fields (3.6) as a case-insensitive
literal substring: `%`, `_` and `\` are escaped (existing behaviour), Prisma
`{ contains, mode: 'insensitive' }` (ILIKE). "Георги Иванов" therefore matches first+last name, and
"СА 7712 КН" never matches the Latin "CA7712KH" (documented, not normalised). Relation fields
(e.g. the vehicle plate for devices) are searched through the stored relation.

### 3.4 Sort

Order by the chosen field and direction, `NULLS LAST` for nullable fields in both directions
(Prisma `{ sort, nulls: 'last' }`), then the secondary keys from 3.6, then `id DESC` as the final
deterministic tie-break (existing behaviour). Sorting before slicing and counting before
pagination happen in one `RepeatableRead` transaction, as today.

### 3.5 Filters

Only predicates on the entity's own columns or on stored relations (`some`/`none`, composite-FK
joins) are allowed. Derived values (activity, last report, urgency of non-service lists) are never
list predicates or sort keys. The single exception is `fleetServiceTasks`, whose urgency filter and
sort run in one scoped raw query (7.4) proven by db specs for total, order and paging.

### 3.6 Per-list definition

| Query                | Search fields                                                                                                      | Sort fields (default)                                                                                              | Secondary keys before `id DESC`                                 | Page aggregates         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ----------------------- |
| `fleetVehicles`      | `licensePlate`, `fleetNumber`, `vin`, `make`, `model`                                                              | `LICENSE_PLATE`, `FLEET_NUMBER`, `CREATED_AT`, `UPDATED_AT` (`CREATED_AT DESC`)                                    | —                                                               | —                       |
| `fleetDevices`       | `imei`, `firmwareVersion`, `simPhoneNumber`, `vehicle.licensePlate`                                                | `IMEI`, `INSTALLED_AT`, `CREATED_AT` (`CREATED_AT DESC`)                                                           | —                                                               | —                       |
| `fleetDrivers`       | `firstName`, `lastName`, `employeeNumber`, `identificationKey`, `phone`                                            | `LAST_NAME`, `EMPLOYEE_NUMBER`, `LICENSE_EXPIRES_ON`, `TACHOGRAPH_CARD_EXPIRES_ON`, `CREATED_AT` (`LAST_NAME ASC`) | `LAST_NAME`: `firstName` same direction                         | —                       |
| `fleetVehicleGroups` | `name`, `description`                                                                                              | `NAME`, `CREATED_AT` (`NAME ASC`)                                                                                  | —                                                               | `ungroupedVehicleCount` |
| `fleetTrips`         | `vehicle.licensePlate`, `vehicle.fleetNumber`, `driver.firstName`, `driver.lastName`, `startAddress`, `endAddress` | `STARTED_AT`, `DISTANCE_KM`, `DRIVING_SCORE` (`STARTED_AT DESC`)                                                   | other than `STARTED_AT`: `startedAt DESC`                       | `totalDistanceKm`       |
| `fleetEvents`        | `vehicle.licensePlate`, `vehicle.fleetNumber`, `driver.firstName`, `driver.lastName`, `address`, `troubleCode`     | `OCCURRED_AT`, `SEVERITY` (`OCCURRED_AT DESC`); severity orders INFO < WARNING < CRITICAL                          | `SEVERITY`: `occurredAt DESC`                                   | —                       |
| `fleetServiceTasks`  | `title`, `workshop`, `vehicle.licensePlate`, `vehicle.fleetNumber`                                                 | `URGENCY`, `DUE_ON`, `COMPLETED_ON`, `CREATED_AT` (`URGENCY ASC`)                                                  | `URGENCY`: `dueOn ASC NULLS LAST`, `remainingKm ASC NULLS LAST` | —                       |

Filter semantics (each field is optional):

| Input                    | Field → predicate                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FleetVehicleFilter`     | `statuses` → status IN; `vehicleTypes` → vehicleType IN; `fuelTypes` → fuelType IN; `groupIds` → groupId IN; `hasGroup` → groupId not null/null; `currentDriverIds` → currentDriverId IN; `hasDriver` → currentDriverId not null/null; `hasDevice` → devices some/none; `hasOpenAlerts` (B2) → events some/none with `alertStatus = OPEN` |
| `FleetDeviceFilter`      | `models` → model IN; `options` → options `hasEvery`; `vehicleIds` → vehicleId IN                                                                                                                                                                                                                                                          |
| `FleetDriverFilter`      | `statuses` → status IN; `licenseCategories` → `hasSome`; `documentsExpireWithinDays` (0–365) → `licenseExpiresOn ≤ businessDate + N OR tachographCardExpiresOn ≤ businessDate + N` (expired included); `hasVehicle` → current vehicles some/none                                                                                          |
| `FleetTripFilter`        | `startedFrom`/`startedTo` → startedAt range; `vehicleIds`; `driverIds`; `hasDriver` → driverId not null/null; `scored` → drivingScore not null/null; `drivingScoreBelow` (0–100) → drivingScore < value (unscored trips excluded); `hasEnd` → endedAt not null/null                                                                       |
| `FleetEventFilter`       | `actionable` → alertStatus not null/null; `alertStatuses` → alertStatus IN (implies actionable); `severities`; `kinds`; `vehicleIds`; `driverIds`; `tripIds`; `occurredFrom`/`occurredTo` → occurredAt range                                                                                                                              |
| `FleetServiceTaskFilter` | `statuses`; `urgencies` → urgency IN (implies status PLANNED); `serviceTypes`; `vehicleIds`; `completedFrom`/`completedTo` → completedOn range (Date, inclusive)                                                                                                                                                                          |

### 3.7 Allowed helpers

No generic list builder or repository. Allowed small concrete helpers:

- `apps/fleet/src/validation.ts`: `searchTokens`, `enumValue`, `enumList`, `idList` (path parameter for filter lists, reusing `ids`), `booleanFilter`, `dateTimeRange`, `dateOnlyRange`, `sortDirection`, plus the field helpers in 9.1.
- `apps/fleet/src/database/search.ts`: `literalContains(token)` returning `{ contains, mode: 'insensitive' }` with escaping, and `nullsLast(direction)` returning `{ sort, nulls: 'last' }`.

Each repository writes its own `where`/`orderBy` objects explicitly with generated Prisma types.

### 3.8 Migration of the existing Vehicles/Devices lists (breaking, B1)

- `FleetVehicleSortDirection` and `FleetDeviceSortDirection` are removed; both sort inputs use `FleetSortDirection`. Admin `vehicle-list-query.ts` and `device-list-query.ts` change their type imports only.
- `filter` arguments are added; defaults (0/20, `CREATED_AT DESC`) are unchanged.
- Search becomes tokenised (3.3). Device search also matches firmware, SIM phone and the vehicle plate.
- `FleetDevice.vehicle` becomes `FleetVehicleRef!`. The existing `AdminDevice` fragment (`vehicle { id licensePlate }`) stays valid; generated `__typename` becomes `FleetVehicleRef`.
- Sort validation errors use path `sort`.

## 4. Persistence model

Physical column order: `id`, `tenantId`, `branchId` first in every new table (fields declared in
that order); the B1 columns of `Vehicle`/`Device` are appended by `ALTER TABLE … ADD COLUMN`.
Measurements use `Float` (double precision) because they are device readings exposed as GraphQL
`Float` and never money; money is integer EUR cents. All tables are Tenant/Branch-scoped with
composite foreign keys `ON DELETE RESTRICT ON UPDATE RESTRICT`. No partial indexes, no
expression indexes, no Prisma-unsupported constructs except hand-written CHECKs.

### 4.1 Enums

```prisma
// B1
enum FleetVehicleType { TRACTOR RIGID_TRUCK VAN CAR TRAILER OTHER }
enum FleetFuelType { DIESEL PETROL LPG CNG ELECTRIC HYBRID }
enum FleetVehicleStatus { ACTIVE IN_WORKSHOP INACTIVE }
enum FleetDeviceModel { STARLINK_TRACKER STARLINK_SCOUT OTHER }
enum FleetDeviceOption { CELLULAR_4G SAFETY_SF IRF CAN DRIVER_ID GEOZONES_GO TEMPERATURE_DS ECONNECT WIFI VOICE EXTERNAL_ANTENNA RS232 WILIOT }
enum FleetDriverStatus { ACTIVE ON_LEAVE INACTIVE }
enum FleetLicenseCategory { B BE C1 C1E C CE D1 D1E D DE }
enum FleetGroupColor { C1 C2 C3 C4 C5 C6 C7 C8 }
// B2
enum FleetDataSource { DEMO MANUAL }
enum FleetEventKind {
  HARSH_ACCELERATION HARSH_BRAKING SPEED_BUMP OVERTAKING ROUNDABOUT LANE_CHANGE SHARP_TURN OFF_ROAD SPEEDING
  IGNITION_ON IGNITION_OFF IDLING LOW_FUEL FUEL_DROP POWER_DISCONNECTED LOW_BACKUP_BATTERY
  CAN_DISCONNECTED DEVICE_OFFLINE DIAGNOSTIC_TROUBLE_CODE CRASH_DETECTED
}
enum FleetEventSeverity { INFO WARNING CRITICAL }
enum FleetAlertStatus { OPEN ACKNOWLEDGED RESOLVED }
enum FleetServiceType { GENERAL_SERVICE OIL_CHANGE ANNUAL_INSPECTION TACHOGRAPH_CALIBRATION BRAKES TIRES REPAIR OTHER }
enum FleetServiceStatus { PLANNED DONE CANCELLED }
```

Write each enum value on its own line in `schema.prisma` (formatting above is compact for
reading). GraphQL enums use identical names and values, so generated Prisma and GraphQL string
unions are assignable without mapping. The first nine `FleetEventKind` values are the
"maneuver kinds" used by scores and scorecards.

### 4.2 Vehicle and Device (B1 additions)

```prisma
model Vehicle {
  id String @id @default(uuid()) @db.Uuid
  tenantId String @db.Uuid
  branchId String @db.Uuid
  licensePlate String @db.VarChar(32)
  notes String? @db.VarChar(2000)
  fleetNumber String? @db.VarChar(16)
  vehicleType FleetVehicleType?
  make String? @db.VarChar(64)
  model String? @db.VarChar(64)
  modelYear Int? @db.SmallInt
  vin String? @db.VarChar(17)
  fuelType FleetFuelType?
  fuelTankCapacityL Int? @db.SmallInt
  status FleetVehicleStatus @default(ACTIVE)
  groupId String? @db.Uuid
  currentDriverId String? @db.Uuid
  group VehicleGroup? @relation(fields: [tenantId, branchId, groupId], references: [tenantId, branchId, id], onDelete: Restrict, onUpdate: Restrict)
  currentDriver Driver? @relation(fields: [tenantId, branchId, currentDriverId], references: [tenantId, branchId, id], onDelete: Restrict, onUpdate: Restrict)
  devices Device[]
  statusSamples VehicleStatusSample[] // B2
  trips Trip[]                        // B2
  events FleetEvent[]                 // B2
  serviceTasks ServiceTask[]          // B2
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  @@unique([tenantId, branchId, id])
  @@unique([tenantId, branchId, fleetNumber])
  @@unique([tenantId, branchId, vin])
  @@index([tenantId, branchId, createdAt, id])
  @@index([tenantId, branchId, groupId])
  @@index([tenantId, branchId, currentDriverId])
}

model Device {
  id String @id @default(uuid()) @db.Uuid
  tenantId String @db.Uuid
  branchId String @db.Uuid
  imei String @db.VarChar(15)
  vehicleId String @db.Uuid
  vehicle Vehicle @relation(fields: [tenantId, branchId, vehicleId], references: [tenantId, branchId, id], onDelete: Restrict, onUpdate: Restrict)
  model FleetDeviceModel?
  options FleetDeviceOption[] @default([])
  firmwareVersion String? @db.VarChar(32)
  simPhoneNumber String? @db.VarChar(20)
  simIccid String? @db.VarChar(22)
  installedAt DateTime? @db.Timestamptz(3)
  notes String? @db.VarChar(2000)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  @@unique([tenantId, branchId, id])
  @@unique([tenantId, branchId, imei])
  @@index([tenantId, branchId, createdAt, id])
  @@index([tenantId, branchId, vehicleId])
}
```

`fleetNumber` and `vin` are unique per Tenant/Branch when set (PostgreSQL treats NULLs as
distinct). `licensePlate` stays non-unique. Plain unique indexes are exact-match; the service
normalises values first (9.2).

### 4.3 Driver and VehicleGroup (B1)

```prisma
model Driver {
  id String @id @default(uuid()) @db.Uuid
  tenantId String @db.Uuid
  branchId String @db.Uuid
  firstName String @db.VarChar(64)
  lastName String @db.VarChar(64)
  employeeNumber String? @db.VarChar(32)
  identificationKey String? @db.VarChar(32)
  phone String? @db.VarChar(20)
  email String? @db.VarChar(254)
  licenseNumber String? @db.VarChar(32)
  licenseCategories FleetLicenseCategory[] @default([])
  licenseExpiresOn DateTime? @db.Date
  tachographCardNumber String? @db.VarChar(16)
  tachographCardExpiresOn DateTime? @db.Date
  status FleetDriverStatus @default(ACTIVE)
  notes String? @db.VarChar(2000)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)
  vehicles Vehicle[]
  trips Trip[]        // B2
  events FleetEvent[] // B2

  @@unique([tenantId, branchId, id])
  @@unique([tenantId, branchId, employeeNumber])
  @@unique([tenantId, branchId, identificationKey])
  @@index([tenantId, branchId, lastName, firstName, id])
  @@index([tenantId, branchId, createdAt, id])
}

model VehicleGroup {
  id String @id @default(uuid()) @db.Uuid
  tenantId String @db.Uuid
  branchId String @db.Uuid
  name String @db.VarChar(64)
  description String? @db.VarChar(500)
  colorToken FleetGroupColor @default(C1)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)
  vehicles Vehicle[]

  @@unique([tenantId, branchId, id])
  @@unique([tenantId, branchId, name])
  @@index([tenantId, branchId, createdAt, id])
}
```

`colorToken` is a design-system categorical slot, never a colour value.

### 4.4 Activity tables (B2)

```prisma
model VehicleStatusSample {
  id String @id @default(uuid()) @db.Uuid
  tenantId String @db.Uuid
  branchId String @db.Uuid
  vehicleId String @db.Uuid
  deviceImei String? @db.VarChar(15)
  source FleetDataSource
  recordedAt DateTime @db.Timestamptz(3)
  receivedAt DateTime @db.Timestamptz(3)
  latitude Float?
  longitude Float?
  address String? @db.VarChar(256)
  speedKph Float?
  headingDeg Int? @db.SmallInt
  ignition Boolean?
  odometerKm Float?
  fuelLevelPct Float?
  externalVoltage Float?
  backupBatteryVoltage Float?
  engineHours Float?
  coolantTempC Int? @db.SmallInt
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  vehicle Vehicle @relation(fields: [tenantId, branchId, vehicleId], references: [tenantId, branchId, id], onDelete: Restrict, onUpdate: Restrict)

  @@unique([tenantId, branchId, vehicleId, deviceImei, recordedAt])
  @@index([tenantId, branchId, vehicleId, recordedAt(sort: Desc)])
  @@index([tenantId, branchId, recordedAt])
}

model Trip {
  id String @id @default(uuid()) @db.Uuid
  tenantId String @db.Uuid
  branchId String @db.Uuid
  vehicleId String @db.Uuid
  driverId String? @db.Uuid
  deviceImei String? @db.VarChar(15)
  source FleetDataSource
  startedAt DateTime @db.Timestamptz(3)
  endedAt DateTime? @db.Timestamptz(3)
  startAddress String? @db.VarChar(256)
  endAddress String? @db.VarChar(256)
  startLatitude Float?
  startLongitude Float?
  endLatitude Float?
  endLongitude Float?
  startOdometerKm Float?
  endOdometerKm Float?
  distanceKm Float?
  idleSeconds Int?
  maxSpeedKph Float?
  fuelUsedL Float?
  drivingScore Float?
  ecoScore Float?
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  vehicle Vehicle @relation(fields: [tenantId, branchId, vehicleId], references: [tenantId, branchId, id], onDelete: Restrict, onUpdate: Restrict)
  driver Driver? @relation(fields: [tenantId, branchId, driverId], references: [tenantId, branchId, id], onDelete: Restrict, onUpdate: Restrict)
  events FleetEvent[]

  @@unique([tenantId, branchId, vehicleId, id])
  @@index([tenantId, branchId, startedAt(sort: Desc), id])
  @@index([tenantId, branchId, vehicleId, startedAt])
  @@index([tenantId, branchId, driverId, startedAt])
}

model FleetEvent {
  id String @id @default(uuid()) @db.Uuid
  tenantId String @db.Uuid
  branchId String @db.Uuid
  vehicleId String @db.Uuid
  tripId String? @db.Uuid
  driverId String? @db.Uuid
  deviceImei String? @db.VarChar(15)
  source FleetDataSource
  occurredAt DateTime @db.Timestamptz(3)
  kind FleetEventKind
  severity FleetEventSeverity
  intensity Int? @db.SmallInt
  latitude Float?
  longitude Float?
  address String? @db.VarChar(256)
  speedKph Float?
  measuredValue Float?
  thresholdValue Float?
  troubleCode String? @db.VarChar(32)
  details String? @db.VarChar(500)
  alertStatus FleetAlertStatus?
  acknowledgedAt DateTime? @db.Timestamptz(3)
  resolvedAt DateTime? @db.Timestamptz(3)
  remark String? @db.VarChar(1000)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)
  vehicle Vehicle @relation(fields: [tenantId, branchId, vehicleId], references: [tenantId, branchId, id], onDelete: Restrict, onUpdate: Restrict)
  trip Trip? @relation(fields: [tenantId, branchId, vehicleId, tripId], references: [tenantId, branchId, vehicleId, id], onDelete: Restrict, onUpdate: Restrict)
  driver Driver? @relation(fields: [tenantId, branchId, driverId], references: [tenantId, branchId, id], onDelete: Restrict, onUpdate: Restrict)

  @@index([tenantId, branchId, occurredAt(sort: Desc), id])
  @@index([tenantId, branchId, alertStatus, occurredAt(sort: Desc), id])
  @@index([tenantId, branchId, vehicleId, occurredAt])
  @@index([tenantId, branchId, vehicleId, tripId])
  @@index([tenantId, branchId, driverId, occurredAt])
}

model ServiceTask {
  id String @id @default(uuid()) @db.Uuid
  tenantId String @db.Uuid
  branchId String @db.Uuid
  vehicleId String @db.Uuid
  serviceType FleetServiceType
  status FleetServiceStatus @default(PLANNED)
  title String? @db.VarChar(120)
  dueOn DateTime? @db.Date
  dueOdometerKm Int?
  completedOn DateTime? @db.Date
  completedOdometerKm Int?
  workshop String? @db.VarChar(128)
  replacedParts String? @db.VarChar(1000)
  costCents Int?
  notes String? @db.VarChar(2000)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)
  vehicle Vehicle @relation(fields: [tenantId, branchId, vehicleId], references: [tenantId, branchId, id], onDelete: Restrict, onUpdate: Restrict)

  @@index([tenantId, branchId, status, dueOn, id])
  @@index([tenantId, branchId, vehicleId, status])
  @@index([tenantId, branchId, completedOn])
}
```

Key decisions:

- Telemetry rows store `deviceImei` as a snapshot, not a Device FK, so devices can be replaced, re-assigned or deleted without rewriting history. History belongs to the `(vehicleId, deviceImei)` pair at the time of reporting; `FleetDevice.lastReportedAt` matches the device's current pair, so it becomes `null` after a re-assignment until the device reports for the new vehicle.
- The sample unique key includes `deviceImei`, so two devices on one vehicle can report at the same instant. MANUAL rows (null IMEI) are not deduplicated by the key; the API forbids two readings at the same or earlier time (9.6).
- `(tenantId, branchId, recordedAt)` serves `asOf`; the unique key serves `lastReportedAt`; `(…, vehicleId, recordedAt DESC)` serves latest state and latest odometer.
- `FleetEvent → Trip` includes `vehicleId`, so an event's vehicle always equals its trip's vehicle; `Trip @@unique([tenantId, branchId, vehicleId, id])` is the FK target.
- There is no `acknowledgedBy`: the demo login has no user identity.
- Costs are EUR only (`costCents`, no currency column), so sums never mix currencies.

## 5. Migrations

Applied migrations are never edited. Two new reviewed migrations:

| Directory                          | Slice | Content                                                                                             |
| ---------------------------------- | ----- | --------------------------------------------------------------------------------------------------- |
| `20261018100000_fleet_master_data` | B1    | 8 B1 enums; Vehicle/Device `ADD COLUMN`s; Driver, VehicleGroup; indexes; 2 composite FKs; B1 CHECKs |
| `20261018110000_fleet_activity`    | B2    | 6 B2 enums; VehicleStatusSample, Trip, FleetEvent, ServiceTask; indexes; 7 composite FKs; B2 CHECKs |

### 5.1 Producing the SQL

1. Copy the committed schema to a scratch file outside the repository (`$PREV`), edit `apps/fleet/prisma/schema.prisma`, run `npm run db:validate`.
2. From `apps/fleet`: `npx prisma migrate diff --from-schema "$PREV" --to-schema prisma/schema.prisma --script > prisma/migrations/<dir>/migration.sql` (S2).
3. Wrap the file in `BEGIN;` … `COMMIT;` (as the Branch rename migration does) and append the CHECKs of 5.2 before `COMMIT;`.
4. Review: only additive statements; no `DROP`, no `ALTER COLUMN … TYPE`, no data updates; `tenantId`/`branchId` are columns 2 and 3 of every new table; every FK is composite with `RESTRICT`; index names match S4.

The B1 output generated during the spike matched the expectation (enum creation, eleven Vehicle
columns, seven Device columns with `"options" "FleetDeviceOption"[] DEFAULT ARRAY[]::…`, two tables,
twelve indexes, two FKs); the B2 output had four tables, fifteen indexes and seven FKs.

### 5.2 Hand-written CHECK constraints

B1:

```sql
ALTER TABLE "Vehicle"
  ADD CONSTRAINT "Vehicle_modelYear_check" CHECK ("modelYear" IS NULL OR "modelYear" BETWEEN 1950 AND 2100),
  ADD CONSTRAINT "Vehicle_vin_check" CHECK ("vin" IS NULL OR "vin" ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  ADD CONSTRAINT "Vehicle_fuelTankCapacityL_check" CHECK ("fuelTankCapacityL" IS NULL OR "fuelTankCapacityL" BETWEEN 1 AND 2000),
  ADD CONSTRAINT "Vehicle_inactive_driver_check" CHECK ("status" <> 'INACTIVE' OR "currentDriverId" IS NULL);
ALTER TABLE "Device"
  ADD CONSTRAINT "Device_options_check" CHECK ("options" IS NOT NULL AND cardinality("options") <= 13),
  ADD CONSTRAINT "Device_simPhoneNumber_check" CHECK ("simPhoneNumber" IS NULL OR "simPhoneNumber" ~ '^\+?[0-9]{6,19}$'),
  ADD CONSTRAINT "Device_simIccid_check" CHECK ("simIccid" IS NULL OR "simIccid" ~ '^[0-9]{18,22}$');
ALTER TABLE "Driver"
  ADD CONSTRAINT "Driver_licenseCategories_check" CHECK ("licenseCategories" IS NOT NULL AND cardinality("licenseCategories") <= 10),
  ADD CONSTRAINT "Driver_phone_check" CHECK ("phone" IS NULL OR "phone" ~ '^\+?[0-9 ]{6,20}$');
```

B2 (`<pos>` means the coordinate rule: both null or both set, latitude −90..90, longitude −180..180):

```sql
ALTER TABLE "VehicleStatusSample"
  ADD CONSTRAINT "VehicleStatusSample_source_check" CHECK (("source" = 'MANUAL') = ("deviceImei" IS NULL)),
  ADD CONSTRAINT "VehicleStatusSample_manual_check" CHECK ("source" <> 'MANUAL' OR (
    "odometerKm" IS NOT NULL AND "latitude" IS NULL AND "longitude" IS NULL AND "address" IS NULL
    AND "speedKph" IS NULL AND "headingDeg" IS NULL AND "ignition" IS NULL AND "fuelLevelPct" IS NULL
    AND "externalVoltage" IS NULL AND "backupBatteryVoltage" IS NULL AND "engineHours" IS NULL AND "coolantTempC" IS NULL)),
  ADD CONSTRAINT "VehicleStatusSample_deviceImei_check" CHECK ("deviceImei" IS NULL OR "deviceImei" ~ '^[0-9]{15}$'),
  ADD CONSTRAINT "VehicleStatusSample_position_check" CHECK (<pos latitude, longitude>),
  ADD CONSTRAINT "VehicleStatusSample_measure_check" CHECK (
    ("speedKph" IS NULL OR "speedKph" BETWEEN 0 AND 400)
    AND ("headingDeg" IS NULL OR "headingDeg" BETWEEN 0 AND 359)
    AND ("odometerKm" IS NULL OR "odometerKm" BETWEEN 0 AND 10000000)
    AND ("fuelLevelPct" IS NULL OR "fuelLevelPct" BETWEEN 0 AND 100)
    AND ("externalVoltage" IS NULL OR "externalVoltage" BETWEEN 0 AND 60)
    AND ("backupBatteryVoltage" IS NULL OR "backupBatteryVoltage" BETWEEN 0 AND 10)
    AND ("engineHours" IS NULL OR "engineHours" BETWEEN 0 AND 1000000)
    AND ("coolantTempC" IS NULL OR "coolantTempC" BETWEEN -60 AND 200));
ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_source_check" CHECK ("source" <> 'MANUAL'),
  ADD CONSTRAINT "Trip_deviceImei_check" CHECK ("deviceImei" IS NULL OR "deviceImei" ~ '^[0-9]{15}$'),
  ADD CONSTRAINT "Trip_period_check" CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt"),
  ADD CONSTRAINT "Trip_position_check" CHECK (<pos startLatitude, startLongitude> AND <pos endLatitude, endLongitude>),
  ADD CONSTRAINT "Trip_measure_check" CHECK (
    ("startOdometerKm" IS NULL OR "startOdometerKm" BETWEEN 0 AND 10000000)
    AND ("endOdometerKm" IS NULL OR "endOdometerKm" BETWEEN 0 AND 10000000)
    AND ("startOdometerKm" IS NULL OR "endOdometerKm" IS NULL OR "endOdometerKm" >= "startOdometerKm")
    AND ("distanceKm" IS NULL OR "distanceKm" BETWEEN 0 AND 5000)
    AND ("idleSeconds" IS NULL OR "idleSeconds" BETWEEN 0 AND 604800)
    AND ("maxSpeedKph" IS NULL OR "maxSpeedKph" BETWEEN 0 AND 400)
    AND ("fuelUsedL" IS NULL OR "fuelUsedL" BETWEEN 0 AND 5000)
    AND ("drivingScore" IS NULL OR "drivingScore" BETWEEN 0 AND 100)
    AND ("ecoScore" IS NULL OR "ecoScore" BETWEEN 0 AND 100));
ALTER TABLE "FleetEvent"
  ADD CONSTRAINT "FleetEvent_source_check" CHECK ("source" <> 'MANUAL'),
  ADD CONSTRAINT "FleetEvent_deviceImei_check" CHECK ("deviceImei" IS NULL OR "deviceImei" ~ '^[0-9]{15}$'),
  ADD CONSTRAINT "FleetEvent_position_check" CHECK (<pos latitude, longitude>),
  ADD CONSTRAINT "FleetEvent_speed_check" CHECK ("speedKph" IS NULL OR "speedKph" BETWEEN 0 AND 400),
  ADD CONSTRAINT "FleetEvent_intensity_check" CHECK ("intensity" IS NULL OR ("intensity" BETWEEN 1 AND 3 AND "kind" IN (
    'HARSH_ACCELERATION', 'HARSH_BRAKING', 'SPEED_BUMP', 'OVERTAKING', 'ROUNDABOUT',
    'LANE_CHANGE', 'SHARP_TURN', 'OFF_ROAD', 'SPEEDING'))),
  ADD CONSTRAINT "FleetEvent_alert_check" CHECK (
    ("alertStatus" IS NULL AND "acknowledgedAt" IS NULL AND "resolvedAt" IS NULL AND "remark" IS NULL)
    OR ("alertStatus" IS NOT NULL AND (
      ("alertStatus" = 'OPEN' AND "acknowledgedAt" IS NULL AND "resolvedAt" IS NULL)
      OR ("alertStatus" = 'ACKNOWLEDGED' AND "acknowledgedAt" IS NOT NULL AND "resolvedAt" IS NULL)
      OR ("alertStatus" = 'RESOLVED' AND "resolvedAt" IS NOT NULL)))),
  ADD CONSTRAINT "FleetEvent_alert_severity_check" CHECK ("alertStatus" IS NULL OR "severity" <> 'INFO'),
  ADD CONSTRAINT "FleetEvent_alert_time_check" CHECK (
    ("acknowledgedAt" IS NULL OR "acknowledgedAt" >= "occurredAt")
    AND ("resolvedAt" IS NULL OR "resolvedAt" >= "occurredAt")
    AND ("resolvedAt" IS NULL OR "acknowledgedAt" IS NULL OR "resolvedAt" >= "acknowledgedAt"));
ALTER TABLE "ServiceTask"
  ADD CONSTRAINT "ServiceTask_status_check" CHECK (
    ("status" = 'PLANNED' AND ("dueOn" IS NOT NULL OR "dueOdometerKm" IS NOT NULL)
      AND "completedOn" IS NULL AND "completedOdometerKm" IS NULL AND "costCents" IS NULL AND "replacedParts" IS NULL)
    OR ("status" = 'DONE' AND "completedOn" IS NOT NULL)
    OR ("status" = 'CANCELLED' AND "completedOn" IS NULL AND "completedOdometerKm" IS NULL AND "costCents" IS NULL)),
  ADD CONSTRAINT "ServiceTask_measure_check" CHECK (
    ("dueOdometerKm" IS NULL OR "dueOdometerKm" BETWEEN 0 AND 10000000)
    AND ("completedOdometerKm" IS NULL OR "completedOdometerKm" BETWEEN 0 AND 10000000)
    AND ("costCents" IS NULL OR "costCents" BETWEEN 0 AND 100000000));
```

Expand every `<pos a, b>` literally as
`(("a" IS NULL) = ("b" IS NULL) AND ("a" IS NULL OR "a" BETWEEN -90 AND 90) AND ("b" IS NULL OR "b" BETWEEN -180 AND 180))`.
Range CHECKs also reject `NaN` and `Infinity` (PostgreSQL orders them above every number).

### 5.3 Existing data

The B1 migration fills existing Vehicle rows with `status = ACTIVE` and Device rows with
`options = '{}'` through the column defaults; nothing else changes. No data migration is needed.

### 5.4 Existing db specs that each migration breaks

| Spec                                           | B1 change                                                                                                                                                                                                                                                                                 | B2 change                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `apps/fleet/test/initial-migration.db.spec.ts` | Expect four migration names; run the first-three-columns loop for `Vehicle`, `Device`, `Driver`, `VehicleGroup`.                                                                                                                                                                          | Five names; add the four B2 tables to the loop |
| `apps/fleet/test/branch-migration.db.spec.ts`  | `toEqual` on Vehicle/Device rows becomes `toMatchObject` on the original fields plus explicit `status: 'ACTIVE'` and `options: []`; replace `toHaveLength(history.length + 1)` with the exact list of names after the captured history (`…rename_store_to_branch`, `…fleet_master_data`). | Add `…fleet_activity` to that list             |
| `apps/fleet/test/devices.db.spec.ts`           | `vehicle { … }` selections still work (ref); assertions unchanged except new fields                                                                                                                                                                                                       | —                                              |
| `apps/fleet/test/seeds.db.spec.ts`             | Unchanged; must pass                                                                                                                                                                                                                                                                      | Unchanged; must pass                           |
| `tools/graphql/router.smoke.spec.mts`          | Vehicle-delete CONFLICT message changes to "Vehicle has devices or history; deactivate it instead." (8.3); run with `npm run test:gateway:router`                                                                                                                                         | Unchanged; must pass                           |

## 6. GraphQL SDL

File order (both in `tools/graphql/contracts.mts` and in `app.module.ts` `typeDefs`):
`graphql/common.graphql`, then `modules/vehicles`, `devices`, `drivers`, `vehicle-groups` (B1),
`telemetry`, `trips`, `events`, `service-tasks` (B2), `overview` (B3). `vehicles.graphql` keeps the
base `type Query`/`type Mutation`; every other file uses `extend type`. Comments `# B2`/`# B3`
mark fields added by a later slice to an earlier file.

### 6.1 `apps/fleet/src/graphql/common.graphql` (B1)

```graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

"ISO-8601 instant with an offset; serialized in UTC with milliseconds."
scalar DateTime

"Calendar date YYYY-MM-DD without a time zone."
scalar Date

type Branch @key(fields: "id", resolvable: false) {
  id: ID!
}

enum FleetSortDirection {
  ASC
  DESC
}
```

Scalars (`apps/fleet/src/graphql/scalars.ts`, registered as `resolvers: { DateTime: DateTimeScalar, Date: DateScalar }`, replacing Nest's `GraphQLISODateTime`):

- `DateTime.serialize`: valid `Date` → `toISOString()`; anything else throws. `parseValue`/`parseLiteral`: strings only, returned unchanged; services validate with `dateTime(value, path)` (ISO 8601 with `Z` or `±hh:mm`, finite, years 2000–2100) and convert to `Date`.
- `Date.serialize`: `Date` at UTC midnight → `YYYY-MM-DD`, or an already valid `YYYY-MM-DD` string; anything else throws. `parseValue`/`parseLiteral`: strings only; services validate with `dateOnly(value, path)` (pattern, real calendar day via UTC round trip, years 1900–2100).
- Repositories convert `@db.Date` values with `dateOnlyToDate('2026-10-18') = 2026-10-18T00:00:00.000Z` and `dateToDateOnly(date) = toISOString().slice(0, 10)`.

### 6.2 `modules/vehicles/vehicles.graphql`

```graphql
enum FleetVehicleType {
  TRACTOR
  RIGID_TRUCK
  VAN
  CAR
  TRAILER
  OTHER
}
enum FleetFuelType {
  DIESEL
  PETROL
  LPG
  CNG
  ELECTRIC
  HYBRID
}
enum FleetVehicleStatus {
  ACTIVE
  IN_WORKSHOP
  INACTIVE
}

type FleetVehicle @key(fields: "id") {
  id: ID!
  branchId: ID!
  branch: Branch!
  licensePlate: String!
  notes: String
  fleetNumber: String
  vehicleType: FleetVehicleType
  make: String
  model: String
  modelYear: Int
  vin: String
  fuelType: FleetFuelType
  fuelTankCapacityL: Int
  status: FleetVehicleStatus!
  groupId: ID
  group: FleetVehicleGroupRef
  currentDriverId: ID
  currentDriver: FleetDriverRef
  deviceCount: Int!
  state: FleetVehicleState! # B2
  openAlertCount: Int! # B2
  nextService: FleetServiceTask # B2
  createdAt: DateTime!
  updatedAt: DateTime!
}

type FleetVehicleRef {
  id: ID!
  licensePlate: String!
  fleetNumber: String
  vehicleType: FleetVehicleType
  status: FleetVehicleStatus!
}

type FleetVehiclePage {
  items: [FleetVehicle!]!
  total: Int!
  offset: Int!
  limit: Int!
}

input FleetVehicleFilter {
  statuses: [FleetVehicleStatus!]
  vehicleTypes: [FleetVehicleType!]
  fuelTypes: [FleetFuelType!]
  groupIds: [ID!]
  hasGroup: Boolean
  currentDriverIds: [ID!]
  hasDriver: Boolean
  hasDevice: Boolean
  hasOpenAlerts: Boolean # B2
}

enum FleetVehicleSortField {
  LICENSE_PLATE
  FLEET_NUMBER
  CREATED_AT
  UPDATED_AT
}

input FleetVehicleSort {
  field: FleetVehicleSortField! = CREATED_AT
  direction: FleetSortDirection! = DESC
}

input CreateFleetVehicleInput {
  licensePlate: String!
  notes: String
  fleetNumber: String
  vehicleType: FleetVehicleType
  make: String
  model: String
  modelYear: Int
  vin: String
  fuelType: FleetFuelType
  fuelTankCapacityL: Int
  status: FleetVehicleStatus
  groupId: ID
  currentDriverId: ID
}

"Omitted fields stay unchanged; explicit null clears optional fields."
input UpdateFleetVehicleInput {
  licensePlate: String
  notes: String
  fleetNumber: String
  vehicleType: FleetVehicleType
  make: String
  model: String
  modelYear: Int
  vin: String
  fuelType: FleetFuelType
  fuelTankCapacityL: Int
  status: FleetVehicleStatus
  groupId: ID
  currentDriverId: ID
}

type Query {
  fleetVehicles(
    offset: Int! = 0
    limit: Int! = 20
    search: String
    ids: [ID!]
    filter: FleetVehicleFilter
    sort: FleetVehicleSort
  ): FleetVehiclePage!
  fleetVehicle(id: ID!): FleetVehicle!
}

type Mutation {
  createFleetVehicle(input: CreateFleetVehicleInput!): FleetVehicle!
  updateFleetVehicle(id: ID!, input: UpdateFleetVehicleInput!): FleetVehicle!
  "Sets status INACTIVE and clears the current driver; idempotent."
  deactivateFleetVehicle(id: ID!): FleetVehicle!
  deleteFleetVehicle(id: ID!): FleetVehicle!
}
```

### 6.3 `modules/devices/devices.graphql`

```graphql
enum FleetDeviceModel {
  STARLINK_TRACKER
  STARLINK_SCOUT
  OTHER
}
enum FleetDeviceOption {
  CELLULAR_4G
  SAFETY_SF
  IRF
  CAN
  DRIVER_ID
  GEOZONES_GO
  TEMPERATURE_DS
  ECONNECT
  WIFI
  VOICE
  EXTERNAL_ANTENNA
  RS232
  WILIOT
}

type FleetDevice @key(fields: "id") {
  id: ID!
  branchId: ID!
  branch: Branch!
  imei: String!
  vehicleId: ID!
  vehicle: FleetVehicleRef!
  model: FleetDeviceModel
  options: [FleetDeviceOption!]!
  firmwareVersion: String
  simPhoneNumber: String
  simIccid: String
  installedAt: DateTime
  notes: String
  "Latest sample recorded for this device on its current vehicle; null if never." # B2
  lastReportedAt: DateTime # B2
  createdAt: DateTime!
  updatedAt: DateTime!
}

type FleetDevicePage {
  items: [FleetDevice!]!
  total: Int!
  offset: Int!
  limit: Int!
}

input FleetDeviceFilter {
  models: [FleetDeviceModel!]
  options: [FleetDeviceOption!]
  vehicleIds: [ID!]
}

enum FleetDeviceSortField {
  IMEI
  INSTALLED_AT
  CREATED_AT
}
input FleetDeviceSort {
  field: FleetDeviceSortField! = CREATED_AT
  direction: FleetSortDirection! = DESC
}

input CreateFleetDeviceInput {
  imei: String!
  vehicleId: ID!
  model: FleetDeviceModel
  options: [FleetDeviceOption!]
  firmwareVersion: String
  simPhoneNumber: String
  simIccid: String
  installedAt: DateTime
  notes: String
}

input UpdateFleetDeviceInput {
  imei: String
  vehicleId: ID
  model: FleetDeviceModel
  options: [FleetDeviceOption!]
  firmwareVersion: String
  simPhoneNumber: String
  simIccid: String
  installedAt: DateTime
  notes: String
}

extend type Query {
  fleetDevices(
    offset: Int! = 0
    limit: Int! = 20
    search: String
    ids: [ID!]
    filter: FleetDeviceFilter
    sort: FleetDeviceSort
  ): FleetDevicePage!
  fleetDevice(id: ID!): FleetDevice!
}

extend type Mutation {
  createFleetDevice(input: CreateFleetDeviceInput!): FleetDevice!
  updateFleetDevice(id: ID!, input: UpdateFleetDeviceInput!): FleetDevice!
  deleteFleetDevice(id: ID!): FleetDevice!
}
```

### 6.4 `modules/drivers/drivers.graphql`

```graphql
enum FleetDriverStatus {
  ACTIVE
  ON_LEAVE
  INACTIVE
}
enum FleetLicenseCategory {
  B
  BE
  C1
  C1E
  C
  CE
  D1
  D1E
  D
  DE
}
enum FleetDocumentStatus {
  NOT_RECORDED
  VALID
  EXPIRING
  EXPIRED
}
enum FleetDriverDocumentType {
  DRIVING_LICENSE
  TACHOGRAPH_CARD
}

type FleetDriver {
  id: ID!
  branchId: ID!
  firstName: String!
  lastName: String!
  employeeNumber: String
  identificationKey: String
  phone: String
  email: String
  licenseNumber: String
  licenseCategories: [FleetLicenseCategory!]!
  licenseExpiresOn: Date
  tachographCardNumber: String
  tachographCardExpiresOn: Date
  status: FleetDriverStatus!
  notes: String
  vehicles: [FleetVehicleRef!]!
  documentStatus: FleetDocumentStatus!
  distance30dKm: Float! # B2
  tripCount30d: Int! # B2
  maneuversPer100Km30d: Float # B2
  createdAt: DateTime!
  updatedAt: DateTime!
}

type FleetDriverRef {
  id: ID!
  firstName: String!
  lastName: String!
  employeeNumber: String
  status: FleetDriverStatus!
}

type FleetDriverPage {
  items: [FleetDriver!]!
  total: Int!
  offset: Int!
  limit: Int!
}

input FleetDriverFilter {
  statuses: [FleetDriverStatus!]
  licenseCategories: [FleetLicenseCategory!]
  documentsExpireWithinDays: Int
  hasVehicle: Boolean
}

enum FleetDriverSortField {
  LAST_NAME
  EMPLOYEE_NUMBER
  LICENSE_EXPIRES_ON
  TACHOGRAPH_CARD_EXPIRES_ON
  CREATED_AT
}
input FleetDriverSort {
  field: FleetDriverSortField! = LAST_NAME
  direction: FleetSortDirection! = ASC
}

input CreateFleetDriverInput {
  firstName: String!
  lastName: String!
  employeeNumber: String
  identificationKey: String
  phone: String
  email: String
  licenseNumber: String
  licenseCategories: [FleetLicenseCategory!]
  licenseExpiresOn: Date
  tachographCardNumber: String
  tachographCardExpiresOn: Date
  status: FleetDriverStatus
  notes: String
}

input UpdateFleetDriverInput {
  firstName: String
  lastName: String
  employeeNumber: String
  identificationKey: String
  phone: String
  email: String
  licenseNumber: String
  licenseCategories: [FleetLicenseCategory!]
  licenseExpiresOn: Date
  tachographCardNumber: String
  tachographCardExpiresOn: Date
  status: FleetDriverStatus
  notes: String
}

# B2
type FleetDriverScorecard {
  driver: FleetDriver!
  asOf: DateTime
  windowStart: DateTime
  windowEnd: DateTime
  distanceKm: Float!
  tripCount: Int!
  scoredTripCount: Int!
  averageDrivingScore: Float
  averageEcoScore: Float
  maneuverCount: Int!
  maneuversPer100Km: Float
  maneuvers: [FleetManeuverCount!]!
  lowConfidence: Boolean!
}

extend type Query {
  fleetDrivers(
    offset: Int! = 0
    limit: Int! = 20
    search: String
    ids: [ID!]
    filter: FleetDriverFilter
    sort: FleetDriverSort
  ): FleetDriverPage!
  fleetDriver(id: ID!): FleetDriver!
  fleetDriverScorecard(driverId: ID!, days: Int! = 30): FleetDriverScorecard! # B2
}

extend type Mutation {
  createFleetDriver(input: CreateFleetDriverInput!): FleetDriver!
  updateFleetDriver(id: ID!, input: UpdateFleetDriverInput!): FleetDriver!
  deleteFleetDriver(id: ID!): FleetDriver!
}
```

### 6.5 `modules/vehicle-groups/vehicle-groups.graphql`

```graphql
enum FleetGroupColor {
  C1
  C2
  C3
  C4
  C5
  C6
  C7
  C8
}

type FleetVehicleGroup {
  id: ID!
  branchId: ID!
  name: String!
  description: String
  colorToken: FleetGroupColor!
  "Vehicles in the group, any status."
  vehicleCount: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type FleetVehicleGroupRef {
  id: ID!
  name: String!
  colorToken: FleetGroupColor!
}

type FleetVehicleGroupPage {
  items: [FleetVehicleGroup!]!
  total: Int!
  offset: Int!
  limit: Int!
  "Vehicles without a group in the Branch, any status; independent of search and ids."
  ungroupedVehicleCount: Int!
}

enum FleetVehicleGroupSortField {
  NAME
  CREATED_AT
}
input FleetVehicleGroupSort {
  field: FleetVehicleGroupSortField! = NAME
  direction: FleetSortDirection! = ASC
}

input CreateFleetVehicleGroupInput {
  name: String!
  description: String
  colorToken: FleetGroupColor
}
input UpdateFleetVehicleGroupInput {
  name: String
  description: String
  colorToken: FleetGroupColor
}

extend type Query {
  fleetVehicleGroups(
    offset: Int! = 0
    limit: Int! = 20
    search: String
    ids: [ID!]
    sort: FleetVehicleGroupSort
  ): FleetVehicleGroupPage!
  fleetVehicleGroup(id: ID!): FleetVehicleGroup!
}

extend type Mutation {
  createFleetVehicleGroup(input: CreateFleetVehicleGroupInput!): FleetVehicleGroup!
  updateFleetVehicleGroup(id: ID!, input: UpdateFleetVehicleGroupInput!): FleetVehicleGroup!
  deleteFleetVehicleGroup(id: ID!): FleetVehicleGroup!
}
```

### 6.6 `modules/telemetry/telemetry.graphql` (B2)

```graphql
enum FleetDataSource {
  DEMO
  MANUAL
}
enum FleetActivityStatus {
  MOVING
  IDLE
  PARKED
  ASSET
  NOT_CONNECTED
  NO_DEVICE
}
enum FleetFuelStatus {
  NORMAL
  LOW
  STALE
  NO_DATA
}

"Latest device-reported state of a vehicle, classified against the Branch data clock."
type FleetVehicleState {
  activity: FleetActivityStatus!
  lastReportedAt: DateTime
  latitude: Float
  longitude: Float
  address: String
  speedKph: Float
  headingDeg: Int
  ignition: Boolean
  fuelLevelPct: Float
  fuelStatus: FleetFuelStatus!
  externalVoltage: Float
  backupBatteryVoltage: Float
  engineHours: Float
  coolantTempC: Int
  "Latest non-null odometer from any source, including MANUAL readings."
  odometerKm: Float
  odometerRecordedAt: DateTime
  odometerSource: FleetDataSource
}

type FleetStatusSample {
  id: ID!
  vehicleId: ID!
  deviceImei: String
  source: FleetDataSource!
  recordedAt: DateTime!
  receivedAt: DateTime!
  latitude: Float
  longitude: Float
  address: String
  speedKph: Float
  headingDeg: Int
  ignition: Boolean
  odometerKm: Float
  fuelLevelPct: Float
  externalVoltage: Float
  backupBatteryVoltage: Float
  engineHours: Float
  coolantTempC: Int
}

type FleetStatusSampleSeries {
  vehicleId: ID!
  from: DateTime!
  to: DateTime!
  "Ascending by recordedAt, then id; at most 2,000 rows (the newest are kept)."
  items: [FleetStatusSample!]!
  truncated: Boolean!
}

type FleetDataClock {
  asOf: DateTime
  businessDate: Date!
  timeZone: String!
}

input RecordFleetOdometerReadingInput {
  vehicleId: ID!
  odometerKm: Float!
  recordedAt: DateTime!
}

extend type Query {
  fleetDataClock: FleetDataClock!
  fleetVehicleSamples(vehicleId: ID!, from: DateTime!, to: DateTime!): FleetStatusSampleSeries!
}

extend type Mutation {
  recordFleetOdometerReading(input: RecordFleetOdometerReadingInput!): FleetStatusSample!
}
```

### 6.7 `modules/trips/trips.graphql` (B2)

```graphql
type FleetTrip {
  id: ID!
  branchId: ID!
  vehicleId: ID!
  vehicle: FleetVehicleRef!
  driverId: ID
  driver: FleetDriverRef
  deviceImei: String
  source: FleetDataSource!
  startedAt: DateTime!
  "Null when the trip has not ended or no end was received."
  endedAt: DateTime
  durationSeconds: Int
  startAddress: String
  endAddress: String
  startLatitude: Float
  startLongitude: Float
  endLatitude: Float
  endLongitude: Float
  startOdometerKm: Float
  endOdometerKm: Float
  distanceKm: Float
  idleSeconds: Int
  maxSpeedKph: Float
  fuelUsedL: Float
  "Device-reported demo score 0–100; holita does not calculate it."
  drivingScore: Float
  ecoScore: Float
  maneuverCount: Int!
  "True when endedAt is null and startedAt is within 24 h before the Branch data clock; false otherwise (also when asOf is null)."
  inProgress: Boolean!
  createdAt: DateTime!
}

type FleetTripPage {
  items: [FleetTrip!]!
  total: Int!
  offset: Int!
  limit: Int!
  "Sum of non-null distanceKm over the whole filtered set."
  totalDistanceKm: Float!
}

input FleetTripFilter {
  startedFrom: DateTime
  startedTo: DateTime
  vehicleIds: [ID!]
  driverIds: [ID!]
  hasDriver: Boolean
  scored: Boolean
  drivingScoreBelow: Float
  hasEnd: Boolean
}

enum FleetTripSortField {
  STARTED_AT
  DISTANCE_KM
  DRIVING_SCORE
}
input FleetTripSort {
  field: FleetTripSortField! = STARTED_AT
  direction: FleetSortDirection! = DESC
}

extend type Query {
  fleetTrips(
    offset: Int! = 0
    limit: Int! = 20
    search: String
    ids: [ID!]
    filter: FleetTripFilter
    sort: FleetTripSort
  ): FleetTripPage!
  fleetTrip(id: ID!): FleetTrip!
}
```

The trip drawer's timeline uses `fleetEvents(filter: { tripIds: [$id] }, sort: { field: OCCURRED_AT, direction: ASC }, limit: 100)` and its maneuver bars use `fleetManeuverCounts(filter: { tripIds: [$id] })`.

### 6.8 `modules/events/events.graphql` (B2)

```graphql
enum FleetEventKind {
  HARSH_ACCELERATION
  HARSH_BRAKING
  SPEED_BUMP
  OVERTAKING
  ROUNDABOUT
  LANE_CHANGE
  SHARP_TURN
  OFF_ROAD
  SPEEDING
  IGNITION_ON
  IGNITION_OFF
  IDLING
  LOW_FUEL
  FUEL_DROP
  POWER_DISCONNECTED
  LOW_BACKUP_BATTERY
  CAN_DISCONNECTED
  DEVICE_OFFLINE
  DIAGNOSTIC_TROUBLE_CODE
  CRASH_DETECTED
}
enum FleetEventSeverity {
  INFO
  WARNING
  CRITICAL
}
enum FleetAlertStatus {
  OPEN
  ACKNOWLEDGED
  RESOLVED
}
enum FleetMeasurementUnit {
  KPH
  PERCENT
  VOLT
  MINUTE
}

type FleetEvent {
  id: ID!
  branchId: ID!
  vehicleId: ID!
  vehicle: FleetVehicleRef!
  tripId: ID
  driverId: ID
  driver: FleetDriverRef
  deviceImei: String
  source: FleetDataSource!
  occurredAt: DateTime!
  kind: FleetEventKind!
  severity: FleetEventSeverity!
  intensity: Int
  latitude: Float
  longitude: Float
  address: String
  speedKph: Float
  measuredValue: Float
  thresholdValue: Float
  measurementUnit: FleetMeasurementUnit
  troubleCode: String
  details: String
  "Null for informational events; alerts have a status."
  alertStatus: FleetAlertStatus
  acknowledgedAt: DateTime
  resolvedAt: DateTime
  remark: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

type FleetEventPage {
  items: [FleetEvent!]!
  total: Int!
  offset: Int!
  limit: Int!
}

type FleetAlertCounts {
  open: Int!
  openCritical: Int!
  acknowledged: Int!
  resolved: Int!
}

type FleetManeuverCount {
  kind: FleetEventKind!
  intensity1: Int!
  intensity2: Int!
  intensity3: Int!
  intensityUnknown: Int!
  total: Int!
}

input FleetEventFilter {
  actionable: Boolean
  alertStatuses: [FleetAlertStatus!]
  severities: [FleetEventSeverity!]
  kinds: [FleetEventKind!]
  vehicleIds: [ID!]
  driverIds: [ID!]
  tripIds: [ID!]
  occurredFrom: DateTime
  occurredTo: DateTime
}

enum FleetEventSortField {
  OCCURRED_AT
  SEVERITY
}
input FleetEventSort {
  field: FleetEventSortField! = OCCURRED_AT
  direction: FleetSortDirection! = DESC
}

input FleetAlertTransitionInput {
  expectedStatus: FleetAlertStatus!
  "Omitted: unchanged. Null or blank: cleared. Up to 1,000 characters."
  remark: String
}

extend type Query {
  fleetEvents(
    offset: Int! = 0
    limit: Int! = 20
    search: String
    ids: [ID!]
    filter: FleetEventFilter
    sort: FleetEventSort
  ): FleetEventPage!
  fleetEvent(id: ID!): FleetEvent!
  "Counts actionable events matching search and filter (same rules as fleetEvents), ignoring filter.actionable and filter.alertStatuses."
  fleetAlertCounts(search: String, filter: FleetEventFilter): FleetAlertCounts!
  "Nine maneuver kinds in enum order, zero rows included. Requires tripIds or a period of at most 93 days."
  fleetManeuverCounts(filter: FleetEventFilter!): [FleetManeuverCount!]!
}

extend type Mutation {
  acknowledgeFleetAlert(id: ID!, input: FleetAlertTransitionInput!): FleetEvent!
  resolveFleetAlert(id: ID!, input: FleetAlertTransitionInput!): FleetEvent!
  reopenFleetAlert(id: ID!, input: FleetAlertTransitionInput!): FleetEvent!
}
```

There is no navigation-badge query: the shell must not read business data. `fleetAlertCounts`
serves only the Alerts page segments. Its `search` is validated and tokenised exactly like the
`fleetEvents` search (3.2 step 3, 3.3, the `fleetEvents` search fields of 3.6), so the segment
counts always describe the list the operator sees.

### 6.9 `modules/service-tasks/service-tasks.graphql` (B2)

```graphql
enum FleetServiceType {
  GENERAL_SERVICE
  OIL_CHANGE
  ANNUAL_INSPECTION
  TACHOGRAPH_CALIBRATION
  BRAKES
  TIRES
  REPAIR
  OTHER
}
enum FleetServiceStatus {
  PLANNED
  DONE
  CANCELLED
}
enum FleetServiceUrgency {
  OVERDUE
  DUE_SOON
  UNKNOWN_ODOMETER
  UPCOMING
}

type FleetServiceTask {
  id: ID!
  branchId: ID!
  vehicleId: ID!
  vehicle: FleetVehicleRef!
  serviceType: FleetServiceType!
  status: FleetServiceStatus!
  title: String
  dueOn: Date
  dueOdometerKm: Int
  completedOn: Date
  completedOdometerKm: Int
  workshop: String
  replacedParts: String
  "EUR cents; 0 is a free (warranty) job, null is unknown."
  costCents: Int
  notes: String
  "Null unless PLANNED."
  urgency: FleetServiceUrgency
  remainingDays: Int
  remainingKm: Int
  createdAt: DateTime!
  updatedAt: DateTime!
}

type FleetServiceTaskPage {
  items: [FleetServiceTask!]!
  total: Int!
  offset: Int!
  limit: Int!
}

type FleetServiceTaskCompletion {
  completed: FleetServiceTask!
  next: FleetServiceTask
}

"PLANNED tasks of vehicles that are not INACTIVE, counted per task."
type FleetServiceSummary {
  businessDate: Date!
  overdue: Int!
  dueSoon: Int!
  unknownOdometer: Int!
  upcoming: Int!
  inWorkshopVehicles: Int!
  completedLast30Days: Int!
  costLast30DaysCents: Int!
  costWindowStart: Date!
  costWindowEnd: Date!
}

input FleetServiceTaskFilter {
  statuses: [FleetServiceStatus!]
  urgencies: [FleetServiceUrgency!]
  serviceTypes: [FleetServiceType!]
  vehicleIds: [ID!]
  completedFrom: Date
  completedTo: Date
}

enum FleetServiceTaskSortField {
  URGENCY
  DUE_ON
  COMPLETED_ON
  CREATED_AT
}
input FleetServiceTaskSort {
  field: FleetServiceTaskSortField! = URGENCY
  direction: FleetSortDirection! = ASC
}

input CreateFleetServiceTaskInput {
  vehicleId: ID!
  serviceType: FleetServiceType!
  title: String
  dueOn: Date
  dueOdometerKm: Int
  workshop: String
  notes: String
}

input UpdateFleetServiceTaskInput {
  serviceType: FleetServiceType
  title: String
  dueOn: Date
  dueOdometerKm: Int
  workshop: String
  notes: String
}

"Giving nextDueOn or nextDueOdometerKm schedules the next PLANNED task in the same transaction."
input CompleteFleetServiceTaskInput {
  completedOn: Date!
  completedOdometerKm: Int
  costCents: Int
  workshop: String
  replacedParts: String
  notes: String
  nextDueOn: Date
  nextDueOdometerKm: Int
  nextTitle: String
}

extend type Query {
  fleetServiceTasks(
    offset: Int! = 0
    limit: Int! = 20
    search: String
    ids: [ID!]
    filter: FleetServiceTaskFilter
    sort: FleetServiceTaskSort
  ): FleetServiceTaskPage!
  fleetServiceTask(id: ID!): FleetServiceTask!
  fleetServiceSummary: FleetServiceSummary!
}

extend type Mutation {
  createFleetServiceTask(input: CreateFleetServiceTaskInput!): FleetServiceTask!
  updateFleetServiceTask(id: ID!, input: UpdateFleetServiceTaskInput!): FleetServiceTask!
  completeFleetServiceTask(
    id: ID!
    input: CompleteFleetServiceTaskInput!
  ): FleetServiceTaskCompletion!
  cancelFleetServiceTask(id: ID!): FleetServiceTask!
  deleteFleetServiceTask(id: ID!): FleetServiceTask!
}
```

### 6.10 `modules/overview/overview.graphql` (B3)

Each Overview card is its own root query and its own admin operation document, so one failing
aggregate never empties another card and each card retries alone. Recent trips, groups and the
Alerts segments reuse the standard lists (`fleetTrips`, `fleetVehicleGroups`, `fleetAlertCounts`).

```graphql
"A KPI value with the inputs needed to explain it."
type FleetMetric {
  "Null when there is no data or the denominator is zero; never a fabricated zero."
  value: Float
  numerator: Float!
  denominator: Float!
  "Same formula over the preceding window, where the KPI defines one."
  previousValue: Float
  windowStart: DateTime
  windowEnd: DateTime
  "Rows or vehicles that contributed, and how many could have."
  coveredCount: Int!
  eligibleCount: Int!
}

type FleetVehicleCounts {
  total: Int!
  operational: Int!
  inWorkshop: Int!
  inactive: Int!
  operationalWithoutDevice: Int!
}

type FleetDocumentCounts {
  businessDate: Date!
  expired: Int!
  expiring: Int!
}

type FleetOverviewKpis {
  asOf: DateTime
  businessDate: Date!
  vehicles: FleetVehicleCounts!
  reporting48h: FleetMetric!
  alerts: FleetAlertCounts!
  newAlerts24h: Int!
  service: FleetServiceSummary!
  documents: FleetDocumentCounts!
  lowFuelVehicles: Int!
  distance7dKm: FleetMetric!
  utilization7d: FleetMetric!
  averageDrivingScore7d: FleetMetric!
  maneuversPer100Km7d: FleetMetric!
  fuelEconomy7dLPer100Km: FleetMetric!
}

type FleetActivityCount {
  activity: FleetActivityStatus!
  count: Int!
}

type FleetActivityDistribution {
  asOf: DateTime
  "Operational (not INACTIVE) vehicles."
  total: Int!
  "All six statuses in enum order, zero counts included."
  counts: [FleetActivityCount!]!
}

type FleetDailyDistance {
  date: Date!
  distanceKm: Float!
  tripCount: Int!
}

type FleetDailyDistanceSeries {
  asOf: DateTime
  "One entry per Europe/Sofia date ending with the date of asOf; empty when asOf is null."
  days: [FleetDailyDistance!]!
}

enum FleetAttentionReason {
  CRITICAL_ALERT
  NOT_CONNECTED
  SERVICE_OVERDUE
  LOW_FUEL
  DRIVER_DOCUMENT_EXPIRED
  WARNING_ALERTS
}

type FleetAttentionItem {
  vehicle: FleetVehicleRef!
  primaryReason: FleetAttentionReason!
  reasons: [FleetAttentionReason!]!
  occurredAt: DateTime
}

type FleetAttentionList {
  asOf: DateTime
  businessDate: Date!
  total: Int!
  items: [FleetAttentionItem!]!
}

type FleetDriverDocument {
  driver: FleetDriverRef!
  document: FleetDriverDocumentType!
  expiresOn: Date!
  status: FleetDocumentStatus!
  assignedVehicles: [FleetVehicleRef!]!
}

type FleetExpiringDocumentList {
  businessDate: Date!
  total: Int!
  items: [FleetDriverDocument!]!
}

extend type Query {
  fleetOverviewKpis: FleetOverviewKpis!
  fleetActivity: FleetActivityDistribution!
  fleetDailyDistance(days: Int! = 14): FleetDailyDistanceSeries!
  fleetAttention(limit: Int! = 10): FleetAttentionList!
  fleetExpiringDocuments(withinDays: Int! = 30, limit: Int! = 10): FleetExpiringDocumentList!
}
```

Argument bounds: `days` 1–31, `limit` (attention, documents) 1–50, `withinDays` 0–365.

### 6.11 Federation

- `FleetVehicle` and `FleetDevice` keep `@key(fields: "id")`; `@ResolveReference` calls `service.find`, which computes the same derived values as the list for one ID. No other Fleet type gets a key; no other subgraph references Fleet types. Gateway changes nothing but the regenerated supergraph.
- `branch: Branch!` stays only on `FleetVehicle` and `FleetDevice`.
- Every new resolver class uses `@UseGuards(FleetEnabledGuard)` like the existing ones.
- All Fleet queries stay well inside the five-second Router subgraph budget: pages are at most 100 rows and every aggregate uses the indexes in section 4; no request scans another Branch.

### 6.12 Public inventory after each slice (for `contracts.unit.spec.mts`)

| Slice | Queries added                                                                                                                                                                                                                      | Mutations added                                                                                                                                                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1    | `fleetDriver`, `fleetDrivers`, `fleetVehicleGroup`, `fleetVehicleGroups`                                                                                                                                                           | `createFleetDriver`, `updateFleetDriver`, `deleteFleetDriver`, `createFleetVehicleGroup`, `updateFleetVehicleGroup`, `deleteFleetVehicleGroup`, `deactivateFleetVehicle`                                                           |
| B2    | `fleetDataClock`, `fleetVehicleSamples`, `fleetTrips`, `fleetTrip`, `fleetEvents`, `fleetEvent`, `fleetAlertCounts`, `fleetManeuverCounts`, `fleetServiceTasks`, `fleetServiceTask`, `fleetServiceSummary`, `fleetDriverScorecard` | `recordFleetOdometerReading`, `acknowledgeFleetAlert`, `resolveFleetAlert`, `reopenFleetAlert`, `createFleetServiceTask`, `updateFleetServiceTask`, `completeFleetServiceTask`, `cancelFleetServiceTask`, `deleteFleetServiceTask` |
| B3    | `fleetOverviewKpis`, `fleetActivity`, `fleetDailyDistance`, `fleetAttention`, `fleetExpiringDocuments`                                                                                                                             | —                                                                                                                                                                                                                                  |

## 7. Derived values: definitions and owners

All definitions below are single: one TypeScript function or one SQL fragment, reused everywhere.

| Field                                                      | Definition                                                                                                                                                                                                         | Clock    | Computed by                                                   | Query                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------- | -------------------------------------- |
| `FleetVehicle.deviceCount`                                 | Devices of the vehicle                                                                                                                                                                                             | —        | `VehiclesRepository` (`_count` include)                       | same query as the page                 |
| `FleetVehicle.state`                                       | 7.1                                                                                                                                                                                                                | data     | `TelemetryService.vehicleStates(scope, ids)`                  | 1 `asOf` aggregate + 1 raw facts query |
| `FleetVehicle.openAlertCount`                              | Events of the vehicle with `alertStatus = OPEN`                                                                                                                                                                    | —        | `EventsService.openAlertCounts(scope, ids)`                   | Prisma `groupBy`                       |
| `FleetVehicle.nextService`                                 | The vehicle's PLANNED task with the worst urgency (OVERDUE < DUE_SOON < UNKNOWN_ODOMETER < UPCOMING), then `dueOn ASC NULLS LAST`, `remainingKm ASC NULLS LAST`, `id DESC`; the single documented exception of 2.3 | business | `ServiceTasksService.nextForVehicles(scope, ids)`             | 1 raw urgency query                    |
| `FleetDevice.lastReportedAt`                               | `max(recordedAt)` of samples with the device's current `(vehicleId, imei)`                                                                                                                                         | —        | `TelemetryService.lastReported(scope, pairs)`                 | Prisma `groupBy` with `_max`           |
| `FleetDriver.vehicles`                                     | Vehicles whose `currentDriverId` is the driver, by plate                                                                                                                                                           | —        | `DriversRepository` include                                   | same query                             |
| `FleetDriver.documentStatus`                               | 7.3                                                                                                                                                                                                                | business | `driverDocumentStatus()` pure function                        | none                                   |
| `FleetDriver.distance30dKm`, `tripCount30d`                | Σ non-null `distanceKm`, count of trips with `startedAt ∈ (asOf − 30 d, asOf]`; 0 when `asOf` is null                                                                                                              | data     | `TripsService.driverTotals(scope, ids, window)`               | Prisma `groupBy`                       |
| `FleetDriver.maneuversPer100Km30d`                         | Maneuver events in the same window ÷ distance × 100; null when distance is 0 or `asOf` is null                                                                                                                     | data     | `EventsService.maneuverTotalsByDriver(scope, ids, window)`    | Prisma `groupBy`                       |
| `FleetVehicleGroup.vehicleCount`                           | Vehicles with the group, any status                                                                                                                                                                                | —        | `VehicleGroupsRepository` (`_count`)                          | same query                             |
| `FleetVehicleGroupPage.ungroupedVehicleCount`              | Vehicles with `groupId` null, any status                                                                                                                                                                           | —        | `VehicleGroupsRepository.list` transaction                    | `count`                                |
| `FleetTrip.durationSeconds`                                | `floor((endedAt − startedAt) / 1000)`; null without `endedAt`                                                                                                                                                      | —        | `TripsService` mapping                                        | none                                   |
| `FleetTrip.inProgress`                                     | `endedAt` null and `startedAt ≥ asOf − OPEN_TRIP_MAX_HOURS` (24 h); `false` when `asOf` is null or `endedAt` is set                                                                                                | data     | `TripsService` mapping with `TelemetryService.asOf(scope)`    | 1 `asOf` aggregate per request         |
| `FleetTrip.maneuverCount`                                  | Events of the nine maneuver kinds with the trip                                                                                                                                                                    | —        | `EventsService.maneuverCountsByTrip(scope, vehicleTripPairs)` | Prisma `groupBy`                       |
| `FleetTripPage.totalDistanceKm`                            | Σ non-null `distanceKm` over the filtered set                                                                                                                                                                      | —        | `TripsRepository.list` transaction                            | `aggregate`                            |
| `FleetEvent.measurementUnit`                               | By kind: SPEEDING → KPH; IDLING, DEVICE_OFFLINE → MINUTE; LOW_FUEL, FUEL_DROP → PERCENT; POWER_DISCONNECTED, LOW_BACKUP_BATTERY → VOLT; others null                                                                | —        | `measurementUnit(kind)` pure function                         | none                                   |
| `FleetServiceTask.urgency`, `remainingDays`, `remainingKm` | 7.4                                                                                                                                                                                                                | business | `ServiceTasksRepository` SQL                                  | raw                                    |

### 7.1 Vehicle facts and activity (`telemetry/vehicle-state.ts`)

`TelemetryRepository.vehicleFacts(scope, ids | 'all')` returns, per vehicle: `status`,
`hasDevice` (`EXISTS` Device), the latest **device** sample (`deviceImei IS NOT NULL`, ordered
`recordedAt DESC, id DESC`, `LIMIT 1` in a `LEFT JOIN LATERAL`) and the latest non-null odometer of
any source (second `LATERAL`). `classifyVehicleState(facts, asOf)` is the only classifier:

1. no device → `NO_DEVICE`;
2. no device sample, `asOf` null, or `recordedAt < asOf − 48 h` → `NOT_CONNECTED`;
3. `ignition` null → `ASSET`;
4. `ignition` true and `speedKph ≥ 5` → `MOVING`;
5. `ignition` true (speed below 5 or null) → `IDLE`;
6. `ignition` false → `PARKED`.

It applies to every vehicle, including INACTIVE ones. Values of a stale sample are still returned
(the UI labels them by `lastReportedAt`).

### 7.2 Fuel status (one definition for KPI, attention and list tone)

`NO_DATA` when there is no device sample or `fuelLevelPct` is null; otherwise `STALE` when
`recordedAt < asOf − 6 h`; otherwise `LOW` when `fuelLevelPct < 12`; otherwise `NORMAL`.
"Low fuel vehicles" = operational vehicles with `LOW`.

### 7.3 Driver document status

For each of `licenseExpiresOn` and `tachographCardExpiresOn` that is set: `EXPIRED` when
`< businessDate`, `EXPIRING` when `≤ businessDate + 30`, else `VALID`. The driver's status is the
worst of the two (`EXPIRED` > `EXPIRING` > `VALID`); `NOT_RECORDED` when both are null. Document
counts consider drivers with status ≠ INACTIVE: `expired` = drivers with `EXPIRED`, `expiring` =
drivers with `EXPIRING`. The document list returns one item per (driver, document) with status
`EXPIRED` or `EXPIRING`, sorted by `expiresOn ASC`, `lastName`, `firstName`, driver `id`, document
type.

### 7.4 Service urgency (single SQL fragment, `service-tasks/service-urgency.sql.ts`)

```sql
SELECT t."id", t."vehicleId", t."serviceType"::text AS "serviceType", t."status"::text AS "status",
  t."title", t."dueOn"::text AS "dueOn", t."dueOdometerKm", t."completedOn"::text AS "completedOn",
  t."completedOdometerKm", t."workshop", t."replacedParts", t."costCents", t."notes",
  t."createdAt", t."updatedAt", o."odometerKm" AS "currentOdometerKm",
  CASE
    WHEN t."status"::text <> 'PLANNED' THEN NULL
    WHEN (t."dueOn" IS NOT NULL AND t."dueOn" < ${today}::date)
      OR (t."dueOdometerKm" IS NOT NULL AND o."odometerKm" >= t."dueOdometerKm") THEN 'OVERDUE'
    WHEN (t."dueOn" IS NOT NULL AND t."dueOn" <= ${today}::date + ${dueSoonDays}::int)
      OR (t."dueOdometerKm" IS NOT NULL AND t."dueOdometerKm" - o."odometerKm" <= ${dueSoonKm}::int) THEN 'DUE_SOON'
    WHEN t."dueOdometerKm" IS NOT NULL AND o."odometerKm" IS NULL THEN 'UNKNOWN_ODOMETER'
    ELSE 'UPCOMING'
  END AS "urgency",
  CASE WHEN t."status"::text = 'PLANNED' AND t."dueOn" IS NOT NULL
    THEN (t."dueOn" - ${today}::date)::int END AS "remainingDays",
  CASE WHEN t."status"::text = 'PLANNED' AND t."dueOdometerKm" IS NOT NULL AND o."odometerKm" IS NOT NULL
    THEN round(t."dueOdometerKm" - o."odometerKm")::int END AS "remainingKm"
FROM ${ServiceTask} t
LEFT JOIN LATERAL (
  SELECT s."odometerKm" FROM ${VehicleStatusSample} s
  WHERE s."tenantId" = ${tenantId}::uuid AND s."branchId" = ${branchId}::uuid
    AND s."vehicleId" = t."vehicleId" AND s."odometerKm" IS NOT NULL
  ORDER BY s."recordedAt" DESC, s."id" DESC LIMIT 1
) o ON t."status"::text = 'PLANNED'
WHERE t."tenantId" = ${tenantId}::uuid AND t."branchId" = ${branchId}::uuid
```

`${ServiceTask}` and `${VehicleStatusSample}` are `fleetTable(schema, …)` fragments; `today`,
`dueSoonDays` and `dueSoonKm` come from the business date and 2.6.
`ServiceTasksRepository` wraps it as a CTE for: the list (search/filter/sort/`LIMIT`/`OFFSET` plus
a `count(*)::int` over the same CTE, both inside one `RepeatableRead` interactive transaction;
the urgency sort uses `CASE urgency WHEN 'OVERDUE' THEN 1 WHEN 'DUE_SOON' THEN 2 WHEN
'UNKNOWN_ODOMETER' THEN 3 WHEN 'UPCOMING' THEN 4 ELSE 5 END`), `find` by IDs, `nextForVehicles`,
`summary` (tasks of vehicles with status ≠ INACTIVE) and `overdueVehicleIds`. Search tokens use
`ILIKE ${'%' + escaped + '%'}::text` with the same escaping as `literalContains`. Vehicle refs for
the returned rows are loaded with one Prisma `findMany` by IDs.

Summary windows: `costWindowEnd = businessDate`, `costWindowStart = businessDate − 29`;
`completedLast30Days` and `costLast30DaysCents` (Σ non-null `costCents`) use DONE tasks with
`completedOn` in that window.

### 7.5 Overview formulas (B3)

Telemetry metrics use `asOf`; when `asOf` is null every telemetry `FleetMetric` has
`value = null`, numerators/denominators/counts 0 and null windows. "Operational" means status ≠
INACTIVE. Trip and event windows are half-open `(start, end]`; the reporting window is closed
(`recordedAt ≥ asOf − 48 h` reports, matching 7.1).

| Metric                   | value                         | numerator                                                      | denominator                          | previousValue                      | window                              | coveredCount / eligibleCount                                 |
| ------------------------ | ----------------------------- | -------------------------------------------------------------- | ------------------------------------ | ---------------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| `reporting48h`           | numerator ÷ denominator       | operational vehicles with device, activity not `NOT_CONNECTED` | operational vehicles with ≥ 1 device | —                                  | `[asOf − 48 h, asOf]`               | numerator / denominator                                      |
| `distance7dKm`           | Σ distanceKm                  | Σ distanceKm                                                   | 1                                    | Σ over `(asOf − 14 d, asOf − 7 d]` | `(asOf − 7 d, asOf]` by `startedAt` | trips with distance / trips in window                        |
| `utilization7d`          | numerator ÷ denominator       | operational vehicles with ≥ 1 trip in window                   | operational vehicles                 | same over the previous window      | 7 d                                 | numerator / denominator                                      |
| `averageDrivingScore7d`  | Σ(score × km) ÷ Σ km          | Σ(drivingScore × distanceKm)                                   | Σ distanceKm of scored trips         | same over the previous window      | 7 d                                 | scored trips with distance ≥ 0.5 / trips with distance ≥ 0.5 |
| `maneuversPer100Km7d`    | numerator ÷ denominator × 100 | maneuver events (`occurredAt`) in window                       | Σ distanceKm in window               | same over the previous window      | 7 d                                 | trips with distance / trips in window                        |
| `fuelEconomy7dLPer100Km` | numerator ÷ denominator × 100 | Σ fuelUsedL of trips with fuel and distance > 0                | Σ distanceKm of the same trips       | same over the previous window      | 7 d                                 | vehicles with such trips / vehicles with any trip in window  |

Counts: `vehicles` from vehicle facts; `alerts` from `EventsService.alertCounts` (unfiltered);
`newAlerts24h` = actionable events with `occurredAt ∈ (asOf − 24 h, asOf]` (0 when `asOf` is
null); `service` from `ServiceTasksService.summary`; `documents` from 7.3; `lowFuelVehicles` from
7.2. `fleetActivity` counts operational vehicles by 7.1. `fleetDailyDistance(days)` returns
`days` consecutive Sofia dates ending with `date(asOf)`, each with Σ non-null distance and trip
count of trips whose `startedAt` is on that Sofia date and `≤ asOf`, zero-filled
(`("startedAt" AT TIME ZONE 'Europe/Sofia')::date` with the zone passed as `${zone}::text`).

### 7.6 Attention queue (`fleetAttention`)

One item per operational vehicle with at least one reason, in priority order:

| Priority | Reason                    | Rule                                                         | `occurredAt` contribution         |
| -------- | ------------------------- | ------------------------------------------------------------ | --------------------------------- |
| 1        | `CRITICAL_ALERT`          | ≥ 1 OPEN alert with severity CRITICAL                        | earliest such `occurredAt`        |
| 2        | `NOT_CONNECTED`           | activity `NOT_CONNECTED` (7.1)                               | latest device sample time or null |
| 3        | `SERVICE_OVERDUE`         | ≥ 1 PLANNED task with urgency OVERDUE                        | null                              |
| 4        | `LOW_FUEL`                | fuel status `LOW` (7.2)                                      | sample `recordedAt`               |
| 5        | `DRIVER_DOCUMENT_EXPIRED` | current driver's licence or tachograph card `< businessDate` | null                              |
| 6        | `WARNING_ALERTS`          | ≥ 3 OPEN alerts with severity WARNING                        | earliest such `occurredAt`        |

`reasons` are in priority order, `primaryReason` is the first, `occurredAt` belongs to the primary
reason. Sort by primary priority, then `occurredAt ASC NULLS LAST`, then plate (ordinal UTF-16
code-unit comparison, as JavaScript `<` on strings; no locale collation), then `id`. `total`
counts all items; `items` holds the first `limit`. The service merges the facts query, two event
`groupBy`s, `ServiceTasksService.overdueVehicleIds` and one driver query in memory (bounded by the
Branch's vehicle count).

## 8. Module and file plan

### 8.1 New and changed files under `apps/fleet`

| Path                                                               | Slice | Responsibility                                                                                                                                                                         |
| ------------------------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                             | B1/B2 | Section 4                                                                                                                                                                              |
| `prisma/migrations/20261018100000_fleet_master_data/migration.sql` | B1    | Section 5                                                                                                                                                                              |
| `prisma/migrations/20261018110000_fleet_activity/migration.sql`    | B2    | Section 5                                                                                                                                                                              |
| `prisma/demo/*.ts`                                                 | B4    | Section 10                                                                                                                                                                             |
| `package.json`                                                     | B4    | Script `db:seed:demo` (`tsx prisma/demo/cli.ts`) with `predb:seed:demo: npm run db:generate`                                                                                           |
| root `package.json` (outside `apps/fleet`)                         | B4    | Only the script `db:seed:fleet-demo` (10.1); the DS agent owns every other root script change (frontend 10.4)                                                                          |
| `src/app.module.ts`                                                | all   | Import every module; `typeDefs` list in the file order of section 6; scalar resolvers                                                                                                  |
| `src/graphql/common.graphql`                                       | B1    | 6.1 (moved link, `DateTime`, `Branch` out of `vehicles.graphql`)                                                                                                                       |
| `src/graphql/scalars.ts` (+ `scalars.spec.ts`)                     | B1    | `DateTimeScalar`, `DateScalar`, `dateOnlyToDate`, `dateToDateOnly`, `isDateOnly`                                                                                                       |
| `src/clock/fleet-clock.ts`, `src/clock/clock.module.ts`            | B1    | `FleetClock.now()`, `businessDate(instant)`, `addDays(date, n)`; module exports `FleetClock`                                                                                           |
| `src/fleet-thresholds.ts`                                          | B1    | 2.6 constants                                                                                                                                                                          |
| `src/validation.ts` (+ new `src/validation.spec.ts`)               | B1    | 3.7 and 9.1 helpers, `requireScope(context): FleetScope`, `invalidFields`, `conflict`, `uniqueViolation`, `persistenceError(error, entity, conflictMessage?)`                          |
| `src/database/search.ts`                                           | B1    | `literalContains`, `nullsLast`                                                                                                                                                         |
| `src/database/sql.ts` (+ `sql.spec.ts`)                            | B2    | `fleetTable(schema, table)` with a closed table-name union, row field readers (`recordOf`, `text`, `textOrNull`, `numberOrNull`, `integer`, `dateOrNull`, `booleanOrNull`)             |
| `src/modules/vehicles/*`                                           | B1/B2 | SDL 6.2; repository (list/find/create/update/deactivate/delete, scoped group/driver existence checks, duplicate pre-check); service attaches refs (B1) and B2 derived values; resolver |
| `src/modules/devices/*`                                            | B1/B2 | SDL 6.3; option-for-model validation; vehicle ref include; `lastReportedAt` (B2); no longer imports `VehiclesModule`                                                                   |
| `src/modules/drivers/*`                                            | B1/B2 | SDL 6.4; CRUD, document status, deletion/deactivation rules, 30-day stats and scorecard (B2), `documentCounts`, `expiringDocuments`, `expiredAssignedVehicleIds`                       |
| `src/modules/vehicle-groups/*`                                     | B1    | SDL 6.5; CRUD, counts, ungrouped count                                                                                                                                                 |
| `src/modules/telemetry/*`                                          | B2    | SDL 6.6; `vehicle-state.ts` (7.1/7.2); repository (`asOf`, `vehicleFacts`, `lastReported`, `samples`, `insertManualReading`, `latestOdometerReading`); data clock; odometer mutation   |
| `src/modules/trips/*`                                              | B2    | SDL 6.7; list/find; `inProgress` from the data clock (imports `TelemetryModule`); `driverTotals`; window aggregates and daily distance for the overview                                |
| `src/modules/events/*`                                             | B2    | SDL 6.8; list/find; transitions; `alertCounts`, `openAlertCounts`, `maneuverCounts…`, attention alert facts                                                                            |
| `src/modules/service-tasks/*`                                      | B2    | SDL 6.9; `service-urgency.sql.ts`; raw list; CRUD/complete/cancel/delete; `nextForVehicles`, `summary`, `overdueVehicleIds`                                                            |
| `src/modules/overview/*`                                           | B3    | SDL 6.10; resolver + service composing the module services; no repository of its own                                                                                                   |
| `test/*.db.spec.ts`, `test/fleet-demo.unit.spec.ts`                | all   | Section 11                                                                                                                                                                             |

Every module directory holds `<name>.graphql`, `<name>.module.ts`, `<name>.resolver.ts`,
`<name>.service.ts`, `<name>.repository.ts` (not overview) and `<name>.service.spec.ts`.
Module imports form a DAG: Telemetry ← Devices, Vehicles, Drivers, Trips, Overview; Events ← Vehicles,
Drivers, Trips, Overview; Trips ← Drivers, Overview; ServiceTasks ← Vehicles, Overview; Drivers ←
Overview. Each module imports `DatabaseModule`, plus `CoreClientModule` if it creates records and
`ClockModule` if it uses business dates. Exported services: Telemetry, Events, Trips, ServiceTasks,
Drivers. Cross-module calls pass the already verified `FleetScope { tenantId, branchId }`; only
resolver-facing methods take the request context.

### 8.2 Helpers and their contracts

- `requireScope(context)`: `{ tenantId: requireTenant(context), branchId: uuid(context.branchId, 'x-branch-id') }`.
- `invalidFields(errors: { path: string; message: string }[])`: one `BadRequestException` with all fieldErrors; message = first message.
- `conflict(message)`: `ConflictException`.
- `uniqueViolation(error): { readonly index: string | null; readonly fields: readonly string[] } | null`: `null` unless `error` is a `PrismaClientKnownRequestError` with code P2002. Otherwise it reads `error.meta.driverAdapterError.cause.constraint` (S5) step by step without casts: `meta` is a record, `driverAdapterError` is `instanceof Error`, `'cause' in` it and the cause is an object, `'constraint' in` the cause and it is an object; then `index` is returned when `typeof constraint.index === 'string'`, and `fields` when `constraint.fields` is an array of strings (surrounding double quotes removed). Any missing step yields `{ index: null, fields: [] }`. Services map `index` through their unique map (9.x), else the single entry of `fields` other than `tenantId`/`branchId` when it names a mapped column; anything else is the unmapped case of 2.4.
- `persistenceError(error, entity, conflictMessage?)`: P2025 → NOT_FOUND, P2003 → CONFLICT with the entity-specific message (9.x), otherwise rethrow.
- `fleetTable(schema, table)`: `Prisma.raw` of `"<schema with doubled quotes>"."<table>"`; `table` is `'Vehicle' | 'Device' | 'Driver' | 'VehicleGroup' | 'VehicleStatusSample' | 'Trip' | 'FleetEvent' | 'ServiceTask'`.

### 8.3 `tools/graphql`

| File                      | Change                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `contracts.mts`           | Fleet `path: 'apps/fleet/src/graphql/common.graphql'`, `additionalPaths` = module SDL files in section-6 order (per slice)                                                                                                                                                                                                                       |
| `generate.mts`            | `scalars: { ID: 'string', DateTime: client ? 'string' : { input: 'string', output: 'Date' }, Date: 'string' }`                                                                                                                                                                                                                                   |
| `contracts.unit.spec.mts` | Exact Query/Mutation inventory per 6.12; assert `FleetSortDirection`, `FleetVehicleRef`, `Date` exist and `FleetVehicleSortDirection` does not; operation list unchanged until the frontend adds operation files                                                                                                                                 |
| `federation-fixture.mts`  | Also return the guarded Fleet test URL without its `schema` parameter (`fleetDatabaseUrl`) and the per-run schema name (`fleetSchema`), so specs can insert schema-qualified telemetry/event rows with `pg` (no API creates them)                                                                                                                |
| `federation.db.spec.mts`  | Device case selects `vehicle { id licensePlate }` (no `branch` on the ref); new cases in 11.4                                                                                                                                                                                                                                                    |
| `router.smoke.spec.mts`   | B1: the business-error case for `deleteFleetVehicle` (a Vehicle with a Device) expects `CONFLICT` with the new message "Vehicle has devices or history; deactivate it instead." (9.2) instead of "Vehicle is still referenced by another record."; every other case stays and must pass. Run by `npm run test:gateway:router` in the B1–B3 gates |

`gateway-benchmark.mts` stays valid without changes: it selects `vehicle { id licensePlate }` on
devices (valid on `FleetVehicleRef`), `branch { id name }` on vehicles/devices and literal sort
directions.

### 8.4 Admin type-only fallout (B1)

`apps/admin/src/app/features/fleet/vehicles/vehicle-list-query.ts` and
`devices/device-list-query.ts` import `FleetSortDirection` instead of the removed per-entity
direction types. No template, behaviour or operation change; the admin Fleet unit tests and the
Vehicles/Devices smoke tests must still pass. Any further admin work belongs to the frontend plan.

## 9. Mutation validation reference

### 9.1 Field helpers (`validation.ts`)

`text(value, path, max)` and `optionalText` exist (trim, code points, NUL). Add:
`optionalPattern(value, path, max, regex, message)`, `integer(value, path, min, max)`,
`optionalInteger`, `finite(value, path, min, max)`, `optionalFinite`, `dateOnly(value, path)`,
`optionalDateOnly`, `dateTime(value, path)`, `optionalDateTime`, `enumValue(value, allowed, path)`,
`optionalEnum`, `enumList(value, allowed, path, max)`, `optionalUuid`. For updates, `undefined` means
unchanged and `null` clears an optional field; a `null` for a required field is `BAD_USER_INPUT`.
An update with no fields is `BAD_USER_INPUT` ("Provide at least one … field to update"), as today.
Every create calls `core.requireBranch(branchId, context)` once per request after validation.

### 9.2 Vehicles

| Field                     | Rule (path = field)                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `licensePlate`            | required, 1–32 code points (existing)                                                                                                                      |
| `notes`                   | ≤ 2000 (existing)                                                                                                                                          |
| `fleetNumber`             | ≤ 16, unique per Branch                                                                                                                                    |
| `vehicleType`, `fuelType` | enum                                                                                                                                                       |
| `make`, `model`           | ≤ 64                                                                                                                                                       |
| `modelYear`               | integer 1950–2100                                                                                                                                          |
| `vin`                     | trimmed, upper-cased, `^[A-HJ-NPR-Z0-9]{17}$`, unique per Branch                                                                                           |
| `fuelTankCapacityL`       | integer 1–2000                                                                                                                                             |
| `status`                  | enum; default ACTIVE; resulting status INACTIVE requires resulting `currentDriverId` null ("Unassign the driver before deactivating" on `currentDriverId`) |
| `groupId`                 | UUID of a group in the Branch                                                                                                                              |
| `currentDriverId`         | UUID of a driver in the Branch with status ≠ INACTIVE                                                                                                      |

Updates validate the merged result (stored row + input). `deactivateFleetVehicle` sets
`status = INACTIVE, currentDriverId = null` in one scoped update. Delete: P2003 → CONFLICT
"Vehicle has devices or history; deactivate it instead." Unique index map:
`Vehicle_tenantId_branchId_fleetNumber_key → fleetNumber`, `Vehicle_tenantId_branchId_vin_key → vin`.

### 9.3 Devices

Existing IMEI and vehicle rules stay. `model` enum; `options` unique, ≤ 13, stored in enum order,
allowed per model: `STARLINK_TRACKER` {CELLULAR_4G, SAFETY_SF, IRF, CAN, DRIVER_ID, ECONNECT,
RS232, EXTERNAL_ANTENNA, VOICE, WIFI, WILIOT}; `STARLINK_SCOUT` {CELLULAR_4G, SAFETY_SF,
TEMPERATURE_DS, GEOZONES_GO, IRF}; `OTHER` any; no model → none (path `options`, validated on the
merged row). `firmwareVersion` `^[0-9A-Za-z._-]{1,32}$`; `simPhoneNumber` `^\+?[0-9]{6,19}$`;
`simIccid` `^[0-9]{18,22}$`; `installedAt` between 2000-01-01 and `FleetClock.now()`; `notes` ≤ 2000.
Unique map: `Device_tenantId_branchId_imei_key → imei`. Devices with telemetry history can still
be deleted (snapshot semantics).

### 9.4 Drivers

`firstName`, `lastName` 1–64; `employeeNumber`, `identificationKey` ≤ 32, unique per Branch;
`phone` `^\+?[0-9 ]{6,20}$`; `email` ≤ 254 and `^[^\s@]+@[^\s@]+\.[^\s@]+$`; `licenseNumber` ≤ 32;
`licenseCategories` unique ≤ 10; dates via `dateOnly` (1900–2100); `tachographCardNumber` ≤ 16;
`status` enum; `notes` ≤ 2000. Setting status INACTIVE while the driver has current vehicles →
path `status` ("Unassign the driver from its vehicles first"). Delete: P2003 → CONFLICT "Driver is
assigned or has trip history; set the driver inactive instead." Unique map:
`Driver_tenantId_branchId_employeeNumber_key → employeeNumber`,
`Driver_tenantId_branchId_identificationKey_key → identificationKey`.

### 9.5 Vehicle groups

`name` 1–64, unique per Branch (exact after trimming); `description` ≤ 500; `colorToken` enum
(default C1). Delete: P2003 → CONFLICT "Vehicle group still contains vehicles; move them first."
Unique map: `VehicleGroup_tenantId_branchId_name_key → name`.

### 9.6 Odometer reading (MANUAL sample)

`vehicleId`: vehicle in the Branch and not INACTIVE (path `vehicleId`). `odometerKm`: finite
0–9,999,999.9, stored rounded to 0.1. `recordedAt`: valid `DateTime`, `≤ min(asOf ?? now, now)`
(`asOf` is the device-only data clock), and strictly after the vehicle's latest non-null odometer
reading of any source; `odometerKm` must be `≥` that reading (paths `recordedAt`, `odometerKm`).
Insert `source = MANUAL`, `deviceImei = null`, `receivedAt = now`, every other measurement null.
Never updates a row. A db spec proves the reading changes neither `asOf` nor activity.

`fleetVehicleSamples`: vehicle must exist (NOT_FOUND); `from < to`, span ≤ 7 days (paths `from`,
`to`); includes MANUAL rows.

### 9.7 Alert transitions

| Mutation    | Allowed `expectedStatus` | New status   | Timestamps                                     |
| ----------- | ------------------------ | ------------ | ---------------------------------------------- |
| acknowledge | OPEN                     | ACKNOWLEDGED | `acknowledgedAt = now`                         |
| resolve     | OPEN, ACKNOWLEDGED       | RESOLVED     | `resolvedAt = now`; `acknowledgedAt` unchanged |
| reopen      | RESOLVED                 | OPEN         | `acknowledgedAt = null`, `resolvedAt = null`   |

Order: scope → `id` UUID → `expectedStatus` enum and allowed for the mutation (else
`BAD_USER_INPUT`, path `expectedStatus`, no database access) → `remark` (omitted unchanged;
null/blank cleared; ≤ 1000 code points, NUL rejected) → conditional
`updateMany({ where: { id, tenantId, branchId, alertStatus: expectedStatus }, data })`. Count 0 →
scoped read: missing row or `alertStatus` null → NOT_FOUND "Alert not found"; otherwise CONFLICT
"The alert changed after it was loaded; reload it." The result is re-read with refs.

### 9.8 Service tasks

Create: `vehicleId` in the Branch and not INACTIVE; `serviceType` enum; at least one of `dueOn`
(2000–2100) and `dueOdometerKm` (integer 0–9,999,999) (path `dueOn`); `title` ≤ 120; `workshop` ≤
128; `notes` ≤ 2000; status PLANNED. Update: same field rules, only while PLANNED (conditional
`updateMany`; count 0 → NOT_FOUND or CONFLICT "Only planned service can be changed"); the merged
row must keep a due date or due odometer.

Complete (interactive transaction): `completedOn` ≤ business date and ≥ 2000-01-01;
`completedOdometerKm` integer 0–9,999,999 and not below the highest `completedOdometerKm` of the
same vehicle's DONE tasks with an earlier `completedOn`; `costCents` integer 0–100,000,000;
`replacedParts` ≤ 1000; `workshop` ≤ 128; `notes` ≤ 2000; `nextDueOn` after `completedOn`;
`nextDueOdometerKm` above `completedOdometerKm` when both are given; `nextTitle` ≤ 120. Conditional
update PLANNED → DONE (count 0 → NOT_FOUND or CONFLICT "Only planned service can be completed");
when a next due value is present, insert a PLANNED task with the same vehicle and service type,
`title = nextTitle ?? title`, `workshop` copied. A failure in either write rolls back both.

Cancel: PLANNED → CANCELLED (conditional). Delete: only PLANNED or CANCELLED (`deleteMany` with
status condition; count 0 → NOT_FOUND or CONFLICT "Completed service is kept as history").

## 10. Demo seed (B4)

### 10.1 Decisions

- Fixed epoch: `DEMO_ANCHOR = 2026-10-18T06:30:00.000Z` (09:30 Europe/Sofia, the Storybook fixed clock). Every run produces identical rows; a re-run inserts nothing. The data clock stays at the anchor; the UI shows "data as of 18.10.2026" and its stale banner once 48 h have passed. Business-date statuses (documents, service urgency) are evaluated against the real date, so they age after the anchor day; this is accepted (the user sifts the demo later; see 14).
- Scope: RentalSofia `01000000-0000-4000-8000-000000000001`, Discordia `10000000-0000-4000-8000-000000000001` only. Sandbox `10000000-0000-4000-8000-000000000002` stays empty in every table.
- Separate from `seedFleet`: `seed-data.ts`, `seed.ts`, `db:seed` and `seeds.db.spec.ts` stay unchanged. The demo CLI first calls the unchanged `seedFleet(client)` (idempotent), then `seedFleetDemo(client, { anchor })`.
- Insert-only: `createMany({ data, skipDuplicates: true })` in chunks of 1,000 rows; master data (groups, drivers, vehicles, devices, service tasks) in one transaction; each activity chunk is its own statement. A re-run never updates, so edited records and acknowledged/resolved alerts survive. Insert order: groups, drivers, vehicles, devices, service tasks, trips, samples, events.
- Natural-key guard: PostgreSQL `ON CONFLICT DO NOTHING` (what `skipDuplicates` emits) also skips rows that collide on a natural unique index, which would silently drop a demo row and break its dependants. Inside the master transaction and before any insert, `seedFleetDemo` therefore runs one scoped `findMany` per natural unique key of the target Tenant/Branch — `VehicleGroup.name`, `Driver.employeeNumber`, `Driver.identificationKey`, `Vehicle.fleetNumber`, `Vehicle.vin`, `Device.imei` — selecting existing rows whose value is one of the demo values and whose `id` is not the demo row's ID. Any hit aborts the seed before it writes (transaction rolled back, nothing updated) with an error naming table, column, value and existing ID for every conflict, e.g. `Demo seed conflict: Vehicle.fleetNumber "Т-01" is used by 2f0c…; rename or delete that record and run again.` The CLI exits non-zero and prints no inserted counts. With the guard, `skipDuplicates` only skips rows whose demo primary key already exists (re-runs), so the printed counts are exact.
- No faker, no real identifiers: curated Bulgarian name, road and place pools; fictional plates, IMEIs, VINs, SIM numbers; e-mails `@example.com`. Nothing is copied from `.references`.
- Root script `npm run db:seed:fleet-demo` → `npm run db:seed:demo --workspace @holita/fleet` → `tsx prisma/demo/cli.ts`. Run after `db:migrate` and `db:seed`. The CLI refuses `NODE_ENV=production` and refuses to run before the anchor (`FleetClock`-free check against `Date.now()`), prints inserted counts per table and "existing rows preserved".

### 10.2 Files (`apps/fleet/prisma/demo/`)

| File           | Content                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `random.ts`    | `fnv1a32(text)`, `mulberry32(seed)`, `rng(key)` = mulberry32(fnv1a32(`holita:fleet-demo:v1:${key}`)); helpers `int(min, max)`, `pick(list)`, `chance(p)`                            |
| `ids.ts`       | `demoId(table, key)`: SHA-1 (`node:crypto`) of `holita:fleet-demo:v1:${table}:${key}`, first 16 bytes, version nibble 5, RFC 4122 variant, lowercase 8-4-4-4-12                     |
| `time.ts`      | `sofiaDate(instant)`, `sofiaInstant(date, minutesOfDay)` (DST-aware via `Intl.DateTimeFormat` offset lookup), `addDays`, `isoWeekday`                                               |
| `catalog.ts`   | Fixed master data and storylines (10.3–10.6) as typed constant arrays                                                                                                               |
| `generate.ts`  | `generateFleetDemo({ anchor }): FleetDemoDataset` — pure, no I/O; arrays typed with the generated `Prisma.<Model>CreateManyInput` types, sorted by ID                               |
| `seed-demo.ts` | `seedFleetDemo(client, { anchor })`: natural-key guard (10.1), then inserts; returns `{ groups, drivers, vehicles, devices, serviceTasks, trips, samples, events }` inserted counts |
| `cli.ts`       | dotenv, guards, `createPrismaClient()`, `seedFleet`, `seedFleetDemo({ anchor: DEMO_ANCHOR })`, disconnect                                                                           |

Every PRNG stream has its own key (`trips:V07:2026-10-12`, `events:<tripId>`, …) so a change in
one stage never shifts another. Activity IDs: samples `demoId('sample', '<vehicleNo>:<imei>:<recordedAt ISO>')`,
trips `demoId('trip', '<vehicleNo>:<sofiaDate>:<ordinal>')`, events `demoId('event', '<tripId or storyline>:<ordinal>')`,
service tasks `demoId('service', '<vehicleNo>:<ordinal>')`.

### 10.3 Master data

Fixed IDs: groups `50000000-0000-4000-8000-0000000010NN` (01–05), drivers
`40000000-0000-4000-8000-0000000010NN` (01–36), vehicles `20000000-0000-4000-8000-0000000010NN`
(01–46, "V01…V46"), devices `30000000-0000-4000-8000-0000000010NN` (01–44).

Plates: `CB 10NN AX` for V<NN> (V03 `CB 1003 AX`, V17 `CB 1017 AX`), so plate order equals vehicle
number order, except the text edges at the end of this section (V38–V42). The Storybook dataset
uses the same plates.

Groups: G01 "Международни" C1 (V01–V12), G02 "Вътрешни" C2 (V13–V26, V42), G03 "Градска доставка"
C3 (V27–V37), G04 "Ремаркета" C4 (V43–V46), G05 "Нова група" C5 (empty). Ungrouped: V38–V41 and the
two legacy vehicles (6).

| Vehicles | Type        | Make/model pool (cycled)                                                            | Fuel                           | Fleet numbers |
| -------- | ----------- | ----------------------------------------------------------------------------------- | ------------------------------ | ------------- |
| V01–V20  | TRACTOR     | Mercedes-Benz Actros 1845, DAF XF 480, Volvo FH 500, Scania R 450, MAN TGX 18.510   | DIESEL, tank 600–1,200 L       | Т-01…Т-20     |
| V21–V26  | RIGID_TRUCK | Mercedes-Benz Atego 1530, DAF LF 290, MAN TGL 12.250, Iveco Eurocargo 120           | DIESEL, tank 200–300 L         | К-01…К-06     |
| V27–V37  | VAN         | Mercedes-Benz Sprinter 316, Ford Transit 350, Iveco Daily 35S16, Renault Master 2.3 | DIESEL (V37 ELECTRIC, no tank) | Б-01…Б-11     |
| V38–V42  | CAR         | Škoda Octavia, Toyota Corolla Hybrid (HYBRID), Dacia Duster (LPG), VW Passat        | as listed, others PETROL       | Л-01…Л-05     |
| V43–V46  | TRAILER     | Schmitz Cargobull S.KO, Krone Profi Liner, Schmitz Cargobull S.CS, Krone Cool Liner | null                           | Р-01…Р-04     |

Model years 2016–2025 by PRNG. VINs: make-specific WMI plus 14 characters from
`[A-HJ-NPR-Z0-9]`, unique; null for V19, V40, V41, V43, V46. Status: IN_WORKSHOP V05, V22, V24, V30;
INACTIVE V20 (retired tractor with a device), V36, V41; all others ACTIVE. No device: V19 (new
purchase), V24 (workshop), V36, V41.

Devices (D01–D44): one primary device for each of the 42 vehicles with a device, plus D43 on V01
(STARLINK_TRACKER, options CELLULAR_4G and CAN, installed `anchor − 2 d`, never reports) and D44 on
V27 (STARLINK_SCOUT, CELLULAR_4G and TEMPERATURE_DS, hourly heartbeats). Primary models: trackers
on tractors, rigid trucks and cars (options CELLULAR_4G, SAFETY_SF, CAN, DRIVER_ID; cars
CELLULAR_4G, SAFETY_SF; V25 and V39 without SAFETY_SF); scouts on vans (CELLULAR_4G, SAFETY_SF;
V35 without SAFETY_SF) and trailers (CELLULAR_4G, GEOZONES_GO, TEMPERATURE_DS). That is 29 trackers
and 15 scouts. Firmware: null on D43, D44 and the V38, V45, V46 primaries; 5.11.0 on the primaries
of V06–V10 and V31–V35; 5.12.3 on the rest. IMEIs: fictional prefix `990601` + 9 digits; the
primaries of V02, V13, V21 and V43 use `0099060100` + 5 digits (leading zeros); none equals the
legacy `001234567890123`. SIM `+35989900NNNN`, ICCID `893599900000000NNNN`, `installedAt`
`anchor − 60…900 d`.

Drivers (D01–D36 with driver IDs above): Cyrillic names from curated pools; D01 and D02 are both
"Георги Иванов" (employee numbers E-0101/E-0102); D03 is "Александра-Мария
Константинова-Христозова"; employee numbers `E-01NN` except D31–D35 (null); identification keys
`iB-…` for D01–D24. Status: D01–D25 and D29–D33 ACTIVE (30), D26–D28 ON_LEAVE, D34–D36 INACTIVE
(trip history before `anchor − 15 d`). Licence categories: tractor drivers C, CE; rigid C; van and
car drivers B (some B, C1). Phones `+359 88 800 00NN`, e-mails `driver.NN@example.com`.

Current drivers (29 vehicles, 28 drivers): V01–V18 → D01–D18; V21 → D19, V23 → D20, V25 → D21,
V26 → D14 (relay driver with two trucks), V27 → D22, V28 → D23, V29 → D24, V30 → D25, V31 → D26,
V33 → D27, V38 → D28. Unassigned: D29–D33 (ACTIVE) and D34–D36.

Document dates relative to the anchor date 2026-10-18: D07 licence `−20 d` (expired and assigned to
V07), D15 tachograph card `−3 d`, D09 licence `+5 d`, D11 card `+12 d`, D18 licence `+21 d`, D25
card `+29 d`; every other date is more than 30 days ahead (licences 1–8 years, cards 100–1,700
days).

Text edges: V33 notes of exactly 2,000 code points (multi-line Cyrillic with 🚚); V32 notes
`100% _test_ C:\депо`; V40 plate `CB 1040 AX · ТЕСТОВ ДЪЛЪГ НОМЕРА` (exactly 32 code points);
V38 and V42 share plate "CB 4410 PK";
V39 plate "СА 7712 КН" (Cyrillic) and V41 plate "CA7712KH" (Latin); address
`бул. „Христо Ботев“ 1, Пловдив (O'Neill Logistics)` on V13's idle location; event details
`<b>Door</b> sensor "open" & alarm` (storyline l).

### 10.4 Live snapshot at the anchor (pinned)

Each vehicle's latest device sample is placed explicitly:

| Activity      | Vehicles                                                                                                                   | Count |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | ----- |
| MOVING        | V02, V03, V04 (АМ „Тракия“), V06, V09 (АМ „Хемус“), V10 (E79 to Кулата), V11, V12 (Sofia ring road), V27, V28, V31 (Sofia) | 11    |
| IDLE          | V13 (idling 47 min), V21, V29, V38, V40                                                                                    | 5     |
| PARKED        | V01, V05, V07, V08, V14–V18, V22, V23, V25, V26, V30, V32–V35, V42 (bases Божурище, Пловдив, Варна)                        | 19    |
| ASSET         | V43, V45 (coordinates exactly 0/0), V46 (null coordinates)                                                                 | 3     |
| NOT_CONNECTED | legacy CA1234AB (never), V37 (last `anchor − 9 d`), V39 (`anchor − 3 d 4 h`), V44 (Krone, power cut)                       | 4     |
| NO_DEVICE     | legacy CA5678AB, V19, V24                                                                                                  | 3     |

INACTIVE: V20 (last sample `anchor − 21 d`, fuel 0.0 % → `STALE`), V36, V41. Fresh low fuel (< 12 %
within 6 h): V10 9 % (moving, latest sample `A − 3 min`), V16 8 % (parked, latest sample
`A − 41 min`), V23 11 % (parked, latest sample `A − 17 min`) — exactly 3. Fuel is null for scouts and cars
(no CAN), so they are `NO_DATA`; V03 fuel turns null after its CAN disconnection. Parked samples have
speed 0; asset samples have speed null.

Resulting pinned values (business date 2026-10-18): operational 45, in workshop 4, inactive 3,
operational without device 3; reporting 38/42; activity 11/5/19/3/4/3; low fuel 3; open critical
alerts 4; documents expired 2 (D07 licence, D15 tachograph card), expiring 4 (D09, D11, D18, D25);
service OVERDUE 6, DUE_SOON 7, UNKNOWN_ODOMETER 1; groups 5 with "Нова група" at 0 vehicles;
ungrouped 6; driver D33 scorecard (30 d) 3 trips, all scored, `lowConfidence: true` (storyline m).

Attention: exactly 15 vehicles, in the 7.6 order (primary priority, then `occurredAt ASC NULLS
LAST`, then plate, then `id`). `fleetAttention(limit: 10)` returns items 1–10 with `total: 15`.

| #   | Vehicle  | Primary reason            | `occurredAt`                                 | All reasons (priority order)                   |
| --- | -------- | ------------------------- | -------------------------------------------- | ---------------------------------------------- |
| 1   | V44      | `CRITICAL_ALERT`          | A − 6 d (storyline c)                        | CRITICAL_ALERT, NOT_CONNECTED, SERVICE_OVERDUE |
| 2   | V07      | `CRITICAL_ALERT`          | 2026-10-17T23:40:00Z, A − 6 h 50 min (d)     | CRITICAL_ALERT, DRIVER_DOCUMENT_EXPIRED        |
| 3   | V11      | `CRITICAL_ALERT`          | A − 5 h (h)                                  | CRITICAL_ALERT, SERVICE_OVERDUE                |
| 4   | V04      | `CRITICAL_ALERT`          | A − 35 min (a)                               | CRITICAL_ALERT                                 |
| 5   | V37      | `NOT_CONNECTED`           | A − 9 d (latest device sample)               | NOT_CONNECTED                                  |
| 6   | V39      | `NOT_CONNECTED`           | A − 3 d 4 h                                  | NOT_CONNECTED                                  |
| 7   | CA1234AB | `NOT_CONNECTED`           | null (never reported)                        | NOT_CONNECTED                                  |
| 8   | V03      | `SERVICE_OVERDUE`         | null (plate `CB 1003 AX`)                    | SERVICE_OVERDUE                                |
| 9   | V08      | `SERVICE_OVERDUE`         | null (plate `CB 1008 AX`)                    | SERVICE_OVERDUE, WARNING_ALERTS                |
| 10  | V17      | `SERVICE_OVERDUE`         | null (plate `CB 1017 AX`)                    | SERVICE_OVERDUE                                |
| 11  | V29      | `SERVICE_OVERDUE`         | null (plate `CB 1029 AX`)                    | SERVICE_OVERDUE                                |
| 12  | V16      | `LOW_FUEL`                | A − 41 min                                   | LOW_FUEL                                       |
| 13  | V23      | `LOW_FUEL`                | A − 17 min                                   | LOW_FUEL                                       |
| 14  | V10      | `LOW_FUEL`                | A − 3 min                                    | LOW_FUEL                                       |
| 15  | V15      | `DRIVER_DOCUMENT_EXPIRED` | null (current driver D15, card expired −3 d) | DRIVER_DOCUMENT_EXPIRED                        |

No other operational vehicle has a reason: WARNING_ALERTS needs three OPEN warnings and only V08
reaches it (rule-based events leave at most one OPEN per vehicle, so V03, V10 and V13 stay at two);
V44 has two OPEN warnings besides its critical alert.

### 10.5 Activity rules

Window: trips and events for the 31 Sofia dates `2026-09-18…2026-10-18` (up to the anchor);
samples for the last 7 Sofia dates, plus explicit storyline samples (V37 on days −10 and −9, V20 on
day −21, V44 until its cut-off). Nothing is later than the anchor. Expected volume is roughly
2,000 trips, 6,000–8,000 events and 15,000 samples; specs derive exact numbers from the generator
output instead of hard-coding them, except the pinned values of 10.4.

| Vehicle type | Trips per Mon–Fri / Sat / Sun | Leg length | Sample cadence moving / parked | Notes                                    |
| ------------ | ----------------------------- | ---------- | ------------------------------ | ---------------------------------------- |
| Tractor      | 2 / 0 / 0                     | 120–380 km | 10 min / 60 min                | start 05:30–07:30 Sofia, 70 km/h average |
| Rigid truck  | 3 / 0 / 0                     | 25–90 km   | 10 min / 60 min                |                                          |
| Van          | 4 / 2 / 0                     | 5–35 km    | 5 min / 60 min                 | start 07:30                              |
| Car          | 2 / 0 / 0                     | 10–60 km   | 5 min / 60 min                 |                                          |
| Trailer      | none                          | —          | — / 60 min (ignition null)     |                                          |

- No trips for INACTIVE vehicles after retirement (V20 stops at `anchor − 21 d`), for workshop vehicles after `anchor − 2 d`, or for NOT_CONNECTED vehicles after their last sample.
- The anchor is Sunday 2026-10-18. The weekday table above generates the historic trips; the live snapshot of 10.4 is placed explicitly on top of it, so vehicles MOVING or IDLE at the anchor (including tractors) have one explicit open trip that started on the anchor day (`endedAt`, end fields and `distanceKm` null; `inProgress` true). Two historic trips have no end received (V31 at `anchor − 12 d`, V14 at `anchor − 20 d`; `inProgress` false).
- Edge trips: zero-distance yard move (V05, `anchor − 3 d`, 4 min, 0.0 km); Sofia→Bucharest across midnight (V02, `anchor − 8 d` 21:10 → 04:40); 1,120 km Sofia→Budapest (V06, `anchor − 15 d`); 118 km/h peak (V09, `anchor − 4 d`, with an intensity-3 SPEEDING event).
- Driver: the vehicle's current driver; 4 % of trips have none (card not inserted); vans without a driver (V32, V34, V35, V37) are unidentified except D34–D36 on V32, V34, V37 before `anchor − 15 d`; cars without a current driver (V39, V40, V42) are unidentified except storyline m.
- Scores: null without SAFETY_SF; otherwise 55–98 (risky drivers D03, D11, D22: 45–78). `fuelUsedL` only with CAN (tractors 28–34, rigid 18–24 L/100 km).
- Odometer: base per vehicle at `anchor − 31 d` (tractors 180,000–900,000 km, others 40,000–250,000 km), advanced by every trip; samples and trip start/end odometers agree. Trailers report no odometer.
- Samples during trips interpolate between route waypoints; trucks 24 V systems (moving 27.6–28.4 V, parked 24.6–25.2 V), vans/cars 12 V (13.8–14.4 / 12.4–12.8 V); backup battery 4.0–4.2 V.

Events per trip (stream `events:<tripId>`):

- IGNITION_ON at start and IGNITION_OFF at end (INFO, not actionable).
- Maneuvers only with SAFETY_SF: count = `floor(distanceKm / 100 × rate + rng())`, rate 0.6 (risky drivers 2.4); V08 adds 5 HARSH_BRAKING per working day; kind weights HARSH_BRAKING 25, HARSH_ACCELERATION 20, SHARP_TURN 15, LANE_CHANGE 12, ROUNDABOUT 8, OVERTAKING 8, SPEED_BUMP 7, OFF_ROAD 5; intensity 1/2/3 at 60/30/10 %; intensity 3 is WARNING and actionable, others INFO.
- SPEEDING with probability 0.06 (trucks, 95–108 km/h vs 90) or 0.08 (vans, 100–125 vs 90); WARNING, intensity by excess, actionable.
- IDLING with probability 0.04 when `idleSeconds > 900`; WARNING, measured idle minutes vs threshold 15.
- Status of rule-based actionable events by age: `occurredAt > anchor − 24 h` → OPEN (at most one OPEN per vehicle; further ones become ACKNOWLEDGED); `anchor − 72 h < occurredAt ≤ anchor − 24 h` → ACKNOWLEDGED (`acknowledgedAt = occurredAt + 5…90 min`); older → RESOLVED (`acknowledgedAt` as above except every tenth via PRNG null, `resolvedAt` 10–600 min later). Rule-based events are never CRITICAL.

### 10.6 Storylines (relative to the anchor A)

| ID  | Vehicle | Events                                                                                                                                                                                                                                                                                                              |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a   | V04     | DIAGNOSTIC_TROUBLE_CODE `SPN 110 FMI 0`, CRITICAL, OPEN, A − 35 min, details "Coolant temperature high (104 °C)"; latest sample coolant 104 °C                                                                                                                                                                      |
| b   | V28     | SPEEDING 128 vs 90 km/h, intensity 3, WARNING, ACKNOWLEDGED 40 min later, remark "Разговор с водача в петък", A − 2 d 3 h                                                                                                                                                                                           |
| c   | V44     | POWER_DISCONNECTED 0.0 vs 9.0 V, CRITICAL, OPEN, A − 6 d; hourly samples with backup battery 4.10 → 3.40 V; LOW_BACKUP_BATTERY 3.45 vs 3.5 V, WARNING, OPEN, A − 5 d 21 h; last sample A − 5 d 20 h; DEVICE_OFFLINE 120 vs 120 min, WARNING, OPEN, A − 5 d 18 h                                                     |
| d   | V07     | FUEL_DROP 22 vs 10 %, CRITICAL, OPEN, parked at Божурище at 02:40 Sofia on 2026-10-18 (2026-10-17T23:40:00Z, A − 6 h 50 min; fuel 64 → 42 %)                                                                                                                                                                        |
| e   | V10     | LOW_FUEL 9 vs 12 %, WARNING, OPEN, A − 25 min, moving on E79                                                                                                                                                                                                                                                        |
| f   | V03     | CAN_DISCONNECTED, WARNING, OPEN, A − 3 h                                                                                                                                                                                                                                                                            |
| g   | V12     | CRASH_DETECTED, CRITICAL, A − 9 d, acknowledged after 6 min, RESOLVED after 3 h with a 1,000-code-point Cyrillic remark                                                                                                                                                                                             |
| h   | V11     | DIAGNOSTIC_TROUBLE_CODE `P0299`, CRITICAL, OPEN, A − 5 h                                                                                                                                                                                                                                                            |
| i   | V13     | IDLING 47 vs 15 min, WARNING, OPEN, A − 32 min                                                                                                                                                                                                                                                                      |
| j   | V08     | three SPEEDING alerts, WARNING, OPEN, within the last 24 h                                                                                                                                                                                                                                                          |
| k   | V15     | IDLING, WARNING, RESOLVED without acknowledgement, A − 4 d                                                                                                                                                                                                                                                          |
| l   | V26     | CAN_DISCONNECTED, WARNING, RESOLVED, details `<b>Door</b> sensor "open" & alarm`                                                                                                                                                                                                                                    |
| m   | V40     | Pool car: the first generated trip of V40 on 2026-10-13, 2026-10-14 and 2026-10-15 has `driverId` D33 (unassigned, ACTIVE); V40 keeps no current driver and its other trips stay unidentified. D33 has exactly these 3 trips, all scored (V40 has SAFETY_SF), so its 30-day and 7-day scorecards are low confidence |

Open CRITICAL = a, c, d, h (4).

### 10.7 Service tasks

History over 18 months: tractors 3 DONE (GENERAL_SERVICE/OIL_CHANGE), rigid 2, vans 2, cars 1,
trailers 1 (BRAKES/TIRES); tachograph calibration on a two-year cycle for tractors and rigid
trucks; 4 CANCELLED; costs in EUR cents (tractors 35,000–180,000, others 12,000–60,000), three DONE
tasks cost 0 (warranty) and four null. The two legacy vehicles get no tasks (CA5678AB must stay
deletable). Every other vehicle without a pinned task gets one generic PLANNED task, and tractors
and rigid trucks also get a PLANNED tachograph calibration. Generic and calibration tasks are due
`≥ A + 31 d`, or (only on vehicles with odometer readings) at `≥ current + 5,000 km`, so they stay
UPCOMING; V19's pinned task is the only km-based plan without readings.

Pinned PLANNED tasks (business date 2026-10-18): OVERDUE by date V03 OIL_CHANGE `A − 9 d`, V08
BRAKES `A − 2 d`, V29 ANNUAL_INSPECTION `A − 15 d`, V44 TIRES `A − 20 d`; OVERDUE by km only V11
(`current − 350`), V17 (`current − 1,200`); DUE_SOON: V05, V22, V24 and V30 (REPAIR or
GENERAL_SERVICE due on the anchor date), V12 (`A + 9 d`), V27 ANNUAL_INSPECTION (`A + 6 d`), V15
(`current + 900` km); UNKNOWN_ODOMETER V19 GENERAL_SERVICE at 15,000 km; further
ANNUAL_INSPECTION for V31 `A + 18 d`,
V32 `A + 22 d`, V33 `A + 25 d`, V35 `A + 29 d` (UPCOMING). "current" is the vehicle's generated
odometer at the anchor.

## 11. Tests

Prerequisites (once): `npm run db:up && npm run db:setup && npm run db:test:setup`; Router for
federation: `npm run router:install && npm run router:check`; Chromium for smoke tests. Do not
accept zero executed tests; never run `test:full`; report actual counts.

### 11.1 Unit (`npm run test:fleet -- <files> --skip-nx-cache`)

| Spec                                | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/validation.spec.ts`            | Pagination bounds, search tokens (5 max, 200 code points, NUL, Unicode whitespace), enum lists (empty, duplicates), dates (Feb 30, leap day), date-times (offset required), ranges (`DateTime` `to = from` rejected and `to = from + 1 ms` accepted; `Date` `to = from` accepted and `to = from − 1 d` rejected; single bounds), finite numbers, `invalidFields`, `uniqueViolation` (adapter error with `constraint.index`, with `constraint.fields`, missing cause, non-P2002, non-Prisma error)                                                                                |
| `src/graphql/scalars.spec.ts`       | Serialize/parse of `Date` and `DateTime`, rejection of non-strings, UTC-midnight conversion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/database/sql.spec.ts`          | `fleetTable` quoting and closed table list; row readers reject wrong shapes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `vehicles.service.spec.ts` (extend) | New field rules, merged-row status/driver rule, duplicate pre-check paths, filter/sort mapping, `sort` path, Core called only on create                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `devices.service.spec.ts` (extend)  | Option-for-model matrix, SIM/ICCID/firmware, merged-row validation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `drivers.service.spec.ts`           | Field rules, document status boundaries (today, today + 30, + 31), INACTIVE-while-assigned                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `vehicle-groups.service.spec.ts`    | Name rules, defaults                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `telemetry/vehicle-state.spec.ts`   | Classification and fuel status at the exact boundaries: 48 h, 5 km/h, 12 %, 6 h, null ignition, null `asOf`                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `telemetry.service.spec.ts`         | Odometer reading bounds and ordering, sample window validation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `trips.service.spec.ts`             | Filters, duration, score-below implies scored, `inProgress` at the boundaries (`startedAt = asOf − 24 h` true, 1 ms earlier false, `endedAt` set false, `asOf` null false)                                                                                                                                                                                                                                                                                                                                                                                                       |
| `events.service.spec.ts`            | Full transition matrix (3 mutations × 3 expected statuses), remark semantics, no database access on invalid transitions, measurement units                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `service-tasks.service.spec.ts`     | Create/update/complete/cancel/delete rules, next-task validation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `overview.service.spec.ts`          | Metric assembly: zero denominators → null, null `asOf`, attention ordering and reason priority                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `test/fleet-demo.unit.spec.ts`      | Determinism (two runs deep-equal), counts (5/36/46/44), unique UUIDs, unique natural keys (fleet number, VIN, IMEI, employee number, identification key, group name), FK closure (event trip vehicle = event vehicle), every row satisfies the 5.2 CHECK rules, IMEI rules, plates (`CB 10NN AX` scheme and the text edges, V40 exactly 32 code points), pinned live snapshot via `classifyVehicleState` including the latest-sample times of V10/V16/V23, storyline rows present (a–m; D33 exactly 3 trips), open trips only for MOVING/IDLE vehicles, nothing after the anchor |

`health.spec.ts` must keep passing (the whole AppModule boots without a database).

### 11.2 Database (`npm run test:fleet:db -- <files>`)

Every spec uses `createTestDatabase()` (random schema). Every list and aggregate spec seeds rows for
(tenant A, branch 1), (tenant A, branch 2) and (tenant B, branch 1 with the same UUID) and asserts
that only A/1 is visible and counted. Fixed clocks override `FleetClock`.

| Spec                                    | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initial-migration.db.spec.ts` (update) | Migration names; columns 1–3 for all eight tables                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `branch-migration.db.spec.ts` (update)  | 5.4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `constraints.db.spec.ts` (new)          | Every 5.2 CHECK rejects a violating row (direct Prisma/pg writes), composite FKs reject foreign-Branch group/driver/trip references and an event whose trip belongs to another vehicle, a real P2002 from each natural unique index yields `uniqueViolation(error).index` equal to the generated name (`Vehicle_tenantId_branchId_fleetNumber_key`, `Vehicle_tenantId_branchId_vin_key`, `Device_tenantId_branchId_imei_key`, `Driver_tenantId_branchId_employeeNumber_key`, `Driver_tenantId_branchId_identificationKey_key`, `VehicleGroup_tenantId_branchId_name_key`) and the service maps it to its field path (S5)                                                                                                            |
| `vehicles.db.spec.ts` (extend)          | New fields round trip, duplicate fleet number/VIN → `BAD_USER_INPUT` paths, group/driver scoping, deactivate, CHECK on INACTIVE with driver, filters/sorts with nulls last, multi-token and Cyrillic case-insensitive search, literal `%_\`, page/total consistency; B2: state/openAlertCount/nextService for a page, `hasOpenAlerts`                                                                                                                                                                                                                                                                                                                                                                                               |
| `devices.db.spec.ts` (extend)           | New fields, option rules, vehicle ref; B2: `lastReportedAt` by pair and `null` after re-assignment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `drivers.db.spec.ts` (new)              | CRUD, uniques, deletion protection (assigned, with trips), documents filter at a fixed business date; B2: 30-day stats and scorecard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `vehicle-groups.db.spec.ts` (new)       | CRUD, unique names, counts, ungrouped count, deletion protection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `telemetry.db.spec.ts` (new)            | `asOf` ignores MANUAL rows; a MANUAL reading changes neither `asOf` nor activity but changes the odometer; reading bounds; sample window and 2,000-row cap; raw SQL works in the random schema (S6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `trips.db.spec.ts` (new)                | Filters, sorts, `totalDistanceKm`, maneuver counts, paging consistency                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `events.db.spec.ts` (new)               | Filters/search, alert counts (with and without `search`; counts equal the `fleetEvents` totals per status for the same search and filter), transitions persisted, stale `expectedStatus` → CONFLICT, two parallel acknowledgements → one success and one CONFLICT, informational event → NOT_FOUND                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `service-tasks.db.spec.ts` (new)        | Urgency for date-only, km-only, both and no-odometer tasks at a fixed business date; raw list total/order/paging for each sort; complete + next atomic (forced failure rolls back); cancel/delete rules; summary windows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `overview.db.spec.ts` (new, B3)         | Every 7.5 formula on hand-built fixtures at a fixed anchor with hand-computed expectations; zero denominators; null `asOf`; Sofia date buckets across UTC midnight; attention reasons and order                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `fleet-demo-seed.db.spec.ts` (new, B4)  | `seedFleet` + `seedFleetDemo` at `DEMO_ANCHOR`: inserted counts equal the generator's; a second run inserts 0 everywhere; an edited vehicle and an alert acknowledged through the service survive the re-run; Sandbox has 0 rows in all eight tables; the pinned values of 10.4 through the real services with `FleetClock` at 2026-10-18T07:00:00Z, including the 15 attention items in the pinned order with their reasons and D33's low-confidence scorecard; natural-key guard: in a fresh schema after `seedFleet`, a Discordia vehicle created with fleet number "Т-01" (V01's value) and another ID makes `seedFleetDemo` reject with the conflict message, insert no demo row in any table and leave that vehicle unchanged |
| `seeds.db.spec.ts`                      | Unchanged; must pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### 11.3 Contracts

```bash
npm run codegen
npm run schema:check
npm run test:schema -- contracts.unit.spec.mts federation-guard.unit.spec.mts
```

### 11.4 Federation (`npm run test:gateway:db -- federation.db.spec.mts`)

- B1: drivers and groups CRUD through Router with the Core creation check; vehicle with group/driver refs plus `branch { name }`; duplicate employee number → `BAD_USER_INPUT` with `fieldErrors [{ path: 'employeeNumber' }]` after Router sanitisation; malformed date `2026-02-30` → `BAD_USER_INPUT` path `licenseExpiresOn`; Sandbox sees nothing; deleting a non-empty group → CONFLICT.
- B2: odometer reading through Router; insert one device sample and one OPEN alert through `fleetDatabaseUrl`; acknowledge with `expectedStatus: OPEN` succeeds, repeating it returns CONFLICT; `fleetEvents(filter: { actionable: true })` and `fleetAlertCounts` agree with and without the same `search`; Sandbox counts are zero.
- B3: `fleetDataClock`, `fleetOverviewKpis`, `fleetActivity`, `fleetAttention` for Discordia (inserted rows) and Sandbox (null `asOf`, zero counts, `value: null` metrics).

### 11.5 Regression of the current admin

```bash
npm run test:admin -- --include="app/features/fleet/**/*.spec.ts" --skip-nx-cache
npm run test:smoke:admin -- angular-vehicles.smoke.spec.mts angular-devices.smoke.spec.mts angular-foundation.smoke.spec.mts
npm run test:karma-client -- --skip-nx-cache
```

## 12. Documentation to update (in the slice that changes the behaviour)

| Document                                                                     | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `README.md`                                                                  | B4: add `npm run db:seed:fleet-demo` after `npm run db:seed` in "Run locally" with one sentence on what it inserts (RentalSofia/Discordia only, insert-only, data clock at 18.10.2026); the seed sentence near the end mentions the separate demo seed. Product/screen wording belongs to the frontend change                                                                                                                                                                        |
| `docs/architecture/decisions/0005-fleet-list-contract-and-derived-values.md` | New in B1 (completed in B4 if the implementation deviates): problem, why the current per-screen list arguments and per-row resolvers cannot serve the new screens, decision (standard list contract, `…Ref` types with service-attached derived values and the `nextService` exception, raw-SQL rules, two clocks, insert-only demo seed with the natural-key guard), consequences; linked wherever 0001–0003 are linked                                                             |
| `docs/discocan/requirements.md`                                              | FND-006 covers every Fleet table; FND-008/FND-009 list the new fields; FND-010 points to FLEET-001; FND-015 adds "deactivate when history blocks deletion"; new rows FLEET-001 list contract, FLEET-002 vehicles, FLEET-003 devices, FLEET-004 drivers, FLEET-005 groups, FLEET-006 telemetry and clocks, FLEET-007 trips, FLEET-008 events/alerts, FLEET-009 service, FLEET-010 overview cards, FLEET-011 demo seed; seed paragraph. FND-013/014/018 belong to the frontend change. |
| `docs/discocan/fleet.md`                                                     | Implementation index for every module; thresholds and units (2.6); two clocks; derived-value table (7); IMEI snapshot semantics; demo-data disclaimer                                                                                                                                                                                                                                                                                                                                |
| `docs/discocan/architecture.md`                                              | Persistence (eight tables, enums, CHECKs, composite FKs, index purposes, EUR cents); GraphQL contracts (common SDL, list contract, refs rule, overview split, scalars, inventory); raw SQL rules                                                                                                                                                                                                                                                                                     |
| `docs/README.md`, `docs/discocan/README.md`                                  | Implemented Fleet module list                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `docs/architecture/overview.md`                                              | Fleet feature modules in the source table and the application responsibility row                                                                                                                                                                                                                                                                                                                                                                                                     |
| `docs/development.md`                                                        | Migrations list, `db:seed:fleet-demo`, `migrate diff` from `apps/fleet`, `Date` scalar mapping                                                                                                                                                                                                                                                                                                                                                                                       |
| `docs/discocan/development.md`                                               | GraphQL usage examples (filtered/sorted list, an overview card, an alert transition); demo data walkthrough                                                                                                                                                                                                                                                                                                                                                                          |
| `docs/testing.md`, `docs/discocan/testing.md`                                | New specs, commands and change-to-check rows                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `docs/discocan/instructions.md`                                              | Fleet backend bullets: standard list contract, refs/derived rule, raw SQL rules, two clocks, insert-only demo seed; replace "Vehicle/Device persistence" with "Fleet persistence"                                                                                                                                                                                                                                                                                                    |
| `.agents/skills/holita-backend-feature/SKILL.md`                             | Point to the list contract and the new focused checks                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `docs/todo/admin-design-system.md`                                           | B4 only: remove the backend items of "Fleet demo scope" once implemented (the DS agent rewrites the phase list and links both specs in F0; the file has one writer at a time, frontend 10.4)                                                                                                                                                                                                                                                                                         |
| `docs/todo/` backlog                                                         | Add the deferred items of section 14                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

`.env.example` does not change (no new variables).

## 13. Implementation order and gates (one backend agent)

Each slice ends only when its gate passes completely; fix failures before moving on. Commit only
when the workflow or the user asks for it.

**Shared-worktree check lock.** The backend agent shares the worktree with the frontend agents
(frontend 11 runs F0–F3 in parallel with B1–B4). Every command that writes generated or build
output, or starts or stops processes, runs only while the agent holds the orchestrator's single
check lock: `db:generate`, `codegen`, `schema:check`, `npm run lint` (its `prelint` regenerates
Prisma clients and GraphQL types), `typecheck`, `build`, every `test:*` script (the Nx test targets
depend on `graphql-generate`/`db-generate`, and the db, router and smoke targets build `dist` and
spawn backends), `build:storybook:admin`, `test:storybook:admin`, `test:visual:admin`, `npm run dev`
and `npm run kill`. Reasons: `apps/fleet/nest-cli.json` has `deleteOutDir: true`, so any build or
`nest start --watch` deletes the `dist` that a running federation or smoke fixture executes
(`node dist/main.js`); `tools/development/kill.mts` stops every workspace process running
`apps/<svc>/dist/main(.js)` or the Router binary, including other agents' fixtures; and
`graphql-generate` rewrites the single `apps/admin/src/generated/graphql/operations.ts`. An agent
takes the lock for a whole gate (or one focused check), and releases it when its processes have
exited. Edits, reads, `git` and `format:check` need no lock.

### B1 Master data and the list contract

Scope: section 1 spikes; `common.graphql`, scalars, `FleetClock`, thresholds, validation and search
helpers; B1 schema, migration and CHECKs; vehicles/devices extension (refs, filters, sorts,
deactivate); drivers and vehicle groups modules (without B2 fields); contracts/codegen updates;
admin type-only fallout; existing db spec updates; B1 docs.

```bash
npm run db:validate
npm run db:generate && npm run codegen && npm run schema:check
npm run test:schema -- contracts.unit.spec.mts federation-guard.unit.spec.mts
npm run test:fleet -- validation.spec.ts scalars.spec.ts vehicles.service.spec.ts devices.service.spec.ts drivers.service.spec.ts vehicle-groups.service.spec.ts health.spec.ts --skip-nx-cache
npm run test:fleet:db -- initial-migration.db.spec.ts branch-migration.db.spec.ts constraints.db.spec.ts vehicles.db.spec.ts devices.db.spec.ts drivers.db.spec.ts vehicle-groups.db.spec.ts seeds.db.spec.ts
npm run test:gateway:db -- federation.db.spec.mts
npm run test:gateway:router
npm run test:admin -- --include="app/features/fleet/**/*.spec.ts" --skip-nx-cache
npm run test:smoke:admin -- angular-vehicles.smoke.spec.mts angular-devices.smoke.spec.mts angular-foundation.smoke.spec.mts
npm run lint && npm run typecheck && npm run build && npm run format:check
```

### B2 Activity

Scope: B2 schema, migration and CHECKs; telemetry, trips, events, service-tasks modules; B2 fields
on vehicles, devices and drivers; `sql.ts`; db spec updates; B2 docs.

```bash
npm run db:validate
npm run db:generate && npm run codegen && npm run schema:check
npm run test:schema -- contracts.unit.spec.mts
npm run test:fleet -- sql.spec.ts vehicle-state.spec.ts telemetry.service.spec.ts trips.service.spec.ts events.service.spec.ts service-tasks.service.spec.ts vehicles.service.spec.ts devices.service.spec.ts drivers.service.spec.ts health.spec.ts --skip-nx-cache
npm run test:fleet:db -- initial-migration.db.spec.ts branch-migration.db.spec.ts constraints.db.spec.ts telemetry.db.spec.ts trips.db.spec.ts events.db.spec.ts service-tasks.db.spec.ts vehicles.db.spec.ts devices.db.spec.ts drivers.db.spec.ts vehicle-groups.db.spec.ts seeds.db.spec.ts
npm run test:gateway:db -- federation.db.spec.mts
npm run test:gateway:router
npm run test:admin -- --include="app/features/fleet/**/*.spec.ts" --skip-nx-cache
npm run test:smoke:admin -- angular-vehicles.smoke.spec.mts angular-devices.smoke.spec.mts
npm run lint && npm run typecheck && npm run build && npm run format:check
```

### B3 Overview

Scope: overview module and SDL; documents/expiring helpers in drivers; trips window aggregates and
daily distance; contracts and federation cases; B3 docs.

```bash
npm run codegen && npm run schema:check
npm run test:schema -- contracts.unit.spec.mts
npm run test:fleet -- overview.service.spec.ts health.spec.ts --skip-nx-cache
npm run test:fleet:db -- overview.db.spec.ts drivers.db.spec.ts trips.db.spec.ts
npm run test:gateway:db -- federation.db.spec.mts
npm run test:gateway:router
npm run lint && npm run typecheck && npm run build && npm run format:check
```

### B4 Demo seed and documentation completion

Scope: `prisma/demo/*`, scripts, demo unit and db specs, remaining docs, backlog entries, removal
of completed backend items from `admin-design-system.md`.

```bash
npm run test:fleet -- fleet-demo.unit.spec.ts --skip-nx-cache
npm run test:fleet:db -- fleet-demo-seed.db.spec.ts seeds.db.spec.ts
npm run lint && npm run typecheck && npm run build && npm run format:check
# Development database (additive, never reset):
npm run db:migrate && npm run db:seed && npm run db:seed:fleet-demo
npm run db:seed:fleet-demo   # second run must report 0 inserted rows everywhere
```

Then, holding the check lock, start `npm run dev`, sign in to RentalSofia/Discordia and spot-check
`fleetOverviewKpis`, `fleetAttention`, `fleetVehicles` and `fleetEvents` through Gateway. Stop only
the process group this agent started (Ctrl+C / SIGINT to that `concurrently` process, which stops
its children with `--kill-others`), confirm with `ps` that none of its PIDs remain, and release the
lock. Never run `npm run kill` while another agent may run a fixture: it stops every workspace
backend and Router process, not only this agent's.

## 14. Risks, accepted trade-offs and deferred backlog

- Business-date drift: the fixed anchor keeps telemetry stable, but due dates and document expiries age from 2026-10-19 on (more OVERDUE/EXPIRED). The pinned values hold only for business date 2026-10-18, which is why specs fix `FleetClock`. Refreshing would need a new dataset version with new IDs; not planned.
- The anchor (06:30 UTC on 2026-10-18) was still in the future when this plan was written; the CLI refuses to run before it, so the data clock never lies ahead of the server clock.
- `fleetServiceTasks` is the one raw-SQL list; its correctness depends on the db specs for total, order and paging.
- `FleetDevice.vehicle` becoming `FleetVehicleRef` and the removed sort-direction enums are breaking API changes (allowed); the admin keeps compiling through the type-only fallout in 8.4.
- Tokenised search is slightly more lenient than the previous single-substring search.
- Cyrillic case-insensitive search relies on the database's UTF-8 locale (the Compose PostgreSQL default); `vehicles.db.spec.ts` asserts it.
- Enum array columns are nullable in the schema with a NOT NULL CHECK (S3); revisit if Prisma changes list nullability.
- Server messages stay English; the admin should map known `fieldErrors` paths to its own Bulgarian/English texts.
- The demo seed refuses to run when a user-created record already uses a demo natural key (10.1); the user renames or deletes that record. The seed never updates it.
- The shared-worktree check lock (13) serialises verification across agents; it trades wall-clock time for reliable results.
- `uniqueViolation` depends on the pg adapter's error shape (S5); a Prisma upgrade must re-run S5 and `constraints.db.spec.ts`.
- Deferred to the backlog (not built): fuel entries, geozones/POIs, a diagnostic-fault lifecycle, eData readings and reporting configuration, driver-assignment history, editable thresholds and Branch time zones (edited through drawers), demo dataset refresh.

## 15. Review notes

- Second review round (2026-10-18): every backend finding was verified against the code and applied (S5/`uniqueViolation`, Date-range bounds, `nextService` exception, `fleetAlertCounts(search)`, `FleetTrip.inProgress`, natural-key guard, pinned attention list of 15 with plates and sample times, storyline m, `router.smoke.spec.mts`, check lock and B4 process cleanup, README/ADR rows, root `package.json` ownership). None was rejected.
- B1 implementation (2026-10-18): S1–S5 re-confirmed (the B1 `migrate diff` output is identical to the spike; P2002 carries `meta.driverAdapterError.cause.constraint.index` with the generated names, proven by `constraints.db.spec.ts`). Helper signatures for B2: filter helpers always use path `filter` and take the field name for the message (`idList(value, field)`, `enumFilter(value, allowed, field)`, `booleanFilter(value, field)`, `integerFilter(value, field, min, max)`, `dateTimeRange(from, to, { from, to })`, `dateOnlyRange(…)`); sort uses `sortField(value, allowed, fallback)` and `sortDirection(value, fallback)`; duplicates use `rethrowUniqueViolation(error, Map<indexName, FieldError>)` after a scoped pre-check; enum value lists come from `Object.values(<Prisma enum>)` in `generated/prisma/enums.js`. `federation-fixture.mts` does not yet return `fleetDatabaseUrl`/`fleetSchema` (only the B2 federation cases need them). 8.4 deviation: besides the import change, `VehicleListQuery.sort`/`DeviceListQuery.sort` are narrowed to the two fields the old screens offer, because the widened generated sort enums broke `fields[sort]` indexing in `vehicles-page.ts`/`devices-page.ts`.
- B2 implementation (2026-10-18): S1–S3 re-confirmed (the B2 `migrate diff` output has six enums, four tables, fifteen indexes and seven composite FKs). Deviation in 5.2 (already corrected above): the original `FleetEvent_alert_check` let informational events carry a remark or alert times, because `"alertStatus" = 'OPEN'` is NULL for a NULL status and PostgreSQL accepts a CHECK that evaluates to unknown; the status branches are now guarded by `"alertStatus" IS NOT NULL` and `constraints.db.spec.ts` proves both cases. Decisions the spec left open: the `fleetServiceTasks` urgency rank has no `ELSE` branch, so tasks that are not PLANNED sort last in both directions (3.4 NULLS LAST); `fleetVehicleSamples` reads the half-open `[from, to)` and reports both the order and the seven-day errors on path `to`; `fleetDriverScorecard(days)` accepts 1–93 (the `fleetManeuverCounts` period limit), `scoredTripCount` counts trips with a driving score (as the `scored` trip filter), the averages are distance-weighted over scored trips of at least 0.5 km and `lowConfidence` is `scoredTripCount < 5`; `fleetServiceSummary` excludes INACTIVE vehicles from the urgency counts only, while completions and cost cover every vehicle; `recordFleetOdometerReading` and `createFleetServiceTask` check the Branch through Core like the other creates; a `NO_DEVICE` vehicle still returns its latest sample values (7.1); the delete result of a vehicle carries empty derived values because a deletable vehicle has no devices or history. Helpers added beyond 3.7/8.2: `numberFilter` (validation), `containsPattern` (search, the raw-SQL twin of `literalContains`), `rowsOf`/`oneOf`/`oneOfOrNull`/`number`/`integerOrNull`/`date`/`boolean` row readers (sql), `DataWindow`/`dataWindow` (clock). Left to B3 because nothing in B2 calls them: `vehicleFacts(scope, 'all')`, `ServiceTasksService.overdueVehicleIds`, the trip window aggregates and daily distance. `federation-fixture.mts` now returns `fleetDatabaseUrl`/`fleetSchema`.
