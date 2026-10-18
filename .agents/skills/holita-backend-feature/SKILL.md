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
The [Core client](../../../apps/fleet/src/integrations/core/core.client.ts) checks existence only during
creation, using a generated operation and request-local promise cache. Reads/updates/deletes
remain independent of Core except requested federated Branch fields.

[Devices](../../../apps/fleet/src/modules/devices/devices.service.ts) adds required same-tenant/same-branch
Vehicle assignment, 15-digit string IMEI and per-Branch uniqueness. Preserve leading zeros,
composite foreign keys, shared assignments and protected Vehicle deletion. Resolve federation
references through scoped service access; use @Parent with Nest parameter decorators.
[Drivers](../../../apps/fleet/src/modules/drivers/drivers.service.ts) and
[Vehicle groups](../../../apps/fleet/src/modules/vehicle-groups/vehicle-groups.service.ts) show
non-entity modules with business-date values and `_count` aggregates.

Every Fleet list follows the [standard list contract](../../../docs/discocan/architecture.md#standard-list-contract):
validate with the helpers in [validation.ts](../../../apps/fleet/src/validation.ts), build
`where`/`orderBy` explicitly with [search helpers](../../../apps/fleet/src/database/search.ts),
load `…Ref` links and counts in the same repository query and keep resolvers delegating.
Business dates come from an overridable `FleetClock`; telemetry values use the Branch data
clock from [Telemetry](../../../apps/fleet/src/modules/telemetry/telemetry.service.ts).
Derived values are attached by the owning service for the whole page with batched queries
(see `VehiclesService.complete` and `DriversService.withStats`). Raw SQL follows the rules in
[Discocan architecture](../../../docs/discocan/architecture.md#standard-list-contract) with
[sql.ts](../../../apps/fleet/src/database/sql.ts); the
[service urgency fragment](../../../apps/fleet/src/modules/service-tasks/service-urgency.sql.ts)
is the reference for a raw, scoped, paged list.

Keep runtime validation explicit. After SDL/operation changes run codegen/schema:check.
Review new owning-service migration SQL (generate it with `prisma migrate diff` from `apps/fleet`,
add hand-written CHECKs) and preserve applied history. Generated output stays ignored.
Use standard Nest exceptions; do not add generic layers, duplicate API models or cross-app imports.

Start with `test:fleet -- validation.spec.ts` and the module's `*.service.spec.ts` (plus
`sql.spec.ts` and `vehicle-state.spec.ts` for raw SQL or state rules).
Persistence changes use `test:fleet:db -- <module>.db.spec.ts constraints.db.spec.ts` (plus
`initial-migration.db.spec.ts branch-migration.db.spec.ts` for migrations) after the
[database prerequisites](../../../docs/testing.md#real-postgresql-checks). Runtime-boundary changes
use `test:gateway:db -- federation.db.spec.mts`. Contracts also use `test:schema -- contracts.unit.spec.mts`.
Mocks do not prove database/federation isolation. Update authoritative docs with implemented
behavior and report actual test counts. Never run test:full automatically.
