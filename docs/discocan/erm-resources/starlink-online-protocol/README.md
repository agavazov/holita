# ERM StarLink online protocol portal

The [StarLink online protocol portal](https://sweb.erm.co.il/protocol/) is an ERM
reference for device/server messages, commands, events, configuration parameters,
hardware and supporting tools. **We do not yet have portal credentials; they are
awaited.** This reference describes the three screenshots supplied by the user,
not an authenticated review of the full portal.

[ERM resources](../README.md) · [Message structure](message-structure.md) ·
[Screenshots and descriptions](images.md) · [Source metadata](metadata.json)

## Identity and evidence

| Property                    | Evidence                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Portal                      | `https://sweb.erm.co.il/protocol/`                                                                           |
| Visible title               | StarLink online protocol                                                                                     |
| Access                      | Credentials awaited; authenticated browsing and downloads are unverified                                     |
| Analysis date               | 2026-10-16 (Europe/Sofia)                                                                                    |
| Local reference edition     | 1.0                                                                                                          |
| Portal/protocol version     | Not established by the supplied screenshots                                                                  |
| Home page date              | January 7th, 2026, displayed in `img.png`                                                                    |
| Message structure page date | May 17th, 2020, displayed in `p1.png`                                                                        |
| Screenshot capture dates    | Unknown; the dates printed on pages are not capture dates                                                    |
| Sources                     | User-supplied `img.png`, `menu.png` and `p1.png` from `.misc/edata`; preserved byte-for-byte under `images/` |

The home page news mentions **StarLink Monitor v2.83**, released in January 2026,
and **Version 2.44 (November, 2025)** with an OTA firmware-update note. These are
visible news entries, not evidence that the Message structure page or every
device uses either version. The supplied menu and message page have no visible
deep-link URLs, so their original addresses have not been reconstructed.

## Portal overview

The following navigation labels are visible in the [home screenshot](images/home.png).
Descriptions summarize their apparent scope; the individual sections have not
been opened or inventoried.

| Visible navigation                                     | Apparent scope                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Home; Your settings; Manage users                      | Portal landing page, account preferences and user administration                                       |
| Commands; Result codes; Events; Simple SMS             | Device operations, returned codes, event messages and SMS instructions                                 |
| Dynamic parameters; System parameters                  | Parameter reference and device configuration                                                           |
| Accessories; Features                                  | Device accessories and capabilities                                                                    |
| General information                                    | Shared protocol, data representation, communication and tool topics listed below                       |
| Hardware; Versions; Download tools                     | Hardware/version references and downloadable tools                                                     |
| Configurations; No known issues; Default configuration | Configuration area and the labels/status visible beneath it; full configuration contents are not shown |

This makes the portal a relevant source for interpreting direct StarLink traffic
and identifying the documentation needed for a device integration. Its navigation
does not establish model support, command permissions or complete message schemas.

## General information menu

The [supplied menu screenshot](images/general-information.png) shows these entries
in order. Only **Message structure** has supplied page content.

1. Binary data
2. Binary protocol (advanced feature)
3. Check-sum calculation
4. Converting unsigned raw values to signed numbers
5. Endianness
6. Free and Open Source code
7. Internet Access
8. LED Indications
9. Location and heading
10. Low power consumption
11. **[Message structure](message-structure.md)**
12. Message confirmation
13. Pay attention!
14. Receiving large data packets on your server
15. SIM card types
16. StarLink Firmware OTA Server
17. StarLink Monitor
18. StarLink Test Server
19. Tools

The menu confirms the spelling **StarLink Test Server**. The earlier resource
notes used “StartLink Test Server”; its executable and message-replication behavior
remain unverified. The separate **StarLink Monitor** menu entry does not establish
that it is the same tool as the supplied
[Simple eData Monitor guide](../simple-edata-monitor-configuration-v1.0/README.md).

## Message structure focus

The [detailed local reference](message-structure.md) preserves the visible framing
table, direction markers (`SLU` and `SRV`), identifier alternatives, separators,
reference counter, checksum description, size limits and all six sample messages.
It also records the command-range and checksum inconsistencies in the supplied
page instead of silently resolving them.

The **Check-sum calculation**, **Message confirmation**, **Binary protocol** and
**Receiving large data packets on your server** entries are relevant companion
references. Their names are visible, but their actual rules are not available in
the supplied material. Access-dependent investigation remains in the
[protocol backlog](../../../todo/karma-api-v2.md#uncovered-resources-and-fields).

## Relationship to the other ERM references

This is the direct device/server protocol reference. It does not establish
[Karma API v2](../karma-api-v2/README.md) endpoint behavior, API `device_id`
semantics or a mapping to Fleet Device.imei. The
[eData Simple 4.04 PDF](../edata-simple-protocol-v4.04/README.md) is a separate
versioned CAN-engine reference; its examples must not be substituted for the
StarLink framing rules without vendor evidence. No device operations or holita
runtime changes are part of this documentation.
