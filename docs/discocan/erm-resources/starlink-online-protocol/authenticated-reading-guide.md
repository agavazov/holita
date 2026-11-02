# Reading the authenticated StarLink reference

The [authenticated archive](authenticated/README.md) was retrieved on
2026-10-29. The page graph and technical-table fidelity refresh are complete. The exact
protobuf schema and all available illustrations are retained; three image URLs
return HTTP 404. These notes distinguish the relevant protocol layers and source
inconsistencies; they do not claim that a vehicle or device has passed a live test.
The vendor's pages, including their examples and errors, remain available
individually with their source URL and update metadata.

## Vehicle trouble codes and unit diagnostics

| Reference                                                                                                                   | What it actually establishes                                                                                                                                                                                             | What it does not establish                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [E70 — Diagnostics trouble codes](authenticated/pages/E70.md)                                                               | The OBD2 feature can report vehicle DTCs when it scans at vehicle start. Event modes are 1 confirmed, 2 current, 3 permanent; each following code is five characters. The vendor's example contains `P0351` and `C2222`. | That any connected truck uses that OBD2 feature, produced those codes, or supports a remote scan command. These are documentation examples. |
| [F11 — OBD2](authenticated/pages/F11.md)                                                                                    | Hardware, firmware and OBD2 feature requirements in the vendor reference.                                                                                                                                                | That a particular eData/FMS/J1939 installation satisfies these requirements.                                                                |
| [P2070 — DTC event configuration](authenticated/pages/P2070.md)                                                             | Event enablement and acknowledgment bitmask for event 70.                                                                                                                                                                | Permission or need to change any existing truck configuration.                                                                              |
| [P1350 — DTC event description](authenticated/pages/P1350.md)                                                               | The configurable description for the DTC event.                                                                                                                                                                          | A vehicle DTC dictionary or vehicle-specific DTC decoding.                                                                                  |
| [E2 — Diagnostic report](authenticated/pages/E2.md)                                                                         | StarLink unit diagnostics: modem/network/GNSS/logger/power/reset/SIM conditions, with levels and 35 codes in the current page.                                                                                           | Vehicle ECU DTCs. A unit diagnostic is not evidence of a vehicle fault-code read.                                                           |
| [P11 — Diagnostic report filter](authenticated/pages/P11.md), [P114 — Diagnostic report event](authenticated/pages/P114.md) | Unit diagnostic filtering and event configuration.                                                                                                                                                                       | Enabling eData CAN-engine fault reads.                                                                                                      |

For eData CAN-engine commands and responses, consult the separate
[eData Simple 4.04 diagnostic reference](../edata-simple-protocol-v4.04/diagnostics-and-fault-reporting.md)
and the [ERM correspondence](../erm-support-diagnostics-protocol-test-server/README.md).
StarLink event 70 and eData's fault-reading commands are different routes. E2 also labels its diagnostic-code field as one character while its own code
catalog includes codes 10–35; the archive preserves this source length
inconsistency. The
presence of an event definition in the portal proves a documented capability,
not a successful fault read from the trucks in this account.

## Encapsulation and the two acknowledgment layers

[Command 30 — External device message](authenticated/pages/C30.md) transports
external-device payloads. Its fields include an external-device ID, data format
and message; formats are raw/binary `0`, hexadecimal `1`, and base64 `4` from
firmware 2.30. The external-device ID is part of the message, not the truck's
StarLink IMEI, Karma car ID or Karma device ID.

The StarLink confirmation for command 30 is [command 02](authenticated/pages/C2.md):
result `01` means the message was received by the external device, while result
`18` means the StarLink could not send it to that device. This transport result is
separate from the external device's own application reply. In particular,
eData's `154` Special ACK and CAN-engine `301` command belong to the eData inner
protocol; the portal does not define them as StarLink commands `154` or `301`.
An outer transport acknowledgment must not be reported as successful vehicle
DTC retrieval.

C30 also contains a sample inconsistency: its raw/hex examples represent `Test`,
but its displayed base64 `dGVzdA==` represents lowercase `test`. E33 describes
external device 3 in one example while the shown payload starts with device ID
`2`. Both source examples are retained without silently correcting their bytes.

[Event 33 — External device](authenticated/pages/E33.md) documents payloads from
external devices, including format and message. It differs from direct command
30 responses. Preserve which outer message carried the payload before decoding
its inner protocol.

## Event confirmation and correlation

[G16 — Message confirmation](authenticated/pages/G16.md) says that events whose
configuration bit 1 requests acknowledgment are retransmitted if confirmation
is not received. [Command 02](authenticated/pages/C2.md) is used in both
directions: the device confirms a server command, and the server confirms events
or other messages when required. TCP delivery alone is not the documented
application acknowledgment.

