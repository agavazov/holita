# Prove full control of the fleet's StarLink units

Goal: holita serves every fleet unit itself and can show evidence for each function the units
actually have: routing, data, errors and commands. Where a function cannot be tested safely, ERM
answers in writing instead. No truck may lose its connection to a server at any point.

This plan orders the work and sets the rules. Engineering tasks for the receiver stay in the
[routing backlog](erm-tcp-receiver-and-test-device-routing.md), and eData questions stay in the
[Karma backlog](karma-api-v2.md#questions-requiring-erm-clarification). The vendor reference is the
[StarLink protocol archive](../discocan/erm-resources/starlink-online-protocol/README.md): 67 commands,
25 result codes, 94 events, 60 features, 1,397 system and 218 dynamic parameters, Simple SMS and
firmware versions up to 2.46.

## Starting point (2026-11-03)

- CB5640XP (Tracker) and CB5636XP (Scout) use holita as their primary server, with Karma as their
  backup server; holita relays every frame to Karma.
- Proven through holita on both models: moving a unit with Karma's `98` and `45`/`46`, and the mirror
  relay. Scout text events decode automatically. Tracker `$SLB` frames are decoded by hand only.
- Proven through Karma only: parameter reads (`03`), eData commands (`30`), `419` fault records
  (CB1147TP) and the Fleet configuration operations.
- Implemented but never used on a unit: primary-mode confirmations and the internal command API
  (`03`/`45`, `05`, and `04`/`46` for 0049–0054).
- The fleet has 6 Scout and 4 Tracker units. Both routed units report the same `0177` event layout.
  The Tracker reports `0182=3` and sends binary; the Scout has `0182` unset and sends text. In the
  29 October campaign five units answered eData commands and CB1147TP sent eData fault records; the
  other four had not received the commands.

## Safety rules

- A unit always keeps a working way back. Its backup server (0051/0052) stays Karma until holita runs
  without Karma, and no command changes the primary and the backup server together.
- Before any write, take that unit's parameter snapshot. Change one unit at a time, read every write
  back, and restore the snapshot value on a mismatch.
- Never read 0049–0052 through Karma for a unit routed to holita: Karma then writes its own server
  back. A tool talking to a unit confirms every reply, so the unit does not resend it to Karma.
- Firmware update, reset, logger clearing, outputs and immobilizer, unit lock (0059/0060),
  authentication (`95`), TLS (0053), APN and the Simple SMS password are tried on a bench unit first.
  On a truck they need a person at the truck and the owner's approval for that test.
- Snapshots contain secrets (for example 0593 and lock codes). Store them like credentials and never
  print or commit them.
- Every test is recorded in the git-ignored `.references/erm-relay/JOURNAL.md` with its frames and
  captures.

## Test levels

| Level | Where                                      | Used for                                                              |
| ----- | ------------------------------------------ | --------------------------------------------------------------------- |
| L0    | Captures, the fake unit, ERM's Test Server | Parsers, tools and replays of real sessions                           |
| L1    | Bench units: one Scout and one Tracker     | Every risky function, firmware and format changes                     |
| L2    | A parked truck with a person present       | Outputs, immobilizer, ignition, CAN and other vehicle-wired functions |
| L3    | Trucks in service, Karma as backup         | Reads and reversible changes only                                     |

## Phase 0: inventory and configuration backup

- [ ] Read each unit's identity and formats: firmware `#VER#` (command `48`; first check that Karma
      accepts it), IMSI/ICCID (0063/0064), `0182`, `0177`, the accessory list (`56`), external
      device versions (`53`) and Simple SMS (0592). Use Karma for units still on Karma, and holita
      for routed units.
- [ ] Snapshot every system parameter of each unit with `45` batches in a configuration session,
      confirming every reply. Prove the reader on L0 and L1 first.
- [ ] Build a profile per unit: ERM hardware entry, firmware, variants, accessories and formats. Mark
      functions the hardware lacks as not applicable once ERM confirms it.
- Done when all 10 units have a profile and a stored snapshot.

## Phase 1: route every unit through holita

- [ ] Run configuration sessions on a second public port, for example 11501, so erm-server keeps
      serving routed units while a unit is moved. `98` then names that port, and route-unit still
      writes 11500 into 0049/0050. This needs a second forward at the public address.
- [ ] If Phase 0 finds different `0177` layouts, make the event structure per unit instead of the
      global `ERM_EVENT_STRUCTURE`.
- [ ] Route the Scouts first (CB1147TP, CB1344XH, CB2792TK, CB9405PE, then CB6721TE after its
      [eData recovery](erm-edata-recovery-cb6721te.md)), then the Trackers (CB6711TE, CB9680TE,
      CB9369PE). Move one unit a day. Check its next ordinary connection, gapless Karma `/events` and
      that Karma sends no `46` for an hour.
- Done when all 10 units relay through holita for 7 days without gaps in Karma.

## Phase 2: read all data in holita

- [ ] Choose the Tracker format: set `0182=0` on the bench Tracker and compare its text with its
      binary, then on one fleet Tracker while Karma keeps decoding it. If that fails, write the
      `$SLB`/`$SLC` decoder from ERM's specification.
