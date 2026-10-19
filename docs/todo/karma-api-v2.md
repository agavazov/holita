# Karma API v2: unresolved questions and possible work

This backlog contains open investigation and proposed work, not implemented
requirements or a commitment to enable every provider feature. Current behavior,
source assets and coverage are documented in the
[Karma API reference](../discocan/erm-resources/karma-api-v2/README.md).

## Device recovery

- [Restore eData reporting for CB6721TE](erm-edata-recovery-cb6721te.md) after the
  reported remote configuration changes; attempt verified remote recovery first,
  then arrange on-site work if necessary.

## eData configuration interface

- [Build an eData parameter configuration interface](erm-edata-configuration-interface.md),
  using the documented device workflow and the separately maintained catalog.
  That task owns the user-facing configuration work; provider questions below
  remain shared investigation items.

## Vehicle diagnostic fault monitoring

- **DTC-01:** Develop per-truck diagnostic fault monitoring. First prove end-to-end
  acquisition of a known-present ECU fault through the installed ERM/eData
  connection; then implement continuous ingestion, persistent history, tracking of
  fault status changes and notifications. Preserve captured fault evidence after
  a fault is cleared on the vehicle, and distinguish confirmed clearance from
  missing telemetry or an empty module buffer.

## Direct ERM telemetry

- [Build an ERM TCP receiver and test device routing](erm-tcp-receiver-and-test-device-routing.md):
  receive direct telemetry, redirect one selected test device, verify restoration,
  and determine whether it can report to both holita and Karma simultaneously.
  The task distinguishes concurrent delivery from failover and provider forwarding.

## Provider contract

- **CONTRACT-01:** Obtain the official OpenAPI/response schema or confirm its location,
  ownership and update policy. Checked public `/apiv2/` discovery addresses returned
  404; the local schema is explicitly reconstructed.
- **CONTRACT-02:** Confirm exact accepted GET array syntax, scalar/array interchange,
  repeated-key behavior and JSON-body types. Resolve GET-to-POST conversion for
  GET-only help entries and define queue multi-ID path serialization.
- **CONTRACT-03:** Obtain success/error statuses and bodies for every operation,
  including HTTP-200 errors, validation errors, permission failures and partial bulk
  success. Determine whether structured error codes and request IDs exist.
- **CONTRACT-04:** Confirm version compatibility rules, changelog, deprecation notices,
  maintenance windows, request/response limits, rate limits, retry signals and SLA.
- **CONTRACT-05:** Confirm default ordering, ID allocation/monotonicity, inclusive
  `from_id`/`to_id`, per-endpoint caps and maximum request periods, retention and
  historical export completeness. Determine whether late lower-ID arrivals occur.

## Identity, authentication and account scope

- **AUTH-01:** Confirm upstream session lifetime, idle expiry, parallel-login behavior,
  account/IP limits, revocation/logout and whether concurrent reads can invalidate
  another client's session. Determine whether a least-privilege read-only account
  is available for the current integration.
- **AUTH-02:** Decide the production identity and authorization model before relying
  on demo login. Define whether the current common-account visibility remains
  appropriate for all authenticated Tenants, without silently introducing Branch
  filtering or changing Fleet isolation.
- **AUTH-03:** Establish whether Karma projects/users/roles are account-scoped,
  their permission matrix and the relation between `project_id` and `project_ids`,
  including zero values, duplicates and cross-project visibility.
- **AUTH-04:** Determine whether NC2 and API v2 share an account, identity provider,
  permissions or sessions. Treat NC2 as a separate interface until verified.
- **IDENTITY-01:** Establish the meaning/format/stability of `device_id`, whether it
  can be changed or reused, and whether an explicit mapping to Fleet Device.imei
  or Vehicle IDs is needed. Registration text alone is not a verified identity key.

## Time, units and telemetry semantics

- **TIME-01:** Confirm trips/profile filter timezone, account/car/user-zone precedence,
  DST behavior and date boundary inclusivity. Define whether trip filtering uses
  start, stop, containment or overlap and how open trips participate.
- **TIME-02:** Establish `edt`, `edt_tz` and `pdt` meanings, timezone and freshness
  guarantees. Confirm whether malformed calendar strings or missing timestamps
  can occur; distinguish device event, reception and processing times.
- **METRIC-01:** Obtain units/scales/calibration/reset semantics for `spd`, `odo`,
  trip duration/distance, night metrics and maximum speed, including device-specific
  variants. Do not introduce conversions or labels from field names alone.
- **METRIC-02:** Obtain the complete eData parameter dictionary, valid IDs, units,
  value types, nullable/missing behavior, precision, availability by device and
  whether descriptions are versioned/localized. Confirm multi-parameter filter
  semantics: selected readings only versus matching complete messages. The
  [observed descriptions](../discocan/erm-resources/karma-api-v2/observed-parameters.md)
  provide an initial partial reference, not model-specific definitions. The separate
  [versioned Simple eData catalog](../discocan/erm-resources/simple-edata-catalog/README.md)
  preserves the supplied EXE source records and imports vendor metadata into Fleet;
  it does not establish the Karma API mapping or device support.
- **EVENT-01:** Obtain the event-code catalog, meaning of zero, `extra` structures,
  `decode` behavior, external-device payload schemas and address-language output.
