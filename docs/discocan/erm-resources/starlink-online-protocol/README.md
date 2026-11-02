# ERM StarLink online protocol

Authenticated access to the [ERM protocol portal](https://sweb.erm.co.il/protocol/)
was verified on **2026-10-29** using the protocol access details supplied in the
new ERM reply. The [authenticated archive](authenticated/README.md)
preserves the discovered protocol pages as Markdown, content-only HTML sources,
linked illustrations/documents and the specifically requested Test Server
archive. The old screenshot references remain available as historical evidence.

[ERM resources](../README.md) · [Page catalog](authenticated/README.md) ·
[Protocol interpretation and diagnostics](authenticated-reading-guide.md) ·
[Machine-readable inventory](authenticated/inventory.json) ·
[Historical screenshots](images.md) · [Source metadata](metadata.json)

## Start with the relevant protocol layer

| Need                                             | Authoritative archived pages                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framing, identifiers, references and size limits | [G1 — Message structure](authenticated/pages/G1.md)                                                                                                                      |
| Checksum and escaping                            | [G2 — Check-sum calculation](authenticated/pages/G2.md), [G9 — Binary data](authenticated/pages/G9.md)                                                                   |
| Commands and confirmation results                | [C0 — Commands](authenticated/pages/C0.md), [C2 — Confirmation](authenticated/pages/C2.md), [K0 — Result codes](authenticated/pages/K0.md)                               |
| Event fields and acknowledgment/retransmission   | [E0 — Events](authenticated/pages/E0.md), [C6 — Event report](authenticated/pages/C6.md), [G16 — Message confirmation](authenticated/pages/G16.md)                       |
| External-device payload transport                | [C30 — External device message](authenticated/pages/C30.md), [E33 — External device event](authenticated/pages/E33.md)                                                   |
| Vehicle DTC reports through the OBD2 feature     | [E70 — Diagnostics trouble codes](authenticated/pages/E70.md), [F11 — OBD2](authenticated/pages/F11.md), [P2070 — DTC event configuration](authenticated/pages/P2070.md) |
| StarLink unit diagnostic reports                 | [E2 — Diagnostic report](authenticated/pages/E2.md), [P11 — Diagnostic filter](authenticated/pages/P11.md)                                                               |
| Configuration and value macros                   | [P0 — System parameters](authenticated/pages/P0.md), [D0 — Dynamic parameters](authenticated/pages/D0.md)                                                                |
| Binary contract                                  | [G12 — Binary protocol](authenticated/pages/G12.md) and its retained `onyx.proto` source asset                                                                           |
| Test Server setup and tools                      | [G11 — Test Server](authenticated/pages/G11.md), [G7 — Tools](authenticated/pages/G7.md)                                                                                 |
| Hardware and firmware applicability              | [H0 — Hardware](authenticated/pages/H0.md), [V0 — Versions](authenticated/pages/V0.md)                                                                                   |

The page catalog additionally includes Simple SMS, accessories, features, all
reachable general information and individual detail pages. Inventory completeness
means all discovered permitted protocol links for this authenticated account
were traversed; it does not claim access to vendor-private or unlinked material.
Account settings, user administration and editable account configuration values
are outside the archive. All 1,968 discovered protocol pages and 55 source assets
are retained; three linked vendor illustrations return HTTP 404 and are listed
in the archive inventory.

## Current source identity

| Property                          | Evidence                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| Portal                            | `https://sweb.erm.co.il/protocol/`                                                      |
| Authenticated retrieval           | 2026-10-29, Europe/Sofia                                                                |
| Home page's update date           | 2026-10-18                                                                              |
| Current home firmware news        | Version 2.46, October 2026                                                              |
| Current home Monitor news         | StarLink Monitor 2.83, January 2026                                                     |
| Test Server version on tools page | 1.26.6.1, June 2026                                                                     |
| Protocol-wide version             | None established; individual pages retain their own dates and version markers           |
| Archive provenance                | Per-page source URL/update metadata; inventory records file sizes and SHA-256 hashes    |
| Credential handling               | Access values and session cookies were used only in process memory and are not archived |

The earlier ERM-TEST-01 result on 2026-10-27 correctly recorded a public login form
and unavailable credentials at that time. The supplied new reply now resolves
that access gap. It is no longer the current status of authenticated access.

## Diagnostic evidence must keep its scope

The portal documents vehicle DTC event 70 for its OBD2 feature. Event 2 is the
StarLink's own modem/GNSS/system diagnostic report. eData CAN-engine fault reads
are a separate inner protocol, documented in the
[eData diagnostic reference](../edata-simple-protocol-v4.04/diagnostics-and-fault-reporting.md).
An ACK, accepted transmission, sample packet or downloaded protocol page does
not prove that a real truck returned vehicle fault codes. The
[interpretation guide](authenticated-reading-guide.md) records these distinctions,
ACK layers and remaining vendor source inconsistencies.

This archive task read protocol documentation and downloaded references. It did
not execute the downloaded tools or change device destinations/settings. Live
vehicle evidence belongs to the
[support verification record](../erm-support-diagnostics-protocol-test-server/README.md).

## Historical screenshots

The byte-for-byte copies of the user-supplied `img.png`, `menu.png` and `p1.png`
remain under [images/](images/) with their descriptions in [images.md](images.md).
Their source was `.misc/edata`; that historical source path is provenance, not
an instruction to reopen it. Screenshot capture dates are unknown. Printed page
dates are source-page dates, not capture times.

The [historical Message structure transcription](message-structure.md) preserves
the original screenshot's table, examples, limits and discrepancies. Its original
claims about unavailable companion pages describe the screenshot-only edition;
the authenticated companion pages are now available above. G1 still displays the
same 2020-05-17 update date, while the authenticated home shows newer news.

This reference is the StarLink device/server protocol. It does not redefine
[Karma API v2](../karma-api-v2/README.md) identifiers or endpoint behavior, nor
establish a mapping between Karma device IDs and Fleet IMEIs. Manufacturer
copyright and ownership remain with ERM; the local archive preserves the
integration reference for internal use.
