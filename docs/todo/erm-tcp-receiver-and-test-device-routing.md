# ERM TCP receiver and test-device routing

## Objective

Build and verify a holita-owned receiver for direct ERM StarLink telemetry, redirect
one selected test device to it, and determine whether that device can deliver fresh
telemetry to both holita and Karma simultaneously. This is pending investigation and
implementation work, requested on 2026-10-17 (Europe/Sofia).

The intended flow is `StarLink device -> mobile network -> our TCP receiver -> holita`.
Reporting cadence still depends on device configuration, ignition and power-saving
behavior; an open TCP connection does not imply continuous measurement updates.

No device has been selected or redirected for this task. No receiver endpoint,
deployment host, domain or port has been chosen. Do not automatically reuse the truck
from the separate recovery task. Prefer a spare/test device with physical access and
a verified way to restore its existing destination.

## Starting context and evidence

Repository root:

- WSL: `/var/workspace/services/holita`.
- Windows: `\\wsl.localhost\Ubuntu\var\workspace\services\holita`.

Start with [Discocan instructions](../discocan/instructions.md), the
[current architecture](../discocan/architecture.md), and the
[ERM resource index](../discocan/erm-resources/README.md). Recheck the implementation
when starting: current documentation describes Fleet Vehicles/Devices and a read-only
Karma API adapter, without a direct device TCP receiver or telemetry ingestion pipeline.

Confirmed source-level context:

