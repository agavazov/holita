# ERM resources

This directory contains external ERM references relevant to Discocan. It does not
change the current holita application or domain contracts.

| Resource                                                | Purpose                                                                 | Local reference                                                                                                                                                         |
| ------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Karma API v2](https://karma.online/apiv2/)             | Account, vehicle and telemetry HTTP API consumed by `apps/karma-client` | [Detailed API reference](karma-api-v2/README.md), original public help assets and reconstructed OpenAPI                                                                 |
| [ERM protocol portal](https://sweb.erm.co.il/protocol/) | StarLink device/server protocol, configuration and tools                | [Portal overview](starlink-online-protocol/README.md), [Message structure](starlink-online-protocol/message-structure.md) and supplied screenshots; credentials awaited |
| [Karma NC2 login](https://karma.online/nc2/login)       | Separate web login URL                                                  | Its relationship to API sessions, features and permissions has not been established; it is not the configured API base URL                                              |

Use the [Karma reference](karma-api-v2/README.md) for the API inventory, data models,
current holita coverage and known limitations. Remaining investigation and proposed
work live in the [Karma backlog](../../todo/karma-api-v2.md).

## Simple eData Monitor catalog

The [versioned catalog and offline procedure](simple-edata-catalog/README.md) extract
embedded workbooks and Monitor tables from one EXE, compare versions and import shared
reference data into Fleet. [v9.56](simple-edata-catalog/v9.56/README.md) retains both
workbook variants and their conflicts. The workflow uses direct commands and has no
device communication, GraphQL endpoint or admin integration.

## Configuring eData reporting

The [parameter configuration reference](edata-simple-protocol-v4.04/parameter-reporting.md)
explains how catalog metadata, device definitions and received measurements relate;
how to read, add or change reporting parameters through Karma; and how to verify
or restore a change. It records the verified scope and remaining protocol limits.
The procedure is a manual upstream capability, not an implemented holita command UI.

## Hardware profiles

| Hardware reference                                                        | Identification and scope                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ERM device with EG915U-LA / LC86G](erm-device-eg915u-la-lc86g/README.md) | One device described in the user-supplied `ERM_INTEGRATION_EN.md`: eight connector contacts and a 3.7 V / 350 mAh battery; exact ERM model and firmware unidentified. Hardware observations, component references and conditional capabilities are separated from the source's general integration proposals. |

The profile includes the complete original note and provenance metadata. Its
analysis date is **2026-10-17**, local reference edition **1.0**. It does not
establish that the device is a particular Scout or Tracker variant.

## StarLink online protocol portal

Portal credentials are awaited. The [local portal reference](starlink-online-protocol/README.md)
describes the user-supplied home page, all 19 General information menu entries and
the visible [Message structure](starlink-online-protocol/message-structure.md) page.
It includes framing fields, direction markers, identifier forms, checksum evidence,
size limits and sample messages, with the three original screenshots and source
metadata. Other portal pages, downloads and current device compatibility remain
unverified.

## PDF reference library

The six user-supplied PDFs are converted into separate reference directories.
Each reference records its analysis date, latest update and local edition in its
`README.md` and `metadata.json`. These dates describe the local documentation,
not the vendor release dates.

| Document                                       | Source version                                    | Pages | Reference                                                                                     |
| ---------------------------------------------- | ------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------- |
| eData Simple CAN Engine Communication Protocol | 4.04; copyright 2022                              | 30    | [Protocol and tables](edata-simple-protocol-v4.04/README.md)                                  |
| Karma User Guide - Appendix for Partners       | 1.4.2; December 2018                              | 10    | [Partner setup and commands](karma-guide-appendix-v1.4.2/README.md)                           |
| Karma User Guide                               | 4.3.2; December 2018 cover, November 2018 footers | 39    | [Karma workflows and screenshots](karma-user-guide-v4.3.2/README.md)                          |
| Simple eData Monitor Configuration Guide       | 1.0; copyright 2017, PDF created 2018-04-05       | 28    | [Connections, rules and histograms](simple-edata-monitor-configuration-v1.0/README.md)        |
| StarLINK Scout 4G iRF brochure                 | Filename v7.0; printed version **3.01**           | 3     | [Scout specifications and version discrepancy](starlink-scout-4g-irf-brochure-v7.0/README.md) |
| StarLink Tracker brochure                      | 5.0; PDF metadata title includes **DRAFT**        | 3     | [Tracker variants and specifications](starlink-tracker-brochure-v5.0/README.md)               |

The original notes requested `eData_Simple_Protocol.pdf`; the supplied protocol
reference is archived with its versioned filename, `eData Simple Protocol v4.04.pdf`.

Each directory contains:

- `README.md`: document identity, version/date evidence, analysis, reading map and source qualifications.
- `content.md`: all physical PDF pages in Markdown, including reconstructed tables.
- `images.md` and `images/`, where the document has useful illustrations: technical figures, screenshots, UI controls and descriptions with page references; context captures retain explanatory arrows and labels. The eData protocol has no standalone technical raster illustrations, so it has no image catalog or image directory.
- `metadata.json`: original filename, SHA-256, PDF metadata, analysis edition/date, page coverage and image occurrences.
- `source/original.pdf`: a byte-for-byte copy of the supplied PDF, so the reference does not depend on the private input directory.

The brochures contain covered legacy text. Their Markdown follows the visible
rendered pages, and their figures are exported as visible page/cropped images.
The guides use embedded-image extraction with transparency composited onto white.
Repeated useful images are stored once per document. Standalone cover artwork,
publisher logos, decorative bands, shadows, page numbers and generic note/support
markers are excluded. Complete page captures remain where they preserve technical
content or source evidence; decoration within those pages is part of the original
context. PDF page references use physical page numbers;
the protocol's printed footer numbering differs by one.

These are external vendor references. Historical Karma screenshots and device
protocol definitions do not establish current API v2 behavior, a device-to-API
parameter mapping, or implemented holita features. The spreadsheet and standalone
JPEGs supplied alongside the PDFs are outside this PDF conversion.

The original resource notes name **StartLink Test Server**; the supplied
[portal menu](starlink-online-protocol/README.md#general-information-menu) confirms
the label **StarLink Test Server**, alongside **StarLink Monitor**. Their binaries
and test-server message replication remain unverified. The notes also name
**Simple eData Primitives Monitor**. The monitor guide above documents Simple eData
Monitor, but does not establish its identity relative to either separately named
tool or supply an executable/model catalog. Remaining questions are in the
[protocol backlog](../../todo/karma-api-v2.md#uncovered-resources-and-fields).
