# Karma device settings: remaining acceptance work

Archived, deprecated reference only. The tasks and approvals below are historical; do not
treat them as active work. Open ERM engineering and vendor questions belong in the
[ERM roadmap](../../todo/erm-roadmap.md).

The settings, rule authoring and measurements interface is accepted. Implemented targeting,
operation and authoring contracts belong in
[Discocan architecture](architecture.md#background-device-configuration-reads)
and the [operator workflow](development.md#background-device-configuration-reads).
Keep this backlog limited to pending work; do not restart a broad interface or architecture audit.

## P0: dated eData query latency

- Resolve the observed dated-query deadline mismatch: a Gateway request failed after about 8.03s,
  while the same historical window succeeded directly in 9.314s; another direct request timed out
  at 20.039s. Coordinate bounded Karma Client/Router/caller budgets or choose an explicitly bounded
  source-ID workflow only where the provider contract supports it. Do not add an unlimited deadline
  or silently substitute incomplete history. Use the
  [existing campaign evidence](../../discocan/erm-resources/erm-support-diagnostics-protocol-test-server/live-verification-2026-10-27.md)
  rather than repeating parameter writes.

## P1: live rule acceptance

- Obtain a fresh complete rule baseline and inspect occupied Rule IDs and exact existing
  definitions before choosing one rule change.
- Establish the supported firmware/profile's Rule ID allocation and reserved ranges, event codes,
  and raw threshold scale/units. The binary u16 range, Monitor's undocumented automatic ID choice
  and sample event codes are not allocation evidence. Keep technical inputs explicit until verified.
- Review one exact target/rule change, obtain authorization for that write, then verify independent
  complete readback, preservation of unrelated rules and subsequent event observation. Existing
  parameter/cadence evidence does not establish live rule deployment.

The remaining acceptance journey is: select truck → settings → read configuration → edit one
rule → review and send → independent readback → inspect subsequent data/events. Keep ordinary
configuration free of repeated vehicle/device selection and preserve unsaved-editor guards.
Do not add dashboards, generic job engines or additional test suites to complete this journey.

## P2: measured performance

Measure the five-second progress query's transferred data and query work. It currently includes
catalog presets, operation history and snapshots. Separate stable catalog loading only if the
measurement justifies it; retain complete evidence for results. Do not add caches or indexes from
estimates. Broader performance work remains in [review corrections](review-corrections-and-karma-management.md#performance).

## Separately scoped follow-up

- Firmware evaluation/reset semantics for TimeOf, Count, Sum, arithmetic and debounce remain in
  [measurement verification](../../todo/erm-roadmap.md#open-engineering-work).
- Verify edited Monitor INI round trips, including canonical ID expressions and unknown fields.
  Downloading original source is not proof of edited-file compatibility.
- Extend unsupported/n-ary expression editing only with evidence that meaning and bytes survive.
- Device deletion, whole-set replacement, global/profile changes, multi-rule deployment and
  restoration remain in [restoration planning](../../todo/erm-roadmap.md#open-engineering-work).
- Provider queue behavior and permissions remain in [the Karma backlog](karma-api-v2.md);
  named-operator accountability remains in [production access](../../todo/erm-roadmap.md#open-engineering-work).

Follow [focused validation](../../../.agents/skills/discocan-focused-validation/SKILL.md) and the test
budget. Preserve the production forms, generated contracts, scoped clients and original imports.
