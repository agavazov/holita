# ERM resources

Retained external sources for Discocan protocols, hardware, configuration and support evidence.
These sources are not an assertion that every vendor capability is implemented or safe on every
installation. Karma API/interface documentation is deprecated and indexed separately in the
[Karma archive](../../archive/karma/README.md); read it only when a task needs it.

## Protocols and tools

| Reference                                                                                      | Contents                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [StarLink online protocol](starlink-online-protocol/README.md)                                 | Authenticated portal archive, coverage inventory, searchable pages/catalogs, images, tools and Test Server instructions; original `authenticated/sources` retained |
| [StarLink Tracker binary formats](starlink-binary-formats.md)                                  | Fleet-observed `$SLC` containers and `$SLB` tags for `0182=3`, beyond the portal's documented formats                                                              |
| [eData Simple Protocol 4.04](edata-simple-protocol-v4.04/README.md)                            | Complete protocol/tables and source PDF                                                                                                                            |
| [eData diagnostics and faults](edata-simple-protocol-v4.04/diagnostics-and-fault-reporting.md) | Fixed reads and `411`/`413`/`417`/`418`/`419` evidence/interpretation limits                                                                                       |
| [eData parameter reporting](edata-simple-protocol-v4.04/parameter-reporting.md)                | Catalog/definition/measurement distinctions, manual configuration evidence and readback/restoration limits                                                         |
| [Simple eData catalog](simple-edata-catalog/README.md)                                         | Offline EXE extraction, workbook/Monitor tables, version comparison and shared Fleet reference import                                                              |
| [Monitor catalog 9.56](simple-edata-catalog/v9.56/README.md)                                   | Both workbook variants and their unresolved conflicts                                                                                                              |
| [Simple eData Monitor Configuration 1.0](simple-edata-monitor-configuration-v1.0/README.md)    | Complete guide/PDF, connections, rules, histograms and images                                                                                                      |

StarLink is the tracker/server envelope; eData is the CAN Engine payload. Tracker event `2`,
OBD event `70` and eData fault payload `419` have distinct schemas. The portal archive retains
framing/checksum, ACKs, commands/results, parameters, hardware and tool evidence, including
unavailable-resource qualifications. A downloadable Test Server does not prove actual live
routing, dual-destination delivery, replay or restoration.

## ERM support correspondence and verification

The [support reference](erm-support-diagnostics-protocol-test-server/README.md) preserves
correspondence, command reference, original explanatory images and the verification register.
Use the [29 October reply analysis](erm-support-diagnostics-protocol-test-server/reply-2026-10-29.md)
and [29 October live campaign](erm-support-diagnostics-protocol-test-server/live-verification-2026-10-29.md)
for the later answers and independently acquired CB1147TP faults/ten-car observations.
Earlier campaigns remain evidence with their original limits. Credentials/private headers are excluded.

ERM identifies `154,0` as a negative special ACK. GET DTC (`301`/`19`) answers `154,0` when the
fault buffer is empty and `154,1` plus a `419` snapshot of the active codes otherwise (proven
2026-11-11, see the [fleet evidence](edata-simple-protocol-v4.04/diagnostics-and-fault-reporting.md#fleet-evidence-2026-11-11)). The [1 November R&D reply](erm-support-diagnostics-protocol-test-server/reply-2026-11-01.md)
confirms the `419` layout, the added/removed lifecycle and every globals byte. `418` examples,
compatibility and the buffer at ignition off remain open.
Open questions and engineering tasks belong in the [ERM roadmap](../../todo/erm-roadmap.md).

## Hardware

| Reference                                                                       | Scope                                                                                                                       |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [EG915U-LA / LC86G device profile](erm-device-eg915u-la-lc86g/README.md)        | Complete original integration note and provenance; eight contacts, 3.7V/350mAh battery; exact ERM SKU/firmware unidentified |
| [StarLINK Scout 4G iRF brochure](starlink-scout-4g-irf-brochure-v7.0/README.md) | Complete three-page source; filename v7.0 versus printed 3.01 discrepancy retained                                          |
| [StarLink Tracker brochure 5.0](starlink-tracker-brochure-v5.0/README.md)       | Complete three-page source and variant specifications; PDF metadata says DRAFT                                              |

Hardware observations and conditional capabilities stay separate from generic integration
proposals. The EG915U-LA/LC86G profile does not identify a Scout/Tracker variant. Do not remove
source notes, brochures, metadata or images when simplifying indexes.

## Source preservation

Versioned PDF directories retain complete `content.md`, source PDF, metadata/checksums and useful
images/catalogs. Analysis/local-edition dates describe the conversion, not vendor release dates;
page references are physical PDF pages. Brochure conversions follow visible pages despite covered
legacy text. Original portal HTML and downloaded tools remain alongside converted pages.

Catalog work is offline and has no device communication or import/editing API. Historical
configuration procedures are reference evidence, not permission to send commands. Follow the
[current ERM operator and safety procedures](../development.md#erm-device-server) and the roadmap
for any explicitly authorized live work.
