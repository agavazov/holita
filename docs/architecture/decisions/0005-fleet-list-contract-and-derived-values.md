# Fleet list contract and derived values

## Problem

The Fleet admin needs many list screens (Vehicles, Devices, Drivers, Vehicle groups and the
activity lists) with the same paging, sorting, filtering and search behaviour, and records that
link to each other (a vehicle's group and current driver, a device's vehicle). The original
Vehicles/Devices lists each had their own sort-direction enum, a single-substring search on one
column and no filters. Resolving linked records with per-row field resolvers would issue one
query per row and per link, and values computed from other rows or a clock would be recomputed
in every resolver that returns the type.

## Decision

- **One list contract.** Every Fleet list is one root query
  `fleetThings(offset: Int! = 0, limit: Int! = 20, search: String, ids: [ID!], filter: FleetThingFilter, sort: FleetThingSort): FleetThingPage!`
  with `items`, `total`, `offset`, `limit` and optional whole-set aggregates. `FleetSortDirection`
  is shared. Validation order: verified scope, paging (limit 1–100), search tokens (at most
  200 code points and five whitespace-separated tokens, each a case-insensitive literal
  substring of one search field), `ids`, filter fields (null means no constraint; lists hold
  1–100 unique values), sort. Nullable sort columns sort `NULLS LAST`; `id DESC` is the final
  tie-break. Page and total are read in one `RepeatableRead` transaction. Filters and sort keys
  use only stored columns or stored relations, never derived values; the one exception is the
  service-task urgency, filtered, sorted, paged and counted in a single scoped raw query whose
  totals, order and paging are proven by database specs.
- **Reference types.** A link to another record returns a `…Ref` type with stored identification
  fields only (`FleetVehicleRef`, `FleetDriverRef`, `FleetVehicleGroupRef`). Repositories load
  refs and counts in the same query (`include`/`select`, `_count`); resolvers only delegate,
  resolve federation references and the `branch` stub. A type with derived values is returned
  only by its own module; its services compute derived values for a whole page with batched
  queries and attach them before returning. The per-vehicle `nextService` (a full service task)
  is the single documented exception and is computed in one batched query per page.
- **Errors.** Validation, duplicates and foreign related IDs are `BAD_USER_INPUT` with
  `fieldErrors` (input field names, or the top-level list argument such as `filter` or `sort`).
  Services pre-check unique values in scope and map a concurrent unique violation from the pg
  adapter's index name. Deletion blocked by a foreign key is `CONFLICT` with an entity message
  (a vehicle is deactivated instead of deleted).
- **Clocks.** Business dates (document expiry, service due dates) use `FleetClock.now()` as a
  calendar date in Europe/Sofia; specs override `FleetClock`. Telemetry windows use a separate
  data clock derived from the latest device sample of the Branch. Raw SQL never calls `now()`.
- **Raw SQL** is allowed only where Prisma cannot express a query; it uses tagged templates,
  schema-qualified table references with Tenant/Branch predicates on every table, explicit
  casts and concrete row parsers.
- **Demo data** for this domain is inserted by a separate insert-only seed that never updates
  existing rows and refuses to run when a user record already uses one of its natural keys.

## Consequences

The existing Vehicles/Devices list arguments changed incompatibly: the per-entity sort-direction
enums were removed, `filter` was added and search became tokenised (slightly more lenient).
`FleetDevice.vehicle` became `FleetVehicleRef`. Cyrillic case-insensitive search relies on the
database's UTF-8 locale and is asserted by the database specs. `uniqueViolation` depends on the
`@prisma/adapter-pg` error shape and is proven against the generated index names; a Prisma
upgrade must re-run those specs. See [Discocan architecture](../../discocan/architecture.md)
for the implemented contract.
