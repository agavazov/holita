# Fleet implementation index

Sakai owns Angular presentation. Concrete features own contracts, validation and scoped
request lifecycles. Use the existing files directly; there is no generic CRUD layer.

## Fleet backend modules

| Module         | Files                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared         | [common SDL](../../apps/fleet/src/graphql/common.graphql), [scalars](../../apps/fleet/src/graphql/scalars.ts), [validation](../../apps/fleet/src/validation.ts), [search helpers](../../apps/fleet/src/database/search.ts), [raw SQL helpers](../../apps/fleet/src/database/sql.ts), [FleetClock](../../apps/fleet/src/clock/fleet-clock.ts), [thresholds](../../apps/fleet/src/fleet-thresholds.ts)              |
| Vehicles       | [SDL](../../apps/fleet/src/modules/vehicles/vehicles.graphql), [resolver](../../apps/fleet/src/modules/vehicles/vehicles.resolver.ts), [service](../../apps/fleet/src/modules/vehicles/vehicles.service.ts), [repository](../../apps/fleet/src/modules/vehicles/vehicles.repository.ts)                                                                                                                           |
| Devices        | [SDL](../../apps/fleet/src/modules/devices/devices.graphql), [resolver](../../apps/fleet/src/modules/devices/devices.resolver.ts), [service](../../apps/fleet/src/modules/devices/devices.service.ts), [repository](../../apps/fleet/src/modules/devices/devices.repository.ts)                                                                                                                                   |
| Drivers        | [SDL](../../apps/fleet/src/modules/drivers/drivers.graphql), [resolver](../../apps/fleet/src/modules/drivers/drivers.resolver.ts), [service](../../apps/fleet/src/modules/drivers/drivers.service.ts), [repository](../../apps/fleet/src/modules/drivers/drivers.repository.ts)                                                                                                                                   |
| Vehicle groups | [SDL](../../apps/fleet/src/modules/vehicle-groups/vehicle-groups.graphql), [resolver](../../apps/fleet/src/modules/vehicle-groups/vehicle-groups.resolver.ts), [service](../../apps/fleet/src/modules/vehicle-groups/vehicle-groups.service.ts), [repository](../../apps/fleet/src/modules/vehicle-groups/vehicle-groups.repository.ts)                                                                           |
| Telemetry      | [SDL](../../apps/fleet/src/modules/telemetry/telemetry.graphql), [resolver](../../apps/fleet/src/modules/telemetry/telemetry.resolver.ts), [service](../../apps/fleet/src/modules/telemetry/telemetry.service.ts), [repository](../../apps/fleet/src/modules/telemetry/telemetry.repository.ts), [state classifier](../../apps/fleet/src/modules/telemetry/vehicle-state.ts)                                      |
| Trips          | [SDL](../../apps/fleet/src/modules/trips/trips.graphql), [resolver](../../apps/fleet/src/modules/trips/trips.resolver.ts), [service](../../apps/fleet/src/modules/trips/trips.service.ts), [repository](../../apps/fleet/src/modules/trips/trips.repository.ts)                                                                                                                                                   |
| Events         | [SDL](../../apps/fleet/src/modules/events/events.graphql), [resolver](../../apps/fleet/src/modules/events/events.resolver.ts), [service](../../apps/fleet/src/modules/events/events.service.ts), [repository](../../apps/fleet/src/modules/events/events.repository.ts)                                                                                                                                           |
| Service tasks  | [SDL](../../apps/fleet/src/modules/service-tasks/service-tasks.graphql), [resolver](../../apps/fleet/src/modules/service-tasks/service-tasks.resolver.ts), [service](../../apps/fleet/src/modules/service-tasks/service-tasks.service.ts), [repository](../../apps/fleet/src/modules/service-tasks/service-tasks.repository.ts), [urgency SQL](../../apps/fleet/src/modules/service-tasks/service-urgency.sql.ts) |

