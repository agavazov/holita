# Discocan hardware backlog

Pending proposals for Discocan's own hardware.

- Define a device-facing HTTP API on Device Server. Accept reports in the default device
  contract's ingestion format, authenticate each device and provide a public listener with TLS.
- Add Device Server persistence for reports, events, messages, the command queue and the
  configuration audit.
- Deliver commands to Discocan devices over HTTP and define the hardware's SMS command texts.
- Define the hardware's parameter catalog and measurement configuration.
- Add a `FleetDeviceModel` value and model options for the hardware.
- Compare real device data against the Simple eData catalog IDs and J1939 SPNs before choosing
  the measurement vocabulary for the hardware.
- Set vehicle-track gap thresholds from each device type's reporting cadence. The current
  thresholds use ERM's five-minute driving and one-hour parked cadence.
- Consider moving the ERM adapter into `erm-server` at the next ERM deployment, as recorded in
  [ADR 0009](../architecture/decisions/0009-device-types-and-adapters.md).
