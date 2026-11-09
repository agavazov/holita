# ERM roadmap

Remaining work to run every StarLink unit on discocan, verify its data and commands, and retire
Karma. Follow [ADR 0007](../architecture/decisions/0007-erm-gateway-and-api-processes.md),
the [operator guide](../discocan/development.md#erm-device-server) and the retained
[ERM sources](../discocan/erm-resources/README.md).

The delivery baseline includes Fleet `serialNumber`/`edataModule`, the ten registered trucks,
`ERM_ROLE=api` on 11017, the event catalog/categories/severities, federated Device state/history,
the six-read command mutation and the admin Control center. Since 2026-11-03 it also includes the
gateway's Karma-drop/DNS fallbacks and routing guards, unit readings and health, stored-frame
re-decoding, Fleet's ERM import ([ADR 0008](../architecture/decisions/0008-erm-telemetry-into-fleet-activity.md)),
parameter snapshots and the admin SMS section. Since 2026-11-04 it also includes the ten-minute
device keepalive, read ends on unit errors, close records on stop, eData decoding, Tracker
ignition/engine from the `$SLB` `32` flags, single storage of resent reports, Fleet's
Karma-backup detection (`FleetDevice.routing`, `UNIT_ON_BACKUP`) and the controlled single-record
eData change tool. Their implementation and validation belong to their owning agents; do not
reopen them as roadmap tasks.

## Safety rules

- A unit always keeps a working way back. Its backup server (0051/0052) stays Karma until discocan runs
  without Karma, and no command changes the primary and the backup server together.
- Before any write, take that unit's parameter snapshot. Change one unit at a time, read every write
  back, and restore the snapshot value on a mismatch.
- Never read 0049–0052 through Karma for a unit routed to discocan: Karma then writes its own server
  back. A tool talking to a unit confirms every reply, so the unit does not resend it to Karma.
- There are no spare units (owner, 2026-11-03). CB6711TE, CB5640XP and CB5636XP are the test
  trucks; the other seven get only what the test trucks proved. Firmware update, reset, logger
  clearing, outputs and immobilizer, unit lock (0059/0060), authentication (`95`), TLS (0053), APN
  and the Simple SMS password are tried only on a parked test truck with a person at it, after
  telling the owner. Never on a moving truck. Report any loss of contact to the owner at once.
- Snapshots contain secrets (for example 0593 and lock codes). They stay in `discocan_erm`, and the
  admin shows them unmasked to the Device's Branch operators (owner, 2026-11-03); never print them
  in logs or commit them.
- Every test is recorded in the git-ignored `.references/erm-relay/JOURNAL.md` with its frames and
  captures.

## Test levels

| Level | Where                                      | Used for                                                              |
| ----- | ------------------------------------------ | --------------------------------------------------------------------- |
| L0    | Captures, the fake unit, ERM's Test Server | Parsers, tools and replays of real sessions                           |
| L1    | The three test trucks in service           | Reads, reversible settings and format changes                         |
| L2    | A parked test truck with a person present  | Outputs, immobilizer, ignition, CAN and other vehicle-wired functions |
| L3    | The other seven trucks, Karma as backup    | Only what L1 and L2 proved, one truck at a time                       |

## Fleet rollout

- Nine units report to discocan in primary mode since 2026-11-04: the three test trucks, the five
  routed on 2026-11-03 and CB6721TE. Route CB9680TE after checking its power/unit/SIM and current
  reachability: its last known report was 2026-10-28 06:02 UTC.
- A gateway restart sends about half of the driving units to their Karma backup, and a unit can
  also fall back without one (CB1147TP after a mobile-network change on 2026-11-04). Restart the
  gateway only while no routed truck is driving. Fleet marks such units `KARMA_BACKUP`; bring them
  back once parked as in [moving a unit](../discocan/development.md#moving-a-unit-between-karma-and-discocan).
- For each unit, snapshot parameters and verify its next ordinary connection, gapless Karma
  `/events`, and no Karma `46` rewrite for an hour. Require seven days of gapless relaying for
  all ten units before closing rollout.
- Complete per-unit firmware, IMSI/ICCID, accessory, external module, Simple SMS and format
  profiles. Karma accepts `48` but exposes parameter values rather than command replies; obtain
  those identities after routing or through authorized SMS `INFO`. Do not equate model labels
  with installed hardware capabilities.
- Compare positions, timestamps, speed, odometer, voltages, ignition/engine, satellites and
  network against Karma over a day per unit, then verify seven-day agreement. Confirm that
  discocan ACKs prevent retransmission and that command replies do not make Karma rewrite routing.

## Open engineering work

- **Named-person operator authorization:** the durable six-read queue, expiry/cancellation and
  scoped configuration/snapshot audit are implemented. The verified demo session identifies only
  a Tenant. Introduce named identities and operator roles before production; do not present the
  demo Tenant identity as a named person.
- **Parameter writes:** snapshots with titles and diffs run as background jobs and passed L1 on a
  Tracker and a Scout on 2026-11-03. Single-record eData changes (`live-api/edata-change.js`)
  passed L1 on CB5640XP on 2026-11-04. The admin now exposes guarded `04` and eData workflows with a fresh parameter
  snapshot and exact readback/restoration. Remaining: the same controlled workflow for `46`
  parameter writes. For each write require an exact-target complete baseline, fresh preflight, one scoped change,
  independent whole-set readback and explicit restoration. Never automatically replay an
  ambiguous submission. Restoring an existing definition differs from deleting a new ID;
  check rule/histogram dependencies and never replay a complete Monitor export.
- **Measurement verification:** after configuration readback, require fresh measurement IDs,
  timestamps and plausible values over several expected intervals. Missing/asleep/ignition-off/
  CAN-inactive signals are not proof of a specific failure. Preserve null/zero/absence and
  distinguish sampling, reporting and delivery intervals. Zero-interval readback does not
  establish that measurements stopped.
- **Remaining binary/framing gaps:** identify `$SLB` tag `27` (seen only while parked); handle configuration-session `E0 00` pairs without corrupting the following
  frame. Non-routing replies inside `$SLC` still reach Karma (routing reads are refused).
- **Own telemetry and diagnostics:** Fleet imports discocan events as samples and trips, `419` fault
  records as `DIAGNOSTIC_TROUBLE_CODE` and `411` CAN errors per ADR 0008. Raw `405` observations now have scoped Vehicle history and a chart. Remaining: verify physical
  byte order, signedness and calibration before displaying physical values; decide whether to
  backfill reports before the existing import cursors; verify CB1147TP's real `419` faults through discocan. Establish fault lifecycle/completeness
  before continuous fault-state tracking or notifications; missing telemetry or an empty logger is
  not confirmed ECU clearance.
- **Broader command coverage:** prove each supported family at its permitted test level, including
  result codes and unlock-required `98`. The operator mutation stays limited to its six reads;
  new operations need their own explicit authorization and contract.

| Family              | Remaining verification scope                                                        | Levels                |
| ------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| Reads               | Remaining supported reads and configuration reads outside protected routing/secrets | L1, then L3           |
| Reversible settings | `04`/`46` outside 0049–0054, geo-zones, speed, temperature and clock                | L1, then L3           |
| eData               | Fixed reads followed by verified single-record configuration writes                 | L1, then L3           |
| Vehicle-acting      | Outputs `13`, immobilizer `24`, arm/disarm `25`/`47`, override `57`                 | L2 only               |
| Maintenance         | Reset `99`, logger clear, external firmware `35`, unit OTA                          | L2 after ERM guidance |

## Run without Karma and production deployment

- Implement and prove standalone operation without the Karma upstream, including `95`
  authentication where needed, command delivery and eData replies.
- Before removing Karma backup, run a second discocan endpoint on another host and prove failover
  on L1. Prove the Simple SMS emergency route and write the on-call recovery procedure.
- Run one unit for 30 days without Karma before moving the others.
- Deploy outside the development host: independent gateway/API supervision, database backups and
  restore, raw frame/capture retention, protected internal API, public TCP routing and the
  verified TLS option (`0053=2`). PostgreSQL remains the only containerized infrastructure.

## CB6721TE recovery

Truck CB6721TE, Karma car `16593`, IMEI `862129080268844` (Scout). On 2026-11-04 its eData
parameter set was restored to the ten definitions of the untouched sister truck CB2792TK at 180 s
(IDs 1, 2, 5, 64, 152, 188, 539, 687, 785, 1657; the owner's option A): nine single-record
additions and ID 1 from 30 s to 180 s, each verified by a whole-set readback. Profile 343, the
inert rule `2` and the globals are unchanged.

- Verify fresh `405` reports of all ten IDs about every 180 s with plausible values over a normal
  trip and ignition cycle, compared with CB2792TK, with GPS and events still working.
- If they are missing or implausible, consult the installer before further configuration changes:
  power, CAN/eNet, modules and the proper Monitor/adaptor; back up before restoring. Never use
  factory reset, guessed payloads or the incident commands as a fallback.

## Questions for ERM

These questions are unsent. The [support correspondence and verification register](../discocan/erm-resources/erm-support-diagnostics-protocol-test-server/README.md)
remains the evidence source; do not request already supplied protocol access or Test Server downloads.

### Device sessions, hardware and recovery

1. Supply the Tracker `0182=3` `$SLB`/`$SLC` specification, or confirm equivalent data and support
   for `0182=0`. Explain tag/flag gaps before changing report format on a test Tracker.
2. Should servers confirm `03`/`45` replies inside and outside configuration sessions? Explain
   the observed `E0 00` stream, framing and ACK ownership. Clarify remaining Test Server
   capture/replay/simulation, dual-destination and restoration semantics against the available tool.
3. Map serials 279009–279044 and 292962 to exact hardware/variants, firmware, locks and supported
   capabilities. Identify the EG915U-LA/LC86G note's SKU/board, eight-contact pinout, supply/I/O
   ratings and accessories; establish modem-band and installed CAN/eNet/profile compatibility.
4. Specify supported OTA, rollback/recovery risks and changes through 2.46; full configuration
   export/restore and per-firmware defaults; and `95` authentication/shared-secret provisioning.
5. Define primary-to-backup retry timing and when a unit returns to its primary (CB1147TP moved
   to its backup after a mobile-network change on 2026-11-04, without a gateway restart), logger
   capacity/overwrite when both servers fail, and the recommended Simple SMS emergency route, SIM restrictions and safe 0593 password change.
6. Resolve protocol contradictions: G1/G2 checksum wording/source listing, command `00`, P180
   confirmation examples, E2 diagnostic-code length and model-specific size limits. Explain how
   StarLink Monitor, Simple eData Primitives Monitor and Simple eData Monitor apply to our units.

### eData and faults

1. Supply the hardware/firmware/profile compatibility matrix and extended `412` fields.
2. Resolve Monitor byte 7 export and `302`/`410` label discrepancies; ignition-off processing
   versus CAN-alive reporting; and whether StarLink 2069/2070 are required on these installations.
   CB2792TK and CB9405PE send no `405` with the same ten definitions as the reporting CB1344XH; they
   are the only Scouts with `410` bytes 7 and 18 both `00` (2026-11-04).
3. Correct the `418` P1482 example with a real five-character capture/expected status and the
   `419` SPN table. Real `419` captures support four-byte big-endian SPNs but do not settle
   reserved bits, range or FMI rules.
4. Define `301`/`19` replies, fragmentation/completeness and empty logger versus rejection;
   `154,0` means not acknowledged, not proof of an empty buffer. Does a read trigger a fresh ECU scan?
5. Define automatic snapshots/transitions, debounce, ignition/reconnect behavior and fault removal;
   supply authoritative fault descriptions, distinct from tracker/eData internal diagnostics.
6. Explain globals → parameters → profile ordering for bulk `301`/`01` versus verified
   single-record `301`/`02`, including commit/profile prerequisites and write/readback correlation.

### Karma replacement parity

1. Clarify physical report units, rounding, trip/parking/idle/engine totals, average/night splits,
   project/car zones and DST, day attribution and retrieval bounds for closing transitions.
2. Supply event IDs and `extra_parsed.esafe` maneuver/severity/duration/axis definitions and
   score/weight aggregation; sensor/Fuel/Temperature input IDs, calibration and missing-value rules.
3. Define pagination/order/inclusivity/retention, bulk/rate limits and the recommended bounded query
   for slow dated/decoded eData retrievals; command queue states, delivery/expiry, cancellation,
   idempotency and permissions. Queue acceptance is never device-application proof.
4. Identify supported APIs for accident/camera data, battery health, starter time, temperature,
   drivers/sensors and historical assignment, POI/geofence/routes, notifications, hierarchy,
   first transmission, query-use reports and telemetry definitions/event aliases. Are internal
   `/i/` methods supported/versioned external contracts, or must discocan own those workflows?
5. Identify supported NC2 firmware/hardware/cached-parameter/diagnostic reads without device commands;
   explain CSS/BATC/BATH, parameter namespaces and Statistics units. Supply classic/NC2 role/action
   matrices and confirm web/API account equivalence and source-only firmware/preset/billing scope.

Ask Karma separately whether this account's automatic 0049/0050 rewrite can be disabled.

## Owner decisions and resources

- Approve the production host/deployment arrangement.
- Provide a second host for failover.
- Choose who sends the ERM questions and owns follow-ups; no correspondence is sent by this plan.
- Arrange a person at a parked truck for each L2 test and the CB6721TE installer recovery if needed.
- Decide Tracker text versus binary format only after an L1 test and ERM clarification.

## Registered fleet reference

The ten trucks are registered by today's Fleet work; this table is a routing/recovery reference,
not an open registration task. CB5640XP, CB5636XP and CB6711TE are the test trucks; the other
seven are the rollout scope, all routed except CB9680TE. CB1344XH's complete IMEI came from Karma because
the owner's list truncated it. Missing VINs remain unknown.

| Truck    | Karma car | IMEI            | ERM S/N | Model   | SIM number    | VIN               | Brand  |
| -------- | --------- | --------------- | ------- | ------- | ------------- | ----------------- | ------ |
| CB1344XH | 16592     | 862129080367646 | 292962  | Scout   | +359885235522 | YS2R4X200P5707045 | Scania |
| CB6721TE | 16593     | 862129080268844 | 279043  | Scout   | +359886500179 | XLRTEF5300G401471 | DAF    |
| CB2792TK | 16591     | 862129080269511 | 279042  | Scout   | +359882850311 | XLRTEF5300G408304 | DAF    |
| CB1147TP | 16595     | 862129080367299 | 279040  | Scout   | +359882927935 | XLRTEF5300G421504 | DAF    |
| CB9680TE | 16589     | 862129080332111 | 279009  | Tracker | +359884615021 | XLRTEF5300G402772 | DAF    |
| CB6711TE | 16588     | 862129080319233 | 279037  | Tracker | +359886005518 | XLRTEF5300G401304 | DAF    |
| CB5640XP | 16587     | 862129080366630 | 279038  | Tracker | +359882856252 | YV2RTY0A9RB446824 | Volvo  |
| CB9405PE | 16594     | 862129080340825 | 279041  | Scout   | +359883203752 | —                 | Volvo  |
| CB9369PE | 16586     | 862129080320033 | 279039  | Tracker | +359886001576 | —                 | Volvo  |
| CB5636XP | 16590     | 862129080254620 | 279044  | Scout   | +359886005951 | YV2RTY0A6RB446960 | Volvo  |

## Maintaining this roadmap

Remove tasks when proved and document operator behavior in the
[ERM guide](../discocan/development.md#erm-device-server); vendor facts belong in
[ERM resources](../discocan/erm-resources/README.md). Keep raw evidence private, and do not
replay historical device campaigns merely to tidy documentation.
