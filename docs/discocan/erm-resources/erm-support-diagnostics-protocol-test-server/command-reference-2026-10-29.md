# Supplied FMS command export: 29 October 2026

[Follow-up analysis and four images](reply-2026-10-29.md) ·
[Reference status](README.md) ·
[Byte-for-byte original command attachment](source/2026-10-29-fms-rental-sofia-60-second-commands.txt).

This is a transcription and analysis of the attached **Commands file FMS Rental
Sofia 60 seconds time interval.txt**, containing **29 commands**, in original
order. The export is a vendor-provided configuration recipe, not a record that
holita executed every command. Read, configuration replacement, deletion, clear,
reset and counter writes are separate operations. The reference does not submit
any of them. The existing product exposes only its documented fixed operations.

## Three-command configuration procedure described by ERM

1. Send **SET GLOBAL SETTINGS** (`302`) once and wait for the positive device
   acknowledgement `19,0,154,1`. ERM's identified ACK was `7179129747`, source
   `2026-10-29 10:18:44`, car 16595 / device 862129080367299.
2. Send **SET PARAMETERS SETTINGS** (`301`, payload starts `01`) once, then
   wait for its positive device acknowledgement before continuing.
3. Send **SET VEHICLE** (`301`, payload `1E0157`) last. The reply does not
   include this last command's ACK or a complete final readback.

ERM says all three are required to apply changes made using this export. This
sequence replaces the whole parameter set and selects profile 343. It must not be
silently substituted for holita's separately verified `02` operation that changes
one captured definition and preserves the other definitions. The applicability
of the three-command rule to that operation remains an explicit vendor question.

The **queue** state `transmitted` is not the **device** ACK; neither alone verifies
all settings. A full export should be assessed against fresh `410`/`401`/`416`
baselines. After any authorized change, independent complete readback establishes
configuration; genuinely new `405` records establish actual reporting cadence.
The export's global bytes differ from the accepted screenshot and its operation
`01` deliberately removes the previous definitions before installing these 14.

## Complete command list

Every command below preserves the attachment's comma-separated form, including
trailing commas for empty payloads. The `Message # 1 From 1 Messages` prefix is
Monitor export metadata, not part of the SET PARAMETERS SETTINGS command.

