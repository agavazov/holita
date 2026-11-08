# Devices, commands and truck faults

Status: approved by the owner on 2026-11-06, with the decisions below. This is the Discocan phase after
[admin UI v2](ui-v2.md). Delivery follows UI v2: Codex implements each package in the main checkout
on disjoint folders, and Claude reviews the result, runs `npm run check` under
`flock .nx/holita-check.lock` and commits locally after each package. Nothing is pushed. Device work
follows the [ERM roadmap safety rules](erm-roadmap.md#safety-rules) and test levels.

## Goals (owner, 2026-11-06)

- **Devices:** show for every unit when it last sent a signal, whether it is online, and that it has
  fallen back to Karma, with a button that returns it to holita. The information should be enough,
  ordered and meaningful. Karma will not stay long, so its part stays small and removable.
- **Commands:** a fleet-wide command queue, controlled `46` parameter writes, batch commands (one
  unit at a time with verification), and roles and permissions.
- **Truck faults:** everything needed to show and act on diagnostic faults such as a brake or an
  engine problem.

## Remaining facts (2026-11-08)

- Faults: since 2026-11-03, no truck has sent a `413`, `418` or `419` fault record to holita.
  CB1147TP reported SPN 4339/7, 1247/11 and 23806/15 through Karma on 2026-10-28/29. The
  stored-fault read (`30` `301/19`) returned `154,0` (not acknowledged) on CB1147TP and CB1344XH,
  so faults come only from automatic reports and warning lamps until ERM explains that read. The
  active/cleared lifecycle is unproven, and descriptions are holita's own wording.
- Warning lamps: only CB5636XP has the definitions (since 2026-11-06). On 2026-11-08 its reports
  carried 1896 only; 1906 and 1910 never arrived. 1896 read RED at every ignition-on while the engine
  was off, so Fleet now ignores lamp values reported with the engine off.

## Packages

Delivered on 2026-11-06: the Branch command queue with retry and batch reads, Tenant-wide roles,
Karma backup detection with the return to holita, and the structured fault pipeline with warning
lamps. Delivered on 2026-11-08: ERM role enforcement with controlled `46` writes and configuration
batches, the Device status workspace, the admin command queue with the `46` form and role-aware
controls, fault meanings with current warnings and lamp notifications, and the truck faults view
(see [Discocan development](../discocan/development.md)). Remaining:

| ID  | Package                 | Scope                                                                                                                                                                                                                                                     | Depends | Device level | Codex     |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------ | --------- |
| F1  | Warning lamps on trucks | Operations by Claude: after CB5636XP's next start, confirm that it raises no CRITICAL brake notification, then add eData 1896, 1906 and 1910 to the other trucks one at a time through the guarded GraphQL workflow with writes enabled only for each run | —       | L1, then L3  | —         |
| W2  | `46` proof              | Operations by Claude after the owner's explicit approval: one controlled `46` change with readback and restoration on a parked test truck, writes enabled only for the run, before batch writes reach the other trucks                                    | —       | L1           | —         |
| A4  | Fleet role controls     | Admin: hide or disable Fleet editing (Vehicles, Devices, Drivers, maintenance, Settings) above the signed-in role; the server already refuses it                                                                                                          | —       | none         | sol/ultra |
| K2  | Karma polling           | ERM: read Karma in parallel or widen the staleness window, so slow reads (7–29 s) do not leave units UNKNOWN between passes                                                                                                                               | —       | none         | sol/ultra |

## Order

1. **Next:** F1 after CB5636XP's next start and W2 after the owner's approval (operations by
   Claude); A4 and K2 can run at any time.
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
