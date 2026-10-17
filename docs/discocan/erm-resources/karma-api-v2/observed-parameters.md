# Observed eData parameter descriptions

This is a **partial observed catalog**, extracted from `GET /edata` with `showdesc=1`. It records metadata returned by sampled latest-message batches, not telemetry values or vehicle identities. The machine-readable evidence is [edata-parameter-metadata.json](source/edata-parameter-metadata.json).

Twelve parameter IDs were encountered. This is not the complete supported-ID list or a vehicle-model capability matrix. A parameter absent here may still be supported. Holita accepts unknown positive parameter IDs and does not use this table as an enum, filter allowlist or conversion rule.

| Parameter ID | Original source description                     | Observed JSON value type |
| ------------ | ----------------------------------------------- | ------------------------ |
| `1`          | Engine Speed (RPM)                              | number                   |
| `2`          | Wheel Based Vehicle Speed (kph)                 | number                   |
| `64`         | Engine Total Hours Of Operation                 | number                   |
| `152`        | High Resolution Total Vehicle Distance (meters) | number                   |
| `153`        | Accelerator Pedal Position 1 (%)                | number                   |
| `188`        | Engine Oil Temperature (c)                      | number                   |
| `539`        | Engine Coolant Temperature (c)                  | number                   |
| `651`        | Engine Percent Load At Current Speed            | number                   |
| `662`        | Engine Fuel Rate (L/h)                          | number                   |
| `687`        | Engine Total Fuel Used - J1939 (L)              | number                   |
| `785`        | Fuel Level (%)                                  | number                   |
| `1657`       | High Resolution Engine Total Fuel Used          | number                   |

Unit labels such as RPM, kph, meters, c, L and % are part of the original description strings. They are source-provided labels, not units independently established for every device, firmware or vehicle model. In particular, the table supplies no scale, calibration, precision, conversion, missing-value sentinel or reset/rollover definition. A description without a unit is kept unchanged.

The two total-fuel parameter names do not establish that they are interchangeable, simultaneously available or measured at the same resolution. Likewise, the device-level speed/distance parameters do not establish the units of envelope `spd`/`odo` or trip metrics. No readings, averages, totals or inferred fuel consumption are retained here.

Parameter `662` is a reported fuel rate, distinct from cumulative fuel-used IDs
`687` and `1657`. Its addition and reporting were verified on one installation
using the [parameter reporting workflow](../edata-simple-protocol-v4.04/parameter-reporting.md).
This does not establish availability on every vehicle or independent calibration.

IDs `153` and `651` also returned changing numeric measurements after being added
on that installation. Preserve a reported zero as a value; it is distinct from
null or an absent parameter. Their percentage interpretation follows the source
labels; independent calibration and model-specific behavior remain unverified.

See [Data models](data-models.md#edata-parameter-karmaedataparameter) for ID/value/description mapping and [remaining metric questions](../../../todo/karma-api-v2.md#time-units-and-telemetry-semantics) for the missing dictionary and model-specific definitions.