- The [flespi ERM adapter reference](https://flespi.com/protocols/erm) describes an
  ASCII/TCP integration and directing a tracker to a domain and port through SMS or
  a vendor configuration tool. This demonstrates an external-server integration path,
  not verified commands or compatibility for our selected device.
- The [ERM Scout product page](https://www.ermtelematics.com/starlink-scout) describes
  TCP/IP communication and OTA/USB configuration at product-family level.
- The [local StarLink protocol reference](../discocan/erm-resources/starlink-online-protocol/README.md)
  preserves supplied portal screenshots. Credentials for
  `https://sweb.erm.co.il/protocol/` were still awaited when this task was recorded.
  Recheck access rather than assuming those credentials are now available.
- The [Message structure reference](../discocan/erm-resources/starlink-online-protocol/message-structure.md)
  documents framing, identifiers, reference numbers and sample messages. It records
  an unresolved checksum description/example discrepancy. The full Message
  confirmation, dynamic field, binary protocol and large-packet rules are not covered
  by the supplied screenshots. Resolve the applicable rules before sending ACKs.
- StarLink destination/network settings are separate from Simple eData CAN parameter
  definitions. The Simple eData Monitor EXE/catalog and the eData `30,1,...` examples
  do not establish how to change the tracker's server address.

Related work must remain separate:

- [Versioned eData catalog](../discocan/erm-resources/simple-edata-catalog/README.md): parameter metadata,
  extraction and profile relationships; not a network-destination command catalog.
- [eData configuration interface](erm-edata-configuration-interface.md): user-facing
  parameter/interval configuration, not the transport receiver.
- [Device recovery](erm-edata-recovery-cb6721te.md): an existing installation's recovery
  context; it does not select that installation for this routing experiment.
- [Karma API unresolved contracts](karma-api-v2.md): command permissions, queue states,
  protocol questions and other shared provider uncertainties.

## Questions to resolve for the selected device

- [ ] Record the exact model, hardware revision, firmware, IMEI/device identifier,
      existing Karma car ID if applicable, installation and available SMS/USB access.
      Identify supported transport and configuration tools for that combination.
- [ ] Read and preserve the current primary/secondary destinations, ports, transport,
      SIM/APN configuration and relevant connection/reporting settings. Keep credentials
      and private device configuration in an appropriate ignored location, not this task.
      The API telemetry history is not a complete configuration backup.
- [ ] Establish the exact supported destination read/write operations and how to verify
      their application. Determine whether configuration can be delivered through the
      existing Karma connection, SMS or a local vendor tool; do not guess parameter IDs.
- [ ] Check whether the SIM/APN can reach our chosen endpoint, including any private
      APN, destination restrictions or routing requirements.
- [ ] Determine whether multiple destinations mean concurrent delivery, failover,
      different event routing, or another mode. Record per-destination ACK/retry behavior,
      buffering and any firmware/license restrictions. A field named secondary server
      is not proof of simultaneous reporting.
- [ ] Verify a restoration path that still works after the Karma connection is lost.
      Changing the sole active destination may stop both Karma telemetry and its command
      path. Restoring through the disconnected Karma API alone is not a sufficient plan.

## Receiver implementation

- [ ] Explain the concrete need for direct device traffic and why the existing HTTP
      Karma adapter/Apollo Router cannot receive it. Select the smallest sufficient
      implementation within the repository's architecture before introducing a new
      service, persistence model or deployment resource. Keep applications host-native
      and use existing npm/Nx tooling; the public TCP listener is not a GraphQL endpoint.
- [ ] Provide a reachable test host/domain and TCP port with bounded connections,
      frame/buffer sizes and timeouts. Verify the endpoint before changing a device.
      Establish device authentication/transport protection supported by the firmware;
      a claimed IMEI alone is not proof of a device's identity or Tenant authorization.
- [ ] Implement stream framing across fragmented reads and multiple frames per read,
      the verified checksum and confirmation rules, identifier/reference handling,
      reconnects and duplicate/retransmitted messages. Preserve supported header/footer
      configuration; detect unsupported binary or other formats explicitly.
- [ ] Preserve original payloads and server receipt timestamps for the selected test
      device, plus parsed device timestamps and reference/event identifiers. Keep diagnostic
      captures private and outside committed fixtures; document retention and sanitization.
      Decide ACK timing relative to accepted/durable data so acknowledged records are not
      silently discarded. Define replay and deduplication behavior before relying on it.
- [ ] Decode a small verified initial set: identification, time, position, available
      power/status fields and events. Discover the actual dynamic event structure, including
      parameter `0177` where applicable, instead of assuming the sample field order.
      Preserve unknown fields; do not infer CAN/eData units or support from labels alone.
- [ ] Keep protocol receipt/ACK/decoded-message evidence separate from a successfully
      mapped application measurement. Define the selected device's Fleet/Tenant association
      explicitly if persistence or application exposure is added.

The first milestone is a working, observable receiver and controlled routing test.
A fleet-wide migration, broad command UI, immobilization/output control, firmware
updates and unrelated CAN/global-setting changes are outside this task.

## Routing and simultaneous-delivery experiment

1. Select the test device and record its baseline destinations and fresh reporting in
   Karma. Choose the endpoint and a concrete restoration procedure before changing it.
2. Start the receiver, verify external reachability and validate decoding/ACK behavior
   with known fixtures or a simulator. Keep target identity explicit for every write.
3. Apply only the supported destination/mode changes needed for the selected test.
   Preserve existing event/reporting/CAN settings. Capture the requested configuration,
   device readback where available, and independently observed traffic.
4. Verify fresh identified messages at our receiver, successful protocol interaction
   and a reconnect cycle. A configuration queue marked transmitted or a connected
   socket alone does not satisfy this check.
5. If concurrent device delivery is supported, compare several newly generated events
   at both destinations over the same UTC interval. Use device identity, source time,
   event/reference identifiers where preserved, and payload fields to correlate them.
   Account for Karma normalization, delay, duplicates and retained historical data.
   A cached location or a message predating the change is not proof of concurrent delivery.
6. On the isolated test device, verify the documented behavior when one destination
   is unavailable and when it returns. Distinguish simultaneous reporting from
   switching to a backup server and from replaying buffered old messages.
7. Exercise restoration of the original destination and confirm fresh Karma reporting
   and the applicable management path afterward. Record the agreed final routing state.

GPS/status/voltage can provide useful initial transport evidence when available;
do not require a running engine or use missing RPM as proof that TCP routing failed.
The [Karma field reference](../discocan/erm-resources/karma-api-v2/data-models.md)
describes separately observed tracker `vin`/`vbat` fields; their availability and
layout in the direct stream must be verified for the chosen unit.

If native concurrent delivery is unsupported, document that result. Assess provider
forwarding/replication or a receiver relay to Karma as distinct alternatives only
after establishing provider support, destination protocol, ACK ownership and return
command routing. Do not claim that forwarding bytes to an assumed Karma port will work.
The portal's StarLink Test Server menu label alone does not establish replication.

## Acceptance, validation and documentation

- [ ] Deterministic focused tests cover valid/invalid frames, checksum/ACK behavior,
      fragmented/coalesced TCP input, limits, unknown layouts, reconnects, retries and
      duplicate handling. Use sanitized protocol fixtures and no live credentials in CI.
- [ ] Live evidence identifies the selected device, firmware, configuration change,
      fresh messages received by us, timestamps, reconnect behavior and verified restoration.
      If a prerequisite prevents the live test, keep that part of the task open.
- [ ] Concurrent delivery has an explicit outcome: verified for the tested configuration,
      verified unsupported for that configuration, or still unresolved with the missing
      evidence stated. Do not generalize a single-device result to every ERM model.
- [ ] Document the implemented receiver, supported formats, endpoint configuration,
      operating procedure, limitations and restoration in the appropriate Discocan docs.
      Maintain `.env.example` if new configuration is introduced. Store individual test
      results in the task response rather than a product-documentation run journal.
- [ ] Use [focused validation](../../.agents/skills/holita-focused-validation/SKILL.md)
      and [repository testing](../testing.md); add database/GraphQL checks only if those
      boundaries change. This backlog-only edit requires no application test execution.

Read `AGENTS.local.md` for authorized credential locations only if the later live work
needs them; do not copy credentials/session IDs into the task, commands or captures.
Once the requested outcome is complete, remove this task and retain the verified
workflow in authoritative documentation.