- **PROFILE-01:** Define nine category meanings, score/weight ranges, null/zero,
  weighting, aggregation, period minimums and possible extra categories. Establish
  whether any valid overall score can be displayed and how it must be calculated.
- **TRIP-01:** Establish active-trip flag values, nullable-stop conventions and whether
  active/closed trips are updated, split, merged or deleted under existing IDs.
  Assess pagination consistency against these changes.
- **SENSOR-01:** Obtain non-null `/sensors` samples and schemas: sensor identifiers,
  value types, timestamps, units, event linkage, decoding and behavior when no sensor
  readings exist. Null envelopes alone are insufficient.

## Uncovered resources and fields

- **HARDWARE-01:** Identify the exact ERM SKU, board revision and firmware of the
  [device described with EG915U-LA / LC86G](../discocan/erm-resources/erm-device-eg915u-la-lc86g/README.md).
  Obtain the referenced photographs/label evidence and official eight-contact
  pinout, supply/I/O ratings and supported accessories. Confirm the modem variant
  against required operator/route bands and establish installed CAN/eNet hardware,
  vehicle profiles and actual signal availability before assigning capabilities.
- **CAR-01:** Establish non-null schemas and meanings for `sim_imsi`, `sim_phone`,
  `karma_video_data` and `vehicle_type`; assess the need to expose each field.
- **DRIVER-01:** Obtain a nonempty driver response model and define driver identity,
  assignment/unassignment, `driver_ids` element types, permissions and deletion
  effects. Decide whether driver read views are needed before planning CRUD.
- **READ-01:** Assess whether list project/device filters, bulk telemetry selection,
  custom fields, local-time mode, address output or device decoding are needed by
  concrete Discocan workflows. Current single-truck views do not expose them.
- **WRITE-01:** Before implementing car/project/driver writes, establish required
  server validation, duplicate behavior, null/omitted update semantics, permitted
  project/device/zone changes, result schemas, audit needs and delete consequences.
  Define ownership relative to local Fleet records; no synchronization is implied.
- **PARAM-01:** Document `/parameters` definitions, cached versus device-query reads,
  value encodings, per-device availability, array alignment, partial errors,
  authorization, queue responses and verification of an applied configuration.
- **COMMAND-01:** Extend the [documented eData command evidence](../discocan/erm-resources/edata-simple-protocol-v4.04/parameter-reporting.md)
  with confirmed hardware/firmware compatibility, write permissions, acknowledgment
  correlation, delivery/expiry behavior, idempotency and accountability requirements.
  Do not generalize the verified parameter updates to every device command.
- **QUEUE-01:** Complete the queue response/state model beyond the observed
  single-ID reads and `transmitted` state: terminal conditions, expiry/cancellation,
  per-device/bulk mapping, retention and polling guidance remain unresolved.
- **ACCIDENT-01:** Obtain accident-ID discovery, report schema/encoding, sampling,
  coordinate axes, time/unit definitions, retention and permissions for
  `/black_box/{id}`. Determine how reports link to events, cars and devices.
- **PROTOCOL-01:** Obtain the awaited credentials for the separate
  [ERM protocol portal](../discocan/erm-resources/starlink-online-protocol/README.md)
  and identify the installed hardware/protocol versions. Verify the linked
  Check-sum calculation, Message confirmation, Binary protocol and large-packet
  pages against the supplied
  [Message structure reference](../discocan/erm-resources/starlink-online-protocol/message-structure.md):
  resolve the checksum byte-range discrepancy, command `00` validity, parameter
  `0001`/`0178`/`0179` rules, acknowledgment/reference semantics and exact size limits.
  Device-protocol capabilities must not be treated as API v2 endpoints.
- **PROTOCOL-02:** Verify StarLink Test Server binaries and message-replication
  capability; the supplied portal menu confirms this spelling of the earlier
  “StartLink Test Server” note. Establish how the separately listed StarLink Monitor
  relates to Simple eData Primitives Monitor and whether either is the product in the
  [Simple eData Monitor guide](../discocan/erm-resources/simple-edata-monitor-configuration-v1.0/README.md),
  including its executable and truck-model catalog. Determine how the
  [eData Simple 4.04 protocol](../discocan/erm-resources/edata-simple-protocol-v4.04/README.md)
  and monitor definitions correspond to API parameter IDs and whether they are
  sufficient references for a separate ingestion server.

## Adapter and verification follow-up

- **ADAPTER-01:** After provider clarification, reassess strict safe-integer/order
  assumptions, the exact-nine-category profile rule, trip date-filter verification
  and direct eData missing-car behavior against actual contracts.
- **ADAPTER-02:** Establish concrete operational needs before adding body-size bounds,
  rate-limit handling, independent login-waiter deadlines, provider diagnostics or
  other resilience mechanisms. Preserve sanitized errors and the operation budget.
- **VALIDATION-01:** Add focused adapter/GraphQL/admin fixtures only for approved
  behavior changes. Keep live credential use separate from deterministic tests;
  use dedicated database fixtures only when a change actually crosses persistence
  or service boundaries. Existing fixture coverage does not prove upstream units,
  all optional variants, completeness or write permissions.
