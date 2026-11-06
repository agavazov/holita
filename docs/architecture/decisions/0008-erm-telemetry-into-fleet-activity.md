# ERM telemetry into Fleet activity

## Context

Fleet activity rows (`VehicleStatusSample`, `Trip`, `FleetEvent`) drive vehicle state, the Branch
data clock, trips, daily distance, the overview and scorecards. Only the demo seed, tests and
MANUAL odometer readings write it (`FleetDataSource` is `DEMO` or `MANUAL`), and the owner's Branch
has none. Meanwhile `apps/erm-server` decodes position, speed, heading, odometer, ignition/engine
and main/backup voltages from every truck routed to holita into provider-level `ermEvent` rows.

The current design cannot connect the two:

- ERM reaches a Branch only through `FleetDevice.erm*` fields resolved per request
  ([ADR 0007](0007-erm-gateway-and-api-processes.md)). Fleet filters, sorts and aggregates
  derived values in one scoped SQL snapshot
  ([ADR 0005](0005-fleet-list-contract-and-derived-values.md)), which cannot read another
  service's database or call it per row.
- Raw ERM data stays provider-level, without Tenant/Branch columns or a second Device registry
  (ADR 0007), and no service writes another service's database
  ([ADR 0002](0002-database-ownership.md)).
- Persistence problems must never interrupt device forwarding or acknowledgements
  ([ADR 0006](0006-erm-device-server.md)), so the gateway cannot depend on Fleet.

Fleet therefore needs its own scoped copy of the activity, filled by a process that Fleet controls.
Pushing from erm-server would tie truck sessions to Fleet's availability and need an outbox, and a
message broker would add infrastructure beside PostgreSQL.

## Decision

**Fleet pulls; erm-server serves.** A Fleet background job (`@nestjs/schedule` with
`waitForCompletion`) runs every 30 seconds when
`FLEET_ERM_TELEMETRY_ENABLED=true` (default off), against `ERM_TELEMETRY_URL` (default
`http://127.0.0.1:11017`). For each registered Device it requests that IMEI's events after the
Device's cursor. Raw ERM telemetry stays provider-level, without Tenant/Branch scope, and
erm-server never pushes it. Separately, operator audit records retain verified scope as in ADR 0007. Fleet's registry decides where a unit's data belongs, and because IMEIs are globally unique,
one unit feeds exactly one Branch.

**Endpoint.** The erm-server `api` role (loopback 11017, deployable without disconnecting trucks)
adds `GET /internal/telemetry/units/:imei/events?after=<id>&limit=<1-500>`:

- loopback only, with a bearer `ERM_TELEMETRY_TOKEN`: a read-only token, separate from the
  gateway's command token `ERM_INTERNAL_TOKEN`, that Fleet keeps server-side;
- returns `{ events, next }` ordered by `ermEvent.id`, ids as decimal strings; `next` is the last
  returned id, or `after` for an empty page, which is also the answer for an IMEI without events.
  Each device event has `id`, `eventId`, `eventTime`, `receivedAt` (frame receipt), `latitude`,
  `longitude`, `speedKmh`, `heading`, `odometerKm`, `engineOn`, `ignitionOn`, `mainVoltage`,
  `backupVoltage` and `edata`: the decoded eData `405`, `411` or `419` payload of StarLink event 33, or
  null. Raw frames, `fields` and commands stay out;
- `edata` for a `405` report is `{report: "405", measurements: [{parameterId, parameterType,
valueSize, valueHex}]}`. IDs are 0–65535, types 0–255, sizes 1/2/4 bytes and hex contains
  exactly twice that many digits. Unknown IDs and types remain raw observations; malformed
  reports have null `edata`. This contract preserves bytes, without physical conversion;
- serves only events received at least 10 seconds before the request. A unit's events are written
  in its connection's queue order, but a reconnect overlap can commit ids out of order; the delay
  keeps the cursor from skipping them.

**Cursor and idempotency.** Fleet keeps one cursor per Device in a scoped `fleetErmCursor` row
(`tenantId`, `branchId`, `deviceId`, `lastEventId`) that is deleted with its Device. One transaction
per page inserts the samples, updates trips and advances the cursor, so a failed tick changes
nothing and the next tick repeats it. Samples insert with `ON CONFLICT DO NOTHING` on their unique
(vehicle, IMEI, `recordedAt`) key, and trips change only from newly inserted samples, so a replayed
page or a recreated cursor adds nothing twice. A request times out after 5 seconds, a tick reads at
most 10 pages per Device, and an unreachable endpoint leaves every cursor unchanged.

**What is imported.**

- A new `FleetDataSource.ERM`. Each event becomes one status sample of the Device's Vehicle at
  ingestion: `recordedAt` = `eventTime`, `receivedAt` = frame receipt, position, `speedKph`,
  `headingDeg`, `ignition` = `ignitionOn` (falling back to `engineOn`), `odometerKm`, `externalVoltage` and `backupBatteryVoltage`.
  Several events in the same second keep the first.
