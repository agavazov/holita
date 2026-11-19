# Discocan contributor instructions

Apply the [workspace guide](../AGENTS.md) first: its delivery policy and product boundaries come
first. Discocan is the fleet telemetry product: Vehicles, Devices, telemetry, the Discocan and ERM device
servers and the Fleet admin.

- Applications are `apps/admin`, `apps/gateway`, `apps/fleet`, `apps/device-server` and `apps/erm-server`.
  Core is shared from `osnova/apps/core`. Discocan libraries are `packages/edata-rules` and
  `packages/device-contract`, and product tooling lives in `tools/`.
- Read the [Discocan documentation](docs/README.md) and apply the
  [Discocan instructions](docs/instructions.md). The Vehicles/Devices presentation,
  navigation and workspace lifecycle of the admin belong to this product.

## Product identity

- Packages and infrastructure resources are named `discocan`: `@discocan/*` and `discocan_*`.
- `red.bg` is a temporary domain used to present the service. It is not the product, package,
  namespace or infrastructure name. Preserve it only when it refers to the actual domain or a
  required compatibility reference.
- Preserve legacy identifiers only in explicit migration/rollback guidance and historical local
  artifacts.
- Rename existing resources together with their configuration and documentation. Preserve data,
  credentials and applied migration history. A Compose project rename must not silently switch to
  an empty volume.

## Data and running services

- Device identifiers must survive every change. Never reset or recreate the `discocan_*`
  databases, remove the PostgreSQL volume or rewrite applied migrations.
- The `discocan-erm-server`, `discocan-erm-api` and `discocan-erm-recovery` user units run from
  the legacy `apps/erm-server/live/` and `live-api/` directories at the repository root. Do not
  stop, restart or replace them without the owner.
  [Service management](docs/development.md#development-and-service-management) has the
  deploy rule.
