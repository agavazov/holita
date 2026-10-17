# ERM device profile: EG915U-LA / LC86G

This reference describes **one device discussed in the supplied integration
note**, identified there by a Quectel EG915U-LA modem, LC86G GNSS module, eight
visible connector contacts and a 3.7 V / 350 mAh battery. Its exact ERM model,
hardware revision and firmware are unknown. The directory name is a descriptive
reference label, not an ERM SKU or a holita device type.

[ERM resources](../README.md) · [Original integration note](source/ERM_INTEGRATION_EN.md) ·
[Source metadata](metadata.json) · [Open hardware questions](../../../todo/karma-api-v2.md#uncovered-resources-and-fields)

## Document identity

| Property                                    | Value                                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Supplied file                               | `ERM_INTEGRATION_EN.md`                                                                                                 |
| Original title                              | ERM Telematics — Fleet Management Platform Integration                                                                  |
| Provenance                                  | User-supplied note from `.tmp/ERM_INTEGRATION_EN.md`; original preserved under `source/`                                |
| Source author, publication date and version | Not stated                                                                                                              |
| Analysis date                               | 2026-10-17 (Europe/Sofia)                                                                                               |
| Local reference edition                     | 1.0                                                                                                                     |
| Scope                                       | A hardware profile and relevant integration constraints; not a verified device datasheet                                |
| Device model / hardware revision / firmware | Unidentified                                                                                                            |
| Supporting photographs                      | Mentioned in the note, but not embedded or linked in the supplied Markdown; not independently reviewed for this profile |
| Live device validation                      | None; no device connection, packets or configuration readback supplied                                                  |

The source's illustrative telemetry timestamps are not evidence of its publication
date. Component observations below are attributed to the note. Manufacturer
documentation establishes component capabilities, not that this particular board
contains or exposes every supported feature.

## Hardware described by the source

| Item                     | Reported observation       | Meaning and evidence limit                                                                                                                     |
| ------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Cellular modem           | Quectel `EG915U-LA`        | Cellular connectivity through SIM/operator service. The module variant matters for supported bands; the board marking is reported by the note. |
| GNSS receiver            | Quectel `LC86G`            | Satellite positioning component. The exact LC86G subvariant, antenna implementation and tracker firmware output are unidentified.              |
| Backup battery           | `3.7 V / 350 mAh`          | Battery rating reported by the note. Runtime, charging behavior and power-loss messages are unverified.                                        |
| Cable connector          | Eight visible contacts     | Contact count is not a pinout. Supply voltage, ground, I/O assignments and accessory lines are not established.                                |
| Vehicle inputs/outputs   | Potential interfaces       | Ignition sensing, analog/digital inputs, output count and electrical ratings are not confirmed.                                                |
| CAN diagnostic interface | Not confirmed on the board | CAN/FMS/DTC availability cannot be inferred from the GNSS receiver, modem or connector count.                                                  |

Quectel identifies [LC86G as a GNSS module family](https://www.quectel.com/product/gnss-lc86g/).
This supports the component's general role without identifying the complete ERM
product or the position fields its firmware transmits.

### Cellular variant and coverage

The [Quectel EG915U series specification, v1.3](https://www.quectel.com/content/uploads/2024/03/Quectel_EG915U_Series_LTE_Standard_Module_Specification_V1.3-1.pdf?wpId=114167)
lists the following bands for **EG915U-LA**:

| Radio   | Listed bands                     |
| ------- | -------------------------------- |
| LTE-FDD | B2, B3, B4, B5, B7, B8, B28, B66 |
| GSM     | B2, B3, B5, B8                   |

**B20 is absent from the LA variant's band list.** The same specification lists
B20 for EG915U-EU. If the note's LA identification is correct, service on routes
depending on B20 is a compatibility concern; this does not establish actual
operator coverage or roaming availability for the installed SIM.

### Connector and product identity

The supplied [Scout brochure](../starlink-scout-4g-irf-brochure-v7.0/content.md#pdf-page-2)
lists an 8-pin connector and a 3.7 V / 350 mAh battery. That similarity alone does
not identify this board as Scout. The
[Tracker brochure](../starlink-tracker-brochure-v5.0/content.md#pdf-page-3) describes
a 10-pin connector; its pinout or electrical assumptions do not transfer to the
reported eight-contact board. No wiring diagram for this specific device is
available in the supplied note.

## Capabilities and their prerequisites

| Capability discussed in the note            | Evidence for this device                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Position, speed, heading and time           | GNSS component reported; actual message fields, validity flags, units and cadence are not sampled.                   |
| Ignition, movement, power and device status | Depend on firmware and installation; no confirmed input mapping or messages.                                         |
| Geofence, power-loss and other events       | Potential firmware or backend functions, not demonstrated capabilities of this unit.                                 |
| CAN/FMS measurements and DTCs               | Require a supported interface/accessory, vehicle profile and actual signals; none are confirmed here.                |
| Remote parameter reads/writes               | Generic ERM/flespi documentation exists; firmware-specific availability and successful readback are not established. |
| Digital outputs and immobilization          | Physical outputs, electrical ratings and permissible operation are unknown.                                          |
| OTA firmware/configuration                  | Product-family references do not establish support or recovery procedures for this firmware.                         |

The note discusses **eData**, **eCAN** and **eNet** as possible accessory/interface
context. Their presence and compatibility with this board are unverified. The
[eData Simple protocol](../edata-simple-protocol-v4.04/README.md) and
[Simple eData Monitor guide](../simple-edata-monitor-configuration-v1.0/README.md)
provide separate CAN-engine references; they are not evidence of a built-in CAN
interface on this tracker. CAN reading also does not establish arbitrary ECU
command or diagnostic access.

## Communication and interpretation notes

The [StarLink portal reference](../starlink-online-protocol/README.md) and its
[Message structure](../starlink-online-protocol/message-structure.md) describe
device/server framing, identifiers and source ambiguities. Portal credentials
remain awaited. Those rules still need to be matched to the installed firmware.

The [flespi ERM reference](https://flespi.com/protocols/erm) documents an ASCII/TCP
adapter, tracker destination `host:port` configuration and parsed MQTT/REST data.
This establishes a provider integration option, not a connection from this unit
or an integration implemented in holita.

Its relevant field and command notes are:

- Parameter `0177` describes the dynamic event field layout; it does not by itself
  specify reporting intervals or triggers.
- `#VIN#` maps to `external.powersource.voltage` in this adapter. It is not the
  vehicle's VIN identifier in that context.
- `getparam`, `setparam`, `custom`, `output_on` and `output_off` are flespi command
  names, not literal ERM wire messages or holita GraphQL operations.

The [flespi changelog](https://forum.flespi.com/d/57-changelog-erm-protocol)
also describes retaining the dynamic parameter format between connections. This
is provider behavior, not a guarantee about a custom receiver or every firmware.
The original note preserves the example layout and JSON command payloads; no
commands were executed during this analysis.

The modem's AT interface and the tracker's application protocol are separate
interfaces. The supplied note does not establish direct modem control as a
supported way for holita to operate this tracker.

## Relationship to holita and the supplied integration proposal

The current [Discocan documentation](../../README.md) describes the implemented
Fleet and Karma Client behavior. This hardware reference adds no ingestion
service, decoder, command queue, telemetry persistence or device-configuration
workflow. It also does not establish a mapping between this unit, Karma API
`device_id` and a Fleet Device record.

The source mixes hardware observations with a general software proposal. Its
full text is retained for traceability, while the profile above concentrates on
this device and the evidence available for it.

| Original sections                                     | Treatment in this resource                                                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1: Device Overview                                    | Hardware observations and uncertainty recorded above.                                                                                          |
| 2–3: Data Flow; Data Available                        | Connectivity and capability prerequisites summarized above; no architecture selected.                                                          |
| 4–6: Remote Control; Command Lifecycle; Backend Model | Proposed desired/reported configuration, queues, audit and normalized JSON remain source examples, not accepted holita contracts.              |
| 7–8: Provisioning; Integration Tests                  | Suggested procedures only; no provisioning or hardware tests have been performed.                                                              |
| 9: Information Required from ERM                      | Outstanding hardware identification is tracked as HARDWARE-01; shared protocol/parameter/command questions remain in existing backlog entries. |
| 10: References                                        | Original links retained in the archived note; the component and adapter sources used here are linked beside their claims.                      |

Open work belongs in the [existing backlog](../../../todo/karma-api-v2.md):
HARDWARE-01 for this board, PROTOCOL-01/02 for portal/tool compatibility,
PARAM-01 for configuration and COMMAND-01/QUEUE-01 for command semantics. The
source's broad integration proposals do not constitute a decision to implement
them or to adopt flespi.
