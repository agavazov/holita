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

## Remaining facts (2026-11-06)

- ERM knows Connected, Reporting and Live per unit, plus voltages, GSM signal, observed firmware
  and network changes, but the Device page hides most of them. Test trucks CB5636XP and CB5640XP
  sat on their Karma backup unnoticed from 2026-11-05 ~13:50 UTC until a manual return on
  2026-11-06; the new detection covers such cases once the admin shows it.
- Faults: since 2026-11-03, no truck has sent a `413`, `418` or `419` fault record to holita.
  CB1147TP reported SPN 4339/7, 1247/11 and 23806/15 through Karma on 2026-10-28/29. The
  stored-fault read (`30` `301/19`) returned `154,0` (not acknowledged) on CB1147TP and CB1344XH,
  so faults come only from automatic reports and warning lamps until ERM explains that read. There
  is no description source, and the active/cleared lifecycle is unproven.
- Defects left for the packages below: a successful direct read shows "Outcome unknown" in the
  admin; snapshot diffs treat an unread value as a change; a fresh eData read clears the gate of an
  uncertain `04` write; `lab-session` allows protected parameter writes that the gateway refuses.

## Packages

Delivered on 2026-11-06: the Branch command queue with retry and batch reads, Tenant-wide roles,
Karma backup detection with the return to holita, and the structured fault pipeline with warning
lamps (see [Discocan development](../discocan/development.md)). Remaining:

| ID  | Package                 | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Depends | Device level | Codex     |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------ | --------- |
| F1  | Warning lamps on trucks | Operations by Claude: eData 1896, 1906 and 1910 (FMS1 brake system, engine/MIL and ABS telltales, 180 s) were added and verified on CB5636XP on 2026-11-06; verify their `405` values on its next drive, then add them to the other trucks one at a time through the guarded GraphQL workflow with writes enabled only for each run                                                                                                                                    | —       | L1, then L3  | —         |
| W1  | Controlled `46` writes  | ERM: enforce roles on commands, batches, retries and configuration (Operator and Engineer); fix snapshot read outcomes and per-parameter reconciliation, align `lab-session` protections, notify failed restorations; `46` with an exact baseline, preflight, one scoped change, whole-set readback and restoration; batch writes reuse it one unit at a time; give `ErmConfigurationChange` a structured operation, since it has only the English `intent` audit text | —       | L0, then L1  | sol/ultra |
| A1  | Device status workspace | Admin Devices list and Device overview: last signal, online state, Karma routing with the return button (pending and uncertain attempts), warning lamps, observed firmware, voltage and GSM signal, grouped and readable                                                                                                                                                                                                                                               | —       | none         | sol/ultra |
| A2  | Command center          | Admin: Branch command queue page with cancel, retry and batches; the `46` form with a readable planned change; correct received-response state; translated errors; translated operation names in the device's settings runs (the BG UI shows the English `intent`, such as "Add eData parameter 1910"); user roles in Users and role-aware controls                                                                                                                    | W1      | none         | sol/ultra |
| F3  | Fault meanings          | Fleet: holita's own BG/EN wording for FMI and vehicle systems, descriptions of observed codes from ERM/vendor sources (no copied SAE tables), current warnings from lamp states and history from fault records; notifications on warning-lamp changes                                                                                                                                                                                                                  | F1      | none         | sol/ultra |
| A3  | Truck faults view       | Admin: readable faults per truck and fleet in Problems, Vehicle and Device pages and notifications, separating current warnings, history and missing coverage                                                                                                                                                                                                                                                                                                          | F3      | none         | sol/ultra |

## Order

1. **Next (backend):** W1. The admin packages wait until the UI v2 visual review is committed.
2. **Then:** A1 and A2 on separate admin folders; F1 after CB5636XP's next drive.
3. **Last:** F3 and A3.

ERM packages share `apps/erm-server/prisma/schema.prisma` and the telemetry SDL, so only one ERM
package edits them at a time.

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