- [ ] Compare each unit's decoded events with Karma for a day: position, times, speed, odometer,
      voltages, ignition and engine, satellites and network.
- [ ] Map every event ID in the fleet's Karma history to the 94 documented events, and decode each
      one that occurs.
- [ ] Decode eData payloads (`401`, `402`, `411`, `413`, `417`, `418`, `419`) from holita's own frames
      with Fleet's existing interpretation.
- Done when holita's data equals Karma's for 7 days on every unit.

## Phase 3: send every command from holita

- [ ] Enable primary mode as in
      [Verify and enable primary mode](erm-tcp-receiver-and-test-device-routing.md#verify-and-enable-primary-mode).
- [ ] Prove the command families in this order, each on L1 before L2 or L3:

| Family              | Commands                                                                     | Levels       |
| ------------------- | ---------------------------------------------------------------------------- | ------------ |
| Reads               | `03`, `45`, `48`, `05`, `07`, `12`, `16`, `53`, `56`, `61` and config reads  | L1, L3       |
| Reversible settings | `04`/`46` outside 0049–0054, geo-zones, speed limit, temperature, clock      | L1, L3       |
| eData               | `30` fixed reads, then the writes Fleet already verifies                     | L1, L3       |
| Vehicle-acting      | outputs `13`, immobilizer `24`, arm/disarm `25`/`47`, override `57`          | L1, L2       |
| Unit maintenance    | reset `99`, logger clear, external device firmware `35`, unit firmware (OTA) | L1, then ERM |

- [ ] Record and show every confirmation result code, including "unit unlock is needed" (`98`).
- Done when each family the units have works from holita on L1 and at its highest allowed level.

## Phase 4: errors and unit health

- [ ] Unit errors and alarms: diagnostic report (event 2), backup battery low (11), battery
      disconnected or reconnected (9/10), jamming (42/43, 90/91), removal (76), SIM lost or detected
      (94/95), and the reset and buffer-full reasons.
- [ ] Vehicle faults from holita's frames: eData `419` (SPN/FMI), tracker DTC event 70 and service
      needed (89). Show the same CB1147TP faults that Karma shows.
- [ ] Connection health per unit: last connection, gaps, resends, signal and network type, and an
      alert when a unit stops reporting.
- Done when holita raises the alert for a silent unit and lists faults from its own data.

## Phase 5: run without Karma

- [ ] Complete [Replace Karma](erm-tcp-receiver-and-test-device-routing.md#replace-karma).
- [ ] Before removing Karma as a backup, run a second holita endpoint on another host and test the
      failover to it on L1.
- [ ] Test the Simple SMS emergency route on L1 and write the on-call procedure.
- [ ] Run one unit for 30 days without Karma, then move the others.

## Questions for ERM

1. Our Tracker units report `0182=3`, which the portal does not list (it has `0` text and `4`
   protobuf `$SLP`). Please send the specification of the resulting `$SLB` frames and `$SLC`
   containers, or confirm that `0182=0` is fully supported on these units and sends the same data.
2. During a configuration-server session, our server confirmed a Scout's `45` reply with
   `02,<ref>,<unit ref>,01`. The unit then sent `E0 00` byte pairs before its `46` result, and about
   1.8 KB/s of them until the session closed. Is this expected? Should a server confirm `03`/`45`
   replies, inside and outside configuration sessions?
3. For our serial numbers (279009–279044, 292962), which hardware entry and variants does each unit
   have, which firmware runs on it, and is any unit locked (0059/0060)?
4. What is the supported way to update these units' firmware (StarLink Firmware OTA Server)? What
   are the risks, how is a failed update rolled back, and what changed up to 2.46?
5. Is there a supported way to export and restore a unit's full configuration, and to read each
   firmware's default values?
6. Do our units require server authentication (`95`)? How do we obtain or set the shared secret for
   our own server?
7. How long does a unit retry its primary server before it uses the secondary? How does its logger
   behave when both are unreachable (capacity, overwriting)?
8. What emergency procedure do you recommend with Simple SMS? Does it depend on the SIM type, and
   how is the password (0593) changed safely?

Ask Karma separately whether its rewrite of 0049/0050 can be disabled for this account.

## Owner decisions and resources

- Bench units: one spare Scout and one spare Tracker with a SIM, a 12/24 V supply and a GNSS antenna.
- A second public port forward for configuration sessions (Phase 1).
- Who sends the ERM questions, and a contact for follow-ups.
- A person available at a parked truck for the L2 tests, booked per test.
- The Tracker format choice after the bench test: `0182=0` or a decoder.

## Documentation

When a function is proven, document it where operators look: the
[ERM device server](../discocan/development.md#erm-device-server) and
[moving a unit](../discocan/development.md#moving-a-unit-between-karma-and-holita) sections, and
the [ERM resources](../discocan/erm-resources/README.md) for vendor facts. Then remove its task
here. Raw evidence stays in the git-ignored journal and captures.
