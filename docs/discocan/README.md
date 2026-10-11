# Discocan: fleet telemetry

Discocan is the fleet telemetry domain. The current implementation is Fleet Vehicles/Devices
in `apps/fleet` and their Angular admin in `apps/admin`. Telemetry ingestion, tracking and
measurement processing are not implemented.

- [Contributor instructions](instructions.md).
- [Implemented requirements](requirements.md).
- [Architecture](architecture.md): persistence, federation and Angular request lifecycles.
- [Development](development.md): telemetry admin, demo login and GraphQL usage.
- [Testing](testing.md): Fleet and Angular feature checks.
- [Fleet implementation index](fleet.md): concrete Vehicles/Devices source references.
- [Shared workspace documentation](../README.md).

## Terminology

The telemetry domain currently uses Core Stores to scope Vehicles/Devices and select the
active workspace. These Stores represent organizational branches for Discocan.
They will later become **Branches** in this domain. Ecommerce will continue to use **Stores**
for online shops; the two concepts must remain distinct in documentation and instructions.

The Branch rename has not been implemented. Current GraphQL types, `storeId` fields,
`x-store-id` headers, routes, UI catalogs and database identifiers remain Store-based.
Describe current contracts with their actual names. A future rename must preserve tenant
and branch isolation, existing data, relations and applied migration history.
