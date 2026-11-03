# StarLink Tracker frame formats observed on the fleet

The fleet's StarLink Tracker units report protocol format `0182=3`, which the
[protocol archive](starlink-online-protocol/authenticated/pages/P182.md) does not list: it documents
`0` (text, the default) and `4` (protobuf `$SLP`). Scout units leave `0182` unset and send text.
This page records what was decoded from captures on 2026-11-03 (CB5640XP, CB6711TE, firmware
2.45d). It is our own analysis, not an ERM specification.

All frames use the G2 checksum (over everything between `$` and `*`, after G9 replacement) and the
G9 byte replacement of the [message structure](starlink-online-protocol/authenticated/pages/G9.md).
Commands from the server stay text, and units usually answer in text.

## `$SLC`: compressed batches

Verified on CB6711TE's and CB5640XP's containers. After G9 replacement the body is:

| Bytes | Content                                                           |
| ----- | ----------------------------------------------------------------- |
| 1     | `04`                                                              |
| 7     | The first 14 IMEI digits in BCD; the 15th is the Luhn check digit |
| 2     | `3f 01` (CB6711TE) or `0f 01` (CB5640XP)                          |
| 3     | Uncompressed length, big endian                                   |
| rest  | LZF data without block headers (below)                            |

In the LZF data, a control byte below 32 starts a literal run of control + 1 bytes. Any other
control byte is a back-reference: its top three bits give the length (7 means one more length
byte follows), plus 2; its low five bits and the next byte give the distance back, minus 1.

The decompressed data is a sequence of ordinary frames, each ending with CR LF: `$SLU` text frames
(events, `02` confirmations and command replies, including `45` and `48`) or `$SLB` frames.
A unit answers inside a container when it batches, for example while driving or for longer
replies. Karma confirms a container with reference `0`.

Between containers, a unit in a configuration session may send `E0 00` byte pairs at about
2 KB/s. They carry no frame and are skipped.

## `$SLB`: single binary reports

Used for the hourly single reports. After G9 replacement: `04`, the BCD IMEI, `0f 01`, the
command (`06`), then tag/value pairs with big-endian values. Tags are neither dynamic-parameter
numbers nor `onyx.proto` field numbers.

| Tag  | Value                                                 | Text token                |
| ---- | ----------------------------------------------------- | ------------------------- |
| `03` | u32 unit reference                                    | reference                 |
| `0c` | u32 event time, seconds since 2000-01-01 UTC          | `#EDT#`                   |
| `08` | u8 event ID                                           | `#EID#`                   |
| `0e` | u32 location time, seconds since 2000-01-01 UTC       | `#PDT#`                   |
| `19` | i32 latitude, i32 longitude, ×10⁻⁶ degrees            | `#LAT#`, `#LONG#`         |
| `06` | u8 heading in degrees                                 | `#HEAD#`                  |
| `12` | u16 speed                                             | `#SPD#`                   |
| `16` | u32 odometer in metres                                | `#ODOD#`                  |
| `1b` | u32 cell ID, u16 LAC, u8 signal strength              | `#CID#`, `#LAC#`, `#CSS#` |
| `20` | u16 main voltage in mV                                | `#VIN#`                   |
| `21` | u16 backup voltage in mV                              | `#VBAT#`                  |
| `26` | u8 battery health, then two unknown bytes             | `#BATH#`                  |
| `04` | u8 unknown, u8 visible satellites, u8 satellites used | `#SATN#`, `#SATU#`        |
| `3e` | u8 visible satellites, u8 average signal level        | `#SAT#`, `#GSS#`          |
| `42` | u16 internal temperature ×10                          | `#TVI#`                   |
| `43` | u16 minutes to the next transmission                  | `#NXT#`                   |
| `0f` | i32 altitude in decimetres                            | `#ALTD#`                  |
| `3b` | u32 network code                                      | `#NC#`                    |
| `51` | u8 network technology                                 | `#NT#`                    |
| `fe` | Text until the checksum, Karma's `extra`              | trailing fields           |

Still unknown: `27` (one byte, 0 with ignition and engine off), `ff 32` (one byte) and the
first byte of `04` (24 with a 3D fix).
