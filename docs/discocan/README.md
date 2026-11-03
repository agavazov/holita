# Discocan: fleet telemetry

Discocan is holita's fleet telemetry domain. Fleet owns Vehicles, Devices, Drivers, Vehicle
groups, samples/data clock, trips, alerts, service tasks, Overview and Branch settings.
The Angular admin uses generated GraphQL operations through Router. ERM Server receives
StarLink traffic and records connections, exact frames, decoded events and commands; its gateway
keeps device sessions while its api process serves the Control center and Fleet Device fields.
Fleet activity remains demo/manual data until telemetry ingestion is connected.

**Karma is deprecated, view-only.** Its code stays in place for reference until holita recreates
every required function. API/interface sources and historical integration guides are in the
[Karma archive](../archive/karma/README.md), read only when needed. Active replacement work is
tracked once in the [ERM roadmap](../todo/erm-roadmap.md).

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
