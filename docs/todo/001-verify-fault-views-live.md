# 001 Check fault views after the device refactor

**Status:** Ready. **Product:** Discocan (admin and Fleet).

## Background

Commits `1c5c41d` (device types and adapters) and `f0f9cf5` (review fixes) changed screens that are
used every day:

- The fault-read history on the faults page and in the live panels is loaded in one
  `fleetDeviceFaultReads(deviceIds)` query (`discocan/apps/admin/src/app/ui/fleet-live/fault-reads.ts`).
- The Branch fault log (`discocan/apps/fleet/src/modules/device-commands/fault-read-log.ts`) also
  lists reads of deleted Devices.
- The live dashboard truck details
  (`discocan/apps/admin/src/app/features/fleet/live-dashboard/live-truck-details.*`) use the shared
  `faultReadDevice`, which picks the vehicle's ERM Device.
- Device screens use the device-neutral Fleet API. ERM-only parts moved to
  `discocan/apps/admin/src/app/features/erm/`.

Database tests cover the Fleet side. Nobody has opened these screens in a browser since the change.

Fleet sends a fault read to every online truck every 30 minutes
(`discocan/apps/fleet/src/modules/device-commands/fault-read.jobs.ts`). The replies (`154`) arrive
within minutes, so there is fresh data to compare.

## Goal

The daily screens show the same data as before the refactor, without errors.

## Steps

1. Check that the dev stack is up: admin at `http://localhost:11000`, Fleet `/health` on port 11013. The owner usually runs `npm run dev:discocan` in a terminal tab. Start it only if it is not
   running.
2. Sign in with the development sign-in and open the Branch with the trucks.
3. Faults page (route `:branchId/fleet/faults`):
   - every online truck has reads from the last few hours, at the 30-minute schedule;
   - the vehicle filter narrows the list to that truck;
   - a sample of rows matches Fleet's data (the Fleet API or a read-only query on the development
     database).
4. Live dashboard (route `:branchId/fleet/live`): open two or three trucks. The fault-read block
   shows the last read and its result for the truck's ERM Device.
5. Devices list and a Device profile: the type is shown, the form has the ERM section for ERM
   Devices, and the events, messages, commands and parameter tabs load.
6. Watch the browser console and the Fleet log for errors while you go.

## Done when

All the screens above load without errors and match the data. Each defect found is fixed with the
smallest change, or written up as a new ticket when it is larger.

## Limits

- Do not press command, fault-read, Karma or "return to Discocan" actions. They act on real trucks.
- Screenshots go only to the Git-ignored `.references/review/`.

## Findings (2026-11-21)

Checked with a headless browser (demo login, Branch Discordia) and direct Fleet GraphQL calls,
at load average 15–18 with swap full. Nothing was fixed; no code was changed.

1. **Faults page: the truck list fails.** `AdminFaultMonitor` returns `SERVICE_UNAVAILABLE` from
   the Router, and the page shows "Could not load the list". Fleet itself answers in 5.7–6.6 s;
   without `devices.state` the same query takes 0.45 s.
   - Cause: since the refactor `FleetDevice.state` is resolved inside Fleet through the ERM
     adapter (`discocan/apps/fleet/src/modules/device-inspection/device-state-loader.ts` →
     `states()` in `discocan/apps/fleet/src/integrations/erm/erm-inspection.ts`, ERM `ermState`).
     The Router gives the `fleet` subgraph 5 s (`traffic_shaping.all` in
     `discocan/apps/gateway/router/router.yaml`). Before the refactor the admin asked for
     `ermState` through the Router from `erm-server`, which has 45 s.
   - Fixed on 2026-11-21: `router.yaml` gives the `fleet` subgraph 15 s, above Fleet's own 10 s
     ERM GraphQL timeout. After a dev stack restart `fleetFaultMonitor` answered through the Router
     in 8.3 s with 10 rows and no errors.
   - The fault log on the same page loads: 596 entries, reads every 30 minutes (CB5636XP,
     CB6711TE, CB9405PE, CB1147TP, CB6721TE in the last hours).
2. **Live dashboard shows "This fleet has no trucks".** `AdminLiveFleet` fails with
   `SERVICE_UNAVAILABLE`. On Fleet directly, `fleetMap` and `fleetProblems` each fail after
   10.3–10.5 s with "ERM dashboard data is unavailable": Fleet's 10 s ERM GraphQL timeout
   (`requestErmDashboard` → `requestErmGraphql`, `ermFleetTelemetry` and `ermFleetProblems`).
   The same 10 s timeout existed before the refactor (`erm-dashboard.client.ts`).
   - Measured on 2026-11-21: erm-api's `ermFleetTelemetry` for the 10 Branch IMEIs takes
     25.5–28.7 s when called directly with Fleet's telemetry token, at load average 15–23.
   - The time goes to one SQL query in the live erm-api (`discocan_erm` database). For each unit
     it takes lateral subqueries on `"ermFrame"` (latest device frame with `receivedAt <= $2`,
     plus the ignition, engine and speed values) and runs with parallel workers.
   - So this is not caused by the refactor. The fix belongs in `erm-server` (that query or an
     index on `"ermFrame"`) and reaches the live units only with a deploy. That needs the owner.
     Raising Fleet's 10 s timeout would only make the dashboard wait about 30 s.
3. **Not checked yet:** the vehicle filter and the data sample on the faults page, live truck
   details, the Devices list and Device profile, and the Fleet log (its output goes to the
   owner's terminal).

## References

- [Device types and adapters](../../discocan/docs/architecture.md#device-types-and-adapters)
- [ADR 0009](../architecture/decisions/0009-device-types-and-adapters.md)
