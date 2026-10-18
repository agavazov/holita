# Fleet implementation index

Sakai owns Angular presentation. Concrete features own contracts, validation and scoped
request lifecycles. Use the existing files directly; there is no generic CRUD layer.

## Fleet backend modules

| Module         | Files                                                                                                                                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared         | [common SDL](../../apps/fleet/src/graphql/common.graphql), [scalars](../../apps/fleet/src/graphql/scalars.ts), [validation](../../apps/fleet/src/validation.ts), [search helpers](../../apps/fleet/src/database/search.ts), [FleetClock](../../apps/fleet/src/clock/fleet-clock.ts), [thresholds](../../apps/fleet/src/fleet-thresholds.ts) |
| Vehicles       | [SDL](../../apps/fleet/src/modules/vehicles/vehicles.graphql), [resolver](../../apps/fleet/src/modules/vehicles/vehicles.resolver.ts), [service](../../apps/fleet/src/modules/vehicles/vehicles.service.ts), [repository](../../apps/fleet/src/modules/vehicles/vehicles.repository.ts)                                                     |
| Devices        | [SDL](../../apps/fleet/src/modules/devices/devices.graphql), [resolver](../../apps/fleet/src/modules/devices/devices.resolver.ts), [service](../../apps/fleet/src/modules/devices/devices.service.ts), [repository](../../apps/fleet/src/modules/devices/devices.repository.ts)                                                             |
| Drivers        | [SDL](../../apps/fleet/src/modules/drivers/drivers.graphql), [resolver](../../apps/fleet/src/modules/drivers/drivers.resolver.ts), [service](../../apps/fleet/src/modules/drivers/drivers.service.ts), [repository](../../apps/fleet/src/modules/drivers/drivers.repository.ts)                                                             |
| Vehicle groups | [SDL](../../apps/fleet/src/modules/vehicle-groups/vehicle-groups.graphql), [resolver](../../apps/fleet/src/modules/vehicle-groups/vehicle-groups.resolver.ts), [service](../../apps/fleet/src/modules/vehicle-groups/vehicle-groups.service.ts), [repository](../../apps/fleet/src/modules/vehicle-groups/vehicle-groups.repository.ts)     |

