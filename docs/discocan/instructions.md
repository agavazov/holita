# Discocan contributor instructions

Apply the shared [coding guide](../../AGENTS.md); its delivery policy comes first. The
[domain index](README.md) links the Fleet documents. Open only the section you need, because the
code is the reference for behavior details.

- Keep fleet telemetry documentation under `docs/discocan/`. Vehicles/Devices and their Angular
  workspace belong to this domain, independently of Ecommerce workflows.
- In Discocan a Branch represents a vehicle fleet; Ecommerce uses the same Core Branch model for an
  online shop. Use Branch/branchId/x-branch-id consistently and preserve Tenant/Branch isolation.

## Fleet backend

- Follow the actual [Vehicles resolver/service/repository](../../apps/fleet/src/modules/vehicles/vehicles.resolver.ts)
  and its [SDL](../../apps/fleet/src/modules/vehicles/vehicles.graphql).
  - Resolve Vehicle/Device references through scoped service access.
  - Use @Parent on a federation reference parameter when you combine it with Nest parameter
    decorators.
- Every Fleet read and write includes the verified Tenant and the active Branch.
  - Related Fleet records use composite `(tenantId, branchId, …)` foreign keys.
  - Creation and the settings upsert check the Branch through Core. Ordinary reads, updates and
    deletes don't.
  - Do not move Branch validation into Gateway.
- Every Fleet list follows the [standard list contract](architecture.md#standard-list-contract).
  - Compute derived values used for filtering, sorting, paging or counting in the same scoped raw
    query and snapshot as the rows and totals.
  - Do not add per-row `@ResolveField` queries or DataLoaders.
- Raw SQL rules:
  - use `$queryRaw` with `Prisma.sql` only;
  - reach every table through `fleetTable(schema, …)` with its own Tenant/Branch predicate;
  - cast explicitly and parse rows with the concrete parsers from `apps/fleet/src/database/sql.ts`;
  - pass business clocks as parameters; raw SQL never calls `now()`.
- There are two clocks:
  - telemetry values use the Branch data clock from device samples;
  - business dates use `FleetClock.now()` in the configured Branch time zone;
  - MANUAL odometer readings never move the data clock.
- The concrete [Settings module](../../apps/fleet/src/modules/settings/settings.module.ts) owns the
  unique Tenant/Branch `FleetSettings` row.
  - Reads return defaults without inserting.
  - Derived SQL reads the settings in the same snapshot.
  - Unit preferences never change canonical km, km/h or litre values.
- Activity rows store the reporting IMEI as a snapshot, not as a Device foreign key. Vehicles and
  drivers with history are deactivated instead of deleted.
- Duplicates are BAD_USER_INPUT `fieldErrors`. Deletions blocked by a foreign key are CONFLICT
  with an entity message.
- Branch discovery and naming belong to the shared [Core Branch foundation](../ecommerce/branches.md).
- Device configuration (DeviceOperations) is frozen, and writes are disabled by default.
  - Never automatically replay an ambiguous submission, and never expose arbitrary command
    strings.
  - Preserve captured definition bytes except the interval bytes.
  - Follow the [operation contract](architecture.md#background-device-configuration-reads).
- The [Simple eData vendor catalog](erm-resources/simple-edata-catalog/README.md) is shared
  manufacturer reference data scoped by catalog version, without Tenant/Branch columns.

## Angular admin (apps/admin)

- Follow [holita-admin-development](../../.agents/skills/holita-admin-development/SKILL.md) and the
  [admin design-system skill](../../.agents/skills/holita-admin-design-system/SKILL.md). Framework
  conventions come from [angular-developer](../../.agents/skills/angular-developer/SKILL.md).
  Karma pages keep their legacy classes only through `styles/_legacy-karma.scss`.
- Keep standalone Angular and Component → concrete feature service → Apollo with generated
  TypedDocumentNodes through the actual Gateway. Do not add generic CRUD, facades, repositories,
  duplicate API models or duplicate business screens.
- Each session/Branch/language workspace owns its client, cache and transport scope. Submitted
  writes settle against their captured client.
- Prefer PrimeNG components and theme tokens. Keep global CSS minimal and feature styles local.
- The shell stays independent of business data access.
  - Standalone login selects a Tenant, then a Branch, and opens Overview.
  - The header switches Branches.
  - Add another feature only when explicitly requested.
- Devices require a 15-digit string IMEI that is unique per Tenant/Branch. Vehicle assignment is
  optional and, when set, must belong to the same Tenant/Branch.

## Karma Client

- `apps/karma-client` owns the external Karma account connection and its read-only `karma*`
  queries. It is an independent host process with no database or Fleet implementation imports.
- Data from the configured account is intentionally shared across every authenticated Tenant and
  Branch.
  - Verify the signed session before any upstream access.
  - Never use Branch context to filter.
- Keep Karma credentials and session IDs on the server.
  - Bound every request.
  - Renew a rejected upstream session at most once.
  - Sanitize external failures, and do not expose arbitrary upstream paths.
- The admin's Karma section stays usable without Fleet.
  - Preserve source values, null/zero distinctions and original IDs.
  - Do not invent units, totals or meanings.
