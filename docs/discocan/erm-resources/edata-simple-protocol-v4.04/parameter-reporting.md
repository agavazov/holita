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

| Read                         | Command string                  | Response                                                                           |
| ---------------------------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| Parameter definitions        | `30,1,19,0,19,301,0,1,1,0702BC` | `401`, payload `07` followed by parameter definitions                              |
| Global settings              | `30,1,19,0,19,303,0,1,1,`       | `410`                                                                              |
| Vehicle profile              | `30,1,19,0,19,301,0,1,1,1F`     | `416`, payload `1F` and a two-byte profile ID                                      |
| Diagnostics                  | `30,1,19,0,19,306,0,1,1,`       | `411`                                                                              |
| Hardware/version information | `30,1,19,0,19,308,0,1,1,`       | `412`; extended layouts require firmware-specific interpretation                   |
| Stored fault logger          | `30,1,19,0,19,301,0,1,1,19`     | Fault-logger read documented; actual reply family/correlation require verification |

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