Every Fleet list (`fleetVehicles`, `fleetDevices`, `fleetDrivers`, `fleetVehicleGroups`) follows
the [standard list contract](architecture.md#standard-list-contract). Links to other records are
stored references (`FleetVehicleRef`, `FleetDriverRef`, `FleetVehicleGroupRef`) loaded in the same
repository query; counts use Prisma `_count`. Resolvers only delegate, resolve federation
references and return the `branch` stub. The decision is recorded in
[ADR 0005](../architecture/decisions/0005-fleet-list-contract-and-derived-values.md).

### Business date and thresholds

`FleetClock.now()` is the only wall-clock source for business rules and write-time bounds.
The business date is that instant as a calendar date in Europe/Sofia (`businessDate`); database
specs override `FleetClock`. Driver document status uses it: a licence or tachograph card date
before the business date is `EXPIRED`, on or before the business date plus 30 days is
`EXPIRING`, otherwise `VALID`; the driver shows the worst of the two, or `NOT_RECORDED` when both
are empty. Device installation time must not be after `FleetClock.now()`.
[fleet-thresholds.ts](../../apps/fleet/src/fleet-thresholds.ts) holds the named demo thresholds
(business time zone, document expiry window and the telemetry/service limits of later Fleet
modules). Units are holita's demo contract: km, km/h, litres, volts, °C, minutes, percent,
0–100 scores and EUR cents; no equivalence with Karma values is claimed.

### Master data rules

- **Vehicle:** License Plate 1–32 code points (not unique); optional Fleet number (≤ 16) and
  VIN (17 characters without I/O/Q, upper-cased) are unique per Branch when set; type, make,
  model, model year 1950–2100, fuel type, tank capacity 1–2000 L; status `ACTIVE`,
  `IN_WORKSHOP` or `INACTIVE` (default `ACTIVE`); optional group and current driver of the same
  Branch (the driver must not be `INACTIVE`). An `INACTIVE` vehicle has no current driver
  (checked on the merged row and by a CHECK). `deactivateFleetVehicle` sets `INACTIVE` and
  clears the driver idempotently; deleting a vehicle with devices fails with CONFLICT
  "Vehicle has devices or history; deactivate it instead."
- **Device:** IMEI exactly 15 digits, unique per Branch; mandatory Vehicle of the Branch;
  optional model `STARLINK_TRACKER`, `STARLINK_SCOUT` or `OTHER` with unique options stored in
  enumeration order and allowed per model (Tracker: 4G, Safety SF, IRF, CAN, Driver ID,
  eConnect, RS232, external antenna, voice, Wi-Fi, Wiliot; Scout: 4G, Safety SF, temperature
  DS, Geozones GO, IRF; Other: any; no model: none), firmware `^[0-9A-Za-z._-]{1,32}$`, SIM phone
  `^\+?[0-9]{6,19}$`, ICCID 18–22 digits, installation time from 2000 up to now, notes.
  `FleetDevice.vehicle` is a `FleetVehicleRef`.
- **Driver:** first and last name 1–64; employee number and identification key ≤ 32, unique
  per Branch; phone `^\+?[0-9 ]{6,20}$`; email; licence number; unique licence categories;
  licence and tachograph card expiry dates (`Date`, 1900–2100); status `ACTIVE`, `ON_LEAVE` or
  `INACTIVE`; notes. `vehicles` lists the vehicles whose current driver it is, by plate. A
  driver with current vehicles cannot become `INACTIVE` or be deleted ("Driver is assigned or
  has trip history; set the driver inactive instead.").
- **Vehicle group:** name 1–64 unique per Branch after trimming; description ≤ 500; colour
  token `C1`–`C8` (a design-system categorical slot, default `C1`). `vehicleCount` counts
  vehicles of any status; the page's `ungroupedVehicleCount` counts the Branch's vehicles
  without a group, independent of search and IDs. A group with vehicles cannot be deleted.

Updates leave omitted fields unchanged and clear optional fields given as `null`; `null` for a
required field or an update without fields is BAD_USER_INPUT. Every create checks the Branch
through Core once per request after validation.

The shared [Simple eData vendor catalog](erm-resources/simple-edata-catalog/README.md)
is implemented by [file validation](../../apps/fleet/src/modules/edata-catalog/catalog-file.ts),
[transactional persistence](../../apps/fleet/src/modules/edata-catalog/catalog.repository.ts)
and a [local CLI](../../apps/fleet/src/modules/edata-catalog/cli.ts). Its offline TypeScript extractor
is [tools/erm-edata/catalog.mts](../../tools/erm-edata/catalog.mts); it has no API or admin integration.

## Angular foundation

[AdminWorkspace](../../apps/admin/src/app/workspace/admin-workspace.ts) owns common session/language
coordination and the shell. Its component-scoped
[BranchContext](../../apps/admin/src/app/features/branches/branch-context.ts) owns authenticated
discovery and Branch selection/routing. [Login](../../apps/admin/src/app/features/auth/login.ts)
provides an independent layout and sequential Tenant/Branch dropdowns. Candidate discovery is retired
on Tenant/language changes; only submitting a valid Branch activates the session and opens Vehicles.
The language root redirects signed-in sessions to their saved Branch, without a Branch list page. Switching Branches preserves
Vehicles/Devices and resets list context. [FleetWorkspace](../../apps/admin/src/app/features/fleet/fleet-workspace.ts)
checks availability/discovery and keys mounted pages/editors by session/Branch/language/resource/mode/ID.
[GraphQL transport](../../apps/admin/src/app/core/graphql/graphql-options.ts) captures immutable
session/Branch/language headers; each feature API owns its own Apollo client and cache. Retired reads unsubscribe;
submitted writes settle and invalidate only their initiating client.

## Vehicles admin

- [API](../../apps/admin/src/app/features/fleet/vehicles/vehicles-api.ts), [page](../../apps/admin/src/app/features/fleet/vehicles/vehicles-page.ts), [query helpers](../../apps/admin/src/app/features/fleet/vehicles/vehicle-list-query.ts), [editor](../../apps/admin/src/app/features/fleet/vehicles/vehicle-editor.ts), [validation](../../apps/admin/src/app/features/fleet/vehicles/vehicle-validation.ts).

The Angular Vehicles screen edits License Plate (required, up to 32 Unicode code points after
trimming) and Notes (nullable, multiline, up to 2000). Lists have URL-backed search, pagination/sorting, stable IDs, page-local
selection and confirmed sequential deletion. Assigned Vehicles are protected by Device foreign
keys. Preserve partial successes, failed-row retry, last-page reconciliation and confirmation
retirement. Typed editors keep failed drafts, focus errors and guard dirty navigation.

## Devices admin

- [API](../../apps/admin/src/app/features/fleet/devices/devices-api.ts), [page](../../apps/admin/src/app/features/fleet/devices/devices-page.ts), [editor](../../apps/admin/src/app/features/fleet/devices/device-editor.ts), [validation](../../apps/admin/src/app/features/fleet/devices/device-validation.ts).
- [Remote picker](../../apps/admin/src/app/features/fleet/relation-picker.ts).

IMEI is exactly 15 digits and unique per Branch, retaining leading zeros. Truck is a mandatory
same-tenant/same-branch Vehicle. Multiple Devices can share a Truck; assignment/reassignment is scoped and
protected in persistence. Search/sort/paging, typed forms, null-free mandatory assignments,
dirty guards and sequential deletion use the captured Devices client. Remote picker reads
search/page/hydrate Vehicles through that client and retire obsolete results.

## Boundaries to preserve

Creation checks Branch existence through the [Fleet Core client](../../apps/fleet/src/integrations/core/core.client.ts)
once per request. Every repository predicate, relation, count and federation lookup includes verified Tenant and Branch scope. No cross-app
implementation imports or shared Prisma models exist. Inputs never own tenantId or branchId. Generated
TypedDocumentNodes/types come from explicit SDL/operation inputs. Backend availability also
gates entity resolution; disabled Angular routes issue no business requests.

See [architecture](architecture.md), [development](development.md) and
[focused checks](testing.md) for current behavior and validation commands.
