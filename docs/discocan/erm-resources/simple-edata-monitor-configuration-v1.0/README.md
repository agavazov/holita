# Simple eData Monitor Configuration Guide

Hardware connection and desktop monitor configuration for parameters, rules, histograms, event inspection, settings files and firmware upgrade.

[ERM resource index](../README.md) · [Complete source content](content.md) · [Images and descriptions](images.md) · [Original PDF](source/original.pdf) · [Machine-readable metadata](metadata.json)

## Document identity

| Property                   | Value                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Source filename            | Simple eData Monitor Configuration Guide.pdf                                          |
| Source version             | 1.0                                                                                   |
| Version evidence           | Cover, PDF page 1: Release 1.0. Version is absent from the filename.                  |
| Document date              | Not stated separately; copyright 2017; PDF created 2018-04-05                         |
| PDF creation timestamp     | 2018-04-05T09:08:27+03:00                                                             |
| PDF modification timestamp | 2018-04-05T09:08:27+03:00                                                             |
| Analysis date              | 2026-10-16 (Europe/Sofia)                                                             |
| Markdown/analysis edition  | 1.1                                                                                   |
| Reference updated          | 2026-10-17 (Europe/Sofia)                                                             |
| Prepared by                | Codex; text extraction with visual source review                                      |
| Pages                      | 28                                                                                    |
| Provenance                 | User-supplied local PDF in .misc/edata; archived byte-for-byte as source/original.pdf |
| SHA-256                    | `f9be2590045422e988884b8adbbcd68d3615891b77c59bef38c0de890dbc4f91`                    |

The analysis date is independent of the vendor release and PDF metadata dates. File timestamps alone are not treated as publication dates.

## Reading map

| Subject                                           | Physical PDF pages              |
| ------------------------------------------------- | ------------------------------- |
| Overview and 4-/6-pin vehicle wiring              | [3-5](content.md#pdf-page-3)    |
| PC connection, diagnostics and available actions  | [6-8](content.md#pdf-page-6)    |
| Parameter selection and intervals                 | [9-10](content.md#pdf-page-9)   |
| Rule creation, functions, operators and reporting | [11-16](content.md#pdf-page-11) |
| Histogram definition, parameters and editing      | [17-21](content.md#pdf-page-17) |
| Parameter/rule/histogram/fault event views        | [22-25](content.md#pdf-page-22) |
| Removal, settings files and firmware upgrade      | [26-28](content.md#pdf-page-26) |

## Analysis

The guide connects Simple eData to StarLink through a 4-pin connector and to vehicle communication wires through a 6-pin connector. PC operation uses a LIN adaptor, eNet hub and selected serial port. Set Settings transfers parameters, while Set Vehicle separately transfers the vehicle category/type (pages 4-8).

It states limits of 100 active parameters and 100 rules. A parameter reporting interval of zero disables its use. Rules combine parameters, arithmetic/logical operators and TimeOf, Count or Sum functions, with true/false event IDs and debounce time (pages 9-16).

The histogram workflow allows ten histograms, one main parameter, up to twenty bins and up to five related parameters. Histogram inputs are sampled every 100 ms; transmission intervals are separately configurable. Event views can replace the latest record or accumulate history and export CSV (pages 17-25).

Removal distinguishes monitor state from device state. Settings are saved as INI files or exported as server-command text; firmware upgrade is a separate serial workflow. The analysis did not connect to or modify any device (pages 26-28).

## Source qualifications

- Guide release 1.0 is distinct from the screenshot application version 7.21 and the sample device label software/hardware versions.
- This PDF supplies guide evidence for Simple eData Monitor; it does not establish that a tool named Simple eData Primitives Monitor is the same product, nor supply its executable or full vehicle-model catalog.
- The TimeOf/Count/Sum section has a potential example inconsistency: the Count description is followed by a $Sum expression on page 14. The source expression is preserved.
- The histogram explanation mixes count/time language. Preserve its stated 100 ms sampling interval and millisecond accumulation wording; do not infer API units from it.

## Conversion coverage

All **28 PDF pages** are represented in [content.md](content.md). The [image catalog](images.md) contains **54 described assets** and **7 context captures**. Standalone decorative artwork, publisher logos and generic note/support markers are omitted. The original PDF remains the authority for layout, screenshot microtext and ambiguous source wording. This reference describes the supplied vendor document; it does not change holita behavior or verify the present-day vendor service.
