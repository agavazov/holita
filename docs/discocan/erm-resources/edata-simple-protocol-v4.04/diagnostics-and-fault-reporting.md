# eData diagnostics and fault reporting

Current evidence: **2026-11-11**. Use this reference for the eData CAN Engine
payload inside StarLink messages. The separate [authenticated StarLink archive](../starlink-online-protocol/README.md)
covers tracker framing, commands, results, events, networking and tools. Neither
protocol number is a Karma API event ID.

The [29 October support analysis](../erm-support-diagnostics-protocol-test-server/reply-2026-10-29.md)
and [independent device campaign](../erm-support-diagnostics-protocol-test-server/live-verification-2026-10-29.md)
supersede the earlier absence of a positive fault capture. Actual Karma `419`
records from CB1147TP are now available. An API record proves receipt of the
reported faults; it does not by itself establish the vehicle's current complete
ECU state or the success of an on-demand scan. The [1 November R&D reply](../erm-support-diagnostics-protocol-test-server/reply-2026-11-01.md)
confirms the `419` layout, describes the fault lifecycle and names every globals byte.

## Reading stored fault codes

Section **2.3.16**, physical [PDF page 12](content.md#pdf-page-12), documents
reading faults stored in the **CAN Engine fault logger**:

```text
30,1,19,0,19,301,0,1,1,19
```

`301` selects a CAN Engine operation; data `19` selects the logger read. This is
separate from automatic fault reports after Process DTCs is enabled. It does not
promise a fresh scan of every vehicle ECU. Data `1A` clears the module logger;
`1B` clears vehicle faults. Neither is a read or needed to demonstrate acquisition.

Submit the fixed command through Karma `POST /commands` with `car_id` as an array
and server-side `karma_sid`. Inspect `/queue/{id}` separately from actual `/events`
records. A queue's `transmitted` state does not prove eData acceptance. In the
29 October reply ERM identifies event `33`, extra **`19,0,154,1`** as positive
special ACK, and **`19,0,154,0` as command not acknowledged**. The old Monitor
fault-loader's contextual "no codes in buffer" display is not adequate proof of
an empty logger. Preserve a negative reply as a negative reply.

Other documented reads, with full examples in
[parameter reporting](parameter-reporting.md#reading-the-current-state):

| Request          | Expected report | Scope                     |
| ---------------- | --------------- | ------------------------- |
| `306`            | `411`           | Diagnostic snapshot       |
| `308`            | `412`           | Software/hardware version |
| `303`            | `410`           | Complete globals          |
| `301` / `1F`     | `416`           | Selected vehicle profile  |
| `301` / `0702BC` | `401`           | Parameter definitions     |

PDF examples contain wrapper and table inconsistencies. The installed reply,
version and complete baseline remain necessary for configuration changes.

## Report families and interpretation

| Report | Definition                     | Supported interpretation                                                                                           | Remaining limit                                                                                               |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `411`  | Section 3.11, physical page 24 | First four bytes: communication mask (bit 0 CAN, bit 1 J1708, bit 2 OBD), OBD mask, CAN-error flag, ignition 0/1/2 | Preserve trailing extension bytes; not a tracker error catalogue                                              |
| `412`  | Section 3.12, pages 24–25      | Basic software/hardware version fields                                                                             | Extended hardware/type/firmware applicability needs a matching vendor definition                              |
| `413`  | Section 3.13, page 25          | Type `19`, repeated two-byte OBD code plus status                                                                  | Real installed OBD capture and lifecycle remain unverified                                                    |
| `417`  | Section 3.17                   | No CAN messages for 500 ms while ignition is on                                                                    | Reports the condition; does not identify wiring/profile cause or prove it persists now                        |
| `418`  | Section 3.18, page 27          | Type `20`, five character bytes plus status in Monitor 9.56                                                        | Printed P1482 sample conflicts with data; real labelled capture still needed                                  |
| `419`  | Section 3.19, pages 27–28      | Type `21`, repeated four-byte big-endian SPN, one-byte FMI, one-byte status; real records corroborate this layout  | Printed one-byte SPN table is inconsistent; reserved-bit rules and a universal model matrix remain unresolved |

Status `01` means added and `02` deleted in the reported fault logger. ERM R&D says
eData adds a code when it first sees the code on the CAN bus and removes it after
more than one minute without it. A deleted entry therefore means the vehicle
stopped broadcasting the code; it does not establish ECU clearance or repair. A
missing record does not mean healthy: eData learns codes only from CAN traffic it
actually receives. Match car/device, source message ID, UTC source time, report and raw bytes;
retain fault transitions separately from any claimed current state.

### Real FMI/SPN record

ERM supplied this CB1147TP / car `16595` / device `862129080367299` record; the
29 October campaign independently retrieved the same ID `7177124308` from Karma:

```text
19,0,419,0,1,1,1001,21000010F30701000004DF0B01
```

After type `21`, two complete six-byte records decode as follows:

| SPN bytes  | SPN decimal | FMI | Status      |
| ---------- | ----------: | --: | ----------- |
| `000010F3` |        4339 |   7 | `01`, added |
| `000004DF` |        1247 |  11 | `01`, added |

This resolves the practical acquisition and byte-layout question for this source
record. It does not supply an authoritative manufacturer fault-description
catalogue, prove a fresh command response or validate removed/current-state rules.

### Internally consistent OBD example

The PDF's `413` example is a **documented example**, not live truck evidence:

```text
19,0,413,0,1,1,1001,19111101622202B33301
```

Two-bit P/C/B/U prefix, two-bit first digit and remaining three hexadecimal digits
produce `1111` → `P1111`/added, `6222` → `C2222`/removed and `B333` → `B3333`/added.
This agrees with the printed codes. Do not substitute it for `418`'s five-character
encoding or assume that an FMS installation also supports OBD.

## Process DTCs and configuration scope

The [27 October campaign](../erm-support-diagnostics-protocol-test-server/live-verification-2026-10-27.md)
proved a one-byte DTC enablement on CB1344XH and CB1147TP using a fresh full
49-byte `410`, one `302` write and independent whole-global readback. Offset
**18**, counting from the configuration-ID high byte and excluding outer framing,
changed `00→01`; all other **48 bytes** matched. These are installation-specific
manual proofs. DiscoCan's controlled eData change workflow now writes globals the
same way, with exact readback ([development guide](../../development.md)).

Controlled paired exports also locate ignition-off/CAN-alive reporting at byte
**24**. ERM's [1 November field table](../erm-support-diagnostics-protocol-test-server/reply-2026-11-01.md#global-settings-302--410)
resolves the byte **7** discrepancy: byte 5 is the ignition-off debounce and byte 7 is
ignition-off CAN processing. Use that table, not the conflicting PDF `302`/`410` tables.
Whole-global writes still use the exact readback with only the intended bytes changed.

ERM's new screenshot confirms the supplied globals show DTC enabled. Its attached
bulk configuration procedure is **globals `302` → positive special ACK → all
parameter definitions `301`/`01` → positive ACK → vehicle `301`/`1E0157`**.
This must not be conflated with the separately verified single-definition
`301`/`02` interval edit. ERM's claim that all three steps are required needs this
operation distinction; the existing narrow editor must not silently gain a bulk
profile/global write. See the [command-file analysis](../erm-support-diagnostics-protocol-test-server/reply-2026-10-29.md).

The 2018 [Karma appendix](../../../archive/karma/karma-guide-appendix-v1.4.2/content.md#pdf-page-9)
mentions StarLink parameters 2069/2070 for its DTC application. Their necessity
for the present eData/profile/firmware combination has not been established.
Current remaining work is in the [ERM roadmap](../../../todo/erm-roadmap.md#questions-for-erm).

## Fleet evidence (2026-11-10)

- **GET DTC (`301`/`19`) answered `154,0` until 2026-11-10.** Each reply was event `33` with
  `19,0,154,0`, on 9 trucks from 2026-10-29 to 2026-11-10, with ignition on and off:
  - 5 replies through Karma;
  - 9 replies through discocan.

  Other `301` reads on the same units are acknowledged (`0702BC` → `401`, `1F` → `416`).
  2026-11-11 showed that `154,0` means an empty fault buffer (see below). CB1147TP's read on
  2026-11-06 came before its codes of 2026-11-07, not while they were active.

- **Automatic reporting works when eData receives CAN data.** CB1147TP (DAF, Process DTCs on)
  sent 12 `419` reports between 2026-11-07 and 2026-11-09, with the added/removed lifecycle above.
- **CB9405PE and CB9369PE (Volvo) receive no CAN data.** Fleet holds no eData measurements for
  either truck, and neither has ever sent a `405`. Both repeatedly send `417` (CAN silent with
  ignition on): CB9405PE 40 times in 7 days, CB9369PE 13 times. CB9405PE's globals, profile 343
  and parameter definitions match those of CB2792TK and CB1344XH, which do report CAN data.
  Process DTCs is on for CB9405PE since 2026-11-05 and for CB9369PE since 2026-11-10. No fault
  can reach DiscoCan until their CAN connection works. Varying `405` values and the absence of `417`
  are the reliable CAN evidence. CB9369PE later delivered live values while `411` still read
  `00000101`, so the `411` communication mask and CAN-error flag alone do not prove the CAN state.
- **CB9369PE ignition test (2026-11-10, 10:03–10:07 UTC).** Engine running: `48` gave `IGN=1;ENG=1`
  at 29.5 V. `56` shows the eData accessory (ID 19, firmware 6.56). The unit answered profile 343 and
  11 definitions (`154,1`). `411` twice gave `00000001…`: **no CAN communication, no CAN error**,
  ignition on. GET DTC was answered `154,0` with the engine running. Until 2026-11-07 05:01 UTC,
  every ignition-on was followed 18 s later by a `417`; no `417` has arrived since, although CAN is
  still absent. No command reached the unit in between.
- No Volvo has sent a `419` so far. CB5636XP (Volvo) has reported CAN data with Process DTCs on
  since 2026-11-04 without a `419`. This alone does not show whether Volvo's FMS interface
  forwards fault codes.

## Fleet evidence (2026-11-11)

- **Process DTCs finds faults within minutes.** CB6711TE (DAF) had Process DTCs off. It was
  enabled at 07:14 Sofia (globals byte 18, record `6f0a9bf7`, exact readback). The truck's first
  `419` came at 07:31:57, right after ignition on: `21000004DF0B0100000E880F01`, that is SPN 1247
  FMI 11 and SPN 3720 FMI 15 (J1939: aftertreatment 1 DPF ash load), both added.
- **`415` freeze-frame.** Seven seconds later the same truck sent the first real `415` (ermEvent
  69735, 07:32:04). Globals byte 22 (`Send_Can_Engine_Params_When_Fault_Code_Occures`, `01` on all
  trucks) enables it. The layout follows section 3.15: type `1D`, then per parameter the ID
  (2 bytes), type (1 byte, `00` in every record), value size (1 byte: 1, 2 or 4) and the last value
  received. It held 65 of the 120 defined parameters, for example coolant `12` (18), AdBlue level
  `63` (99), axle weight `22E6` (8,934), both brake circuits `0208` (520) and parking brake `01`.
  Parameters without data are left out, and no other fragment followed.
- **GET DTC works: `154,0` means the fault buffer is empty.** With the two codes active, CB6711TE
  answered GET DTC at 07:36:32 with `154,1` and a `419` repeating both codes as added (status 01).
  This happened with `OBD_Unit` (byte 13) temporarily set to 1 and again at 07:38:09 after byte 13
  was restored to 0 (records `8f8b1028` and `c646374f`, exact readback). At the same minute
  CB1147TP, CB9369PE and CB2792TK, which had no active codes, answered `154,0`. All 38 earlier reads
  (2026-11-03 to 2026-11-11 06:32) got `154,0`, and none was sent while the truck had an active code:
  CB1147TP's codes of 2026-11-07 were all reported removed by 2026-11-09 17:16, and its reads were
  on 2026-11-04, 11-06, 11-10 and 11-11. This matches the Monitor's "no codes in buffer" message.
  So GET DTC returns the current buffer, not a stored history or a fresh ECU scan, and it needs
  Process DTCs on and live CAN. Data variants of `19` were not tried: the gateway accepts only `19`.
  Fleet's scheduled read at 12:00 confirmed it independently: CB6711TE answered `154,1` with the
  same two codes although its engine had been off since 11:44, while CB1147TP, CB2792TK, CB6721TE
  and CB9405PE answered `154,0`. The buffer therefore survives ignition off; no code was reported
  removed during the day.
- **FMS identity.** Profile 343 parameters 2152 (FMS diagnostics supported), 2153 (requests
  supported) and 2154 (FMS software version) read `00`, `00` and `30333030` ("0300") on CB6711TE.
  The DAF FMS interface still delivers DM1-based faults to eData.