|   # | Export label                    | Exact command                                                                                                               | Scope                                                                                  |
| --: | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
|   1 | SET GLOBAL SETTINGS             | `30,1,19,0,19,302,0,1,1,03E903E8010208020101000101010003130101000303010000000000000000000000000000000000000000000000000000` | Writes all globals; 49-byte supplied payload. See byte differences below.              |
|   2 | SET PARAMETERS SETTINGS         | [309-byte payload below](#parameter-replacement-payload)                                                                    | Bulk replacement: operation `01` plus fourteen complete 22-byte definitions, all 60 s. |
|   3 | SET VEHICLE                     | `30,1,19,0,19,301,0,1,1,1E0157`                                                                                             | Selects profile `0x0157` = **343**; not an isolated interval patch.                    |
|   4 | GET GLOBAL SETTINGS             | `30,1,19,0,19,303,0,1,1,`                                                                                                   | Reads globals (`410`).                                                                 |
|   5 | GET PARAMETERS SETTINGS         | `30,1,19,0,19,301,0,1,1,0703E8`                                                                                             | Reads parameter definitions (`401`); payload `07`, maximum size `03E8` = 1000 bytes.   |
|   6 | GET RULES                       | `30,1,19,0,19,301,0,1,1,0803E8`                                                                                             | Reads rules; payload `08`, maximum size 1000 bytes.                                    |
|   7 | DELETE RULES                    | `30,1,19,0,19,301,0,1,1,0B`                                                                                                 | Deletes all rules; write, not a read.                                                  |
|   8 | GET HISTOGRAMS                  | `30,1,19,0,19,301,0,1,1,0903E8`                                                                                             | Reads histograms; payload `09`, maximum size 1000 bytes.                               |
|   9 | DELETE HISTOGRAMS               | `30,1,19,0,19,301,0,1,1,0C`                                                                                                 | Deletes all histograms; write, not a read.                                             |
|  10 | GET VEHICLE                     | `30,1,19,0,19,301,0,1,1,1F`                                                                                                 | Reads vehicle profile (`416`).                                                         |
|  11 | RESET                           | `30,1,19,0,19,305,0,1,1,`                                                                                                   | Resets the unit; operational write, not a diagnostic read.                             |
|  12 | GET UNIT DIAGNOSTIC             | `30,1,19,0,19,306,0,1,1,`                                                                                                   | Reads unit communication/ignition diagnostics (`411`).                                 |
|  13 | GET VERSION                     | `30,1,19,0,19,308,0,1,1,`                                                                                                   | Reads version/hardware (`412`); extensions need their own contract.                    |
|  14 | GET DTC                         | `30,1,19,0,19,301,0,1,1,19`                                                                                                 | Reads stored CAN Engine fault logger; no ECU-clear side effect documented.             |
|  15 | CLEAR UNIT DTC                  | `30,1,19,0,19,301,0,1,1,1A`                                                                                                 | Clears the unit fault logger; destructive, distinct from reading.                      |
|  16 | CLEAR VEHICLE DTC               | `30,1,19,0,19,301,0,1,1,1B`                                                                                                 | Clears vehicle faults; ECU-changing operation, distinct from logger clear.             |
|  17 | READ VIN NUMBER                 | `30,1,19,0,19,301,0,1,1,1C`                                                                                                 | Reads VIN; this command is supplied, no successful VIN read is claimed here.           |
|  18 | READ TACHO DRIVER ID            | `30,1,19,0,19,301,0,1,1,23`                                                                                                 | Reads tachograph driver ID; availability is installation-specific.                     |
|  19 | SCAN ALL FMS PARAMETERS COMMAND | `30,1,19,0,19,312,0,1,1,`                                                                                                   | Scans FMS parameters; not used merely to establish stored fault evidence.              |
|  20 | CAN IDX SNIFFER COMMAND         | `30,1,19,0,19,313,0,1,1,`                                                                                                   | CAN ID sniffer; operational behavior/load and response contract not established here.  |
|  21 | MINUS COMMAND                   | `30,1,19,0,19,316,0,1,1,05`                                                                                                 | Minus command with supplied value `05`; do not infer undocumented semantics.           |
|  22 | SET ODOMETER                    | `30,1,19,0,19,317,0,1,1,00000000`                                                                                           | Sets odometer with four zero bytes; would alter accounting state if supported.         |
|  23 | GET ODOMETER                    | `30,1,19,0,19,318,0,1,1,`                                                                                                   | Reads odometer.                                                                        |
|  24 | SET TOTAL TIME                  | `30,1,19,0,19,319,0,1,1,00000000`                                                                                           | Sets total time with four zero bytes; would alter accounting state if supported.       |
|  25 | GET TOTAL TIME                  | `30,1,19,0,19,320,0,1,1,`                                                                                                   | Reads total time.                                                                      |
|  26 | SET TOTAL FUEL                  | `30,1,19,0,19,321,0,1,1,00000000`                                                                                           | Sets total fuel with four zero bytes; would alter accounting state if supported.       |
|  27 | GET TOTAL FUEL                  | `30,1,19,0,19,322,0,1,1,`                                                                                                   | Reads total fuel.                                                                      |
|  28 | GET CURRENT VALUES              | `30,1,19,0,19,324,0,1,1,`                                                                                                   | Reads current values; report family/completeness remains installation-specific.        |
|  29 | SET MINUS OPTION COMMAND        | `30,1,19,0,19,325,0,1,1,00`                                                                                                 | Sets Minus option to supplied byte `00`; write, not a read.                            |

## Global settings payload

The supplied full write is:

```text
30,1,19,0,19,302,0,1,1,03E903E8010208020101000101010003130101000303010000000000000000000000000000000000000000000000000000
```

Its global data is **49 bytes**, excluding the outer command fields. Offsets
below are zero-based from the configuration-ID high byte, not from outer framing.
The command begins configuration ID `03E9` = **1001**, maximum message size
`03E8` = **1000**, and includes DTC byte 18=`01`, byte 24=`00`.

Compared with the [new image's accepted global response](reply-2026-10-29.md#image-1-global-readback-interpreted-in-monitor)
and the previously preserved 49-byte DTC-enabled readback, exactly four bytes differ:

| Offset | Screenshot / prior readback | New supplied write | Existing source field association                                                                                                                         |
| -----: | --------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
|      7 | `00`                        | `02`               | Ignition-off CAN processing in the parser; known Monitor serializer instead emits ignition-off debounce here. Canonical mapping/value remains unresolved. |
|     11 | `00`                        | `01`               | CANBUS #1 silent-mode field in the published global layout.                                                                                               |
|     12 | `00`                        | `01`               | CANBUS #2 silent-mode field in the published global layout.                                                                                               |
|     13 | `00`                        | `01`               | OBD Unit processing field in the published global layout.                                                                                                 |

All other 45 bytes match that comparison, including the enabled DTC byte. Published
field names are version-qualified source associations; they do not resolve the
known read/write-table discrepancies. The additional silent-mode/OBD bytes and
byte 7 mismatch are why this export is not a byte-preserving DTC-only update.
No runtime effect of those extra four changes is established by the attachment.

Full offset/value inventory of the supplied global data:

```text
00:03 01:E9 02:03 03:E8 04:01 05:02 06:08 07:02 08:01 09:01 10:00 11:01 12:01 13:01 14:00 15:03 16:13 17:01 18:01 19:00 20:03 21:03 22:01 23:00 24:00 25:00 26:00 27:00 28:00 29:00 30:00 31:00 32:00 33:00 34:00 35:00 36:00 37:00 38:00 39:00 40:00 41:00 42:00 43:00 44:00 45:00 46:00 47:00 48:00
```

## Parameter replacement payload

The exact command is:

```text
30,1,19,0,19,301,0,1,1,010099000000000000000100010000000000000000003C030D000000000000000100010000000000000000003C021B000000000000000100010000000000000000003C0296000000000000000100010000000000000000003C00BC000000000000000100010000000000000000003C028B000000000000000100010000000000000000003C0001000000000000000100010000000000000000003C02AF000000000000000100010000000000000000003C0040000000000000000100010000000000000000003C0311000000000000000100010000000000000000003C0679000000000000000100010000000000000000003C0098000000000000000100010000000000000000003C0005000000000000000100010000000000000000003C0002000000000000000100010000000000000000003C
```

Its payload is **309 bytes**: operation `01` plus **14 × 22** definition bytes.
Each row has its parameter ID in bytes 0–1, zero CAN header/start/length/filter/
offset/type/flag fields as supplied, multiplier 1/divisor 1, and interval `003C`
(**60 seconds**) in bytes 20–21. This is source content, not a fresh device readback.
The definition-field layout remains in the [authoritative parameter reference](../edata-simple-protocol-v4.04/parameter-reporting.md#adding-or-changing-definitions).

| Decimal ID | Hex ID | Complete 22-byte definition                    | Interval |
| ---------: | ------ | ---------------------------------------------- | -------: |
|        153 | `0099` | `0099000000000000000100010000000000000000003C` |     60 s |
|        781 | `030D` | `030D000000000000000100010000000000000000003C` |     60 s |
|        539 | `021B` | `021B000000000000000100010000000000000000003C` |     60 s |
|        662 | `0296` | `0296000000000000000100010000000000000000003C` |     60 s |
|        188 | `00BC` | `00BC000000000000000100010000000000000000003C` |     60 s |
|        651 | `028B` | `028B000000000000000100010000000000000000003C` |     60 s |
|          1 | `0001` | `0001000000000000000100010000000000000000003C` |     60 s |
|        687 | `02AF` | `02AF000000000000000100010000000000000000003C` |     60 s |
|         64 | `0040` | `0040000000000000000100010000000000000000003C` |     60 s |
|        785 | `0311` | `0311000000000000000100010000000000000000003C` |     60 s |
|       1657 | `0679` | `0679000000000000000100010000000000000000003C` |     60 s |
|        152 | `0098` | `0098000000000000000100010000000000000000003C` |     60 s |
|          5 | `0005` | `0005000000000000000100010000000000000000003C` |     60 s |
|          2 | `0002` | `0002000000000000000100010000000000000000003C` |     60 s |

The screenshot and export have the same 14 IDs in the same order. Only the
screenshot supplies the human-readable parameter names; those are transcribed in
the [image analysis](reply-2026-10-29.md#image-3-all-visible-parameter-intervals).
A 1000-byte maximum fragment size (`03E8`) is not a 1000-parameter request. The
product's established `0702BC` requests 700-byte fragments; these are two different
maximum sizes for the same parameter-loading operation, not different IDs.

## Vehicle profile payload and other command boundaries

`1E0157` consists of operation `1E` and two-byte profile **0157 = 343**. The
Monitor screenshot labels its selected profile **FMS Parameters (250k)**. That is
not independent evidence of physical wiring/baud or current installed profile.
A future full-export verification must establish what profile selection does to
existing globals/parameters/rules rather than assume it is harmless finalization.

The stored-fault request `301`/`19`, unit-logger clear `301`/`1A` and vehicle-ECU
clear `301`/`1B` are three separate commands. A test of reading faults needs the
first; deleting evidence or clearing a vehicle ECU does not prove a read.
Likewise RESET, DELETE RULES, DELETE HISTOGRAMS and zero-valued odometer/time/fuel
writes are not substitutes for a communication diagnostic or stored-fault read.

Outer fields such as `30,1,19,0,19,...,0,1,1` are the supplied server-command
representation. This attachment does not define raw StarLink frame boundaries,
transport/checksum/session/authentication or direct receiver acknowledgements;
those belong to the separately acquired current StarLink protocol.
