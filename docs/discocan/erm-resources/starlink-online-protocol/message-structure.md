# StarLink message structure

[Portal overview](README.md) · [Source screenshot](images/message-structure.png) ·
[Image descriptions](images.md)

Source: the user-supplied `p1.png`, showing **Message structure**, dated
**May 17th, 2020**, in the [ERM protocol portal](https://sweb.erm.co.il/protocol/).
Analysis date: **2026-10-16** (Europe/Sofia). Local reference edition: **1.0**.
Credentials are awaited; linked definitions and current device compatibility
have not been verified through the portal.

## Frame layout

The page describes a common structure for messages sent by both the server and
the StarLink unit. The following notation summarizes the visible table and
examples; angle brackets denote placeholders and square brackets denote optional
content. They are not transmitted characters.

```text
<protocol-header><SLU-or-SRV><unit-id>,<command>,<reference>[,<data-fields>]*<checksum><protocol-footer>\r\n
```

The examples concatenate the protocol header, message header and Unit ID without
commas. Comma-delimited fields start after Unit ID. `\r\n` denotes the two control
bytes, not four literal backslash/letter characters. The optional comma after the
reference is present only when data fields exist.

| Part                 | Unit → server                                             | Server → unit                      | Meaning shown in the source                                                                                                                            |
| -------------------- | --------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Protocol header      | `$` shown; controlled by Message header, parameter `0178` | Constant `$`                       | Do not assume the unit-side header is fixed independently of its configuration.                                                                        |
| Message header       | `SLU`                                                     | `SRV`                              | Identifies which side originated the message.                                                                                                          |
| Unit ID              | 6 or 15 characters                                        | 6 or 15 characters                 | Six hexadecimal digits for the serial or “soft” serial number, or a 15-digit IMEI; see identifier details below.                                       |
| Separator            | `,`                                                       | `,`                                | Comma, byte `0x2C`.                                                                                                                                    |
| Command              | `01–99` in the value column                               | `01–99` in the shared value column | Two digits identifying the command type. The description instead says `00–99`; the source is inconsistent about `00`.                                  |
| Separator            | `,`                                                       | `,`                                | Comma, byte `0x2C`.                                                                                                                                    |
| Reference number     | `1–999999999`                                             | `1–999999999`                      | One to nine digits; increments on each transmission and returns to 1 after 999999999.                                                                  |
| Optional separator   | `,` if data exists                                        | `,` if data exists                 | Absent when the message has no data fields.                                                                                                            |
| Optional data fields | As required by message type                               | As required by message type        | Comma-separated values; field count and length depend on message type. Their schemas are not supplied here.                                            |
| Checksum separator   | `*`                                                       | `*`                                | Asterisk, byte `0x2A`.                                                                                                                                 |
| Checksum             | `00–FF`                                                   | `00–FF`                            | Two hexadecimal digits. The page describes a byte sum modulo 256 from Unit ID up to the checksum separator; the sample discrepancy is explained below. |
| Protocol footer      | Controlled by Message footer, parameter `0179`            | Empty                              | The unit-side configured value is not given in this screenshot.                                                                                        |
| Terminator           | CR + LF                                                   | CR + LF                            | Carriage return `0x0D`, then line feed `0x0A`.                                                                                                         |

The original table merges direction cells where the values are shared; this
transcription repeats those values to keep each direction explicit.

## Unit identification

The page lists three identifier forms:

- The unit serial number as six hexadecimal digits: decimal unit `1234` is `0004D2`.
- A “soft” serial number as six hexadecimal digits.
- The unit IMEI as 15 decimal digits.

It refers to **Unit ID selection (parameter `0001`)** and says the unit accepts
all these forms, as well as `FFFFFF`. The screenshot does not explain the scope
or routing semantics of `FFFFFF`; it is not evidence of a broadcast mechanism.

The source example describes unit `1234`, IMEI `358281002705360`, with parameter
`0001 = 5678`, and states that it accepts all four messages below. They are
transcribed as printed, including their checksum values:

```text
$SRV0004D2,04,51,0001,0*A0
$SRV00162E,04,51,0001,5678*4E
$SRV358281002705360,04,51,0001,-1*96
$SRVFFFFFF,04,51,0001,0*0A
```

`00162E` is the six-digit hexadecimal representation of decimal `5678`. These are
vendor examples, not local device identifiers or commands executed during this
analysis. The screenshot does not include the full parameter `0001` definition.

## Checksum evidence and discrepancy

The visible description says to sum bytes starting at Unit ID up to the asterisk,
modulo 256, and links to **Check-sum calculation**. That linked page was not
provided. Applying a literal Unit-ID-to-asterisk sum to the ASCII samples does
not reproduce their printed checksums.

For example, in the source's Set parameter message:

```text
$SRV0004D2,04,4,0001,0*6E
```

- Summing ASCII bytes of `0004D2,04,4,0001,0` modulo 256 gives `73` in hexadecimal.
- Including the message header, `SRV0004D2,04,4,0001,0`, gives the printed `6E`.

The same calculation including `SRV` or `SLU`, but excluding `$`, `*` and the
following bytes, matches all six printed examples on the screenshot. This is a
local arithmetic observation, **not a verified replacement for the vendor's
checksum specification**. The complete rule, configuration effects and binary
variant remain dependent on the unavailable companion page.

## Message sizes

| Direction                              | Limit stated on the page                        |
| -------------------------------------- | ----------------------------------------------- |
| Incoming to the StarLink unit          | 1024 bytes in most configurations               |
| Incoming to a unit with limited memory | 512 bytes on some devices                       |
| Outgoing from StarLink to the server   | May exceed the incoming limit, up to “3k bytes” |

The source does not resolve “3k” to 3000 versus 3072 bytes, list the affected
models, or specify whether these limits include all framing bytes. It also does
not supply transport/chunking rules; the General information menu separately
lists **Receiving large data packets on your server**.

## Sample messages and field interpretation

**Set parameter command, server → unit**, as printed:

```text
$SRV0004D2,04,4,0001,0*6E
```

| Component                  | Value                                      |
| -------------------------- | ------------------------------------------ |
| Protocol / message headers | `$` / `SRV`                                |
| Unit ID                    | `0004D2`                                   |
| Command                    | `04`, labelled Set parameter by the source |
| Reference                  | `4`                                        |
| Data fields                | `0001`, `0`                                |
| Checksum separator / value | `*` / `6E`                                 |

**Wake up message, unit → server**, as printed:

```text
$SLU0004D2,01,1,2.11,2.11*F4
```

| Component                  | Value                                                   |
| -------------------------- | ------------------------------------------------------- |
| Protocol / message headers | `$` / `SLU`                                             |
| Unit ID                    | `0004D2`                                                |
| Command                    | `01`, labelled Wake up by the source                    |
| Reference                  | `1`                                                     |
| Data fields                | `2.11`, `2.11`; their individual meanings are not shown |
| Checksum separator / value | `*` / `F4`                                              |

The printed samples do not display the CR/LF bytes; the frame table requires them.
The command number, reference number and payload are separate fields. A command
catalog and Message confirmation rules are needed to establish responses,
acknowledgments and any reference correlation; those details cannot be inferred
from these samples alone.

## Related entries visible on the source page

- Command: **All**.
- General: **Check-sum calculation**; **Binary protocol (advanced feature)**.
- Parameters: **Message header (`0178`)**; **Message footer (`0179`)**.
- The Unit ID row also links to **Unit ID selection (`0001`)**.

Only the link labels are available. The original screenshot and the
[portal overview](README.md) retain the evidence boundary; access-dependent
questions are tracked in the [backlog](../../../todo/karma-api-v2.md#uncovered-resources-and-fields).
