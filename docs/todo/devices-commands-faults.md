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

## Baseline (2026-11-06)

- ERM already knows Connected, Reporting and Live per unit, plus voltages, GSM signal, observed
  firmware and network changes, but the Device page hides most of them. Since the Karma Client
  removal, a unit on its Karma backup reads as "not reporting", and returning it needs a manual
  Karma `98` to the read-only recovery listener on 11510. Test trucks CB5636XP and CB5640XP sat on
  their backup unnoticed from 2026-11-05 ~13:50 UTC until a manual return on 2026-11-06.
- Commands: six permitted reads in a durable per-Device queue (latest 50), with expiry and
  cancellation. The issuer is recorded as the Core user. There is no Branch-wide view, explicit
  retry, batch or role check. `46` exists only on the internal API.
- Faults: since 2026-11-03, no truck has sent a `413`, `418` or `419` fault record to holita.
  CB1147TP reported SPN 4339/7, 1247/11 and 23806/15 through Karma on 2026-10-28/29. Four trucks
  sent 222 `417` CAN-loss reports, and Fleet does not import them. Problems drops the SPN/FMI of
  each fault. There is no description source, and the active/cleared lifecycle is unproven.
  On 2026-11-06 the stored-fault read (`30` `301/19`) returned `154,0` (not acknowledged) on
  CB1147TP and CB1344XH, so faults come only from automatic `419` reports and warning lamps until
  ERM explains that read.
- Defects to fix inside the packages below: a successful direct read shows "Outcome unknown";
  snapshot diffs treat an unread value as a change; a fresh eData read clears the gate of an
  uncertain `04` write; notifications lose timeout reasons; a Core outage looks like an invalid
  session; `lab-session` allows protected parameter writes that the gateway refuses.

## Packages

| ID  | Package                    | Scope                                                                                                                                                                                                                                                                                                                | Depends    | Device level | Codex       |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------ | ----------- |
| C1  | Command queue API          | ERM: Branch-wide paged command list with filters; explicit retry as a new linked request (never automatic); the cancelling user; a waiting reason that separates a blocked service from an offline unit; timeout reasons kept in notifications; batch reads as one request per selected unit, with progress and stop | —          | L0, then L1  | sol/ultra   |
| R1  | Roles and permissions      | Core role per user; the verified session carries it; Fleet and ERM enforce it; a Core outage is reported as unavailable, not as an invalid session                                                                                                                                                                   | —          | none         | astra/ultra |
| F1  | Fault data from the trucks | Operations by Claude with the owner: the stored-fault read (`eData faults`) on CB1147TP and CB1344XH; warning-lamp eData definitions (engine, EBS/ABS, DPF, gearbox) on test truck CB5636XP, then on the other trucks one at a time                                                                                  | —          | L1, then L3  | —           |
| K1  | Karma backup and return    | ERM: a separate, removable Karma module reads the routed units' latest Karma data; a unit with newer Karma data is on backup since that time; "Return to holita" sends a read-only `98` to the recovery listener, only for a parked unit; audit and notifications                                                    | R1         | L1           | astra/ultra |
| F2  | Structured fault pipeline  | ERM feed and Fleet: import `417`, `413` and `418`; keep code, status and times of every fault in Problems; decode the verified warning-lamp values; badges separate history from current warnings                                                                                                                    | C1, F1     | L0           | sol/ultra   |
| W1  | Controlled `46` writes     | ERM: fix snapshot read outcomes and per-parameter reconciliation, align `lab-session` protections, notify failed restorations; `46` with an exact baseline, preflight, one scoped change, whole-set readback and restoration; batch writes reuse it one unit at a time, stopping at the first mismatch               | C1, R1     | L0, then L1  | astra/ultra |
| A1  | Device status workspace    | Admin Devices list and Device overview: last signal, online state, Karma-backup banner with the return button, observed firmware, voltage and GSM signal, grouped and readable                                                                                                                                       | K1         | none         | sol/ultra   |
| A2  | Command center             | Admin: Branch command queue page with cancel, retry and batches; the `46` form with a readable planned change; correct received-response state; translated errors; role-aware controls                                                                                                                               | C1, R1, W1 | none         | sol/ultra   |
| F3  | Fault meanings             | Fleet: holita's own BG/EN wording for FMI and vehicle systems, descriptions of observed codes from ERM/vendor sources (no copied SAE tables), current warnings from lamp states and history from fault records; notifications on warning-lamp changes                                                                | F2         | none         | sol/ultra   |
| A3  | Truck faults view          | Admin: readable faults per truck and fleet in Problems, Vehicle and Device pages and notifications, separating current warnings, history and missing coverage                                                                                                                                                        | F3         | none         | sol/ultra   |

## Order

1. **Wave 1 (backend; the admin stays frozen until the UI v2 visual review is committed):** C1 and
   R1 in parallel; F1 stored-fault reads.
2. **Wave 2:** K1 and F2; F1 warning-lamp definitions after the owner's go for the device writes.
3. **Wave 3:** W1, then A1 and A2 once their backends are in.
4. **Wave 4:** F3 and A3.

ERM packages share `apps/erm-server/prisma/schema.prisma` and the telemetry SDL, so only one ERM
package edits them at a time. Codex was at 84% of its weekly window on 2026-11-06; packages beyond
wave 1 may wait for its reset.

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
