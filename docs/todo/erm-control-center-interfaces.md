# holita control center: operator interfaces

Plan for the next session: the admin interfaces that let operators see and control the fleet's
StarLink units through holita's own server instead of Karma. It builds on what the
[fleet control plan](erm-fleet-control-plan.md) proved on 2026-11-03 and on the open receiver tasks
in the [routing backlog](erm-tcp-receiver-and-test-device-routing.md). Karma Client gets no new
features; it stays only until these pages cover it.

## What exists (2026-11-03)

- `apps/erm-server` relays three test trucks (CB5640XP, CB5636XP, CB6711TE) to Karma, runs them in
  primary mode, decodes text, `$SLC` and `$SLB` events, and stores connections, frames, events and
  commands.
- Read-only GraphQL: `ermUnits`, `ermEvents`, `ermFrames`, `ermCommands`, shown on the admin page
  "ERM сървър". It has no Tenant/Branch scope.
- The internal command API (bearer token, not exposed through the Gateway) sends allowlisted reads,
  eData fixed reads and non-protected parameter writes, and records each command.
- Full parameter snapshots of CB5636XP (1,344 parameters) and CB5640XP (partial) exist only as
  private files. Fleet `Device` already holds IMEI, model, firmware, SIM number and ICCID.

## Prerequisites

1. **Unit registry.** Register the ten units as Fleet Devices and Vehicles in their Branch from the
   [owner's list](erm-tcp-receiver-and-test-device-routing.md#replace-karma): IMEI, model, SIM number,
   ICCID, firmware (2.45d on the test trucks), truck and VIN. Add the ERM serial number to Device.
2. **Scope.** Resolve erm-server data only for units of the caller's Branch. Fleet owns the
   Device-to-IMEI mapping, so erm-server needs it through the Gateway contract, for example by
   extending the Fleet `Device` entity with its erm-server unit. Write the decision before coding,
   as described in [architectural changes](../../AGENTS.md#architectural-changes).
3. **Command mutation.** Expose the internal command API as an authenticated, Branch-scoped
   GraphQL mutation that records the operator. Keep the allowlist; add no free-text command box.
4. **History backfill.** Re-decode stored frames when a decoder changes: the Trackers' binary
   reports received before 2026-11-03 13:24 are stored but have no `ermEvent` rows.
5. **Receiver gaps that the pages would show wrongly:** closes not recorded on shutdown, and units
   that return only at their next scheduled transmission after erm-server closes their connection
   (up to 5 minutes driving, up to an hour parked; a call to the SIM wakes a unit at once).

## Pages

| Page                 | Content                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Units overview       | Every unit with truck, model, server (holita/Karma), mode, connected or last frame, always-on, firmware, eData module, latest position, speed, ignition, voltages, signal and satellites                                             |
| Unit · Live          | Latest event on the map, current status from the last `48` read                                                                                                                                                                      |
| Unit · History       | Decoded events with filters; event fields such as the location report's ignition and reason and the diagnostic report's level and code; eData payloads (`405` measurements, `411` diagnostics, `419` faults, `154` refusals) decoded |
| Unit · Frames        | Raw frames with `$SLC` inner frames and `$SLB` fields, for diagnosis                                                                                                                                                                 |
| Unit · Commands      | Actions: read parameters, read status (`07`, `12`, `16`, `56`, `61`), request location (`05`), eData fixed reads, change a parameter with snapshot, read-back and restore; history with result codes in Bulgarian                    |
| Unit · Configuration | Snapshots with parameter titles from the protocol archive, secrets masked, and diffs between dates or units; "take snapshot" runs as a background job                                                                                |
| Unit · Diagnostics   | Unit alarms (events 2, 9/10, 11, 42/43, 76, 90/91, 94/95), vehicle faults (`419`, event 70, 89) and connection health (gaps, resends, Karma `46` attempts)                                                                           |
| Routing              | Guided move between Karma and holita with its outcome; shows primary and backup servers                                                                                                                                              |
| Karma coverage       | What each Karma function maps to in holita, until the Karma modules are archived                                                                                                                                                     |

## Order

1. Registry and the scoping decision.
2. Units overview and the read-only unit pages (Live, History, Frames, Diagnostics).
3. Commands with the safe actions, then parameter changes.
4. Configuration snapshots as background jobs.
5. Routing and the Karma coverage page.

Each step follows the admin instructions: typed Reactive Forms, generated operations through the
Gateway, Bulgarian and English catalogs, and no demo data in product pages.
