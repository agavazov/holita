# Fleet list contract and derived values

## Problem

The Fleet admin needs many list screens (Vehicles, Devices, Drivers, Vehicle groups and the
activity lists) with the same paging, sorting, filtering and search behaviour, and records that
link to each other (a vehicle's group and current driver, a device's vehicle). The original
Vehicles/Devices lists each had their own sort-direction enum, a single-substring search on one
column and no filters. Resolving linked records with per-row field resolvers would issue one
query per row and per link, and values computed from other rows or a clock would be recomputed
in every resolver that returns the type. Selecting matching IDs and then loading newer derived
facts can also return rows whose displayed values contradict their filters or sort order when
telemetry, trips or alerts change concurrently.

## Decision

- **One list contract.** Every Fleet list is one root query
  `fleetThings(offset: Int! = 0, limit: Int! = 20, search: String, ids: [ID!], filter: FleetThingFilter, sort: FleetThingSort): FleetThingPage!`
  with `items`, `total`, `offset`, `limit` and optional whole-set aggregates. `FleetSortDirection`
  is shared. Validation order: verified scope, paging (limit 1–100), search tokens (at most
  200 code points and five whitespace-separated tokens, each a case-insensitive literal
  substring of one search field), `ids`, filter fields (null means no constraint; lists hold
  1–100 unique values), sort. Nullable sort columns sort `NULLS LAST`; `id DESC` is the final
  tie-break. Page and total are read in one `RepeatableRead` transaction. Filters and sort keys
  use stored columns or stored relations except service-task urgency, Vehicles activity,
  last report and odometer, Devices connectivity, Drivers 30-day statistics and Trip duration.
  These concrete scoped SQL lists compute their derived values
  before filtering, sorting, paging and counting; database specs prove totals, order and paging.
  Vehicles reuses the telemetry facts query, scoped settings and shared fixed thresholds.
  Fetching a page first and
  sorting/filtering that page in Angular or the service would miss matching records and return
  incorrect totals. Nonrecursive `filter.allOf` preserves up to 50 independent AND conditions.
  The selected rows retain the derived facts used by their filters and sorting from that same
  transaction: Vehicles state and OPEN alert counts, Devices status and last report, and Drivers
  30-day distance, trip count and weighted score with their data clock. Trips retains trip rows,
  driving events and the data clock with its filtered distance total, then derives duration,
  maneuver count and `inProgress` from them. Later reads must not replace captured list facts.
- **Reference types.** A link to another record returns a `…Ref` type with stored identification
  fields only (`FleetVehicleRef`, `FleetDriverRef`, `FleetVehicleGroupRef`). Repositories load
  refs and counts with the records (`include`/`select`, `_count`) or in scoped batches; resolvers delegate,
  resolve federation references and the `branch` stub. A type with derived values is returned
  only by its own module. Display-only values outside the list's filters and sorting may be
  attached through later scoped batches, including Driver maneuver rate and the per-vehicle
  `nextService` (a full service task, the documented cross-module type exception). Single-record,
  federation-reference and mutation responses use the owning module's current-value helpers.
  There is no transaction spanning the entire GraphQL response, separate summaries and those
  later display-only reads. Do not add per-row derived field queries.
- **Errors.** Validation, duplicates and foreign related IDs are `BAD_USER_INPUT` with
  `fieldErrors` (input field names, or the top-level list argument such as `filter` or `sort`).
  Services pre-check unique values in scope and map a concurrent unique violation from the pg
  adapter's index name. Deletion blocked by a foreign key is `CONFLICT` with an entity message
  (a vehicle is deactivated instead of deleted).
- **Branch settings.** A concrete Settings module owns `FleetSettings`, unique by Tenant/Branch,
  and the `fleetSettings`/`updateFleetSettings` contract. The additive
  `20261020220000_fleet_settings` migration preserves existing data. Unsaved Branches read
  defaults without inserting: Europe/Sofia, KM, LITRE, low fuel 12%, not reporting 48 hours
  and a 90 km/h speed reference. Full replacement accepts the four supported zones and bounded
  integers; [Branch settings](../../discocan/architecture.md#branch-settings) defines them.
  The feature's `settingsSql` produces one scoped/default row within the caller's SQL snapshot.
  Low-fuel/reporting predicates, sorts and captured list state use that same row in the
  `RepeatableRead` transaction. Pure classifiers receive scoped values, without process-global
  caching or per-row reads. Settings upsert verifies the Branch through Core before writing;
  Branch rename remains [Core-owned](../../ecommerce/branches.md#graphql-contracts).
  Unit preferences preserve canonical API/storage km, km/h and litres. The speed reference
  does not generate alerts or device commands; notification delivery has no provider.
- **Clocks.** Business dates (document expiry, service urgency and completion-date validation)
  use `FleetClock.now()` as a calendar date in the configured Branch time zone; specs override
  `FleetClock`. Created-date conditions and daily-distance buckets also use that zone.
  Telemetry windows use a separate data clock derived from the latest device sample of the
  Branch; Overview daily buckets end at its calendar date. Trip/score/statistics windows stay
  fixed elapsed days, and freshness/in-progress limits stay elapsed hours. Changing time zone
  does not move either clock. Raw SQL never calls `now()`.
- **Raw SQL** is allowed only where Prisma cannot express a query; it uses tagged templates,
  schema-qualified table references with Tenant/Branch predicates on every table, explicit
  casts and concrete row parsers. Overview and daily-distance aggregates reuse the existing
  vehicle facts and service urgency expressions, read the scoped settings/default row and group
  stored trips by calendar date in the configured Branch time zone.
  Serialized MANUAL odometer writes and driver assignment/deactivation take scoped
  `FOR NO KEY UPDATE` row locks in READ COMMITTED transactions. Validation repeats after the
  lock, so a waiting write sees the preceding commit; external Core calls stay outside locks.
  The insert-only demo seed also uses a transaction-scoped advisory lock for its schema,
  Tenant and Branch during initial preflight and insertion.
- **Vehicle summary and actions.** `fleetVehicleSummary` counts the complete scoped Branch
  independently of list filters and pagination, using the same data clock and facts. Concrete
  delete/deactivate batch mutations accept 1–100 unique IDs and return successes and per-record
  failures; each submitted batch settles against its initiating scope. Single-record mutations
  remain available. There is no generic action dispatcher or atomic all-record rollback.
- **Demo data** for this domain is inserted by a separate insert-only seed that never updates
  existing rows and refuses to run when a user record already uses one of its natural keys.
  Its initial transaction uses an advisory lock keyed by seed identity, schema, Tenant and
  Branch to serialize reserved-ID, natural-key and anchor validation with master/service-task
  and anchor-sample insertion. Commit or rollback releases the lock; subsequent insert-only
  activity batches run outside it. Concurrent runs must use the persisted anchor.

## Consequences

The existing Vehicles/Devices list arguments changed incompatibly: the per-entity sort-direction
enums were removed, `filter` was added and search became tokenised (slightly more lenient).
`FleetDevice.vehicle` became `FleetVehicleRef`. Cyrillic case-insensitive search relies on the
database's UTF-8 locale and is asserted by the database specs. `uniqueViolation` depends on the
`@prisma/adapter-pg` error shape and is proven against the generated index names; a Prisma
upgrade must re-run those specs. See [Discocan architecture](../../discocan/architecture.md)
for the implemented contract.
