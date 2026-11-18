# ERM Telematics — Fleet Management Platform Integration

> **Purpose:** Developer reference for a platform supporting GPS tracking, telemetry, CAN diagnostics, remote monitoring, and configuration of ERM telematics devices.
>
> **Status:** Based on photographs of one device and publicly available documentation for ERM StarLink and related products. **The exact ERM model and firmware have not been identified.** Each capability must be verified for the specific model, hardware revision, and installation.

## 1. Device Overview

The device is an **automotive GPS/GNSS tracker with cellular connectivity**. It receives information from satellite navigation systems and vehicle inputs/sensors, processes events, and sends data to a remote server. Depending on its firmware capabilities, it may also receive configuration changes and commands.

Components identified on the photographed PCB:

| Component | Role in the Software Platform |
|---|---|
| **Quectel LC86G** | GNSS coordinates, speed, heading, and time. |
| **Quectel EG915U-LA** | 4G LTE/2G connectivity through a SIM card and mobile operator. |
| **3.7 V / 350 mAh backup battery** | Potential continued operation or notifications after loss of external power; firmware-dependent. |
| **Vehicle inputs/outputs** | Potential ignition, power, and external signal interfaces. Functions and pinout are unconfirmed. |
| **CAN diagnostic interface** | **Not confirmed to be built into** the photographed device. Compatible ERM modules may be required for CAN/FMS. |

**Practical limitations:** The photographed PCB has eight visible contacts on its cable connector; the 10-pin pinout from a different ERM model must not be applied to it. The `EG915U-LA` LTE variant does not support Band 20 (800 MHz), creating a potential coverage risk on European routes.

## 2. Data Flow

```text
Vehicle / GNSS / CAN module (if present)
                    |
                    v
               ERM device
                    |
                SIM + LTE
                    |
                    v
             TCP/IP over Internet
                    |
                    v
       Protocol Gateway / ERM Decoder
                    |
             Normalized Events
                    |
             Fleet / Telemetry API
                    |
          History, Maps, Alerts,
          Diagnostics, Analytics
```

**Typical integration:** ERM StarLink uses **ASCII messages over TCP**. The device initiates an **outbound connection** to a configured `host:port`; a public IP address on the SIM card is usually unnecessary. Exact message framing, formats, and acknowledgments (`ACK`) depend on the firmware.

There are three main integration options:

| Approach | Use Case |
|---|---|
| **Custom TCP gateway + ERM decoder** | Full control; requires protocol specifications covering framing, ACKs, and commands. |
| **flespi ERM protocol** | Ready-made decoding and command delivery; data available through MQTT/REST. Useful for a pilot and as a reference implementation. |
| **ERM API/platform** | Applicable only if the supplier provides the required data access and bidirectional control. |

**Important:** Quectel AT commands control the cellular modem; they **are not an API for the entire ERM tracker**. The application should use the ERM protocol or a provided API rather than sending AT commands directly.

## 3. Data Available to the Platform

| Category | Examples | Source and Conditions |
|---|---|---|
| **GPS/GNSS** | Coordinates, speed, heading, time, position validity | GNSS receiver + ERM firmware. |
| **Vehicle status** | Ignition, motion/idle state, input/output signals | Only with the appropriate wiring and firmware. |
| **Device status** | External voltage, battery, cellular signal, version, last seen | When the corresponding fields/messages are available. |
| **Events** | Speeding, geofence transitions, power loss, alarms | If generated/configured by the device or calculated by the backend. |
| **CAN/FMS** | RPM, engine hours, odometer, fuel, temperatures | **Conditional:** compatible CAN hardware, vehicle profile, and available signals. |
| **Diagnostics** | Diagnostic trouble codes (DTCs), fault codes and status | **Conditional:** diagnostic interface and a supported protocol/vehicle. |

Do not assume that all listed fields are available on this specific device. The platform must distinguish between a **missing signal**, a **zero value**, and **stale data**.

### CAN Integration

ERM offers additional solutions:

- **eData:** CAN/OBD diagnostics and rules, including FMS/J1939 and J1708; the manufacturer also describes DTC capabilities.
- **eCAN:** Non-invasive CAN bus reading, with CAN/FMS/J1939 support.
- Communication between compatible ERM devices/accessories may use **eNet** (a proprietary single-wire interface).

