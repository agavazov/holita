# Admin design system: Fleet backend backlog

Pending backend/product work only. Current entities, SDL, list conditions, derived facts,
aggregates, batch actions and demo-data rules belong to the
[Fleet implementation index](../discocan/fleet.md) and
[Discocan architecture](../discocan/architecture.md#standard-list-contract). Demo seed usage is
documented in [Fleet demo data](../discocan/development.md#fleet-demo-data). Extend those actual
contracts rather than restoring the former backend slice plan or copying its obsolete SDL.

The [main backlog](admin-design-system.md) owns scope/release decisions; connected presentation
work belongs to the [frontend backlog](admin-design-system-frontend.md).

## Provider integrations

Real providers and their contracts are prerequisites for:

- Acquiring signal quality and voltage diagnostics that are absent from the current Device
  data, including units, provenance and freshness semantics.
- Firmware targets/policy and any update capability; a stored firmware string is not a target
  or a compliance policy.
- Hardware command transport, including Restart. Define supported devices, authorization,
  delivery and completion/failure semantics before exposing a live command.
- Notification generation/delivery and any account-backed feed/read state. Fleet counts do
  not constitute notifications or unread delivery state.

Keep the existing Demo/unavailable UI until each integration is real. Provider unavailability
does not block the current supported Fleet screens and must not be replaced by simulated
successful writes.

## Deferred domain work

The following requires separate product scope and is not pending Storybook screen adoption:

- Fuel entries; geozones/POIs; a diagnostic-fault lifecycle; eData readings and reporting
  configuration; driver-assignment history.
- Demo dataset refresh/versioning. The fixed anchor intentionally ages against the business
  date; do not update existing seed rows to refresh it. Any refresh proposal must define a new
  dataset version/IDs and preserve insert-only/idempotent behavior and local safety guards.

Use [Discocan testing](../discocan/testing.md) for the actual focused service, persistence,
federation and contract checks. Keep validation results in the task response, not a backend
implementation journal.
