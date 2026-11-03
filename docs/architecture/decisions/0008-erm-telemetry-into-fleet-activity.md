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
`waitForCompletion`, like Karma monitoring) runs every 30 seconds when
`FLEET_ERM_TELEMETRY_ENABLED=true` (default off), against `ERM_TELEMETRY_URL` (default
`http://127.0.0.1:11017`). For each registered Device it requests that IMEI's events after the
Device's cursor. erm-server never learns Tenants or Branches and never
pushes. Fleet's registry decides where a unit's data belongs, and because IMEIs are globally unique,
one unit feeds exactly one Branch.

**Endpoint.** The erm-server `api` role (loopback 11017, deployable without disconnecting trucks)
adds `GET /internal/telemetry/units/:imei/events?after=<id>&limit=<1-500>`:

- loopback only, with a bearer `ERM_TELEMETRY_TOKEN`: a read-only token, separate from the
  gateway's command token `ERM_INTERNAL_TOKEN`, that Fleet keeps server-side;
- returns `{ events, next }` ordered by `ermEvent.id`, ids as decimal strings; `next` is the last
  returned id, or `after` for an empty page, which is also the answer for an IMEI without events.
  Each device event has `id`, `eventId`, `eventTime`, `receivedAt` (frame receipt), `latitude`,
  `longitude`, `speedKmh`, `heading`, `odometerKm`, `engineOn`, `ignitionOn`, `mainVoltage`,
  `backupVoltage` and `edata`: the decoded eData `411` or `419` payload of StarLink event 33, or
  null. Raw frames, `fields` and commands stay out;
- serves only events received at least 10 seconds before the request. A unit's events are written
  in its connection's queue order, but a reconnect overlap can commit ids out of order; the delay
  keeps the cursor from skipping them.

**Cursor and idempotency.** Fleet keeps one cursor per Device in a new scoped `fleetErmCursor` row
(`tenantId`, `branchId`, `deviceId`, `lastEventId`) that is deleted with its Device. One transaction
per page inserts the samples, updates trips and advances the cursor, so a failed tick changes
nothing and the next tick repeats it. Samples insert with `ON CONFLICT DO NOTHING` on their unique
(vehicle, IMEI, `recordedAt`) key, and trips change only from newly inserted samples, so a replayed
page or a recreated cursor adds nothing twice. A request times out after 5 seconds, a tick reads at
most 10 pages per Device, and an unreachable endpoint leaves every cursor unchanged.

**What is imported.**

- A new `FleetDataSource.ERM`. Each event becomes one status sample of the Device's Vehicle at
  ingestion: `recordedAt` = `eventTime`, `receivedAt` = frame receipt, position, `speedKph`,
  `headingDeg`, `ignition` = `engineOn`, `odometerKm`, `externalVoltage` and `backupBatteryVoltage`.
  Several events in the same second keep the first.
- Only events received at or after the Device's `installedAt`, or its `createdAt` when installation
  is unknown, so a unit registered again never imports an earlier owner's history.
- Events of a Device without a Vehicle advance its cursor without being stored: stock units have
  no Vehicle activity.
- Events without `eventTime`, or with an `eventTime` more than one minute after their `receivedAt`,
  are skipped, so a wrong unit clock cannot move the Branch data clock.
- `FleetEvent` rows come only from eData, as dated observations. Each `419` fault-logger record
  becomes a `DIAGNOSTIC_TROUBLE_CODE` event (`SPN … FMI …`, WARNING when added, INFO when deleted),
  and a `411` CAN error flag becomes a `CAN_ERROR` event. There is no alert lifecycle or current
  fault state until the fault lifecycle and completeness are established, and a hand-written
  partial unique index makes replays idempotent. Other ERM event IDs map to `FleetEventKind` only
  after the ERM roadmap verifies them; until then the federated ERM history shows them.

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
reports carry no decoded ignition yet (`ignitionOn` stays null until the roadmap's binary ignition
work is verified), so routed Trackers get samples without trips; Scouts' text events carry `#ENG#`.

**Karma until each truck is routed.** Fleet imports only what erm-server receives. A truck still on
Karma, or reporting to its Karma backup (0051/0052) for a while, has no ERM events: its Fleet
activity stays empty or shows the gap, and the Karma Client section and Fleet's Karma monitoring
(`karmaMonitoring*` tables) remain its source. Routing a truck starts its ERM activity. Fleet
activity never stores Karma-derived values, and Karma pulls retire per truck only when the ERM
roadmap allows.

## Consequences

Routed trucks get real Fleet activity without new infrastructure, a second registry or Tenant data
in erm-server. Both processes need the new token in their runtime environment and in
`.env.example`. Fleet trails erm-server by about one tick plus the 10-second delay, and the
Device's Vehicle at ingestion receives each sample, so a reassignment inside that window can
attribute a few samples to the new Vehicle.

Trip distances rely on the unit's `#ODOD#` odometer, which is km only when its parameter 0004
selects distance; the roadmap's per-unit comparison with Karma confirms this before distances are
trusted.

The demo dataset uses the owner's Branch scope. Never load it into a Branch that receives ERM data,
because demo and live samples would share one data clock. The federated `FleetDevice.erm*` history
is not yet bounded by registration time; that remains ERM roadmap work.

Implementation follows in two parts: erm-server adds the endpoint and token; Fleet adds the source
value, the cursor table, the job and trip derivation.