For each truck model, maintain a list of the parameters actually available, their units, sources, and identifiers (for example, PGN/SPN for J1939). **CAN read access does not automatically provide the ability to issue arbitrary diagnostic requests or commands to the vehicle ECU.**

## 4. Remote Control and Telemetry Selection

The software should expose **logical commands**. The ERM adapter translates them into parameters and protocol messages supported by the particular model.

| Logical Operation | Implementation / Limitation |
|---|---|
| **Request current position** | An example ERM custom command is documented by flespi; verify support for the installed firmware. |
| **Read a parameter** | `getparam` in the flespi integration. |
| **Change a parameter** | `setparam` in the flespi integration. |
| **Select fields in dynamic events** | ERM **parameter `0177`**, if supported. It defines the **field layout/order**, not automatically the reporting frequency. |
| **Change reporting intervals and conditions** | Uses other firmware parameters/rules; **exact parameter IDs and valid ranges must be obtained from ERM**. |
| **Enable particular CAN telemetry** | Only if supported by eData/eCAN configuration, the vehicle profile, and firmware. Universal on-demand CAN signal selection is not guaranteed. |
| **Control a digital output** | `output_on` / `output_off` are documented by flespi, but physical availability and safe operation must be checked separately. |
| **Firmware/configuration OTA** | Supported by some ERM product families; methods and permissions must be confirmed for the specific model. |

Example dynamic ERM event layout (template from flespi documentation, **not a captured device packet**):

```text
#EDT#,#EID#,#PDT#,#LAT#,#LONG#,#SPD#,#HEAD#,#ODO#,#LAC#,#CID#,#VIN#,#VBAT#
```

**Important:** In this protocol, `#VIN#` means **external power supply voltage** (`external.powersource.voltage`), **not** Vehicle Identification Number. Field meanings must come from the ERM protocol specification, not assumptions based on tag names.

### Recommended Software Model: Desired / Reported Configuration

The application stores the desired configuration. The adapter maps it to ERM parameters, sends it, and checks the actual configuration through readback.

```json
{
  "deviceId": "erm-001",
  "profile": "fleet-default",
  "desired": {
    "movingIntervalSec": 30,
    "stationaryIntervalSec": 300,
    "include": ["position", "speed", "ignition", "power"],
    "canSignals": ["engine_rpm", "fuel_level"]
  }
}
```

This is **an internal platform format, not an ERM command**. Values are illustrative. `canSignals` is accepted only if the device and vehicle actually support those signals; intervals must map to validated ERM parameters. If a setting is unsupported, return `unsupported` rather than reporting false success.

For each configuration, store `desired`, `reported`, version/revision, time sent, result, and failure reason. **Successfully sending a command does not prove that a setting was applied.** Where possible, use `getparam` and verify the resulting telemetry.

## 5. Command Lifecycle and Safety

```text
Fleet API -> Command Queue -> ERM Adapter -> TCP/Provider -> Device
                                 ^                           |
                                 +---- Response / Readback ---+
```

Use a separate command log with states:

`queued → sent → acknowledged → applied/verified`, or `failed / expired / unsupported`.

Rules:

- **Offline device:** Queue commands with a TTL; do not assume execution.
- **Retries:** Retry only when repeat execution is safe and consistent with the actual ERM protocol.
- **Readback:** After changing configuration, verify the actual value when possible.
- **Audit trail:** Record who issued each command, the target device, timestamp, payload, response, and outcome.
- **Access control:** Scope permissions by organization/fleet/device; restrict permitted commands and values.
- **Physical outputs/immobilizer:** Require a separate safeguarded workflow with approvals, safe-state checks, and prevention of unsafe actions while a vehicle is moving. Do not expose these as unrestricted generic commands.

Example from the **flespi adapter**, not the direct ERM wire protocol:

```json
{"name": "getparam", "properties": {"param": 177}}
```

Other documented flespi command names include `setparam`, `custom`, `output_on`, and `output_off`. For `custom`, flespi provides an example position request with `command=5`, `payload="10"`; do not use arbitrary numeric command IDs without the official ERM protocol reference.

## 6. Normalized Backend Data Model

