# Discocan: fleet telemetry

Discocan is discocan's fleet telemetry domain. Fleet owns Vehicles, Devices, Drivers, Vehicle
groups, samples/data clock, trips, alerts, service tasks, Dashboard, notifications and Branch settings.
The Angular admin uses generated GraphQL operations through Router. ERM Server receives
StarLink traffic and records connections, exact frames, decoded events and commands; its gateway
keeps device sessions while its api process serves Fleet Device inspection and controlled commands.
Configured ERM ingestion projects device reports into Fleet activity; availability and reporting
freshness remain distinct from the age of a recorded GPS position.

The admin opens Dashboard, the single-screen truck map, after email/password sign-in and fleet
selection. Dashboard (old), kept for now, has Overview,
Problems and Trips tabs that combine Branch totals, a paged fleet map, charts and source-aware
problems. Vehicles and Devices have their own detail pages; readable command history and
current-device SMS preparation sit under Devices, and a Vehicle's Commands tab selects an
installed Device. Profile and Tenant-wide Users use Core accounts. The bell opens the persisted
Branch notification feed with per-user read state. See the
[operator workflows](development.md#fleet-operator-workflows).

Device inspection, reads and controlled settings use ERM Server. Protocol and hardware references
are in [ERM resources](erm-resources/README.md); active replacement work is tracked in the
[ERM roadmap](../todo/erm-roadmap.md).

- [Contributor instructions](instructions.md).
- [Implemented requirements](requirements.md).
- [Architecture](architecture.md): persistence, scope and public GraphQL contracts.
- [Development](development.md): setup, configuration, operator workflows and
  [ERM service/routing procedures](development.md#erm-device-server).
- [Fleet implementation index](fleet.md): source entry points, clocks, thresholds and activity rules.
- [ERM resources](erm-resources/README.md): retained StarLink/eData protocols, catalogs,
  Monitor configuration and device hardware/brochures.
- [ERM correspondence and verification](erm-resources/erm-support-diagnostics-protocol-test-server/README.md):
  dated replies, command reference, original images, live evidence and unresolved semantics.
- [Shared workspace documentation](../README.md).

## Terminology

Branch is the shared Core-owned organizational scope: a fleet in Discocan and an online shop
in Ecommerce. Code/APIs use `Branch`, `branchId` and `x-branch-id`; tenant identity comes from
the verified session. Branch context alone is not authorization.

Fleet business tables begin with `id`, `tenantId`, `branchId`; Branch has `id`, `tenantId`.
Raw ERM ingestion remains provider-level without Tenant/Branch columns. Branch-visible ERM
history/state is reached through a scoped Fleet Device and its IMEI, as defined in
[ADR 0007](../architecture/decisions/0007-erm-gateway-and-api-processes.md).
