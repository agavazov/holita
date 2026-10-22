# Fleet implementation index

The [admin design system](../admin-design-system.md) owns Angular presentation. Concrete features own contracts, validation and scoped
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
| Settings       | [SDL](../../apps/fleet/src/modules/settings/settings.graphql), [resolver](../../apps/fleet/src/modules/settings/settings.resolver.ts), [service](../../apps/fleet/src/modules/settings/settings.service.ts), [repository](../../apps/fleet/src/modules/settings/settings.repository.ts), [settings SQL](../../apps/fleet/src/modules/settings/settings.sql.ts)                                                    |

Every Fleet list (`fleetVehicles`, `fleetDevices`, `fleetDrivers`, `fleetVehicleGroups`,
`fleetTrips`, `fleetEvents`, `fleetServiceTasks`) follows the
[standard list contract](architecture.md#standard-list-contract). Links to other records are
stored references (`FleetVehicleRef`, `FleetDriverRef`, `FleetVehicleGroupRef`) loaded in the same
repository query; counts use Prisma `_count`. Derived values (vehicle state, open alerts, next
service, last report, 30-day driver statistics, trip maneuvers and in-progress flag) are computed
for the whole page with batched queries in the services and attached before returning; there is
no per-row resolver query. Resolvers only delegate, resolve federation references and return the
`branch` stub. Driver statistics for requested IDs restrict the Trip aggregate to those IDs;
list and summary paths retain their full-Branch facts. The decision is recorded in
[ADR 0005](../architecture/decisions/0005-fleet-list-contract-and-derived-values.md).

The [Vehicles list SQL](../../apps/fleet/src/modules/vehicles/vehicle-list.sql.ts) computes
activity/last-report/odometer filters and order before pagination and counting, using the shared
[telemetry facts SQL](../../apps/fleet/src/modules/telemetry/vehicle-facts.sql.ts). Its
nonrecursive `allOf` conditions preserve independent AND semantics, including repeated fields,
literal make text and created dates in the configured Branch time zone. `fleetVehicleSummary` uses the same facts and
data clock for exact whole-Branch counts independent of the current list page or filters.
Concrete `deleteFleetVehicles`/`deactivateFleetVehicles` mutations accept 1–100 unique IDs and
return per-record successes/failures; foreign records remain NOT_FOUND and blocked deletion
remains CONFLICT. Submitted batches settle in their initiating scope.

### Two clocks and thresholds

| Clock         | Definition                                                                                                                         | Used for                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Data clock    | `asOf` = latest `recordedAt` of the Branch's device samples (`deviceImei` set); `null` without any. MANUAL readings never move it. | Vehicle activity, fuel freshness, trip `inProgress`, driver 30-day and scorecard windows     |
| Business date | `FleetClock.now()` as a calendar date in the configured Branch time zone (`businessDate`)                                          | Driver document status, service urgency, service summary window, completion date bound       |
| Write time    | `FleetClock.now()`                                                                                                                 | `acknowledgedAt`, `resolvedAt`, MANUAL `receivedAt`, upper bound of installation and reading |

`fleetDataClock` returns `asOf`, the business date and the time zone so the admin can show "data
as of". Raw SQL receives the business date and `asOf` as parameters, or derives the Vehicles
data clock from a scoped device-sample aggregate in the same statement, and never calls `now()`;
database specs override `FleetClock`. Driver document status: a licence or tachograph card date
before the business date is `EXPIRED`, on or before the business date plus 30 days is
`EXPIRING`, otherwise `VALID`; the driver shows the worst of the two, or `NOT_RECORDED` when both
are empty. Device installation time must not be after `FleetClock.now()`.
[fleet-thresholds.ts](../../apps/fleet/src/fleet-thresholds.ts) holds the fixed demo rules:
5 km/h moving, 6 h fuel freshness, 14 days / 1,500 km due soon, 30-day documents and driver
statistics, 0.5 km score minimum, 24 h open trips and 5 trips for confident scorecards.
Branch settings configure the calendar time zone (default Europe/Sofia), not-reporting cutoff
(default 48 hours) and low-fuel boundary (default 12%). The defaults, accepted values and scoped
persistence are defined in [Branch settings](architecture.md#branch-settings).
API measurements remain canonical km, km/h, litres, volts, °C, minutes, percent, 0–100 scores
and EUR cents; the admin applies saved distance/volume display preferences without changing
stored values or explicitly labelled editor/filter units. No equivalence with Karma values is claimed.

### Activity rules

Activity rows are holita demo data: status samples, trips and events are written by the demo
seed or directly by tests (no API creates them); operators only add MANUAL odometer readings.
Samples, trips and events store the reporting IMEI as a snapshot instead of a Device foreign key,
so devices can be replaced, reassigned or deleted without rewriting history. A sample's history
belongs to the (vehicle, IMEI) pair at reporting time.

| Value                                                      | Definition                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FleetVehicle.state.activity`                              | No device → `NO_DEVICE`; no device sample, no data clock or latest device sample older than `asOf − notReportingHours` (default 48 h) → `NOT_CONNECTED`; ignition unknown → `ASSET`; ignition on and ≥ 5 km/h → `MOVING`; ignition on → `IDLE`; ignition off → `PARKED`. Applies to every status. |
| `FleetVehicle.state` values                                | Latest device sample (any IMEI of the vehicle), returned even when stale; odometer = latest non-null odometer of any source with its time and source                                                                                                                                              |
| `FleetVehicle.state.fuelStatus`                            | `NO_DATA` without a device sample or fuel level; `STALE` when older than `asOf − 6 h`; `LOW` strictly below the configured `lowFuelPct` (default 12%); otherwise `NORMAL`                                                                                                                         |
| `FleetVehicle.openAlertCount`                              | Events of the vehicle with alert status `OPEN`; `hasOpenAlerts` filters on the same rule                                                                                                                                                                                                          |
| `FleetVehicle.nextService`                                 | The vehicle's PLANNED task with the worst urgency, then earliest due date, fewest remaining km, newest ID (the documented exception to the reference rule)                                                                                                                                        |
| `FleetDevice.lastReportedAt`                               | Latest sample of the device's current (vehicle, IMEI) pair; `null` after a reassignment until the device reports for the new vehicle                                                                                                                                                              |
| `FleetDriver.distance30dKm`, `tripCount30d`                | Σ non-null distance and count of the driver's trips with `startedAt` in `(asOf − 30 d, asOf]`; 0 without a data clock                                                                                                                                                                             |
| `FleetDriver.maneuversPer100Km30d`                         | Maneuver events (the first nine event kinds) of the driver in the same window ÷ distance × 100; `null` without distance or data clock                                                                                                                                                             |
| `FleetDriverScorecard`                                     | Same window over `days` (1–93); scored trips have a driving score; averages are distance-weighted over scored trips of at least 0.5 km; `lowConfidence` below five scored trips                                                                                                                   |
| `FleetTrip.durationSeconds`, `inProgress`, `maneuverCount` | Whole seconds to `endedAt`; no end and started within 24 h before `asOf` (`false` without a data clock); maneuver events of the trip                                                                                                                                                              |
| `FleetEvent.measurementUnit`                               | `SPEEDING` → KPH; `IDLING`, `DEVICE_OFFLINE` → MINUTE; `LOW_FUEL`, `FUEL_DROP` → PERCENT; `POWER_DISCONNECTED`, `LOW_BACKUP_BATTERY` → VOLT; otherwise `null`                                                                                                                                     |
| `FleetServiceTask.urgency`, `remainingDays`, `remainingKm` | PLANNED only: due date before the business date or odometer at/over the due km → `OVERDUE`; due within 14 days or 1,500 km → `DUE_SOON`; due km without any odometer → `UNKNOWN_ODOMETER`; otherwise `UPCOMING`                                                                                   |

- **MANUAL odometer reading:** vehicle of the Branch that is not `INACTIVE`; 0–9,999,999.9 km
  stored rounded to 0.1; `recordedAt` no later than the data clock (or now without one) and now,
  strictly after the vehicle's latest odometer reading of any source and not lower than it.
  It never changes the data clock, activity or reporting; it only becomes the latest odometer.
  The service repeats latest-reading validation under a scoped Vehicle row lock in an explicit
  READ COMMITTED transaction and stores
  concurrent readings in sequence. A waiting or duplicate reading receives the usual
  `recordedAt` or `odometerKm` field error. Vehicle deactivation cannot land between the
  final active-status check and insertion. Core checks finish before taking the lock.
  `fleetVehicleSamples` returns samples of any source in `[from, to)` (at most seven days),
  ascending, keeping the newest 2,000.

Driver deactivation and Vehicle assignments share a scoped Driver row lock in READ COMMITTED
transactions. Deactivation repeats its assigned-vehicle check after locking; assignment repeats
the driver's active-status check. A concurrent assignment and deactivation cannot leave an
INACTIVE driver assigned to a Vehicle.

Vehicle updates lock the scoped Vehicle row before a Driver row and recheck the resulting
status/assignment after waiting. Explicit reactivation with assignment remains permitted.
New service planning takes the same Vehicle lock and repeats the active-status check before
insertion. An earlier committed task may remain when its Vehicle is subsequently deactivated;
planning after deactivation is rejected. Completion with a next task uses that lock and rolls
back both writes when the Vehicle becomes inactive.

### Additional list conditions and aggregates

Devices, Drivers, Trips, Events and Service tasks retain independent nonrecursive `allOf`
conditions (at most 50), including repeated fields and exclusions. Derived list filters and
sorts run before pagination and counting; optional values remain distinct from zero.

Unassigned Devices have `IN_STOCK` status and no current report. An assigned Device is ONLINE
when its latest current (vehicle, IMEI) report is no more than the configured
`notReportingHours` (default 48 hours) behind the Branch data clock;
otherwise it is OFFLINE. Reassigning or unassigning it does not rewrite stored history.
`fleetDeviceSummary` counts the whole Branch independently of list filters. No firmware target,
signal quality, hardware command transport or Restart implementation is inferred from samples.

Drivers expose a 30-day distance-weighted driving score over scored trips of at least 0.5 km,
using the same definition as the scorecard. `fleetDriverSummary.averageDrivingScore` is the
arithmetic mean of the non-null per-driver scores, including all statuses; it is not a maneuver
rate or the arithmetic mean of individual trips. Distance and trip counts use `(asOf − 30 d, asOf]`.

`fleetTripSummary` covers the whole Branch: trip count, distance, sum of per-trip whole-second
durations, arithmetic mean of scored trips and maneuver events attached to those trips.
Informational and standalone events do not enter that maneuver total. Each Trip exposes its
complete chronological `drivingEvents` timeline, queried in one scoped batch for the page.
An open trip is in progress only when it starts within `[asOf − 24 h, asOf]`.

Alerts can sort by workflow status (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`); informational events
sort last. Search includes details, remarks and event-kind names as well as stored references.
Alert counts ignore actionable and included/excluded status predicates at every condition level,
while preserving the remaining search and filters. Batch acknowledgement, Driver delete/deactivate,
Device deletion and Service-task cancel/delete validate 1–100 unique IDs and return independent
successes and failures. Existing protection and optimistic-concurrency rules still apply.

Service-task conditions include literal task text (with translated fallback service types),
closed due-date ranges, strict before/after dates, cost comparisons in exact EUR cents and
explicit missing-date/cost tests. Sorting includes task, Vehicle plate and cost, with nulls last.

### Overview and daily distance

`fleetOverview` returns exact Branch KPIs, non-INACTIVE Vehicle activity by group (including
empty groups and an ungrouped bucket), and 14 days of trip distance. It reuses telemetry facts
and service urgency in one RepeatableRead snapshot. Active Vehicle count means `ACTIVE`;
moving and not-reporting counts follow activity, and overdue service excludes INACTIVE Vehicles.

`fleetDailyDistance(vehicleId, days)` returns 1–93 calendar days in the configured Branch time zone ending on the
data-clock date. Each day sums stored Trip distance for starts no later than the data clock;
zero days remain in the series and future starts are excluded. Without a data clock, the
series is empty. An optional Vehicle ID is verified in the same Tenant/Branch. These aggregates
do not use the seven-day sample endpoint or its 2,000-row cap.

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
  odometer not below services completed on strictly earlier dates for the vehicle and an EUR-cent cost 0–100,000,000
  (0 is free, `null` unknown); a next due date or odometer schedules the next PLANNED task of the
  same vehicle and type (title and workshop copied unless given) in the same transaction. PLANNED
  and CANCELLED tasks can be deleted; completed service is kept as history.
  Historical completion remains available for an `INACTIVE` Vehicle, without a next task.
  Every completion locks the scoped Vehicle row and repeats its strictly earlier-date odometer check in the READ COMMITTED transaction; scheduling additionally rejects `nextDueOn`/`nextDueOdometerKm` if the Vehicle is inactive. Same-day and later-dated
  completion odometers and telemetry do not participate in the earlier-date comparison.
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
is [tools/erm-edata/catalog.mts](../../tools/erm-edata/catalog.mts). DeviceOperations reads
eligible Monitor presets for additions; catalog import/editing remains local CLI only.

## Angular foundation

[AdminWorkspace](../../apps/admin/src/app/workspace/admin-workspace.ts) owns common session/language
coordination and the shell. Its component-scoped
[BranchContext](../../apps/admin/src/app/features/branches/branch-context.ts) owns authenticated
discovery and Branch selection/routing. [Login](../../apps/admin/src/app/features/auth/login.ts)
provides an independent layout and sequential Tenant/Branch dropdowns. Candidate discovery is retired
on Tenant/language changes; only submitting a valid Branch activates the session and opens Overview.
The language root redirects signed-in sessions to their saved Branch, without a Branch list page. Switching Branches preserves
the current Fleet section and resets list context. [FleetWorkspace](../../apps/admin/src/app/features/fleet/fleet-workspace.ts)
checks availability/discovery and keys mounted pages/editors by session/Branch/language/resource/mode/ID.
[GraphQL transport](../../apps/admin/src/app/core/graphql/graphql-options.ts) captures immutable
session/Branch/language headers; each feature API owns its own Apollo client and cache. Retired reads unsubscribe;
submitted writes settle and invalidate only their initiating client.

## Vehicles admin

- [API](../../apps/admin/src/app/features/fleet/vehicles/vehicles-api.ts), [page](../../apps/admin/src/app/features/fleet/vehicles/vehicles-page.ts), [URL/filter mapping](../../apps/admin/src/app/features/fleet/vehicles/vehicle-query.ts), [editor host](../../apps/admin/src/app/features/fleet/vehicles/vehicle-editor-page.ts), [contract/form mapping](../../apps/admin/src/app/features/fleet/vehicles/vehicle-mapping.ts), [shared view](../../apps/admin/src/app/features/fleet/vehicles/vehicles-view.ts), [shared drawer](../../apps/admin/src/app/features/fleet/vehicles/vehicle-drawer.ts).

The live screen uses the same presentation components as Storybook, with BG/EN catalogs. It edits
License Plate (required, up to 32 Unicode code points after trimming), fleet number, VIN, type,
make/model/year, fuel type/tank capacity, status, group, current driver and multiline Notes
(up to 2000 code points). Optional empty values clear to null. Group and driver choices load in
bounded pages through the editor's captured API client.

`UrlListState` preserves the debounced search, AND filter conditions, sort and page in the URL.
Created-date filters use calendar dates in the configured Branch time zone. The whole-Branch summary is independent of
list filters and pagination; state activity, fuel freshness and nullable data time come from the
backend. Opening a create/edit child-route drawer retains the list and its URL context.
Selecting a vehicle plate opens its read-only profile overview first. The profile's Edit
button and the list's Edit row action open the shared Vehicle editor.

Row and selection delete/deactivate actions submit one IDs-array mutation. Protected deletions
return per-record failures; only successful IDs are removed from the selection, and failed rows
remain available for retry. Concrete batch writes run sequentially without hydrating unused
single-record responses, aggregate statistics or settings; single-record mutations retain their
complete response. Success and partial/error results use the workspace's shared toast;
load and form errors remain inline. A submitted batch settles against its captured scope after
retirement without navigating or publishing into another workspace. Typed drawers retain failed
drafts, focus invalid fields and guard dirty navigation.

[Vehicle profile](../../apps/admin/src/app/features/fleet/vehicles/vehicle-profile-page.ts)
opens at `vehicles/:recordId/:tab`, where tab is `overview`, `trips`, `alerts` or `service`.
It reads the exact open-alert count, next service and fourteen-day distance series from the
server. Related tables have independent URL paging, totals and retry. Edit reuses the Vehicle
editor; manual odometer opens a captured-write drawer over the current tab. Related Trips, Alerts
and service records also open over the retained profile and return to its current tab with query
context. Planned services open for editing; completed and cancelled records are read-only. A related
record must belong to the profile's Vehicle. Back removes profile pagination while retaining list
context.

Manual odometer entry uses the configured Branch time zone and distance unit, submitting canonical
kilometres. Its native date/time field retains floating wall-clock text so the browser's own DST
cannot change another zone's intended time. Skipped Branch times are rejected; repeated times use
an occurrence inside the permitted reading interval. An unchanged displayed reading preserves its
exact stored value, including after conversion to miles. INACTIVE vehicles and empty valid time
intervals display an unavailable reason and cannot submit.

Drawer saves disable Cancel/Close and block in-app navigation until the write settles. Form and
submit controls remain locked. A forcibly destroyed editor retains its captured client, and late
results cannot notify or navigate the next workspace. Unsubmitted dirty drafts still require
discard confirmation; leaving during a conflict read also guards the retained remark draft.
Browser unload warns for a dirty form or a pending write.

Stored Vehicle/Driver references in profiles, Device lists/Diagnostics, Trips, Alerts and Maintenance
are native links in the current language and Branch. Cross-resource navigation starts with
that resource's own filters. Opening an assigned Vehicle from a Driver preserves a bounded
`fromDriver` UUID so the profile's Back link returns to that Driver, including after tab changes
or Vehicle editing; malformed markers fall back to Vehicles.

On narrow screens, Fleet tables keep a compact identity cell and its row menu pinned together
while the remaining columns scroll. The separate right-hand menu column is used at wider widths;
secondary fields hidden at narrow widths remain available in record details.

The sidebar places Maintenance in Fleet. Settings follows Karma Client and retains the
selected Branch's Vehicle groups and General settings links.

## Devices admin

- [API](../../apps/admin/src/app/features/fleet/devices/devices-api.ts), [page](../../apps/admin/src/app/features/fleet/devices/devices-list-page.ts), [editor](../../apps/admin/src/app/features/fleet/devices/device-editor-page.ts), [mapping](../../apps/admin/src/app/features/fleet/devices/device-mapping.ts), [diagnostics](../../apps/admin/src/app/features/fleet/devices/device-diagnostics-page.ts).

IMEI is exactly 15 digits and unique per Branch, retaining leading zeros. Assignment is optional;
unassigned Devices are stock. Multiple Devices may share a scoped Vehicle. The editor uses the
existing StarLink/Scout/Other catalog and nullable model, firmware, SIM, installation and notes
fields. Vehicle choices load in bounded pages through the captured editor client. Row and selected
delete actions use one partial-result batch. Connection status and whole-Branch KPIs come from the
server. Each list response retains one database snapshot for status/report dates, filters, sorting
and count. Diagnostics display available stored metadata; signal, voltage, firmware policy and Restart
are explicitly unavailable/Demo until integrated.
The installation field uses native floating date/time text in the displayed Branch time zone,
matching odometer entry. Invalid dates and skipped DST times are rejected. An unchanged instant
retains its seconds, milliseconds and overlap occurrence; an edited ambiguous time uses the first
occurrence. Submissions convert to UTC, and clearing retains the nullable-field clear value.
The primary IMEI action opens Diagnostics before editing. Edit from that drawer returns to
Diagnostics on save/cancel; the row-menu Edit action retains its direct list return.

## Other Fleet admin screens

The live containers feed the same presentation components as Storybook and use BG/EN catalogs,
captured clients, generated operations and shared load/error/empty states:

- [Overview](../../apps/admin/src/app/features/fleet/overview/overview-page.ts) displays the Branch
  snapshot, fourteen-day distance, activity by group, recent trips and attention links. The read
  uses the server's data clock and supports retry with retained data after a refresh failure.
- [Alerts](../../apps/admin/src/app/features/fleet/alerts/alerts-page.ts) lists actionable events,
  with filtered counts independent of alert status. Acknowledge accepts an IDs-array with partial
  results; detail resolve/reopen uses the loaded expected status and retains failed remarks.
  An optimistic conflict reloads the latest status before enabling another action, preserving a
  dirty remark. Failed refreshes block stale writes and expose read retry; mutations are never
  retried automatically.
- [Trips](../../apps/admin/src/app/features/fleet/trips/trips-page.ts) preserves URL filters and
  half-open date ranges in the configured Branch time zone. Its detail drawer shows the complete chronological maneuver timeline;
  whole-Branch KPIs remain independent of the current list page.
- [Drivers](../../apps/admin/src/app/features/fleet/drivers/drivers-page.ts) edits identity, contact,
  licence and tachograph documents and supports protected partial delete/deactivate batches. Expiry
  badges use the actual Fleet business date, including when telemetry has no data clock. Scorecards
  accept 7, 30 or 90 days and preserve the list context on Back. Each assigned vehicle in the
  read-only Driver record opens that vehicle's profile in the current Branch.
- [Maintenance](../../apps/admin/src/app/features/fleet/maintenance/maintenance-page.ts) supports
  planning, editing PLANNED tasks, completion with optional next task, cancellation and protected
  deletion. Row and selected cancellation require the shared destructive-action confirmation,
  naming the affected records before submission. DONE/CANCELLED records open as read-only history. Costs convert decimal text to exact
  EUR cents; zero and unknown remain distinct. Completion uses the service business date and the
  inactive-Vehicle/earlier-date rules above.
- [Vehicle groups](../../apps/admin/src/app/features/fleet/vehicle-groups/vehicle-groups-page.ts)
  lists the complete scoped groups through bounded pages, with create/edit drawers, color tokens
  and protected deletion.
- [General settings](../../apps/admin/src/app/features/fleet/settings/general-settings-page.ts)
  edits regional display preferences, configured thresholds and the stored speed-limit reference.
  Fleet settings save before the separate Core Branch-name mutation; a failed rename retains
  the saved Fleet preferences and the rejected name draft. Notification switches remain
  disabled Demo controls. See [Branch settings](architecture.md#branch-settings) for contracts/defaults
  and the [General settings workflow](development.md#angular-fleet-general-settings) for the
  initial preference gate, display versus entry units and partial-save behavior.

The topbar's notification bell is labelled Demo and explains that delivery has no connected
provider. It does not derive a notification feed or unread badge from Fleet business counts.
The account menu uses the actual demo tenant identity and offers theme switching and Sign out.

## Boundaries to preserve

Creation checks Branch existence through the [Fleet Core client](../../apps/fleet/src/integrations/core/core.client.ts)
once per request. Every repository predicate, relation, count and federation lookup includes verified Tenant and Branch scope. No cross-app
implementation imports or shared Prisma models exist. Inputs never own tenantId or branchId. Generated
TypedDocumentNodes/types come from explicit SDL/operation inputs. Backend availability also
gates entity resolution; disabled Angular routes issue no business requests.

See [architecture](architecture.md), [development](development.md) and
[testing](../testing.md) for current behavior and validation commands.

## Background device configuration reads

The [device operations SDL](../../apps/fleet/src/modules/device-operations/device-operations.graphql),
[service](../../apps/fleet/src/modules/device-operations/device-operations.service.ts),
[repository](../../apps/fleet/src/modules/device-operations/device-operations.repository.ts) and
[processor](../../apps/fleet/src/modules/device-operations/device-operations.processor.ts)
own durable eData reads, predefined-parameter additions and existing-interval changes. The
[Karma internal client](../../apps/fleet/src/integrations/karma/karma-device-reads.client.ts)
uses fixed machine-authenticated HTTP endpoints without cross-application imports.

The admin's [configuration page](../../apps/admin/src/app/features/fleet/device-operations/device-configuration-page.ts)
is reached from a Device's Diagnostics. It preserves the last complete snapshot while an
operation is pending and reloads persisted work after navigation or refresh. Its
[parameter editor](../../apps/admin/src/app/features/fleet/device-operations/device-parameter-editor.ts)
previews one confirmed change against a complete baseline. The
[definition helpers](../../apps/fleet/src/modules/device-operations/device-parameter-change.ts)
preserve unknown raw fields, construct verified Monitor presets and compare the complete
result; [profile evidence](../../apps/fleet/src/modules/device-operations/device-profile-evidence.ts)
has its own age and watermark. See the
[architecture](architecture.md#background-device-configuration-reads),
[setup and workflow](development.md#background-device-configuration-reads) and
[testing](../testing.md).
