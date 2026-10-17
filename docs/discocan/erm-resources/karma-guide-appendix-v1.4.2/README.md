# Karma User Guide - Appendix for Partners

Partner setup of fleets, users, vehicles and drivers, command permissions, output commands and DTC reporting.

[ERM resource index](../README.md) · [Complete source content](content.md) · [Images and descriptions](images.md) · [Original PDF](source/original.pdf) · [Machine-readable metadata](metadata.json)

## Document identity

| Property                   | Value                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Source filename            | Karma Guide - Appendix 1.4.2.pdf                                                      |
| Source version             | 1.4.2                                                                                 |
| Version evidence           | Cover, PDF page 1: Release 1.4.2 \| December 2018.                                    |
| Document date              | December 2018                                                                         |
| PDF creation timestamp     | 2018-12-11T10:06:09+02:00                                                             |
| PDF modification timestamp | 2018-12-11T10:06:09+02:00                                                             |
| Analysis date              | 2026-10-16 (Europe/Sofia)                                                             |
| Markdown/analysis edition  | 1.1                                                                                   |
| Reference updated          | 2026-10-17 (Europe/Sofia)                                                             |
| Prepared by                | Codex; text extraction with visual source review                                      |
| Pages                      | 10                                                                                    |
| Provenance                 | User-supplied local PDF in .misc/edata; archived byte-for-byte as source/original.pdf |
| SHA-256                    | `6c9930959965c99ffc7a7d0f0787219d201aa03255d6dd70f4d6ef9eab47a09b`                    |

The analysis date is independent of the vendor release and PDF metadata dates. File timestamps alone are not treated as publication dates.

## Reading map

| Subject                                 | Physical PDF pages            |
| --------------------------------------- | ----------------------------- |
| Partner setup sequence                  | [3](content.md#pdf-page-3)    |
| Fleet creation and authorization matrix | [4](content.md#pdf-page-4)    |
| Users, vehicles and drivers             | [5-7](content.md#pdf-page-5)  |
| Command access, outputs and logs        | [8-9](content.md#pdf-page-8)  |
| DTC events and support                  | [9-10](content.md#pdf-page-9) |

## Analysis

Partner onboarding proceeds through fleet creation, user creation, vehicle creation and driver creation (page 3). The guide lists Partner, Manager, User and Viewer access levels; the exact historical matrix is transcribed on page 4. It states that a newly created fleet cannot be deleted.

User setup includes fleet membership and a fleet used for unit conversion. Vehicle setup requires a unique StarLink ID. Driver IDs must be unique, and driver/vehicle assignments require both records to belong to the same fleet (pages 5-7).

Command access is enabled through a user checkbox. The vehicle card exposes output Set/Reset controls, optional output renaming and a log for the last 30 days (pages 8-9). The DTC section describes report selection and a device-parameter prerequisite. These are source instructions, not operations executed during this analysis.

## Source qualifications

- This is a historical Karma web-interface guide. Its role matrix is not proof of current API v2 authorization behavior.
- The cover release is December 2018 while its copyright line says 2017. Both are source statements.
- The guide describes a unique 15-digit StarLink ID under the IMEI label. This does not establish the identity semantics of every API v2 device_id field.

## Conversion coverage

All **10 PDF pages** are represented in [content.md](content.md). The [image catalog](images.md) contains **27 described assets** and **5 context captures**. Standalone decorative artwork, publisher logos and generic note/support markers are omitted. The original PDF remains the authority for layout, screenshot microtext and ambiguous source wording. This reference describes the supplied vendor document; it does not change holita behavior or verify the present-day vendor service.
