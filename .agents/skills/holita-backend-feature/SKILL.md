---
name: holita-backend-feature
description: Implement holita backend GraphQL features using the Fleet modules, the standard list contract, generated contracts and scoped persistence. Use for backend work, not frontend-only changes.
---

# Backend feature reference

Read [AGENTS.md](../../../AGENTS.md) and, for Fleet, the
[Discocan instructions](../../../docs/discocan/instructions.md). For Core Branch changes apply the
[Ecommerce instructions](../../../docs/ecommerce/instructions.md), and check Discocan consumers when
the shared Branch contract changes. Open [architecture](../../../docs/discocan/architecture.md)
or the [Fleet implementation index](../../../docs/discocan/fleet.md) only for the section you need.

## Follow the reference module

Vehicles is the reference implementation:

- [SDL](../../../apps/fleet/src/modules/vehicles/vehicles.graphql)
- [resolver](../../../apps/fleet/src/modules/vehicles/vehicles.resolver.ts)
- [service](../../../apps/fleet/src/modules/vehicles/vehicles.service.ts)
- [repository](../../../apps/fleet/src/modules/vehicles/vehicles.repository.ts)

The SDL owns the API definition, and generated types own resolver signatures. Concrete
repositories require the verified Tenant and Branch scope on every operation. Inputs never own
`tenantId` or `branchId`.

## Invariants

- **Core client.** The [Core client](../../../apps/fleet/src/integrations/core/core.client.ts) checks
  Branch existence on creation and on the Settings upsert. Other reads, updates and deletes do not
  call Core. Never import another application's implementation.
- **Lists.** Every list follows the
  [standard list contract](../../../docs/discocan/architecture.md#standard-list-contract):
  - validate input with [validation.ts](../../../apps/fleet/src/validation.ts);
  - build explicit predicates with the [search helpers](../../../apps/fleet/src/database/search.ts);
  - load `…Ref` links in scoped batches;
  - add no per-row field queries.
- **Raw SQL.** Use `$queryRaw` with `Prisma.sql`, reach every table through `fleetTable(schema, …)`
  with its own Tenant/Branch predicate, and parse rows explicitly with
  [sql.ts](../../../apps/fleet/src/database/sql.ts). Derived facts used by filters or sorting
  stay in the same snapshot as row selection and totals. Raw SQL never calls `now()`.
- **Clocks.** Business dates come from `FleetClock.now()` in the Branch time zone. Telemetry
  values use the Branch data clock.
- **Migrations.** Review new migration SQL (generate it with `prisma migrate diff` from the owning
  app and add hand-written CHECKs). Never edit applied migrations.
- **Errors.** Use standard Nest exceptions. Duplicates are BAD_USER_INPUT `fieldErrors`;
  deletions blocked by a foreign key are CONFLICT.
- **No new layers.** No generic layers, duplicate API models or cross-app imports.

## Checks

After SDL or operation changes, run codegen and schema:check. Choose the remaining checks with
[focused validation](../holita-focused-validation/SKILL.md):

- raw SQL, scoping and constraint changes run the owning `test:fleet:db -- <file>` case;
- do not add tests beyond the [delivery policy](../../../AGENTS.md#delivery-policy).
