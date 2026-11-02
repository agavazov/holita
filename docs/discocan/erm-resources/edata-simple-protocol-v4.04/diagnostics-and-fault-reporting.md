# eData diagnostics and fault reporting

Current evidence: **2026-10-29**. Use this reference for the eData CAN Engine
payload inside StarLink messages. The separate [authenticated StarLink archive](../starlink-online-protocol/README.md)
covers tracker framing, commands, results, events, networking and tools. Neither
protocol number is a Karma API event ID.

The [29 October support analysis](../erm-support-diagnostics-protocol-test-server/reply-2026-10-29.md)
and [independent device campaign](../erm-support-diagnostics-protocol-test-server/live-verification-2026-10-29.md)
supersede the earlier absence of a positive fault capture. Actual Karma `419`
records from CB1147TP are now available. An API record proves receipt of the
reported faults; it does not by itself establish the vehicle's current complete
ECU state or the success of an on-demand scan.

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

Status `01` means added and `02` deleted in the reported fault logger. A deleted
entry does not establish ECU clearance or repair. A missing record does not mean
healthy. Match car/device, source message ID, UTC source time, report and raw bytes;
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
manual proofs. Holita has no product global-setting/DTC mutation yet.

Controlled paired exports also locate ignition-off/CAN-alive reporting at byte
**24**. The independent byte **7** discrepancy remains: Monitor 9.56 parses
ignition-off CAN processing there but serializes ignition-off debounce. The PDF
`302`/`410` tables disagree around Process FMS DTCs/keep-alive and CANBUS #2.
Do not build a whole-global configuration from those conflicting tables.

ERM's new screenshot confirms the supplied globals show DTC enabled. Its attached
bulk configuration procedure is **globals `302` → positive special ACK → all
parameter definitions `301`/`01` → positive ACK → vehicle `301`/`1E0157`**.
This must not be conflated with the separately verified single-definition
`301`/`02` interval edit. ERM's claim that all three steps are required needs this
operation distinction; the existing narrow editor must not silently gain a bulk
profile/global write. See the [command-file analysis](../erm-support-diagnostics-protocol-test-server/reply-2026-10-29.md).

The 2018 [Karma appendix](../karma-guide-appendix-v1.4.2/content.md#pdf-page-9)
mentions StarLink parameters 2069/2070 for its DTC application. Their necessity
for the present eData/profile/firmware combination has not been established.
Current remaining work is in the [Karma backlog](../../../todo/karma-api-v2.md#questions-requiring-erm-clarification).
