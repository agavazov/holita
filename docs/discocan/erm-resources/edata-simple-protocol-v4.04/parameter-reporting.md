# eData parameter reporting reference

Reference edition **2.3**, updated **2026-10-21 (Europe/Sofia)**. Sources are the
[eData Simple 4.04 protocol](content.md), the
[Monitor configuration guide](../simple-edata-monitor-configuration-v1.0/README.md),
the supplied Monitor **9.56** catalog, and observed device responses through
[Karma API v2](../../../archive/karma/karma-api-v2/README.md).

This reference records device configuration procedures and observed responses, including manual
upstream examples. The current discocan workflow uses the
[ERM control center](../../development.md#erm-device-server) for snapshots and controlled changes.
Protocol examples here do not authorize a device write.

## Catalog, configuration and measurements

These are separate kinds of information:

| Information          | What it establishes                                                                          | What it does not establish                                                                |
| -------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Monitor catalog      | Parameter identifiers, source names, categories and profile membership for a package version | Support on the installed module, a complete CAN decoding definition, or a current reading |
| Device configuration | Definitions and reporting intervals returned by the selected device                          | That the requested signal is available or producing measurements                          |
| Karma `/edata`       | Measurements already received, with parameter IDs and message timestamps                     | The complete configuration or a backup from which it can be reconstructed                 |

Importing a catalog into a database does not configure a device. Filtering
`/edata` also does not enable reporting: it selects received records. The separate
Karma `/parameters` endpoint has not been established as an interface to these
eData definitions; the verified route uses `/commands` and device responses in
`/events`.

Catalog versions and installed firmware versions are independent. Parameter IDs
can occur in different catalog categories, and some source rows have inconsistent
decimal/hex identifiers. Preserve their provenance and resolve conflicting IDs
before constructing commands. A display multiplier is not necessarily the
multiplier in a device decoding definition.

## Applicability

The following parameter additions and 30-second reporting were verified on an
installation labelled `StarLink_Scout6` by Karma, with eData profile
**343 / hex 0157**. Monitor 9.56 names that profile **FMS Parameters (250k)** and
includes these IDs in its parameter set. The profile label does not independently
establish the physical CAN bus speed or the attached module's exact model.

| ID  | Hex  | Source description                   |
| --- | ---- | ------------------------------------ |
| 153 | 0099 | Accelerator Pedal Position 1 (%)     |
| 651 | 028B | Engine Percent Load At Current Speed |
| 662 | 0296 | Engine Fuel Rate (L/h)               |

This establishes a working configuration procedure for that profile and
installation, not universal availability or calibration. Other parameters and
profiles require their own configuration and measurement verification.

The [27 October campaign evidence](../erm-support-diagnostics-protocol-test-server/live-verification-2026-10-27.md#actual-periodic-measurements-historical-positive-control)
also correlates four real CB1147TP `405` records for 662 on **26 October,
18:40:00–18:41:30 UTC**, with three 30-second deltas and unchanged source value 0.
The `407` at 18:41:36 is an end-of-trip report, excluded from cadence calculations.
Direct Karma and a successful Gateway read preserve the measurement identities.
This historical positive control is not proof of a new 30→60-second change.

The subsequent [completed real interval test](../erm-support-diagnostics-protocol-test-server/live-verification-2026-10-27.md#completed-live-reporting-and-active-can-fault-control)
on **2026-10-27** did prove that change on **CB1147TP / car 16595 /
device 862129080367299**. Fleet operation
`bab36c8a-d2aa-4ff1-a5c0-d90b75cd3e93` dispatched the one662 30→60 write at
**08:21:47.058 UTC**. Independent complete `401` **7171046524** at **08:21:56**
confirmed the same 14 IDs, all 13 unrelated definitions byte-identical, and only
662's interval field `001E→003C`. Five new raw405 records at
**08:23:00,08:24:00,08:25:00,08:26:00,08:27:00 UTC**, IDs
**7171056491/7171057524/7171059267/7171060544/7171062377**, had source values
**13/16/1/47/1** and four exact **60-second** deltas. Gateway returned matching
identities/times/values. **Final662 remains 60 seconds.**

The same reference records three new CB9680TE 539 raw405 observations at
**08:06:32/08:08:32/08:10:33 UTC**, values **51/53/54**, deltas **120/121s**,
after its previously verified120 setting. A subsequent407 at 08:12:10 was excluded.
This is delayed measurement proof, without another539 write or a continuous-series
claim across the earlier observation gap.

## Reading the current state

Resolve the selected vehicle to a unique Karma `car_id` and verify `device_id`
before sending a command. Registration text is useful for discovery, but is not
the command target. Capture current measurements and their timestamps, then read
the configuration from that same device.

| Read                         | Command string                  | Response                                                                                          |
| ---------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| Parameter definitions        | `30,1,19,0,19,301,0,1,1,0702BC` | `401`, payload `07` followed by parameter definitions                                             |
| Global settings              | `30,1,19,0,19,303,0,1,1,`       | `410`                                                                                             |
| Vehicle profile              | `30,1,19,0,19,301,0,1,1,1F`     | `416`, payload `1F` and a two-byte profile ID                                                     |
| Diagnostics                  | `30,1,19,0,19,306,0,1,1,`       | `411`                                                                                             |
| Hardware/version information | `30,1,19,0,19,308,0,1,1,`       | `412`; extended layouts require firmware-specific interpretation                                  |
| Stored fault logger          | `30,1,19,0,19,301,0,1,1,19`     | `154,0` when the buffer is empty; `154,1` and a `419` snapshot when codes are active (2026-11-11) |

The [diagnostics and fault reference](diagnostics-and-fault-reporting.md) records
the source-level distinction between an explicit stored-fault read and automatic
OBD `413`, FMS `418` and FMI `419` reports, with the unresolved global-setting and
fault-format conflicts. No new diagnostic command was sent during ERM-TEST-01.

These are device requests, even though their purpose is reading. They use
`POST /commands` like a configuration update. In `0702BC`, `02BC` specifies the
maximum message size; it is not a parameter count. The response can require
multiple messages. Check numbering and the final-message indicator, assemble a
complete response, and reject incomplete or conflicting definitions before using
it as a configuration snapshot.

Preserve the full definitions and raw global/profile payloads, together with the
device identity and observation time. A snapshot becomes stale if another
operator changes the device. Re-read and reconcile differences before applying
a change derived from an earlier snapshot.

The documented four-byte prefix of diagnostic response `411` contains the last
communication mask, OBD mask, CAN error flag and ignition state. Communication
mask bit 0 denotes CAN; CAN error `0` means no current reported error; ignition
`0`, `1`, `2` mean off, on, unknown. Do not infer the meaning of trailing extension
bytes from this prefix. Ignition and CAN availability help explain whether live
measurement verification is currently possible.

Ignition off is not a universal measurement prohibition. The controlled
[Monitor export comparison](../erm-support-diagnostics-protocol-test-server/live-verification-2026-10-27.md#morning-recheck-paired-monitor-exports-and-cb1344xh)
shows a separate **Send parameters while ignition off AND CAN alive** option at
global-data byte 24, distinct from ignition-off CAN processing at byte 7. Enabling
this option in a saved export is not proof of source CAN availability or runtime
reporting. Its firmware-specific interaction with processing/sleep still requires
verification; do not send a whole exported command list to test one checkbox.

## Command submission and responses

The observed single-device request to `POST /commands` uses:

- `car_id`: an array containing the selected Karma car ID as a string.
- `message`: the complete command string, without export headings or comments.
- `karma_sid`: the authenticated API session, kept out of saved examples and logs.

The API returns an array of numeric queue IDs. A single queue entry can be read
with `GET /queue/{id}`. Observed responses are objects keyed by the queue ID,
containing `state_id` and `state_desc`; `1` / `transmitted` has been observed.
This is delivery-state evidence, not proof of applied configuration or working
telemetry. Complete queue-state semantics, expiry, cancellation, bulk mapping and
idempotency remain unverified.

Device configuration responses are visible through `GET /events` with the target
`car`, `event_type[]=33` and an appropriate UTC time window. Their `extra` field
contains the device message. Match the target device, request time, response type
and payload. A universal queue-to-device acknowledgment correlation has not been
established. In particular, `19,0,154,1` is not a verified success acknowledgment.

The supplied Monitor 9.56 handles `154,1` by continuing to wait and `154,0` by ending
parameter/rule loading (`Is_Special_Ack_Recieved`, `Is_Special_Nck_Recieved`,
`Process_Recieved_Can_Engine_Parameters` and `Process_Recieved_Can_Engine_Rules`).
Its terminal branch does not replace the existing definitions, so `154,0` alone does not
establish an empty set. DiscoCan preserves this response and reports a read without
configuration when no complete definitions were returned.

If submission times out or its result is lost, first inspect the queue where its
ID is known, subsequent events and a fresh device readback. Do not assume a failed
HTTP exchange means the command was not accepted, or blindly replay a write.

## Adding or changing definitions

Command `301` carries an operation byte followed by the operation's data:

| Payload type       | Effect                                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| `02`               | Add or update the supplied parameter definitions, preserving other definitions |
| `01`               | Delete the existing parameter set, then install the supplied definitions       |
| `10` + two-byte ID | Delete that specific parameter                                                 |

Ordinary parameter additions and interval changes use `02`. It sends complete
definitions, not a patch containing only an ID and interval. For an existing
parameter, preserve all its current fields and change only the intended values.
Changing one reporting interval does not require replacing the vehicle profile,
global settings or rules.

Each definition is **22 bytes**. Offsets below are relative to the definition,
after the operation byte:

| Byte offset | Length | Field                       |
| ----------- | ------ | --------------------------- |
| 0           | 2      | Parameter ID                |
| 2           | 4      | CAN header ID               |
| 6           | 1      | Start bit                   |
| 7           | 1      | Bit count                   |
| 8           | 2      | Multiplier                  |
| 10          | 2      | Divisor                     |
| 12          | 2      | Offset                      |
| 14          | 2      | Filter mask                 |
| 16          | 2      | Filter value                |
| 18          | 1      | Type                        |
| 19          | 1      | Flags                       |
| 20          | 2      | Reporting interval, seconds |

IDs and intervals in the examples use fixed-width hexadecimal with the most
significant byte first. For example, ID `662` becomes `0296`; 30 seconds becomes
`001E`, and 180 seconds becomes `00B4`. For an interval-only update, replace the
last two bytes of the captured definition and prepend operation `02`. Preserve
the other bytes, including flags and device-specific decoding fields. The full
[field semantics](content.md#231-sending-parameter-definitions-to-the-can-engine)
remain defined by the vendor protocol.

The Monitor guide describes zero interval as **not in use** and a limit
of 100 configured parameters. These are source-version constraints, not proof of
every firmware's capacity or zero-interval behavior. A stored definition with
interval zero is not the same observation as an absent definition. Do not assume
the shortest encodable interval is supported or operationally appropriate.

### Monitor 9.56 predefined-parameter construction

The supplied [Monitor 9.56 binary](../../../../resources/discocan/Simple%20eData%20FMS%20Monitor/README.md)
establishes a generic definition builder for its predefined parameter grid. This
was inspected offline through its CLI metadata and method bodies, without running
the executable or communicating with a device. The binary SHA-256 is
`01dd13e50c55fdf84078ce298bde72320d55bee458baa4c0d2a06fca7c0ca1a0`.

| Method token                | Method / RVA                                                                                | Relevant behavior                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x060003C2`                | Parameter constructor, RVA `233596`                                                         | Initializes header, start bit, bit count, offset, filter mask/value, type and flags to zero; multiplier and divisor to one; interval to zero       |
| `0x060003C3`                | `Get_Parameter_From_Row`, RVA `233712`                                                      | Constructs that object and assigns only the grid's name, hexadecimal parameter ID and reporting interval; its GUI interval limit is 65,000 seconds |
| `0x060003C6`                | `Get_Parameter_As_Binary_Array`, RVA `233908`                                               | Serializes exactly 22 bytes in the field order above; multi-byte values use most-significant byte first                                            |
| `0x060003C5` / `0x060003C4` | `Get_Parameter_As_Binary_String` / `Get_Parameter_As_Text_String`, RVAs `274844` / `325836` | Converts those bytes to the command's hexadecimal text representation                                                                              |
| `0x06000440`                | `Prepare_Send_Can_Engine_Parameters_Commands`, RVA `326948`                                 | Uses those serialized definitions; its replace flag selects initial operation `01`, while the additive branch uses `02`                            |

This is direct evidence for the Monitor's generic predefined-ID packet
construction, rather than an extrapolation from a particular fuel-rate example.
It does not define a new CAN decoder or establish which signals the installed
module can measure. For an existing parameter, preserve its captured definition
instead of reconstructing it from these GUI defaults.

For example, the catalog names ID **781 / `030D`** **Battery Voltage (Starlink)**
in all three Monitor categories and both retained workbooks. It belongs to set
`135`, used by profiles `343` and `430`. Using the generic builder with an
operator-selected 60-second interval produces this single 22-byte definition:

```text
030D000000000000000100010000000000000000003C
```

Its additive command contains only operation `02` and that definition:

```text
30,1,19,0,19,301,0,1,1,02030D000000000000000100010000000000000000003C
```

On the documented profile `343` installation, a fresh complete device readback
confirmed the addition of `781` at 60 seconds. Every pre-existing parameter
definition remained byte-for-byte identical, as did the captured global-settings
payload and vehicle profile. Preserve all original definitions in that comparison,
including IDs unknown to the local catalog.

The submitted definition above used multiplier/divisor one. The device returned
this normalized definition, with those two fields zero and interval `003C`:

```text
030D000000000000000000000000000000000000003C
```

Keep the submitted and returned definitions separately. This is observed
normalization for this predefined parameter and installation; it does not justify
ignoring other changed fields or normalizing arbitrary definitions.

The 60-second interval is an operator choice, not a documented voltage default.
Fresh eData measurements were not observed while diagnostics reported ignition
off and no CAN communication bit. Diagnostic extension bytes remain uninterpreted.
The configuration readback therefore confirms the stored definition, not working
voltage measurements or calibration. The catalog name does not establish whether
`781` represents external supply or internal backup-battery voltage; keep that
distinction separate from the observed `vin` and `vbat` tracker fields. Measurement
verification still requires the checks below.

Do not send the Monitor's complete server-command export to perform a single
addition. `Create_All_Serevr_Commands`, token `0x0600047B`, RVA `343544`, passes
the replace flag when building its parameter section and also generates global,
vehicle, reset and other command sections. Construct only the intended additive
`02` message from the inspected definition.

### Predefined fuel-rate example

For the verified profile, this adds ID `662` at 30 seconds:

```text
30,1,19,0,19,301,0,1,1,020296000000000000000100010000000000000000001E
```

The definition uses Monitor defaults: header/start/count zero, multiplier/divisor
one, other fields zero, and interval `001E`. This depends on the module's
predefined-parameter handling. It is not a generic recipe for decoding an
arbitrary catalog ID or CAN signal.

Readback on the verified device normalized multiplier/divisor to zero:

```text
0296000000000000000000000000000000000000001E
```

Keep submitted and returned definitions distinct. Known normalization can be
accounted for explicitly; do not silently ignore other differences or interpret
all-zero decoding fields as sufficient for every device.

### Custom decoding is discarded (2026-11-10)

On CB6711TE (eData ID 19, firmware 6.56, profile 343) a single `02` addition of ID 4000 asked for
engine speed from J1939 EEC1: header `0CF00400`, start bit 24, 16 bits, multiplier/divisor 1/1,
flags `C0` (FMS network, little-endian), 60 s:

```text
0FA00CF0040018100001000100000000000000C0003C
```

The unit answered `01`, but its readback stored only the ID and interval:

```text
0FA0000000000000000000000000000000000000003C
```

The operator tool treated this as a mismatch and deleted the addition; the restore readback matched
the baseline. eData Simple therefore keeps only predefined parameters and drops custom CAN
decoding, as the protocol's general section says. Custom signals would need eData Pro.

**Every variant, 2026-11-11, CB6711TE.** Twelve further single `02` additions (07:07–07:10,
parked) and four Type variants (09:54, driving), each acknowledged by eData (`154,1`), were all
stored as ID + 19 zero bytes + interval `003C`. Both restores deleted the additions, and each
readback matched the baseline of that moment exactly (10 and 59 definitions).

| ID        | Variant                                                                                | Sent definition                                                  |
| --------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 4001      | EEC1 engine speed, flags `40` (little-endian, no FMS bit)                              | `0FA10CF004001810000100010000000000000040003C`                   |
| 4002      | No flags                                                                               | `0FA20CF004001810000100010000000000000000003C`                   |
| 4003      | Header with bit 31 set (`8CF00400`)                                                    | `0FA38CF0040018100001000100000000000000C0003C`                   |
| 4004      | 11-bit header `00000123`                                                               | `0FA4000001230008000100010000000000000040003C`                   |
| 4005      | Type `04` (accumulated time)                                                           | `0FA50CF0040018100001000100000000000004C0003C`                   |
| 4006      | Multiplier 8, offset 5                                                                 | `0FA60CF0040018100008000100050000000000C0003C`                   |
| 4007      | CCVS byte with filter mask `00FF`, value `0003`                                        | `0FA718FEF100080800010001000000FF000300C0003C`                   |
| 3         | Catalog ID outside profile 343 (Privates fuel litres)                                  | `000318FEFC0008080001000100000000000000C0003C`                   |
| 653       | Profile 343 ID with custom decoding                                                    | `028D0CF0040018100001000100000000000000C0003C`                   |
| 32769     | ID `8001`                                                                              | `80010CF0040018100001000100000000000000C0003C`                   |
| 61441     | ID `F001`                                                                              | `F0010CF0040018100001000100000000000000C0003C`                   |
| 4008      | Flags `F0` (FMS, little-endian, dashboard, signed)                                     | `0FA80CF0040018100001000100000000000000F0003C`                   |
| 4011–4014 | Types `01`, `02`, `03`, `05` (counter, difference, absolute difference, type 5), 09:54 | `0FAB0CF0040018100001000100000000000001C0003C` … `0FAE…05C0003C` |

No ID range, header form, type or flag keeps a decoding field. Bulk replacement (`01`) was not
tried: it would replace every definition, and the gateway accepts only single `02` additions and
`10` deletions. Three other sources agree:

- The protocol's general section: Simple has predefined protocols; additional protocols or
  customization need the eData Pro firmware.
- ERM's eData accessory page ([A16](../starlink-online-protocol/authenticated/pages/A16.md)):
  Simple eData is preloaded with CAN configuration; Professional eData has customizable CAN
  configuration.
- The module identifies itself as the Simple FMS variant: `53` `19` (external device version)
  answers `6.56,eData Fms` on CB6711TE.

So eData Simple reads only the predefined parameters of its profile (1,262 IDs for profile 343)
that the truck's bus actually carries. Custom CAN signals and raw CAN capture need eData Pro.
Simple's other features work once the gateway allows them (extended on 2026-11-11 12:04). On
CB6711TE, parked:

- **Rules:** rule 80 (`04` `0050 0F01 0F02 03E8 07 07021400010E00`, ID 1 > 0) was answered `154,1`
  and read back byte-identical through `0802BC` (`402`). The Monitor guide allows 100 rules.
  CB6721TE already holds rule 2 from its installation, read on 2026-11-04 as
  `0800020000000000010807021500011009C4`, without event IDs.
- **Histograms:** histogram 1 (`06` `0001 0001 00000000 00000BB8 06 003C 00`: ID 1, 0–3000 in 6
  columns, every 60 s) was answered `154,1` and read back byte-identical through `0902BC` (`403`).
- **Driver ID:** `23` answered `423` `230000000003FF70010000000000000000` (driver 1
  `0000000003FF7001`, no driver 2).
- **Module counters:** `318`, `320` and `322` (odometer, total time, total fuel) answered reports
  `318`, `320` and `322` with `00000000`; the counters are unused.

Before the additions, `0802BC` and `0902BC` returned no `402`/`403`: CB6711TE held no rules or
histograms. Both test entries were deleted again at 17:25 (`11`/`12`, `154,1`, empty readbacks).
Their reports (`404`, `406`, `408`) need the engine running and were not observed. The FMS
parameter scan (`312`), CAN ID sniffer (`313`), current values (`324`) and VIN (`1C`) are allowed
but need the engine on with the truck stationary, and were not run.

The StarLink tracker's own "CAN Parameters" feature
([F40](../starlink-online-protocol/authenticated/pages/F40.md)) decodes up to 12 user-defined CAN
variables, including raw 8-byte data, but only from the tracker's own CAN pins on its "CAN" hardware
variant. Its eData data source (`3488`=1, needs `0674` = eData ID) mirrors an existing eData
parameter instead. CB1147TP (Scout) reads `0674`="0", `0400` (CAN baud rate) empty and `3488`="1",
and its `#CV1#`/`#CR1#` dynamic values are empty. CB6711TE (Tracker) reads the same (`0674`="0",
`0400` and `3072` empty, `3073`="0", `3488`="1"; `#CV1#`/`#CR1#` empty with the engine on), so that
feature is not configured on our installations. Enabling it would need further `46` changes and the
tracker's own CAN wiring; it was not tested.

### Definition capacity (2026-11-11)

eData Simple 6.56 stores at most **120** parameter definitions. On CB6711TE, 137 additions on top
of 10 definitions left exactly 120 stored (read back as 8 fragments of 15). eData answered `154,0`
to the additions without room, as section 2.2 describes. Deleting one stored addition gave a
readback of 119 without exposing a further ID, so the cap is in storage, not in the readback.
CB1147TP and CB9369PE behaved the same. The gateway's result code `01` only confirms that the
tracker accepted the `30` command; eData's verdict is the separate `154,x` event, and a readback
remains the proof.

In `405` reports, an ID without fresh data can appear with an empty value. Count a parameter as
delivered only when it carries values.

### Delivered parameters per truck (2026-11-11)

Each truck received up to 120 definitions at 60 s: its baseline, the 86 profile-343 candidates
below, and FMS telltales. It was observed with the ignition on, then restored to its baseline plus
the useful delivered parameters at 180 s, with exact readback. Values are raw `405` hex as the
range seen in the window; "–" means defined but never a value; an empty cell means not tested on
that truck. Windows (Sofia): CB6711TE driving 07:38–08:05, CB1147TP engine on 08:17–08:20, CB6721TE
driving 08:44–08:59. All three are DAF. CB2792TK (DAF) delivered nothing; see the
[diagnostics evidence](diagnostics-and-fault-reporting.md#fleet-evidence-2026-11-11).

|   ID | Parameter (catalog)                                              | CB6711TE              | CB1147TP      | CB6721TE              |
| ---: | ---------------------------------------------------------------- | --------------------- | ------------- | --------------------- |
|    1 | Engine Speed (RPM)                                               | `028A`–`05A0`         | `00`–`0228`   | `022B`–`038C`         |
|    2 | Wheel Based Vehicle Speed (kph)                                  | `00`–`57`             | `00`          | `01`–`0F`             |
|   23 | Brake Switch                                                     | `00`–`01`             | `00`          | `00`–`01`             |
|   64 | Engine Total Hours Of Operation                                  | `2300`–`2301`         | `207B`        | `2227`                |
|  152 | High Resolution Total Vehicle Distance (meters)                  | `20468320`–`2046E027` | `1D55CEE6`    | `1F45C067`–`1F45C1B1` |
|  153 | Accelerator Pedal Position 1 (%)                                 | `00`–`64`             | `00`          | `00`–`17`             |
|  164 | Transmission Current Gear                                        | `7D`–`0089`           | `7D`          | `0080`–`0083`         |
|  188 | Engine Oil Temperature (c)                                       | `17`–`66`             | `0E`–`15`     | `25`–`29`             |
|  189 | Parking Brake Switch                                             | `00`–`01`             | `01`          | `00`                  |
|  539 | Engine Coolant Temperature (c)                                   | `1E`–`60`             | `15`–`1B`     | `2B`–`30`             |
|  579 | Barometric pressure                                              | `62`–`65`             | `64`          | `63`                  |
|  630 | Drivers Demand Engine - Percent Torque (%)                       | `00`–`FF68`           | `00`          | `00`–`FF0E`           |
|  651 | Engine Percent Load At Current Speed                             | `00`–`63`             | `00`–`1A`     | `0D`–`16`             |
|  656 | Cruise Control Active                                            | `00`                  | `00`          | `00`                  |
|  660 | Cruise Set Speed                                                 | `00`                  | `00`          | `00`                  |
|  662 | Engine Fuel Rate (L/h)                                           | `00`–`38`             | `00`–`03`     | `02`–`06`             |
|  672 | Axle Weight (kg)                                                 | `231C`–`2B3E`         | `1C7C`–`1F2E` | `1DDE`–`23A6`         |
|  687 | Engine Total Fuel Used - J1939 (L)                               | `00020F57`–`00020F63` | `0001E3EC`    | `0002046F`            |
|  688 | Service Distance (km)                                            | `0004E6FB`            | `0004E6FB`    | `000339A0`            |
|  694 | Aftertreatment 1 Diesel Exhaust Fluid Tank 1 Level (%)           | `63`                  | `40`          | `63`                  |
|  695 | Actual Retarder - Percent Torque (%)                             | `00`–`BB`             | `00`          | `00`                  |
|  696 | Service Brake Circuit 1 Air Pressure (kPa)                       | `0368`–`04A8`         | `0218`–`0388` | `0368`–`0440`         |
|  697 | Service Brake Circuit 2 Air Pressure (kPa)                       | `0368`–`04A8`         | `0218`–`0388` | `0368`–`0440`         |
|  708 | Aftertreatment 1 Diesel Exhaust Fluid Tank 1 Temperatue          | `0D`–`15`             | `0F`          | `0B`–`0C`             |
|  718 | ABS/EBS Amber Warning Signal (Powered Vehicle)                   | `00`                  | `00`          | `00`                  |
|  781 | Battery Voltage (Starlink)                                       | `1D`                  | `00`          | `00`                  |
|  785 | Fuel Level (%)                                                   | `29`–`2D`             | `26`          | `4A`                  |
|  838 | Cruise control states                                            | `00`                  | `00`          | `00`                  |
| 1135 | Tachograph Handling Information                                  | `00`                  | `00`          | `00`                  |
| 1136 | Vehicle Speed (tachograph)                                       | `00`–`62`             | `00`          | `01`–`0F`             |
| 1288 | Aftertreatment 1 Diesel Exhaust Fluid Tank 1 Low Level Indicator | `00`                  | `00`          | `00`                  |
| 1296 | Ambient Air Temperature                                          | `04`–`06`             | `07`–`08`     | `04`                  |
| 1298 | Actual Engine - Percent Torque                                   | `07`–`0D`             | `07`–`08`     | `08`                  |
| 1301 | Transmission Selected Gear                                       | `7D`–`0089`           | `7D`          | `7F`–`0083`           |
| 1322 | Engine Torque Mode                                               | `00`–`0E`             |               | `00`–`01`             |
| 1324 | Seconds                                                          | `00`–`3B`             |               | `1F`–`34`             |
| 1417 | Engine Instantaneous Fuel Economy                                | `00`–`06`             | `00`          | `00`–`02`             |
| 1419 | Brake Pedal Position                                             | `00`–`09`             | `00`          | `00`–`06`             |
| 1435 | Vehicle motion (tacho)                                           | `00`–`01`             | `00`          | `01`                  |
| 1436 | Driver 1 working state (tacho)                                   | `00`–`03`             | `00`          | `03`                  |
| 1437 | Driver 2 working state (tacho)                                   | `00`–`01`             | `00`          | `01`                  |
| 1438 | Vehicle Overspeed (tacho)                                        | `00`                  | `00`          | `00`                  |
| 1439 | Driver card, driver 1 (tacho)                                    | `01`                  | `01`          | `01`                  |
| 1441 | Driver 1 Time Related States (tacho)                             | `00`                  | `00`          | `00`                  |
| 1444 | Tachograph performance                                           | `00`                  | `00`          | `00`                  |
| 1445 | System event (tacho)                                             | `00`                  | `00`          | `00`                  |
| 1447 | Tachograph vehicle speed                                         | `00`–`62`             | `00`          | `01`–`0F`             |
| 1548 | Engine Trip Fuel                                                 | `00`                  | `00`          | `00`                  |
| 1551 | Engine Average Fuel Economy                                      | `03`                  | `03`          | `03`                  |
| 1608 | Total Power Takeoff Hours                                        | `00`                  | `00`          | `00`                  |
| 1657 | High Resolution Engine Total Fuel Used                           | `00020F57`–`00020F63` | `0001E3EC`    | `0002046F`            |
| 1889 | Telltale - Cooling air conditioning                              | `00`                  |               | `00`                  |
| 1890 | Telltale - High beam, main beam                                  | `00`                  |               | `00`                  |
| 1891 | Telltale - Low beam, dipped beam                                 | `00`                  |               | `00`                  |
| 1892 | Telltale - Turn signals                                          | `00`                  |               | `00`                  |
| 1893 | Telltale - Hazard warning                                        | `00`                  |               | `00`                  |
| 1894 | Telltale - Provision for the disabled or handicapped persons     | `00`                  |               | `00`                  |
| 1895 | Telltale - Parking Brake                                         | `00`–`03`             |               | `00`                  |
| 1896 | Telltale - Brake failure/brake system malfunction                | `00`                  |               | `00`                  |
| 1897 | Telltale - Hatch open                                            | `00`                  |               | `00`                  |
| 1898 | Telltale - Fuel level                                            | `00`                  |               | `00`                  |
| 1899 | Telltale - Engine coolant temperature                            | `00`                  |               | `00`                  |
| 1900 | Telltale - Battery charging condition                            | `00`                  |               | `00`                  |
| 1901 | Telltale - Engine oil                                            | `00`                  |               | `00`                  |
| 1902 | Telltale - Position lights,side lights                           | `00`                  |               | `00`                  |
| 1903 | Telltale - Front fog light                                       | `00`                  |               | `00`                  |
| 2152 | FMS Diagnostics Supported                                        | `00`                  | `00`          | `00`                  |
| 2153 | FMS Requests Supported                                           | `00`                  | `00`          | `00`                  |
| 2154 | FMS SW-version supported                                         | `30333030`            | `30333030`    | `30333030`            |
| 2236 | Engine Trip Fuel L (fms)                                         | `06`–`045C`           | `00`–`0C`     | `00`–`0B`             |

Defined on these trucks but never delivered a value: 5, 65, 159, 168, 666, 667, 668, 679, 680, 682, 683, 689, 692, 700, 767, 805, 1124, 1125, 1126, 1127, 1128, 1129, 1130, 1131, 1132, 1269, 1271, 1338, 1415, 1443, 1517, 1518, 1609, 1610, 1701, 1766, 1904, 1905, 1906, 1907, 1908, 1909, 1910, 1911, 1912, 1913, 1914, 1915, 1916, 1917, 1918, 1919, 1920, 1921, 1922, 1923, 1924, 1925, 1926, 1927, 1928, 1929, 1930, 1931, 1932, 1933, 1934, 1935, 1936, 1937, 1938, 1939, 2125, 2259, 2260, 2263, 2269. These include engine oil
pressure and level, coolant level, battery potential, intake manifold and boost pressure, the
DM1 fields 1124–1132 (even while CB6711TE reported active codes as `419`), and the Volvo-specific
IDs. DAF trucks deliver only telltale block 1889–1903; 1904–1939 never carried a value. All three
report FMS identity 2152=`00`, 2153=`00`, 2154=`30333030` ("0300").

Kept at 180 s after the test: CB6711TE and CB6721TE have 59 definitions (10 baseline + 49), and
CB1147TP has 59 (14 baseline + 45, telltales 1889–1903 not yet confirmed on it). The 49 are 23,
153, 164, 189, 579, 630, 651, 656, 660, 662, 672, 688, 694, 695, 696, 697, 708, 718, 781, 1288,
1296, 1298, 1301, 1417, 1419, 1435–1439, 1441, 1447, 1551, 2236 and 1889–1903; CB1147TP already had
153, 651, 662 and 781 in its baseline. Delivered values left out as noise: 838, 1135, 1136
(duplicate of 1447), 1322, 1324, 1444, 1445, 1548, 1608 and 2152–2154.

#### Volvo CB9369PE (2026-11-11)

With its engine idling from 12:41 to 12:49, CB9369PE delivered 34 of its 120 definitions: 1, 2, 23,
64, 153, 189, 539, 651, 656, 662, 672 (`20F9`), 688, 694 (`32`), 695, 696 and 697
(`03E8`–`04A0`), 781, 838, 1135, 1136, 1296 (`0B`), 1298, 1417, 1419, 1435–1439, 1441, 1444, 1445,
1447 and 2236. Nothing arrived from the FMS identity (2152–2154), any telltale (including 1900,
which arrived on 2026-11-10), the DM1 fields 1124–1132, oil pressure or level, or the
Volvo-specific IDs 2125, 2259, 2260, 2263 and 2269. Its own fuel level, total fuel and distance IDs
were also silent, consistent with its intermittent CAN. The window is too short to tell whether
Volvo's FMS interface omits the identity and telltales, or whether this module missed them. It
keeps 41 definitions: 15 baseline plus 24 delivered parameters and telltales 1896 and 1910, all
at 180 s.

#### Status per truck (2026-11-11)

| Truck              | Make   | Result                                                                                                                                    | Definitions now |
| ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| CB6711TE           | DAF    | 70 parameters delivered; first `419`/`415`; Process DTCs on since 07:13                                                                   | 59 (49 kept)    |
| CB1147TP           | DAF    | 53 parameters delivered in a 3-minute engine run                                                                                          | 59 (45 kept)    |
| CB6721TE           | DAF    | 70 parameters delivered; Process DTCs on since 08:44                                                                                      | 59 (49 kept)    |
| CB2792TK           | DAF    | No value from any of 120 definitions; eData report stream stopped at 07:45 and did not return after the exact restore; installation issue | 10 (baseline)   |
| CB9369PE           | Volvo  | 34 parameters delivered while idling 12:41–12:49; no FMS identity, telltale, DM1 field or Volvo-specific ID                               | 41 (26 kept)    |
| CB9405PE           | Volvo  | No CAN data (`417` only); not tested                                                                                                      | baseline        |
| CB5636XP, CB5640XP | Volvo  | Not connected since 2026-11-10 ~11:00; not tested                                                                                         | baseline        |
| CB1344XH           | Scania | On Karma's backup since 2026-11-10; not tested                                                                                            | baseline        |
| CB9680TE           | DAF    | Never connected to discocan; not tested                                                                                                   | unknown         |

### Engine-load and accelerator-position example

Multiple definitions can share one type `02` payload. This example concatenates
ID `651` and ID `153`, each at 30 seconds:

```text
30,1,19,0,19,301,0,1,1,02028B000000000000000100010000000000000000001E0099000000000000000100010000000000000000001E
```

The corresponding observed stored definitions are:

```text
028B000000000000000000000000000000000000001E
0099000000000000000000000000000000000000001E
```

Confirm each affected parameter separately after a multi-definition update; a
single queue response does not establish that all definitions were applied.

## Verifying a change

Keep these conclusions separate:

| Evidence                                                              | Supported conclusion                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------- |
| Queue ID returned                                                     | The API supplied a command reference                  |
| Queue reports `transmitted`                                           | The queue reports transmission                        |
| Fresh, complete device readback matches the intended definitions      | The observed device configuration contains the change |
| New measurements arrive over consecutive expected reporting intervals | Reporting works under the observed vehicle conditions |

Read all parameter definitions again and compare them with the captured state.
Check the intended IDs and intervals, preserve every unrelated definition, and
compare global settings and the vehicle profile. This comparison is stronger
than merely finding the new ID in a partial response.

For measurement verification, use `GET /edata` with the target `car`,
`date_type=utc`, `showdesc=1` and a time window beginning after submission.
`parameter_id[]=662` selects fuel rate; repeated `parameter_id[]=651` and
`parameter_id[]=153` select engine load and pedal position. Omit the parameter
filter when checking whether existing signals continue to arrive.

Require fresh message IDs and timestamps, actual values and several consecutive
reporting intervals. Allow for the original parameters' own intervals when
checking continuity. Zero is a valid reported value and is distinct from null or
absence. Names and unit labels are source metadata; they do not independently
establish calibration. Fuel rate `662` is distinct from cumulative fuel-used
parameters `687` and `1657`.

## Missing data and restoration

An accepted definition may produce no readings because ignition or CAN is
inactive, the device is asleep/unreachable, or the parameter/profile/firmware
combination does not provide the signal. Without further evidence, missing data
does not distinguish these cases. A device can answer diagnostics with ignition
off while CAN-based measurements remain unavailable.

Tracker voltage fields `vin` and `vbat` are a
[separate source of data](../../../archive/karma/karma-api-v2/data-models.md#additional-upstream-voltage-fields).
They can be requested through `/location` or `/events` without adding an eData
definition. They do not prove that a CAN parameter is working. Re-reading cached
Karma data also does not force a new physical measurement.

For a newly added, previously absent parameter, a scoped rollback can delete just
that ID with operation `10`. For example, ID `662` uses
`30,1,19,0,19,301,0,1,1,100296`; the corresponding payloads for `651` and `153`
are `10028B` and `100099`. These examples follow the documented deletion layout;
their use is not required after a successful addition. Check any rule or histogram
dependencies before removing a parameter.

For an edited pre-existing parameter, restore its captured full definition using
`02` rather than deleting it. Verify configuration and ongoing measurements after
restoration as well. A post-change snapshot or measurement history is not a
known-good pre-change configuration. Without such a snapshot, exact recovery may
require a verified installer/provider export or on-site diagnosis. Factory reset
and replaying an unverified full export are not scoped parameter restoration.