Regardless of vendor, the application should ingest a consistent telemetry model. Example:

```json
{
  "deviceId": "erm-001",
  "recordedAt": "2026-10-17T08:00:00Z",
  "receivedAt": "2026-10-17T08:00:02Z",
  "position": {
    "latitude": 42.6977,
    "longitude": 23.3219,
    "speedKph": 52.1,
    "headingDeg": 180
  },
  "ignition": true,
  "power": { "externalVoltage": 24.2 },
  "source": "erm-starlink",
  "rawMessageId": "raw-001"
}
```

These values are **illustrative, not captured telemetry**. Add CAN measurements only when a real, identified source is available (for example, `can.engineRpm`, `can.fuelLevelPct`, `diagnostics.dtcs`). Do not conflate GPS speed with ECU speed or GPS distance with the ECU odometer.

Minimum processing requirements:

- Store the **raw message** (with limited retention) and the normalized event for parser diagnostics.
- Preserve the **device timestamp in UTC** separately from reception time; correctly handle delayed/buffered records.
- **Deduplicate** retransmitted messages and tolerate LTE connectivity outages.
- Track **last seen**, connectivity state, and **staleness** per metric.
- Maintain explicit **units, sources, and data quality**; never invent missing values.
- Support different ERM firmware versions/profiles without hard-coded field positions.

## 7. Device Provisioning

1. Register **IMEI/serial number**, exact ERM model, firmware version, SIM, and assigned vehicle.
2. Configure SIM/APN and destination `host:port` using an ERM-approved method.
3. Confirm protocol compatibility, parameter `0177`, message types, and required ACKs.
4. If CAN data is required, verify eData/eCAN hardware, eNet compatibility, and the vehicle-specific profile.
5. Validate the first message, current position, core events, and command channel.
6. Apply and read back the desired telemetry profile; mark the device `active` only after verification.

## 8. Minimum Integration Tests

- **Tracking:** Stationary position, movement, stopping, and route history.
- **Connectivity:** Cellular data loss/recovery, buffered history, and prevention of duplicate records.
- **Remote control:** `getparam`, an authorized `setparam`, position request, and verified readback.
- **Telemetry profile:** Change transmitted fields (`0177`) **separately from** reporting frequency/triggers, where supported.
- **CAN:** At least one actual RPM/fuel/DTC signal from a selected vehicle, after confirming the setup.
- **Operations:** Offline device commands, TTL, rejection, auditing, and recovery after reconnection.

## 9. Information Required from ERM

To implement the integration without guessing, request:

1. **Exact SKU, hardware revision, and firmware version**, plus technical documentation for the photographed PCB and its 8-pin connector.
2. **ERM StarLink protocol specification:** Message formats, authentication/identity, framing, ACK, retries, and every supported command/response type.
3. **Parameter reference:** IDs, valid values, and `get/set` rules, particularly for `0177`, reporting intervals, movement/ignition triggers, configuration persistence, and OTA.
4. **CAN/FMS integration guide:** Supported eData/eCAN modules, eNet compatibility, available signals and DTCs for the relevant trucks, and whether CAN signal selection can be changed remotely.
5. **Provisioning/OTA/security:** Configuration tools, permissions, direct TCP endpoint support, encryption/authentication options, and recovery procedures after failed configuration changes.

## 10. References

- [ERM StarLink Tracker — Product Family](https://www.ermtelematics.com/starlink-tracker)
- [ERM StarLink One — Management, OTA, and Tracking](https://www.ermtelematics.com/starlink-one)
- [ERM eData — CAN / OBD / FMS / J1939 / J1708](https://www.ermtelematics.com/edata)
- [ERM eCAN — Non-invasive CAN Reading](https://www.ermtelematics.com/ecan)
- [flespi — ERM Protocol, Fields, and Commands](https://flespi.com/protocols/erm)
- [flespi — ERM Protocol Changelog and ACK](https://forum.flespi.com/d/57-changelog-erm-protocol)

---

**Integration principle:** The platform controls **what data it wants and when**, but the ERM adapter sends only **commands actually supported** by the specific model. GNSS tracking, CAN telemetry, diagnostics, and remote I/O are separate capabilities that must be confirmed and enabled individually, rather than assumed to exist on every GPS tracker.
