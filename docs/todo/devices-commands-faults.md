# Devices, commands and truck faults

Status: approved by the owner on 2026-11-06, with the decisions below. This is the Discocan phase after
[admin UI v2](ui-v2.md). Delivery follows UI v2: Codex implements each package in the main checkout
on disjoint folders, and Claude reviews the result, runs `npm run check` under
`flock .nx/discocan-check.lock` and commits locally after each package. Pushes need the owner's
approval. Device work follows the [ERM roadmap safety rules](erm-roadmap.md#safety-rules) and test
levels.

## Goals (owner, 2026-11-06)

- **Devices:** show for every unit when it last sent a signal, whether it is online, and that it has
  fallen back to Karma, with a button that returns it to discocan. The information should be enough,
  ordered and meaningful. Karma will not stay long, so its part stays small and removable.
- **Commands:** a fleet-wide command queue, controlled `46` parameter writes, batch commands (one
  unit at a time with verification), and roles and permissions.
- **Truck faults:** everything needed to show and act on diagnostic faults such as a brake or an
  engine problem.

## Remaining facts (2026-11-08)

- Faults: CB1147TP sent `419` records from 2026-11-07 to 11-09 and CB6711TE from 2026-11-11, after
  Process DTCs was enabled on it. The stored-fault read (`30` `301/19`) answers `154,0` when the
  fault buffer is empty and `154,1` plus a `419` snapshot when codes are active (2026-11-11). Whether
  the buffer survives ignition off is unproven, and descriptions are discocan's own wording.
- Warning lamps: only CB5636XP has the definitions (since 2026-11-06). On 2026-11-08 its reports
  carried 1896 only; 1906 and 1910 never arrived. 1896 read RED at every ignition-on while the engine
  was off, so Fleet now ignores lamp values reported with the engine off.

## Packages

Delivered on 2026-11-06: the Branch command queue with retry and batch reads, Tenant-wide roles,
Karma backup detection with the return to discocan, and the structured fault pipeline with warning
lamps. Delivered on 2026-11-08: ERM role enforcement with controlled `46` writes and configuration
batches, the Device status workspace, the admin command queue with the `46` form and role-aware
controls, fault meanings with current warnings and lamp notifications, and the truck faults view
(see [Discocan development](../discocan/development.md)), then Karma routing that keeps its last
observation through slow or failed reads, and Fleet editing offered only to the roles the server
permits. Remaining:

| ID  | Package                 | Scope                                                                                                                                                                                                                                                                                                                                                                         | Depends | Device level | Codex |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------ | ----- |
| F1  | Warning lamps on trucks | 2026-11-11: telltales 1889–1903 are now defined at 180 s on CB6711TE, CB6721TE and CB1147TP. DAF trucks deliver only that block: 1896 (brakes) arrives, but 1906 (engine/MIL) and 1910 (ABS) never did, so Fleet's ENGINE and ABS lamps cannot come from DAF telltales. Remaining: Volvo (CB9369PE test pending; CB5636XP has 1896/1906/1910), and confirm values on CB1147TP | —       | L1, then L3  | —     |

## Order

1. The owner approved the diagnostics campaign on 2026-11-11 (reads, temporary eData changes and
   one controlled `46`, all with restore). W2 passed through the guarded workflow on 2026-11-11
   (CB6711TE, record `7fbf80a7`, RESTORED). F1 continues within the campaign (operations by Claude).
2. The owner reviews the Device status, command queue and faults screens together with the UI v2
   acceptance.

## Decisions (owner, 2026-11-06)

- **Roles:** Viewer (read only), Operator (device reads, queue, batch reads, SMS preparation, alert
  actions and master data), Engineer (Operator plus configuration writes, snapshots and the return
  from Karma), Administrator (everything, including users and Branch settings). Roles are
  Tenant-wide in this phase; existing users become Administrators. Unmasked secrets stay visible to
  Operators and above.
- **Device actions:** the stored-fault reads on CB1147TP and CB1344XH, and the warning-lamp
  definitions on test truck CB5636XP (L1, one at a time, with readback and restoration).
- **Karma:** a narrow read and `98` through the existing Karma API account, removed together with
  Karma.
- **Batches:** reads first. Writes reuse the verified per-unit workflow, one unit at a time, only
  after an L1 proof.
- **Faults:** the first release shows readable recorded faults, CAN loss and warning lamps with
  their coverage. State-based fault alerts follow once the lifecycle is proven with ERM.

## Not in this phase

IMEI change and cross-Branch transfer boundaries (import cursor, history cutoff), service-health
status, a per-unit profile model, vehicle-acting commands (L2) and production deployment.