- Only events received at or after the Device's `installedAt`, or its `createdAt` when installation
  is unknown, so a unit registered again never imports an earlier owner's history.
- Events of a Device without a Vehicle advance its cursor without being stored: stock units have
  no Vehicle activity.
- Events without `eventTime`, or with an `eventTime` more than one minute after their `receivedAt`,
  are skipped, so a wrong unit clock cannot move the Branch data clock.
- The ERM import creates `FleetEvent` rows from eData, as dated observations. Each `419` fault-logger record
  becomes a `DIAGNOSTIC_TROUBLE_CODE` event (`SPN … FMI …`, WARNING when added, INFO when deleted),
  and a `411` CAN error flag becomes a `CAN_ERROR` event. There is no alert lifecycle or current
  fault state until the fault lifecycle and completeness are established, and a hand-written
  partial unique index makes replays idempotent. Other ERM event IDs map to `FleetEventKind` only
  after the ERM roadmap verifies them; until then the federated ERM history shows them.

- With `FLEET_ERM_EDATA_MEASUREMENTS_ENABLED=true` (default off), each `405` item also becomes
  a `VehicleEdataMeasurement` of the Device's Vehicle, in the same scoped page transaction.
  It stores source event ID, IMEI, unit/receipt times, catalog ID, type, size and exact hex.
  The reviewed Simple eData catalog supplies a name and unit when known; those labels are
  snapshots, not conversion rules. A unique Tenant/Branch/IMEI/source-event/parameter key
  prevents duplicate measurements even after Vehicle reassignment. Stock, installation-time
  and invalid-clock rules above still apply. Existing cursors are not rewound when enabled;
  importing earlier reports requires a separate deliberate backfill.

**Measurement query and chart.** `fleetVehicleEdataMeasurements(vehicleId, from, to, parameterIds)`
requires verified Tenant/Branch access to the Vehicle, a range of at most seven days, and returns
`{vehicleId, from, to, items, truncated}`. It returns the newest 2,000 matching measurements in
ascending time order. The vehicle profile shows IDs 1, 3 and 539 over the last 24 hours of the
Branch data clock. Dots represent raw unsigned hex-byte magnitudes, with exact latest hex and
catalog labels. There is no interpolation or verified physical byte order, scale or signedness;
catalog units are reference labels only. Missing observations stay gaps.

**Two clocks.** ERM samples are device samples: their unit time sets the Branch data clock (`asOf`),
and `receivedAt` keeps erm-server's receipt time. Fleet never stamps them with `FleetClock.now()`;
the job uses wall time only to schedule ticks. Business dates keep `FleetClock.now()` in the Branch
time zone, and MANUAL readings still never move the data clock.

**Trips from ignition.** Ignition is `ignitionOn`, or `engineOn` when the unit reports no ignition
input. Inserted samples are applied per Vehicle in `recordedAt` order. Ignition on
without an open ERM trip opens one (start time, position and odometer); ignition off closes it (end
time, position, odometer, `distanceKm` as the odometer difference when both are known, and
`maxSpeedKph` over its samples). Unknown ignition neither opens nor closes a trip, and a sample that
is not newer than the Vehicle's latest applied ERM sample is stored without changing trips.
Addresses, idle time, fuel, scores and the driver stay null until measured. Binary `$SLB` Tracker
reports decode ignition and engine state from tag `32` flags; Scouts' text events carry
`#IGN#` or `#ENG#` when configured.

**Fleet activity follows ERM receipts.** Fleet imports only what erm-server receives. A truck
still on Karma, or reporting to its Karma backup (0051/0052) for a while, has no ERM events:
its Fleet activity stays empty or shows the gap. Routing a truck starts its ERM activity.
Fleet status samples and trips never store Karma-derived values. `UNIT_ON_BACKUP` observations
are routing evidence, separate from imported vehicle samples.

## Consequences

Routed trucks get real Fleet activity without new infrastructure, a second registry or Tenant data
in raw ERM ingestion. Operator audit records are the separately scoped exception in ADR 0007. Both processes need the new token in their runtime environment and in
`.env.example`. Fleet trails erm-server by about one tick plus the 10-second delay, and the
Device's Vehicle at ingestion receives each sample, so a reassignment inside that window can
attribute a few samples to the new Vehicle.

Trip distances rely on the unit's `#ODOD#` odometer, which is km only when its parameter 0004
selects distance; the roadmap's per-unit comparison with Karma confirms this before distances are
trusted.

The demo dataset uses the owner's Branch scope. Never load it into a Branch that receives ERM data,
because demo and live samples would share one data clock. The federated `FleetDevice.erm*` history
is not yet bounded by registration time; that remains ERM roadmap work.

The endpoint, cursor, job and trip derivation are implemented. The measurement collector is a
separate deployment flag and does not change the existing sample import when disabled.
