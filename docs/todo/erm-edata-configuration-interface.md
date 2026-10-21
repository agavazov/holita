# ERM eData reporting verification and restoration

The implemented parameter editor and durable ADD/UPDATE contracts are documented in
[device configuration operations](../discocan/architecture.md#background-device-configuration-reads).
Keep only the remaining work here; packet layouts and manual device evidence belong in
[parameter reporting](../discocan/erm-resources/edata-simple-protocol-v4.04/parameter-reporting.md).

## Measurement verification

- Relate a confirmed configuration change to fresh subsequent `/edata` IDs, timestamps
  and values over several expected intervals, independently of the stored definition.
- Distinguish unavailable/asleep/ignition-off/CAN-inactive signals from failed reporting
  without inventing a cause from missing data. Preserve zero/null/absence distinctions.
- Explain what can be established after a zero interval without equating configuration
  readback with stopped measurements. Keep device sampling/reporting and upstream delivery
  intervals separate unless their relationship is verified.

## Scoped restoration

- Design an explicit restoration action from a captured pre-change definition and exact
  target identity, with fresh preflight and independent whole-set verification.
- Treat removal of a newly added ID separately from restoring a pre-existing definition;
  review rule/histogram dependencies before offering deletion. Do not restore from
  measurement history or replay a complete Monitor export.

## Production access and accountability

- Define named-operator authorization and audit requirements for device control; the demo
  Tenant session and shared Karma vehicle visibility do not establish those permissions.
- Preserve target, intent, before/after evidence and uncertainty without authentication
  material, and account for delayed vendor delivery after the local deadline.

Provider questions about queue states, acknowledgments, cancellation, retry semantics and
permissions remain in the [Karma API backlog](karma-api-v2.md#uncovered-resources-and-fields).
