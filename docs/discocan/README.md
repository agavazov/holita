# Discocan: fleet telemetry

Discocan is the fleet telemetry domain. The current implementation is the Fleet API in
`apps/fleet` — master data (Vehicles, Devices, Drivers, Vehicle groups) and activity (status
samples with the data clock, trips, events and alerts, service tasks) on one standard list
contract — and the Vehicles/Devices Angular admin in `apps/admin`. The shared
`apps/karma-client` provides read-only truck lists/details, eData, location, trips, events,
driving profile and account views for projects, time zones, API version, users and roles.
Activity rows are holita demo data; telemetry ingestion from devices, tracking and measurement
processing are not implemented.

- [Contributor instructions](instructions.md).
- [Implemented requirements](requirements.md).
- [Architecture](architecture.md): persistence, federation and Angular request lifecycles.
- [Development](development.md): telemetry admin, demo login and GraphQL usage.
- [Testing](testing.md): Fleet, Karma Client and Angular feature checks.
- [Fleet implementation index](fleet.md): concrete Fleet module source references, list
  contract, the data clock and business date, thresholds, derived values and activity rules.
- [Simple eData catalog](erm-resources/simple-edata-catalog/README.md): offline EXE
  inspection/extraction, version comparison and shared Fleet reference-data import.
- [ERM resources](erm-resources/README.md): Karma API v2 source assets, reconstructed
  OpenAPI, endpoint and field reference, current integration coverage and limitations;
  versioned PDF references for eData, Karma and StarLink with extracted images;
  the StarLink protocol portal and Message structure from supplied screenshots,
  with portal credentials still awaited; a hardware profile for the supplied
  EG915U-LA / LC86G device note, whose exact ERM model remains unidentified.
- [Shared workspace documentation](../README.md).

## Terminology

Branch is the shared Core-owned organizational scope. In Discocan, a Branch represents
a vehicle fleet and scopes Vehicles/Devices and the active admin workspace. In Ecommerce,
the same Branch concept represents an online shop.

GraphQL uses `Branch`, `branches`, `branch` and `branchId`; Fleet requests carry
`x-branch-id`. Tenant identity comes from the verified session. Every Fleet business table
(Vehicle, Device, Driver, VehicleGroup, VehicleStatusSample, Trip, FleetEvent, ServiceTask)
begins with `id`, `tenantId`, `branchId`. Branch
itself has `id` and `tenantId`.
The admin labels this scope Клон / Branch. Karma account data remains shared across
authenticated tenants and does not use Branch scope.