[Parameter 180 — Confirmation reference](authenticated/pages/P180.md) controls
whether the confirmation correlation field uses the original reference number
or original message type. Command 02's prose and examples should be read
carefully: the page labels examples for both modes, but its mode-1 examples
still display reference-like values. The archive preserves that source
inconsistency instead of inventing a corrected exchange.

## Framing and checksum discrepancies

[G1 — Message structure](authenticated/pages/G1.md) still has a source update date
of 2020-05-17 and retains the discrepancy already visible in the supplied
[historical screenshot transcription](message-structure.md): its table describes
checksum summation as starting at the unit ID. The companion
[G2 — Check-sum calculation](authenticated/pages/G2.md) explicitly sums the
unescaped string beginning with `SRV`, before the protocol `$` header, then takes
modulo 256. G2's worked string is
`SRV0004D2,04,53,0049,myserver.com`, with sum 2408 and result `68`.

G2 calculates the checksum **before** doubling payload `$` and `*` characters.
The companion [G9 — Binary data](authenticated/pages/G9.md) describes binary
replacement. The relevant message must be unescaped at the correct layer before
validation; do not silently sum doubled wire characters as if they were the
original payload.

G2's JavaScript listing has source defects: the asterisk condition calls
`msg.charAt('i')` with a string literal instead of the loop index, and the footer
assignment includes a visibly malformed parameter placeholder. Treat the
listing as a preserved source example requiring correction, not drop-in
production code. Its preceding prose and worked checksum remain separately
inspectable.

G1 describes 1–9-digit reference numbers, unit serial/soft serial in six hex
digits or 15-digit IMEI, server wildcard `FFFFFF`, and incoming message limits of
1024 bytes for most configurations or 512 on limited-memory devices. Device
outgoing messages can reach approximately 3 KB. Its command-range wording also
mixes `01–99` and `00–99`, while the [command catalog](authenticated/pages/C0.md)
also lists hardware-specific Shadow extensions above 99, including 101, 105,
106 and 125. Do not treat the older two-digit wording as a complete description
of every hardware extension. These are source statements with model/configuration
qualifications, not universal observed limits on the installed devices.

## Test Server and binary protocol sources

[G11 — StarLink Test Server](authenticated/pages/G11.md) documents a local TCP/UDP
server requiring an incoming port forwarded to the computer. The
[G7 — Tools](authenticated/pages/G7.md) page lists Test Server version **1.26.6.1,
June 2026** and provides the vendor ZIP. The specific distribution is retained
in the archive's [asset inventory](authenticated/inventory.json); it was not
executed as part of documentation extraction.

A working local listener or a replay of a vendor example is different from a
truck reaching that listener. A live result must separately identify the actual
truck/device, command, time, raw response and interpretation. Forwarding,
secondary-server settings and prerequisites must come from the matching device
configuration and vendor references, not from the existence of a downloadable
server tool.

[G12 — Binary protocol](authenticated/pages/G12.md) links the manufacturer's
`onyx.proto` schema. [F73 — EC2 data transmission](authenticated/pages/F73.md)
uses the same schema for `mEC_Message`. The exact schema has now been recovered and is retained as a source asset
with its SHA-256 in the inventory. A [Markdown rendering of the full schema](authenticated/pages/onyx-protobuf-schema.md)
preserves all fields and source comments.

The schema defines `StarLink_Message` identity/acknowledgment context and repeated
`mMessage` records. `mConfirmation` has a result code and distinct correlation
fields; `mEventReport` carries event/time/extra-data fields. `mEC_Message` contains
repeated `mECOBDData` measurements for the EngineCAL/device-105 route. It does
**not** define a typed eData `419` or J1939 SPN/FMI fault decoder; that still needs
the separate eData contract. Schema comments about units/clocks apply to these
messages and must not be transferred automatically to Karma API fields.

Binary-source discrepancies are preserved: G12 compares binary `$SLP` to
"regular `$SLV`", while G1 documents unit text messages as `$SLU`. In G12's
worked protobuf table, key `0x38` is labeled field 8 even though its field number
is 7 (`0x38 >> 3`), and the `0x48` row repeats `0x38` in its explanation. F73
mentions 12 configured measurement parameters, while the retrieved
`mECOBDData` schema contains 13 optional fields including `FuelRate`; applicability
must be matched to the device/firmware version instead of inventing a single
universal parameter count.

## Dates and applicability

The authenticated home page was updated on 2026-10-18 and lists firmware
**2.46 (October 2026)**. This supersedes the old home screenshot as evidence of
current portal news. It does not make every page a 2.46 specification or prove
the firmware installed on a truck. Per-page update dates and version markers
are retained. Generated event examples include the portal's retrieval-time
sample timestamps; they are synthetic documentation data, not vehicle logs.
