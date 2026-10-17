# eData Simple - CAN Engine Communication Protocol

Device-level CAN Engine command and report layouts, including parameter definitions, rules, histograms, diagnostics and fault reporting.

[ERM resource index](../README.md) · [Complete source content](content.md) · [Original PDF](source/original.pdf) · [Machine-readable metadata](metadata.json)

## Document identity

| Property                   | Value                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Source filename            | eData Simple Protocol v4.04.pdf                                                       |
| Source version             | 4.04                                                                                  |
| Version evidence           | Cover, PDF page 1: Release 4.04.                                                      |
| Document date              | 2022 (copyright year; no separate publication date)                                   |
| PDF creation timestamp     | 2022-02-23T11:08:11+02:00                                                             |
| PDF modification timestamp | 2022-02-23T11:08:11+02:00                                                             |
| Analysis date              | 2026-10-16 (Europe/Sofia)                                                             |
| Markdown/analysis edition  | 1.1                                                                                   |
| Reference updated          | 2026-10-17 (Europe/Sofia)                                                             |
| Prepared by                | Codex; text extraction with visual source review                                      |
| Pages                      | 30                                                                                    |
| Provenance                 | User-supplied local PDF in .misc/edata; archived byte-for-byte as source/original.pdf |
| SHA-256                    | `030012ac37ef71968174d6dde8c3d43d6b208fdb9e82bd5d9af67ee605f170eb`                    |

The analysis date is independent of the vendor release and PDF metadata dates. File timestamps alone are not treated as publication dates.

## Reading map

| Subject                                                                  | Physical PDF pages              |
| ------------------------------------------------------------------------ | ------------------------------- |
| 1 General; 2 Command Structure                                           | [4-5](content.md#pdf-page-4)    |
| 2.1-2.3 Message types and CAN Engine definitions                         | [5-12](content.md#pdf-page-5)   |
| 2.3.21-2.11 Global settings, diagnostics, firmware and CAN transmission  | [13-17](content.md#pdf-page-13) |
| 3.1-3.9 Parameter, rule and histogram responses                          | [17-22](content.md#pdf-page-17) |
| 3.10-3.24 Global/diagnostic, VIN, vehicle type, fault and driver reports | [23-29](content.md#pdf-page-23) |
| 4 ERM contact information                                                | [30](content.md#pdf-page-30)    |

## Analysis

The common header identifies the device, message type, data format, final-message flag and message number. Unit-to-server messages additionally carry a configuration ID (PDF pages 4-5). Command 301 carries CAN Engine operations, with the operation byte inside the payload. Updating an existing definition preserves other definitions; delete-and-update replaces the corresponding set (pages 5-6).

Parameter definitions describe the CAN header, start bit, bit count, multiplier, divisor, offset, mask, type, flags and reporting interval. Rule definitions include true/false event IDs, debounce settings and encoded rule data. Histogram definitions identify the main parameter, range, bins, report interval and related parameters (pages 7-9).

The response catalog distinguishes periodic parameter reports, rule-triggered reports and ignition-off reports, then histogram reports, diagnostics, VIN, car type, CAN state changes, faults, driver IDs and FMS scanning (pages 17-29). These distinctions should be preserved when interpreting source messages; this document alone does not prove how Karma exposes each report.

## Source qualifications

- The protocol is a device interface. It does not establish a mapping to Karma API v2 parameter IDs or JSON response fields.
- Physical PDF pages are used throughout this conversion. From PDF page 2 onward, the printed footer is one page lower.
- The source contains apparent editorial inconsistencies, including FMS/J1938 on page 4, the error-reporting entry on page 6, and some command examples/field labels. They are retained rather than silently corrected.
- Colors in hexadecimal examples distinguish fields in the PDF. Markdown preserves the text; consult the source PDF for the color grouping.

## Conversion coverage

All **30 PDF pages** are represented in [content.md](content.md). This document
has no standalone technical raster illustrations. Cover artwork, publisher
logos, page-template decoration and page-number shadows are omitted from the
Markdown resource; they remain in the complete [original PDF](source/original.pdf).
Protocol definitions and examples are represented as text and tables. The PDF
remains the authority for layout, color grouping and ambiguous source wording.
This reference does not change holita behavior or verify the present-day vendor
service.
