# Simple eData Monitor catalog v9.56

Source: `Simple eData FMS Monitor v9.56.exe`; SHA-256 `01dd13e50c55fdf84078ce298bde72320d55bee458baa4c0d2a06fca7c0ca1a0`.

Extractor 1.0.0; schema 1. The EXE was inspected statically and never executed.

[Complete source records and mappings](catalog.json). [Regeneration procedure](../README.md).

## Coverage

| Source         | Category/sheet | Records |
| -------------- | -------------- | ------: |
| Monitor        | 1              |     399 |
| Monitor        | 2              |     105 |
| Monitor        | 3              |    1310 |
| EXCEL/102/1033 | FMS            |    1296 |
| EXCEL/102/1033 | Privates       |     420 |
| EXCEL/102/1033 | OBD            |     103 |
| EXCEL/101/1033 | FMS            |    1319 |
| EXCEL/101/1033 | Privates       |     433 |
| EXCEL/101/1033 | OBD            |     103 |

Parameter sets: 203; profiles: 2; categories: 1.

## Profiles

| ID  | Name                  | Set | Category |
| --- | --------------------- | --- | -------- |
| 343 | FMS Parameters (250k) | 135 | 3        |
| 430 | FMS Parameters (500k) | 135 | 3        |

## Source qualifications

- Both different workbooks are retained; their runtime purpose is unresolved. Identical archives are deduplicated by SHA-256 while every discovered location is retained.
- IDs are not globally unique. Mappings contain candidates matched by ID only; category equivalence, Karma correspondence and device support are unverified.
- Cached formula values and shared formula anchors are preserved, not recalculated. Decimal/hex disagreements are retained.
- Display multipliers/offsets do not define CAN decoding or prove units. Profile labels and stored baud defaults are independent source facts.
- This is a vendor catalog, not device configuration, firmware detection or evidence of live measurements. No device commands are generated.

## Issues

- `decimal_hex_mismatch`: 40.
- `set_member_without_monitor_definition`: 10.
- `source_coverage_difference`: 46.
