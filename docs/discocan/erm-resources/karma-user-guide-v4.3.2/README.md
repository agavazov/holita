# Karma User Guide

Historical Karma UI workflows for tracking, vehicle cards, reports, driving behavior, dashboards, POIs, routes, notifications, settings and odometer changes.

[ERM resource index](../README.md) · [Complete source content](content.md) · [Images and descriptions](images.md) · [Original PDF](source/original.pdf) · [Machine-readable metadata](metadata.json)

## Document identity

| Property                   | Value                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Source filename            | Karma User guide 4.3.2.pdf                                                            |
| Source version             | 4.3.2                                                                                 |
| Version evidence           | Cover, PDF page 1: Version 4.3.2 \| 12/2018.                                          |
| Document date              | December 2018 on cover; November 2018 in page footers                                 |
| PDF creation timestamp     | 2018-12-09T16:53:06+02:00                                                             |
| PDF modification timestamp | 2018-12-09T16:53:06+02:00                                                             |
| Analysis date              | 2026-10-16 (Europe/Sofia)                                                             |
| Markdown/analysis edition  | 1.1                                                                                   |
| Reference updated          | 2026-10-17 (Europe/Sofia)                                                             |
| Prepared by                | Codex; text extraction with visual source review                                      |
| Pages                      | 39                                                                                    |
| Provenance                 | User-supplied local PDF in .misc/edata; archived byte-for-byte as source/original.pdf |
| SHA-256                    | `6e2f79927cfe5a7781172d0a2ccb1000bbd74af4c0f3d6b15a52b0b0a3ea1d84`                    |

The analysis date is independent of the vendor release and PDF metadata dates. File timestamps alone are not treated as publication dates.

## Reading map

| Subject                                           | Physical PDF pages              |
| ------------------------------------------------- | ------------------------------- |
| Introduction, login, navigation and vehicle cards | [4-10](content.md#pdf-page-4)   |
| Questions, reports and driving behavior           | [11-18](content.md#pdf-page-11) |
| Dashboard, sub-fleets and notifications table     | [19-21](content.md#pdf-page-19) |
| POIs and route planning                           | [22-27](content.md#pdf-page-22) |
| Notifications and shortcuts                       | [28-32](content.md#pdf-page-28) |
| Settings, fuel, maintenance and tires             | [33-36](content.md#pdf-page-33) |
| Odometer, map tips and support                    | [37-39](content.md#pdf-page-37) |

## Analysis

The interface combines a natural-language question field, categorized reports and map-based vehicle cards. The guide shows ignition/connection indicators, vehicle details, trip paths, driving behavior and event information (pages 4-18).

Dashboard workflows include status filters, sub-fleets, graphical metrics and notification records. POIs and route planning use staged forms to select a vehicle/driver, start/end places, intermediate stops and optional notifications. Separate wizards create notifications and saved question/report shortcuts (pages 19-32).

Settings cover users, drivers, vehicles, fuel receipts, maintenance records and tire positions. The odometer section shows updates during vehicle creation, through vehicle details and through the dashboard, and warns that odometer changes affect trip values (pages 33-37). These workflows are documented as vendor UI behavior; no corresponding holita features are implied.

## Source qualifications

- The cover says December 2018; the internal footers say November 2018. Neither date has been silently substituted for the other.
- The original repeats section numbers 2 and 3. Original headings are retained; PDF page anchors provide unambiguous navigation.
- UI screenshots describe this historical release. They do not prove current NC2 behavior, API field semantics, current feature availability or holita implementation.
- Illustrative trip, fuel and driving charts are examples; their displayed values are not live measurements.

## Conversion coverage

All **39 PDF pages** are represented in [content.md](content.md). The [image catalog](images.md) contains **109 described assets** and **9 context captures**. Standalone decorative artwork, publisher logos and generic note/support markers are omitted. The original PDF remains the authority for layout, screenshot microtext and ambiguous source wording. This reference describes the supplied vendor document; it does not change holita behavior or verify the present-day vendor service.
