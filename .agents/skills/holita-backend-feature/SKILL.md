---
name: holita-backend-feature
description: Implement holita backend GraphQL features using Vehicles/Devices, generated contracts, scoped persistence and focused tests. Use for backend work, not frontend-only changes.
---

# Backend feature reference

Read [AGENTS.md](../../../AGENTS.md), [architecture](../../../docs/architecture/overview.md),
[requirements](../../../docs/req/foundation.md) and the [implementation index](../../../docs/fleet.md).

Use actual Fleet [Vehicle SDL](../../../apps/fleet/src/vehicles/vehicles.graphql),
[resolver](../../../apps/fleet/src/vehicles/vehicles.resolver.ts),
[service](../../../apps/fleet/src/vehicles/vehicles.service.ts) and
[repository](../../../apps/fleet/src/vehicles/vehicles.repository.ts).
SDL owns API definitions; generated types own resolver signatures; concrete repositories
require verified Tenant and Store scope on every operation. Inputs never own tenantId or storeId.
The [Core client](../../../apps/fleet/src/core/core.client.ts) checks existence only during
creation, using a generated operation and request-local promise cache. Reads/updates/deletes
remain independent of Core except requested federated Store fields.

[Devices](../../../apps/fleet/src/devices/devices.service.ts) adds required same-tenant/same-store
Vehicle assignment, 15-digit string IMEI and per-Store uniqueness. Preserve leading zeros,
composite foreign keys, shared assignments and protected Vehicle deletion. Resolve federation
references through scoped service access; use @Parent with Nest parameter decorators.

Keep runtime validation explicit. After SDL/operation changes run codegen/schema:check.
Review new owning-service migration SQL and preserve applied history. Generated output stays ignored.
Use standard Nest exceptions; do not add generic layers, duplicate API models or cross-app imports.

Start with `test:fleet -- vehicles.service.spec.ts` or `devices.service.spec.ts`.
Persistence changes use `test:fleet:db -- vehicles.db.spec.ts devices.db.spec.ts` after the
[database prerequisites](../../../docs/testing.md#real-postgresql-checks). Runtime-boundary changes
use `test:gateway:db -- federation.db.spec.mts`. Contracts also use `test:schema -- contracts.unit.spec.mts`.
Mocks do not prove database/federation isolation. Update authoritative docs with implemented
behavior and report actual test counts. Never run test:full automatically.
