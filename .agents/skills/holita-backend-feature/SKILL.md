---
name: holita-backend-feature
description: Implement holita backend GraphQL features using the Fleet modules, the standard list contract, generated contracts, scoped persistence and focused tests. Use for backend work, not frontend-only changes.
---

# Backend feature reference

Read [AGENTS.md](../../../AGENTS.md), [architecture](../../../docs/architecture/overview.md),
[shared requirements](../../../docs/req/foundation.md) and the Discocan [implementation index](../../../docs/discocan/fleet.md).

For Fleet changes apply [Discocan instructions](../../../docs/discocan/instructions.md) and
read [Discocan requirements](../../../docs/discocan/requirements.md). For Core Branch changes
apply [Ecommerce instructions](../../../docs/ecommerce/instructions.md); check Discocan consumers
when the shared Branch contract changes. Branch represents a vehicle fleet in Discocan
and an online shop in Ecommerce. Keep branchId immediately after tenantId where both exist.

Use actual Fleet [Vehicle SDL](../../../apps/fleet/src/modules/vehicles/vehicles.graphql),
[resolver](../../../apps/fleet/src/modules/vehicles/vehicles.resolver.ts),
[service](../../../apps/fleet/src/modules/vehicles/vehicles.service.ts) and
[repository](../../../apps/fleet/src/modules/vehicles/vehicles.repository.ts).
SDL owns API definitions; generated types own resolver signatures; concrete repositories
require verified Tenant and Branch scope on every operation. Inputs never own tenantId or branchId.
The [Core client](../../../apps/fleet/src/integrations/core/core.client.ts) checks existence during
creation and the Settings upsert, using a generated operation and request-local promise cache.
Ordinary business reads/updates/deletes remain independent of Core except requested federated
Branch fields. Branch rename uses [Core's selected Branch contract](../../../docs/ecommerce/branches.md#graphql-contracts);
never copy its persistence or import another application's implementation.

[Devices](../../../apps/fleet/src/modules/devices/devices.service.ts) adds optional same-tenant/same-branch
Vehicle assignment (unassigned means stock), 15-digit string IMEI and per-Branch uniqueness. Preserve leading zeros,
composite foreign keys, shared assignments and protected Vehicle deletion. Resolve federation
references through scoped service access; use @Parent with Nest parameter decorators.
[Drivers](../../../apps/fleet/src/modules/drivers/drivers.service.ts) and
[Vehicle groups](../../../apps/fleet/src/modules/vehicle-groups/vehicle-groups.service.ts) show
non-entity modules with business-date values and `_count` aggregates.

Every Fleet list follows the [standard list contract](../../../docs/discocan/architecture.md#standard-list-contract):
validate with the helpers in [validation.ts](../../../apps/fleet/src/validation.ts), build
`where`/`orderBy` explicitly with [search helpers](../../../apps/fleet/src/database/search.ts),
load `…Ref` links and counts with the records or in scoped batches and keep resolvers delegating.
Business dates come from an overridable `FleetClock.now()` in the configured Branch time zone;
telemetry values use the Branch data clock from
[Telemetry](../../../apps/fleet/src/modules/telemetry/telemetry.service.ts). Driver expiry,
service urgency/completion-date validation and business-date summaries use that business date.
Vehicles created calendar filters and Overview daily buckets use the configured zone; daily
buckets end on the telemetry data-clock date. Trip/score/statistics windows remain fixed elapsed
days ending at `asOf`, and freshness/in-progress limits remain elapsed hours.
Keep derived list facts used by filters or sorting in the same `RepeatableRead` transaction as
row selection and totals. Vehicles retains state/OPEN counts, Devices status/last report,
Drivers its data clock and 30-day distance/trip count/weighted score, and Trips its records,
driving events, filtered distance and data clock. Reuse captured facts when mapping the page;
do not query newer values after selecting IDs. Display-only values outside those predicates
may use later scoped batches, such as Vehicle `nextService` and Driver maneuver rate.
Single-record, federation-reference and mutation responses use current-value helpers such as
`VehiclesService.completeOne`; this does not promise a transaction across the whole GraphQL
response or separate summaries. Do not introduce per-row field queries.
Raw SQL follows the rules in
[Discocan architecture](../../../docs/discocan/architecture.md#standard-list-contract) with
[sql.ts](../../../apps/fleet/src/database/sql.ts); the
[service urgency fragment](../../../apps/fleet/src/modules/service-tasks/service-urgency.sql.ts)
and [Vehicles list SQL](../../../apps/fleet/src/modules/vehicles/vehicle-list.sql.ts)
are the references for raw, scoped, paged lists. Vehicles activity/odometer filters and
last-report/odometer sorts run before paging/counting, reuse the
[telemetry facts SQL](../../../apps/fleet/src/modules/telemetry/vehicle-facts.sql.ts) and shared
fixed thresholds and scoped settings, and retain independent AND conditions in nonrecursive
`allOf` (at most 50).
Its summary counts the whole Branch rather than the loaded page. Concrete Vehicles batch
delete/deactivate methods validate 1–100 unique IDs and retain per-record successes/failures.

The concrete [Settings module](../../../apps/fleet/src/modules/settings/settings.module.ts)
owns the `FleetSettings` table, unique by Tenant/Branch, and
[Settings SDL](../../../apps/fleet/src/modules/settings/settings.graphql).
`fleetSettings` returns defaults without inserting a row; `updateFleetSettings` validates a
full six-field replacement and verifies the Branch through Core before the scoped upsert.
Defaults are Europe/Sofia, KM, LITRE, low fuel 12%, not reporting 48 hours and speed reference
90 km/h. Supported zones and bounds are in
[Branch settings](../../../docs/discocan/architecture.md#branch-settings); the additive
`20261020220000_fleet_settings` migration enforces the zone/threshold checks.
Pass scoped low-fuel/reporting settings to TypeScript classifiers. Reuse
[`settingsSql`](../../../apps/fleet/src/modules/settings/settings.sql.ts) for one scoped/default
row within derived SQL queries, retaining threshold values with selected facts in the same
`RepeatableRead` snapshot. Do not add process-global caching or per-row settings reads.
Distance/volume preferences leave API/storage measurements and numeric filters in canonical
km, km/h and litres. Speed is a stored reference only; no alert generation, device commands
or notification-provider behavior follows from a settings save.

Keep runtime validation explicit. After SDL/operation changes run codegen/schema:check.
Review new owning-service migration SQL (generate it with `prisma migrate diff` from `apps/fleet`,
add hand-written CHECKs) and preserve applied history. Generated output stays ignored.
Use standard Nest exceptions; do not add generic layers, duplicate API models or cross-app imports.

The insert-only [Fleet demo seed](../../../apps/fleet/prisma/demo/seed-demo.ts) takes a
transaction-scoped advisory lock keyed by seed identity, schema, Tenant and Branch before
reserved-ID, natural-key and anchor checks. Initial master/service-task inserts and the anchor
sample commit together; later missing activity batches run after the lock releases. Keep this
raw-SQL coordination exception limited to the seed's initial transaction.

Start with `test:fleet -- validation.spec.ts` and the module's `*.service.spec.ts` (plus
`sql.spec.ts` and `vehicle-state.spec.ts` for raw SQL or state rules).
Persistence changes use `test:fleet:db -- <module>.db.spec.ts constraints.db.spec.ts` (plus
`initial-migration.db.spec.ts branch-migration.db.spec.ts` for migrations) after the
[database prerequisites](../../../docs/testing.md#real-postgresql-checks). Runtime-boundary changes
use `test:gateway:db -- federation.db.spec.mts`. Contracts also use `test:schema -- contracts.unit.spec.mts`.
Mocks do not prove database/federation isolation. Update authoritative docs with implemented
behavior and report actual test counts. Never run test:full automatically.