Every Fleet list (`fleetVehicles`, `fleetDevices`, `fleetDrivers`, `fleetVehicleGroups`,
`fleetTrips`, `fleetEvents`, `fleetServiceTasks`) follows the
[standard list contract](architecture.md#standard-list-contract). Links to other records are
stored references (`FleetVehicleRef`, `FleetDriverRef`, `FleetVehicleGroupRef`) loaded in the same
repository query; counts use Prisma `_count`. Derived values (vehicle state, open alerts, next
service, last report, 30-day driver statistics, trip maneuvers and in-progress flag) are computed
for the whole page with batched queries in the services and attached before returning; there is
no per-row resolver query. Resolvers only delegate, resolve federation references and return the
`branch` stub. The decision is recorded in
[ADR 0005](../architecture/decisions/0005-fleet-list-contract-and-derived-values.md).

### Two clocks and thresholds

| Clock         | Definition                                                                                                                         | Used for                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Data clock    | `asOf` = latest `recordedAt` of the Branch's device samples (`deviceImei` set); `null` without any. MANUAL readings never move it. | Vehicle activity, fuel freshness, trip `inProgress`, driver 30-day and scorecard windows     |
| Business date | `FleetClock.now()` as a calendar date in Europe/Sofia (`businessDate`)                                                             | Driver document status, service urgency, service summary window, completion date bound       |
| Write time    | `FleetClock.now()`                                                                                                                 | `acknowledgedAt`, `resolvedAt`, MANUAL `receivedAt`, upper bound of installation and reading |

`fleetDataClock` returns `asOf`, the business date and the time zone so the admin can show "data
as of". Raw SQL receives the business date and `asOf` as parameters and never calls `now()`;
database specs override `FleetClock`. Driver document status: a licence or tachograph card date
before the business date is `EXPIRED`, on or before the business date plus 30 days is
`EXPIRING`, otherwise `VALID`; the driver shows the worst of the two, or `NOT_RECORDED` when both
are empty. Device installation time must not be after `FleetClock.now()`.
[fleet-thresholds.ts](../../apps/fleet/src/fleet-thresholds.ts) holds the named demo thresholds
(48 h not connected, 5 km/h moving, 12 % low fuel, 6 h fuel freshness, 14 days / 1,500 km due
soon, 30-day documents and driver statistics, 0.5 km score minimum, 24 h open trips, 5 trips for
confident scorecards). Units are holita's demo contract: km, km/h, litres, volts, °C, minutes,
percent, 0–100 scores and EUR cents; no equivalence with Karma values is claimed.

### Activity rules

Activity rows are holita demo data: status samples, trips and events are written by the demo
seed or directly by tests (no API creates them); operators only add MANUAL odometer readings.
Samples, trips and events store the reporting IMEI as a snapshot instead of a Device foreign key,
so devices can be replaced, reassigned or deleted without rewriting history. A sample's history
belongs to the (vehicle, IMEI) pair at reporting time.

| Value                                                      | Definition                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FleetVehicle.state.activity`                              | No device → `NO_DEVICE`; no device sample, no data clock or latest device sample older than `asOf − 48 h` → `NOT_CONNECTED`; ignition unknown → `ASSET`; ignition on and ≥ 5 km/h → `MOVING`; ignition on → `IDLE`; ignition off → `PARKED`. Applies to every status. |
| `FleetVehicle.state` values                                | Latest device sample (any IMEI of the vehicle), returned even when stale; odometer = latest non-null odometer of any source with its time and source                                                                                                                  |
| `FleetVehicle.state.fuelStatus`                            | `NO_DATA` without a device sample or fuel level; `STALE` when older than `asOf − 6 h`; `LOW` below 12 %; otherwise `NORMAL`                                                                                                                                           |
| `FleetVehicle.openAlertCount`                              | Events of the vehicle with alert status `OPEN`; `hasOpenAlerts` filters on the same rule                                                                                                                                                                              |
| `FleetVehicle.nextService`                                 | The vehicle's PLANNED task with the worst urgency, then earliest due date, fewest remaining km, newest ID (the documented exception to the reference rule)                                                                                                            |
| `FleetDevice.lastReportedAt`                               | Latest sample of the device's current (vehicle, IMEI) pair; `null` after a reassignment until the device reports for the new vehicle                                                                                                                                  |
| `FleetDriver.distance30dKm`, `tripCount30d`                | Σ non-null distance and count of the driver's trips with `startedAt` in `(asOf − 30 d, asOf]`; 0 without a data clock                                                                                                                                                 |
| `FleetDriver.maneuversPer100Km30d`                         | Maneuver events (the first nine event kinds) of the driver in the same window ÷ distance × 100; `null` without distance or data clock                                                                                                                                 |
| `FleetDriverScorecard`                                     | Same window over `days` (1–93); scored trips have a driving score; averages are distance-weighted over scored trips of at least 0.5 km; `lowConfidence` below five scored trips                                                                                       |
| `FleetTrip.durationSeconds`, `inProgress`, `maneuverCount` | Whole seconds to `endedAt`; no end and started within 24 h before `asOf` (`false` without a data clock); maneuver events of the trip                                                                                                                                  |
| `FleetEvent.measurementUnit`                               | `SPEEDING` → KPH; `IDLING`, `DEVICE_OFFLINE` → MINUTE; `LOW_FUEL`, `FUEL_DROP` → PERCENT; `POWER_DISCONNECTED`, `LOW_BACKUP_BATTERY` → VOLT; otherwise `null`                                                                                                         |
| `FleetServiceTask.urgency`, `remainingDays`, `remainingKm` | PLANNED only: due date before the business date or odometer at/over the due km → `OVERDUE`; due within 14 days or 1,500 km → `DUE_SOON`; due km without any odometer → `UNKNOWN_ODOMETER`; otherwise `UPCOMING`                                                       |

- **MANUAL odometer reading:** vehicle of the Branch that is not `INACTIVE`; 0–9,999,999.9 km
  stored rounded to 0.1; `recordedAt` no later than the data clock (or now without one) and now,
  strictly after the vehicle's latest odometer reading of any source and not lower than it.
  It never changes the data clock, activity or reporting; it only becomes the latest odometer.
  `fleetVehicleSamples` returns samples of any source in `[from, to)` (at most seven days),
  ascending, keeping the newest 2,000.
- **Alerts:** events with an alert status are actionable (never `INFO`). `acknowledgeFleetAlert`
  (from `OPEN`), `resolveFleetAlert` (from `OPEN` or `ACKNOWLEDGED`, keeps `acknowledgedAt`) and
  `reopenFleetAlert` (from `RESOLVED`, clears both times) take the status the operator saw; a
  disallowed `expectedStatus` is BAD_USER_INPUT without database access, a changed alert is
  CONFLICT "The alert changed after it was loaded; reload it.", and an informational or foreign
  event is NOT_FOUND "Alert not found". An omitted remark stays, `null` or blank clears it.
  `fleetAlertCounts` counts actionable events for the same search and filter as `fleetEvents`,
  ignoring its actionable and status parts. `fleetManeuverCounts` returns the nine maneuver kinds
  per intensity for trip IDs or a period of at most 93 days.
- **Service tasks:** created PLANNED on a vehicle of the Branch that is not `INACTIVE`, with a
  due date (2000–2100), a due odometer (0–9,999,999) or both; title ≤ 120, workshop ≤ 128, notes
  ≤ 2000. Only PLANNED tasks can be changed, completed or cancelled (CONFLICT otherwise); the
  merged row keeps a due value. Completion requires a date from 2000 up to the business date, an
  odometer not below earlier completed services of the vehicle and an EUR-cent cost 0–100,000,000
  (0 is free, `null` unknown); a next due date or odometer schedules the next PLANNED task of the
  same vehicle and type (title and workshop copied unless given) in the same transaction. PLANNED
  and CANCELLED tasks can be deleted; completed service is kept as history.
  `fleetServiceSummary` counts PLANNED tasks per urgency for vehicles that are not `INACTIVE`,
  vehicles `IN_WORKSHOP`, and DONE tasks with their cost in the 30 days ending with the business
  date.

### Master data rules

- **Vehicle:** License Plate 1–32 code points (not unique); optional Fleet number (≤ 16) and
  VIN (17 characters without I/O/Q, upper-cased) are unique per Branch when set; type, make,
  model, model year 1950–2100, fuel type, tank capacity 1–2000 L; status `ACTIVE`,
  `IN_WORKSHOP` or `INACTIVE` (default `ACTIVE`); optional group and current driver of the same
  Branch (the driver must not be `INACTIVE`). An `INACTIVE` vehicle has no current driver
  (checked on the merged row and by a CHECK). `deactivateFleetVehicle` sets `INACTIVE` and
  clears the driver idempotently; deleting a vehicle with devices, samples, trips, events or
  service tasks fails with CONFLICT "Vehicle has devices or history; deactivate it instead."
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
  driver with current vehicles cannot become `INACTIVE`; a driver with current vehicles, trips
  or events cannot be deleted ("Driver is assigned or has trip history; set the driver inactive
  instead.").
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
